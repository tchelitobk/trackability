import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import React, { useRef } from 'react';
import {
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle } from 'react-native-svg';

import { fonts, type as t } from '@/constants/type';
import { useColors } from '@/hooks/useColors';
import { formatClock } from '@/lib/time';

export type Tone = 'lime' | 'apricot' | 'sky';
export type IconName = React.ComponentProps<typeof Feather>['name'];

export function useToneColor() {
  const colors = useColors();
  return (tone: Tone) => (tone === 'lime' ? colors.primary : tone === 'apricot' ? colors.accent : colors.sky);
}

export function useToneSoft() {
  const colors = useColors();
  return (tone: Tone) => (tone === 'lime' ? colors.primarySoft : tone === 'apricot' ? colors.accentSoft : colors.skySoft);
}

const tap = () => {
  Haptics.selectionAsync().catch(() => undefined);
};

/** Top/bottom padding that clears the status bar and the floating tab bar. */
export function useScreenPadding(withTabs = true) {
  const insets = useSafeAreaInsets();
  return {
    paddingTop: insets.top + (Platform.OS === 'web' ? 40 : 14),
    paddingBottom: insets.bottom + (Platform.OS === 'web' ? 40 : withTabs ? 110 : 40),
  };
}

export function Screen({ children, withTabs = true, testID }: { children: React.ReactNode; withTabs?: boolean; testID?: string }) {
  const colors = useColors();
  const padding = useScreenPadding(withTabs);
  return (
    <ScrollView
      testID={testID}
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={padding}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      {children}
    </ScrollView>
  );
}

export function Eyebrow({ children, color, style }: { children: React.ReactNode; color?: string; style?: StyleProp<ViewStyle> }) {
  const colors = useColors();
  return <Text style={[t.eyebrow, { color: color ?? colors.mutedForeground }, style as object]}>{children}</Text>;
}

export function Header({
  eyebrow,
  title,
  subtitle,
  right,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
}) {
  const colors = useColors();
  return (
    <View style={styles.header}>
      <View style={styles.flex}>
        {eyebrow ? <Eyebrow color={colors.accent}>{eyebrow}</Eyebrow> : null}
        <Text style={[t.title, styles.headerTitle, { color: colors.foreground }]}>{title}</Text>
        {subtitle ? <Text style={[t.body, styles.headerSubtitle, { color: colors.mutedForeground }]}>{subtitle}</Text> : null}
      </View>
      {right}
    </View>
  );
}

export function SectionTitle({
  title,
  eyebrow,
  action,
  onAction,
}: {
  title: string;
  eyebrow?: string;
  action?: string;
  onAction?: () => void;
}) {
  const colors = useColors();
  return (
    <View style={styles.sectionTitle}>
      <View style={styles.flex}>
        {eyebrow ? <Eyebrow>{eyebrow}</Eyebrow> : null}
        <Text style={[t.heading, { color: colors.foreground, marginTop: eyebrow ? 4 : 0 }]}>{title}</Text>
      </View>
      {action && onAction ? (
        <Pressable accessibilityRole="button" hitSlop={10} onPress={onAction} style={({ pressed }) => pressed && styles.pressed}>
          <Text style={[t.label, { color: colors.primary }]}>{action}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export function Card({
  children,
  style,
  variant = 'default',
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  variant?: 'default' | 'raised';
}) {
  const colors = useColors();
  return (
    <View
      style={[
        styles.card,
        { backgroundColor: variant === 'raised' ? colors.cardRaised : colors.card, borderColor: colors.border },
        style,
      ]}
    >
      {children}
    </View>
  );
}

export function Button({
  label,
  onPress,
  variant = 'primary',
  icon,
  testID,
  disabled,
  style,
  compact,
}: {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'ghost' | 'accent';
  icon?: IconName;
  testID?: string;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  compact?: boolean;
}) {
  const colors = useColors();
  const palette = {
    primary: { bg: colors.primary, fg: colors.primaryForeground, border: colors.primary },
    accent: { bg: colors.accent, fg: colors.accentForeground, border: colors.accent },
    secondary: { bg: colors.secondary, fg: colors.foreground, border: colors.borderStrong },
    ghost: { bg: 'transparent', fg: colors.foreground, border: colors.borderStrong },
  }[variant];
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
        onPress();
      }}
      style={({ pressed }) => [
        styles.button,
        compact && styles.buttonCompact,
        { backgroundColor: palette.bg, borderColor: palette.border },
        disabled && styles.disabled,
        pressed && styles.pressed,
        style,
      ]}
    >
      {icon ? <Feather name={icon} size={compact ? 15 : 17} color={palette.fg} /> : null}
      <Text style={[compact ? t.label : t.bodyStrong, { color: palette.fg }]}>{label}</Text>
    </Pressable>
  );
}

export function Chip({
  label,
  selected,
  onPress,
  tone = 'lime',
  testID,
  compact,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  tone?: Tone;
  testID?: string;
  compact?: boolean;
}) {
  const colors = useColors();
  const toneColor = useToneColor()(tone);
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={() => {
        tap();
        onPress();
      }}
      style={({ pressed }) => [
        styles.chip,
        compact && styles.chipCompact,
        {
          backgroundColor: selected ? toneColor : colors.secondary,
          borderColor: selected ? toneColor : colors.border,
        },
        pressed && styles.pressed,
      ]}
    >
      <Text style={[t.label, { color: selected ? colors.primaryForeground : colors.secondaryForeground }]}>{label}</Text>
    </Pressable>
  );
}

/** A row of equal-width options, e.g. 2 · 3 · 4 · 5 · 6. */
export function Segmented<T extends string | number>({
  options,
  value,
  onChange,
  testID,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  testID?: string;
}) {
  const colors = useColors();
  return (
    <View style={[styles.segmented, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
      {options.map((option) => {
        const active = option.value === value;
        return (
          <Pressable
            key={String(option.value)}
            testID={testID ? `${testID}-${option.value}` : undefined}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            onPress={() => {
              tap();
              onChange(option.value);
            }}
            style={({ pressed }) => [
              styles.segment,
              { backgroundColor: active ? colors.foreground : 'transparent' },
              pressed && styles.pressed,
            ]}
          >
            <Text style={[t.label, { color: active ? colors.background : colors.secondaryForeground }]}>{option.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** A big selectable card with a title and one line of explanation. */
export function OptionCard({
  title,
  description,
  icon,
  selected,
  onPress,
  testID,
}: {
  title: string;
  description?: string;
  icon?: IconName;
  selected: boolean;
  onPress: () => void;
  testID?: string;
}) {
  const colors = useColors();
  return (
    <Pressable
      testID={testID}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      onPress={() => {
        tap();
        onPress();
      }}
      style={({ pressed }) => [
        styles.option,
        {
          backgroundColor: selected ? colors.primarySoft : colors.card,
          borderColor: selected ? colors.primary : colors.border,
        },
        pressed && styles.pressed,
      ]}
    >
      {icon ? (
        <View style={[styles.optionIcon, { backgroundColor: selected ? colors.primary : colors.secondary }]}>
          <Feather name={icon} size={17} color={selected ? colors.primaryForeground : colors.secondaryForeground} />
        </View>
      ) : null}
      <View style={styles.flex}>
        <Text style={[t.bodyStrong, { color: colors.foreground }]}>{title}</Text>
        {description ? <Text style={[t.caption, { color: colors.mutedForeground, marginTop: 3 }]}>{description}</Text> : null}
      </View>
      <View
        style={[
          styles.radio,
          { borderColor: selected ? colors.primary : colors.borderStrong, backgroundColor: selected ? colors.primary : 'transparent' },
        ]}
      >
        {selected ? <Feather name="check" size={13} color={colors.primaryForeground} /> : null}
      </View>
    </Pressable>
  );
}

/** The one control for "I did this". Big, round, labelled for screen readers. */
export function CheckCircle({
  done,
  onPress,
  label,
  tone = 'lime',
  testID,
}: {
  done: boolean;
  onPress: () => void;
  label: string;
  tone?: Tone;
  testID?: string;
}) {
  const colors = useColors();
  const toneColor = useToneColor()(tone);
  return (
    <Pressable
      testID={testID}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: done }}
      accessibilityLabel={label}
      hitSlop={8}
      onPress={() => {
        Haptics.impactAsync(done ? Haptics.ImpactFeedbackStyle.Light : Haptics.ImpactFeedbackStyle.Medium).catch(() => undefined);
        onPress();
      }}
      style={({ pressed }) => [
        styles.check,
        { borderColor: done ? toneColor : colors.borderStrong, backgroundColor: done ? toneColor : 'transparent' },
        pressed && styles.pressed,
      ]}
    >
      {done ? <Feather name="check" size={16} color={colors.primaryForeground} /> : null}
    </Pressable>
  );
}

export function Stepper({
  label,
  value,
  onDecrement,
  onIncrement,
  testID,
}: {
  label?: string;
  value: string;
  onDecrement: () => void;
  onIncrement: () => void;
  testID?: string;
}) {
  const colors = useColors();
  const button = (icon: 'minus' | 'plus', onPress: () => void) => (
    <Pressable
      testID={testID ? `${testID}-${icon}` : undefined}
      accessibilityRole="button"
      accessibilityLabel={`${icon === 'minus' ? 'Decrease' : 'Increase'} ${label ?? ''}`.trim()}
      hitSlop={6}
      onPress={() => {
        tap();
        onPress();
      }}
      style={({ pressed }) => [styles.stepButton, { backgroundColor: colors.secondary, borderColor: colors.border }, pressed && styles.pressed]}
    >
      <Feather name={icon} size={16} color={colors.foreground} />
    </Pressable>
  );
  return (
    <View style={styles.stepper}>
      {label ? <Text style={[t.caption, { color: colors.mutedForeground }]}>{label}</Text> : null}
      <View style={styles.stepControls}>
        {button('minus', onDecrement)}
        <Text style={[t.heading, styles.stepValue, { color: colors.foreground }]}>{value}</Text>
        {button('plus', onIncrement)}
      </View>
    </View>
  );
}

export function Bullet({ children, tone = 'lime' }: { children: React.ReactNode; tone?: Tone }) {
  const colors = useColors();
  const toneColor = useToneColor()(tone);
  return (
    <View style={styles.bullet}>
      <View style={[styles.bulletDot, { backgroundColor: toneColor }]} />
      <Text style={[t.caption, styles.flex, { color: colors.secondaryForeground, lineHeight: 19 }]}>{children}</Text>
    </View>
  );
}

/** A dismissible tip. Used to teach new users where things live. */
export function Hint({
  title,
  children,
  onDismiss,
  icon = 'info',
  testID,
}: {
  title: string;
  children: React.ReactNode;
  onDismiss: () => void;
  icon?: IconName;
  testID?: string;
}) {
  const colors = useColors();
  return (
    <View testID={testID} style={[styles.hint, { backgroundColor: colors.accentSoft, borderColor: 'rgba(229, 195, 140, 0.28)' }]}>
      <View style={styles.hintHead}>
        <Feather name={icon} size={16} color={colors.accent} />
        <Text style={[t.bodyStrong, styles.flex, { color: colors.foreground }]}>{title}</Text>
        <Pressable accessibilityRole="button" accessibilityLabel="Dismiss tip" hitSlop={10} onPress={onDismiss}>
          <Feather name="x" size={16} color={colors.mutedForeground} />
        </Pressable>
      </View>
      <View style={styles.hintBody}>{children}</View>
      <Pressable accessibilityRole="button" onPress={onDismiss} style={({ pressed }) => [styles.hintButton, pressed && styles.pressed]}>
        <Text style={[t.label, { color: colors.accent }]}>Got it</Text>
      </Pressable>
    </View>
  );
}

export function ListRow({
  icon,
  title,
  value,
  onPress,
  testID,
  destructive,
  first,
}: {
  icon: IconName;
  title: string;
  value?: string;
  onPress: () => void;
  testID?: string;
  destructive?: boolean;
  first?: boolean;
}) {
  const colors = useColors();
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      onPress={() => {
        tap();
        onPress();
      }}
      style={({ pressed }) => [styles.listRow, !first && { borderTopWidth: 1, borderTopColor: colors.border }, pressed && styles.pressed]}
    >
      <View style={[styles.listIcon, { backgroundColor: colors.secondary }]}>
        <Feather name={icon} size={16} color={destructive ? colors.destructive : colors.accent} />
      </View>
      <View style={styles.flex}>
        <Text style={[t.bodyStrong, { color: destructive ? colors.destructive : colors.foreground }]}>{title}</Text>
        {value ? (
          <Text style={[t.caption, { color: colors.mutedForeground, marginTop: 2 }]} numberOfLines={2}>
            {value}
          </Text>
        ) : null}
      </View>
      {!destructive ? <Feather name="chevron-right" size={18} color={colors.mutedForeground} /> : null}
    </Pressable>
  );
}

export function ProgressRing({
  value,
  size = 72,
  stroke = 6,
  color,
  children,
}: {
  value: number;
  size?: number;
  stroke?: number;
  color?: string;
  children?: React.ReactNode;
}) {
  const colors = useColors();
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.max(0, Math.min(1, value));
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        <Circle cx={size / 2} cy={size / 2} r={radius} stroke={colors.secondary} strokeWidth={stroke} fill="none" />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={color ?? colors.primary}
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={circumference * (1 - clamped)}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      {children}
    </View>
  );
}

export function ProgressBar({ value, color, height = 6 }: { value: number; color?: string; height?: number }) {
  const colors = useColors();
  return (
    <View style={{ height, borderRadius: height / 2, backgroundColor: colors.secondary, overflow: 'hidden' }}>
      <View
        style={{
          height,
          borderRadius: height / 2,
          width: `${Math.round(Math.max(0, Math.min(1, value)) * 100)}%`,
          backgroundColor: color ?? colors.primary,
        }}
      />
    </View>
  );
}

/** Bottom sheet for focused edits: title, content, one clear "Done". */
export function Sheet({
  visible,
  onClose,
  title,
  subtitle,
  children,
  doneLabel = 'Done',
  testID,
}: {
  visible: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  doneLabel?: string;
  testID?: string;
}) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.sheetRoot}>
        <Pressable accessibilityLabel="Close" style={[StyleSheet.absoluteFill, { backgroundColor: colors.overlay }]} onPress={onClose} />
        <View
          testID={testID}
          style={[styles.sheet, { backgroundColor: colors.card, borderColor: colors.border, paddingBottom: insets.bottom + 16 }]}
        >
          <View style={[styles.grabber, { backgroundColor: colors.borderStrong }]} />
          <View style={styles.sheetHead}>
            <View style={styles.flex}>
              <Text style={[t.heading, { color: colors.foreground }]}>{title}</Text>
              {subtitle ? <Text style={[t.caption, { color: colors.mutedForeground, marginTop: 4 }]}>{subtitle}</Text> : null}
            </View>
          </View>
          <ScrollView style={styles.sheetBody} contentContainerStyle={styles.sheetContent} keyboardShouldPersistTaps="handled">
            {children}
          </ScrollView>
          <Button label={doneLabel} onPress={onClose} testID={testID ? `${testID}-done` : undefined} style={styles.sheetDone} />
        </View>
      </View>
    </Modal>
  );
}

const TIME_ROW = 52;

/** Tap to open a scrolling list of times. Far quicker than ± buttons. */
export function TimeField({
  label,
  value,
  onChange,
  min = 4 * 60,
  max = 23 * 60 + 45,
  step = 15,
  testID,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  testID?: string;
}) {
  const colors = useColors();
  const [open, setOpen] = React.useState(false);
  const scroll = useRef<ScrollView>(null);
  const times: number[] = [];
  for (let m = min; m <= max; m += step) times.push(m);
  const index = Math.max(0, times.findIndex((m) => m >= value));

  return (
    <>
      <Pressable
        testID={testID}
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${formatClock(value)}. Tap to change`}
        onPress={() => {
          tap();
          setOpen(true);
        }}
        style={({ pressed }) => [styles.timeField, { backgroundColor: colors.secondary, borderColor: colors.border }, pressed && styles.pressed]}
      >
        <Text style={[t.micro, { color: colors.mutedForeground }]}>{label}</Text>
        <View style={styles.timeValueRow}>
          <Text style={[t.subheading, { color: colors.foreground }]}>{formatClock(value)}</Text>
          <Feather name="chevron-down" size={16} color={colors.mutedForeground} />
        </View>
      </Pressable>
      <Sheet visible={open} onClose={() => setOpen(false)} title={label} subtitle="Tap a time" testID={testID ? `${testID}-sheet` : undefined}>
        <ScrollView
          ref={scroll}
          style={{ maxHeight: TIME_ROW * 6.5 }}
          onLayout={() => scroll.current?.scrollTo({ y: Math.max(0, (index - 2) * TIME_ROW), animated: false })}
          nestedScrollEnabled
        >
          {times.map((m) => {
            const active = m === value;
            return (
              <Pressable
                key={m}
                testID={testID ? `${testID}-option-${m}` : undefined}
                onPress={() => {
                  tap();
                  onChange(m);
                  setOpen(false);
                }}
                style={({ pressed }) => [
                  styles.timeOption,
                  { backgroundColor: active ? colors.primarySoft : 'transparent' },
                  pressed && styles.pressed,
                ]}
              >
                <Text style={[t.subheading, { color: active ? colors.primary : colors.foreground }]}>{formatClock(m)}</Text>
                {active ? <Feather name="check" size={18} color={colors.primary} /> : null}
              </Pressable>
            );
          })}
        </ScrollView>
      </Sheet>
    </>
  );
}

export function Avatar({ name, size = 44, onPress, testID }: { name: string; size?: number; onPress?: () => void; testID?: string }) {
  const colors = useColors();
  const letter = name.trim().charAt(0).toUpperCase() || 'A';
  const body = (
    <View
      style={[
        styles.avatar,
        { width: size, height: size, borderRadius: size / 2, borderColor: colors.accent, backgroundColor: colors.cardRaised },
      ]}
    >
      <Text style={{ fontFamily: fonts.display, fontSize: size * 0.48, color: colors.accent }}>{letter}</Text>
    </View>
  );
  if (!onPress) return body;
  return (
    <Pressable testID={testID} accessibilityRole="button" accessibilityLabel="Open your profile" onPress={onPress} hitSlop={6}>
      {({ pressed }) => <View style={pressed && styles.pressed}>{body}</View>}
    </Pressable>
  );
}

export const shared = StyleSheet.create({
  pressed: { opacity: 0.72 },
  row: { flexDirection: 'row', alignItems: 'center' },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  gutter: { marginHorizontal: 20 },
});

const styles = StyleSheet.create({
  flex: { flex: 1 },
  pressed: { opacity: 0.72 },
  disabled: { opacity: 0.4 },
  header: { paddingHorizontal: 20, flexDirection: 'row', alignItems: 'flex-start', gap: 14, marginBottom: 22 },
  headerTitle: { marginTop: 6 },
  headerSubtitle: { marginTop: 6 },
  sectionTitle: { paddingHorizontal: 20, flexDirection: 'row', alignItems: 'flex-end', marginTop: 30, marginBottom: 12, gap: 12 },
  card: { marginHorizontal: 20, borderRadius: 22, borderWidth: 1, padding: 18 },
  button: {
    minHeight: 54,
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  buttonCompact: { minHeight: 44, borderRadius: 13, paddingHorizontal: 14 },
  chip: { minHeight: 44, justifyContent: 'center', borderRadius: 14, borderWidth: 1, paddingHorizontal: 15 },
  chipCompact: { minHeight: 40, paddingHorizontal: 12, borderRadius: 12 },
  segmented: { flexDirection: 'row', borderRadius: 15, borderWidth: 1, padding: 4, gap: 4 },
  segment: { flex: 1, minHeight: 42, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  option: { flexDirection: 'row', alignItems: 'center', gap: 13, borderRadius: 18, borderWidth: 1, padding: 15 },
  optionIcon: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  radio: { width: 24, height: 24, borderRadius: 12, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  check: { width: 34, height: 34, borderRadius: 17, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  stepper: { gap: 8 },
  stepControls: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  stepButton: { width: 44, height: 44, borderRadius: 14, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  stepValue: { minWidth: 90, textAlign: 'center' },
  bullet: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  bulletDot: { width: 5, height: 5, borderRadius: 3, marginTop: 7 },
  hint: { marginHorizontal: 20, borderRadius: 20, borderWidth: 1, padding: 16, marginBottom: 14 },
  hintHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  hintBody: { marginTop: 12, gap: 9 },
  hintButton: { alignSelf: 'flex-start', marginTop: 12, paddingVertical: 4 },
  listRow: { flexDirection: 'row', alignItems: 'center', gap: 13, paddingVertical: 14, minHeight: 60 },
  listIcon: { width: 36, height: 36, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  sheetRoot: { flex: 1, justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: 28, borderTopRightRadius: 28, borderWidth: 1, borderBottomWidth: 0, maxHeight: '90%', paddingTop: 10 },
  grabber: { width: 40, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 14 },
  sheetHead: { paddingHorizontal: 22, marginBottom: 6 },
  sheetBody: { flexGrow: 0 },
  sheetContent: { paddingHorizontal: 22, paddingTop: 12, paddingBottom: 16, gap: 18 },
  sheetDone: { marginHorizontal: 22, marginTop: 4 },
  timeField: { flex: 1, minWidth: 130, borderRadius: 16, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 11, gap: 4 },
  timeValueRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  timeOption: {
    height: TIME_ROW,
    borderRadius: 14,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  avatar: { borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
});
