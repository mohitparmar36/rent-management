using System.ComponentModel.DataAnnotations;
using RentEase.Api.Common;

namespace RentEase.Api.DTOs;

public class PropertyQuery : PageQuery
{
    public string? Type { get; set; }
    public string? Status { get; set; }
    public int? LandlordId { get; set; }
}

public class PropertyListItemDto
{
    public int PropertyId { get; set; }
    public string PropertyName { get; set; } = string.Empty;
    public string PropertyType { get; set; } = string.Empty;
    public string Address { get; set; } = string.Empty;
    public string City { get; set; } = string.Empty;
    public string State { get; set; } = string.Empty;
    public string? PostalCode { get; set; }
    public decimal MonthlyRent { get; set; }
    public string Status { get; set; } = string.Empty;
    public int LandlordId { get; set; }
    public string LandlordName { get; set; } = string.Empty;
    public string? CurrentTenantName { get; set; }
    public DateTime CreatedAt { get; set; }
}

public class PropertyDetailsDto : PropertyListItemDto
{
    public string? Description { get; set; }
    public DateTime UpdatedAt { get; set; }
    public string LandlordEmail { get; set; } = string.Empty;
    public string? LandlordPhone { get; set; }
    public AssignmentDto? CurrentAssignment { get; set; }
    public List<AssignmentDto> AssignmentHistory { get; set; } = new();
    public List<RentPaymentListItemDto> RecentRent { get; set; } = new();
    public RentSummaryDto RentSummary { get; set; } = new();
    public int OpenComplaints { get; set; }

    /// <summary>False once the property has any rental or complaint history.</summary>
    public bool CanDelete { get; set; }
}

public class PropertyRequest
{
    [Required(ErrorMessage = "Property name is required.")]
    [StringLength(150, ErrorMessage = "Property name must be 150 characters or fewer.")]
    public string PropertyName { get; set; } = string.Empty;

    [Required(ErrorMessage = "Property type is required.")]
    public string PropertyType { get; set; } = string.Empty;

    [Required(ErrorMessage = "Address is required.")]
    [StringLength(250)]
    public string Address { get; set; } = string.Empty;

    [Required(ErrorMessage = "City is required.")]
    [StringLength(100)]
    public string City { get; set; } = string.Empty;

    [Required(ErrorMessage = "State is required.")]
    [StringLength(100)]
    public string State { get; set; } = string.Empty;

    [RegularExpression(@"^[A-Za-z0-9\- ]{3,10}$", ErrorMessage = "Enter a valid postal code (3 to 10 letters or digits).")]
    public string? PostalCode { get; set; }

    [Required(ErrorMessage = "Monthly rent is required.")]
    [Range(1, 10_000_000, ErrorMessage = "Monthly rent must be between 1 and 10,000,000.")]
    public decimal? MonthlyRent { get; set; }

    [Required(ErrorMessage = "Status is required.")]
    public string Status { get; set; } = string.Empty;

    [StringLength(500, ErrorMessage = "Description must be 500 characters or fewer.")]
    public string? Description { get; set; }

    /// <summary>Admins only: the landlord who owns the property. Ignored for landlords.</summary>
    public int? LandlordId { get; set; }
}
