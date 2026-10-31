using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using RentEase.Api.DTOs;
using RentEase.Api.Services;

namespace RentEase.Api.Controllers;

/// <summary>The signed-in user's own profile (every role).</summary>
[ApiController]
[Route("api/profile")]
[Authorize]
public class ProfileController : ControllerBase
{
    private readonly ProfileService _profile;

    public ProfileController(ProfileService profile) => _profile = profile;

    [HttpGet]
    public async Task<ActionResult<ProfileDto>> Get() => await _profile.GetAsync();

    [HttpPut]
    public async Task<ActionResult<ProfileDto>> Update([FromBody] UpdateProfileRequest request) =>
        await _profile.UpdateAsync(request);

    [HttpPost("change-password")]
    public async Task<IActionResult> ChangePassword([FromBody] ChangePasswordRequest request)
    {
        await _profile.ChangePasswordAsync(request);
        return Ok(new { message = "Password changed successfully." });
    }
}
