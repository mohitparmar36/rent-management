using Microsoft.EntityFrameworkCore;
using RentEase.Api.Common;
using RentEase.Api.Data;
using RentEase.Api.DTOs;
using RentEase.Api.Models;

namespace RentEase.Api.Services;

/// <summary>
/// Rental assignments (TenantProperties). Rules:
///   - only Admins and the owning Landlord create or end assignments
///   - a property has at most one Active assignment (also enforced by a unique index)
///   - a tenant has at most one Active assignment at a time
///   - creating an assignment marks the property Occupied; ending it marks it Available
///   - ending an assignment keeps it (status Completed) and all of its rent records
/// </summary>
public class AssignmentService
{
    private readonly AppDbContext _db;
    private readonly CurrentUser _user;
    private readonly DataScope _scope;
    private readonly NotificationService _notifications;
    private readonly RentStatusRefresher _rentStatus;

    public AssignmentService(AppDbContext db, CurrentUser user, DataScope scope,
        NotificationService notifications, RentStatusRefresher rentStatus)
    {
        _db = db;
        _user = user;
        _scope = scope;
        _notifications = notifications;
        _rentStatus = rentStatus;
    }

    /// <summary>Sort keys: startDate (default), tenant, property, status.</summary>
    public Task<PagedResult<AssignmentDto>> GetAllAsync(AssignmentQuery q)
    {
        var query = _scope.Assignments().AsNoTracking();

        if (!string.IsNullOrWhiteSpace(q.Status))
            query = query.Where(tp => tp.Status == q.Status);
        if (q.PropertyId.HasValue)
            query = query.Where(tp => tp.PropertyId == q.PropertyId.Value);
        if (q.TenantId.HasValue)
            query = query.Where(tp => tp.TenantId == q.TenantId.Value);

        if (!string.IsNullOrWhiteSpace(q.Search))
        {
            var s = q.Search.Trim();
            query = query.Where(tp =>
                (tp.Tenant.FirstName + " " + tp.Tenant.LastName).Contains(s) ||
                tp.Property.PropertyName.Contains(s));
        }

        var desc = q.SortDescending;
        query = q.SortBy?.ToLowerInvariant() switch
        {
            "tenant" => query.OrderBy(tp => tp.Tenant.FirstName, desc).ThenBy(tp => tp.Tenant.LastName),
            "property" => query.OrderBy(tp => tp.Property.PropertyName, desc),
            "status" => query.OrderBy(tp => tp.Status, desc).ThenByDescending(tp => tp.StartDate),
            "startdate" => query.OrderBy(tp => tp.StartDate, desc),
            _ => query.OrderBy(tp => tp.Status).ThenByDescending(tp => tp.StartDate) // Active first
        };

        return query.Select(AssignmentDto.Projection).ToPagedResultAsync(q);
    }

    public async Task<AssignmentDetailsDto> GetByIdAsync(int id)
    {
        await _rentStatus.RefreshAsync();

        var assignment = await _scope.Assignments()
            .AsNoTracking()
            .Where(tp => tp.TenantPropertyId == id)
            .Select(AssignmentDto.Projection)
            .FirstOrDefaultAsync()
            ?? throw ApiException.NotFound("Rental assignment not found.");

        var rent = _db.RentPayments.AsNoTracking().Where(r => r.TenantPropertyId == id);

        return new AssignmentDetailsDto
        {
            TenantPropertyId = assignment.TenantPropertyId,
            TenantId = assignment.TenantId,
            TenantName = assignment.TenantName,
            TenantEmail = assignment.TenantEmail,
            TenantPhone = assignment.TenantPhone,
            PropertyId = assignment.PropertyId,
            PropertyName = assignment.PropertyName,
            PropertyAddress = assignment.PropertyAddress,
            MonthlyRent = assignment.MonthlyRent,
            LandlordName = assignment.LandlordName,
            LandlordEmail = assignment.LandlordEmail,
            LandlordPhone = assignment.LandlordPhone,
            StartDate = assignment.StartDate,
            EndDate = assignment.EndDate,
            Status = assignment.Status,
            CreatedAt = assignment.CreatedAt,
            RentRecords = await rent.OrderByDescending(r => r.BillingMonth)
                .Select(RentPaymentListItemDto.Projection).ToListAsync(),
            RentSummary = await RentMath.SummarizeAsync(rent)
        };
    }

    public async Task<int> CreateAsync(CreateAssignmentRequest request)
    {
        var tenant = await _db.Users
            .Include(u => u.Role)
            .FirstOrDefaultAsync(u => u.UserId == request.TenantId)
            ?? throw ApiException.BadRequest("The selected tenant was not found.");

        if (tenant.Role.RoleName != AppRoles.Tenant)
            throw ApiException.BadRequest("Only users with the Tenant role can be assigned to a property.");
        if (!tenant.IsActive)
            throw ApiException.BadRequest("This tenant's account is deactivated.");
        if (await _db.TenantProperties.AnyAsync(tp => tp.TenantId == tenant.UserId && tp.Status == AssignmentStatuses.Active))
            throw ApiException.Conflict($"{tenant.FirstName} {tenant.LastName} already has an active rental. End it before assigning a new property.");

        var assignment = await QueueAssignmentAsync(tenant, request.PropertyId!.Value, request.StartDate!.Value, request.EndDate);
        await SaveAssignmentAsync();
        return assignment.TenantPropertyId;
    }

    /// <summary>
    /// Validates the property side of a new assignment and queues all changes
    /// (assignment, property status, notifications) without saving. The caller saves
    /// once, so everything succeeds or fails together.
    /// </summary>
    public async Task<TenantProperty> QueueAssignmentAsync(User tenant, int propertyId, DateOnly startDate, DateOnly? endDate)
    {
        // Admin may use any property; a landlord only their own (others are "not found")
        var property = await _scope.Properties()
            .Include(p => p.Landlord)
            .FirstOrDefaultAsync(p => p.PropertyId == propertyId)
            ?? throw ApiException.NotFound("Property not found.");

        if (_user.IsTenant)
            throw ApiException.Forbidden("Tenants cannot create rental assignments.");

        if (await _db.TenantProperties.AnyAsync(tp => tp.PropertyId == propertyId && tp.Status == AssignmentStatuses.Active))
            throw ApiException.Conflict("This property already has an active tenant.");
        if (property.Status == PropertyStatuses.Maintenance)
            throw ApiException.Conflict("This property is under maintenance. Set it to Available before assigning a tenant.");

        ValidateDates(startDate, endDate);

        var assignment = new TenantProperty
        {
            Tenant = tenant,
            PropertyId = property.PropertyId,
            StartDate = startDate,
            EndDate = endDate,
            Status = AssignmentStatuses.Active,
            CreatedAt = DateTime.UtcNow
        };
        _db.TenantProperties.Add(assignment);

        property.Status = PropertyStatuses.Occupied;
        property.UpdatedAt = DateTime.UtcNow;

        _notifications.Queue(tenant, "Welcome to your new home",
            $"You have been assigned to {property.PropertyName} from {Format.Date(startDate)}. Monthly rent: {Format.Money(property.MonthlyRent)}.");

        if (property.LandlordId != _user.UserId)
            _notifications.Queue(property.LandlordId, "Tenant assigned",
                $"{tenant.FirstName} {tenant.LastName} was assigned to {property.PropertyName} from {Format.Date(startDate)}.");

        return assignment;
    }

    /// <summary>Saves a queued assignment, turning a race on the unique index into a clear message.</summary>
    public async Task SaveAssignmentAsync()
    {
        try
        {
            await _db.SaveChangesAsync();
        }
        catch (DbUpdateException ex) when (DbErrors.IsUniqueViolation(ex))
        {
            throw ApiException.Conflict("This property already has an active tenant.");
        }
    }

    public async Task CompleteAsync(int id, DateOnly endDate)
    {
        var assignment = await _scope.Assignments()
            .Include(tp => tp.Property)
            .FirstOrDefaultAsync(tp => tp.TenantPropertyId == id)
            ?? throw ApiException.NotFound("Rental assignment not found.");

        if (assignment.Status != AssignmentStatuses.Active)
            throw ApiException.Conflict("This rental has already ended.");
        if (endDate < assignment.StartDate)
            throw ApiException.BadRequest($"End date cannot be before the start date ({Format.Date(assignment.StartDate)}).");
        // Ending a rental frees the property now, so the move-out must already have happened
        if (endDate > RentMath.Today())
            throw ApiException.BadRequest("End date cannot be in the future. End the rental on or after the move-out day.");

        assignment.Status = AssignmentStatuses.Completed;
        assignment.EndDate = endDate;

        // The property is free again (unless the landlord had already put it into maintenance)
        if (assignment.Property.Status == PropertyStatuses.Occupied)
            assignment.Property.Status = PropertyStatuses.Available;
        assignment.Property.UpdatedAt = DateTime.UtcNow;

        _notifications.Queue(assignment.TenantId, "Rental ended",
            $"Your rental of {assignment.Property.PropertyName} ended on {Format.Date(endDate)}. Your rent history remains available.");

        await _db.SaveChangesAsync(); // one transaction: assignment + property + notification
    }

    private static void ValidateDates(DateOnly start, DateOnly? end)
    {
        var today = RentMath.Today();
        if (start < today.AddYears(-5))
            throw ApiException.BadRequest("Start date is too far in the past.");
        if (start > today.AddYears(1))
            throw ApiException.BadRequest("Start date cannot be more than a year in the future.");
        if (end.HasValue && end.Value <= start)
            throw ApiException.BadRequest("End date must be after the start date.");
    }
}
