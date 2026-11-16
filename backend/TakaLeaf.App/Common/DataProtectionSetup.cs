using System.Security.Cryptography;
using System.Security.Cryptography.X509Certificates;
using Microsoft.AspNetCore.DataProtection;
using Serilog;

namespace TakaLeaf.App.Common;

public sealed class DataProtectionSettings
{
    public const string Section = "DataProtection";

    /// <summary>Keeps keys apart from other apps that share the same key folder.</summary>
    public string ApplicationName { get; set; } = "TakaLeaf";

    /// <summary>
    /// Folder the key ring is written to; a relative path starts at the app's content root.
    /// Empty: the framework's default (lost with the container).
    /// </summary>
    public string? KeysPath { get; set; }

    /// <summary>
    /// PFX file whose certificate encrypts the keys at rest; a relative path starts at the app's
    /// content root. Empty: keys are stored unencrypted.
    /// </summary>
    public string? CertificatePath { get; set; }

    public string? CertificatePassword { get; set; }

    /// <summary>Older PFX files that can still decrypt keys written before a certificate change.</summary>
    public string[] PreviousCertificatePaths { get; set; } = [];

    public int KeyLifetimeDays { get; set; } = 90;
}

public static class DataProtectionSetup
{
    /// <summary>
    /// Data protection keys survive restarts and deploys when <c>DataProtection:KeysPath</c> is a
    /// mounted volume, and are encrypted with the certificate in <c>DataProtection:CertificatePath</c>.
    /// A missing or unreadable certificate stops start-up, except in development where a missing
    /// file only logs a warning (fresh clones and CI have no certificate).
    /// </summary>
    public static WebApplicationBuilder AddTakaLeafDataProtection(this WebApplicationBuilder builder)
    {
        var settings = builder.Configuration.GetSection(DataProtectionSettings.Section).Get<DataProtectionSettings>()
                       ?? new DataProtectionSettings();
        var root = builder.Environment.ContentRootPath;

        if (settings.KeyLifetimeDays < 7)
        {
            throw new InvalidOperationException("DataProtection:KeyLifetimeDays must be at least 7.");
        }

        var dataProtection = builder.Services
            .AddDataProtection()
            .SetApplicationName(settings.ApplicationName)
            .SetDefaultKeyLifetime(TimeSpan.FromDays(settings.KeyLifetimeDays));

        if (!string.IsNullOrWhiteSpace(settings.KeysPath))
        {
            dataProtection.PersistKeysToFileSystem(Directory.CreateDirectory(Path.GetFullPath(settings.KeysPath, root)));
        }

        if (string.IsNullOrWhiteSpace(settings.CertificatePath))
        {
            return builder;
        }

        var certificatePath = Path.GetFullPath(settings.CertificatePath, root);

        if (!File.Exists(certificatePath) && builder.Environment.IsDevelopment())
        {
            Log.Warning(
                "DataProtection certificate {CertificatePath} not found; keys are stored unencrypted. See README to make one.",
                certificatePath);
            return builder;
        }

        var current = LoadCertificate(certificatePath, settings.CertificatePassword);
        var previous = settings.PreviousCertificatePaths
            .Where(path => !string.IsNullOrWhiteSpace(path))
            .Select(path => LoadCertificate(Path.GetFullPath(path, root), settings.CertificatePassword));

        dataProtection
            .ProtectKeysWithCertificate(current)
            .UnprotectKeysWithAnyCertificate([current, .. previous]);

        return builder;
    }

    private static X509Certificate2 LoadCertificate(string path, string? password)
    {
        if (!File.Exists(path))
        {
            throw new InvalidOperationException($"DataProtection certificate not found at '{path}'.");
        }

        X509Certificate2 certificate;

        try
        {
            certificate = X509CertificateLoader.LoadPkcs12FromFile(path, password, X509KeyStorageFlags.EphemeralKeySet);
        }
        catch (CryptographicException exception)
        {
            throw new InvalidOperationException(
                $"DataProtection certificate '{path}' could not be opened (wrong password?): {exception.Message}",
                exception);
        }

        if (!certificate.HasPrivateKey)
        {
            certificate.Dispose();
            throw new InvalidOperationException($"DataProtection certificate '{path}' has no private key.");
        }

        return certificate;
    }
}
