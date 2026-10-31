namespace RentEase.Api.Models;

public class Property
{
    public int PropertyId { get; set; }
    public int LandlordId { get; set; }
    public string PropertyName { get; set; } = string.Empty;
    public string PropertyType { get; set; } = string.Empty;
    public string Address { get; set; } = string.Empty;
    public string City { get; set; } = string.Empty;
    public string State { get; set; } = string.Empty;
    public string? PostalCode { get; set; }
    public decimal MonthlyRent { get; set; }
    public string Status { get; set; } = string.Empty;
    public string? Description { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }

    public User Landlord { get; set; } = null!;
    public ICollection<TenantProperty> TenantProperties { get; set; } = new List<TenantProperty>();
    public ICollection<Complaint> Complaints { get; set; } = new List<Complaint>();
}
