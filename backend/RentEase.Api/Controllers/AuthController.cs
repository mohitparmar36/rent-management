using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using RentEase.Api.DTOs;
using RentEase.Api.Services;

namespace RentEase.Api.Controllers;

[ApiController]
[Route("api/auth")]
public class AuthController : ControllerBase
{
    private readonly IAuthService _authService;
    private readonly ProfileService _profile;

    public AuthController(IAuthService authService, ProfileService profile)
    {
        _authService = authService;
        _profile = profile;
    }

    /// <summary>Signs in with email and password and returns a JWT.</summary>
    [HttpPost("login")]
    [AllowAnonymous]
    [EnableRateLimiting("login")]
    public async Task<IActionResult> Login([FromBody] LoginRequest request)
    {
        var result = await _authService.LoginAsync(request);

        if (!result.Success)
        {
            return Unauthorized(new { message = result.ErrorMessage });
        }

        return Ok(result.Data);
    }

    /// <summary>The signed-in user (used by the frontend to restore a session).</summary>
    [HttpGet("me")]
    [Authorize]
    public async Task<ActionResult<UserDto>> Me() => await _profile.GetSessionUserAsync();

    /// <summary>Same as POST /api/profile/change-password.</summary>
    [HttpPost("change-password")]
    [Authorize]
    public async Task<IActionResult> ChangePassword([FromBody] ChangePasswordRequest request)
    {
        await _profile.ChangePasswordAsync(request);
        return Ok(new { message = "Password changed successfully." });
    }
}
