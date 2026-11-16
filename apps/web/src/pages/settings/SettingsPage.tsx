import { useState, type FormEvent } from "react";
import { api, ApiError } from "../../api/client";
import { useSessions, useSignOutSession } from "../../api/queries";
import type { MessageResponse } from "../../api/types";
import { useAuth } from "../../auth/AuthContext";
import { PASSWORD_HINT, PasswordField } from "../../auth/PasswordField";
import { Link } from "react-router";
import { PageHeader } from "../../layout/AppShell";
import { Button } from "../../ui/Button";
import { ErrorNote, Loading, SuccessNote, messageOf } from "../../ui/Feedback";
import { dayLabel, localDate, timeLabel } from "../../ui/format";
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

/** Where this account is signed in. Signing a device out works on its next request. */
function Devices() {
  const sessions = useSessions();
  const signOut = useSignOutSession();
  const others = (sessions.data ?? []).filter((s) => !s.current);
  const when = (iso: string) => `${dayLabel(localDate(new Date(iso)))}, ${timeLabel(iso)}`;

  return (
    <section className="glass rounded-[22px] p-5 lg:col-span-2" aria-labelledby="devices-title">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 id="devices-title" className="m-0 text-base font-extrabold">
          Signed-in devices
        </h2>
        {others.length > 0 ? (
          <Button variant="secondary" disabled={signOut.isPending} onClick={() => signOut.mutate("others")}>
            Sign out all other devices
          </Button>
        ) : null}
      </div>
      {sessions.isPending ? <Loading /> : null}
      <ErrorNote>{messageOf(sessions.error ?? signOut.error)}</ErrorNote>
      <ul className="m-0 flex list-none flex-col gap-2 p-0">
        {(sessions.data ?? []).map((session) => (
          <li key={session.id} className="flex flex-wrap items-center gap-3 rounded-[16px] bg-[var(--tl-chip)] px-3 py-2.5">
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[15px] font-bold">
                {session.device}
                {session.current ? (
                  <span className="ml-2 rounded-full bg-[var(--tl-surface)] px-2 py-0.5 text-[11px] font-bold text-[var(--tl-primary)]">This device</span>
                ) : null}
              </span>
              <span className="block text-[13px] text-[var(--tl-muted)]">
                Last used {when(session.lastUsedAt)} · signed in {when(session.signedInAt)}
              </span>
            </span>
            {session.current ? null : (
              <Button variant="ghost" className="px-3" disabled={signOut.isPending} onClick={() => signOut.mutate(session.id)}>
                Sign out
              </Button>
            )}
          </li>
        ))}
      </ul>
    </section>
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
        <nav aria-label="More" className="glass rounded-[22px] p-2 lg:hidden">
          {[
            ["/reports", "Reports", "Month and year totals, by category, and the trend"],
            ["/budgets", "Budgets", "Monthly limits and how this month is going"],
            ["/recurring", "Recurring", "Rent, salary and subscriptions"],
            ["/categories", "Categories", "Add, rename or archive categories"],
          ].map(([to, label, hint]) => (
            <Link key={to} to={to!} className="block rounded-[16px] px-3 py-3 hover:bg-[var(--tl-chip)]">
              <span className="block text-[15px] font-bold">{label}</span>
              <span className="block text-[13px] text-[var(--tl-muted)]">{hint}</span>
            </Link>
          ))}
        </nav>
        <section className="glass rounded-[22px] p-5">
          <h2 className="m-0 mb-4 text-base font-extrabold">Change password</h2>
          <ChangePassword />
        </section>
        <Devices />
      </div>
    </>
  );
}
