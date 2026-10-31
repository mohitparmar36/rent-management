using System.ComponentModel.DataAnnotations;
using System.Linq.Expressions;
using RentEase.Api.Common;
using RentEase.Api.Models;

namespace RentEase.Api.DTOs;

public class AssignmentQuery : PageQuery
{
    public string? Status { get; set; }
    public int? PropertyId { get; set; }
    public int? TenantId { get; set; }
}

public class AssignmentDto
{
    public int TenantPropertyId { get; set; }
    public int TenantId { get; set; }
    public string TenantName { get; set; } = string.Empty;
    public string TenantEmail { get; set; } = string.Empty;
    public string? TenantPhone { get; set; }
    public int PropertyId { get; set; }
    public string PropertyName { get; set; } = string.Empty;
    public string PropertyAddress { get; set; } = string.Empty;
    public decimal MonthlyRent { get; set; }
    public string LandlordName { get; set; } = string.Empty;
    public string LandlordEmail { get; set; } = string.Empty;
    public string? LandlordPhone { get; set; }
    public DateOnly StartDate { get; set; }
    public DateOnly? EndDate { get; set; }
    public string Status { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; }

    public static readonly Expression<Func<TenantProperty, AssignmentDto>> Projection = tp => new AssignmentDto
    {
        TenantPropertyId = tp.TenantPropertyId,
        TenantId = tp.TenantId,
        TenantName = tp.Tenant.FirstName + " " + tp.Tenant.LastName,
        TenantEmail = tp.Tenant.Email,
        TenantPhone = tp.Tenant.PhoneNumber,
        PropertyId = tp.PropertyId,
        PropertyName = tp.Property.PropertyName,
        PropertyAddress = tp.Property.Address + ", " + tp.Property.City + ", " + tp.Property.State,
        MonthlyRent = tp.Property.MonthlyRent,
        LandlordName = tp.Property.Landlord.FirstName + " " + tp.Property.Landlord.LastName,
        LandlordEmail = tp.Property.Landlord.Email,
        LandlordPhone = tp.Property.Landlord.PhoneNumber,
        StartDate = tp.StartDate,
        EndDate = tp.EndDate,
        Status = tp.Status,
        CreatedAt = tp.CreatedAt
    };
}

public class AssignmentDetailsDto : AssignmentDto
{
    public List<RentPaymentListItemDto> RentRecords { get; set; } = new();
    public RentSummaryDto RentSummary { get; set; } = new();
}

public class CreateAssignmentRequest
{
    [Required(ErrorMessage = "Select a tenant.")]
    public int? TenantId { get; set; }

    [Required(ErrorMessage = "Select a property.")]
    public int? PropertyId { get; set; }

    [Required(ErrorMessage = "Start date is required.")]
    public DateOnly? StartDate { get; set; }

    public DateOnly? EndDate { get; set; }
}

public class CompleteAssignmentRequest
{
    [Required(ErrorMessage = "End date is required.")]
    public DateOnly? EndDate { get; set; }
}
