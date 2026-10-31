using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;
using RentEase.Api.Common;

namespace RentEase.Api.Middleware;

/// <summary>
/// Converts exceptions into consistent JSON error responses: { "message": "..." }.
/// Internal details (stack traces, SQL text) are logged, never sent to the browser.
/// </summary>
public class ErrorHandlingMiddleware
{
    private readonly RequestDelegate _next;
    private readonly ILogger<ErrorHandlingMiddleware> _logger;

    public ErrorHandlingMiddleware(RequestDelegate next, ILogger<ErrorHandlingMiddleware> logger)
    {
        _next = next;
        _logger = logger;
    }

    public async Task InvokeAsync(HttpContext context)
    {
        try
        {
            await _next(context);
        }
        catch (ApiException ex)
        {
            await WriteErrorAsync(context, ex.StatusCode, ex.Message);
        }
        catch (DbUpdateException ex) when (DbErrors.IsUniqueViolation(ex))
        {
            _logger.LogWarning(ex, "Unique constraint violation");
            await WriteErrorAsync(context, StatusCodes.Status409Conflict,
                "A record with the same details already exists.");
        }
        catch (Exception ex) when (IsDatabaseUnavailable(ex))
        {
            _logger.LogError(ex, "Database connection failure");
            await WriteErrorAsync(context, StatusCodes.Status503ServiceUnavailable,
                "The database is currently unavailable. Please try again shortly.");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Unhandled exception for {Method} {Path}", context.Request.Method, context.Request.Path);
            await WriteErrorAsync(context, StatusCodes.Status500InternalServerError,
                "Something went wrong on our side. Please try again.");
        }
    }

    private static bool IsDatabaseUnavailable(Exception ex)
    {
        // Connection failures surface as SqlException, sometimes wrapped by EF Core
        for (var current = ex; current is not null; current = current.InnerException)
        {
            // Class >= 20: fatal connection errors. Numbers: timeout (-2), network (-1, 2, 53),
            // cannot open database (4060), login failed (18456)
            if (current is SqlException sql &&
                (sql.Class >= 20 || sql.Number is -2 or -1 or 2 or 53 or 4060 or 18456))
                return true;
        }
        return false;
    }

    private static async Task WriteErrorAsync(HttpContext context, int statusCode, string message)
    {
        if (context.Response.HasStarted) return;

        context.Response.Clear();
        context.Response.StatusCode = statusCode;
        await context.Response.WriteAsJsonAsync(new { message });
    }
}
