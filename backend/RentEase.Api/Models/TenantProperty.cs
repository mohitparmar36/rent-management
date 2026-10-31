namespace RentEase.Api.Models;

/// <summary>A rental assignment (lease) linking a tenant to a property.</summary>
public class TenantProperty
{
    public int TenantPropertyId { get; set; }
    public int TenantId { get; set; }
    public int PropertyId { get; set; }
    public DateOnly StartDate { get; set; }
    public DateOnly? EndDate { get; set; }
    public string Status { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; }

    public User Tenant { get; set; } = null!;
    public Property Property { get; set; } = null!;
    public ICollection<RentPayment> RentPayments { get; set; } = new List<RentPayment>();
}
