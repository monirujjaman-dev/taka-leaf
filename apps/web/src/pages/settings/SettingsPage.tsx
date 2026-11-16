import { useState, type FormEvent } from "react";
import { api, ApiError } from "../../api/client";
import type { MessageResponse } from "../../api/types";
import { useAuth } from "../../auth/AuthContext";
import { PASSWORD_HINT, PasswordField } from "../../auth/PasswordField";
import { PageHeader } from "../../layout/AppShell";
import { Button } from "../../ui/Button";
import { ErrorNote, SuccessNote } from "../../ui/Feedback";
import { ThemeToggle } from "../../ui/ThemeToggle";

function ChangePassword() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [error, setError] = useState<ApiError | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setDone(null);
    try {
      const response = await api<MessageResponse>("/auth/change-password", {
        method: "POST",
        body: { currentPassword: current, newPassword: next },
      });
      setDone(response.message);
      setCurrent("");
      setNext("");
    } catch (caught) {
      setError(caught instanceof ApiError ? caught : new ApiError(0, "Something went wrong. Try again."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
      <PasswordField
        label="Current password"
        autoComplete="current-password"
        value={current}
        onChange={(e) => setCurrent(e.target.value)}
        error={error?.field("currentPassword")}
      />
      <PasswordField
        label="New password"
        autoComplete="new-password"
        value={next}
        onChange={(e) => setNext(e.target.value)}
        hint={PASSWORD_HINT}
        error={error?.field("newPassword")}
      />
      {error && !error.field("currentPassword") && !error.field("newPassword") ? <ErrorNote>{error.message}</ErrorNote> : null}
      {done ? <SuccessNote>{done}</SuccessNote> : null}
      <Button type="submit" disabled={busy || !current || !next} className="self-start">
        {busy ? "Saving…" : "Change password"}
      </Button>
    </form>
  );
}

export function SettingsPage() {
  const { state, signOut } = useAuth();
  return (
    <>
      <PageHeader title="Settings" />
      <div className="grid gap-4 lg:grid-cols-2">
        <section className="glass rounded-[22px] p-5">
          <h2 className="m-0 text-base font-extrabold">Account</h2>
          <p className="mb-4 mt-1 text-sm text-[var(--tl-muted)]">{state.status === "signedIn" ? state.user.email : ""}</p>
          <div className="flex flex-wrap gap-2">
            <ThemeToggle withLabel />
            <Button variant="secondary" onClick={() => void signOut()}>
              Sign out
            </Button>
          </div>
        </section>
        <section className="glass rounded-[22px] p-5">
          <h2 className="m-0 mb-4 text-base font-extrabold">Change password</h2>
          <ChangePassword />
        </section>
      </div>
    </>
  );
}
