using System.Buffers.Text;
using System.Security.Cryptography;
using System.Text;

namespace TakaLeaf.App.Common;

/// <summary>Random tokens for links and refresh tokens. Only the hash is ever stored.</summary>
public static class SecureToken
{
    public static string Create() => Base64Url.EncodeToString(RandomNumberGenerator.GetBytes(32));

    public static string Hash(string token) => Convert.ToHexStringLower(SHA256.HashData(Encoding.UTF8.GetBytes(token)));
}
