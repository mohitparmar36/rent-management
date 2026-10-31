using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using RentEase.Api.Common;
using RentEase.Api.DTOs;
using RentEase.Api.Services;

namespace RentEase.Api.Controllers;

[ApiController]
[Route("api/complaints")]
[Authorize]
public class ComplaintsController : ControllerBase
{
    private readonly ComplaintService _complaints;

    public ComplaintsController(ComplaintService complaints) => _complaints = complaints;

    [HttpGet]
    public async Task<ActionResult<PagedResult<ComplaintListItemDto>>> GetAll([FromQuery] ComplaintQuery query) =>
        await _complaints.GetAllAsync(query);

    [HttpGet("{id:int}")]
    public async Task<ActionResult<ComplaintDetailsDto>> GetById(int id) => await _complaints.GetByIdAsync(id);

    [HttpPost]
    [Authorize(Roles = AppRoles.Tenant)]
    public async Task<IActionResult> Create([FromBody] CreateComplaintRequest request)
    {
        var id = await _complaints.CreateAsync(request);
        return CreatedAtAction(nameof(GetById), new { id }, new { message = "Complaint submitted.", complaintId = id });
    }

    [HttpPatch("{id:int}/status")]
    [Authorize(Roles = AppRoles.AdminOrLandlord)]
    public async Task<IActionResult> UpdateStatus(int id, [FromBody] UpdateComplaintStatusRequest request)
    {
        await _complaints.UpdateStatusAsync(id, request.Status);
        return Ok(new { message = "Complaint status updated." });
    }
}

[ApiController]
[Route("api/complaintcategories")]
[Authorize]
public class ComplaintCategoriesController : ControllerBase
{
    private readonly ComplaintService _complaints;

    public ComplaintCategoriesController(ComplaintService complaints) => _complaints = complaints;

    [HttpGet]
    public async Task<ActionResult<List<ComplaintCategoryDto>>> GetAll() => await _complaints.GetCategoriesAsync();
}
