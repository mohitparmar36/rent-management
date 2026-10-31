using Microsoft.EntityFrameworkCore;
using RentEase.Api.Common;
using RentEase.Api.Data;
using RentEase.Api.DTOs;
using RentEase.Api.Models;

namespace RentEase.Api.Services;

public class NotificationService
{
    private readonly AppDbContext _db;
    private readonly CurrentUser _user;

    public NotificationService(AppDbContext db, CurrentUser user)
    {
        _db = db;
        _user = user;
    }

    /// <summary>
    /// Queues a notification on the DbContext. It is written by the caller's next
    /// SaveChangesAsync, together with the change it describes (one transaction).
    /// </summary>
    public void Queue(int userId, string title, string message) => Queue(new Notification { UserId = userId }, title, message);

    /// <summary>Overload for a user that has not been saved yet (no id).</summary>
    public void Queue(User user, string title, string message) => Queue(new Notification { User = user }, title, message);

    private void Queue(Notification notification, string title, string message)
    {
        notification.Title = Truncate(title, 150);
        notification.Message = Truncate(message, 500);
        notification.IsRead = false;
        notification.CreatedAt = DateTime.UtcNow;
        _db.Notifications.Add(notification);
    }

    public async Task<NotificationPageDto> GetMineAsync(NotificationQuery query)
    {
        var mine = _db.Notifications.AsNoTracking().Where(n => n.UserId == _user.UserId);
        var filtered = query.UnreadOnly ? mine.Where(n => !n.IsRead) : mine;

        var page = await filtered
            .OrderByDescending(n => n.CreatedAt)
            .ThenByDescending(n => n.NotificationId)
            .Select(n => new NotificationDto
            {
                NotificationId = n.NotificationId,
                Title = n.Title,
                Message = n.Message,
                IsRead = n.IsRead,
                CreatedAt = n.CreatedAt
            })
            .ToPagedResultAsync(query);

        return new NotificationPageDto
        {
            Items = page.Items,
            Page = page.Page,
            PageSize = page.PageSize,
            TotalCount = page.TotalCount,
            UnreadCount = await mine.CountAsync(n => !n.IsRead)
        };
    }

    public Task<int> GetUnreadCountAsync() =>
        _db.Notifications.CountAsync(n => n.UserId == _user.UserId && !n.IsRead);

    public async Task MarkReadAsync(int notificationId)
    {
        // Filtering by the caller's id means another user's notification is simply "not found"
        var updated = await _db.Notifications
            .Where(n => n.NotificationId == notificationId && n.UserId == _user.UserId)
            .ExecuteUpdateAsync(s => s.SetProperty(n => n.IsRead, true));

        if (updated == 0)
            throw ApiException.NotFound("Notification not found.");
    }

    public Task<int> MarkAllReadAsync() =>
        _db.Notifications
            .Where(n => n.UserId == _user.UserId && !n.IsRead)
            .ExecuteUpdateAsync(s => s.SetProperty(n => n.IsRead, true));

    private static string Truncate(string text, int max) => text.Length <= max ? text : text[..(max - 1)] + "…";
}
