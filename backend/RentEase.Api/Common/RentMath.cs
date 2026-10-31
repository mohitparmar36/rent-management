using System.Globalization;
using Microsoft.EntityFrameworkCore;
using RentEase.Api.DTOs;
using RentEase.Api.Models;

namespace RentEase.Api.Common;

/// <summary>Rent totals and monthly series, calculated by SQL Server (not in memory).</summary>
public static class RentMath
{
    public static async Task<RentSummaryDto> SummarizeAsync(IQueryable<RentPayment> payments)
    {
        var summary = await payments
            .GroupBy(_ => 1)
            .Select(g => new RentSummaryDto
            {
                TotalCollected = g.Sum(r => r.Status == RentStatuses.Paid ? r.Amount : 0),
                PendingAmount = g.Sum(r => r.Status == RentStatuses.Pending ? r.Amount : 0),
                OverdueAmount = g.Sum(r => r.Status == RentStatuses.Overdue ? r.Amount : 0),
                PaidCount = g.Count(r => r.Status == RentStatuses.Paid),
                PendingCount = g.Count(r => r.Status == RentStatuses.Pending),
                OverdueCount = g.Count(r => r.Status == RentStatuses.Overdue)
            })
            .FirstOrDefaultAsync();

        return summary ?? new RentSummaryDto();
    }

    /// <summary>
    /// Billed / collected / outstanding per billing month for the last <paramref name="months"/>
    /// months up to the current month. Months with no records are included as zeros so
    /// charts have no gaps.
    /// </summary>
    public static async Task<List<MonthlyRentPoint>> MonthlySeriesAsync(IQueryable<RentPayment> payments, int months)
    {
        var thisMonth = FirstOfMonth(Today());
        var from = thisMonth.AddMonths(-(months - 1));

        var rows = await payments
            .Where(r => r.BillingMonth >= from && r.BillingMonth <= thisMonth)
            .GroupBy(r => r.BillingMonth)
            .Select(g => new MonthlyRentPoint
            {
                Month = g.Key,
                Billed = g.Sum(r => r.Amount),
                Collected = g.Sum(r => r.Status == RentStatuses.Paid ? r.Amount : 0),
                Outstanding = g.Sum(r => r.Status != RentStatuses.Paid ? r.Amount : 0)
            })
            .ToListAsync();

        var byMonth = rows.ToDictionary(r => r.Month);
        return Enumerable.Range(0, months)
            .Select(i => from.AddMonths(i))
            .Select(m => byMonth.TryGetValue(m, out var point) ? point : new MonthlyRentPoint { Month = m })
            .ToList();
    }

    public static DateOnly Today() => DateOnly.FromDateTime(DateTime.UtcNow);

    public static DateOnly FirstOfMonth(DateOnly date) => new(date.Year, date.Month, 1);
}

/// <summary>Text formatting used in notification messages.</summary>
public static class Format
{
    private static readonly CultureInfo Culture = CultureInfo.GetCultureInfo("en-US");

    public static string Money(decimal amount) => amount.ToString("C2", Culture);
    public static string Date(DateOnly date) => date.ToString("MMM d, yyyy", Culture);
    public static string Month(DateOnly month) => month.ToString("MMMM yyyy", Culture);
}
