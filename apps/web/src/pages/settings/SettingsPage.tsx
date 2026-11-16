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
import { useTheme } from "../../app/theme";
import { download } from "../../api/client";
import { focusRing } from "../../ui/Button";
import { Icon, type IconName } from "../../ui/Icon";
import { Chevron, IconTile, ListCard } from "../../ui/Parts";

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
    <section id="devices" className="glass scroll-mt-5 rounded-[20px] p-4" aria-labelledby="devices-title">
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

const MORE: { to: string; label: string; icon: IconName }[] = [
  { to: "/wallets", label: "Wallets", icon: "wallet" },
  { to: "/people", label: "People and loans", icon: "people" },
  { to: "/budgets", label: "Budgets", icon: "target" },
  { to: "/recurring", label: "Recurring", icon: "repeat" },
  { to: "/categories", label: "Categories", icon: "tag" },
];

const rowClass = `-mx-1.5 flex h-[54px] w-[calc(100%+12px)] cursor-pointer items-center gap-3 rounded-[14px] px-1.5 text-left hover:bg-[var(--tl-chip)] ${focusRing}`;

function RowText({ icon, label, value, danger = false }: { icon: IconName; label: string; value?: string; danger?: boolean }) {
  return (
    <>
      <IconTile icon={icon} size={36} tone={danger ? "expense" : "primary"} />
      <span className={`flex-1 text-[15px] font-bold ${danger ? "text-expense dark:text-expense-dark" : ""}`}>{label}</span>
      {value ? <span className="text-sm font-semibold text-[var(--tl-muted)]">{value}</span> : null}
      {danger ? null : <Chevron />}
    </>
  );
}

/** Settings, and on phones the More tab: the screens without their own tab come first. */
export function SettingsPage() {
  const { state, signOut } = useAuth();
  const [theme, toggleTheme] = useTheme();
  const sessions = useSessions();
  const [changing, setChanging] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const email = state.status === "signedIn" ? state.user.email : "";

  async function exportAll() {
    setExportError(null);
    try {
      await download("/transactions/export.csv?from=2000-01-01", "takaleaf-transactions.csv");
    } catch (error) {
      setExportError(messageOf(error));
    }
  }

  return (
    <>
      <PageHeader title="Settings" />
      <div className="flex flex-col gap-3 lg:max-w-3xl">
        <section aria-label="Account" className="glass flex items-center gap-3 rounded-[20px] p-3.5">
          <span aria-hidden="true" className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-forest text-white">
            <Icon name="people" size={24} />
          </span>
          <span className="min-w-0">
            <span className="block text-base font-extrabold">Your account</span>
            <span className="block truncate text-[13px] text-[var(--tl-muted)]">{email}</span>
          </span>
        </section>

        <nav aria-label="More" className="lg:hidden">
          <ListCard>
            <ul className="m-0 flex list-none flex-col p-0">
              {MORE.map((item) => (
                <li key={item.to}>
                  <Link to={item.to} className={rowClass}>
                    <RowText icon={item.icon} label={item.label} />
                  </Link>
                </li>
              ))}
            </ul>
          </ListCard>
        </nav>

        <ListCard label="Preferences">
          <ul className="m-0 flex list-none flex-col p-0">
            <li>
              <button type="button" onClick={toggleTheme} className={rowClass} aria-label={`Theme: ${theme === "light" ? "Light" : "Dark"}. Switch to ${theme === "light" ? "dark" : "light"}`}>
                <RowText icon={theme === "light" ? "sun" : "moon"} label="Theme" value={theme === "light" ? "Light" : "Dark"} />
              </button>
            </li>
            <li>
              <button type="button" aria-expanded={changing} onClick={() => setChanging((v) => !v)} className={rowClass}>
                <RowText icon="lock" label="Change password" />
              </button>
            </li>
            <li>
              <button type="button" onClick={exportAll} className={rowClass}>
                <RowText icon="download" label="Export to CSV" />
              </button>
            </li>
            <li>
              <a href="#devices" className={rowClass}>
                <RowText icon="device" label="Signed-in devices" value={sessions.data ? String(sessions.data.length) : undefined} />
              </a>
            </li>
            <li>
              <button type="button" onClick={() => void signOut()} className={rowClass}>
                <RowText icon="out" label="Sign out" danger />
              </button>
            </li>
          </ul>
        </ListCard>
        <ErrorNote>{exportError}</ErrorNote>

        {changing ? (
          <section className="glass rounded-[20px] p-4" aria-labelledby="password-title">
            <h2 id="password-title" className="m-0 mb-4 text-base font-extrabold">
              Change password
            </h2>
            <ChangePassword />
          </section>
        ) : null}
        <Devices />
      </div>
    </>
  );
}
