import { Navigate, Outlet, Route, Routes, useLocation } from "react-router";
import { useAuth } from "../auth/AuthContext";
import { ForgotPasswordPage } from "../auth/ForgotPasswordPage";
import { RegisterPage } from "../auth/RegisterPage";
import { ResetPasswordPage } from "../auth/ResetPasswordPage";
import { SignInPage } from "../auth/SignInPage";
import { VerifyEmailPage } from "../auth/VerifyEmailPage";
import { AppShell } from "../layout/AppShell";
import { CategoriesPage } from "../pages/categories/CategoriesPage";
import { DashboardPage } from "../pages/dashboard/DashboardPage";
import { PeoplePage } from "../pages/people/PeoplePage";
import { PersonPage } from "../pages/people/PersonPage";
import { SettingsPage } from "../pages/settings/SettingsPage";
import { TransactionsPage } from "../pages/transactions/TransactionsPage";
import { WalletsPage } from "../pages/wallets/WalletsPage";
import { Loading } from "../ui/Feedback";

function Starting() {
  return (
    <div className="grid min-h-screen place-items-center">
      <Loading label="Opening TakaLeaf…" />
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
  return (
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
          <Route path="/categories" element={<CategoriesPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
