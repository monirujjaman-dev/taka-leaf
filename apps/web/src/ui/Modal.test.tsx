import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { Modal } from "./Modal";

function Form({ onClose }: { onClose: () => void }) {
  const [, setTick] = useState(0);
  return (
    <>
      <button type="button" onClick={() => setTick((t) => t + 1)}>
        Opener
      </button>
      <Modal title="Add a wallet" onClose={() => onClose()}>
        <label htmlFor="n">Name</label>
        <input id="n" />
        <label htmlFor="o">Opening balance</label>
        <input id="o" />
        <button type="button">Save</button>
      </Modal>
    </>
  );
}

describe("Modal", () => {
  it("keeps Tab inside the dialog, in both directions", async () => {
    const user = userEvent.setup();
    render(<Form onClose={() => {}} />);
    expect(screen.getByLabelText("Name")).toHaveFocus();

    await user.tab({ shift: true });
    expect(screen.getByRole("button", { name: "Close" })).toHaveFocus();
    // Close is the first control, so Shift+Tab wraps to the last one rather than leaving the dialog.
    await user.tab({ shift: true });
    expect(screen.getByRole("button", { name: "Save" })).toHaveFocus();
    await user.tab();
    expect(screen.getByRole("button", { name: "Close" })).toHaveFocus();
  });

  it("does not move focus when the page behind re-renders", async () => {
    const user = userEvent.setup();
    render(<Form onClose={() => {}} />);
    await user.click(screen.getByLabelText("Opening balance"));
    // The parent re-renders and hands the dialog a new onClose.
    fireEvent.click(screen.getByRole("button", { name: "Opener", hidden: true }));
    expect(screen.getByLabelText("Opening balance")).toHaveFocus();
  });

  it("closes on Escape and stops the page scrolling while open", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const { unmount } = render(<Form onClose={onClose} />);
    expect(document.body.style.overflow).toBe("hidden");
    await user.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalledOnce();
    unmount();
    expect(document.body.style.overflow).toBe("");
  });
});
