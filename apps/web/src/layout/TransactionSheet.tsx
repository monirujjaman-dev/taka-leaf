import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import { TransactionForm } from "../pages/transactions/TransactionForm";

interface SheetValue {
  /** Opens the form: empty for a new transaction, or with an id to edit one. */
  open: (id?: string) => void;
}

const SheetContext = createContext<SheetValue>({ open: () => {} });

/** One transaction form for the whole app, opened from the add button, the dashboard or the history. */
export function TransactionSheetProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<{ id: string | null } | null>(null);
  const open = useCallback((id?: string) => setState({ id: id ?? null }), []);
  const close = useCallback(() => setState(null), []);

  return (
    <SheetContext.Provider value={{ open }}>
      {children}
      {state ? <TransactionForm key={state.id ?? "new"} id={state.id} onClose={close} /> : null}
    </SheetContext.Provider>
  );
}

export const useTransactionSheet = () => useContext(SheetContext);
