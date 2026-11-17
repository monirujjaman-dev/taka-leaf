import { useState } from "react";
import { ApiError } from "../api/client";
import { FieldError } from "../data/write";

/** Runs a save and turns its mistakes into messages beside the fields (or one message for the form). */
export function useErrors() {
  const [errors, setErrors] = useState<Record<string, string>>({});
  function capture(error: unknown) {
    if (error instanceof FieldError) setErrors({ [error.field]: error.message });
    else if (error instanceof ApiError && Object.keys(error.fields).length) setErrors(error.fields);
    else setErrors({ form: error instanceof Error ? error.message : "Something went wrong. Try again." });
  }
  return {
    errors,
    setErrors,
    clear: () => setErrors({}),
    /** True when the action ran without a problem. */
    run(action: () => void): boolean {
      try {
        action();
        setErrors({});
        return true;
      } catch (error) {
        capture(error);
        return false;
      }
    },
    async runAsync(action: () => Promise<void>): Promise<boolean> {
      try {
        await action();
        setErrors({});
        return true;
      } catch (error) {
        capture(error);
        return false;
      }
    },
  };
}
