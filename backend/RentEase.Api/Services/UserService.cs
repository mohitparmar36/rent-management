using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using RentEase.Api.Common;
using RentEase.Api.Data;
using RentEase.Api.DTOs;
using RentEase.Api.Models;

namespace RentEase.Api.Services;

/// <summary>Admin-only user management.</summary>
public class UserService
{
    private readonly AppDbContext _db;
    private readonly CurrentUser _user;
    private readonly IPasswordHasher<User> _hasher;

    public UserService(AppDbContext db, CurrentUser user, IPasswordHasher<User> hasher)
    {
        _db = db;
        _user = user;
        _hasher = hasher;
    }

    /// <summary>Sort keys: name, email, role, createdAt (default), lastLogin.</summary>
    public Task<PagedResult<UserListItemDto>> GetAllAsync(UserQuery q)
    {
        var query = _db.Users.AsNoTracking();

        if (!string.IsNullOrWhiteSpace(q.Search))
        {
            var s = q.Search.Trim();
            query = query.Where(u =>
                (u.FirstName + " " + u.LastName).Contains(s) || u.Email.Contains(s));
        }

        if (!string.IsNullOrWhiteSpace(q.Role))
            query = query.Where(u => u.Role.RoleName == q.Role);

        if (q.IsActive.HasValue)
            query = query.Where(u => u.IsActive == q.IsActive.Value);

        var desc = q.SortDescending;
        query = q.SortBy?.ToLowerInvariant() switch
        {
            "name" => query.OrderBy(u => u.FirstName, desc).ThenBy(u => u.LastName),
            "email" => query.OrderBy(u => u.Email, desc),
            "role" => query.OrderBy(u => u.Role.RoleName, desc).ThenBy(u => u.FirstName),
            "lastlogin" => query.OrderBy(u => u.LastLoginAt, desc),
            "createdat" => query.OrderBy(u => u.CreatedAt, desc),
            _ => query.OrderByDescending(u => u.CreatedAt)
        };

        return query.Select(u => new UserListItemDto
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
        }).ToPagedResultAsync(q);
    }

    public async Task<UserDetailsDto> GetByIdAsync(int id)
    {
        var user = await _db.Users
            .AsNoTracking()
            .Where(u => u.UserId == id)
            .Select(u => new UserDetailsDto
            {
                UserId = u.UserId,
                FirstName = u.FirstName,
                LastName = u.LastName,
                Email = u.Email,
                PhoneNumber = u.PhoneNumber,
                Role = u.Role.RoleName,
                IsActive = u.IsActive,
                CreatedAt = u.CreatedAt,
                UpdatedAt = u.UpdatedAt,
                LastLoginAt = u.LastLoginAt,
                PropertyCount = u.OwnedProperties.Count,
                CurrentPropertyName = u.TenantProperties
                    .Where(tp => tp.Status == AssignmentStatuses.Active)
                    .Select(tp => tp.Property.PropertyName)
                    .FirstOrDefault(),
                ComplaintCount = u.Complaints.Count
            })
            .FirstOrDefaultAsync();

        return user ?? throw ApiException.NotFound("User not found.");
    }

    public async Task<int> CreateAsync(CreateUserRequest request)
    {
        var role = await _db.Roles.FirstOrDefaultAsync(r => r.RoleName == request.Role)
                   ?? throw ApiException.BadRequest("Choose a valid role: Admin, Landlord or Tenant.");

        var user = await NewUserAsync(role.RoleId, request.FirstName, request.LastName, request.Email,
            request.PhoneNumber, request.Password);

        _db.Users.Add(user);
        await _db.SaveChangesAsync();
        return user.UserId;
    }

    /// <summary>
    /// Builds a new, active user with a hashed password after checking the email is free.
    /// Shared with TenantService so both create accounts identically.
    /// </summary>
    public async Task<User> NewUserAsync(int roleId, string firstName, string lastName, string email,
        string? phone, string password)
    {
        var normalizedEmail = NormalizeEmail(email);
        if (await _db.Users.AnyAsync(u => u.Email == normalizedEmail))
            throw ApiException.Conflict("An account with this email already exists.");

        var now = DateTime.UtcNow;
        var user = new User
        {
            RoleId = roleId,
            FirstName = firstName.Trim(),
            LastName = lastName.Trim(),
            Email = normalizedEmail,
            PhoneNumber = string.IsNullOrWhiteSpace(phone) ? null : phone.Trim(),
            IsActive = true,
            CreatedAt = now,
            UpdatedAt = now
        };
        user.PasswordHash = _hasher.HashPassword(user, password);
        return user;
    }

    public async Task UpdateAsync(int id, UpdateUserRequest request)
    {
        var user = await _db.Users.FirstOrDefaultAsync(u => u.UserId == id)
                   ?? throw ApiException.NotFound("User not found.");

        var email = NormalizeEmail(request.Email);
        if (email != user.Email && await _db.Users.AnyAsync(u => u.Email == email && u.UserId != id))
            throw ApiException.Conflict("An account with this email already exists.");

        user.FirstName = request.FirstName.Trim();
        user.LastName = request.LastName.Trim();
        user.Email = email;
        user.PhoneNumber = string.IsNullOrWhiteSpace(request.PhoneNumber) ? null : request.PhoneNumber.Trim();
        user.UpdatedAt = DateTime.UtcNow;

        if (!string.IsNullOrWhiteSpace(request.NewPassword))
            user.PasswordHash = _hasher.HashPassword(user, request.NewPassword);

        await _db.SaveChangesAsync();
    }

    public async Task SetStatusAsync(int id, bool isActive)
    {
        var user = await _db.Users.Include(u => u.Role).FirstOrDefaultAsync(u => u.UserId == id)
                   ?? throw ApiException.NotFound("User not found.");

        if (!isActive)
        {
            if (id == _user.UserId)
                throw ApiException.BadRequest("You cannot deactivate your own account.");

            if (user.Role.RoleName == AppRoles.Admin)
            {
                var otherActiveAdmins = await _db.Users.CountAsync(u =>
                    u.Role.RoleName == AppRoles.Admin && u.IsActive && u.UserId != id);
                if (otherActiveAdmins == 0)
                    throw ApiException.BadRequest("You cannot deactivate the last active administrator.");
            }
        }

        if (user.IsActive == isActive) return;

        user.IsActive = isActive;
        user.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();
    }

    public static string NormalizeEmail(string email) => email.Trim().ToLowerInvariant();
}
