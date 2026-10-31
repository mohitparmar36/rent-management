using Microsoft.EntityFrameworkCore;

namespace RentEase.Api.Common;

public class PagedResult<T>
{
    public List<T> Items { get; set; } = new();
    public int Page { get; set; }
    public int PageSize { get; set; }
    public int TotalCount { get; set; }
    public int TotalPages => PageSize == 0 ? 0 : (int)Math.Ceiling(TotalCount / (double)PageSize);
}

/// <summary>Base class for list query strings: ?page=1&amp;pageSize=10&amp;search=...</summary>
public class PageQuery
{
    private const int MaxPageSize = 100;

    private int _page = 1;
    private int _pageSize = 10;

    public int Page
    {
        get => _page;
        set => _page = value < 1 ? 1 : value;
    }

    public int PageSize
    {
        get => _pageSize;
        set => _pageSize = value < 1 ? 10 : Math.Min(value, MaxPageSize);
    }

    public string? Search { get; set; }

    /// <summary>Column to sort by. Each list endpoint documents its allowed values; unknown values use the default order.</summary>
    public string? SortBy { get; set; }

    /// <summary>"asc" or "desc".</summary>
    public string? SortDir { get; set; }

    public bool SortDescending => string.Equals(SortDir, "desc", StringComparison.OrdinalIgnoreCase);
}

public static class SortExtensions
{
    /// <summary>OrderBy or OrderByDescending depending on the flag.</summary>
    public static IOrderedQueryable<T> OrderBy<T, TKey>(
        this IQueryable<T> query, System.Linq.Expressions.Expression<Func<T, TKey>> key, bool descending) =>
        descending ? query.OrderByDescending(key) : query.OrderBy(key);
}

public static class QueryableExtensions
{
    public static async Task<PagedResult<T>> ToPagedResultAsync<T>(this IQueryable<T> query, PageQuery page)
    {
        var total = await query.CountAsync();
        var items = await query
            .Skip((page.Page - 1) * page.PageSize)
            .Take(page.PageSize)
            .ToListAsync();

        return new PagedResult<T>
        {
            Items = items,
            Page = page.Page,
            PageSize = page.PageSize,
            TotalCount = total
        };
    }
}
