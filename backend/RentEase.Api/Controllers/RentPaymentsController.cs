using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using RentEase.Api.Common;
using RentEase.Api.DTOs;
using RentEase.Api.Services;

namespace RentEase.Api.Controllers;

/// <summary>Rent records. Tenants can view their own; only Admins and Landlords create them or record payments.</summary>
[ApiController]
[Route("api/rentpayments")]
[Authorize]
public class RentPaymentsController : ControllerBase
{
    private readonly RentPaymentService _rent;

    public RentPaymentsController(RentPaymentService rent) => _rent = rent;

    [HttpGet]
    public async Task<ActionResult<PagedResult<RentPaymentListItemDto>>> GetAll([FromQuery] RentQuery query) =>
        await _rent.GetAllAsync(query);

    /// <summary>Collected / pending / overdue totals for the same filters as the list.</summary>
    [HttpGet("summary")]
    public async Task<ActionResult<RentSummaryDto>> GetSummary([FromQuery] RentQuery query) =>
        await _rent.GetSummaryAsync(query);

    [HttpGet("{id:int}")]
    public async Task<ActionResult<RentPaymentDetailsDto>> GetById(int id) => await _rent.GetByIdAsync(id);

    [HttpPost]
    [Authorize(Roles = AppRoles.AdminOrLandlord)]
    public async Task<IActionResult> Create([FromBody] CreateRentPaymentRequest request)
    {
        var id = await _rent.CreateAsync(request);
        return CreatedAtAction(nameof(GetById), new { id }, new { message = "Rent record created.", paymentId = id });
    }

    [HttpPost("{id:int}/mark-paid")]
    [Authorize(Roles = AppRoles.AdminOrLandlord)]
    public async Task<IActionResult> MarkPaid(int id, [FromBody] MarkPaidRequest request)
    {
        await _rent.MarkPaidAsync(id, request);
        return Ok(new { message = "Payment recorded." });
    }
}
