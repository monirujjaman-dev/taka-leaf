using System.Net.Http.Json;
using MailKit.Net.Smtp;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using TakaLeaf.App.Common.Email;
using TakaLeaf.App.Common.Outbox;
using TakaLeaf.App.Data;
using TakaLeaf.App.Data.Entities;
using TakaLeaf.App.Tests.Data;
using TakaLeaf.App.Tests.Features.Auth;
using TakaLeaf.App.Tests.Support;

namespace TakaLeaf.App.Tests.Common;

[Collection(DatabaseCollection.Name)]
public class OutboxTests(DatabaseFixture fixture)
{
    private readonly AuthClient auth = new(fixture);

    private async Task<Guid> AddTestMessage(string payload)
    {
        await using var scope = fixture.Factory.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        scope.ServiceProvider.GetRequiredService<OutboxWriter>().Add(ScriptedOutboxHandler.MessageType, new { payload });
        await db.SaveChangesAsync();
        return db.ChangeTracker.Entries<OutboxMessage>().Single().Entity.Id;
    }

    private async Task<OutboxMessage> Load(Guid id)
    {
        await using var scope = fixture.Factory.Services.CreateAsyncScope();
        return await scope.ServiceProvider.GetRequiredService<AppDbContext>().OutboxMessages.AsNoTracking().SingleAsync(m => m.Id == id);
    }

    /// <summary>Makes a waiting message due now, as if its retry time had come.</summary>
    private async Task MakeDue(Guid id)
    {
        await using var scope = fixture.Factory.Services.CreateAsyncScope();
        await scope.ServiceProvider.GetRequiredService<AppDbContext>().OutboxMessages
            .Where(m => m.Id == id)
            .ExecuteUpdateAsync(s => s.SetProperty(m => m.AvailableAt, DateTimeOffset.UtcNow.AddSeconds(-1)));
    }

    private async Task<int> ProcessOnce()
    {
        await using var scope = fixture.Factory.Services.CreateAsyncScope();
        return await scope.ServiceProvider.GetRequiredService<OutboxProcessor>().ProcessDueAsync(CancellationToken.None);
    }

    private int Handled(string marker) => fixture.Factory.OutboxHandler.Handled.Count(p => p.Contains(marker));

    [Fact]
    public async Task Registering_writes_the_email_to_the_outbox_and_the_worker_sends_it()
    {
        var email = AuthClient.NewEmail();
        (await auth.NewClient().PostAsJsonAsync("/api/auth/register", new { name = "Outbox Test", email, password = AuthClient.Password })).EnsureSuccessStatusCode();

        await using (var scope = fixture.Factory.Services.CreateAsyncScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            var waiting = await db.OutboxMessages.AsNoTracking()
                .Where(m => m.Type == EmailOutboxHandler.MessageType && m.ProcessedAt == null && m.Payload!.Contains(email))
                .ToListAsync();
            Assert.Single(waiting);
        }

        var sent = Assert.Single(fixture.Factory.Emails.SentTo(email));
        Assert.Equal("Verify your TakaLeaf email", sent.Subject);

        await using (var scope = fixture.Factory.Services.CreateAsyncScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            Assert.False(await db.OutboxMessages.AnyAsync(m => m.ProcessedAt == null && m.Payload!.Contains(email)));
        }
    }

    [Fact]
    public async Task A_failed_email_is_tried_again_later_and_then_sent()
    {
        var email = AuthClient.NewEmail();
        fixture.Factory.Emails.Flush();
        fixture.Factory.Emails.FailNext(new IOException("Connection refused"));
        (await auth.NewClient().PostAsJsonAsync("/api/auth/register", new { name = "Retry Test", email, password = AuthClient.Password })).EnsureSuccessStatusCode();

        Assert.Empty(fixture.Factory.Emails.SentTo(email));

        Guid id;
        await using (var scope = fixture.Factory.Services.CreateAsyncScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            var message = await db.OutboxMessages.AsNoTracking().SingleAsync(m => m.ProcessedAt == null && m.Payload!.Contains(email));
            Assert.Equal(1, message.Attempts);
            Assert.Equal("IOException: Connection refused", message.LastError);
            Assert.InRange(message.AvailableAt - DateTimeOffset.UtcNow, TimeSpan.FromSeconds(20), TimeSpan.FromSeconds(40));
            Assert.Null(message.LockedUntil);
            id = message.Id;
        }

        await MakeDue(id);
        Assert.Single(fixture.Factory.Emails.SentTo(email));
        var done = await Load(id);
        Assert.Equal(2, done.Attempts);
        Assert.NotNull(done.ProcessedAt);
        Assert.Null(done.Payload);
    }

    [Fact]
    public async Task A_refused_address_is_given_up_at_once()
    {
        var email = AuthClient.NewEmail();
        fixture.Factory.Emails.Flush();
        fixture.Factory.Emails.FailNext(new SmtpCommandException(SmtpErrorCode.RecipientNotAccepted, SmtpStatusCode.MailboxUnavailable, "No such user"));
        (await auth.NewClient().PostAsJsonAsync("/api/auth/register", new { name = "Refused", email, password = AuthClient.Password })).EnsureSuccessStatusCode();

        Assert.Empty(fixture.Factory.Emails.SentTo(email));
        await using var scope = fixture.Factory.Services.CreateAsyncScope();
        var message = await scope.ServiceProvider.GetRequiredService<AppDbContext>().OutboxMessages.AsNoTracking()
            .SingleAsync(m => m.Type == EmailOutboxHandler.MessageType && m.FailedAt != null && m.LastError!.Contains("refused") && m.CreatedAt > DateTimeOffset.UtcNow.AddMinutes(-1) && m.Attempts == 1 && m.Payload == null);
        Assert.Contains("(550)", message.LastError);
    }

    [Fact]
    public async Task A_message_is_given_up_after_the_last_attempt()
    {
        var marker = Guid.NewGuid().ToString("N");
        fixture.Factory.Emails.Flush();
        fixture.Factory.OutboxHandler.Script(Enumerable.Range(0, 8).Select(_ => (Exception?)new TimeoutException("slow")).ToArray());
        var id = await AddTestMessage(marker);

        for (var attempt = 1; attempt <= 8; attempt++)
        {
            await MakeDue(id);
            await ProcessOnce();
        }

        var message = await Load(id);
        Assert.Equal(8, message.Attempts);
        Assert.NotNull(message.FailedAt);
        Assert.Null(message.ProcessedAt);
        Assert.Null(message.Payload);
        Assert.Equal(0, Handled(marker));

        await MakeDue(id);
        await ProcessOnce();
        Assert.Equal(8, (await Load(id)).Attempts);
    }

    [Fact]
    public async Task Two_workers_at_once_never_take_the_same_message()
    {
        var marker = Guid.NewGuid().ToString("N");
        await AddTestMessage(marker);

        await Task.WhenAll(ProcessOnce(), ProcessOnce(), ProcessOnce());

        Assert.Equal(1, Handled(marker));
    }

    [Fact]
    public async Task A_message_held_by_a_crashed_worker_is_taken_again_after_its_lease()
    {
        var marker = Guid.NewGuid().ToString("N");
        var id = await AddTestMessage(marker);
        await using (var scope = fixture.Factory.Services.CreateAsyncScope())
        {
            await scope.ServiceProvider.GetRequiredService<AppDbContext>().OutboxMessages.Where(m => m.Id == id)
                .ExecuteUpdateAsync(s => s.SetProperty(m => m.LockedUntil, DateTimeOffset.UtcNow.AddMinutes(4)));
        }

        await ProcessOnce();
        Assert.Equal(0, Handled(marker));

        await using (var scope = fixture.Factory.Services.CreateAsyncScope())
        {
            await scope.ServiceProvider.GetRequiredService<AppDbContext>().OutboxMessages.Where(m => m.Id == id)
                .ExecuteUpdateAsync(s => s.SetProperty(m => m.LockedUntil, DateTimeOffset.UtcNow.AddSeconds(-1)));
        }

        await ProcessOnce();
        Assert.Equal(1, Handled(marker));
    }

    [Fact]
    public async Task A_message_nobody_can_handle_is_given_up()
    {
        Guid id;
        await using (var scope = fixture.Factory.Services.CreateAsyncScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            scope.ServiceProvider.GetRequiredService<OutboxWriter>().Add("no-such-type", new { });
            await db.SaveChangesAsync();
            id = db.ChangeTracker.Entries<OutboxMessage>().Single().Entity.Id;
        }

        await ProcessOnce();

        var message = await Load(id);
        Assert.NotNull(message.FailedAt);
        Assert.Contains("No handler", message.LastError);
    }

    [Fact]
    public async Task Old_finished_messages_are_cleaned_up()
    {
        var marker = Guid.NewGuid().ToString("N");
        var id = await AddTestMessage(marker);
        await ProcessOnce();
        await using var scope = fixture.Factory.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        await db.OutboxMessages.Where(m => m.Id == id).ExecuteUpdateAsync(s => s.SetProperty(m => m.ProcessedAt, DateTimeOffset.UtcNow.AddDays(-8)));
        var fresh = await AddTestMessage(Guid.NewGuid().ToString("N"));
        await ProcessOnce();

        await scope.ServiceProvider.GetRequiredService<OutboxProcessor>().CleanUpAsync(CancellationToken.None);

        Assert.False(await db.OutboxMessages.AnyAsync(m => m.Id == id));
        Assert.True(await db.OutboxMessages.AnyAsync(m => m.Id == fresh));
    }
}
