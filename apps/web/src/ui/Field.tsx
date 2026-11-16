import { useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes } from "react";

export const inputClass =
  "h-12 w-full rounded-[14px] border border-[var(--tl-glass-border)] bg-[var(--tl-surface)] px-3.5 text-[15px] text-[var(--tl-text)] outline-none transition placeholder:text-[var(--tl-muted)]/70 focus:border-[var(--tl-primary)] focus:ring-2 focus:ring-[var(--tl-primary)]/25 aria-[invalid=true]:border-expense dark:aria-[invalid=true]:border-expense-dark";

interface FieldShellProps {
  label: string;
  error?: string;
  hint?: ReactNode;
  children: (control: { id: string; "aria-invalid": boolean; "aria-describedby"?: string }) => ReactNode;
}

function FieldShell({ label, error, hint, children }: FieldShellProps) {
  const id = useId();
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined;
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-[13px] font-bold">
        {label}
      </label>
      {children({ id, "aria-invalid": Boolean(error), "aria-describedby": describedBy })}
      {error ? (
        <p id={`${id}-error`} className="m-0 text-[13px] font-semibold text-expense dark:text-expense-dark">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="m-0 text-[13px] text-[var(--tl-muted)]">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export function TextField({
  label,
  error,
  hint,
  className = "",
  ...input
}: InputHTMLAttributes<HTMLInputElement> & { label: string; error?: string; hint?: ReactNode }) {
  return (
    <FieldShell label={label} error={error} hint={hint}>
      {(control) => <input className={`${inputClass} ${className}`} {...control} {...input} />}
    </FieldShell>
  );
}

export function SelectField({
  label,
  error,
  hint,
  children,
  ...select
}: SelectHTMLAttributes<HTMLSelectElement> & { label: string; error?: string; hint?: ReactNode }) {
  return (
    <FieldShell label={label} error={error} hint={hint}>
      {(control) => (
        <select className={inputClass} {...control} {...select}>
          {children}
        </select>
      )}
    </FieldShell>
  );
}

/** Amount typed in taka ("1,250.50"); the form turns it into poisha with parseTaka. */
export function AmountField(props: InputHTMLAttributes<HTMLInputElement> & { label: string; error?: string; hint?: ReactNode }) {
  return <TextField inputMode="decimal" autoComplete="off" placeholder="0.00" {...props} />;
}
