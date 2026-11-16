using System.Net;
using System.Text;
using System.Text.Json.Serialization;
using System.Threading.RateLimiting;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using TakaLeaf.App.Common;
using TakaLeaf.App.Common.Email;
using TakaLeaf.App.Common.Logging;
using TakaLeaf.App.Data;
using TakaLeaf.App.Data.Entities;
using TakaLeaf.App.Features.Auth;
using TakaLeaf.App.Features.Categories;
using TakaLeaf.App.Features.Dashboard;
using TakaLeaf.App.Features.Health;
using TakaLeaf.App.Features.Transactions;
using TakaLeaf.App.Features.Wallets;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddTakaLeafLogging();
builder.Services.AddOpenApi();
builder.Services.AddProblemDetails();

// Enums travel as their names ("CreditCard", "Expense"), not numbers.
builder.Services.ConfigureHttpJsonOptions(options => options.SerializerOptions.Converters.Add(new JsonStringEnumConverter()));
builder.Services.AddSingleton(TimeProvider.System);
builder.Services.AddSingleton<LocalCalendar>();
builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseNpgsql(builder.Configuration.GetConnectionString("Database")));

// Settings
builder.Services.AddOptions<AppOptions>().BindConfiguration(AppOptions.Section);
builder.Services.AddOptions<EmailOptions>().BindConfiguration(EmailOptions.Section);
builder.Services.AddOptions<AuthOptions>()
    .BindConfiguration(AuthOptions.Section)
    .Validate(auth => Encoding.UTF8.GetByteCount(auth.SigningKey) >= 32, "Auth:SigningKey must be at least 32 bytes.")
    .ValidateOnStart();

// The real client address when a reverse proxy listed in ReverseProxy:TrustedProxies forwards the
// request. Addresses from anyone else are ignored, so a caller cannot fake its IP.
builder.Services.AddOptions<ForwardedHeadersOptions>().Configure<IConfiguration>((forwarded, configuration) =>
{
    forwarded.ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto;
    foreach (var address in configuration.GetSection("ReverseProxy:TrustedProxies").Get<string[]>() ?? [])
    {
        forwarded.KnownProxies.Add(IPAddress.Parse(address));
    }
});

// Accounts and sign-in
builder.Services.AddSingleton<IEmailSender, SmtpEmailSender>();
builder.Services.AddSingleton<IPasswordHasher<User>, PasswordHasher<User>>();
builder.Services.AddScoped<TokenIssuer>();
builder.Services.AddScoped<VerificationEmails>();
builder.Services.AddScoped<PasswordEmails>();
builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme).AddJwtBearer();
builder.Services.AddOptions<JwtBearerOptions>(JwtBearerDefaults.AuthenticationScheme)
    .Configure<IOptions<AuthOptions>>((jwt, auth) =>
    {
        jwt.MapInboundClaims = false;
        jwt.TokenValidationParameters = TokenIssuer.ValidationParameters(auth.Value);
    });
builder.Services.AddAuthorization();

// Sign-in, registration and password endpoints are limited per IP address.
builder.Services.AddRateLimiter(options =>
{
    options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
    options.AddPolicy(AuthEndpoints.RateLimitPolicy, http =>
    {
        var perMinute = http.RequestServices.GetRequiredService<IConfiguration>().GetValue("RateLimits:AuthPerMinute", 20);
        return RateLimitPartition.GetFixedWindowLimiter(
            RequestLogging.ClientIp(http),
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

app.UseForwardedHeaders();
app.UseTakaLeafRequestLogging();
app.UseAuthentication();
app.UseRequestLogContext();
app.UseAuthorization();
app.UseRateLimiter();

// Every feature registers its own endpoints under /api.
var api = app.MapGroup("/api");
api.MapGetHealth();
api.MapAuth();
api.MapWallets();
api.MapCategories();
api.MapTransactions();
api.MapDashboard();

app.Run();

// Lets the test project start the app with WebApplicationFactory<Program>.
public partial class Program;
