namespace RentEase.Api.DTOs;

/// <summary>Rent totals for one billing month (Month is the 1st of the month).</summary>
public class MonthlyRentPoint
{
    public DateOnly Month { get; set; }
    public decimal Billed { get; set; }
    public decimal Collected { get; set; }
    public decimal Outstanding { get; set; }
}

public class ActivityItemDto
{
    public string Type { get; set; } = string.Empty; // payment | complaint | user
    public string Title { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public DateTime OccurredAt { get; set; }
    public string? Link { get; set; }
}

public class AdminDashboardDto
{
    public int TotalUsers { get; set; }
    public int TotalLandlords { get; set; }
    public int TotalTenants { get; set; }
    public int TotalProperties { get; set; }
    public int OccupiedProperties { get; set; }
    public int AvailableProperties { get; set; }
    public int MaintenanceProperties { get; set; }
    public RentSummaryDto Rent { get; set; } = new();
    public int OpenComplaints { get; set; }
    public List<MonthlyRentPoint> MonthlyCollection { get; set; } = new();
    public List<ActivityItemDto> RecentActivity { get; set; } = new();
}

public class LandlordDashboardDto
{
    public int TotalProperties { get; set; }
    public int OccupiedProperties { get; set; }
    public int AvailableProperties { get; set; }
    public int MaintenanceProperties { get; set; }
    public int TotalTenants { get; set; }
    public RentSummaryDto Rent { get; set; } = new();
    public int OpenComplaints { get; set; }
    public List<MonthlyRentPoint> MonthlyCollection { get; set; } = new();
    public List<RentPaymentListItemDto> RecentRent { get; set; } = new();
    public List<ComplaintListItemDto> RecentComplaints { get; set; } = new();
}

public class TenantDashboardDto
{
    public AssignmentDto? CurrentLease { get; set; }
    public RentPaymentListItemDto? NextDue { get; set; }
    public RentPaymentListItemDto? LatestRent { get; set; }
    public RentSummaryDto Rent { get; set; } = new();
    public int OpenComplaints { get; set; }
    public List<NotificationDto> RecentNotifications { get; set; } = new();
    public List<AssignmentDto> RentalHistory { get; set; } = new();
}
