import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import React from 'react';
import { Platform, Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useColors } from '@/hooks/useColors';

export type Tone = 'lime' | 'apricot' | 'sky';

export function useToneColor() {
  const colors = useColors();
  return (tone: Tone) => (tone === 'lime' ? colors.primary : tone === 'apricot' ? colors.accent : colors.sky);
}

/** Same top/bottom padding rules as the Today screen. */
export function useScreenPadding(withTabs = true) {
  const insets = useSafeAreaInsets();
  return {
    paddingTop: insets.top + (Platform.OS === 'web' ? 67 : 16),
    paddingBottom: insets.bottom + (Platform.OS === 'web' ? 34 : withTabs ? 98 : 34),
  };
}

export function Eyebrow({ children, color }: { children: React.ReactNode; color?: string }) {
  const colors = useColors();
  return <Text style={[styles.eyebrow, { color: color ?? colors.mutedForeground }]}>{children}</Text>;
}

export function ScreenHeader({
  eyebrow,
  title,
  right,
}: {
  eyebrow: string;
  title: string;
  right?: React.ReactNode;
}) {
  const colors = useColors();
  return (
    <View style={styles.header}>
      <View style={styles.flex}>
        <Eyebrow color={colors.primary}>{eyebrow}</Eyebrow>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>{title}</Text>
      </View>
      {right}
    </View>
  );
}

export function SectionTitle({ eyebrow, title, right }: { eyebrow: string; title?: string; right?: React.ReactNode }) {
  const colors = useColors();
  return (
    <View style={styles.sectionTitle}>
      <View style={styles.flex}>
        <Eyebrow>{eyebrow}</Eyebrow>
        {title ? <Text style={[styles.sectionHeading, { color: colors.foreground }]}>{title}</Text> : null}
      </View>
      {right}
    </View>
  );
}

export function Card({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  const colors = useColors();
  return <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }, style]}>{children}</View>;
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
        Haptics.selectionAsync();
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
      <Text
        style={[
          styles.chipLabel,
          { color: selected ? colors.primaryForeground : colors.secondaryForeground },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

export function Stepper({
  label,
  value,
  onDecrement,
  onIncrement,
  testID,
  compact,
}: {
  label?: string;
  value: string;
  onDecrement: () => void;
  onIncrement: () => void;
  testID?: string;
  compact?: boolean;
}) {
  const colors = useColors();
  const button = (icon: 'minus' | 'plus', onPress: () => void) => (
    <Pressable
      testID={testID ? `${testID}-${icon}` : undefined}
      accessibilityRole="button"
      accessibilityLabel={`${icon === 'minus' ? 'Decrease' : 'Increase'} ${label ?? ''}`.trim()}
      hitSlop={6}
      onPress={() => {
        Haptics.selectionAsync();
        onPress();
      }}
      style={({ pressed }) => [
        styles.stepButton,
        compact && styles.stepButtonCompact,
        { backgroundColor: colors.secondary },
        pressed && styles.pressed,
      ]}
    >
      <Feather name={icon} size={14} color={colors.primary} />
    </Pressable>
  );
  return (
    <View style={styles.stepper}>
      {label ? <Text style={[styles.stepLabel, { color: colors.mutedForeground }]}>{label}</Text> : null}
      <View style={[styles.stepControls, compact && styles.stepControlsCompact]}>
        {button('minus', onDecrement)}
        <Text style={[styles.stepValue, compact && styles.stepValueCompact, { color: colors.foreground }]}>{value}</Text>
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
      <Text style={[styles.bulletText, { color: colors.secondaryForeground }]}>{children}</Text>
    </View>
  );
}

export const shared = StyleSheet.create({
  pressed: { opacity: 0.78 },
  row: { flexDirection: 'row', alignItems: 'center' },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
});

const styles = StyleSheet.create({
  flex: { flex: 1 },
  eyebrow: { fontFamily: 'Inter_700Bold', fontSize: 10, letterSpacing: 1.5 },
  header: {
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 20,
  },
  headerTitle: { fontFamily: 'Inter_700Bold', fontSize: 24, letterSpacing: -0.8, marginTop: 5 },
  sectionTitle: {
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginTop: 22,
    marginBottom: 11,
  },
  sectionHeading: { fontFamily: 'Inter_700Bold', fontSize: 18, letterSpacing: -0.5, marginTop: 5 },
  card: { marginHorizontal: 20, borderRadius: 20, borderWidth: 1, padding: 15 },
  chip: { borderRadius: 13, borderWidth: 1, paddingHorizontal: 13, paddingVertical: 9 },
  chipCompact: { paddingHorizontal: 10, paddingVertical: 7, borderRadius: 11 },
  chipLabel: { fontFamily: 'Inter_600SemiBold', fontSize: 12 },
  stepper: { gap: 6 },
  stepLabel: { fontFamily: 'Inter_600SemiBold', fontSize: 11 },
  stepControls: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  stepButton: { width: 30, height: 30, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  stepValue: { fontFamily: 'Inter_700Bold', fontSize: 14, minWidth: 64, textAlign: 'center' },
  stepControlsCompact: { gap: 4 },
  stepButtonCompact: { width: 26, height: 26, borderRadius: 9 },
  stepValueCompact: { fontSize: 12, minWidth: 58 },
  bullet: { flexDirection: 'row', gap: 9, alignItems: 'flex-start' },
  bulletDot: { width: 6, height: 6, borderRadius: 3, marginTop: 6 },
  bulletText: { fontFamily: 'Inter_400Regular', fontSize: 12.5, lineHeight: 18, flex: 1 },
  pressed: { opacity: 0.78 },
});
