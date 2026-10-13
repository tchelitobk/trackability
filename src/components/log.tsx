import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { CheckCircle, Sheet, shared, type IconName, type Tone } from '@/components/ui';
import { type as t } from '@/constants/type';
import { useColors } from '@/hooks/useColors';
import type { DayTask, TaskKind } from '@/lib/logbook';

export const effortLabel = (effort: number) =>
  effort <= 3 ? 'Easy' : effort <= 6 ? 'Moderate' : effort <= 8 ? 'Hard' : 'All-out';

export const KIND_META: Record<TaskKind, { label: string; icon: IconName; tone: Tone }> = {
  session: { label: 'Training', icon: 'activity', tone: 'lime' },
  event: { label: 'Game day', icon: 'award', tone: 'apricot' },
  meal: { label: 'Meal', icon: 'coffee', tone: 'apricot' },
  habit: { label: 'Recovery', icon: 'wind', tone: 'sky' },
};

/** 1–10 effort, in two rows of five, with a word for the selected value. */
export function EffortPicker({ value, onChange, testID }: { value?: number; onChange: (effort: number) => void; testID?: string }) {
  const colors = useColors();
  return (
    <View style={styles.effort}>
      <View style={styles.effortGrid}>
        {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => {
          const active = value === n;
          return (
            <Pressable
              key={n}
              testID={testID ? `${testID}-${n}` : undefined}
              accessibilityRole="button"
              accessibilityLabel={`Effort ${n} of 10, ${effortLabel(n)}`}
              accessibilityState={{ selected: active }}
              onPress={() => {
                Haptics.selectionAsync().catch(() => undefined);
                onChange(n);
              }}
              style={({ pressed }) => [
                styles.effortCell,
                {
                  backgroundColor: active ? colors.primary : colors.secondary,
                  borderColor: active ? colors.primary : colors.border,
                },
                pressed && shared.pressed,
              ]}
            >
              <Text style={[t.subheading, { color: active ? colors.primaryForeground : colors.foreground }]}>{n}</Text>
            </Pressable>
          );
        })}
      </View>
      <Text style={[t.caption, { color: colors.mutedForeground }]}>
        {value ? `${value}/10 · ${effortLabel(value)}` : '1 = very easy · 10 = everything you had'}
      </Text>
    </View>
  );
}

export function EffortSheet({
  visible,
  title,
  value,
  onChange,
  onClose,
}: {
  visible: boolean;
  title: string;
  value?: number;
  onChange: (effort: number) => void;
  onClose: () => void;
}) {
  return (
    <Sheet visible={visible} onClose={onClose} title="Logged. How hard was it?" subtitle={title} testID="effort-sheet">
      <EffortPicker testID="effort" value={value} onChange={onChange} />
    </Sheet>
  );
}

/** A checklist row: time, what it is, and the check circle on the right. */
export function TaskRow({
  task,
  onToggle,
  onOpen,
  first,
}: {
  task: DayTask;
  onToggle: () => void;
  onOpen?: () => void;
  first?: boolean;
}) {
  const colors = useColors();
  const meta = KIND_META[task.kind];
  const toneColor = meta.tone === 'lime' ? colors.primary : meta.tone === 'apricot' ? colors.accent : colors.sky;
  return (
    <View style={[styles.row, !first && { borderTopWidth: 1, borderTopColor: colors.border }]}>
      <Pressable
        testID={`task-${task.key}`}
        accessibilityRole="button"
        accessibilityHint={onOpen ? 'Opens details' : 'Checks this off'}
        onPress={onOpen ?? onToggle}
        style={({ pressed }) => [styles.rowMain, pressed && shared.pressed]}
      >
        <View style={styles.time}>
          <Text style={[t.label, { color: colors.foreground }]}>{task.time.replace(' AM', '').replace(' PM', '')}</Text>
          <Text style={[t.micro, { color: colors.mutedForeground }]}>{task.time.endsWith('AM') ? 'AM' : task.time.endsWith('PM') ? 'PM' : ''}</Text>
        </View>
        <View style={[styles.rule, { backgroundColor: toneColor }]} />
        <View style={styles.copy}>
          <View style={styles.kindRow}>
            <Feather name={meta.icon} size={11} color={toneColor} />
            <Text style={[t.micro, { color: toneColor, letterSpacing: 0.6 }]}>{meta.label.toUpperCase()}</Text>
            {task.effort ? <Text style={[t.micro, { color: colors.mutedForeground }]}>· effort {task.effort}/10</Text> : null}
          </View>
          <Text style={[t.bodyStrong, { color: colors.foreground, marginTop: 3 }, task.done && styles.done]} numberOfLines={1}>
            {task.title}
          </Text>
          {task.detail ? (
            <Text style={[t.caption, { color: colors.mutedForeground, marginTop: 2 }]} numberOfLines={1}>
              {task.detail}
            </Text>
          ) : null}
        </View>
      </Pressable>
      <CheckCircle testID={`check-${task.key}`} done={task.done} tone={meta.tone} label={`${task.done ? 'Undo' : 'Mark done'}: ${task.title}`} onPress={onToggle} />
    </View>
  );
}

const styles = StyleSheet.create({
  effort: { gap: 12 },
  effortGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  effortCell: { width: '18%', flexGrow: 1, height: 52, borderRadius: 14, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
  rowMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
  time: { width: 44, alignItems: 'flex-end' },
  rule: { width: 2, alignSelf: 'stretch', borderRadius: 1, opacity: 0.7 },
  copy: { flex: 1 },
  kindRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  done: { textDecorationLine: 'line-through', opacity: 0.45 },
});
