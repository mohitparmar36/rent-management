using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using RentEase.Api.Common;
using RentEase.Api.DTOs;
using RentEase.Api.Services;

namespace RentEase.Api.Controllers;

[ApiController]
[Route("api/users")]
[Authorize(Roles = AppRoles.Admin)]
public class UsersController : ControllerBase
{
    private readonly UserService _users;

    public UsersController(UserService users) => _users = users;

    [HttpGet]
    public async Task<ActionResult<PagedResult<UserListItemDto>>> GetAll([FromQuery] UserQuery query) =>
        await _users.GetAllAsync(query);

    [HttpGet("{id:int}")]
    public async Task<ActionResult<UserDetailsDto>> GetById(int id) => await _users.GetByIdAsync(id);

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateUserRequest request)
    {
        var id = await _users.CreateAsync(request);
        return CreatedAtAction(nameof(GetById), new { id }, new { message = "User created.", userId = id });
    }

    [HttpPut("{id:int}")]
    public async Task<IActionResult> Update(int id, [FromBody] UpdateUserRequest request)
    {
        await _users.UpdateAsync(id, request);
        return Ok(new { message = "User updated." });
    }

    [HttpPatch("{id:int}/status")]
    public async Task<IActionResult> UpdateStatus(int id, [FromBody] UpdateUserStatusRequest request)
    {
        await _users.SetStatusAsync(id, request.IsActive!.Value);
        return Ok(new { message = request.IsActive.Value ? "Account activated." : "Account deactivated." });
    }
}
