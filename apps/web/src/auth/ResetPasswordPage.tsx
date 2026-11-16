import { useState, type FormEvent } from "react";
import { Link, useSearchParams } from "react-router";
import { api, ApiError } from "../api/client";
import type { MessageResponse } from "../api/types";
import { Button } from "../ui/Button";
import { ErrorNote, SuccessNote } from "../ui/Feedback";
import { AuthLayout, linkClass } from "./AuthLayout";
import { PASSWORD_HINT, PasswordField } from "./PasswordField";

export function ResetPasswordPage() {
  const [params] = useSearchParams();
  const token = params.get("token") ?? "";
  const [password, setPassword] = useState("");
  const [error, setError] = useState<ApiError | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      setDone((await api<MessageResponse>("/auth/reset-password", { method: "POST", body: { token, password } })).message);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught : new ApiError(0, "Something went wrong. Try again."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthLayout title="Choose a new password">
      {done ? (
        <div className="flex flex-col gap-4">
          <SuccessNote>{done}</SuccessNote>
          <Link to="/sign-in" className={`${linkClass} text-center`}>
            Go to sign in
          </Link>
        </div>
      ) : (
        <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
          <PasswordField
            label="New password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            hint={PASSWORD_HINT}
            error={error?.field("password")}
          />
          {error && !error.field("password") ? (
            <ErrorNote>
              {error.message}{" "}
              <Link to="/forgot-password" className={linkClass}>
                Get a new link
              </Link>
            </ErrorNote>
          ) : null}
          <Button type="submit" disabled={busy || !password || !token} className="mt-1 h-[54px] rounded-[18px] text-base font-extrabold">
            {busy ? "Saving…" : "Save new password"}
          </Button>
        </form>
      )}
    </AuthLayout>
  );
}
