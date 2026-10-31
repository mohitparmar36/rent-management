using System.ComponentModel.DataAnnotations;
using System.Linq.Expressions;
using RentEase.Api.Common;
using RentEase.Api.Models;

namespace RentEase.Api.DTOs;

public class ComplaintQuery : PageQuery
{
    public string? Status { get; set; }
    public string? Priority { get; set; }
    public int? CategoryId { get; set; }
    public int? PropertyId { get; set; }
}

public class ComplaintListItemDto
{
    public int ComplaintId { get; set; }
    public string Title { get; set; } = string.Empty;
    public string Status { get; set; } = string.Empty;
    public string Priority { get; set; } = string.Empty;
    public int CategoryId { get; set; }
    public string CategoryName { get; set; } = string.Empty;
    public int PropertyId { get; set; }
    public string PropertyName { get; set; } = string.Empty;
    public int TenantId { get; set; }
    public string TenantName { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
    public DateTime? ResolvedAt { get; set; }

    public static readonly Expression<Func<Complaint, ComplaintListItemDto>> Projection = c => new ComplaintListItemDto
    {
        ComplaintId = c.ComplaintId,
        Title = c.Title,
        Status = c.Status,
        Priority = c.Priority,
        CategoryId = c.CategoryId,
        CategoryName = c.Category.CategoryName,
        PropertyId = c.PropertyId,
        PropertyName = c.Property.PropertyName,
        TenantId = c.TenantId,
        TenantName = c.Tenant.FirstName + " " + c.Tenant.LastName,
        CreatedAt = c.CreatedAt,
        UpdatedAt = c.UpdatedAt,
        ResolvedAt = c.ResolvedAt
    };
}

public class ComplaintDetailsDto : ComplaintListItemDto
{
    public string Description { get; set; } = string.Empty;
    public string PropertyAddress { get; set; } = string.Empty;
    public string TenantEmail { get; set; } = string.Empty;
    public string? TenantPhone { get; set; }
    public string LandlordName { get; set; } = string.Empty;
}

public class CreateComplaintRequest
{
    [Required(ErrorMessage = "Select a property.")]
    public int? PropertyId { get; set; }

    [Required(ErrorMessage = "Select a category.")]
    public int? CategoryId { get; set; }

    [Required(ErrorMessage = "Title is required.")]
    [StringLength(150, MinimumLength = 5, ErrorMessage = "Title must be between 5 and 150 characters.")]
    public string Title { get; set; } = string.Empty;

    [Required(ErrorMessage = "Description is required.")]
    [StringLength(1000, MinimumLength = 10, ErrorMessage = "Description must be between 10 and 1000 characters.")]
    public string Description { get; set; } = string.Empty;

    [Required(ErrorMessage = "Priority is required.")]
    public string Priority { get; set; } = string.Empty;
}

public class UpdateComplaintStatusRequest
{
    [Required(ErrorMessage = "Status is required.")]
    public string Status { get; set; } = string.Empty;
}

public class ComplaintCategoryDto
{
    public int CategoryId { get; set; }
    public string CategoryName { get; set; } = string.Empty;
}
