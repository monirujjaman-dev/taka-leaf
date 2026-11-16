import { useState, type FormEvent } from "react";
import { Link } from "react-router";
import { api, ApiError } from "../api/client";
import type { MessageResponse } from "../api/types";
import { Button } from "../ui/Button";
import { ErrorNote, SuccessNote } from "../ui/Feedback";
import { TextField } from "../ui/Field";
import { AuthLayout, linkClass } from "./AuthLayout";

export function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<ApiError | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      setDone((await api<MessageResponse>("/auth/forgot-password", { method: "POST", body: { email } })).message);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught : new ApiError(0, "Something went wrong. Try again."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthLayout title="Forgot your password?" intro="Enter your email and we will send a link to choose a new password.">
      {done ? (
        <SuccessNote>{done}</SuccessNote>
      ) : (
        <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
          <TextField
            label="Email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            error={error?.field("email")}
          />
          {error && !error.field("email") ? <ErrorNote>{error.message}</ErrorNote> : null}
          <Button type="submit" disabled={busy || !email}>
            {busy ? "Sending…" : "Send reset link"}
          </Button>
        </form>
      )}
      <p className="mb-0 mt-5 text-center text-sm">
        <Link to="/sign-in" className={linkClass}>
          Back to sign in
        </Link>
      </p>
    </AuthLayout>
  );
}
