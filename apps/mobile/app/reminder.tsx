import DateTimePicker from "@react-native-community/datetimepicker";
import { useState } from "react";
import { reminderTime, turnOffReminder, turnOnReminder } from "../src/state/reminder";
import { Body, Button, Card, Notice, Screen, SwitchRow } from "../src/ui/kit";

const pad = (n: number) => n.toString().padStart(2, "0");
const label = (time: string) => {
  const [h = 0, m = 0] = time.split(":").map(Number);
  return `${h % 12 === 0 ? 12 : h % 12}:${pad(m)} ${h < 12 ? "am" : "pm"}`;
};

export default function Reminder() {
  const [time, setTime] = useState(reminderTime() ?? "21:00");
  const [on, setOn] = useState(reminderTime() !== null);
  const [picking, setPicking] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function apply(nextOn: boolean, nextTime: string) {
    if (nextOn) {
      const ok = await turnOnReminder(nextTime);
      setOn(ok);
      setMessage(ok ? `You'll get a reminder every day at ${label(nextTime)}.` : "Notifications are not allowed for TakaLeaf. Allow them in Android settings.");
    } else {
      await turnOffReminder();
      setOn(false);
      setMessage("The daily reminder is off.");
    }
  }

  return (
    <Screen title="Daily reminder" back>
      {message ? <Notice>{message}</Notice> : null}
      <Card>
        <SwitchRow label="Remind me every day" detail="A gentle nudge to note down the day's spending." value={on} onChange={(v) => void apply(v, time)} />
        <Body muted>At {label(time)}</Body>
        <Button kind="secondary" label="Change the time" onPress={() => setPicking(true)} />
      </Card>
      {picking ? (
        <DateTimePicker
          value={new Date(2026, 0, 1, Number(time.split(":")[0]), Number(time.split(":")[1]))}
          mode="time"
          onChange={(event, picked) => {
            setPicking(false);
            if (event.type !== "set" || !picked) return;
            const next = `${pad(picked.getHours())}:${pad(picked.getMinutes())}`;
            setTime(next);
            if (on) void apply(true, next);
          }}
        />
      ) : null}
    </Screen>
  );
}
