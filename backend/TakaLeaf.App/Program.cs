using System.Text;
using System.Threading.RateLimiting;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using TakaLeaf.App.Common;
using TakaLeaf.App.Common.Email;
using TakaLeaf.App.Data;
using TakaLeaf.App.Data.Entities;
using TakaLeaf.App.Features.Auth;
using TakaLeaf.App.Features.Health;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddOpenApi();
builder.Services.AddProblemDetails();
builder.Services.AddSingleton(TimeProvider.System);
builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseNpgsql(builder.Configuration.GetConnectionString("Database")));

// Settings
builder.Services.AddOptions<AppOptions>().BindConfiguration(AppOptions.Section);
builder.Services.AddOptions<EmailOptions>().BindConfiguration(EmailOptions.Section);
builder.Services.AddOptions<AuthOptions>()
    .BindConfiguration(AuthOptions.Section)
    .Validate(auth => Encoding.UTF8.GetByteCount(auth.SigningKey) >= 32, "Auth:SigningKey must be at least 32 bytes.")
    .ValidateOnStart();

// Accounts and sign-in
builder.Services.AddSingleton<IEmailSender, SmtpEmailSender>();
builder.Services.AddSingleton<IPasswordHasher<User>, PasswordHasher<User>>();
builder.Services.AddScoped<TokenIssuer>();
builder.Services.AddScoped<VerificationEmails>();
builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme).AddJwtBearer();
builder.Services.AddOptions<JwtBearerOptions>(JwtBearerDefaults.AuthenticationScheme)
    .Configure<IOptions<AuthOptions>>((jwt, auth) =>
    {
        jwt.MapInboundClaims = false;
        jwt.TokenValidationParameters = TokenIssuer.ValidationParameters(auth.Value);
    });
builder.Services.AddAuthorization();

// Sign-in, registration and reset endpoints are limited per IP address.
builder.Services.AddRateLimiter(options =>
{
    options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
    options.AddPolicy(AuthEndpoints.RateLimitPolicy, http =>
    {
        var perMinute = http.RequestServices.GetRequiredService<IConfiguration>().GetValue("RateLimits:AuthPerMinute", 20);
        return RateLimitPartition.GetFixedWindowLimiter(
            http.Connection.RemoteIpAddress?.ToString() ?? "unknown",
            _ => new FixedWindowRateLimiterOptions
            {
                PermitLimit = perMinute,
                Window = TimeSpan.FromMinutes(1),
                QueueLimit = 0,
            });
    });
});

var app = builder.Build();

if (app.Configuration.GetValue<bool>("Database:MigrateOnStartup"))
{
    await using var scope = app.Services.CreateAsyncScope();
    await scope.ServiceProvider.GetRequiredService<AppDbContext>().Database.MigrateAsync();
}

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

app.UseAuthentication();
app.UseAuthorization();
app.UseRateLimiter();

// Every feature registers its own endpoints under /api.
var api = app.MapGroup("/api");
api.MapGetHealth();
api.MapAuth();

app.Run();

// Lets the test project start the app with WebApplicationFactory<Program>.
public partial class Program;
