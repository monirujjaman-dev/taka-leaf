using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace TakaLeaf.App.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddLoans : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "loan_emi",
                table: "transactions",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "loan_id",
                table: "transactions",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "loan_part",
                table: "transactions",
                type: "character varying(20)",
                maxLength: 20,
                nullable: true);

            migrationBuilder.CreateTable(
                name: "loans",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    type = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    name = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: false),
                    lender = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: true),
                    wallet_id = table.Column<Guid>(type: "uuid", nullable: false),
                    pay_from_wallet_id = table.Column<Guid>(type: "uuid", nullable: false),
                    principal = table.Column<long>(type: "bigint", nullable: false),
                    rate_points = table.Column<int>(type: "integer", nullable: false),
                    months = table.Column<int>(type: "integer", nullable: false),
                    emi = table.Column<long>(type: "bigint", nullable: false),
                    first_due_date = table.Column<DateOnly>(type: "date", nullable: false),
                    paid_before = table.Column<int>(type: "integer", nullable: false),
                    auto_record = table.Column<bool>(type: "boolean", nullable: false),
                    closed_on = table.Column<DateOnly>(type: "date", nullable: true),
                    user_id = table.Column<Guid>(type: "uuid", nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    updated_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    deleted_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    server_seq = table.Column<long>(type: "bigint", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_loans", x => x.id);
                    table.CheckConstraint("ck_loans_emi_positive", "emi > 0");
                    table.CheckConstraint("ck_loans_months", "months BETWEEN 1 AND 600");
                    table.CheckConstraint("ck_loans_principal_positive", "principal > 0");
                    table.CheckConstraint("ck_loans_rate", "rate_points BETWEEN 0 AND 10000");
                    table.ForeignKey(
                        name: "fk_loans_users_user_id",
                        column: x => x.user_id,
                        principalTable: "users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "fk_loans_wallets_pay_from_wallet_id",
                        column: x => x.pay_from_wallet_id,
                        principalTable: "wallets",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "fk_loans_wallets_wallet_id",
                        column: x => x.wallet_id,
                        principalTable: "wallets",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "ix_transactions_loan_id_loan_emi_loan_part",
                table: "transactions",
                columns: new[] { "loan_id", "loan_emi", "loan_part" },
                unique: true,
                filter: "loan_emi IS NOT NULL AND deleted_at IS NULL");

            migrationBuilder.CreateIndex(
                name: "ix_loans_pay_from_wallet_id",
                table: "loans",
                column: "pay_from_wallet_id");

            migrationBuilder.CreateIndex(
                name: "ix_loans_user_id_server_seq",
                table: "loans",
                columns: new[] { "user_id", "server_seq" });

            migrationBuilder.CreateIndex(
                name: "ix_loans_wallet_id",
                table: "loans",
                column: "wallet_id");

            migrationBuilder.AddForeignKey(
                name: "fk_transactions_loans_loan_id",
                table: "transactions",
                column: "loan_id",
                principalTable: "loans",
                principalColumn: "id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "fk_transactions_loans_loan_id",
                table: "transactions");

            migrationBuilder.DropTable(
                name: "loans");

            migrationBuilder.DropIndex(
                name: "ix_transactions_loan_id_loan_emi_loan_part",
                table: "transactions");

            migrationBuilder.DropColumn(
                name: "loan_emi",
                table: "transactions");

            migrationBuilder.DropColumn(
                name: "loan_id",
                table: "transactions");

            migrationBuilder.DropColumn(
                name: "loan_part",
                table: "transactions");
        }
    }
}
