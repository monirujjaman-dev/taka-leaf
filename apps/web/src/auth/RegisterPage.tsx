import { checkName, NAME_MAX_LENGTH } from "@takaleaf/shared";
import { useState, type FormEvent } from "react";
import { Link } from "react-router";
import { api, ApiError } from "../api/client";
import type { MessageResponse } from "../api/types";
import { Button } from "../ui/Button";
import { ErrorNote } from "../ui/Feedback";
import { TextField } from "../ui/Field";
import { AuthLayout, linkClass } from "./AuthLayout";
import { PASSWORD_HINT, PasswordField } from "./PasswordField";

export function RegisterPage() {
  const [name, setName] = useState("");
  const [nameError, setNameError] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<ApiError | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const checked = checkName(name);
    setNameError(checked.error);
    if (checked.error) return;
    setBusy(true);
    setError(null);
    try {
      const response = await api<MessageResponse>("/auth/register", { method: "POST", body: { name: checked.name, email, password } });
      setDone(response.message);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught : new ApiError(0, "Something went wrong. Try again."));
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <AuthLayout title="Check your email" intro={done}>
        <p className="m-0 text-body text-[var(--tl-muted)]">
          The link works for 24 hours. Nothing in your inbox? Look in spam, or{" "}
          <button type="button" className={`${linkClass} cursor-pointer`} onClick={() => setDone(null)}>
            try again
          </button>
          .
        </p>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title="Create your account" intro="One account for TakaLeaf on the web and in the Android app.">
      <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
        <TextField
          label="Your name"
          autoComplete="name"
          maxLength={NAME_MAX_LENGTH}
          value={name}
          onChange={(e) => setName(e.target.value)}
          hint="How TakaLeaf greets you. You can change it later in Settings."
          error={nameError ?? error?.field("name")}
        />
        <TextField
          label="Email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          error={error?.field("email")}
        />
        <PasswordField
          label="Password"
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          hint={PASSWORD_HINT}
          error={error?.field("password")}
        />
        {error && !error.field("name") && !error.field("email") && !error.field("password") ? <ErrorNote>{error.message}</ErrorNote> : null}
        <Button type="submit" disabled={busy || !name.trim() || !email || !password} className="mt-1 h-[54px] rounded-[18px] text-base font-extrabold">
          {busy ? "Creating…" : "Create account"}
        </Button>
      </form>
      <p className="mb-0 mt-5 text-center text-sm text-[var(--tl-muted)]">
        Already have an account?{" "}
        <Link to="/sign-in" className={linkClass}>
          Sign in
        </Link>
      </p>
    </AuthLayout>
  );
}

