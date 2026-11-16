import { useQuery } from "@tanstack/react-query";
import { Link, useSearchParams } from "react-router";
import { api } from "../api/client";
import type { MessageResponse } from "../api/types";
import { ErrorNote, Loading, SuccessNote, messageOf } from "../ui/Feedback";
import { AuthLayout, linkClass } from "./AuthLayout";

/** Opened from the link in the verification email. The link works once, so the request is not repeated. */
export function VerifyEmailPage() {
  const [params] = useSearchParams();
  const token = params.get("token") ?? "";
  const result = useQuery({
    queryKey: ["verify-email", token],
    queryFn: () => api<MessageResponse>("/auth/verify-email", { method: "POST", body: { token } }),
    enabled: token !== "",
    retry: false,
    staleTime: Infinity,
    gcTime: Infinity,
  });

  return (
    <AuthLayout title="Verify your email">
      <div className="flex flex-col gap-4">
        {token === "" ? <ErrorNote>This link is not complete. Open the link from the email again.</ErrorNote> : null}
        {result.isPending && token !== "" ? <Loading label="Verifying…" /> : null}
        {result.data ? <SuccessNote>{result.data.message}</SuccessNote> : null}
        {result.error ? <ErrorNote>{messageOf(result.error)}</ErrorNote> : null}
        <Link to="/sign-in" className={`${linkClass} text-center`}>
          Go to sign in
        </Link>
      </div>
    </AuthLayout>
  );
}
