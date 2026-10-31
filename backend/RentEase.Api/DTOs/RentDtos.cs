using System.ComponentModel.DataAnnotations;
using System.Linq.Expressions;
using RentEase.Api.Common;
using RentEase.Api.Models;

namespace RentEase.Api.DTOs;

public class RentQuery : PageQuery
{
    public string? Status { get; set; }
    public int? PropertyId { get; set; }
    public int? TenantId { get; set; }

    /// <summary>Format yyyy-MM, e.g. 2026-09.</summary>
    public string? BillingMonth { get; set; }
}

public class RentPaymentListItemDto
{
    public int PaymentId { get; set; }
    public int TenantPropertyId { get; set; }
    public DateOnly BillingMonth { get; set; }
    public decimal Amount { get; set; }
    public DateOnly DueDate { get; set; }
    public DateOnly? PaymentDate { get; set; }
    public string Status { get; set; } = string.Empty;
    public string? PaymentMethod { get; set; }
    public int PropertyId { get; set; }
    public string PropertyName { get; set; } = string.Empty;
    public int TenantId { get; set; }
    public string TenantName { get; set; } = string.Empty;

    public static readonly Expression<Func<RentPayment, RentPaymentListItemDto>> Projection = rp => new RentPaymentListItemDto
    {
        PaymentId = rp.PaymentId,
        TenantPropertyId = rp.TenantPropertyId,
        BillingMonth = rp.BillingMonth,
        Amount = rp.Amount,
        DueDate = rp.DueDate,
        PaymentDate = rp.PaymentDate,
        Status = rp.Status,
        PaymentMethod = rp.PaymentMethod,
        PropertyId = rp.TenantProperty.PropertyId,
        PropertyName = rp.TenantProperty.Property.PropertyName,
        TenantId = rp.TenantProperty.TenantId,
        TenantName = rp.TenantProperty.Tenant.FirstName + " " + rp.TenantProperty.Tenant.LastName
    };
}

public class RentPaymentDetailsDto : RentPaymentListItemDto
{
    public string? Notes { get; set; }
    public DateTime CreatedAt { get; set; }
    public string PropertyAddress { get; set; } = string.Empty;
    public string TenantEmail { get; set; } = string.Empty;
    public string? TenantPhone { get; set; }
    public string LandlordName { get; set; } = string.Empty;
    public string AssignmentStatus { get; set; } = string.Empty;
}

public class RentSummaryDto
{
    public decimal TotalCollected { get; set; }
    public decimal PendingAmount { get; set; }
    public decimal OverdueAmount { get; set; }
    public int PaidCount { get; set; }
    public int PendingCount { get; set; }
    public int OverdueCount { get; set; }
}

public class CreateRentPaymentRequest
{
    [Required(ErrorMessage = "Select a rental assignment.")]
    public int? TenantPropertyId { get; set; }

    [Required(ErrorMessage = "Billing month is required.")]
    [RegularExpression(@"^\d{4}-(0[1-9]|1[0-2])$", ErrorMessage = "Billing month must look like 2026-09.")]
    public string BillingMonth { get; set; } = string.Empty;

    [Required(ErrorMessage = "Amount is required.")]
    [Range(1, 10_000_000, ErrorMessage = "Amount must be between 1 and 10,000,000.")]
    public decimal? Amount { get; set; }

    [Required(ErrorMessage = "Due date is required.")]
    public DateOnly? DueDate { get; set; }

    [StringLength(250, ErrorMessage = "Notes must be 250 characters or fewer.")]
    public string? Notes { get; set; }
}

public class MarkPaidRequest
{
    [Required(ErrorMessage = "Payment date is required.")]
    public DateOnly? PaymentDate { get; set; }

    [Required(ErrorMessage = "Payment method is required.")]
    public string PaymentMethod { get; set; } = string.Empty;

    [StringLength(250, ErrorMessage = "Notes must be 250 characters or fewer.")]
    public string? Notes { get; set; }
}
