import * as Notifications from "expo-notifications";
import { db } from "../db/client";
import { deleteSetting, getSetting, setSetting } from "../db/store";

const REMINDER_KEY = "reminder.time";
const CHANNEL = "daily-reminder";

/** "21:00" when the daily reminder is on, otherwise null. */
export const reminderTime = () => getSetting(db, REMINDER_KEY);

export function parseTime(value: string): { hour: number; minute: number } | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value);
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  return hour < 24 && minute < 60 ? { hour, minute } : null;
}

/** Asks for permission (Android 13+), then schedules one notification a day at the time. False when not allowed. */
export async function turnOnReminder(time: string): Promise<boolean> {
  const parsed = parseTime(time);
  if (!parsed) return false;
  let { status } = await Notifications.getPermissionsAsync();
  if (status !== "granted") status = (await Notifications.requestPermissionsAsync()).status;
  if (status !== "granted") return false;
  await Notifications.setNotificationChannelAsync(CHANNEL, { name: "Daily reminder", importance: Notifications.AndroidImportance.DEFAULT });
  await Notifications.cancelAllScheduledNotificationsAsync();
  await Notifications.scheduleNotificationAsync({
    content: { title: "TakaLeaf", body: "Anything to note down today? It takes a few seconds." },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.DAILY, hour: parsed.hour, minute: parsed.minute, channelId: CHANNEL },
  });
  setSetting(db, REMINDER_KEY, time);
  return true;
}

export async function turnOffReminder(): Promise<void> {
  await Notifications.cancelAllScheduledNotificationsAsync();
  deleteSetting(db, REMINDER_KEY);
}
