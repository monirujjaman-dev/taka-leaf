import { Suspense, useEffect, type ReactNode } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router";
import { prefetchSignedInPages } from "../app/routes";
import { useTheme } from "../app/theme";
import { useAuth } from "../auth/AuthContext";
import { Logo } from "../shared/Logo";
import { Backdrop } from "../ui/Backdrop";
import { focusRing } from "../ui/Button";
import { Icon, type IconName } from "../ui/Icon";
import { iconButtonClass } from "../ui/Parts";
import { Loading } from "../ui/Feedback";
import { PageBoundary } from "../ui/PageBoundary";
import { StartupProvider } from "../ui/startup";
import { useOnline } from "../ui/useOnline";
import { TransactionSheetProvider, useTransactionSheet } from "./TransactionSheet";

/** The sidebar on wide screens, in the design's order. Phones reach most of these from More. */
const NAV: { to: string; label: string; icon: IconName }[] = [
  { to: "/", label: "Dashboard", icon: "home" },
  { to: "/transactions", label: "Transactions", icon: "list" },
  { to: "/wallets", label: "Wallets", icon: "wallet" },
  { to: "/people", label: "People and loans", icon: "people" },
  { to: "/categories", label: "Categories", icon: "tag" },
  { to: "/budgets", label: "Budgets", icon: "target" },
  { to: "/recurring", label: "Recurring", icon: "repeat" },
  { to: "/reports", label: "Reports", icon: "chart" },
  { to: "/settings", label: "Settings", icon: "settings" },
];

/** Screens that live under the More tab on phones, so More stays lit on them. */
const UNDER_MORE = ["/wallets", "/people", "/categories", "/budgets", "/recurring", "/settings"];

/** The primary "Add transaction" button for page headers on wide screens. */
export function AddTransactionButton() {
  const sheet = useTransactionSheet();
  return (
    <button
      type="button"
      onClick={() => sheet.open()}
      className={`press hidden h-11 cursor-pointer items-center gap-1.5 rounded-[14px] bg-forest px-4 text-sm font-extrabold text-white hover:bg-forest-hover dark:bg-sage dark:text-ink dark:hover:bg-sage-hover lg:inline-flex ${focusRing}`}
    >
      <Icon name="plus" size={18} />
      Add transaction
    </button>
  );
}

function Sidebar() {
  const [theme, toggleTheme] = useTheme();
  const { signOut } = useAuth();
  const online = useOnline();
  return (
    <aside className="glass sticky top-5 hidden h-[calc(100vh-40px)] w-60 shrink-0 flex-col gap-1 rounded-[26px] px-3.5 py-5 lg:flex">
      <div className="px-2 pb-[18px]">
        <Logo theme={theme} size={32} />
      </div>
      <nav aria-label="Main" className="flex flex-col gap-1">
        {NAV.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === "/"}
            className={({ isActive }) =>
              `flex h-11 items-center gap-3 rounded-[14px] px-3 text-sm font-bold ${focusRing} ${
                isActive ? "bg-forest text-white" : "text-[var(--tl-muted)] hover:bg-[var(--tl-chip)] active:bg-[var(--tl-chip)] hover:text-[var(--tl-text)]"
              }`
            }
          >
            <Icon name={item.icon} size={19} />
            {item.label}
          </NavLink>
        ))}
      </nav>
      <div className="mt-auto flex flex-col gap-1 pt-3.5">
        <button
          type="button"
          onClick={toggleTheme}
          className={`flex h-11 cursor-pointer items-center gap-3 rounded-[14px] px-3 text-sm font-bold text-[var(--tl-muted)] hover:bg-[var(--tl-chip)] active:bg-[var(--tl-chip)] ${focusRing}`}
        >
          <Icon name={theme === "light" ? "moon" : "sun"} size={19} />
          {theme === "light" ? "Dark theme" : "Light theme"}
        </button>
        <button
          type="button"
          onClick={() => void signOut()}
          className={`flex h-11 cursor-pointer items-center gap-3 rounded-[14px] px-3 text-sm font-bold text-[var(--tl-muted)] hover:bg-[var(--tl-chip)] active:bg-[var(--tl-chip)] ${focusRing}`}
        >
          <Icon name="out" size={19} />
          Sign out
        </button>
        {/* States the connection as it is, not as it usually is (the page also says it above). */}
        <p className="m-0 flex items-center gap-2.5 px-2.5 pt-2 text-caption font-semibold text-[var(--tl-muted)]">
          <span className={`flex ${online ? "text-[var(--tl-primary)]" : ""}`}>
            <Icon name="sync" size={17} />
          </span>
          {online ? "Connected to your server" : "Offline. Changes will not save."}
        </p>
      </div>
    </aside>
  );
}

function Tab({ to, label, icon, active }: { to: string; label: string; icon: IconName; active: boolean }) {
  return (
    <Link
      to={to}
      aria-current={active ? "page" : undefined}
      className={`press flex h-[52px] w-[52px] flex-col items-center justify-center gap-0.5 rounded-[14px] text-tab font-bold ${focusRing} ${
        active ? "text-[var(--tl-nav-active)]" : "text-[var(--tl-muted)]"
      }`}
    >
      <Icon name={icon} size={22} />
      {label}
    </Link>
  );
}

/** Phones: Home, History, the centre Add button, Reports and More, floating 16 px from the edges. */
function TabBar() {
  const sheet = useTransactionSheet();
  const { pathname } = useLocation();
  const under = (path: string) => pathname === path || pathname.startsWith(`${path}/`);
  return (
    <nav
      aria-label="Main"
      className="glass fixed inset-x-4 bottom-4 z-30 mx-auto flex h-[68px] max-w-md items-center justify-between rounded-[24px] px-2.5 lg:hidden"
    >
      <Tab to="/" label="Home" icon="home" active={pathname === "/"} />
      <Tab to="/transactions" label="History" icon="list" active={under("/transactions")} />
      <button
        type="button"
        aria-label="Add transaction"
        onClick={() => sheet.open()}
        className={`press grid h-14 w-14 cursor-pointer place-items-center rounded-[20px] bg-forest text-white shadow-float ${focusRing}`}
      >
        <Icon name="plus" size={26} />
      </button>
      <Tab to="/reports" label="Reports" icon="chart" active={under("/reports")} />
      <Tab to="/settings" label="More" icon="more" active={UNDER_MORE.some(under)} />
    </nav>
  );
}

/** Signed-in layout: a 240 px glass sidebar beside the page on wide screens, a floating tab bar on phones. */
/** Said once, in words, when the browser loses its connection; saves would fail until it returns. */
function OfflineNote() {
  const online = useOnline();
  return (
    <div role="status" aria-live="polite">
      {online ? null : (
        <p className="m-0 mb-3 flex items-center gap-2.5 rounded-[14px] bg-[var(--tl-chip)] px-3.5 py-3 text-sm font-semibold text-[var(--tl-text)] lg:mb-5">
          <span aria-hidden="true" className="flex shrink-0 text-[var(--tl-primary)]">
            <Icon name="sync" size={18} />
          </span>
          You are offline. What you see may be out of date, and changes will not save until you reconnect.
        </p>
      )}
    </div>
  );
}

export function AppShell() {
  const { pathname } = useLocation();
  // Once the first page is up, fetch the others and the add sheet in the background.
  useEffect(prefetchSignedInPages, []);
  return (
    <StartupProvider>
      <TransactionSheetProvider>
        <div className="relative min-h-screen">
          <a
            href="#main"
            className={`sr-only z-50 rounded-[14px] bg-forest px-4 py-3 text-sm font-bold text-white focus:not-sr-only focus:fixed focus:left-4 focus:top-4 ${focusRing}`}
          >
            Skip to content
          </a>
          <Backdrop />
          <div className="flex gap-5 lg:p-5">
            <Sidebar />
            <main id="main" tabIndex={-1} className="mx-auto w-full min-w-0 max-w-6xl flex-1 px-5 pb-28 pt-5 outline-none lg:px-0 lg:pb-5 lg:pt-0">
              <OfflineNote />
              <PageBoundary resetKey={pathname}>
                <Suspense fallback={<Loading />}>
                  <Outlet />
                </Suspense>
              </PageBoundary>
            </main>
          </div>
          <TabBar />
        </div>
      </TransactionSheetProvider>
    </StartupProvider>
  );
}

/**
 * Page title row. Phones: an optional back button, a 20 px title and one icon action (56 px tall).
 * Wide screens: a 26 px title with the actions on the right.
 */
export function PageHeader({
  title,
  back,
  phoneAction,
  children,
}: {
  title: string;
  /** Where the phone back button goes; screens reached from More go back to it. */
  back?: string;
  /** One icon button shown instead of `children` on phones. */
  phoneAction?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div className="mb-3 flex min-h-14 flex-wrap items-center gap-3 lg:mb-5 lg:min-h-11 lg:justify-between">
      {back ? (
        <Link to={back} aria-label="Back" className={`${iconButtonClass} lg:hidden`}>
          <Icon name="left" size={20} />
        </Link>
      ) : null}
      <h1 className="m-0 min-w-0 flex-1 text-xl font-extrabold tracking-[-0.4px] lg:flex-none lg:text-headline">{title}</h1>
      {phoneAction ? <div className="lg:hidden">{phoneAction}</div> : null}
      {children ? (
        <div className={`flex flex-wrap items-center gap-2.5 ${phoneAction ? "hidden lg:flex" : ""}`}>{children}</div>
      ) : null}
    </div>
  );
}
