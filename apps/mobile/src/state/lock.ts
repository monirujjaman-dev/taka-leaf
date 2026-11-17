import * as Crypto from "expo-crypto";
import * as LocalAuthentication from "expo-local-authentication";
import * as SecureStore from "expo-secure-store";
import { db } from "../db/client";
import { deleteSetting, getSetting, setSetting } from "../db/store";
import { newId } from "../data/ids";

const PIN_KEY = "takaleaf.pin";
export const LOCK_KEY = "lock.enabled";
export const BIOMETRIC_KEY = "lock.biometric";
const FAILURES_KEY = "lock.failures";

/** Five wrong PINs in a row sign the phone out (X-10); local data and unsent changes stay. */
export const MAX_FAILURES = 5;

export const lockEnabled = () => getSetting(db, LOCK_KEY) === "1";
export const biometricEnabled = () => getSetting(db, BIOMETRIC_KEY) === "1";
export const failures = () => Number(getSetting(db, FAILURES_KEY) ?? "0");

export const validPin = (pin: string) => /^\d{4,6}$/.test(pin);

async function hash(pin: string, salt: string): Promise<string> {
  return Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, `${salt}:${pin}`);
}

/** Turns the lock on with a new PIN; only a salted hash is kept, in the Android Keystore. */
export async function setPin(pin: string): Promise<void> {
  const salt = newId();
  await SecureStore.setItemAsync(PIN_KEY, `${salt}$${await hash(pin, salt)}`);
  setSetting(db, LOCK_KEY, "1");
  setSetting(db, FAILURES_KEY, "0");
}

export async function checkPin(pin: string): Promise<boolean> {
  const stored = await SecureStore.getItemAsync(PIN_KEY);
  if (!stored) return false;
  const [salt = "", expected] = stored.split("$");
  const ok = (await hash(pin, salt)) === expected;
  setSetting(db, FAILURES_KEY, ok ? "0" : String(failures() + 1));
  return ok;
}

export async function turnOffLock(): Promise<void> {
  await SecureStore.deleteItemAsync(PIN_KEY);
  deleteSetting(db, LOCK_KEY);
  deleteSetting(db, BIOMETRIC_KEY);
  deleteSetting(db, FAILURES_KEY);
}

export function setBiometric(on: boolean): void {
  setSetting(db, BIOMETRIC_KEY, on ? "1" : "0");
}

/** True when the phone has a fingerprint (or face) set up. */
export async function biometricAvailable(): Promise<boolean> {
  return (await LocalAuthentication.hasHardwareAsync()) && (await LocalAuthentication.isEnrolledAsync());
}

export async function unlockWithBiometric(): Promise<boolean> {
  const result = await LocalAuthentication.authenticateAsync({ promptMessage: "Unlock TakaLeaf", cancelLabel: "Use PIN", disableDeviceFallback: true });
  if (result.success) setSetting(db, FAILURES_KEY, "0");
  return result.success;
}
