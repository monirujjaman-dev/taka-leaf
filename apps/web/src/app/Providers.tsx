import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { ApiError } from "../api/client";
import { AuthProvider } from "../auth/AuthContext";
import { ThemeProvider } from "./theme";

export function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 15_000,
        // A 4xx will not fix itself; a network blip might.
        // A timeout already waited 30 seconds; the person can choose "Try again" instead.
        retry: (count, error) =>
          !(error instanceof ApiError && ((error.status >= 400 && error.status < 500) || error.code === "timeout")) && count < 2,
      },
    },
  });
}

export function Providers({ children, client }: { children: ReactNode; client?: QueryClient }) {
  const [queryClient] = useState(() => client ?? createQueryClient());
  return (
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>{children}</AuthProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}
