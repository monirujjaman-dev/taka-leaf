import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "./client";
import type {
  SessionInfo,
  BudgetList,
  Report,
  ReportPeriod,
  RecurringInput,
  RecurringRule,
  Category,
  LoanInput,
  PeopleList,
  Person,
  PersonDetail,
  CategoryKind,
  Dashboard,
  Transaction,
  TransactionInput,
  TransactionPage,
  Wallet,
  WalletList,
  WalletType,
} from "./types";

/** Anything that changes money touches these, so they are refreshed together after a change. */
const MONEY_KEYS = [["dashboard"], ["wallets"], ["transactions"], ["people"], ["budgets"], ["recurring"], ["reports"]] as const;

function useInvalidateMoney() {
  const client = useQueryClient();
  return () => Promise.all(MONEY_KEYS.map((queryKey) => client.invalidateQueries({ queryKey })));
}

export function useDashboard(month: string) {
  return useQuery({
    queryKey: ["dashboard", month],
    queryFn: ({ signal }) => api<Dashboard>(`/dashboard?month=${month}`, { signal }),
  });
}

export function useWallets() {
  return useQuery({ queryKey: ["wallets"], queryFn: ({ signal }) => api<WalletList>("/wallets", { signal }) });
}

export function useCategories(kind?: CategoryKind, includeArchived = false) {
  const params = new URLSearchParams();
  if (kind) params.set("kind", kind);
  if (includeArchived) params.set("includeArchived", "true");
  const query = params.toString();
  return useQuery({
    queryKey: ["categories", kind ?? "all", includeArchived],
    queryFn: ({ signal }) => api<Category[]>(`/categories${query ? `?${query}` : ""}`, { signal }),
    staleTime: 60_000,
  });
}

export interface TransactionFilters {
  from?: string;
  to?: string;
  walletId?: string;
  categoryId?: string;
  uncategorised?: string;
  type?: string;
  search?: string;
  page?: number;
  pageSize?: number;
}

export function useTransactions(filters: TransactionFilters) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value !== undefined && value !== "") params.set(key, String(value));
  }
  const query = params.toString();
  return useQuery({
    queryKey: ["transactions", "list", query],
    queryFn: ({ signal }) => api<TransactionPage>(`/transactions${query ? `?${query}` : ""}`, { signal }),
    placeholderData: (previous) => previous,
  });
}

export function useTransaction(id: string | null) {
  return useQuery({
    queryKey: ["transactions", "one", id],
    queryFn: ({ signal }) => api<Transaction>(`/transactions/${id}`, { signal }),
    enabled: id !== null,
  });
}

export function useSaveTransaction() {
  const invalidate = useInvalidateMoney();
  return useMutation({
    mutationFn: ({ id, input }: { id: string | null; input: TransactionInput }) =>
      id
        ? api<Transaction>(`/transactions/${id}`, { method: "PUT", body: input })
        : api<Transaction>("/transactions", { method: "POST", body: input }),
    onSuccess: invalidate,
  });
}

export function useDeleteTransaction() {
  const invalidate = useInvalidateMoney();
  return useMutation({
    mutationFn: (id: string) => api<void>(`/transactions/${id}`, { method: "DELETE" }),
    onSuccess: invalidate,
  });
}

export interface WalletInput {
  type?: WalletType;
  name: string;
  openingBalance: number;
  creditLimit: number | null;
  excludedFromTotal: boolean;
}

export function useSaveWallet() {
  const invalidate = useInvalidateMoney();
  return useMutation({
    mutationFn: ({ id, input }: { id: string | null; input: WalletInput }) =>
      id
        ? api<Wallet>(`/wallets/${id}`, { method: "PUT", body: input })
        : api<Wallet>("/wallets", { method: "POST", body: input }),
    onSuccess: invalidate,
  });
}

export function useWalletAction() {
  const invalidate = useInvalidateMoney();
  return useMutation({
    mutationFn: ({ id, action }: { id: string; action: "archive" | "unarchive" | "delete" }) =>
      action === "delete"
        ? api<void>(`/wallets/${id}`, { method: "DELETE" })
        : api<void>(`/wallets/${id}/${action}`, { method: "POST" }),
    onSuccess: invalidate,
  });
}

export function useSaveCategory() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ id, kind, name, parentId }: { id: string | null; kind: CategoryKind; name: string; parentId: string | null }) =>
      id
        ? api<Category>(`/categories/${id}`, { method: "PUT", body: { name } })
        : api<Category>("/categories", { method: "POST", body: { kind, name, parentId } }),
    onSuccess: () => client.invalidateQueries({ queryKey: ["categories"] }),
  });
}

export function useArchiveCategory() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ id, archived }: { id: string; archived: boolean }) =>
      api<void>(`/categories/${id}/${archived ? "archive" : "unarchive"}`, { method: "POST" }),
    onSuccess: () => client.invalidateQueries({ queryKey: ["categories"] }),
  });
}

export function usePeople() {
  return useQuery({ queryKey: ["people"], queryFn: ({ signal }) => api<PeopleList>("/people", { signal }) });
}

export function usePerson(id: string) {
  return useQuery({ queryKey: ["people", id], queryFn: ({ signal }) => api<PersonDetail>(`/people/${id}`, { signal }) });
}

export function useSavePerson() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ id, name, note }: { id: string | null; name: string; note: string | null }) =>
      id
        ? api<Person>(`/people/${id}`, { method: "PUT", body: { name, note } })
        : api<Person>("/people", { method: "POST", body: { name, note } }),
    onSuccess: () => Promise.all([client.invalidateQueries({ queryKey: ["people"] }), client.invalidateQueries({ queryKey: ["wallets"] })]),
  });
}

export function useDeletePerson() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api<void>(`/people/${id}`, { method: "DELETE" }),
    onSuccess: () => client.invalidateQueries({ queryKey: ["people"] }),
  });
}

export function useSaveLoan(personId: string) {
  const invalidate = useInvalidateMoney();
  return useMutation({
    mutationFn: ({ id, input }: { id: string | null; input: LoanInput }) =>
      id
        ? api(`/people/${personId}/loans/${id}`, { method: "PUT", body: input })
        : api(`/people/${personId}/loans`, { method: "POST", body: input }),
    onSuccess: invalidate,
  });
}

export function useDeleteLoan(personId: string) {
  const invalidate = useInvalidateMoney();
  return useMutation({
    mutationFn: (id: string) => api<void>(`/people/${personId}/loans/${id}`, { method: "DELETE" }),
    onSuccess: invalidate,
  });
}

export function useBudgets(month: string) {
  return useQuery({ queryKey: ["budgets", month], queryFn: ({ signal }) => api<BudgetList>(`/budgets?month=${month}`, { signal }) });
}

export function useSaveBudget() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ id, categoryId, amount }: { id: string | null; categoryId: string | null; amount: number }) =>
      id ? api(`/budgets/${id}`, { method: "PUT", body: { amount } }) : api("/budgets", { method: "POST", body: { categoryId, amount } }),
    onSuccess: () => client.invalidateQueries({ queryKey: ["budgets"] }),
  });
}

export function useDeleteBudget() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api<void>(`/budgets/${id}`, { method: "DELETE" }),
    onSuccess: () => client.invalidateQueries({ queryKey: ["budgets"] }),
  });
}

export function useRecurring() {
  return useQuery({ queryKey: ["recurring", "all"], queryFn: ({ signal }) => api<RecurringRule[]>("/recurring", { signal }) });
}

export function useRecurringDue() {
  return useQuery({ queryKey: ["recurring", "due"], queryFn: ({ signal }) => api<RecurringRule[]>("/recurring/due", { signal }) });
}

export function useSaveRecurring() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string | null; input: RecurringInput }) =>
      id ? api<RecurringRule>(`/recurring/${id}`, { method: "PUT", body: input }) : api<RecurringRule>("/recurring", { method: "POST", body: input }),
    onSuccess: () => client.invalidateQueries({ queryKey: ["recurring"] }),
  });
}

/** Record or skip the next date, pause, resume or delete. Recording changes money, so everything refreshes. */
export function useRecurringAction() {
  const invalidate = useInvalidateMoney();
  return useMutation({
    mutationFn: ({ id, action, amount }: { id: string; action: "record" | "skip" | "pause" | "resume" | "delete"; amount?: number }) =>
      action === "delete"
        ? api<void>(`/recurring/${id}`, { method: "DELETE" })
        : api(`/recurring/${id}/${action}`, { method: "POST", body: action === "record" ? { amount } : undefined }),
    onSuccess: invalidate,
  });
}

/** Month report for "2026-11", or year report for "2026". */
export function useReport(period: ReportPeriod, key: string) {
  const query = period === "Year" ? `period=Year&year=${key}` : `period=Month&month=${key}`;
  return useQuery({ queryKey: ["reports", period, key], queryFn: ({ signal }) => api<Report>(`/reports?${query}`, { signal }) });
}

export function useMergeCategory() {
  const invalidate = useInvalidateMoney();
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ id, intoCategoryId }: { id: string; intoCategoryId: string }) =>
      api<{ movedTransactions: number }>(`/categories/${id}/merge`, { method: "POST", body: { intoCategoryId } }),
    onSuccess: () => Promise.all([invalidate(), client.invalidateQueries({ queryKey: ["categories"] })]),
  });
}

export function useDeleteCategory() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api<void>(`/categories/${id}`, { method: "DELETE" }),
    onSuccess: () => Promise.all([client.invalidateQueries({ queryKey: ["categories"] }), client.invalidateQueries({ queryKey: ["budgets"] })]),
  });
}

export function useSessions() {
  return useQuery({ queryKey: ["sessions"], queryFn: ({ signal }) => api<SessionInfo[]>("/auth/sessions", { signal }) });
}

export function useSignOutSession() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (id: string | "others") =>
      id === "others" ? api("/auth/sessions/sign-out-others", { method: "POST" }) : api<void>(`/auth/sessions/${id}`, { method: "DELETE" }),
    onSuccess: () => client.invalidateQueries({ queryKey: ["sessions"] }),
  });
}
