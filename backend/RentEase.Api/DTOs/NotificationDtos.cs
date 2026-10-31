using RentEase.Api.Common;

namespace RentEase.Api.DTOs;

public class NotificationQuery : PageQuery
{
    public bool UnreadOnly { get; set; }
}

public class NotificationDto
{
    public int NotificationId { get; set; }
    public string Title { get; set; } = string.Empty;
    public string Message { get; set; } = string.Empty;
    public bool IsRead { get; set; }
    public DateTime CreatedAt { get; set; }
}

public class NotificationPageDto : PagedResult<NotificationDto>
{
    public int UnreadCount { get; set; }
}
