using Microsoft.EntityFrameworkCore;
using RentEase.Api.Common;
using RentEase.Api.DTOs;

namespace RentEase.Api.Services;

/// <summary>Simple reports. Admin: whole system. Landlord: own properties. Tenant: own records.</summary>
public class ReportService
{
    private readonly DataScope _scope;
    private readonly PropertyService _properties;
    private readonly RentStatusRefresher _rentStatus;

    public ReportService(DataScope scope, PropertyService properties, RentStatusRefresher rentStatus)
    {
        _scope = scope;
        _properties = properties;
        _rentStatus = rentStatus;
    }

    public async Task<RentCollectionReportDto> GetRentCollectionAsync(int months)
    {
        await _rentStatus.RefreshAsync();
        months = Math.Clamp(months, 1, 24);

        var rent = _scope.RentPayments().AsNoTracking();
        return new RentCollectionReportDto
        {
            Months = await RentMath.MonthlySeriesAsync(rent, months),
            Totals = await RentMath.SummarizeAsync(rent),
            Outstanding = await rent.Where(r => r.Status != RentStatuses.Paid)
                .OrderBy(r => r.DueDate)
                .Take(100)
                .Select(RentPaymentListItemDto.Projection)
                .ToListAsync()
        };
    }

    public async Task<OccupancyReportDto> GetOccupancyAsync()
    {
        var properties = _scope.Properties().AsNoTracking();

        var byStatus = await properties.GroupBy(p => p.Status)
            .Select(g => new { Status = g.Key, Count = g.Count() })
            .ToDictionaryAsync(x => x.Status, x => x.Count);

        var total = byStatus.Values.Sum();
        var occupied = byStatus.GetValueOrDefault(PropertyStatuses.Occupied);

        return new OccupancyReportDto
        {
            TotalProperties = total,
            Occupied = occupied,
            Available = byStatus.GetValueOrDefault(PropertyStatuses.Available),
            Maintenance = byStatus.GetValueOrDefault(PropertyStatuses.Maintenance),
            OccupancyRate = total == 0 ? 0 : Math.Round(occupied * 100.0 / total, 1),
            Properties = await _properties.ToListItems(properties.OrderBy(p => p.Status).ThenBy(p => p.PropertyName))
                .ToListAsync()
        };
    }

    public async Task<ComplaintReportDto> GetComplaintsAsync()
    {
        var complaints = _scope.Complaints().AsNoTracking();

        async Task<List<CountItemDto>> CountBy(IQueryable<CountItemDto> grouped) =>
            await grouped.OrderByDescending(x => x.Count).ToListAsync();

        var byStatus = await CountBy(complaints.GroupBy(c => c.Status)
            .Select(g => new CountItemDto { Label = g.Key, Count = g.Count() }));
        var byPriority = await CountBy(complaints.GroupBy(c => c.Priority)
            .Select(g => new CountItemDto { Label = g.Key, Count = g.Count() }));
        var byCategory = await CountBy(complaints.GroupBy(c => c.Category.CategoryName)
            .Select(g => new CountItemDto { Label = g.Key, Count = g.Count() }));

        // Every status/priority appears, even with zero, so charts are stable
        static List<CountItemDto> WithAll(IEnumerable<string> labels, List<CountItemDto> counts) =>
            labels.Select(l => new CountItemDto { Label = l, Count = counts.FirstOrDefault(c => c.Label == l)?.Count ?? 0 }).ToList();

        // Resolution time in hours, averaged in SQL, shown in days
        var avgHours = await complaints
            .Where(c => c.ResolvedAt != null)
            .Select(c => (double?)EF.Functions.DateDiffHour(c.CreatedAt, c.ResolvedAt!.Value))
            .AverageAsync();

        return new ComplaintReportDto
        {
            Total = byStatus.Sum(x => x.Count),
            ByStatus = WithAll(ComplaintStatuses.All, byStatus),
            ByPriority = WithAll(new[] { "High", "Medium", "Low" }, byPriority),
            ByCategory = byCategory,
            AverageResolutionDays = avgHours.HasValue ? Math.Round(avgHours.Value / 24, 1) : null
        };
    }
}
