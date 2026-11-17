import { MaterialCommunityIcons } from "@expo/vector-icons";
import DateTimePicker from "@react-native-community/datetimepicker";
import { formatBdt } from "@takaleaf/shared";
import { router } from "expo-router";
import { useState, type ComponentProps, type ReactNode } from "react";
import { Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View, type StyleProp, type TextInputProps, type ViewStyle } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { atLocal, dateLabel, localDate, localTime, timeLabel } from "../data/calendar";
import { useColors } from "./theme";

export type IconName = ComponentProps<typeof MaterialCommunityIcons>["name"];

export function Icon({ name, size = 22, color }: { name: IconName; size?: number; color?: string }) {
  const c = useColors();
  return <MaterialCommunityIcons name={name} size={size} color={color ?? c.text} />;
}

/** A screen: safe-area padding, a header with an optional back button and action, scrolling content. */
export function Screen({
  title,
  back = false,
  right,
  children,
  scroll = true,
  footer,
}: {
  title: string;
  back?: boolean;
  right?: ReactNode;
  children: ReactNode;
  scroll?: boolean;
  footer?: ReactNode;
}) {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const body = <View style={{ gap: 14, paddingHorizontal: 16, paddingBottom: 120 }}>{children}</View>;
  return (
    <View style={{ flex: 1, backgroundColor: c.background, paddingTop: insets.top }}>
      <View style={styles.header}>
        {back ? (
          <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={() => router.back()} style={styles.iconButton} hitSlop={8}>
            <Icon name="arrow-left" />
          </Pressable>
        ) : null}
        <Text accessibilityRole="header" numberOfLines={1} style={[styles.title, { color: c.text }]}>
          {title}
        </Text>
        <View style={{ flexDirection: "row", gap: 4 }}>{right}</View>
      </View>
      {scroll ? (
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingTop: 4 }}>
          {body}
        </ScrollView>
      ) : (
        <View style={{ flex: 1 }}>{children}</View>
      )}
      {footer ? <View style={{ paddingHorizontal: 16, paddingBottom: insets.bottom + 12, paddingTop: 8 }}>{footer}</View> : null}
    </View>
  );
}

export function HeaderButton({ icon, label, onPress }: { icon: IconName; label: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={styles.iconButton} hitSlop={6}>
      <Icon name={icon} />
    </Pressable>
  );
}

/** A glass card (radius 20), with an optional title and link. */
export function Card({ title, action, children, style }: { title?: string; action?: { label: string; onPress: () => void }; children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const c = useColors();
  return (
    <View style={[styles.card, { backgroundColor: c.glass, borderColor: c.border }, style]}>
      {title ? (
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <Text accessibilityRole="header" style={[styles.cardTitle, { color: c.text }]}>
            {title}
          </Text>
          {action ? (
            <Pressable accessibilityRole="link" onPress={action.onPress} hitSlop={10} style={{ minHeight: 32, justifyContent: "center" }}>
              <Text style={{ color: c.primary, fontWeight: "700" }}>{action.label}</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
      {children}
    </View>
  );
}

export function Body({ children, muted = false, style }: { children: ReactNode; muted?: boolean; style?: StyleProp<ViewStyle> }) {
  const c = useColors();
  return <Text style={[styles.body, { color: muted ? c.muted : c.text }, style as object]}>{children}</Text>;
}

export type Tone = "income" | "expense" | "neutral";

/** An amount in tabular figures, coloured by meaning. */
export function Money({ amount, tone = "neutral", size = 15, sign = false }: { amount: number; tone?: Tone; size?: number; sign?: boolean }) {
  const c = useColors();
  const color = tone === "income" ? c.income : tone === "expense" ? c.expense : c.text;
  const text = sign && amount > 0 ? `+${formatBdt(amount)}` : formatBdt(amount);
  return <Text style={{ color, fontSize: size, fontWeight: "800", fontVariant: ["tabular-nums"] }} numberOfLines={1}>{text}</Text>;
}

/** 48 dp buttons: solid forest (primary), glass (secondary) or rust text (danger). */
export function Button({ label, onPress, kind = "primary", disabled = false, icon }: { label: string; onPress: () => void; kind?: "primary" | "secondary" | "danger"; disabled?: boolean; icon?: IconName }) {
  const c = useColors();
  const primary = kind === "primary";
  const color = primary ? c.onPrimary : kind === "danger" ? c.expense : c.text;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        primary ? { backgroundColor: c.primary } : { backgroundColor: c.glass, borderColor: c.border, borderWidth: 1 },
        { opacity: disabled ? 0.5 : pressed ? 0.85 : 1 },
      ]}
    >
      {icon ? <Icon name={icon} size={18} color={color} /> : null}
      <Text style={[styles.buttonText, { color }]}>{label}</Text>
    </Pressable>
  );
}

/** "Delete" turns into "Yes, delete" and "Keep" in place (no dialogs). */
export function ConfirmButton({ label, confirmLabel, onConfirm }: { label: string; confirmLabel: string; onConfirm: () => void }) {
  const [asking, setAsking] = useState(false);
  if (!asking) return <Button kind="danger" label={label} onPress={() => setAsking(true)} />;
  return (
    <View style={{ flexDirection: "row", gap: 10 }}>
      <View style={{ flex: 1 }}>
        <Button kind="danger" label={confirmLabel} onPress={onConfirm} />
      </View>
      <View style={{ flex: 1 }}>
        <Button kind="secondary" label="Keep" onPress={() => setAsking(false)} />
      </View>
    </View>
  );
}

/** A labelled 50 dp field with its error underneath. */
export function Field({ label, error, hint, ...input }: TextInputProps & { label: string; error?: string | null; hint?: string }) {
  const c = useColors();
  return (
    <View style={{ gap: 6 }}>
      <Text style={[styles.label, { color: c.muted }]}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        accessibilityHint={error ?? hint}
        placeholderTextColor={c.muted}
        style={[styles.input, { color: c.text, backgroundColor: c.surface, borderColor: error ? c.expense : c.border }]}
        {...input}
      />
      {error ? <ErrorText>{error}</ErrorText> : hint ? <Text style={{ color: c.muted, fontSize: 12 }}>{hint}</Text> : null}
    </View>
  );
}

export function ErrorText({ children }: { children: ReactNode }) {
  const c = useColors();
  return (
    <Text accessibilityRole="alert" accessibilityLiveRegion="polite" style={{ color: c.expense, fontSize: 13, fontWeight: "600" }}>
      {children}
    </Text>
  );
}

export function Notice({ children, tone = "neutral" }: { children: ReactNode; tone?: Tone }) {
  const c = useColors();
  return (
    <View accessibilityLiveRegion="polite" style={{ borderRadius: 14, padding: 12, backgroundColor: tone === "expense" ? "rgba(168,65,42,0.12)" : c.chip }}>
      <Text style={{ color: tone === "expense" ? c.expense : c.text, fontSize: 14 }}>{children}</Text>
    </View>
  );
}

/** A two-to-four way switch: "Expense · Income · Transfer". */
export function Segmented<T extends string>({ options, value, onChange, label }: { options: { value: T; label: string }[]; value: T; onChange: (value: T) => void; label: string }) {
  const c = useColors();
  return (
    <View accessibilityRole="radiogroup" accessibilityLabel={label} style={[styles.segmented, { backgroundColor: c.track }]}>
      {options.map((o) => {
        const selected = o.value === value;
        return (
          <Pressable
            key={o.value}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            onPress={() => onChange(o.value)}
            style={[styles.segment, selected && { backgroundColor: c.surface }]}
          >
            <Text style={{ color: selected ? c.text : c.muted, fontWeight: "700" }}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** A list row at least 56 dp tall: icon, title and detail, amount or chevron. */
export function Row({
  title,
  detail,
  icon,
  right,
  onPress,
  dim = false,
  accessibilityLabel,
}: {
  title: string;
  detail?: string | null;
  icon?: IconName;
  right?: ReactNode;
  onPress?: () => void;
  dim?: boolean;
  accessibilityLabel?: string;
}) {
  const c = useColors();
  const content = (
    <>
      {icon ? (
        <View style={[styles.rowIcon, { backgroundColor: c.chip }]}>
          <Icon name={icon} size={20} color={c.primary} />
        </View>
      ) : null}
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text numberOfLines={1} style={{ color: c.text, fontSize: 15, fontWeight: "700" }}>
          {title}
        </Text>
        {detail ? (
          <Text numberOfLines={1} style={{ color: c.muted, fontSize: 13 }}>
            {detail}
          </Text>
        ) : null}
      </View>
      {right ?? (onPress ? <Icon name="chevron-right" color={c.muted} /> : null)}
    </>
  );
  const style = [styles.row, { opacity: dim ? 0.55 : 1 }];
  return onPress ? (
    <Pressable accessibilityRole="button" accessibilityLabel={accessibilityLabel} onPress={onPress} style={({ pressed }) => [...style, pressed && { opacity: 0.7 }]}>
      {content}
    </Pressable>
  ) : (
    <View accessibilityLabel={accessibilityLabel} style={style}>
      {content}
    </View>
  );
}

export function Chip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  const c = useColors();
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[styles.chip, { backgroundColor: selected ? c.primary : c.chip, borderColor: selected ? c.primary : c.border }]}
    >
      <Text numberOfLines={1} style={{ color: selected ? c.onPrimary : c.text, fontWeight: "700", fontSize: 14 }}>
        {label}
      </Text>
    </Pressable>
  );
}

export interface Option {
  id: string;
  label: string;
  detail?: string;
  group?: string;
}

/** Choose one from a list: a row showing the choice that opens the options in place. */
export function Picker({ label, options, value, onChange, placeholder = "Choose", allowNone, error }: { label: string; options: Option[]; value: string | null; onChange: (id: string | null) => void; placeholder?: string; allowNone?: string; error?: string | null }) {
  const c = useColors();
  const [open, setOpen] = useState(false);
  const chosen = options.find((o) => o.id === value);
  return (
    <View style={{ gap: 6 }}>
      <Text style={[styles.label, { color: c.muted }]}>{label}</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${chosen?.label ?? placeholder}`}
        accessibilityState={{ expanded: open }}
        onPress={() => setOpen(!open)}
        style={[styles.input, { backgroundColor: c.surface, borderColor: error ? c.expense : c.border, flexDirection: "row", alignItems: "center" }]}
      >
        <Text style={{ flex: 1, color: chosen ? c.text : c.muted, fontSize: 15 }} numberOfLines={1}>
          {chosen ? (chosen.group && chosen.group !== chosen.label ? `${chosen.group} › ${chosen.label}` : chosen.label) : placeholder}
        </Text>
        <Icon name={open ? "chevron-up" : "chevron-down"} color={c.muted} />
      </Pressable>
      {error ? <ErrorText>{error}</ErrorText> : null}
      {open ? (
        <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border, padding: 6, gap: 0 }]}>
          {allowNone ? <PickerItem label={allowNone} selected={value === null} onPress={() => (onChange(null), setOpen(false))} /> : null}
          {options.map((o) => (
            <PickerItem key={o.id} label={o.label} detail={o.detail} indent={Boolean(o.group && o.group !== o.label)} selected={o.id === value} onPress={() => (onChange(o.id), setOpen(false))} />
          ))}
          {options.length === 0 ? <Body muted>Nothing to choose yet.</Body> : null}
        </View>
      ) : null}
    </View>
  );
}

function PickerItem({ label, detail, selected, indent, onPress }: { label: string; detail?: string; selected: boolean; indent?: boolean; onPress: () => void }) {
  const c = useColors();
  return (
    <Pressable accessibilityRole="radio" accessibilityState={{ selected }} onPress={onPress} style={[styles.pickerItem, { paddingLeft: indent ? 28 : 12 }, selected && { backgroundColor: c.chip }]}>
      <Text style={{ flex: 1, color: c.text, fontWeight: selected ? "800" : "500" }} numberOfLines={1}>
        {label}
      </Text>
      {detail ? <Text style={{ color: c.muted }}>{detail}</Text> : null}
      {selected ? <Icon name="check" size={18} color={c.primary} /> : null}
    </Pressable>
  );
}

/** Date (and optionally time) in local time, stored as a UTC ISO string. */
export function DateTimeField({ label, value, onChange, withTime = true }: { label: string; value: string; onChange: (iso: string) => void; withTime?: boolean }) {
  const c = useColors();
  const [mode, setMode] = useState<"date" | "time" | null>(null);
  const date = localDate(value);
  const time = localTime(value);
  return (
    <View style={{ gap: 6 }}>
      <Text style={[styles.label, { color: c.muted }]}>{label}</Text>
      <View style={{ flexDirection: "row", gap: 10 }}>
        <Pressable accessibilityRole="button" accessibilityLabel={`${label}: ${dateLabel(date)}`} onPress={() => setMode("date")} style={[styles.input, { flex: 1, justifyContent: "center", backgroundColor: c.surface, borderColor: c.border }]}>
          <Text style={{ color: c.text, fontSize: 15 }}>{dateLabel(date)}</Text>
        </Pressable>
        {withTime ? (
          <Pressable accessibilityRole="button" accessibilityLabel={`Time: ${timeLabel(value)}`} onPress={() => setMode("time")} style={[styles.input, { width: 120, justifyContent: "center", backgroundColor: c.surface, borderColor: c.border }]}>
            <Text style={{ color: c.text, fontSize: 15 }}>{timeLabel(value)}</Text>
          </Pressable>
        ) : null}
      </View>
      {mode ? (
        <DateTimePicker
          value={new Date(value)}
          mode={mode}
          timeZoneName="Asia/Dhaka"
          onChange={(event, picked) => {
            setMode(null);
            if (event.type !== "set" || !picked) return;
            const iso = picked.toISOString();
            onChange(mode === "date" ? atLocal(localDate(iso), time) : atLocal(date, localTime(iso)));
          }}
        />
      ) : null}
    </View>
  );
}

/** A local date only ("yyyy-MM-dd"). */
export function DateField({ label, value, onChange, optional }: { label: string; value: string | null; onChange: (date: string | null) => void; optional?: string }) {
  const c = useColors();
  const [open, setOpen] = useState(false);
  return (
    <View style={{ gap: 6 }}>
      <Text style={[styles.label, { color: c.muted }]}>{label}</Text>
      <View style={{ flexDirection: "row", gap: 10 }}>
        <Pressable accessibilityRole="button" accessibilityLabel={`${label}: ${value ? dateLabel(value) : (optional ?? "none")}`} onPress={() => setOpen(true)} style={[styles.input, { flex: 1, justifyContent: "center", backgroundColor: c.surface, borderColor: c.border }]}>
          <Text style={{ color: value ? c.text : c.muted, fontSize: 15 }}>{value ? dateLabel(value) : (optional ?? "Choose")}</Text>
        </Pressable>
        {optional && value ? <Button kind="secondary" label="Clear" onPress={() => onChange(null)} /> : null}
      </View>
      {open ? (
        <DateTimePicker
          value={new Date(atLocal(value ?? localDate(new Date()), "12:00"))}
          mode="date"
          timeZoneName="Asia/Dhaka"
          onChange={(event, picked) => {
            setOpen(false);
            if (event.type === "set" && picked) onChange(localDate(picked));
          }}
        />
      ) : null}
    </View>
  );
}

export function SwitchRow({ label, detail, value, onChange }: { label: string; detail?: string; value: boolean; onChange: (value: boolean) => void }) {
  const c = useColors();
  return (
    <View style={[styles.row, { minHeight: 56 }]}>
      <View style={{ flex: 1 }}>
        <Text style={{ color: c.text, fontSize: 15, fontWeight: "700" }}>{label}</Text>
        {detail ? <Text style={{ color: c.muted, fontSize: 13 }}>{detail}</Text> : null}
      </View>
      <Switch accessibilityLabel={label} value={value} onValueChange={onChange} trackColor={{ true: c.primary, false: c.track }} />
    </View>
  );
}

/** A progress bar; the label says the state in words, not by colour alone. */
export function Bar({ percent, tone = "income" }: { percent: number; tone?: Tone }) {
  const c = useColors();
  return (
    <View style={{ height: 8, borderRadius: 4, backgroundColor: c.track, overflow: "hidden" }}>
      <View style={{ width: `${Math.max(0, Math.min(100, percent))}%`, height: 8, borderRadius: 4, backgroundColor: tone === "expense" ? c.expense : tone === "neutral" ? "#C98A1B" : c.primary }} />
    </View>
  );
}

export function Empty({ title, detail, action }: { title: string; detail?: string; action?: { label: string; onPress: () => void } }) {
  return (
    <Card>
      <Body>{title}</Body>
      {detail ? <Body muted>{detail}</Body> : null}
      {action ? <Button label={action.label} onPress={action.onPress} /> : null}
    </Card>
  );
}

/** The amount entry: 1–9, ".", 0 and delete, at least 56 dp per key. */
export function NumberPad({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const c = useColors();
  const press = (key: string) => {
    if (key === "del") return onChange(value.slice(0, -1));
    if (key === ".") return value.includes(".") ? undefined : onChange(value === "" ? "0." : `${value}.`);
    const [, fraction] = value.split(".");
    if (fraction !== undefined && fraction.length >= 2) return;
    if (value.replace(".", "").length >= 13) return;
    onChange(value === "0" ? key : value + key);
  };
  const keys = ["1", "2", "3", "4", "5", "6", "7", "8", "9", ".", "0", "del"];
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
      {keys.map((key) => (
        <Pressable
          key={key}
          accessibilityRole="button"
          accessibilityLabel={key === "del" ? "Delete digit" : key === "." ? "Decimal point" : key}
          onPress={() => press(key)}
          style={({ pressed }) => [styles.key, { backgroundColor: pressed ? c.chip : c.glass, borderColor: c.border }]}
        >
          {key === "del" ? <Icon name="backspace-outline" /> : <Text style={{ color: c.text, fontSize: 24, fontWeight: "700" }}>{key}</Text>}
        </Pressable>
      ))}
    </View>
  );
}

/** "1250.5" from the pad → "1,250.5" for display. */
export function groupTyped(value: string): string {
  if (!value) return "0";
  const [whole = "0", fraction] = value.split(".");
  const digits = whole.replace(/^0+(?=\d)/, "");
  const tail = digits.slice(-3);
  let head = digits.slice(0, -3);
  const parts: string[] = [];
  while (head.length > 2) {
    parts.unshift(head.slice(-2));
    head = head.slice(0, -2);
  }
  if (head) parts.unshift(head);
  const grouped = parts.length ? `${parts.join(",")},${tail}` : tail;
  return fraction === undefined ? grouped : `${grouped}.${fraction}`;
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 12, minHeight: 56 },
  title: { flex: 1, fontSize: 22, fontWeight: "800", paddingHorizontal: 4 },
  iconButton: { width: 48, height: 48, alignItems: "center", justifyContent: "center", borderRadius: 24 },
  card: { borderRadius: 20, borderWidth: 1, padding: 16, gap: 12 },
  cardTitle: { fontSize: 16, fontWeight: "800" },
  body: { fontSize: 14, lineHeight: 20 },
  button: { minHeight: 48, borderRadius: 16, alignItems: "center", justifyContent: "center", paddingHorizontal: 16, flexDirection: "row", gap: 8 },
  buttonText: { fontSize: 15, fontWeight: "800" },
  label: { fontSize: 13, fontWeight: "600" },
  input: { minHeight: 50, borderRadius: 16, borderWidth: 1, paddingHorizontal: 16, fontSize: 15 },
  segmented: { flexDirection: "row", borderRadius: 16, padding: 4, gap: 4 },
  segment: { flex: 1, minHeight: 44, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  row: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 56, paddingVertical: 6 },
  rowIcon: { width: 40, height: 40, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  chip: { minHeight: 44, borderRadius: 22, paddingHorizontal: 16, alignItems: "center", justifyContent: "center", borderWidth: 1 },
  pickerItem: { minHeight: 48, flexDirection: "row", alignItems: "center", gap: 8, paddingRight: 12, borderRadius: 12 },
  key: { width: "31.5%", height: 56, borderRadius: 16, borderWidth: 1, alignItems: "center", justifyContent: "center" },
});
