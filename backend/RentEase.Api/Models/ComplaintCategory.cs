namespace RentEase.Api.Models;

public class ComplaintCategory
{
    public int CategoryId { get; set; }
    public string CategoryName { get; set; } = string.Empty;
    public bool IsActive { get; set; }

    public ICollection<Complaint> Complaints { get; set; } = new List<Complaint>();
}
