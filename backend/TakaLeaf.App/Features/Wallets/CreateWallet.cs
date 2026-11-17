using System.Security.Claims;
using Microsoft.EntityFrameworkCore;
using TakaLeaf.App.Common;
using TakaLeaf.App.Data;
using TakaLeaf.App.Data.Entities;

namespace TakaLeaf.App.Features.Wallets;

/// <summary>POST /api/wallets - adds a cash, bank, credit card or MFS wallet.</summary>
public static class CreateWallet
{
    /// <param name="OpeningBalance">In poisha. A credit card that already owes money starts negative.</param>
    /// <param name="CreditLimit">In poisha. Credit cards only.</param>
    public sealed record CreateWalletRequest(
        WalletType? Type,
        string? Name,
        long? OpeningBalance,
        long? CreditLimit,
        string? Icon,
        string? Color,
        bool? ExcludedFromTotal);

    public static RouteGroupBuilder MapCreateWallet(this RouteGroupBuilder group)
    {
        group.MapPost("/", Handle).WithName("CreateWallet");
        return group;
    }

    private static async Task<IResult> Handle(
        CreateWalletRequest request,
        ClaimsPrincipal principal,
        AppDbContext db,
        CancellationToken cancellationToken)
    {
        if (request.Type is not { } type || !Enum.IsDefined(type) || WalletRules.IsPersonWallet(type) || type == WalletType.Loan)
        {
            return ValidationErrors.For("type", "Choose Cash, Bank, CreditCard or Mfs.");
        }

        var userId = principal.UserId();
        var name = Text.Clean(request.Name);
        var icon = Text.Clean(request.Icon);
        var color = Text.Clean(request.Color);
        if (await WalletRules.CheckFieldsAsync(db, userId, null, type, name, request.CreditLimit, icon, color, cancellationToken) is { } problem)
        {
            return problem;
        }

        var lastOrder = await db.Wallets.Where(w => w.UserId == userId).MaxAsync(w => (int?)w.SortOrder, cancellationToken);
        var wallet = new Wallet
        {
            UserId = userId,
            Type = type,
            Name = name!,
            OpeningBalance = request.OpeningBalance ?? 0,
            CreditLimit = request.CreditLimit,
            Icon = icon,
            Color = color,
            ExcludedFromTotal = request.ExcludedFromTotal ?? false,
            SortOrder = (lastOrder ?? -1) + 1,
        };
        db.Wallets.Add(wallet);
        await db.SaveChangesAsync(cancellationToken);

        return Results.Created($"/api/wallets/{wallet.Id}", WalletRules.ToDto(wallet, 0));
    }
}
