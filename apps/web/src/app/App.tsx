import { Suspense } from "react";
import { Link, Navigate, Outlet, Route, Routes, useLocation } from "react-router";
import { useAuth } from "../auth/AuthContext";
import { linkClass } from "../auth/AuthLayout";
import { Logo } from "../shared/Logo";
import { Button, focusRing } from "../ui/Button";
import { AppShell } from "../layout/AppShell";
import { AppLoader } from "../ui/AppLoader";
import { PageBoundary } from "../ui/PageBoundary";
import { useTheme } from "./theme";
import {
  BudgetsPage,
  CategoriesPage,
  DashboardPage,
  ForgotPasswordPage,
  PeoplePage,
  PersonPage,
  LoansPage,
  LoanPage,
  RecurringPage,
  RegisterPage,
  ReportsPage,
  ResetPasswordPage,
  SettingsPage,
  SignInPage,
  TransactionsPage,
  VerifyEmailPage,
  WalletsPage,
} from "./routes";

function Starting() {
  return (
    <div className="grid min-h-screen place-items-center">
      <AppLoader label="Opening TakaLeaf…" bar />
    </div>
  );
}

/**
 * The session could not be checked: a busy server or no connection, not a signed-out person. They keep
 * their session and can try again; signing in again is there if they would rather.
 */
function SessionUnavailable({ message, from }: { message: string; from: string }) {
  const { retry } = useAuth();
  const [theme] = useTheme();
  return (
    <main className="grid min-h-screen place-items-center px-5">
      <div role="alert" className="flex max-w-sm flex-col items-center gap-3 text-center">
        <Logo theme={theme} size={36} />
        <h1 className="m-0 mt-4 text-xl font-extrabold tracking-tight">Your account could not be opened</h1>
        <p className="m-0 text-body text-[var(--tl-muted)]">{message} You are still signed in.</p>
        <Button className="mt-2 min-w-40" onClick={retry}>
          Try again
        </Button>
        <Link to="/sign-in" state={{ from }} className={`${linkClass} ${focusRing} mt-1 inline-flex min-h-11 items-center rounded-[6px]`}>
          Sign in again
        </Link>
      </div>
    </main>
  );
}

/** Signed-in pages: a signed-out visitor is sent to sign in, and comes back here afterwards. */
function RequireSignIn() {
  const { state } = useAuth();
  const location = useLocation();
  if (state.status === "loading") return <Starting />;
  if (state.status === "unavailable") return <SessionUnavailable message={state.error.message} from={location.pathname + location.search} />;
  if (state.status === "signedOut") return <Navigate to="/sign-in" replace state={{ from: location.pathname + location.search }} />;
  return <Outlet />;
}

/** Sign-in and register pages: a signed-in visitor goes straight to the dashboard. Someone whose
 * session could not be checked came here to sign in, so they get the form. */
function SignedOutOnly() {
  const { state } = useAuth();
  if (state.status === "loading") return <Starting />;
  if (state.status === "signedIn") return <Navigate to="/" replace />;
  return <Outlet />;
}

export function App() {
  const { pathname } = useLocation();
  // Signed-in pages load inside AppShell's own boundary, so the navigation stays put meanwhile;
  // this one covers the sign-in pages and the start-up.
  return (
    <PageBoundary resetKey={pathname}>
      <Suspense fallback={<Starting />}>
        <Routes>
          <Route element={<SignedOutOnly />}>
            <Route path="/sign-in" element={<SignInPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          </Route>
          {/* Links from emails work whether or not someone is signed in on this browser. */}
          <Route path="/verify-email" element={<VerifyEmailPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          <Route element={<RequireSignIn />}>
            <Route element={<AppShell />}>
              <Route index element={<DashboardPage />} />
              <Route path="/transactions" element={<TransactionsPage />} />
              <Route path="/wallets" element={<WalletsPage />} />
              <Route path="/people" element={<PeoplePage />} />
              <Route path="/people/:id" element={<PersonPage />} />
              <Route path="/loans" element={<LoansPage />} />
              <Route path="/loans/:id" element={<LoanPage />} />
              <Route path="/reports" element={<ReportsPage />} />
              <Route path="/budgets" element={<BudgetsPage />} />
              <Route path="/recurring" element={<RecurringPage />} />
              <Route path="/categories" element={<CategoriesPage />} />
              <Route path="/settings" element={<SettingsPage />} />
            </Route>
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </PageBoundary>
  );
}
