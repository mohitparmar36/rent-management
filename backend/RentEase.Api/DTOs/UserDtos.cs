using System.ComponentModel.DataAnnotations;
using RentEase.Api.Common;

namespace RentEase.Api.DTOs;

public class UserQuery : PageQuery
{
    public string? Role { get; set; }
    public bool? IsActive { get; set; }
}

public class UserListItemDto
{
    public int UserId { get; set; }
    public string FirstName { get; set; } = string.Empty;
    public string LastName { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string? PhoneNumber { get; set; }
    public string Role { get; set; } = string.Empty;
    public bool IsActive { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime? LastLoginAt { get; set; }
}

public class UserDetailsDto : UserListItemDto
{
    public DateTime UpdatedAt { get; set; }
    public int PropertyCount { get; set; }
    public string? CurrentPropertyName { get; set; }
    public int ComplaintCount { get; set; }
}

public class CreateUserRequest
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

    [Required(ErrorMessage = "Role is required.")]
    public string Role { get; set; } = string.Empty;

    [Required(ErrorMessage = "Password is required.")]
    [RegularExpression(PasswordRules.Pattern, ErrorMessage = PasswordRules.Message)]
    public string Password { get; set; } = string.Empty;
}

/// <summary>Admin edit of basic details. Role is fixed after creation.</summary>
public class UpdateUserRequest
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

    /// <summary>Optional: set to reset the user's password.</summary>
    [RegularExpression(PasswordRules.Pattern, ErrorMessage = PasswordRules.Message)]
    public string? NewPassword { get; set; }
}

public class UpdateUserStatusRequest
{
    [Required(ErrorMessage = "IsActive is required.")]
    public bool? IsActive { get; set; }
}
