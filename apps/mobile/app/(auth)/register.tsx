import { checkName } from "@takaleaf/shared";
import { router } from "expo-router";
import { useState } from "react";
import { apiClient } from "../../src/state/account";
import { AuthFrame } from "../../src/ui/AuthFrame";
import { useErrors } from "../../src/ui/form";
import { Body, Button, ErrorText, Field, Notice } from "../../src/ui/kit";

const PASSWORD_MIN = 8;

export default function Register() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const { errors, setErrors, runAsync } = useErrors();

  async function submit() {
    const checked = checkName(name);
    if (checked.error) return setErrors({ name: checked.error });
    if (!email.trim()) return setErrors({ email: "Enter your email." });
    if (password.length < PASSWORD_MIN) return setErrors({ password: `Use at least ${PASSWORD_MIN} characters.` });
    setBusy(true);
    const ok = await runAsync(() => apiClient().anonymous("/auth/register", { name: checked.name, email: email.trim(), password }));
    setBusy(false);
    if (ok) setSent(true);
  }

  if (sent) {
    return (
      <AuthFrame title="Check your email">
        <Notice>We sent a link to {email.trim()}. Open it on any device to verify your address, then sign in here.</Notice>
        <Button label="Back to sign in" onPress={() => router.replace("/sign-in")} />
      </AuthFrame>
    );
  }

  return (
    <AuthFrame title="Create account">
      <Field label="Your name" value={name} onChangeText={setName} autoComplete="name" textContentType="name" error={errors.name} hint="How TakaLeaf greets you." />
      <Field label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" autoComplete="email" keyboardType="email-address" error={errors.email} />
      <Field label="Password" value={password} onChangeText={setPassword} secureTextEntry autoComplete="new-password" error={errors.password} hint={`At least ${PASSWORD_MIN} characters.`} />
      {errors.form ? <ErrorText>{errors.form}</ErrorText> : null}
      <Button label={busy ? "Creating…" : "Create account"} disabled={busy} onPress={() => void submit()} />
      <Body muted>Already have an account?</Body>
      <Button kind="secondary" label="Sign in" onPress={() => router.back()} />
    </AuthFrame>
  );
}
