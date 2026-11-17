import { checkName } from "@takaleaf/shared";
import { useState } from "react";
import type { AuthUser } from "../src/api/client";
import { apiClient } from "../src/state/account";
import { useApp } from "../src/state/AppState";
import { useErrors } from "../src/ui/form";
import { Body, Button, Card, ErrorText, Field, Notice, Screen } from "../src/ui/kit";

export default function Account() {
  const { user, setUser } = useApp();
  const [name, setName] = useState(user?.name ?? "");
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [saved, setSaved] = useState<string | null>(null);
  const nameErrors = useErrors();
  const passwordErrors = useErrors();

  async function saveName() {
    const checked = checkName(name);
    if (checked.error) return nameErrors.setErrors({ name: checked.error });
    const ok = await nameErrors.runAsync(async () => setUser(await apiClient().request<AuthUser>("/auth/me", { method: "PUT", body: JSON.stringify({ name: checked.name }) })));
    if (ok) setSaved("Your name is saved.");
  }

  async function changePassword() {
    if (next.length < 8) return passwordErrors.setErrors({ newPassword: "Use at least 8 characters." });
    const ok = await passwordErrors.runAsync(() => apiClient().request("/auth/change-password", { method: "POST", body: JSON.stringify({ currentPassword: current, newPassword: next }) }));
    if (ok) {
      setCurrent("");
      setNext("");
      setSaved("Your password is changed. Other devices are signed out.");
    }
  }

  return (
    <Screen title="Account" back>
      {saved ? <Notice>{saved}</Notice> : null}
      <Card title="Your name">
        <Body muted>{user?.email}</Body>
        <Field label="Name" value={name} onChangeText={setName} autoComplete="name" error={nameErrors.errors.name} />
        {nameErrors.errors.form ? <ErrorText>{nameErrors.errors.form}</ErrorText> : null}
        <Button label="Save name" onPress={() => void saveName()} />
      </Card>
      <Card title="Change password">
        <Body muted>Needs a connection to your server.</Body>
        <Field label="Current password" value={current} onChangeText={setCurrent} secureTextEntry autoComplete="current-password" error={passwordErrors.errors.currentPassword} />
        <Field label="New password" value={next} onChangeText={setNext} secureTextEntry autoComplete="new-password" hint="At least 8 characters." error={passwordErrors.errors.newPassword} />
        {passwordErrors.errors.form ? <ErrorText>{passwordErrors.errors.form}</ErrorText> : null}
        <Button label="Change password" onPress={() => void changePassword()} />
      </Card>
    </Screen>
  );
}
