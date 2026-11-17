import type { QueryClient } from "@tanstack/react-query";
import { lazy } from "react";
import { budgetsQuery, dashboardQuery, recurringDueQuery, walletsQuery } from "../api/queries";
import { localMonth } from "../ui/format";

/*
 * Every page is its own chunk, so opening the app parses only the shell and the page in view.
 * main.tsx preloads the current route's chunk while the session is being restored (no extra round
 * trip), and the rest are fetched when the browser is idle, so moving between pages stays instant.
 */
const load = {
  signIn: () => import("../auth/SignInPage"),
  register: () => import("../auth/RegisterPage"),
  forgotPassword: () => import("../auth/ForgotPasswordPage"),
  resetPassword: () => import("../auth/ResetPasswordPage"),
  verifyEmail: () => import("../auth/VerifyEmailPage"),
  dashboard: () => import("../pages/dashboard/DashboardPage"),
  transactions: () => import("../pages/transactions/TransactionsPage"),
  wallets: () => import("../pages/wallets/WalletsPage"),
  people: () => import("../pages/people/PeoplePage"),
  person: () => import("../pages/people/PersonPage"),
  reports: () => import("../pages/reports/ReportsPage"),
  budgets: () => import("../pages/budgets/BudgetsPage"),
  recurring: () => import("../pages/recurring/RecurringPage"),
  categories: () => import("../pages/categories/CategoriesPage"),
  settings: () => import("../pages/settings/SettingsPage"),
  /** The add/edit transaction sheet, opened from every signed-in page. */
  transactionForm: () => import("../pages/transactions/TransactionForm"),
};

export const SignInPage = lazy(() => load.signIn().then((m) => ({ default: m.SignInPage })));
export const RegisterPage = lazy(() => load.register().then((m) => ({ default: m.RegisterPage })));
export const ForgotPasswordPage = lazy(() => load.forgotPassword().then((m) => ({ default: m.ForgotPasswordPage })));
export const ResetPasswordPage = lazy(() => load.resetPassword().then((m) => ({ default: m.ResetPasswordPage })));
export const VerifyEmailPage = lazy(() => load.verifyEmail().then((m) => ({ default: m.VerifyEmailPage })));
export const DashboardPage = lazy(() => load.dashboard().then((m) => ({ default: m.DashboardPage })));
export const TransactionsPage = lazy(() => load.transactions().then((m) => ({ default: m.TransactionsPage })));
export const WalletsPage = lazy(() => load.wallets().then((m) => ({ default: m.WalletsPage })));
export const PeoplePage = lazy(() => load.people().then((m) => ({ default: m.PeoplePage })));
export const PersonPage = lazy(() => load.person().then((m) => ({ default: m.PersonPage })));
export const ReportsPage = lazy(() => load.reports().then((m) => ({ default: m.ReportsPage })));
export const BudgetsPage = lazy(() => load.budgets().then((m) => ({ default: m.BudgetsPage })));
export const RecurringPage = lazy(() => load.recurring().then((m) => ({ default: m.RecurringPage })));
export const CategoriesPage = lazy(() => load.categories().then((m) => ({ default: m.CategoriesPage })));
export const SettingsPage = lazy(() => load.settings().then((m) => ({ default: m.SettingsPage })));
export const TransactionForm = lazy(() => load.transactionForm().then((m) => ({ default: m.TransactionForm })));

/** The chunk for an address, matching the routes in App.tsx. */
function loaderFor(pathname: string) {
  if (pathname === "/") return load.dashboard;
  if (/^\/people\/[^/]+/.test(pathname)) return load.person;
  const first = `/${pathname.split("/")[1] ?? ""}`;
  const byPath: Record<string, () => Promise<unknown>> = {
    "/sign-in": load.signIn,
    "/register": load.register,
    "/forgot-password": load.forgotPassword,
    "/reset-password": load.resetPassword,
    "/verify-email": load.verifyEmail,
    "/transactions": load.transactions,
    "/wallets": load.wallets,
    "/people": load.people,
    "/reports": load.reports,
    "/budgets": load.budgets,
    "/recurring": load.recurring,
    "/categories": load.categories,
    "/settings": load.settings,
  };
  return byPath[first];
}

/** Starts fetching the page in view. A failure here is ignored; the page itself reports it. */
export function preloadRoute(pathname: string) {
  loaderFor(pathname)?.().catch(() => {});
}

/** Starts the dashboard's reads as soon as the session is back, instead of after it renders. */
export function prefetchRouteData(client: QueryClient, pathname: string) {
  if (pathname !== "/") return;
  const month = localMonth();
  void client.prefetchQuery(dashboardQuery(month));
  void client.prefetchQuery(walletsQuery());
  void client.prefetchQuery(budgetsQuery(month));
  void client.prefetchQuery(recurringDueQuery());
}

let prefetched = false;

/**
 * Fetches the other signed-in pages and the transaction sheet once the browser is idle, so the
 * first tap on Add or a tab never waits for the network. Skipped when the person asked to save data.
 */
export function prefetchSignedInPages() {
  if (prefetched || typeof window === "undefined") return;
  prefetched = true;
  const connection = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
  if (connection?.saveData) return;
  const run = () => {
    for (const key of ["transactionForm", "dashboard", "transactions", "reports", "wallets", "people", "person", "budgets", "recurring", "categories", "settings"] as const) {
      load[key]().catch(() => {});
    }
  };
  if ("requestIdleCallback" in window) window.requestIdleCallback(run, { timeout: 4000 });
  else setTimeout(run, 1500);
}
