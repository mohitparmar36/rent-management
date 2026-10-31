using Microsoft.EntityFrameworkCore;
using RentEase.Api.Common;
using RentEase.Api.Data;
using RentEase.Api.DTOs;
using RentEase.Api.Models;

namespace RentEase.Api.Services;

/// <summary>
/// Tenant accounts as seen by Admins and Landlords. A landlord sees tenants who have
/// rented one of their properties, and only the rentals and rent on their own properties.
/// </summary>
public class TenantService
{
    private readonly AppDbContext _db;
    private readonly CurrentUser _user;
    private readonly DataScope _scope;
    private readonly UserService _users;
    private readonly AssignmentService _assignments;
    private readonly RentStatusRefresher _rentStatus;

    public TenantService(AppDbContext db, CurrentUser user, DataScope scope, UserService users,
        AssignmentService assignments, RentStatusRefresher rentStatus)
    {
        _db = db;
        _user = user;
        _scope = scope;
        _users = users;
        _assignments = assignments;
        _rentStatus = rentStatus;
    }

    /// <summary>Sort keys: name (default), email, property.</summary>
    public Task<PagedResult<TenantListItemDto>> GetAllAsync(TenantQuery q)
    {
        var landlordId = _user.IsLandlord ? _user.UserId : (int?)null;
        var query = _scope.Tenants().AsNoTracking();

        if (!string.IsNullOrWhiteSpace(q.Search))
        {
            var s = q.Search.Trim();
            query = query.Where(u => (u.FirstName + " " + u.LastName).Contains(s) || u.Email.Contains(s));
        }

        // "Housed"/"Unassigned" are relative to what the caller can see
        if (q.Status == "Housed")
            query = query.Where(u => u.TenantProperties.Any(tp => tp.Status == AssignmentStatuses.Active
                && (landlordId == null || tp.Property.LandlordId == landlordId)));
        else if (q.Status == "Unassigned")
            query = query.Where(u => !u.TenantProperties.Any(tp => tp.Status == AssignmentStatuses.Active
                && (landlordId == null || tp.Property.LandlordId == landlordId)));

        var desc = q.SortDescending;
        query = q.SortBy?.ToLowerInvariant() switch
        {
            "email" => query.OrderBy(u => u.Email, desc),
            "property" => query.OrderBy(u => u.TenantProperties
                .Where(tp => tp.Status == AssignmentStatuses.Active)
                .Select(tp => tp.Property.PropertyName).FirstOrDefault(), desc),
            _ => query.OrderBy(u => u.FirstName, desc).ThenBy(u => u.LastName)
        };

        return query.Select(u => new
            {
                User = u,
                Active = u.TenantProperties
                    .Where(tp => tp.Status == AssignmentStatuses.Active
                                 && (landlordId == null || tp.Property.LandlordId == landlordId))
                    .Select(tp => new { tp.TenantPropertyId, tp.PropertyId, tp.Property.PropertyName, tp.StartDate })
                    .FirstOrDefault(),
                Count = u.TenantProperties.Count(tp => landlordId == null || tp.Property.LandlordId == landlordId)
            })
            .Select(x => new TenantListItemDto
            {
                UserId = x.User.UserId,
                FirstName = x.User.FirstName,
                LastName = x.User.LastName,
                Email = x.User.Email,
                PhoneNumber = x.User.PhoneNumber,
                IsActive = x.User.IsActive,
                CurrentAssignmentId = x.Active == null ? null : x.Active.TenantPropertyId,
                CurrentPropertyId = x.Active == null ? null : x.Active.PropertyId,
                CurrentPropertyName = x.Active == null ? null : x.Active.PropertyName,
                CurrentStartDate = x.Active == null ? null : x.Active.StartDate,
                AssignmentCount = x.Count
            })
            .ToPagedResultAsync(q);
    }

    /// <summary>
    /// Active tenants with no active rental — the only people who can be assigned.
    /// Returns just name and email, so landlords can pick a tenant without seeing other details.
    /// </summary>
    public Task<List<TenantOptionDto>> GetAvailableAsync(string? search)
    {
        var query = _db.Users.AsNoTracking()
            .Where(u => u.Role.RoleName == AppRoles.Tenant && u.IsActive
                        && !u.TenantProperties.Any(tp => tp.Status == AssignmentStatuses.Active));

        if (!string.IsNullOrWhiteSpace(search))
        {
            var s = search.Trim();
            query = query.Where(u => (u.FirstName + " " + u.LastName).Contains(s) || u.Email.Contains(s));
        }

        return query
            .OrderBy(u => u.FirstName).ThenBy(u => u.LastName)
            .Take(50)
            .Select(u => new TenantOptionDto { UserId = u.UserId, FullName = u.FirstName + " " + u.LastName, Email = u.Email })
            .ToListAsync();
    }

    public async Task<TenantDetailsDto> GetByIdAsync(int id)
    {
        await _rentStatus.RefreshAsync();

        var tenant = await _scope.Tenants().AsNoTracking()
            .Where(u => u.UserId == id)
            .Select(u => new TenantDetailsDto
            {
                UserId = u.UserId,
                FirstName = u.FirstName,
                LastName = u.LastName,
                Email = u.Email,
                PhoneNumber = u.PhoneNumber,
                IsActive = u.IsActive,
                CreatedAt = u.CreatedAt
            })
            .FirstOrDefaultAsync()
            ?? throw ApiException.NotFound("Tenant not found.");

        // DataScope.Assignments()/RentPayments() already limit a landlord to their own properties
        tenant.Assignments = await _scope.Assignments().AsNoTracking()
            .Where(tp => tp.TenantId == id)
            .OrderBy(tp => tp.Status).ThenByDescending(tp => tp.StartDate)
            .Select(AssignmentDto.Projection)
            .ToListAsync();

        tenant.RentSummary = await RentMath.SummarizeAsync(
            _scope.RentPayments().Where(r => r.TenantProperty.TenantId == id));

        return tenant;
    }

    /// <summary>Creates a tenant account, optionally assigning it to a property in the same transaction.</summary>
    public async Task<(int UserId, int? AssignmentId)> CreateAsync(CreateTenantRequest request)
    {
        var tenantRole = await _db.Roles.FirstAsync(r => r.RoleName == AppRoles.Tenant);
        var tenant = await _users.NewUserAsync(tenantRole.RoleId, request.FirstName, request.LastName,
            request.Email, request.PhoneNumber, request.Password);
        _db.Users.Add(tenant);

        TenantProperty? assignment = null;
        if (request.PropertyId.HasValue)
        {
            var start = request.StartDate ?? throw ApiException.BadRequest("Start date is required when assigning a property.");
            assignment = await _assignments.QueueAssignmentAsync(tenant, request.PropertyId.Value, start, request.EndDate);
        }
        else if (_user.IsLandlord)
        {
            // Without a rental the landlord would have no link to this tenant and could not see them again
            throw ApiException.BadRequest("Select one of your vacant properties to assign the new tenant to.");
        }

        await _assignments.SaveAssignmentAsync(); // user + assignment + property + notifications, one transaction
        return (tenant.UserId, assignment?.TenantPropertyId);
    }
}
