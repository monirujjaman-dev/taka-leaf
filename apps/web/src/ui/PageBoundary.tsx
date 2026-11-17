import { Component, type ErrorInfo, type ReactNode } from "react";
import { Button } from "./Button";

/** True when a page's code could not be fetched, usually because a newer version was deployed. */
function isChunkError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /dynamically imported module|Importing a module script failed|Failed to fetch|Loading chunk/i.test(message);
}

/**
 * Catches a page that failed to load or to draw, so one broken screen never leaves a blank app.
 * `resetKey` (the address) clears the error when the person moves to another page.
 */
export class PageBoundary extends Component<{ children: ReactNode; resetKey?: string }, { error: unknown; key?: string }> {
  state: { error: unknown; key?: string } = { error: null };

  static getDerivedStateFromError(error: unknown) {
    return { error };
  }

  static getDerivedStateFromProps(props: { resetKey?: string }, state: { error: unknown; key?: string }) {
    if (props.resetKey !== state.key) return { error: null, key: props.resetKey };
    return null;
  }

  componentDidCatch(error: unknown, info: ErrorInfo) {
    console.error(error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    const chunk = isChunkError(this.state.error);
    return (
      <div role="alert" className="flex flex-col items-center gap-3 px-4 py-10 text-center">
        <p className="m-0 text-base font-bold">{chunk ? "TakaLeaf has been updated" : "This page could not be shown"}</p>
        <p className="m-0 max-w-sm text-body text-[var(--tl-muted)]">
          {chunk
            ? "Reload to get the new version. Nothing you saved is lost."
            : "Reload to try again. Nothing you saved is lost; if it keeps happening, sign out and back in."}
        </p>
        <Button onClick={() => window.location.reload()}>Reload</Button>
      </div>
    );
  }
}
