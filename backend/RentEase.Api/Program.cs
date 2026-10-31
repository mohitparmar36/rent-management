using System.Text;
using System.Threading.RateLimiting;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Microsoft.OpenApi.Models;
using RentEase.Api.Common;
using RentEase.Api.Data;
using RentEase.Api.Middleware;
using RentEase.Api.Models;
using RentEase.Api.Services;

var builder = WebApplication.CreateBuilder(args);

const string CorsPolicyName = "RentEaseFrontend";
var allowedOrigins = builder.Configuration.GetSection("Cors:AllowedOrigins").Get<string[]>()
                     ?? new[] { "http://localhost:5173" };

// Database — connection string comes from configuration (appsettings / user-secrets / environment)
builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseSqlServer(builder.Configuration.GetConnectionString("DefaultConnection")));

// Password hashing (PBKDF2 via ASP.NET Core Identity's hasher — no external identity provider involved)
builder.Services.AddSingleton<IPasswordHasher<User>, PasswordHasher<User>>();

// The signed-in user and the per-role data filters built from it
builder.Services.AddHttpContextAccessor();
builder.Services.AddScoped<CurrentUser>();
builder.Services.AddScoped<DataScope>();

// Application services (business rules live here; controllers stay thin)
builder.Services.AddScoped<IAuthService, AuthService>();
builder.Services.AddScoped<ProfileService>();
builder.Services.AddScoped<UserService>();
builder.Services.AddScoped<NotificationService>();
builder.Services.AddScoped<RentStatusRefresher>();
builder.Services.AddScoped<PropertyService>();
builder.Services.AddScoped<AssignmentService>();
builder.Services.AddScoped<TenantService>();
builder.Services.AddScoped<RentPaymentService>();
builder.Services.AddScoped<ComplaintService>();
builder.Services.AddScoped<DashboardService>();
builder.Services.AddScoped<ReportService>();

// JWT authentication. The signing key is a secret: it is NOT in appsettings.json.
// Development: `dotnet user-secrets set "Jwt:Key" "<random 64+ chars>"` (see README)
// Production:  environment variable Jwt__Key
var jwtSection = builder.Configuration.GetSection("Jwt");
var jwtKey = jwtSection["Key"];
if (string.IsNullOrWhiteSpace(jwtKey) || jwtKey.Length < 32)
{
    throw new InvalidOperationException(
        "Jwt:Key is missing or shorter than 32 characters. Set it with " +
        "`dotnet user-secrets set \"Jwt:Key\" \"<random value>\"` in backend/RentEase.Api, " +
        "or the Jwt__Key environment variable. See README.md.");
}

builder.Services.AddAuthentication(options =>
    {
        options.DefaultAuthenticateScheme = JwtBearerDefaults.AuthenticationScheme;
        options.DefaultChallengeScheme = JwtBearerDefaults.AuthenticationScheme;
    })
    .AddJwtBearer(options =>
    {
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidateAudience = true,
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true,
            ValidIssuer = jwtSection["Issuer"],
            ValidAudience = jwtSection["Audience"],
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtKey)),
            ClockSkew = TimeSpan.FromMinutes(1)
        };

        options.Events = new JwtBearerEvents
        {
            // A valid token is not enough: the account must still exist and be active,
            // so deactivating a user takes effect immediately rather than when the token expires.
            OnTokenValidated = async context =>
            {
                // The validated identity is on context.Principal (HttpContext.User is not set yet)
                var idClaim = context.Principal?.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
                var userId = int.TryParse(idClaim, out var id) ? id : 0;

                var db = context.HttpContext.RequestServices.GetRequiredService<AppDbContext>();
                var isActive = await db.Users.AnyAsync(u => u.UserId == userId && u.IsActive);
                if (!isActive)
                {
                    context.Fail("Account is inactive or no longer exists.");
                }
            },
            // JSON bodies instead of empty 401/403 responses, matching the rest of the API
            OnChallenge = async context =>
            {
                context.HandleResponse();
                context.Response.StatusCode = StatusCodes.Status401Unauthorized;
                await context.Response.WriteAsJsonAsync(new
                {
                    message = context.AuthenticateFailure is null
                        ? "Please sign in to continue."
                        : "Your session has expired or is no longer valid. Please sign in again."
                });
            },
            OnForbidden = async context =>
            {
                context.Response.StatusCode = StatusCodes.Status403Forbidden;
                await context.Response.WriteAsJsonAsync(new { message = "You do not have permission to do that." });
            }
        };
    });

builder.Services.AddAuthorization();

// Brute-force protection: at most N login attempts per minute per IP address (default 10)
var loginsPerMinute = builder.Configuration.GetValue("RateLimiting:LoginsPerMinute", 10);
builder.Services.AddRateLimiter(options =>
{
    options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
    options.AddPolicy("login", httpContext =>
        RateLimitPartition.GetFixedWindowLimiter(
            httpContext.Connection.RemoteIpAddress?.ToString() ?? "unknown",
            _ => new FixedWindowRateLimiterOptions { PermitLimit = loginsPerMinute, Window = TimeSpan.FromMinutes(1) }));
    options.OnRejected = async (context, token) =>
    {
        await context.HttpContext.Response.WriteAsJsonAsync(
            new { message = "Too many sign-in attempts. Please wait a minute and try again." }, token);
    };
});

// CORS — only the configured frontend origin(s)
builder.Services.AddCors(options =>
{
    options.AddPolicy(CorsPolicyName, policy =>
    {
        policy.WithOrigins(allowedOrigins)
              .AllowAnyHeader()
              .AllowAnyMethod();
    });
});

builder.Services.AddControllers()
    .ConfigureApiBehaviorOptions(options =>
    {
        // Validation errors: { message: "<first error>", errors: { field: [..] } }
        options.InvalidModelStateResponseFactory = context =>
        {
            var errors = context.ModelState
                .Where(e => e.Value?.Errors.Count > 0)
                .ToDictionary(
                    e => System.Text.Json.JsonNamingPolicy.CamelCase.ConvertName(e.Key),
                    e => e.Value!.Errors.Select(err =>
                        string.IsNullOrEmpty(err.ErrorMessage) ? "Invalid value." : err.ErrorMessage).ToArray());

            var first = errors.Values.SelectMany(v => v).FirstOrDefault() ?? "Some fields are invalid.";
            return new BadRequestObjectResult(new { message = first, errors });
        };
    });

builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(options =>
{
    options.SwaggerDoc("v1", new OpenApiInfo { Title = "RentEase API", Version = "v1" });

    var securityScheme = new OpenApiSecurityScheme
    {
        Name = "Authorization",
        Type = SecuritySchemeType.Http,
        Scheme = "bearer",
        BearerFormat = "JWT",
        In = ParameterLocation.Header,
        Description = "Enter the JWT token returned by /api/auth/login."
    };
    options.AddSecurityDefinition("Bearer", securityScheme);
    options.AddSecurityRequirement(new OpenApiSecurityRequirement
    {
        {
            new OpenApiSecurityScheme { Reference = new OpenApiReference { Type = ReferenceType.SecurityScheme, Id = "Bearer" } },
            Array.Empty<string>()
        }
    });

    // DateOnly is sent as "yyyy-MM-dd"
    options.MapType<DateOnly>(() => new OpenApiSchema { Type = "string", Format = "date" });

    var xmlDocs = Path.Combine(AppContext.BaseDirectory, "RentEase.Api.xml");
    if (File.Exists(xmlDocs)) options.IncludeXmlComments(xmlDocs);
});

var app = builder.Build();

// Converts exceptions to JSON errors — registered first so it wraps everything else
app.UseMiddleware<ErrorHandlingMiddleware>();

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}
else
{
    app.UseHsts();
}

app.UseHttpsRedirection();

app.UseCors(CorsPolicyName);

app.UseAuthentication();
app.UseAuthorization();
app.UseRateLimiter();

app.MapControllers();

app.Run();
