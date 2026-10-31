using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using RentEase.Api.DTOs;
using RentEase.Api.Services;

namespace RentEase.Api.Controllers;

/// <summary>The signed-in user's own notifications. There is no way to address another user's.</summary>
[ApiController]
[Route("api/notifications")]
[Authorize]
public class NotificationsController : ControllerBase
{
    private readonly NotificationService _notifications;

    public NotificationsController(NotificationService notifications) => _notifications = notifications;

    [HttpGet]
    public async Task<ActionResult<NotificationPageDto>> GetAll([FromQuery] NotificationQuery query) =>
        await _notifications.GetMineAsync(query);

    [HttpGet("unread-count")]
    public async Task<IActionResult> UnreadCount() => Ok(new { count = await _notifications.GetUnreadCountAsync() });

    [HttpPatch("{id:int}/read")]
    public async Task<IActionResult> MarkRead(int id)
    {
        await _notifications.MarkReadAsync(id);
        return Ok(new { message = "Marked as read." });
    }

    [HttpPatch("read-all")]
    public async Task<IActionResult> MarkAllRead()
    {
        var count = await _notifications.MarkAllReadAsync();
        return Ok(new { message = "All notifications marked as read.", count });
    }
}
