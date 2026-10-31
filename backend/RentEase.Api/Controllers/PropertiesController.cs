using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using RentEase.Api.Common;
using RentEase.Api.DTOs;
using RentEase.Api.Services;

namespace RentEase.Api.Controllers;

/// <summary>Everyone can list/view the properties in their scope; only Admins and Landlords change them.</summary>
[ApiController]
[Route("api/properties")]
[Authorize]
public class PropertiesController : ControllerBase
{
    private readonly PropertyService _properties;

    public PropertiesController(PropertyService properties) => _properties = properties;

    [HttpGet]
    public async Task<ActionResult<PagedResult<PropertyListItemDto>>> GetAll([FromQuery] PropertyQuery query) =>
        await _properties.GetAllAsync(query);

    [HttpGet("{id:int}")]
    public async Task<ActionResult<PropertyDetailsDto>> GetById(int id) => await _properties.GetByIdAsync(id);

    [HttpPost]
    [Authorize(Roles = AppRoles.AdminOrLandlord)]
    public async Task<IActionResult> Create([FromBody] PropertyRequest request)
    {
        var id = await _properties.CreateAsync(request);
        return CreatedAtAction(nameof(GetById), new { id }, new { message = "Property created.", propertyId = id });
    }

    [HttpPut("{id:int}")]
    [Authorize(Roles = AppRoles.AdminOrLandlord)]
    public async Task<IActionResult> Update(int id, [FromBody] PropertyRequest request)
    {
        await _properties.UpdateAsync(id, request);
        return Ok(new { message = "Property updated." });
    }

    [HttpDelete("{id:int}")]
    [Authorize(Roles = AppRoles.AdminOrLandlord)]
    public async Task<IActionResult> Delete(int id)
    {
        await _properties.DeleteAsync(id);
        return Ok(new { message = "Property deleted." });
    }
}
