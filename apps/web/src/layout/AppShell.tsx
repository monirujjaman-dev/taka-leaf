import type { ReactNode } from "react";
import { NavLink, Outlet } from "react-router";
import { useTheme } from "../app/theme";
import { useAuth } from "../auth/AuthContext";
import { Logo } from "../shared/Logo";
import { Backdrop } from "../ui/Backdrop";
import { focusRing } from "../ui/Button";
import { Icon, type IconName } from "../ui/Icon";
import { ThemeToggle } from "../ui/ThemeToggle";
import { TransactionSheetProvider, useTransactionSheet } from "./TransactionSheet";

const NAV: { to: string; label: string; short: string; icon: IconName }[] = [
  { to: "/", label: "Dashboard", short: "Home", icon: "home" },
  { to: "/transactions", label: "Transactions", short: "History", icon: "list" },
  { to: "/wallets", label: "Wallets", short: "Wallets", icon: "wallet" },
  { to: "/categories", label: "Categories", short: "Categories", icon: "tag" },
  { to: "/settings", label: "Settings", short: "Settings", icon: "settings" },
];

function AddButton({ className = "" }: { className?: string }) {
  const sheet = useTransactionSheet();
  return (
    <button
      type="button"
      onClick={() => sheet.open()}
      className={`inline-flex cursor-pointer items-center justify-center gap-2 bg-forest font-bold text-white shadow-[0_10px_24px_rgb(11_59_36/0.3)] hover:bg-[#0c6a3b] dark:bg-sage dark:text-ink ${focusRing} ${className}`}
    >
      <Icon name="plus" />
      <span className="sr-only lg:not-sr-only">Add transaction</span>
    </button>
  );
}

/**
 * Signed-in layout. Wide screens get a glass sidebar; phones get a top bar, a bottom tab bar and
 * a floating add button within thumb reach.
 */
export function AppShell() {
  const [theme] = useTheme();
  const { state, signOut } = useAuth();
  const email = state.status === "signedIn" ? state.user.email : "";

  return (
    <TransactionSheetProvider>
      <div className="relative min-h-screen">
        <Backdrop />

        <aside className="glass fixed inset-y-4 left-4 hidden w-64 flex-col rounded-[26px] p-5 lg:flex">
          <Logo theme={theme} />
          <AddButton className="mt-6 h-12 rounded-[16px] text-sm" />
          <nav aria-label="Main" className="mt-6 flex flex-col gap-1">
            {NAV.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === "/"}
                className={({ isActive }) =>
                  `flex h-11 items-center gap-3 rounded-[14px] px-3 text-[15px] font-semibold ${focusRing} ${
                    isActive ? "bg-[var(--tl-chip)] text-[var(--tl-primary)]" : "hover:bg-[var(--tl-chip)]"
                  }`
                }
              >
                <Icon name={item.icon} />
                {item.label}
              </NavLink>
            ))}
          </nav>
          <div className="mt-auto flex flex-col gap-3">
            <ThemeToggle withLabel />
            <p className="m-0 truncate text-[13px] text-[var(--tl-muted)]" title={email}>
              {email}
            </p>
            <button
              type="button"
              onClick={() => void signOut()}
              className={`inline-flex h-10 cursor-pointer items-center gap-2 rounded-[12px] px-2 text-sm font-bold hover:bg-[var(--tl-chip)] ${focusRing}`}
            >
              <Icon name="out" size={20} /> Sign out
            </button>
          </div>
        </aside>

        <header className="glass sticky top-0 z-30 flex items-center justify-between border-x-0 border-t-0 px-4 py-3 lg:hidden">
          <Logo theme={theme} size={30} />
          <ThemeToggle />
        </header>

        <div className="lg:pl-72">
          <main className="mx-auto w-full max-w-5xl px-4 pb-32 pt-5 lg:px-8 lg:pb-10 lg:pt-8">
            <Outlet />
          </main>
        </div>

        <AddButton className="fixed bottom-24 right-5 z-30 h-14 w-14 rounded-full lg:hidden" />

        <nav
          aria-label="Main"
          className="glass fixed inset-x-3 bottom-3 z-30 grid grid-cols-5 rounded-[22px] p-1.5 lg:hidden"
        >
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === "/"}
              className={({ isActive }) =>
                `flex flex-col items-center gap-0.5 rounded-[16px] py-2 text-[11px] font-bold ${focusRing} ${
                  isActive ? "bg-[var(--tl-chip)] text-[var(--tl-primary)]" : "text-[var(--tl-muted)]"
                }`
              }
            >
              <Icon name={item.icon} size={21} />
              {item.short}
            </NavLink>
          ))}
        </nav>
      </div>
    </TransactionSheetProvider>
  );
}

export function PageHeader({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
      <h1 className="m-0 text-[26px] font-extrabold tracking-tight">{title}</h1>
      {children ? <div className="flex flex-wrap items-center gap-2">{children}</div> : null}
    </div>
  );
}
