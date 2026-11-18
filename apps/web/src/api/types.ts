/** Shapes the backend returns. Every amount is a whole number of poisha. */

export interface AuthUser {
  id: string;
  email: string;
  /** "" for accounts made before names were asked for. */
  name: string;
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

export type WalletType = "Cash" | "Bank" | "CreditCard" | "Mfs" | "Lent" | "Borrowed" | "Loan" | "Savings";

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
  /** Set on rows that belong to a bank loan or card EMI; they change only from Loans. */
  loanId?: string | null;
  /** Set on rows that belong to a saving or policy; they change only from Savings. */
  savingId?: string | null;
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

export interface SessionInfo {
  id: string;
  device: string;
  signedInAt: string;
  lastUsedAt: string;
  current: boolean;
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

// Bank loans and credit card EMIs (Features/Loans). Named BankLoan: Loan is a person's loan above.

export type BankLoanType = "Bank" | "CardEmi";

export interface NextEmi {
  number: number;
  dueDate: string;
  principal: number;
  interest: number;
  total: number;
  overdue: boolean;
}

export interface BankLoan {
  id: string;
  type: BankLoanType;
  name: string;
  lender: string | null;
  walletId: string;
  payFromWalletId: string;
  payFromWalletName: string | null;
  principal: number;
  /** Hundredths of a percent a year: 950 = 9.5 %. */
  ratePoints: number;
  months: number;
  emi: number;
  firstDueDate: string;
  paidBefore: number;
  autoRecord: boolean;
  closedOn: string | null;
  outstanding: number;
  paid: number;
  left: number;
  closed: boolean;
  next: NextEmi | null;
  endsOn: string | null;
  interestPaid: number;
  interestLeft: number;
}

export interface DueEmi {
  loanId: string;
  name: string;
  type: BankLoanType;
  number: number;
  dueDate: string;
  total: number;
  payFromWalletName: string | null;
  overdue: boolean;
}

export interface BankLoanList {
  summary: { outstanding: number; bank: number; cardEmi: number; upcoming: DueEmi[] };
  loans: BankLoan[];
}

export type ScheduleStatus = "Paid" | "PaidBefore" | "Due" | "Upcoming";

export interface ScheduleRow {
  number: number;
  dueDate: string;
  status: ScheduleStatus;
  principal: number;
  interest: number;
  total: number;
  balanceAfter: number | null;
  paidAt: string | null;
  paidFrom: string | null;
}

export interface CardLimit {
  cardId: string;
  cardName: string;
  limit: number | null;
  spent: number;
  held: number;
  available: number | null;
}

export interface BankLoanDetail {
  loan: BankLoan;
  schedule: ScheduleRow[];
  activity: Transaction[];
  card: CardLimit | null;
}

export interface AddBankLoanInput {
  type: BankLoanType;
  name: string;
  lender: string | null;
  payFromWalletId: string;
  principal: number;
  ratePoints: number;
  months: number;
  emi: number | null;
  firstDueDate: string;
  paidBefore: number;
  autoRecord: boolean;
  receivedInWalletId: string | null;
  processingFee: number | null;
  purchaseCategoryId: string | null;
}

export interface UpdateBankLoanInput {
  name: string;
  lender: string | null;
  payFromWalletId: string;
  ratePoints: number;
  emi: number;
  autoRecord: boolean;
}

// Savings and insurance

export type SavingKind = "Fdr" | "Dps" | "Certificate" | "PrizeBond" | "Insurance";
export type PolicyType = "Life" | "Health" | "Car" | "Other";
/** Auto: recorded on the day. Record: the user records it. Pay: a premium. Close: matured. Draw: a prize bond draw. */
export type SavingAction = "Auto" | "Record" | "Pay" | "Close" | "Draw";

export interface SavingNext {
  number: number | null;
  date: string;
  label: string;
  amount: number | null;
  action: SavingAction;
  overdue: boolean;
}

export interface Saving {
  id: string;
  kind: SavingKind;
  name: string;
  provider: string | null;
  walletId: string | null;
  payFromWalletId: string;
  payFromWalletName: string | null;
  amount: number;
  ratePoints: number;
  months: number;
  everyMonths: number;
  startDate: string;
  taxPoints: number;
  chargesPerYear: number;
  maturityAmount: number | null;
  cover: number | null;
  policy: PolicyType | null;
  policyNumber: string | null;
  insured: string | null;
  nominee: string | null;
  bondNumbers: string[];
  paidBefore: number;
  autoRecord: boolean;
  remind: boolean;
  renew: boolean;
  missed: number[];
  closedOn: string | null;
  balance: number;
  closed: boolean;
  maturesOn: string | null;
  done: number;
  total: number | null;
  next: SavingNext | null;
  profitReceived: number;
  taxTaken: number;
  paidSoFar: number;
  estimate: number | null;
  daysDone: number;
  daysTotal: number;
  bondCount: number;
  bondsInDraw: number;
  nextDraw: string | null;
  graceEnds: string | null;
}

export interface ComingUp {
  savingId: string;
  kind: SavingKind;
  policy: PolicyType | null;
  name: string;
  date: string;
  label: string;
  detail: string | null;
  amount: number | null;
  action: SavingAction;
  overdue: boolean;
}

export interface TaxYear {
  from: string;
  to: string;
  invested: number;
  profit: number;
  tax: number;
}

export interface SavingList {
  summary: {
    saved: number;
    deposits: number;
    certificates: number;
    prizeBonds: number;
    cover: number;
    policies: number;
    taxYear: TaxYear;
    nextToMature: string | null;
    nextToMatureOn: string | null;
  };
  comingUp: ComingUp[];
  savings: Saving[];
}

export type SavingScheduleStatus = "Paid" | "PaidBefore" | "Missed" | "Due" | "Upcoming";

export interface SavingScheduleRow {
  number: number;
  date: string;
  status: SavingScheduleStatus;
  amount: number;
  tax: number;
  paidAt: string | null;
  paidFrom: string | null;
}

export interface SavingDetail {
  saving: Saving;
  schedule: SavingScheduleRow[];
  activity: Transaction[];
}

export interface AddSavingInput {
  kind: SavingKind;
  name: string;
  provider: string | null;
  payFromWalletId: string;
  fromWalletId: string | null;
  alreadyHeld: boolean;
  amount: number | null;
  bondCount: number | null;
  ratePoints: number;
  months: number;
  everyMonths: number;
  startDate: string;
  taxPoints: number | null;
  chargesPerYear: number | null;
  maturityAmount: number | null;
  cover: number | null;
  policy: PolicyType | null;
  policyNumber: string | null;
  insured: string | null;
  nominee: string | null;
  bondNumbers: string[] | null;
  paidBefore: number;
  autoRecord: boolean;
  remind: boolean;
  renew: boolean;
}

export interface UpdateSavingInput {
  name: string;
  provider: string | null;
  payFromWalletId: string;
  amount: number | null;
  ratePoints: number | null;
  taxPoints: number | null;
  chargesPerYear: number | null;
  maturityAmount: number | null;
  cover: number | null;
  policy: PolicyType | null;
  policyNumber: string | null;
  insured: string | null;
  nominee: string | null;
  bondNumbers: string[] | null;
  autoRecord: boolean | null;
  remind: boolean | null;
  renew: boolean | null;
}
