using System.Collections.Concurrent;
using System.Net;
using System.Text.RegularExpressions;
using Microsoft.Extensions.Options;

namespace TakaLeaf.App.Common.Email;

/// <summary>
/// Builds the branded emails from the files in Common/Email/Templates: <c>_layout.html</c> holds
/// the frame (logo, card, footer) and <c>{name}.html</c> / <c>{name}.txt</c> the message. Values
/// fill <c>{{tokens}}</c>, HTML-encoded in the HTML. A token without a value is a bug and throws.
/// </summary>
public sealed partial class EmailTemplates(IOptions<AppOptions> app)
{
    private static readonly ConcurrentDictionary<string, string> Files = new();

    private string WebBaseUrl => app.Value.WebBaseUrl.TrimEnd('/');

    /// <summary>The link the web app serves for a path such as "/sign-in".</summary>
    public string Link(string pathAndQuery) => WebBaseUrl + pathAndQuery;

    /// <summary>"Hi Monir," or, for an account without a name, "Hello,".</summary>
    public static string Greeting(string name) => string.IsNullOrWhiteSpace(name) ? "Hello," : $"Hi {name},";

    public EmailMessage Render(
        string template,
        string to,
        string subject,
        string preheader,
        IReadOnlyDictionary<string, string> values)
    {
        var all = new Dictionary<string, string>(values)
        {
            ["subject"] = subject,
            ["preheader"] = preheader,
            ["email"] = to,
            ["webUrl"] = WebBaseUrl,
            ["host"] = new Uri(WebBaseUrl).Authority,
            ["logoUrl"] = Link("/email/takaleaf-mark.png"),
        };

        var body = Fill(Read($"{template}.html"), all, html: true);
        // The body is already filled and encoded; splice it in after the layout's own tokens.
        var html = Fill(Read("_layout.html").Replace("{{body}}", "\u0000", StringComparison.Ordinal), all, html: true)
            .Replace("\u0000", body, StringComparison.Ordinal);
        var text = Fill(Read($"{template}.txt"), all, html: false);
        return new EmailMessage(to, subject, text, html);
    }

    private static string Fill(string template, IReadOnlyDictionary<string, string> values, bool html) =>
        Token().Replace(template, match =>
        {
            var key = match.Groups[1].Value;
            if (!values.TryGetValue(key, out var value))
            {
                throw new InvalidOperationException($"The email template needs a value for {{{{{key}}}}}.");
            }

            return html ? WebUtility.HtmlEncode(value) : value;
        });

    private static string Read(string file) => Files.GetOrAdd(file, static name =>
    {
        using var stream = typeof(EmailTemplates).Assembly.GetManifestResourceStream($"EmailTemplates/{name}")
            ?? throw new InvalidOperationException($"The email template {name} is missing.");
        using var reader = new StreamReader(stream);
        return reader.ReadToEnd();
    });

    [GeneratedRegex(@"\{\{(\w+)\}\}")]
    private static partial Regex Token();
}
