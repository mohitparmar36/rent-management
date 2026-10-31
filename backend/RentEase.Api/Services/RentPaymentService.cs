using System.Globalization;
using Microsoft.EntityFrameworkCore;
using RentEase.Api.Common;
using RentEase.Api.Data;
using RentEase.Api.DTOs;
using RentEase.Api.Models;

namespace RentEase.Api.Services;

/// <summary>
/// Rent records. One record = one month's rent for one rental assignment.
/// This records payments made outside the app (cash, UPI, bank transfer) — it does not move money.
/// </summary>
public class RentPaymentService
{
    private readonly AppDbContext _db;
    private readonly DataScope _scope;
    private readonly NotificationService _notifications;
    private readonly RentStatusRefresher _rentStatus;

    public RentPaymentService(AppDbContext db, DataScope scope, NotificationService notifications,
        RentStatusRefresher rentStatus)
    {
        _db = db;
        _scope = scope;
        _notifications = notifications;
        _rentStatus = rentStatus;
    }

    /// <summary>Sort keys: dueDate (default, newest first), month, amount, status, tenant, property.</summary>
    public async Task<PagedResult<RentPaymentListItemDto>> GetAllAsync(RentQuery q)
    {
        await _rentStatus.RefreshAsync();

        var query = Filter(q);
        if (!string.IsNullOrWhiteSpace(q.Status))
            query = query.Where(r => r.Status == q.Status);

        var desc = q.SortDescending;
        query = q.SortBy?.ToLowerInvariant() switch
        {
            "month" => query.OrderBy(r => r.BillingMonth, desc).ThenBy(r => r.TenantProperty.Property.PropertyName),
            "amount" => query.OrderBy(r => r.Amount, desc),
            "status" => query.OrderBy(r => r.Status, desc).ThenBy(r => r.DueDate),
            "tenant" => query.OrderBy(r => r.TenantProperty.Tenant.FirstName, desc).ThenByDescending(r => r.DueDate),
            "property" => query.OrderBy(r => r.TenantProperty.Property.PropertyName, desc).ThenByDescending(r => r.DueDate),
            "duedate" => query.OrderBy(r => r.DueDate, desc),
            _ => query.OrderByDescending(r => r.DueDate).ThenByDescending(r => r.PaymentId)
        };

        return await query.Select(RentPaymentListItemDto.Projection).ToPagedResultAsync(q);
    }

    /// <summary>Totals for the same filters as the list (status filter excluded, so all buckets show).</summary>
    public async Task<RentSummaryDto> GetSummaryAsync(RentQuery q)
    {
        await _rentStatus.RefreshAsync();
        return await RentMath.SummarizeAsync(Filter(q));
    }

    private IQueryable<RentPayment> Filter(RentQuery q)
    {
        var query = _scope.RentPayments().AsNoTracking();

        if (q.PropertyId.HasValue)
            query = query.Where(r => r.TenantProperty.PropertyId == q.PropertyId.Value);
        if (q.TenantId.HasValue)
            query = query.Where(r => r.TenantProperty.TenantId == q.TenantId.Value);
        if (!string.IsNullOrWhiteSpace(q.BillingMonth))
        {
            var month = ParseMonth(q.BillingMonth);
            query = query.Where(r => r.BillingMonth == month);
        }
        if (!string.IsNullOrWhiteSpace(q.Search))
        {
            var s = q.Search.Trim();
            query = query.Where(r =>
                r.TenantProperty.Property.PropertyName.Contains(s) ||
                (r.TenantProperty.Tenant.FirstName + " " + r.TenantProperty.Tenant.LastName).Contains(s));
        }
        return query;
    }

    public async Task<RentPaymentDetailsDto> GetByIdAsync(int id)
    {
        await _rentStatus.RefreshAsync();

        return await _scope.RentPayments().AsNoTracking()
            .Where(r => r.PaymentId == id)
            .Select(r => new RentPaymentDetailsDto
            {
                PaymentId = r.PaymentId,
                TenantPropertyId = r.TenantPropertyId,
                BillingMonth = r.BillingMonth,
                Amount = r.Amount,
                DueDate = r.DueDate,
                PaymentDate = r.PaymentDate,
                Status = r.Status,
                PaymentMethod = r.PaymentMethod,
                Notes = r.Notes,
                CreatedAt = r.CreatedAt,
                PropertyId = r.TenantProperty.PropertyId,
                PropertyName = r.TenantProperty.Property.PropertyName,
                PropertyAddress = r.TenantProperty.Property.Address + ", " + r.TenantProperty.Property.City,
                TenantId = r.TenantProperty.TenantId,
                TenantName = r.TenantProperty.Tenant.FirstName + " " + r.TenantProperty.Tenant.LastName,
                TenantEmail = r.TenantProperty.Tenant.Email,
                TenantPhone = r.TenantProperty.Tenant.PhoneNumber,
                LandlordName = r.TenantProperty.Property.Landlord.FirstName + " " + r.TenantProperty.Property.Landlord.LastName,
                AssignmentStatus = r.TenantProperty.Status
            })
            .FirstOrDefaultAsync()
            ?? throw ApiException.NotFound("Rent record not found.");
    }

    public async Task<int> CreateAsync(CreateRentPaymentRequest request)
    {
        var assignment = await _scope.Assignments()
            .Include(tp => tp.Property)
            .FirstOrDefaultAsync(tp => tp.TenantPropertyId == request.TenantPropertyId)
            ?? throw ApiException.NotFound("Rental assignment not found.");

        if (assignment.Status != AssignmentStatuses.Active)
            throw ApiException.BadRequest("Rent can only be added to an active rental.");

        var month = ParseMonth(request.BillingMonth);
        var dueDate = request.DueDate!.Value;
        var today = RentMath.Today();

        if (month < RentMath.FirstOfMonth(assignment.StartDate))
            throw ApiException.BadRequest($"This rental started in {Format.Month(assignment.StartDate)}; you cannot bill an earlier month.");
        if (assignment.EndDate.HasValue && month > RentMath.FirstOfMonth(assignment.EndDate.Value))
            throw ApiException.BadRequest($"This rental ends in {Format.Month(assignment.EndDate.Value)}; you cannot bill a later month.");
        if (month > RentMath.FirstOfMonth(today).AddMonths(3))
            throw ApiException.BadRequest("You can bill at most three months ahead.");

        // Rent may be due in advance (previous month) or a little late (following month), nothing further
        if (dueDate < month.AddMonths(-1) || dueDate >= month.AddMonths(2))
            throw ApiException.BadRequest($"The due date must fall between {Format.Date(month.AddMonths(-1))} and {Format.Date(month.AddMonths(2).AddDays(-1))}.");

        if (await _db.RentPayments.AnyAsync(r => r.TenantPropertyId == assignment.TenantPropertyId && r.BillingMonth == month))
            throw ApiException.Conflict($"A rent record for {Format.Month(month)} already exists for this rental.");

        var amount = Math.Round(request.Amount!.Value, 2);
        var payment = new RentPayment
        {
            TenantPropertyId = assignment.TenantPropertyId,
            BillingMonth = month,
            Amount = amount,
            DueDate = dueDate,
            Status = dueDate < today ? RentStatuses.Overdue : RentStatuses.Pending,
            Notes = string.IsNullOrWhiteSpace(request.Notes) ? null : request.Notes.Trim(),
            CreatedAt = DateTime.UtcNow
        };
        _db.RentPayments.Add(payment);

        _notifications.Queue(assignment.TenantId, "New rent due",
            $"Rent of {Format.Money(amount)} for {assignment.Property.PropertyName} ({Format.Month(month)}) is due on {Format.Date(dueDate)}.");

        try
        {
            await _db.SaveChangesAsync(); // rent record + notification in one transaction
        }
        catch (DbUpdateException ex) when (DbErrors.IsUniqueViolation(ex))
        {
            throw ApiException.Conflict($"A rent record for {Format.Month(month)} already exists for this rental.");
        }

        return payment.PaymentId;
    }

    /// <summary>
    /// Records that rent was received. The status change is a single conditional UPDATE
    /// ("only if not already Paid"), so a double click or two open tabs cannot record
    /// the same payment twice.
    /// </summary>
    public async Task MarkPaidAsync(int id, MarkPaidRequest request)
    {
        if (!PaymentMethods.All.Contains(request.PaymentMethod))
            throw ApiException.BadRequest($"Payment method must be one of: {string.Join(", ", PaymentMethods.All)}.");

        var payment = await _scope.RentPayments().AsNoTracking()
            .Where(r => r.PaymentId == id)
            .Select(r => new
            {
                r.Status,
                r.Amount,
                r.BillingMonth,
                r.TenantProperty.TenantId,
                r.TenantProperty.Property.PropertyName
            })
            .FirstOrDefaultAsync()
            ?? throw ApiException.NotFound("Rent record not found.");

        if (payment.Status == RentStatuses.Paid)
            throw ApiException.Conflict("This rent has already been recorded as paid.");

        var paymentDate = request.PaymentDate!.Value;
        if (paymentDate > RentMath.Today())
            throw ApiException.BadRequest("Payment date cannot be in the future.");
        if (paymentDate < payment.BillingMonth.AddMonths(-2))
            throw ApiException.BadRequest("Payment date is too early for this billing month.");

        var notes = string.IsNullOrWhiteSpace(request.Notes) ? null : request.Notes.Trim();

        await using var transaction = await _db.Database.BeginTransactionAsync();

        var updated = await _db.RentPayments
            .Where(r => r.PaymentId == id && r.Status != RentStatuses.Paid)
            .ExecuteUpdateAsync(s => s
                .SetProperty(r => r.Status, RentStatuses.Paid)
                .SetProperty(r => r.PaymentDate, paymentDate)
                .SetProperty(r => r.PaymentMethod, request.PaymentMethod)
                .SetProperty(r => r.Notes, r => notes ?? r.Notes));

        if (updated == 0)
            throw ApiException.Conflict("This rent has already been recorded as paid.");

        _notifications.Queue(payment.TenantId, "Payment received",
            $"Your payment of {Format.Money(payment.Amount)} for {payment.PropertyName} ({Format.Month(payment.BillingMonth)}) was recorded on {Format.Date(paymentDate)} via {request.PaymentMethod}.");
        await _db.SaveChangesAsync();

        await transaction.CommitAsync();
    }

    private static DateOnly ParseMonth(string value) =>
        DateOnly.TryParseExact(value + "-01", "yyyy-MM-dd", CultureInfo.InvariantCulture, DateTimeStyles.None, out var month)
            ? month
            : throw ApiException.BadRequest("Billing month must look like 2026-09.");
}
