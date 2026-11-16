using Microsoft.Extensions.Options;
using TakaLeaf.App.Common;
using TakaLeaf.App.Common.Email;

namespace TakaLeaf.App.Tests.Common;

public class EmailTemplateTests
{
    private static readonly EmailTemplates Templates = new(Options.Create(new AppOptions { WebBaseUrl = "https://money.example.test/" }));

    public static TheoryData<string, Dictionary<string, string>> Emails() => new()
    {
        { "verify-email", new() { ["greeting"] = "Hi Monir,", ["actionUrl"] = "https://money.example.test/verify-email?token=abc" } },
        { "already-registered", new() { ["greeting"] = "Hi Monir,", ["actionUrl"] = "https://money.example.test/sign-in", ["resetUrl"] = "https://money.example.test/forgot-password" } },
        { "reset-password", new() { ["greeting"] = "Hi Monir,", ["actionUrl"] = "https://money.example.test/reset-password?token=abc" } },
        { "password-changed", new() { ["greeting"] = "Hi Monir,", ["when"] = "17 Nov 2026, 1:03 AM (Dhaka time)", ["actionUrl"] = "https://money.example.test/forgot-password" } },
    };

    [Theory]
    [MemberData(nameof(Emails))]
    public void Every_template_fills_all_its_values_in_both_bodies(string template, Dictionary<string, string> values)
    {
        var message = Templates.Render(template, "me@example.test", "Subject line", "Preview text", values);

        Assert.DoesNotContain("{{", message.HtmlBody);
        Assert.DoesNotContain("{{", message.TextBody);
        Assert.Contains("<title>Subject line</title>", message.HtmlBody);
        Assert.Contains("Preview text", message.HtmlBody);
        Assert.Contains("https://money.example.test/email/takaleaf-mark.png", message.HtmlBody);
        Assert.Contains("money.example.test", message.HtmlBody);
        Assert.Contains(values["actionUrl"], message.TextBody);
        Assert.Contains("Hi Monir,", message.TextBody);
        Assert.Equal("me@example.test", message.To);
    }

    [Fact]
    public void Values_are_html_encoded_in_the_html_but_not_in_the_text()
    {
        var message = Templates.Render("verify-email", "me@example.test", "S", "P", new Dictionary<string, string>
        {
            ["greeting"] = EmailTemplates.Greeting("<b>Rafi</b> & co"),
            ["actionUrl"] = "https://money.example.test/verify-email?token=a&b=c",
        });

        Assert.Contains("Hi &lt;b&gt;Rafi&lt;/b&gt; &amp; co,", message.HtmlBody);
        Assert.DoesNotContain("<b>Rafi</b>", message.HtmlBody);
        Assert.Contains("href=\"https://money.example.test/verify-email?token=a&amp;b=c\"", message.HtmlBody);
        Assert.Contains("Hi <b>Rafi</b> & co,", message.TextBody);
    }

    [Fact]
    public void A_missing_value_is_a_bug_and_throws()
    {
        var error = Assert.Throws<InvalidOperationException>(() =>
            Templates.Render("reset-password", "me@example.test", "S", "P", new Dictionary<string, string> { ["greeting"] = "Hello," }));

        Assert.Contains("{{actionUrl}}", error.Message);
    }

    [Theory]
    [InlineData("Monir", "Hi Monir,")]
    [InlineData("", "Hello,")]
    public void The_greeting_uses_the_name_when_there_is_one(string name, string expected)
    {
        Assert.Equal(expected, EmailTemplates.Greeting(name));
    }
}
