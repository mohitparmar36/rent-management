using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using RentEase.Api.Common;
using RentEase.Api.DTOs;
using RentEase.Api.Services;

namespace RentEase.Api.Controllers;

/// <summary>Reports, scoped to the caller: Admin = everything, Landlord = own properties, Tenant = own records.</summary>
[ApiController]
[Route("api/reports")]
[Authorize]
public class ReportsController : ControllerBase
{
    private readonly ReportService _reports;

    public ReportsController(ReportService reports) => _reports = reports;

    /// <param name="months">How many months to include, ending with the current month (1 to 24, default 12).</param>
    [HttpGet("rent-collection")]
    public async Task<ActionResult<RentCollectionReportDto>> RentCollection([FromQuery] int months = 12) =>
        await _reports.GetRentCollectionAsync(months);

    [HttpGet("occupancy")]
    [Authorize(Roles = AppRoles.AdminOrLandlord)]
    public async Task<ActionResult<OccupancyReportDto>> Occupancy() => await _reports.GetOccupancyAsync();

    [HttpGet("complaints")]
    public async Task<ActionResult<ComplaintReportDto>> Complaints() => await _reports.GetComplaintsAsync();
}
