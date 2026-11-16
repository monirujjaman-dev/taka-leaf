/** Shapes the backend returns. Every amount is a whole number of poisha. */

export interface AuthUser {
  id: string;
  email: string;
}

export interface AuthResponse {
  accessToken: string;
  accessTokenExpiresAt: string;
  refreshToken: string | null;
  user: AuthUser;
}

export interface MessageResponse {
  message: string;
}

export type WalletType = "Cash" | "Bank" | "CreditCard" | "Mfs" | "Lent" | "Borrowed";

export interface Wallet {
  id: string;
  type: WalletType;
  name: string;
  openingBalance: number;
  balance: number;
  creditLimit: number | null;
  availableCredit: number | null;
  personId: string | null;
  icon: string | null;
  color: string | null;
  archived: boolean;
  excludedFromTotal: boolean;
  sortOrder: number;
}

export interface WalletList {
  wallets: Wallet[];
  totals: { assets: number; liabilities: number; net: number };
}

export type CategoryKind = "Income" | "Expense";

export interface Category {
  id: string;
  kind: CategoryKind;
  name: string;
  parentId: string | null;
  icon: string | null;
  color: string | null;
  archived: boolean;
  children: Category[];
}

export type TransactionType = "Income" | "Expense" | "Transfer";

export interface Transaction {
  id: string;
  type: TransactionType;
  amount: number;
  fromWalletId: string | null;
  fromWalletName: string | null;
  toWalletId: string | null;
  toWalletName: string | null;
  categoryId: string | null;
  categoryName: string | null;
  personId: string | null;
  feeOfId: string | null;
  fee: number | null;
  occurredAt: string;
  note: string | null;
  recurringRuleId?: string | null;
}

export interface TransactionInput {
  type: TransactionType;
  amount: number;
  fromWalletId?: string | null;
  toWalletId?: string | null;
  categoryId?: string | null;
  occurredAt?: string;
  note?: string | null;
  fee?: number | null;
}

export interface TransactionPage {
  items: Transaction[];
  totalCount: number;
  page: number;
  pageSize: number;
  totals: { income: number; expense: number };
}

export interface CategorySpending {
  categoryId: string | null;
  name: string;
  amount: number;
}

export interface Dashboard {
  month: string;
  netBalance: number;
  assets: number;
  liabilities: number;
  income: number;
  expense: number;
  owedToMe: number;
  iOwe: number;
  spendingByCategory: CategorySpending[];
  recent: Transaction[];
}

export type LoanKind = "Lend" | "GotBack" | "Borrow" | "PaidBack";

export interface Person {
  id: string;
  name: string;
  note: string | null;
  owesMe: number;
  iOwe: number;
  net: number;
  lastLoanAt: string | null;
}

export interface Loan {
  id: string;
  kind: LoanKind;
  amount: number;
  walletId: string;
  walletName: string | null;
  occurredAt: string;
  note: string | null;
}

export interface PeopleList {
  people: Person[];
  owedToMe: number;
  iOwe: number;
}

export interface PersonDetail {
  person: Person;
  loans: Loan[];
}

export interface LoanInput {
  kind: LoanKind;
  amount: number;
  walletId: string;
  occurredAt?: string;
  note?: string | null;
}

export type BudgetStatus = "OnTrack" | "Near" | "Over";

export interface Budget {
  id: string;
  categoryId: string | null;
  name: string;
  amount: number;
  spent: number;
  remaining: number;
  percent: number;
  status: BudgetStatus;
}

export interface BudgetList {
  month: string;
  budgets: Budget[];
}

export type Frequency = "Daily" | "Weekly" | "Monthly" | "Yearly";

export interface RecurringRule {
  id: string;
  type: TransactionType;
  amount: number;
  fromWalletId: string | null;
  fromWalletName: string | null;
  toWalletId: string | null;
  toWalletName: string | null;
  categoryId: string | null;
  categoryName: string | null;
  note: string | null;
  frequency: Frequency;
  interval: number;
  startDate: string;
  endDate: string | null;
  /** Null once the rule has passed its last date. */
  nextDate: string | null;
  dueCount: number;
  autoRecord: boolean;
  paused: boolean;
}

export interface RecurringInput {
  type: TransactionType;
  amount: number;
  fromWalletId: string | null;
  toWalletId: string | null;
  categoryId: string | null;
  note: string | null;
  frequency: Frequency;
  interval: number;
  startDate: string;
  endDate: string | null;
  autoRecord: boolean;
}

export type ReportPeriod = "Month" | "Year";

export interface CategoryTotal {
  categoryId: string | null;
  name: string;
  amount: number;
  percent: number;
  children: { categoryId: string | null; name: string; amount: number }[];
}

export interface Report {
  period: ReportPeriod;
  label: string;
  from: string;
  to: string;
  income: number;
  expense: number;
  saved: number;
  savedPercent: number | null;
  spending: CategoryTotal[];
  earning: CategoryTotal[];
  trend: { month: string; income: number; expense: number }[];
}
