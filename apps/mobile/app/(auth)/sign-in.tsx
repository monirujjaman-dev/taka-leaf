import { router } from "expo-router";
import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { ApiError } from "../../src/api/client";
import { normaliseServerUrl } from "../../src/api/health";
import { db } from "../../src/db/client";
import { setSetting } from "../../src/db/store";
import { SERVER_URL_KEY, serverUrl } from "../../src/state/account";
import { useApp } from "../../src/state/AppState";
import { AuthFrame } from "../../src/ui/AuthFrame";
import { useErrors } from "../../src/ui/form";
import { Button, ErrorText, Field, Notice } from "../../src/ui/kit";
import { useColors } from "../../src/ui/theme";

export default function SignIn() {
  const c = useColors();
  const { signIn } = useApp();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [server, setServer] = useState(serverUrl());
  const [editingServer, setEditingServer] = useState(false);
  const [busy, setBusy] = useState(false);
  const [unverified, setUnverified] = useState(false);
  const { errors, setErrors, runAsync } = useErrors();

  async function submit() {
    const url = normaliseServerUrl(server);
    if (!url) return setErrors({ server: "Enter the server address, like takaleaf.example.com." });
    if (!email.trim()) return setErrors({ email: "Enter your email." });
    if (!password) return setErrors({ password: "Enter your password." });
    setSetting(db, SERVER_URL_KEY, url);
    setBusy(true);
    setUnverified(false);
    await runAsync(async () => {
      try {
        await signIn(email.trim(), password);
      } catch (error) {
        if (error instanceof ApiError && error.status === 403) setUnverified(true);
        throw error;
      }
    });
    setBusy(false);
  }

  return (
    <AuthFrame title="Welcome back">
      <Field label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" autoComplete="email" keyboardType="email-address" textContentType="emailAddress" error={errors.email} />
      <Field label="Password" value={password} onChangeText={setPassword} secureTextEntry={!show} autoComplete="current-password" error={errors.password} onSubmitEditing={() => void submit()} />
      <Pressable accessibilityRole="switch" accessibilityState={{ checked: show }} onPress={() => setShow(!show)} style={{ minHeight: 44, justifyContent: "center" }}>
        <Text style={{ color: c.primary, fontWeight: "700" }}>{show ? "Hide password" : "Show password"}</Text>
      </Pressable>
      {errors.form ? <ErrorText>{errors.form}</ErrorText> : null}
      {unverified ? <Notice>Open the link we emailed you to verify your address, then sign in.</Notice> : null}
      <Button label={busy ? "Signing in…" : "Sign in"} disabled={busy} onPress={() => void submit()} />
      <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
        <Pressable accessibilityRole="link" onPress={() => router.push("/forgot-password")} style={{ minHeight: 44, justifyContent: "center" }}>
          <Text style={{ color: c.primary, fontWeight: "700" }}>Forgot password?</Text>
        </Pressable>
        <Pressable accessibilityRole="link" onPress={() => router.push("/register")} style={{ minHeight: 44, justifyContent: "center" }}>
          <Text style={{ color: c.primary, fontWeight: "700" }}>Create account</Text>
        </Pressable>
      </View>
      {editingServer ? (
        <Field label="Server address" value={server} onChangeText={setServer} autoCapitalize="none" keyboardType="url" error={errors.server} hint="Where your TakaLeaf runs, like takaleaf.example.com." />
      ) : (
        <Pressable accessibilityRole="button" accessibilityLabel={`Server: ${server}. Change`} onPress={() => setEditingServer(true)} style={{ minHeight: 44, justifyContent: "center" }}>
          <Text style={{ color: c.muted }}>
            Server: {server.replace(/^https?:\/\//, "")} · <Text style={{ color: c.primary, fontWeight: "700" }}>Change</Text>
          </Text>
        </Pressable>
      )}
    </AuthFrame>
  );
}
