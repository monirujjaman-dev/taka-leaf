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
using TakaLeaf.App.Common.Web;
using TakaLeaf.App.Data;
using TakaLeaf.App.Data.Entities;
using TakaLeaf.App.Features.Auth;
using TakaLeaf.App.Features.Categories;
using TakaLeaf.App.Features.Budgets;
using TakaLeaf.App.Features.Dashboard;
using TakaLeaf.App.Features.People;
using TakaLeaf.App.Features.Recurring;
using TakaLeaf.App.Features.Reports;
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
builder.Services.Configure<RecurringOptions>(builder.Configuration.GetSection(RecurringOptions.Section));
builder.Services.AddScoped<RecurringRecorder>();
builder.Services.AddHostedService<RecurringWorker>();
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

    // Behind Dokploy, Traefik reaches the app over a private Docker network whose addresses
    // change between deploys, so a whole network can be trusted (for example 10.0.0.0/8).
    foreach (var network in configuration.GetSection("ReverseProxy:TrustedNetworks").Get<string[]>() ?? [])
    {
        forwarded.KnownIPNetworks.Add(System.Net.IPNetwork.Parse(network));
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
if (!app.Environment.IsDevelopment())
{
    app.UseHsts();
}

app.UseSecurityHeaders();

// The Docker image carries the built web app in wwwroot. Hashed files under /assets never
// change, so browsers keep them for a year; everything else is checked on each visit.
var webApp = app.Environment.WebRootFileProvider.GetFileInfo("index.html").Exists;
if (webApp)
{
    app.UseStaticFiles(new StaticFileOptions { OnPrepareResponse = WebAppCaching.Apply });
}

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
api.MapPeople();
api.MapBudgets();
api.MapRecurring();
api.MapReports();

// An unknown API address is a 404 problem, never the web app's page.
api.Map("/{**rest}", () => Results.Problem(title: "There is nothing at this address.", statusCode: StatusCodes.Status404NotFound))
    .ExcludeFromDescription();

// Any other address is a page of the web app (/wallets, /people/…): the app's router shows it.
if (webApp)
{
    app.MapFallbackToFile("index.html", new StaticFileOptions { OnPrepareResponse = WebAppCaching.Apply });
}

app.Run();

// Lets the test project start the app with WebApplicationFactory<Program>.
public partial class Program;
