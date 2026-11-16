import { useEffect, useState } from "react";

export type Health = "checking" | "connected" | "unreachable";

/** Asks the backend's health endpoint once, so the first screen shows whether the API is up. */
export function useBackendHealth(): Health {
  const [health, setHealth] = useState<Health>("checking");

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/health", { signal: controller.signal })
      .then((response) => setHealth(response.ok ? "connected" : "unreachable"))
      .catch((error: unknown) => {
        if (!(error instanceof DOMException && error.name === "AbortError")) setHealth("unreachable");
      });
    return () => controller.abort();
  }, []);

  return health;
}
