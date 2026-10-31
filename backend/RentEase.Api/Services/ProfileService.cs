using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using RentEase.Api.Common;
using RentEase.Api.Data;
using RentEase.Api.DTOs;
using RentEase.Api.Models;

namespace RentEase.Api.Services;

/// <summary>The signed-in user's own account. Always keyed by the token's user id.</summary>
public class ProfileService
{
    private readonly AppDbContext _db;
    private readonly CurrentUser _user;
    private readonly IPasswordHasher<User> _hasher;

    public ProfileService(AppDbContext db, CurrentUser user, IPasswordHasher<User> hasher)
    {
        _db = db;
        _user = user;
        _hasher = hasher;
    }

    public async Task<ProfileDto> GetAsync()
    {
        var profile = await _db.Users
            .AsNoTracking()
            .Where(u => u.UserId == _user.UserId)
            .Select(u => new ProfileDto
            {
                UserId = u.UserId,
                FirstName = u.FirstName,
                LastName = u.LastName,
                Email = u.Email,
                PhoneNumber = u.PhoneNumber,
                Role = u.Role.RoleName,
                IsActive = u.IsActive,
                CreatedAt = u.CreatedAt,
                LastLoginAt = u.LastLoginAt
            })
            .FirstOrDefaultAsync();

        return profile ?? throw ApiException.NotFound("Account not found.");
    }

    /// <summary>The small user object the frontend keeps in its session.</summary>
    public async Task<UserDto> GetSessionUserAsync()
    {
        var profile = await GetAsync();
        return new UserDto
        {
            UserId = profile.UserId,
            FirstName = profile.FirstName,
            LastName = profile.LastName,
            Email = profile.Email,
            Role = profile.Role
        };
    }

    public async Task<ProfileDto> UpdateAsync(UpdateProfileRequest request)
    {
        var user = await LoadUserAsync();

        // Only name and phone — role, email, active flag and id cannot change here
        user.FirstName = request.FirstName.Trim();
        user.LastName = request.LastName.Trim();
        user.PhoneNumber = string.IsNullOrWhiteSpace(request.PhoneNumber) ? null : request.PhoneNumber.Trim();
        user.UpdatedAt = DateTime.UtcNow;

        await _db.SaveChangesAsync();
        return await GetAsync();
    }

    public async Task ChangePasswordAsync(ChangePasswordRequest request)
    {
        var user = await LoadUserAsync();

        var result = _hasher.VerifyHashedPassword(user, user.PasswordHash, request.CurrentPassword);
        if (result == PasswordVerificationResult.Failed)
            throw ApiException.BadRequest("Your current password is incorrect.");

        if (request.CurrentPassword == request.NewPassword)
            throw ApiException.BadRequest("The new password must be different from your current password.");

        user.PasswordHash = _hasher.HashPassword(user, request.NewPassword);
        user.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();
    }

    private async Task<User> LoadUserAsync() =>
        await _db.Users.FirstOrDefaultAsync(u => u.UserId == _user.UserId)
        ?? throw ApiException.NotFound("Account not found.");
}
