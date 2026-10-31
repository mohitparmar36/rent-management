using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using RentEase.Api.Common;
using RentEase.Api.DTOs;
using RentEase.Api.Services;

namespace RentEase.Api.Controllers;

[ApiController]
[Route("api/tenants")]
[Authorize(Roles = AppRoles.AdminOrLandlord)]
public class TenantsController : ControllerBase
{
    private readonly TenantService _tenants;

    public TenantsController(TenantService tenants) => _tenants = tenants;

    [HttpGet]
    public async Task<ActionResult<PagedResult<TenantListItemDto>>> GetAll([FromQuery] TenantQuery query) =>
        await _tenants.GetAllAsync(query);

    /// <summary>Active tenants without a current rental, for the "assign tenant" picker.</summary>
    [HttpGet("available")]
    public async Task<ActionResult<List<TenantOptionDto>>> GetAvailable([FromQuery] string? search) =>
        await _tenants.GetAvailableAsync(search);

    [HttpGet("{id:int}")]
    public async Task<ActionResult<TenantDetailsDto>> GetById(int id) => await _tenants.GetByIdAsync(id);

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateTenantRequest request)
    {
        var (userId, assignmentId) = await _tenants.CreateAsync(request);
        return CreatedAtAction(nameof(GetById), new { id = userId },
            new { message = "Tenant account created.", userId, assignmentId });
    }
}
