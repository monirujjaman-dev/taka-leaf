import { useEffect, useId, useRef, type ReactNode } from "react";
import { focusRing } from "./Button";
import { Icon } from "./Icon";

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

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    const first =
      panel.current?.querySelector<HTMLElement>("[data-autofocus]") ??
      panel.current?.querySelector<HTMLElement>("input, select, textarea, button:not([data-close])");
    first?.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      previous?.focus?.();
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-6">
      <div aria-hidden="true" className="absolute inset-0 bg-night/45 backdrop-blur-[2px]" onClick={onClose} />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={`relative w-full overflow-y-auto border-[var(--tl-glass-border)] bg-[var(--tl-surface)] shadow-2xl sm:max-h-[92vh] sm:max-w-lg sm:rounded-[26px] sm:border ${
          sheet ? "h-dvh bg-[var(--tl-bg)] px-5 pb-5 pt-2 sm:h-auto sm:bg-[var(--tl-surface)] sm:p-5" : "max-h-[92vh] rounded-t-[26px] border p-5"
        }`}
      >
        {sheet ? (
          <div className="mb-2 flex h-14 items-center gap-3 sm:mb-3 sm:h-auto">
            <button
              type="button"
              data-close
              onClick={onClose}
              aria-label="Close"
              className={`glass grid h-11 w-11 shrink-0 cursor-pointer place-items-center rounded-[14px] ${focusRing}`}
            >
              <Icon name="close" size={20} />
            </button>
            <h2 id={titleId} className="m-0 text-[17px] font-extrabold tracking-tight">
              {title}
            </h2>
          </div>
        ) : (
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 id={titleId} className="m-0 text-lg font-extrabold tracking-tight">
            {title}
          </h2>
          <button
            type="button"
            data-close
            onClick={onClose}
            aria-label="Close"
            className={`grid h-11 w-11 cursor-pointer place-items-center rounded-full text-xl hover:bg-[var(--tl-chip)] ${focusRing}`}
          >
            ×
          </button>
        </div>
        )}
        {children}
      </div>
    </div>
  );
}
