import { MaterialCommunityIcons } from "@expo/vector-icons";
import DateTimePicker from "@react-native-community/datetimepicker";
import { formatBdt } from "@takaleaf/shared";
import { router } from "expo-router";
import { useEffect, useRef, useState, type ComponentProps, type ReactNode } from "react";
import { Animated, KeyboardAvoidingView, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View, type StyleProp, type TextInputProps, type ViewStyle } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { atLocal, dateLabel, localDate, localTime, timeLabel } from "../data/calendar";
import { AnimatedPressable, MOTION, usePressScale, useReduceMotion } from "./motion";
import { useColors } from "./theme";

export type IconName = ComponentProps<typeof MaterialCommunityIcons>["name"];

export function Icon({ name, size = 22, color }: { name: IconName; size?: number; color?: string }) {
  const c = useColors();
  return <MaterialCommunityIcons name={name} size={size} color={color ?? c.text} />;
}

/** The floating tab bar: its height and its gap above the system navigation bar. */
export const TAB_BAR = { height: 68, gap: 10, maxWidth: 448 } as const;

/** On tablets, foldables and phones on their side, screens keep a phone-width column, centred. */
export const COLUMN_MAX = 600;
const column = { width: "100%", maxWidth: COLUMN_MAX, alignSelf: "center" } as const;

/**
 * A screen: safe-area padding, a header with an optional back button and action, scrolling content.
 * Screens without a back button are tabs, so their content clears the floating tab bar. The keyboard
 * pushes the content and footer up (the app draws edge to edge, so Android no longer resizes it).
 */
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
  const tabClearance = insets.bottom + TAB_BAR.gap + TAB_BAR.height + 16;
  const bottom = back ? (footer ? 16 : insets.bottom + 24) : tabClearance;
  const body = <View style={[column, { gap: 14, paddingHorizontal: 16, paddingBottom: bottom }]}>{children}</View>;
  return (
    <KeyboardAvoidingView behavior="padding" style={{ flex: 1, backgroundColor: c.background, paddingTop: insets.top }}>
      <View style={[styles.header, column]}>
        {back ? <HeaderButton icon="arrow-left" label="Back" onPress={() => router.back()} /> : null}
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
        <View style={[column, { flex: 1 }]}>{children}</View>
      )}
      {footer ? <View style={[column, { paddingHorizontal: 16, paddingBottom: insets.bottom + 12, paddingTop: 8 }]}>{footer}</View> : null}
    </KeyboardAvoidingView>
  );
}

/** A round 48 dp icon button: Android's borderless ripple, centred on the icon. */
export function HeaderButton({ icon, label, onPress, disabled = false }: { icon: IconName; label: string; onPress: () => void; disabled?: boolean }) {
  const c = useColors();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      android_ripple={{ color: c.ripple, borderless: true, radius: 24 }}
      style={[styles.iconButton, disabled && { opacity: 0.4 }]}
      hitSlop={6}
    >
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
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <Text accessibilityRole="header" style={[styles.cardTitle, { color: c.text, flexShrink: 1 }]}>
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

/** An amount in tabular figures, coloured by meaning. In a tight spot it shrinks rather than cut off digits. */
export function Money({ amount, tone = "neutral", size = 15, sign = false }: { amount: number; tone?: Tone; size?: number; sign?: boolean }) {
  const c = useColors();
  const color = tone === "income" ? c.income : tone === "expense" ? c.expense : c.text;
  const text = sign && amount > 0 ? `+${formatBdt(amount)}` : formatBdt(amount);
  return (
    <Text style={{ color, fontSize: size, fontWeight: "800", fontVariant: ["tabular-nums"] }} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.5}>
      {text}
    </Text>
  );
}

/** A second tap this soon after the first is ignored, so a quick double tap cannot save (or delete) twice. */
export const REPEAT_TAP_MS = 700;

/**
 * 48 dp buttons that ripple and press to 0.97: solid forest (primary), glass (secondary), glass with
 * rust text (quiet danger, the first "Delete"), or solid rust (danger, the "Yes, delete" that does it).
 */
export function Button({ label, onPress, kind = "primary", disabled = false, icon }: { label: string; onPress: () => void; kind?: "primary" | "secondary" | "danger" | "quietDanger"; disabled?: boolean; icon?: IconName }) {
  const c = useColors();
  const lastTap = useRef(0);
  const press = usePressScale();
  const primary = kind === "primary";
  const solid = primary || kind === "danger";
  const color = primary ? c.onPrimary : kind === "danger" ? c.onExpense : kind === "quietDanger" ? c.expense : c.text;
  return (
    <AnimatedPressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPressIn={press.onPressIn}
      onPressOut={press.onPressOut}
      onPress={() => {
        const now = Date.now();
        if (now - lastTap.current < REPEAT_TAP_MS) return;
        lastTap.current = now;
        onPress();
      }}
      android_ripple={{ color: solid ? c.rippleOnPrimary : c.ripple }}
      style={[
        styles.button,
        primary ? { backgroundColor: c.primary } : kind === "danger" ? { backgroundColor: c.expense } : { backgroundColor: c.glass, borderColor: c.border, borderWidth: 1 },
        { opacity: disabled ? 0.5 : 1, transform: [{ scale: press.scale }] },
      ]}
    >
      {icon ? <Icon name={icon} size={18} color={color} /> : null}
      <Text style={[styles.buttonText, { color }]}>{label}</Text>
    </AnimatedPressable>
  );
}

/** "Delete" turns into "Yes, delete" and "Keep" in place (no dialogs). */
export function ConfirmButton({ label, confirmLabel, onConfirm }: { label: string; confirmLabel: string; onConfirm: () => void }) {
  const [asking, setAsking] = useState(false);
  if (!asking) return <Button kind="quietDanger" label={label} onPress={() => setAsking(true)} />;
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
    <View accessibilityLiveRegion="polite" style={{ borderRadius: 14, padding: 12, backgroundColor: tone === "expense" ? c.expenseTint : c.chip }}>
      <Text style={{ color: tone === "expense" ? c.expense : c.text, fontSize: 14 }}>{children}</Text>
    </View>
  );
}

const SEGMENT_PAD = 4;

/**
 * A two-to-four way switch: "Expense · Income · Transfer". The chosen pill slides to the new option,
 * so the eye follows the change (it jumps with reduce motion). Options share the width equally, so
 * only the pill's position moves.
 */
export function Segmented<T extends string>({ options, value, onChange, label }: { options: { value: T; label: string }[]; value: T; onChange: (value: T) => void; label: string }) {
  const c = useColors();
  const reduce = useReduceMotion();
  const [trackWidth, setTrackWidth] = useState(0);
  const index = Math.max(0, options.findIndex((o) => o.value === value));
  const segment = trackWidth ? (trackWidth - SEGMENT_PAD * 2 - SEGMENT_PAD * (options.length - 1)) / options.length : 0;
  const x = useRef(new Animated.Value(0)).current;
  const placed = useRef(false);

  useEffect(() => {
    if (!segment) return;
    const to = index * (segment + SEGMENT_PAD);
    // The first placement and reduce motion jump; a change the person made slides.
    if (!placed.current || reduce) {
      x.setValue(to);
      placed.current = true;
      return;
    }
    const slide = Animated.timing(x, { toValue: to, duration: MOTION.slideMs, easing: MOTION.easeOut, useNativeDriver: true });
    slide.start();
    return () => slide.stop();
  }, [index, segment, reduce, x]);

  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel={label}
      onLayout={(e) => setTrackWidth(e.nativeEvent.layout.width)}
      style={[styles.segmented, { backgroundColor: c.track }]}
    >
      {segment ? (
        <Animated.View
          pointerEvents="none"
          style={[styles.segmentPill, { width: segment, backgroundColor: c.hero, transform: [{ translateX: x }] }]}
        />
      ) : null}
      {options.map((o) => {
        const selected = o.value === value;
        return (
          <Pressable
            key={o.value}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            onPress={() => onChange(o.value)}
            android_ripple={{ color: c.ripple }}
            // Until the track is measured, the chosen option carries its own background.
            style={[styles.segment, selected && !segment && { backgroundColor: c.hero }]}
          >
            <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={{ color: selected ? c.onHero : c.muted, fontWeight: "700", paddingHorizontal: 4 }}>
              {o.label}
            </Text>
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
    // The ripple reaches 8 dp past the content on each side, so it does not cut against the icon or amount.
    <Pressable accessibilityRole="button" accessibilityLabel={accessibilityLabel} onPress={onPress} android_ripple={{ color: c.ripple }} style={[...style, styles.rowPressable]}>
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
  const press = usePressScale();
  return (
    <AnimatedPressable
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      onPress={onPress}
      onPressIn={press.onPressIn}
      onPressOut={press.onPressOut}
      android_ripple={{ color: c.ripple }}
      style={[styles.chip, { backgroundColor: c.chip, borderColor: selected ? c.primary : c.border, transform: [{ scale: press.scale }] }]}
    >
      <Text numberOfLines={1} style={{ color: selected ? c.primary : c.text, fontWeight: "700", fontSize: 14 }}>
        {label}
      </Text>
    </AnimatedPressable>
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
    <Pressable accessibilityRole="radio" accessibilityState={{ selected }} onPress={onPress} android_ripple={{ color: c.ripple }} style={[styles.pickerItem, { paddingLeft: indent ? 28 : 12 }, selected && { backgroundColor: c.chip }]}>
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
          <Pressable accessibilityRole="button" accessibilityLabel={`Time: ${timeLabel(value)}`} onPress={() => setMode("time")} style={[styles.input, { minWidth: 120, justifyContent: "center", backgroundColor: c.surface, borderColor: c.border }]}>
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
      <View style={{ width: `${Math.max(0, Math.min(100, percent))}%`, height: 8, borderRadius: 4, backgroundColor: tone === "expense" ? c.expense : tone === "neutral" ? c.budgetNear : c.primary }} />
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
        <PadKey
          key={key}
          label={key === "del" ? "Delete digit" : key === "." ? "Decimal point" : key}
          onPress={() => press(key)}
        >
          {key === "del" ? <Icon name="backspace-outline" /> : <Text maxFontSizeMultiplier={1.4} style={{ color: c.text, fontSize: 24, fontWeight: "700" }}>{key}</Text>}
        </PadKey>
      ))}
    </View>
  );
}

/** One number-pad key: it ripples and presses to 0.97, so fast typing feels each digit land. */
function PadKey({ label, onPress, children }: { label: string; onPress: () => void; children: ReactNode }) {
  const c = useColors();
  const press = usePressScale();
  return (
    <AnimatedPressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      onPressIn={press.onPressIn}
      onPressOut={press.onPressOut}
      android_ripple={{ color: c.ripple }}
      style={[styles.key, { backgroundColor: c.glass, borderColor: c.border, transform: [{ scale: press.scale }] }]}
    >
      {children}
    </AnimatedPressable>
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
  // Pressables with a fill clip their ripple to their rounded corners (overflow hidden).
  button: { minHeight: 48, borderRadius: 16, alignItems: "center", justifyContent: "center", paddingHorizontal: 16, flexDirection: "row", gap: 8, overflow: "hidden" },
  buttonText: { fontSize: 15, fontWeight: "800" },
  label: { fontSize: 13, fontWeight: "600" },
  input: { minHeight: 50, borderRadius: 16, borderWidth: 1, paddingHorizontal: 16, fontSize: 15 },
  segmented: { flexDirection: "row", borderRadius: 16, padding: SEGMENT_PAD, gap: SEGMENT_PAD },
  segment: { flex: 1, minHeight: 48, borderRadius: 12, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  segmentPill: { position: "absolute", top: SEGMENT_PAD, bottom: SEGMENT_PAD, left: SEGMENT_PAD, borderRadius: 12 },
  row: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 56, paddingVertical: 6 },
  rowPressable: { marginHorizontal: -8, paddingHorizontal: 8, borderRadius: 14, overflow: "hidden" },
  rowIcon: { width: 40, height: 40, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  chip: { minHeight: 48, borderRadius: 22, paddingHorizontal: 16, alignItems: "center", justifyContent: "center", borderWidth: 1, overflow: "hidden" },
  pickerItem: { minHeight: 48, flexDirection: "row", alignItems: "center", gap: 8, paddingRight: 12, borderRadius: 12, overflow: "hidden" },
  key: { width: "31.5%", minHeight: 56, borderRadius: 16, borderWidth: 1, alignItems: "center", justifyContent: "center", overflow: "hidden" },
});
