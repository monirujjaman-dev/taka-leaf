using TakaLeaf.App.Common.Outbox;

namespace TakaLeaf.App.Tests.Common;

public class OutboxRetryPolicyTests
{
    private static readonly OutboxOptions Defaults = new();

    [Theory]
    [InlineData(1, 30)]
    [InlineData(2, 60)]
    [InlineData(3, 120)]
    [InlineData(7, 1920)]
    [InlineData(8, 3600)]
    [InlineData(30, 3600)]
    public void The_wait_doubles_after_each_failure_up_to_an_hour(int failures, int seconds)
    {
        Assert.Equal(TimeSpan.FromSeconds(seconds), OutboxRetryPolicy.DelayAfter(failures, Defaults, jitter: 1.0));
    }

    [Fact]
    public void Jitter_spreads_the_wait_by_up_to_a_fifth_either_way()
    {
        Assert.Equal(TimeSpan.FromSeconds(24), OutboxRetryPolicy.DelayAfter(1, Defaults, jitter: 0.5));
        Assert.Equal(TimeSpan.FromSeconds(36), OutboxRetryPolicy.DelayAfter(1, Defaults, jitter: 9));
        for (var i = 0; i < 1000; i++)
        {
            Assert.InRange(OutboxRetryPolicy.RandomJitter(), 0.8, 1.2);
        }
    }

    [Theory]
    [InlineData(7, false)]
    [InlineData(8, true)]
    [InlineData(9, true)]
    public void It_gives_up_after_the_last_attempt(int attempts, bool giveUp)
    {
        Assert.Equal(giveUp, OutboxRetryPolicy.ShouldGiveUp(attempts, Defaults));
    }
}
