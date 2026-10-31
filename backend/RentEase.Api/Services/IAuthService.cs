using RentEase.Api.DTOs;

namespace RentEase.Api.Services;

public record AuthResult(bool Success, LoginResponse? Data, string? ErrorMessage)
{
    public static AuthResult Ok(LoginResponse data) => new(true, data, null);
    public static AuthResult Fail(string message) => new(false, null, message);
}

public interface IAuthService
{
    Task<AuthResult> LoginAsync(LoginRequest request);
}
