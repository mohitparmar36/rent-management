using System.ComponentModel.DataAnnotations;
using RentEase.Api.Common;

namespace RentEase.Api.DTOs;

public class TenantQuery : PageQuery
{
    /// <summary>"Housed" = has an active assignment, "Unassigned" = has none.</summary>
    public string? Status { get; set; }
}

public class TenantListItemDto
{
    public int UserId { get; set; }
    public string FirstName { get; set; } = string.Empty;
    public string LastName { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string? PhoneNumber { get; set; }
    public bool IsActive { get; set; }
    public int? CurrentAssignmentId { get; set; }
    public int? CurrentPropertyId { get; set; }
    public string? CurrentPropertyName { get; set; }
    public DateOnly? CurrentStartDate { get; set; }
    public int AssignmentCount { get; set; }
}

/// <summary>Minimal info for the "assign existing tenant" picker.</summary>
public class TenantOptionDto
{
    public int UserId { get; set; }
    public string FullName { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
}

public class TenantDetailsDto
{
    public int UserId { get; set; }
    public string FirstName { get; set; } = string.Empty;
    public string LastName { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string? PhoneNumber { get; set; }
    public bool IsActive { get; set; }
    public DateTime CreatedAt { get; set; }
    public List<AssignmentDto> Assignments { get; set; } = new();
    public RentSummaryDto RentSummary { get; set; } = new();
}

/// <summary>Creates a tenant account and, optionally, assigns it to a property in one step.</summary>
public class CreateTenantRequest
{
    [Required(ErrorMessage = "First name is required.")]
    [StringLength(50)]
    public string FirstName { get; set; } = string.Empty;

    [Required(ErrorMessage = "Last name is required.")]
    [StringLength(50)]
    public string LastName { get; set; } = string.Empty;

    [Required(ErrorMessage = "Email is required.")]
    [EmailAddress(ErrorMessage = "Enter a valid email address.")]
    [StringLength(150)]
    public string Email { get; set; } = string.Empty;

    [RegularExpression(ValidationPatterns.Phone, ErrorMessage = ValidationPatterns.PhoneMessage)]
    public string? PhoneNumber { get; set; }

    [Required(ErrorMessage = "A temporary password is required.")]
    [RegularExpression(PasswordRules.Pattern, ErrorMessage = PasswordRules.Message)]
    public string Password { get; set; } = string.Empty;

    public int? PropertyId { get; set; }
    public DateOnly? StartDate { get; set; }
    public DateOnly? EndDate { get; set; }
}
