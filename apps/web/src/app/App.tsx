import { Suspense } from "react";
import { Navigate, Outlet, Route, Routes, useLocation } from "react-router";
import { useAuth } from "../auth/AuthContext";
import { AppShell } from "../layout/AppShell";
import { AppLoader } from "../ui/AppLoader";
import { PageBoundary } from "../ui/PageBoundary";
import {
  BudgetsPage,
  CategoriesPage,
  DashboardPage,
  ForgotPasswordPage,
  PeoplePage,
  PersonPage,
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

/** Signed-in pages: a signed-out visitor is sent to sign in, and comes back here afterwards. */
function RequireSignIn() {
  const { state } = useAuth();
  const location = useLocation();
  if (state.status === "loading") return <Starting />;
  if (state.status === "signedOut") return <Navigate to="/sign-in" replace state={{ from: location.pathname + location.search }} />;
  return <Outlet />;
}

/** Sign-in and register pages: a signed-in visitor goes straight to the dashboard. */
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
