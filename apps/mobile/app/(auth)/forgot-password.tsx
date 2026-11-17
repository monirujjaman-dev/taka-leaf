import { router } from "expo-router";
import { useState } from "react";
import { apiClient } from "../../src/state/account";
import { AuthFrame } from "../../src/ui/AuthFrame";
import { useErrors } from "../../src/ui/form";
import { Button, ErrorText, Field, Notice } from "../../src/ui/kit";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const { errors, setErrors, runAsync } = useErrors();

  async function submit() {
    if (!email.trim()) return setErrors({ email: "Enter your email." });
    setBusy(true);
    const ok = await runAsync(() => apiClient().anonymous("/auth/forgot-password", { email: email.trim() }));
    setBusy(false);
    if (ok) setSent(true);
  }

  return (
    <AuthFrame title="Forgot password">
      {sent ? (
        <>
          <Notice>If {email.trim()} has an account, a link to choose a new password is on its way. It works once, for 30 minutes.</Notice>
          <Button label="Back to sign in" onPress={() => router.back()} />
        </>
      ) : (
        <>
          <Field label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" autoComplete="email" error={errors.email} />
          {errors.form ? <ErrorText>{errors.form}</ErrorText> : null}
          <Button label={busy ? "Sending…" : "Send the link"} disabled={busy} onPress={() => void submit()} />
          <Button kind="secondary" label="Back to sign in" onPress={() => router.back()} />
        </>
      )}
    </AuthFrame>
  );
}
