namespace RentEase.Api.Models;

public class Complaint
{
    public int ComplaintId { get; set; }
    public int TenantId { get; set; }
    public int PropertyId { get; set; }
    public int CategoryId { get; set; }
    public string Title { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public string Status { get; set; } = string.Empty;
    public string Priority { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
    public DateTime? ResolvedAt { get; set; }

    public User Tenant { get; set; } = null!;
    public Property Property { get; set; } = null!;
    public ComplaintCategory Category { get; set; } = null!;
}
