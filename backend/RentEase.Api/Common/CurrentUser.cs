using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;

namespace RentEase.Api.Common;

/// <summary>
/// The signed-in user, read from the validated JWT. Services use this — never a
/// user id sent by the frontend — to decide what the caller may see or change.
/// </summary>
public class CurrentUser
{
    public int UserId { get; }
    public string Role { get; }

    public CurrentUser(IHttpContextAccessor httpContextAccessor)
    {
        var principal = httpContextAccessor.HttpContext?.User;

        var idClaim = principal?.FindFirstValue(ClaimTypes.NameIdentifier)
                      ?? principal?.FindFirstValue(JwtRegisteredClaimNames.Sub);
        UserId = int.TryParse(idClaim, out var id) ? id : 0;
        Role = principal?.FindFirstValue(ClaimTypes.Role) ?? string.Empty;
    }

    public bool IsAdmin => Role == AppRoles.Admin;
    public bool IsLandlord => Role == AppRoles.Landlord;
    public bool IsTenant => Role == AppRoles.Tenant;
}
