using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using RentEase.Api.Common;
using RentEase.Api.DTOs;
using RentEase.Api.Services;

namespace RentEase.Api.Controllers;

[ApiController]
[Route("api/dashboard")]
[Authorize]
public class DashboardController : ControllerBase
{
    private readonly DashboardService _dashboard;

    public DashboardController(DashboardService dashboard) => _dashboard = dashboard;

    [HttpGet("admin")]
    [Authorize(Roles = AppRoles.Admin)]
    public async Task<ActionResult<AdminDashboardDto>> Admin() => await _dashboard.GetAdminAsync();

    [HttpGet("landlord")]
    [Authorize(Roles = AppRoles.Landlord)]
    public async Task<ActionResult<LandlordDashboardDto>> Landlord() => await _dashboard.GetLandlordAsync();

    [HttpGet("tenant")]
    [Authorize(Roles = AppRoles.Tenant)]
    public async Task<ActionResult<TenantDashboardDto>> Tenant() => await _dashboard.GetTenantAsync();
}
