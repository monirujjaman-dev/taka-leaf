import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { focusRing } from "./Button";
import { Icon } from "./Icon";

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** Open dialogs, newest last: only the top one answers Escape and keeps Tab inside itself. */
const open: HTMLElement[] = [];
/** Counts dialog mounts, so a closing dialog can tell whether another took its place at once. */
let mounts = 0;

/**
 * The way out. Every form closes its dialog by unmounting it, so the real element is already gone;
 * a copy of it plays the exit (phones: back down to the bottom edge; wider screens: fade to 0.96)
 * and removes itself. Skipped without Web Animations or with reduced motion, and when another
 * dialog replaced this one in the same moment (it is already on screen in its place).
 */
function playExit(wrapper: HTMLElement, scrollTop: number) {
  if (typeof wrapper.animate !== "function" || typeof window.matchMedia !== "function") return;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const before = mounts;
  queueMicrotask(() => {
    if (mounts !== before) return;
    const ghost = wrapper.cloneNode(true) as HTMLElement;
    ghost.setAttribute("aria-hidden", "true");
    ghost.setAttribute("inert", "");
    ghost.setAttribute("data-instant", "");
    ghost.style.pointerEvents = "none";
    // A clone keeps attributes, not what was typed; copy the values so the fields do not blank out.
    const from = wrapper.querySelectorAll<HTMLInputElement>("input, select, textarea");
    ghost.querySelectorAll<HTMLInputElement>("input, select, textarea").forEach((field, i) => {
      const value = from[i]?.value;
      if (value !== undefined) field.value = value;
    });
    document.body.append(ghost);
    const panel = ghost.querySelector<HTMLElement>(".tl-dialog");
    const backdrop = ghost.querySelector<HTMLElement>(".tl-backdrop");
    if (!panel || !backdrop) return ghost.remove();
    panel.scrollTop = scrollTop;
    const wide = window.matchMedia("(min-width: 640px)").matches;
    const timing: KeyframeAnimationOptions = { duration: wide ? 150 : 200, easing: "cubic-bezier(0.22, 1, 0.36, 1)", fill: "forwards" };
    panel.animate(
      wide ? [{ opacity: 1, transform: "scale(1)" }, { opacity: 0, transform: "scale(0.96)" }] : [{ transform: "translateY(0)" }, { transform: "translateY(100%)" }],
      timing,
    );
    backdrop
      .animate([{ opacity: 1 }, { opacity: 0 }], timing)
      .finished.catch(() => {})
      .finally(() => ghost.remove());
  });
}

/** A bottom sheet on phones and a centred dialog on wider screens. Escape or the backdrop closes it. */
export function Modal({
  title,
  onClose,
  children,
  sheet = false,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  /** Full screen on phones with the close button on the left, as the add-transaction design shows. */
  sheet?: boolean;
}) {
  const titleId = useId();
  const panel = useRef<HTMLDivElement>(null);
  // Callers pass a new arrow function on every render; keep the latest one without re-running the
  // effect below, which would move focus back to the first field while someone is typing.
  const close = useRef(onClose);
  close.current = onClose;

  useEffect(() => {
    const node = panel.current;
    if (!node) return;
    const wrapper = node.parentElement;
    const previous = document.activeElement as HTMLElement | null;
    open.push(node);
    mounts++;
    // React detaches the element before this cleanup runs, so keep the scroll position as it changes.
    let scrollTop = 0;
    const onScroll = () => (scrollTop = node.scrollTop);
    node.addEventListener("scroll", onScroll, { passive: true });

    // The page behind stays still and out of reach while the dialog is open.
    const root = document.getElementById("root");
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    root?.setAttribute("inert", "");

    const onKey = (event: KeyboardEvent) => {
      if (open.at(-1) !== node) return;
      if (event.key === "Escape") {
        event.stopPropagation();
        close.current();
        return;
      }
      if (event.key !== "Tab") return;
      const all = [...node.querySelectorAll<HTMLElement>(FOCUSABLE)];
      // Skip controls hidden at this screen size (the number pad on desktop, for example).
      const shown = all.filter((el) => el.getClientRects().length > 0);
      const items = shown.length > 0 ? shown : all;
      const first = items[0];
      const last = items.at(-1);
      if (!first || !last) {
        event.preventDefault();
        node.focus();
        return;
      }
      const inside = node.contains(document.activeElement);
      if (event.shiftKey && (document.activeElement === first || !inside)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (document.activeElement === last || !inside)) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);

    const first =
      node.querySelector<HTMLElement>("[data-autofocus]") ??
      node.querySelector<HTMLElement>("input, select, textarea, button:not([data-close])") ??
      node;
    first.focus();

    return () => {
      document.removeEventListener("keydown", onKey);
      node.removeEventListener("scroll", onScroll);
      open.splice(open.indexOf(node), 1);
      if (open.length === 0) {
        document.body.style.overflow = overflow;
        root?.removeAttribute("inert");
      }
      previous?.focus?.();
      if (wrapper) playExit(wrapper, scrollTop);
    };
  }, []);

  // A dialog that takes the place of another (the add sheet's "Loading…" giving way to the form)
  // appears in place instead of rising a second time.
  const [instant] = useState(() => open.length > 0);

  // Rendered beside #root, not inside it, so the page can be made inert without the dialog.
  return createPortal(
    <div data-instant={instant ? "" : undefined} className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-6">
      <div aria-hidden="true" className="tl-backdrop absolute inset-0 bg-night/45 backdrop-blur-[2px]" onClick={() => close.current()} />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={`tl-dialog relative w-full overflow-y-auto overscroll-contain border-[var(--tl-glass-border)] bg-[var(--tl-surface)] shadow-2xl outline-none sm:max-h-[92vh] sm:max-w-lg sm:rounded-[26px] sm:border ${
          sheet ? "h-dvh bg-[var(--tl-bg)] px-5 pb-5 pt-2 sm:h-auto sm:bg-[var(--tl-surface)] sm:p-5" : "max-h-[92dvh] rounded-t-[26px] border p-5"
        }`}
      >
        {sheet ? (
          <div className="mb-2 flex min-h-14 items-center gap-3 sm:mb-3">
            <button
              type="button"
              data-close
              onClick={() => close.current()}
              aria-label="Close"
              className={`press glass grid h-11 w-11 shrink-0 cursor-pointer place-items-center rounded-[14px] ${focusRing}`}
            >
              <Icon name="close" size={20} />
            </button>
            <h2 id={titleId} className="m-0 min-w-0 text-dialog font-extrabold tracking-tight">
              {title}
            </h2>
          </div>
        ) : (
          <div className="mb-4 flex items-start justify-between gap-3">
            <h2 id={titleId} className="m-0 min-w-0 pt-2 text-dialog font-extrabold tracking-tight">
              {title}
            </h2>
            <button
              type="button"
              data-close
              onClick={() => close.current()}
              aria-label="Close"
              className={`press grid h-11 w-11 shrink-0 cursor-pointer place-items-center rounded-full hover:bg-[var(--tl-chip)] active:bg-[var(--tl-chip)] ${focusRing}`}
            >
              <Icon name="close" size={20} />
            </button>
          </div>
        )}
        {children}
      </div>
    </div>,
    document.body,
  );
}
