using Microsoft.EntityFrameworkCore;
using RentEase.Api.Common;
using RentEase.Api.Data;
using RentEase.Api.DTOs;
using RentEase.Api.Models;

namespace RentEase.Api.Services;

/// <summary>Maintenance complaints: raised by tenants, handled by the property's landlord or an admin.</summary>
public class ComplaintService
{
    private readonly AppDbContext _db;
    private readonly CurrentUser _user;
    private readonly DataScope _scope;
    private readonly NotificationService _notifications;

    public ComplaintService(AppDbContext db, CurrentUser user, DataScope scope, NotificationService notifications)
    {
        _db = db;
        _user = user;
        _scope = scope;
        _notifications = notifications;
    }

    /// <summary>Sort keys: createdAt (default, newest first), updatedAt, priority, status, title, property.</summary>
    public Task<PagedResult<ComplaintListItemDto>> GetAllAsync(ComplaintQuery q)
    {
        var query = _scope.Complaints().AsNoTracking();

        if (!string.IsNullOrWhiteSpace(q.Status))
            query = query.Where(c => c.Status == q.Status);
        if (!string.IsNullOrWhiteSpace(q.Priority))
            query = query.Where(c => c.Priority == q.Priority);
        if (q.CategoryId.HasValue)
            query = query.Where(c => c.CategoryId == q.CategoryId.Value);
        if (q.PropertyId.HasValue)
            query = query.Where(c => c.PropertyId == q.PropertyId.Value);
        if (!string.IsNullOrWhiteSpace(q.Search))
        {
            var s = q.Search.Trim();
            query = query.Where(c =>
                c.Title.Contains(s) ||
                c.Property.PropertyName.Contains(s) ||
                (c.Tenant.FirstName + " " + c.Tenant.LastName).Contains(s));
        }

        var desc = q.SortDescending;
        query = q.SortBy?.ToLowerInvariant() switch
        {
            // High > Medium > Low, not alphabetical
            "priority" => query.OrderBy(c => c.Priority == "High" ? 3 : c.Priority == "Medium" ? 2 : 1, desc)
                .ThenByDescending(c => c.CreatedAt),
            "status" => query.OrderBy(c => c.Status == ComplaintStatuses.Open ? 1 : c.Status == ComplaintStatuses.InProgress ? 2 : 3, desc)
                .ThenByDescending(c => c.CreatedAt),
            "title" => query.OrderBy(c => c.Title, desc),
            "property" => query.OrderBy(c => c.Property.PropertyName, desc).ThenByDescending(c => c.CreatedAt),
            "updatedat" => query.OrderBy(c => c.UpdatedAt, desc),
            "createdat" => query.OrderBy(c => c.CreatedAt, desc),
            _ => query.OrderByDescending(c => c.CreatedAt)
        };

        return query.Select(ComplaintListItemDto.Projection).ToPagedResultAsync(q);
    }

    public async Task<ComplaintDetailsDto> GetByIdAsync(int id)
    {
        return await _scope.Complaints().AsNoTracking()
            .Where(c => c.ComplaintId == id)
            .Select(c => new ComplaintDetailsDto
            {
                ComplaintId = c.ComplaintId,
                Title = c.Title,
                Description = c.Description,
                Status = c.Status,
                Priority = c.Priority,
                CategoryId = c.CategoryId,
                CategoryName = c.Category.CategoryName,
                PropertyId = c.PropertyId,
                PropertyName = c.Property.PropertyName,
                PropertyAddress = c.Property.Address + ", " + c.Property.City,
                TenantId = c.TenantId,
                TenantName = c.Tenant.FirstName + " " + c.Tenant.LastName,
                TenantEmail = c.Tenant.Email,
                TenantPhone = c.Tenant.PhoneNumber,
                LandlordName = c.Property.Landlord.FirstName + " " + c.Property.Landlord.LastName,
                CreatedAt = c.CreatedAt,
                UpdatedAt = c.UpdatedAt,
                ResolvedAt = c.ResolvedAt
            })
            .FirstOrDefaultAsync()
            ?? throw ApiException.NotFound("Complaint not found.");
    }

    public Task<List<ComplaintCategoryDto>> GetCategoriesAsync() =>
        _db.ComplaintCategories.AsNoTracking()
            .Where(c => c.IsActive)
            .OrderBy(c => c.CategoryName == "Other").ThenBy(c => c.CategoryName) // "Other" last
            .Select(c => new ComplaintCategoryDto { CategoryId = c.CategoryId, CategoryName = c.CategoryName })
            .ToListAsync();

    /// <summary>Tenant only. The tenant id comes from the token; the property must be their active rental.</summary>
    public async Task<int> CreateAsync(CreateComplaintRequest request)
    {
        if (!ComplaintPriorities.All.Contains(request.Priority))
            throw ApiException.BadRequest("Priority must be Low, Medium or High.");

        var property = await _db.TenantProperties
            .Where(tp => tp.TenantId == _user.UserId && tp.PropertyId == request.PropertyId
                         && tp.Status == AssignmentStatuses.Active)
            .Select(tp => new { tp.Property.PropertyId, tp.Property.PropertyName, tp.Property.LandlordId })
            .FirstOrDefaultAsync()
            ?? throw ApiException.BadRequest("You can only report issues for the property you currently rent.");

        var categoryExists = await _db.ComplaintCategories.AnyAsync(c => c.CategoryId == request.CategoryId && c.IsActive);
        if (!categoryExists)
            throw ApiException.BadRequest("Select a valid category.");

        var now = DateTime.UtcNow;
        var complaint = new Complaint
        {
            TenantId = _user.UserId,
            PropertyId = property.PropertyId,
            CategoryId = request.CategoryId!.Value,
            Title = request.Title.Trim(),
            Description = request.Description.Trim(),
            Status = ComplaintStatuses.Open,
            Priority = request.Priority,
            CreatedAt = now,
            UpdatedAt = now
        };
        _db.Complaints.Add(complaint);

        var tenantName = await _db.Users.Where(u => u.UserId == _user.UserId)
            .Select(u => u.FirstName + " " + u.LastName).FirstAsync();
        _notifications.Queue(property.LandlordId, "New complaint",
            $"{tenantName} reported a {request.Priority.ToLowerInvariant()}-priority issue at {property.PropertyName}: \"{complaint.Title}\".");

        await _db.SaveChangesAsync(); // complaint + notification in one transaction
        return complaint.ComplaintId;
    }

    /// <summary>Landlord (own properties) or Admin. Resolving sets ResolvedAt; reopening clears it.</summary>
    public async Task UpdateStatusAsync(int id, string status)
    {
        if (!ComplaintStatuses.All.Contains(status))
            throw ApiException.BadRequest("Status must be Open, In Progress or Resolved.");

        var complaint = await _scope.Complaints()
            .Include(c => c.Property)
            .FirstOrDefaultAsync(c => c.ComplaintId == id)
            ?? throw ApiException.NotFound("Complaint not found.");

        if (complaint.Status == status)
            throw ApiException.BadRequest($"This complaint is already {status}.");

        var now = DateTime.UtcNow;
        var wasResolved = complaint.Status == ComplaintStatuses.Resolved;

        complaint.Status = status;
        complaint.UpdatedAt = now;
        complaint.ResolvedAt = status == ComplaintStatuses.Resolved ? now : null;

        var message = status switch
        {
            ComplaintStatuses.Resolved => $"Your complaint \"{complaint.Title}\" at {complaint.Property.PropertyName} has been resolved.",
            _ when wasResolved => $"Your complaint \"{complaint.Title}\" at {complaint.Property.PropertyName} was reopened and is now {status}.",
            _ => $"Your complaint \"{complaint.Title}\" at {complaint.Property.PropertyName} is now {status}."
        };
        _notifications.Queue(complaint.TenantId, "Complaint update", message);

        // When an admin steps in, keep the landlord informed too
        if (_user.IsAdmin)
            _notifications.Queue(complaint.Property.LandlordId, "Complaint update",
                $"An administrator changed \"{complaint.Title}\" at {complaint.Property.PropertyName} to {status}.");

        await _db.SaveChangesAsync();
    }
}
