import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

/**
 * The phone's copy of the account, mirroring the server's synced tables (docs/ARCHITECTURE.md §4).
 * Ids are Guid v7 strings, made on the phone for new rows. Amounts are integer poisha. Times are
 * UTC ISO strings ("2026-11-17T06:00:00.000Z"); local dates are "yyyy-MM-dd". Rows are never
 * removed by the app: deletedAt marks them, as on the server, and every query skips them.
 */

const synced = {
  updatedAt: text("updated_at").notNull(),
  deletedAt: text("deleted_at"),
};

export const WALLET_TYPES = ["Cash", "Bank", "CreditCard", "Mfs", "Lent", "Borrowed", "Loan", "Savings"] as const;
export const TRANSACTION_TYPES = ["Income", "Expense", "Transfer"] as const;
export const CATEGORY_KINDS = ["Income", "Expense"] as const;
export const FREQUENCIES = ["Daily", "Weekly", "Monthly", "Yearly"] as const;
export const LOAN_TYPES = ["Bank", "CardEmi"] as const;
export const LOAN_PARTS = ["Disbursement", "Purchase", "Principal", "Interest", "Fee"] as const;
export const SAVING_KINDS = ["Fdr", "Dps", "Certificate", "PrizeBond", "Insurance"] as const;
export const POLICY_TYPES = ["Life", "Health", "Car", "Other"] as const;
export const SAVING_PARTS = ["Deposit", "Profit", "Tax", "Fee", "Withdrawal", "Premium", "Prize", "Payout"] as const;

/** Small key/value settings: server address, sync cursor, last sync, app lock... */
export const settings = sqliteTable("settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
});

export const wallets = sqliteTable("wallets", {
  id: text("id").primaryKey(),
  type: text("type", { enum: WALLET_TYPES }).notNull(),
  name: text("name").notNull(),
  openingBalance: integer("opening_balance").notNull(),
  creditLimit: integer("credit_limit"),
  personId: text("person_id"),
  icon: text("icon"),
  color: text("color"),
  archived: integer("archived", { mode: "boolean" }).notNull(),
  excludedFromTotal: integer("excluded_from_total", { mode: "boolean" }).notNull(),
  sortOrder: integer("sort_order").notNull(),
  ...synced,
});

export const categories = sqliteTable("categories", {
  id: text("id").primaryKey(),
  kind: text("kind", { enum: CATEGORY_KINDS }).notNull(),
  name: text("name").notNull(),
  parentId: text("parent_id"),
  icon: text("icon"),
  color: text("color"),
  archived: integer("archived", { mode: "boolean" }).notNull(),
  sortOrder: integer("sort_order").notNull(),
  ...synced,
});

export const people = sqliteTable("people", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  note: text("note"),
  ...synced,
});

export const transactions = sqliteTable(
  "transactions",
  {
    id: text("id").primaryKey(),
    type: text("type", { enum: TRANSACTION_TYPES }).notNull(),
    amount: integer("amount").notNull(),
    fromWalletId: text("from_wallet_id"),
    toWalletId: text("to_wallet_id"),
    categoryId: text("category_id"),
    personId: text("person_id"),
    feeOfId: text("fee_of_id"),
    recurringRuleId: text("recurring_rule_id"),
    recurringDate: text("recurring_date"),
    occurredAt: text("occurred_at").notNull(),
    note: text("note"),
    /** Rows of a bank loan or card EMI: which loan, which EMI, and what the row is to it. */
    loanId: text("loan_id"),
    loanEmi: integer("loan_emi"),
    loanPart: text("loan_part", { enum: LOAN_PARTS }),
    /** Rows of a saving or policy: which one, which instalment, profit payment or premium, and what the row is to it. */
    savingId: text("saving_id"),
    savingSeq: integer("saving_seq"),
    savingPart: text("saving_part", { enum: SAVING_PARTS }),
    ...synced,
  },
  (t) => [
    index("transactions_occurred_at").on(t.occurredAt),
    // Covering indexes: wallet balances sum amounts per wallet straight from the index, without
    // reading each row (half the time with five years of data). They also serve wallet filters.
    index("transactions_from_wallet_amount").on(t.fromWalletId, t.deletedAt, t.amount),
    index("transactions_to_wallet_amount").on(t.toWalletId, t.deletedAt, t.amount),
    index("transactions_category").on(t.categoryId),
    index("transactions_fee_of").on(t.feeOfId),
    index("transactions_person").on(t.personId),
    index("transactions_loan").on(t.loanId),
    index("transactions_saving").on(t.savingId),
  ],
);

export const budgets = sqliteTable("budgets", {
  id: text("id").primaryKey(),
  categoryId: text("category_id"),
  amount: integer("amount").notNull(),
  ...synced,
});

export const recurringRules = sqliteTable("recurring_rules", {
  id: text("id").primaryKey(),
  type: text("type", { enum: TRANSACTION_TYPES }).notNull(),
  amount: integer("amount").notNull(),
  fromWalletId: text("from_wallet_id"),
  toWalletId: text("to_wallet_id"),
  categoryId: text("category_id"),
  note: text("note"),
  frequency: text("frequency", { enum: FREQUENCIES }).notNull(),
  interval: integer("interval").notNull(),
  startDate: text("start_date").notNull(),
  endDate: text("end_date"),
  occurrences: integer("occurrences").notNull(),
  nextDate: text("next_date").notNull(),
  autoRecord: integer("auto_record", { mode: "boolean" }).notNull(),
  paused: integer("paused", { mode: "boolean" }).notNull(),
  ...synced,
});

/** A bank loan or card EMI; what is left is the balance of its own Loan wallet (as on the server). */
export const loans = sqliteTable("loans", {
  id: text("id").primaryKey(),
  type: text("type", { enum: LOAN_TYPES }).notNull(),
  name: text("name").notNull(),
  lender: text("lender"),
  walletId: text("wallet_id").notNull(),
  payFromWalletId: text("pay_from_wallet_id").notNull(),
  principal: integer("principal").notNull(),
  /** Hundredths of a percent a year: 950 = 9.5 %. */
  ratePoints: integer("rate_points").notNull(),
  months: integer("months").notNull(),
  emi: integer("emi").notNull(),
  firstDueDate: text("first_due_date").notNull(),
  paidBefore: integer("paid_before").notNull(),
  autoRecord: integer("auto_record", { mode: "boolean" }).notNull(),
  closedOn: text("closed_on"),
  ...synced,
});

/** An FDR, DPS, savings certificate, prize bonds or a policy (as on the server). The money in it is the balance of its Savings wallet. */
export const savings = sqliteTable("savings", {
  id: text("id").primaryKey(),
  kind: text("kind", { enum: SAVING_KINDS }).notNull(),
  name: text("name").notNull(),
  provider: text("provider"),
  walletId: text("wallet_id"),
  payFromWalletId: text("pay_from_wallet_id").notNull(),
  amount: integer("amount").notNull(),
  ratePoints: integer("rate_points").notNull(),
  months: integer("months").notNull(),
  everyMonths: integer("every_months").notNull(),
  startDate: text("start_date").notNull(),
  taxPoints: integer("tax_points").notNull(),
  chargesPerYear: integer("charges_per_year").notNull(),
  maturityAmount: integer("maturity_amount"),
  cover: integer("cover"),
  policy: text("policy", { enum: POLICY_TYPES }),
  policyNumber: text("policy_number"),
  insured: text("insured"),
  nominee: text("nominee"),
  bondNumbers: text("bond_numbers"),
  paidBefore: integer("paid_before").notNull(),
  autoRecord: integer("auto_record", { mode: "boolean" }).notNull(),
  remind: integer("remind", { mode: "boolean" }).notNull(),
  renew: integer("renew", { mode: "boolean" }).notNull(),
  missed: text("missed"),
  seqBase: integer("seq_base").notNull(),
  closedOn: text("closed_on"),
  ...synced,
});

/** Changes waiting to be pushed, oldest first. Written in the same SQLite transaction as the row. */
export const outbox = sqliteTable(
  "outbox",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    mutationId: text("mutation_id").notNull().unique(),
    tableName: text("table_name").notNull(),
    rowId: text("row_id").notNull(),
    payload: text("payload").notNull(),
    createdAt: text("created_at").notNull(),
    attempts: integer("attempts").notNull().default(0),
  },
  (t) => [index("outbox_row").on(t.tableName, t.rowId)],
);

/** Changes the server refused, with its reason, so the person can see what did not save. */
export const syncRejects = sqliteTable("sync_rejects", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  tableName: text("table_name").notNull(),
  rowId: text("row_id").notNull(),
  reason: text("reason").notNull(),
  payload: text("payload").notNull(),
  createdAt: text("created_at").notNull(),
});

export type WalletRow = typeof wallets.$inferSelect;
export type CategoryRow = typeof categories.$inferSelect;
export type PersonRow = typeof people.$inferSelect;
export type TransactionRow = typeof transactions.$inferSelect;
export type BudgetRow = typeof budgets.$inferSelect;
export type RecurringRuleRow = typeof recurringRules.$inferSelect;
export type WalletType = (typeof WALLET_TYPES)[number];
export type TransactionType = (typeof TRANSACTION_TYPES)[number];
export type CategoryKind = (typeof CATEGORY_KINDS)[number];
export type Frequency = (typeof FREQUENCIES)[number];
export type LoanRow = typeof loans.$inferSelect;
export type LoanType = (typeof LOAN_TYPES)[number];
export type LoanPart = (typeof LOAN_PARTS)[number];
export type SavingRow = typeof savings.$inferSelect;
export type SavingKind = (typeof SAVING_KINDS)[number];
export type PolicyType = (typeof POLICY_TYPES)[number];
export type SavingPart = (typeof SAVING_PARTS)[number];

/** The synced tables by their sync name (the server's `table` in push and the keys of a pull page). */
export const SYNCED_TABLES = {
  wallets,
  categories,
  people,
  transactions,
  budgets,
  recurringRules,
  loans,
  savings,
} as const;

export type SyncedTableName = keyof typeof SYNCED_TABLES;
