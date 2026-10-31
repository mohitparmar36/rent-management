using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using RentEase.Api.Common;
using RentEase.Api.DTOs;
using RentEase.Api.Services;

namespace RentEase.Api.Controllers;

/// <summary>Rental assignments. Tenants can view their own; Admins and Landlords create and end them.</summary>
[ApiController]
[Route("api/tenantproperties")]
[Authorize]
public class TenantPropertiesController : ControllerBase
{
    private readonly AssignmentService _assignments;

    public TenantPropertiesController(AssignmentService assignments) => _assignments = assignments;

    [HttpGet]
    public async Task<ActionResult<PagedResult<AssignmentDto>>> GetAll([FromQuery] AssignmentQuery query) =>
        await _assignments.GetAllAsync(query);

    [HttpGet("{id:int}")]
    public async Task<ActionResult<AssignmentDetailsDto>> GetById(int id) => await _assignments.GetByIdAsync(id);

    [HttpPost]
    [Authorize(Roles = AppRoles.AdminOrLandlord)]
    public async Task<IActionResult> Create([FromBody] CreateAssignmentRequest request)
    {
        var id = await _assignments.CreateAsync(request);
        return CreatedAtAction(nameof(GetById), new { id }, new { message = "Tenant assigned.", assignmentId = id });
    }

    [HttpPost("{id:int}/complete")]
    [Authorize(Roles = AppRoles.AdminOrLandlord)]
    public async Task<IActionResult> Complete(int id, [FromBody] CompleteAssignmentRequest request)
    {
        await _assignments.CompleteAsync(id, request.EndDate!.Value);
        return Ok(new { message = "Rental ended. The property is available again." });
    }
}
