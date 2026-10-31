using Microsoft.EntityFrameworkCore;
using RentEase.Api.Common;
using RentEase.Api.Data;
using RentEase.Api.DTOs;

namespace RentEase.Api.Services;

/// <summary>Role-specific dashboard figures, all calculated from the database.</summary>
public class DashboardService
{
    private const int ChartMonths = 6;

    private readonly AppDbContext _db;
    private readonly CurrentUser _user;
    private readonly DataScope _scope;
    private readonly RentStatusRefresher _rentStatus;

    public DashboardService(AppDbContext db, CurrentUser user, DataScope scope, RentStatusRefresher rentStatus)
    {
        _db = db;
        _user = user;
        _scope = scope;
        _rentStatus = rentStatus;
    }

    public async Task<AdminDashboardDto> GetAdminAsync()
    {
        await _rentStatus.RefreshAsync();

        var dto = new AdminDashboardDto
        {
            TotalUsers = await _db.Users.CountAsync(),
            TotalLandlords = await _db.Users.CountAsync(u => u.Role.RoleName == AppRoles.Landlord),
            TotalTenants = await _db.Users.CountAsync(u => u.Role.RoleName == AppRoles.Tenant),
            OpenComplaints = await _db.Complaints.CountAsync(c => c.Status != ComplaintStatuses.Resolved),
            Rent = await RentMath.SummarizeAsync(_db.RentPayments),
            MonthlyCollection = await RentMath.MonthlySeriesAsync(_db.RentPayments, ChartMonths)
        };
        await FillPropertyCountsAsync(_db.Properties, dto);

        // Recent activity: newest rent records, complaints and accounts, merged by time
        var rent = await _db.RentPayments.AsNoTracking()
            .OrderByDescending(r => r.CreatedAt).Take(5)
            .Select(r => new ActivityItemDto
            {
                Type = "payment",
                Title = r.Status == RentStatuses.Paid ? "Rent paid" : "Rent record created",
                Description = r.TenantProperty.Tenant.FirstName + " " + r.TenantProperty.Tenant.LastName
                              + " · " + r.TenantProperty.Property.PropertyName,
                OccurredAt = r.CreatedAt,
                Link = "/rent/" + r.PaymentId
            }).ToListAsync();

        var complaints = await _db.Complaints.AsNoTracking()
            .OrderByDescending(c => c.CreatedAt).Take(5)
            .Select(c => new ActivityItemDto
            {
                Type = "complaint",
                Title = "Complaint: " + c.Title,
                Description = c.Property.PropertyName + " · " + c.Status,
                OccurredAt = c.CreatedAt,
                Link = "/complaints/" + c.ComplaintId
            }).ToListAsync();

        var users = await _db.Users.AsNoTracking()
            .OrderByDescending(u => u.CreatedAt).Take(5)
            .Select(u => new ActivityItemDto
            {
                Type = "user",
                Title = "New " + u.Role.RoleName.ToLower() + " account",
                Description = u.FirstName + " " + u.LastName + " · " + u.Email,
                OccurredAt = u.CreatedAt,
                Link = "/users/" + u.UserId
            }).ToListAsync();

        dto.RecentActivity = rent.Concat(complaints).Concat(users)
            .OrderByDescending(a => a.OccurredAt).Take(8).ToList();
        return dto;
    }

    public async Task<LandlordDashboardDto> GetLandlordAsync()
    {
        await _rentStatus.RefreshAsync();

        var rent = _scope.RentPayments().AsNoTracking();
        var dto = new LandlordDashboardDto
        {
            TotalTenants = await _scope.Assignments().CountAsync(tp => tp.Status == AssignmentStatuses.Active),
            OpenComplaints = await _scope.Complaints().CountAsync(c => c.Status != ComplaintStatuses.Resolved),
            Rent = await RentMath.SummarizeAsync(rent),
            MonthlyCollection = await RentMath.MonthlySeriesAsync(rent, ChartMonths),
            RecentRent = await rent.OrderByDescending(r => r.DueDate).ThenByDescending(r => r.PaymentId).Take(5)
                .Select(RentPaymentListItemDto.Projection).ToListAsync(),
            RecentComplaints = await _scope.Complaints().AsNoTracking()
                .OrderBy(c => c.Status == ComplaintStatuses.Resolved).ThenByDescending(c => c.CreatedAt).Take(5)
                .Select(ComplaintListItemDto.Projection).ToListAsync()
        };

        var counts = new AdminDashboardDto();
        await FillPropertyCountsAsync(_scope.Properties(), counts);
        dto.TotalProperties = counts.TotalProperties;
        dto.OccupiedProperties = counts.OccupiedProperties;
        dto.AvailableProperties = counts.AvailableProperties;
        dto.MaintenanceProperties = counts.MaintenanceProperties;
        return dto;
    }

    public async Task<TenantDashboardDto> GetTenantAsync()
    {
        await _rentStatus.RefreshAsync();

        var rent = _scope.RentPayments().AsNoTracking();
        var assignments = _scope.Assignments().AsNoTracking();

        return new TenantDashboardDto
        {
            CurrentLease = await assignments.Where(tp => tp.Status == AssignmentStatuses.Active)
                .Select(AssignmentDto.Projection).FirstOrDefaultAsync(),
            NextDue = await rent.Where(r => r.Status != RentStatuses.Paid)
                .OrderBy(r => r.DueDate).Select(RentPaymentListItemDto.Projection).FirstOrDefaultAsync(),
            LatestRent = await rent.OrderByDescending(r => r.BillingMonth)
                .Select(RentPaymentListItemDto.Projection).FirstOrDefaultAsync(),
            Rent = await RentMath.SummarizeAsync(rent),
            OpenComplaints = await _scope.Complaints().CountAsync(c => c.Status != ComplaintStatuses.Resolved),
            RecentNotifications = await _db.Notifications.AsNoTracking()
                .Where(n => n.UserId == _user.UserId)
                .OrderByDescending(n => n.CreatedAt).Take(5)
                .Select(n => new NotificationDto
                {
                    NotificationId = n.NotificationId,
                    Title = n.Title,
                    Message = n.Message,
                    IsRead = n.IsRead,
                    CreatedAt = n.CreatedAt
                }).ToListAsync(),
            RentalHistory = await assignments.Where(tp => tp.Status == AssignmentStatuses.Completed)
                .OrderByDescending(tp => tp.StartDate).Select(AssignmentDto.Projection).ToListAsync()
        };
    }

    private static async Task FillPropertyCountsAsync(IQueryable<Models.Property> properties, AdminDashboardDto dto)
    {
        var byStatus = await properties.GroupBy(p => p.Status)
            .Select(g => new { Status = g.Key, Count = g.Count() })
            .ToDictionaryAsync(x => x.Status, x => x.Count);

        dto.OccupiedProperties = byStatus.GetValueOrDefault(PropertyStatuses.Occupied);
        dto.AvailableProperties = byStatus.GetValueOrDefault(PropertyStatuses.Available);
        dto.MaintenanceProperties = byStatus.GetValueOrDefault(PropertyStatuses.Maintenance);
        dto.TotalProperties = byStatus.Values.Sum();
    }
}
