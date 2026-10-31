namespace RentEase.Api.DTOs;

public class CountItemDto
{
    public string Label { get; set; } = string.Empty;
    public int Count { get; set; }
}

public class RentCollectionReportDto
{
    public List<MonthlyRentPoint> Months { get; set; } = new();
    public RentSummaryDto Totals { get; set; } = new();

    /// <summary>Unpaid (Pending + Overdue) records, oldest due date first.</summary>
    public List<RentPaymentListItemDto> Outstanding { get; set; } = new();
}

public class OccupancyReportDto
{
    public int TotalProperties { get; set; }
    public int Occupied { get; set; }
    public int Available { get; set; }
    public int Maintenance { get; set; }
    public double OccupancyRate { get; set; }
    public List<PropertyListItemDto> Properties { get; set; } = new();
}

public class ComplaintReportDto
{
    public int Total { get; set; }
    public List<CountItemDto> ByStatus { get; set; } = new();
    public List<CountItemDto> ByPriority { get; set; } = new();
    public List<CountItemDto> ByCategory { get; set; } = new();
    public double? AverageResolutionDays { get; set; }
}
