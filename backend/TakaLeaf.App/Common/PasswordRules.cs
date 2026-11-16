namespace TakaLeaf.App.Common;

public static class PasswordRules
{
    public const int MinLength = 10;
    public const int MaxLength = 128;

    // Passwords long enough to pass the length rule but still among the first ones an attacker tries.
    private static readonly HashSet<string> Common = new(StringComparer.OrdinalIgnoreCase)
    {
        "0123456789", "1234567890", "12345678910", "123456789012", "0987654321", "1111111111",
        "qwertyuiop", "qwerty1234", "qwerty12345", "1q2w3e4r5t", "1qaz2wsx3edc", "1234qwerasdf",
        "password12", "password123", "password1234", "passw0rd123", "iloveyou12", "abcdefghij",
        "abcd123456", "abc1234567", "football123", "baseball123", "welcome123", "letmein123",
        "admin12345", "administrator", "bangladesh", "bangladesh123", "dhaka12345", "takaleaf123",
    };

    /// <summary>Returns a message for the person when the password is not acceptable, or null when it is.</summary>
    public static string? Check(string? password, string email)
    {
        if (string.IsNullOrEmpty(password))
        {
            return "Enter a password.";
        }

        if (password.Length < MinLength)
        {
            return $"Use at least {MinLength} characters.";
        }

        if (password.Length > MaxLength)
        {
            return $"Use at most {MaxLength} characters.";
        }

        if (Common.Contains(password)
            || string.Equals(password, email, StringComparison.OrdinalIgnoreCase)
            || password.Distinct().Count() < 4)
        {
            return "This password is too easy to guess. Choose another.";
        }

        return null;
    }
}
