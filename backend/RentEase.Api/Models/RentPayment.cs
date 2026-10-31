namespace RentEase.Api.Models;

/// <summary>One month's rent for a rental assignment, and whether it has been paid.</summary>
public class RentPayment
{
    public int PaymentId { get; set; }
    public int TenantPropertyId { get; set; }

    /// <summary>The month being billed, stored as the 1st day of that month.</summary>
    public DateOnly BillingMonth { get; set; }

    public decimal Amount { get; set; }
    public DateOnly DueDate { get; set; }
    public DateOnly? PaymentDate { get; set; }
    public string Status { get; set; } = string.Empty;
    public string? PaymentMethod { get; set; }
    public string? Notes { get; set; }
    public DateTime CreatedAt { get; set; }

    public TenantProperty TenantProperty { get; set; } = null!;
}
