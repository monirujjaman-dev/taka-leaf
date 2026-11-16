using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Serilog.Core;
using TakaLeaf.App.Common.Email;

namespace TakaLeaf.App.Tests.Support;

/// <summary>
/// The app as the tests run it: a real PostgreSQL, emails captured in memory instead of sent,
/// log events captured for checking, and the sign-in rate limit raised so tests do not trip over each other.
/// </summary>
public sealed class TestApp : WebApplicationFactory<Program>
{
    public FakeEmailSender Emails { get; } = new();

    public CapturedLogs Logs { get; } = new();

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.ConfigureAppConfiguration((_, config) => config.AddInMemoryCollection(new Dictionary<string, string?>
        {
            ["RateLimits:AuthPerMinute"] = "100000",
        }));

        builder.ConfigureTestServices(services =>
        {
            services.RemoveAll<IEmailSender>();
            services.AddSingleton<IEmailSender>(Emails);
            services.AddSingleton<ILogEventSink>(Logs);
        });
    }
}
