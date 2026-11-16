using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace TakaLeaf.App.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddBudgetsAndRecurring : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateOnly>(
                name: "recurring_date",
                table: "transactions",
                type: "date",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "recurring_rule_id",
                table: "transactions",
                type: "uuid",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "budgets",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    category_id = table.Column<Guid>(type: "uuid", nullable: true),
                    amount = table.Column<long>(type: "bigint", nullable: false),
                    user_id = table.Column<Guid>(type: "uuid", nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    updated_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    deleted_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    server_seq = table.Column<long>(type: "bigint", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_budgets", x => x.id);
                    table.CheckConstraint("ck_budgets_amount_positive", "amount > 0");
                    table.ForeignKey(
                        name: "fk_budgets_categories_category_id",
                        column: x => x.category_id,
                        principalTable: "categories",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "fk_budgets_users_user_id",
                        column: x => x.user_id,
                        principalTable: "users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "recurring_rules",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    type = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    amount = table.Column<long>(type: "bigint", nullable: false),
                    from_wallet_id = table.Column<Guid>(type: "uuid", nullable: true),
                    to_wallet_id = table.Column<Guid>(type: "uuid", nullable: true),
                    category_id = table.Column<Guid>(type: "uuid", nullable: true),
                    note = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    frequency = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    interval = table.Column<int>(type: "integer", nullable: false),
                    start_date = table.Column<DateOnly>(type: "date", nullable: false),
                    end_date = table.Column<DateOnly>(type: "date", nullable: true),
                    occurrences = table.Column<int>(type: "integer", nullable: false),
                    next_date = table.Column<DateOnly>(type: "date", nullable: false),
                    auto_record = table.Column<bool>(type: "boolean", nullable: false),
                    paused = table.Column<bool>(type: "boolean", nullable: false),
                    user_id = table.Column<Guid>(type: "uuid", nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    updated_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    deleted_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    server_seq = table.Column<long>(type: "bigint", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_recurring_rules", x => x.id);
                    table.CheckConstraint("ck_recurring_rules_amount_positive", "amount > 0");
                    table.CheckConstraint("ck_recurring_rules_interval", "interval BETWEEN 1 AND 366");
                    table.ForeignKey(
                        name: "fk_recurring_rules_categories_category_id",
                        column: x => x.category_id,
                        principalTable: "categories",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "fk_recurring_rules_users_user_id",
                        column: x => x.user_id,
                        principalTable: "users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "fk_recurring_rules_wallets_from_wallet_id",
                        column: x => x.from_wallet_id,
                        principalTable: "wallets",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "fk_recurring_rules_wallets_to_wallet_id",
                        column: x => x.to_wallet_id,
                        principalTable: "wallets",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "ix_transactions_recurring_rule_id_recurring_date",
                table: "transactions",
                columns: new[] { "recurring_rule_id", "recurring_date" },
                unique: true,
                filter: "recurring_rule_id IS NOT NULL AND deleted_at IS NULL");

            migrationBuilder.CreateIndex(
                name: "ix_budgets_category_id",
                table: "budgets",
                column: "category_id");

            migrationBuilder.CreateIndex(
                name: "ix_budgets_user_id_category_id",
                table: "budgets",
                columns: new[] { "user_id", "category_id" },
                unique: true,
                filter: "deleted_at IS NULL")
                .Annotation("Npgsql:NullsDistinct", false);

            migrationBuilder.CreateIndex(
                name: "ix_budgets_user_id_server_seq",
                table: "budgets",
                columns: new[] { "user_id", "server_seq" });

            migrationBuilder.CreateIndex(
                name: "ix_recurring_rules_category_id",
                table: "recurring_rules",
                column: "category_id");

            migrationBuilder.CreateIndex(
                name: "ix_recurring_rules_from_wallet_id",
                table: "recurring_rules",
                column: "from_wallet_id");

            migrationBuilder.CreateIndex(
                name: "ix_recurring_rules_next_date_auto_record",
                table: "recurring_rules",
                columns: new[] { "next_date", "auto_record" });

            migrationBuilder.CreateIndex(
                name: "ix_recurring_rules_to_wallet_id",
                table: "recurring_rules",
                column: "to_wallet_id");

            migrationBuilder.CreateIndex(
                name: "ix_recurring_rules_user_id_server_seq",
                table: "recurring_rules",
                columns: new[] { "user_id", "server_seq" });

            migrationBuilder.AddForeignKey(
                name: "fk_transactions_recurring_rules_recurring_rule_id",
                table: "transactions",
                column: "recurring_rule_id",
                principalTable: "recurring_rules",
                principalColumn: "id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "fk_transactions_recurring_rules_recurring_rule_id",
                table: "transactions");

            migrationBuilder.DropTable(
                name: "budgets");

            migrationBuilder.DropTable(
                name: "recurring_rules");

            migrationBuilder.DropIndex(
                name: "ix_transactions_recurring_rule_id_recurring_date",
                table: "transactions");

            migrationBuilder.DropColumn(
                name: "recurring_date",
                table: "transactions");

            migrationBuilder.DropColumn(
                name: "recurring_rule_id",
                table: "transactions");
        }
    }
}
