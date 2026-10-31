using Microsoft.EntityFrameworkCore;
using RentEase.Api.Common;
using RentEase.Api.Data;
using RentEase.Api.DTOs;
using RentEase.Api.Models;

namespace RentEase.Api.Services;

/// <summary>
/// Properties. Status rules keep occupancy consistent with rental assignments:
///   Occupied    — set only by assigning a tenant, cleared only by ending the rental
///   Available / Maintenance — chosen by the landlord while there is no active rental
/// </summary>
public class PropertyService
{
    private readonly AppDbContext _db;
    private readonly CurrentUser _user;
    private readonly DataScope _scope;
    private readonly RentStatusRefresher _rentStatus;

    public PropertyService(AppDbContext db, CurrentUser user, DataScope scope, RentStatusRefresher rentStatus)
    {
        _db = db;
        _user = user;
        _scope = scope;
        _rentStatus = rentStatus;
    }

    /// <summary>Sort keys: name, rent, city, status, createdAt (default).</summary>
    public Task<PagedResult<PropertyListItemDto>> GetAllAsync(PropertyQuery q)
    {
        var query = Filter(_scope.Properties().AsNoTracking(), q);

        var desc = q.SortDescending;
        query = q.SortBy?.ToLowerInvariant() switch
        {
            "name" => query.OrderBy(p => p.PropertyName, desc),
            "rent" => query.OrderBy(p => p.MonthlyRent, desc),
            "city" => query.OrderBy(p => p.City, desc).ThenBy(p => p.PropertyName),
            "status" => query.OrderBy(p => p.Status, desc).ThenBy(p => p.PropertyName),
            "createdat" => query.OrderBy(p => p.CreatedAt, desc),
            _ => query.OrderByDescending(p => p.CreatedAt)
        };

        return ToListItems(query).ToPagedResultAsync(q);
    }

    /// <summary>Shared with ReportService so the occupancy report lists properties the same way.</summary>
    public IQueryable<PropertyListItemDto> ToListItems(IQueryable<Property> query)
    {
        // A tenant should not see who else has rented a property, only their own name
        var tenantId = _user.IsTenant ? _user.UserId : (int?)null;

        return query.Select(p => new PropertyListItemDto
        {
            PropertyId = p.PropertyId,
            PropertyName = p.PropertyName,
            PropertyType = p.PropertyType,
            Address = p.Address,
            City = p.City,
            State = p.State,
            PostalCode = p.PostalCode,
            MonthlyRent = p.MonthlyRent,
            Status = p.Status,
            LandlordId = p.LandlordId,
            LandlordName = p.Landlord.FirstName + " " + p.Landlord.LastName,
            CurrentTenantName = p.TenantProperties
                .Where(tp => tp.Status == AssignmentStatuses.Active && (tenantId == null || tp.TenantId == tenantId))
                .Select(tp => tp.Tenant.FirstName + " " + tp.Tenant.LastName)
                .FirstOrDefault(),
            CreatedAt = p.CreatedAt
        });
    }

    private static IQueryable<Property> Filter(IQueryable<Property> query, PropertyQuery q)
    {
        if (!string.IsNullOrWhiteSpace(q.Search))
        {
            var s = q.Search.Trim();
            query = query.Where(p => p.PropertyName.Contains(s) || p.City.Contains(s) || p.Address.Contains(s));
        }
        if (!string.IsNullOrWhiteSpace(q.Status))
            query = query.Where(p => p.Status == q.Status);
        if (!string.IsNullOrWhiteSpace(q.Type))
            query = query.Where(p => p.PropertyType == q.Type);
        if (q.LandlordId.HasValue)
            query = query.Where(p => p.LandlordId == q.LandlordId.Value);
        return query;
    }

    public async Task<PropertyDetailsDto> GetByIdAsync(int id)
    {
        await _rentStatus.RefreshAsync();

        var property = await _scope.Properties().AsNoTracking()
            .Where(p => p.PropertyId == id)
            .Select(p => new PropertyDetailsDto
            {
                PropertyId = p.PropertyId,
                PropertyName = p.PropertyName,
                PropertyType = p.PropertyType,
                Address = p.Address,
                City = p.City,
                State = p.State,
                PostalCode = p.PostalCode,
                MonthlyRent = p.MonthlyRent,
                Status = p.Status,
                Description = p.Description,
                LandlordId = p.LandlordId,
                LandlordName = p.Landlord.FirstName + " " + p.Landlord.LastName,
                LandlordEmail = p.Landlord.Email,
                LandlordPhone = p.Landlord.PhoneNumber,
                CreatedAt = p.CreatedAt,
                UpdatedAt = p.UpdatedAt,
                CanDelete = !p.TenantProperties.Any() && !p.Complaints.Any()
            })
            .FirstOrDefaultAsync()
            ?? throw ApiException.NotFound("Property not found.");

        // Assignments, rent and complaints go through DataScope, so a tenant only gets their own
        var assignments = await _scope.Assignments().AsNoTracking()
            .Where(tp => tp.PropertyId == id)
            .OrderByDescending(tp => tp.StartDate)
            .Select(AssignmentDto.Projection)
            .ToListAsync();

        property.CurrentAssignment = assignments.FirstOrDefault(a => a.Status == AssignmentStatuses.Active);
        property.CurrentTenantName = property.CurrentAssignment?.TenantName;
        property.AssignmentHistory = assignments.Where(a => a.Status == AssignmentStatuses.Completed).ToList();

        var rent = _scope.RentPayments().AsNoTracking().Where(r => r.TenantProperty.PropertyId == id);
        property.RentSummary = await RentMath.SummarizeAsync(rent);
        property.RecentRent = await rent.OrderByDescending(r => r.BillingMonth).Take(6)
            .Select(RentPaymentListItemDto.Projection).ToListAsync();

        property.OpenComplaints = await _scope.Complaints()
            .CountAsync(c => c.PropertyId == id && c.Status != ComplaintStatuses.Resolved);

        if (_user.IsTenant) property.CanDelete = false;
        return property;
    }

    public async Task<int> CreateAsync(PropertyRequest request)
    {
        ValidateTypeAndStatus(request);
        if (request.Status == PropertyStatuses.Occupied)
            throw ApiException.BadRequest("A new property is Available or under Maintenance. It becomes Occupied when you assign a tenant.");

        var landlordId = await ResolveLandlordIdAsync(request.LandlordId);
        var now = DateTime.UtcNow;

        var property = new Property { LandlordId = landlordId, CreatedAt = now };
        Apply(property, request);
        property.UpdatedAt = now;

        _db.Properties.Add(property);
        await _db.SaveChangesAsync();
        return property.PropertyId;
    }

    public async Task UpdateAsync(int id, PropertyRequest request)
    {
        var property = await _scope.Properties().FirstOrDefaultAsync(p => p.PropertyId == id)
                       ?? throw ApiException.NotFound("Property not found.");

        ValidateTypeAndStatus(request);

        var hasActiveRental = await _db.TenantProperties
            .AnyAsync(tp => tp.PropertyId == id && tp.Status == AssignmentStatuses.Active);

        if (hasActiveRental && request.Status != PropertyStatuses.Occupied)
            throw ApiException.Conflict("This property has an active tenant, so it stays Occupied. End the rental first to change its status.");
        if (!hasActiveRental && request.Status == PropertyStatuses.Occupied)
            throw ApiException.BadRequest("A property becomes Occupied by assigning a tenant, not by editing its status.");

        Apply(property, request);
        property.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();
    }

    public async Task DeleteAsync(int id)
    {
        var property = await _scope.Properties().FirstOrDefaultAsync(p => p.PropertyId == id)
                       ?? throw ApiException.NotFound("Property not found.");

        var hasHistory = await _db.TenantProperties.AnyAsync(tp => tp.PropertyId == id)
                         || await _db.Complaints.AnyAsync(c => c.PropertyId == id);
        if (hasHistory)
            throw ApiException.Conflict("This property has rental or complaint history and cannot be deleted. Set its status to Maintenance to take it off the market instead.");

        _db.Properties.Remove(property);
        await _db.SaveChangesAsync();
    }

    private async Task<int> ResolveLandlordIdAsync(int? requestedLandlordId)
    {
        // A landlord always owns what they create; the request's LandlordId is ignored
        if (_user.IsLandlord) return _user.UserId;

        if (!requestedLandlordId.HasValue)
            throw ApiException.BadRequest("Select the landlord who owns this property.");

        var isActiveLandlord = await _db.Users.AnyAsync(u =>
            u.UserId == requestedLandlordId.Value && u.Role.RoleName == AppRoles.Landlord && u.IsActive);
        if (!isActiveLandlord)
            throw ApiException.BadRequest("The selected landlord was not found or is inactive.");

        return requestedLandlordId.Value;
    }

    private static void ValidateTypeAndStatus(PropertyRequest request)
    {
        if (!PropertyTypes.All.Contains(request.PropertyType))
            throw ApiException.BadRequest($"Property type must be one of: {string.Join(", ", PropertyTypes.All)}.");
        if (!PropertyStatuses.All.Contains(request.Status))
            throw ApiException.BadRequest($"Status must be one of: {string.Join(", ", PropertyStatuses.All)}.");
    }

    private static void Apply(Property property, PropertyRequest request)
    {
        property.PropertyName = request.PropertyName.Trim();
        property.PropertyType = request.PropertyType;
        property.Address = request.Address.Trim();
        property.City = request.City.Trim();
        property.State = request.State.Trim();
        property.PostalCode = string.IsNullOrWhiteSpace(request.PostalCode) ? null : request.PostalCode.Trim();
        property.MonthlyRent = Math.Round(request.MonthlyRent!.Value, 2);
        property.Status = request.Status;
        property.Description = string.IsNullOrWhiteSpace(request.Description) ? null : request.Description.Trim();
    }
}
