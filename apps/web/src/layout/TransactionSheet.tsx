import { createContext, Suspense, useCallback, useContext, useState, type ReactNode } from "react";
import { useNavigate } from "react-router";
import type { Transaction } from "../api/types";
import { TransactionForm } from "../app/routes";
import { Loading } from "../ui/Feedback";
import { Modal } from "../ui/Modal";

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
      {state ? (
        // The form's code is fetched in the background after the first page loads; this sheet only
        // shows if someone taps Add before that finishes.
        <Suspense
          fallback={
            <Modal sheet title={state.id ? "Edit transaction" : "Add transaction"} onClose={close}>
              <Loading />
            </Modal>
          }
        >
          <TransactionForm key={state.id ?? "new"} id={state.id} onClose={close} />
        </Suspense>
      ) : null}
    </SheetContext.Provider>
  );
}

export const useTransactionSheet = () => useContext(SheetContext);

/** Opens a history row where it can be changed: a loan on its person's page, anything else in the form. */
export function useOpenTransaction() {
  const sheet = useTransactionSheet();
  const navigate = useNavigate();
  return useCallback(
    (transaction: Transaction) => (transaction.personId ? navigate(`/people/${transaction.personId}`) : sheet.open(transaction.id)),
    [sheet, navigate],
  );
}
