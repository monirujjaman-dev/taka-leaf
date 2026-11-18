using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace TakaLeaf.App.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddSavings : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "saving_id",
                table: "transactions",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "saving_part",
                table: "transactions",
                type: "character varying(20)",
                maxLength: 20,
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "saving_seq",
                table: "transactions",
                type: "integer",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "savings",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    kind = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    name = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: false),
                    provider = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: true),
                    wallet_id = table.Column<Guid>(type: "uuid", nullable: true),
                    pay_from_wallet_id = table.Column<Guid>(type: "uuid", nullable: false),
                    amount = table.Column<long>(type: "bigint", nullable: false),
                    rate_points = table.Column<int>(type: "integer", nullable: false),
                    months = table.Column<int>(type: "integer", nullable: false),
                    every_months = table.Column<int>(type: "integer", nullable: false),
                    start_date = table.Column<DateOnly>(type: "date", nullable: false),
                    tax_points = table.Column<int>(type: "integer", nullable: false),
                    charges_per_year = table.Column<long>(type: "bigint", nullable: false),
                    maturity_amount = table.Column<long>(type: "bigint", nullable: true),
                    cover = table.Column<long>(type: "bigint", nullable: true),
                    policy = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: true),
                    policy_number = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: true),
                    insured = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: true),
                    nominee = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: true),
                    bond_numbers = table.Column<string>(type: "character varying(8000)", maxLength: 8000, nullable: true),
                    paid_before = table.Column<int>(type: "integer", nullable: false),
                    auto_record = table.Column<bool>(type: "boolean", nullable: false),
                    remind = table.Column<bool>(type: "boolean", nullable: false),
                    renew = table.Column<bool>(type: "boolean", nullable: false),
                    missed = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true),
                    seq_base = table.Column<int>(type: "integer", nullable: false),
                    closed_on = table.Column<DateOnly>(type: "date", nullable: true),
                    user_id = table.Column<Guid>(type: "uuid", nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    updated_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    deleted_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    server_seq = table.Column<long>(type: "bigint", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_savings", x => x.id);
                    table.CheckConstraint("ck_savings_amount_positive", "amount > 0");
                    table.CheckConstraint("ck_savings_months", "months BETWEEN 0 AND 600");
                    table.CheckConstraint("ck_savings_rate", "rate_points BETWEEN 0 AND 10000");
                    table.CheckConstraint("ck_savings_tax", "tax_points BETWEEN 0 AND 10000");
                    table.ForeignKey(
                        name: "fk_savings_users_user_id",
                        column: x => x.user_id,
                        principalTable: "users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "fk_savings_wallets_pay_from_wallet_id",
                        column: x => x.pay_from_wallet_id,
                        principalTable: "wallets",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "fk_savings_wallets_wallet_id",
                        column: x => x.wallet_id,
                        principalTable: "wallets",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "ix_transactions_saving_id_saving_seq_saving_part",
                table: "transactions",
                columns: new[] { "saving_id", "saving_seq", "saving_part" },
                unique: true,
                filter: "saving_seq IS NOT NULL AND deleted_at IS NULL");

            migrationBuilder.CreateIndex(
                name: "ix_savings_pay_from_wallet_id",
                table: "savings",
                column: "pay_from_wallet_id");

            migrationBuilder.CreateIndex(
                name: "ix_savings_user_id_server_seq",
                table: "savings",
                columns: new[] { "user_id", "server_seq" });

            migrationBuilder.CreateIndex(
                name: "ix_savings_wallet_id",
                table: "savings",
                column: "wallet_id");

            migrationBuilder.AddForeignKey(
                name: "fk_transactions_savings_saving_id",
                table: "transactions",
                column: "saving_id",
                principalTable: "savings",
                principalColumn: "id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "fk_transactions_savings_saving_id",
                table: "transactions");

            migrationBuilder.DropTable(
                name: "savings");

            migrationBuilder.DropIndex(
                name: "ix_transactions_saving_id_saving_seq_saving_part",
                table: "transactions");

            migrationBuilder.DropColumn(
                name: "saving_id",
                table: "transactions");

            migrationBuilder.DropColumn(
                name: "saving_part",
                table: "transactions");

            migrationBuilder.DropColumn(
                name: "saving_seq",
                table: "transactions");
        }
    }
}
