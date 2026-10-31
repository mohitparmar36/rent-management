namespace RentEase.Api.Models;

public class User
{
    public int UserId { get; set; }
    public int RoleId { get; set; }
    public string FirstName { get; set; } = string.Empty;
    public string LastName { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string PasswordHash { get; set; } = string.Empty;
    public string? PhoneNumber { get; set; }
    public bool IsActive { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
    public DateTime? LastLoginAt { get; set; }

    public Role Role { get; set; } = null!;

    // Landlord: properties they own. Tenant: their rental assignments and complaints.
    public ICollection<Property> OwnedProperties { get; set; } = new List<Property>();
    public ICollection<TenantProperty> TenantProperties { get; set; } = new List<TenantProperty>();
    public ICollection<Complaint> Complaints { get; set; } = new List<Complaint>();
    public ICollection<Notification> Notifications { get; set; } = new List<Notification>();
}
