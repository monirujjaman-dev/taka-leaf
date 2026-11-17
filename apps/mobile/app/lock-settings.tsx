import { useEffect, useState } from "react";
import { biometricAvailable, biometricEnabled, checkPin, lockEnabled, setBiometric, setPin, turnOffLock, validPin } from "../src/state/lock";
import { useErrors } from "../src/ui/form";
import { Body, Button, Card, ErrorText, Field, Notice, Screen, SwitchRow } from "../src/ui/kit";

export default function LockSettings() {
  const [enabled, setEnabled] = useState(lockEnabled());
  const [bio, setBio] = useState(biometricEnabled());
  const [hasBio, setHasBio] = useState(false);
  const [pin, setPinText] = useState("");
  const [again, setAgain] = useState("");
  const [current, setCurrent] = useState("");
  const [done, setDone] = useState<string | null>(null);
  const { errors, setErrors } = useErrors();

  useEffect(() => {
    void biometricAvailable().then(setHasBio);
  }, []);

  async function turnOn() {
    if (!validPin(pin)) return setErrors({ pin: "Use 4 to 6 digits." });
    if (pin !== again) return setErrors({ again: "The two PINs are not the same." });
    await setPin(pin);
    setEnabled(true);
    setPinText("");
    setAgain("");
    setErrors({});
    setDone("App lock is on. TakaLeaf asks for it when you open it.");
  }

  async function turnOff() {
    if (!(await checkPin(current))) return setErrors({ current: "That PIN is not right." });
    await turnOffLock();
    setEnabled(false);
    setBio(false);
    setCurrent("");
    setErrors({});
    setDone("App lock is off.");
  }

  return (
    <Screen title="App lock" back>
      {done ? <Notice>{done}</Notice> : null}
      <Body muted>Asks for a PIN (or your fingerprint) every time TakaLeaf opens or comes back. Five wrong PINs sign you out; your data and unsent changes stay on the phone.</Body>
      {!enabled ? (
        <Card title="Turn on">
          <Field label="New PIN" value={pin} onChangeText={setPinText} keyboardType="number-pad" secureTextEntry maxLength={6} error={errors.pin} hint="4 to 6 digits." />
          <Field label="Same PIN again" value={again} onChangeText={setAgain} keyboardType="number-pad" secureTextEntry maxLength={6} error={errors.again} />
          <Button label="Turn on app lock" onPress={() => void turnOn()} />
        </Card>
      ) : (
        <>
          {hasBio ? (
            <SwitchRow
              label="Unlock with fingerprint"
              value={bio}
              onChange={(on) => {
                setBiometric(on);
                setBio(on);
              }}
            />
          ) : (
            <Body muted>Set up a fingerprint in Android settings to unlock with it.</Body>
          )}
          <Card title="Turn off">
            <Field label="Current PIN" value={current} onChangeText={setCurrent} keyboardType="number-pad" secureTextEntry maxLength={6} error={errors.current} />
            <Button kind="secondary" label="Turn off app lock" onPress={() => void turnOff()} />
          </Card>
        </>
      )}
      {errors.form ? <ErrorText>{errors.form}</ErrorText> : null}
    </Screen>
  );
}
