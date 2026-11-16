import { useState, type InputHTMLAttributes } from "react";
import { TextField } from "../ui/Field";

export function PasswordField(props: InputHTMLAttributes<HTMLInputElement> & { label: string; error?: string; hint?: string }) {
  const [shown, setShown] = useState(false);
  return (
    <div className="relative">
      <TextField type={shown ? "text" : "password"} className="pr-16" {...props} />
      <button
        type="button"
        onClick={() => setShown((value) => !value)}
        className="absolute right-2 top-[30px] h-10 cursor-pointer rounded-[10px] px-2.5 text-[13px] font-bold text-[var(--tl-primary)] hover:bg-[var(--tl-chip)]"
        aria-label={shown ? `Hide ${props.label.toLowerCase()}` : `Show ${props.label.toLowerCase()}`}
      >
        {shown ? "Hide" : "Show"}
      </button>
    </div>
  );
}

export const PASSWORD_HINT = "At least 10 characters. A short sentence is easy to remember.";
