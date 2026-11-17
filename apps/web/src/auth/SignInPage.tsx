import { useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router";
import { api, ApiError } from "../api/client";
import type { MessageResponse } from "../api/types";
import { Button } from "../ui/Button";
import { ErrorNote, SuccessNote } from "../ui/Feedback";
import { TextField } from "../ui/Field";
import { useAuth } from "./AuthContext";
import { AuthLayout, linkClass } from "./AuthLayout";
import { PasswordField } from "./PasswordField";

export function SignInPage() {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<ApiError | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const from = (location.state as { from?: string } | null)?.from ?? "/";

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await signIn(email, password);
      navigate(from, { replace: true });
    } catch (caught) {
      setError(caught instanceof ApiError ? caught : new ApiError(0, "Something went wrong. Try again."));
    } finally {
      setBusy(false);
    }
  }

  async function resend() {
    const response = await api<MessageResponse>("/auth/resend-verification", { method: "POST", body: { email } });
    setError(null);
    setNotice(response.message);
  }

  return (
    <AuthLayout title="Welcome back" intro="Sign in to your TakaLeaf account.">
      <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
        <TextField label="Email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <PasswordField
          label="Password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        {error ? (
          <ErrorNote>
            {error.message}
            {error.code === "email_not_verified" ? (
              <>
                {" "}
                <button type="button" onClick={resend} className={`${linkClass} cursor-pointer`}>
                  Send the link again
                </button>
              </>
            ) : null}
          </ErrorNote>
        ) : null}
        {notice ? <SuccessNote>{notice}</SuccessNote> : null}
        <Button type="submit" disabled={busy || !email || !password} className="mt-1 h-[54px] rounded-[18px] text-base font-extrabold">
          {busy ? "Signing in…" : "Sign in"}
        </Button>
      </form>
      <div className="mt-2 flex min-h-11 flex-wrap items-center justify-between gap-3 text-sm">
        <Link to="/forgot-password" className={linkClass}>
          Forgot password?
        </Link>
        <Link to="/register" className={linkClass}>
          Create account
        </Link>
      </div>
    </AuthLayout>
  );
}
