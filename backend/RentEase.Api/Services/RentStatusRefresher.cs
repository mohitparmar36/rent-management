using Microsoft.EntityFrameworkCore;
using RentEase.Api.Common;
using RentEase.Api.Data;

namespace RentEase.Api.Services;

/// <summary>
/// Keeps the stored rent status in line with the calendar: an unpaid record whose
/// due date has passed becomes Overdue. Paid records are never touched.
///
/// It runs (one cheap UPDATE) before any screen that shows rent figures, so the
/// database, lists, totals and reports always agree — no background job needed.
/// </summary>
public class RentStatusRefresher
{
    private readonly AppDbContext _db;

    public RentStatusRefresher(AppDbContext db) => _db = db;

    public Task<int> RefreshAsync()
    {
        var today = RentMath.Today();
        return _db.RentPayments
            .Where(r => r.Status == RentStatuses.Pending && r.DueDate < today)
            .ExecuteUpdateAsync(s => s.SetProperty(r => r.Status, RentStatuses.Overdue));
    }
}
