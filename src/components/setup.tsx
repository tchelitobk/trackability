import { Feather } from '@expo/vector-icons';
import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { Button, Chip, Eyebrow, OptionCard, Segmented, TimeField, shared, type IconName } from '@/components/ui';
import { fonts, type as t } from '@/constants/type';
import { useColors } from '@/hooks/useColors';
import { EVENT_ORDER, EVENT_PRESETS, isCompetition, isMatch } from '@/lib/events';
import { sleepWindowFor } from '@/lib/scheduler';
import { DAY_NAMES, formatClock, hm } from '@/lib/time';
import {
  DAY_KEYS,
  type Chronotype,
  type CommitmentKind,
  type DayKey,
  type DietStyle,
  type EventKind,
  type Exclusion,
  type Minutes,
  type Profile,
  type Sport,
  type TimeBlock,
  type WeekEvent,
} from '@/lib/types';

type StepProps = { profile: Profile; update: (patch: Partial<Profile>) => void };

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  const colors = useColors();
  return (
    <View style={styles.field}>
      <Text style={[t.bodyStrong, { color: colors.foreground }]}>{label}</Text>
      {hint ? <Text style={[t.caption, { color: colors.mutedForeground, marginTop: -4 }]}>{hint}</Text> : null}
      {children}
    </View>
  );
}

function DayPicker({ selected, onToggle, tone = 'lime', testID }: { selected: DayKey[]; onToggle: (day: DayKey) => void; tone?: 'lime' | 'apricot' | 'sky'; testID?: string }) {
  return (
    <View style={styles.days}>
      {DAY_KEYS.map((day) => (
        <View key={day} style={styles.dayCell}>
          <Chip compact testID={testID ? `${testID}-${day}` : undefined} label={day} tone={tone} selected={selected.includes(day)} onPress={() => onToggle(day)} />
        </View>
      ))}
    </View>
  );
}

const dayRange = (days: DayKey[]) => {
  if (days.length === 0) return 'None';
  const indexes = days.map((d) => DAY_KEYS.indexOf(d)).sort((a, b) => a - b);
  const contiguous = indexes.every((v, i) => i === 0 || v === indexes[i - 1] + 1);
  return contiguous && days.length > 2 ? `${DAY_KEYS[indexes[0]]}–${DAY_KEYS[indexes[indexes.length - 1]]}` : indexes.map((i) => DAY_KEYS[i]).join(', ');
};

// ─── About ──────────────────────────────────────────────────────────────────

const SPORTS: { value: Sport; label: string; description: string; icon: IconName }[] = [
  { value: 'soccer', label: 'Soccer', description: 'Matches, speed and repeat sprints', icon: 'target' },
  { value: 'running', label: 'Running', description: 'Road races and endurance', icon: 'wind' },
  { value: 'hyrox', label: 'HYROX', description: 'Running plus functional stations', icon: 'zap' },
  { value: 'strength', label: 'Strength', description: 'Lifting and physique', icon: 'anchor' },
];

export function AboutStep({ profile, update }: StepProps) {
  const colors = useColors();
  const [weight, setWeight] = useState(String(profile.bodyWeightLb));
  const commitWeight = () => {
    const value = Math.round(Number(weight));
    const clamped = Number.isFinite(value) && value > 0 ? Math.min(400, Math.max(80, value)) : profile.bodyWeightLb;
    setWeight(String(clamped));
    update({ bodyWeightLb: clamped });
  };
  return (
    <>
      <Field label="What should we call you?">
        <TextInput
          testID="name-input"
          value={profile.name === 'Athlete' ? '' : profile.name}
          onChangeText={(name) => update({ name: name || 'Athlete' })}
          placeholder="First name"
          placeholderTextColor={colors.mutedForeground}
          autoCapitalize="words"
          returnKeyType="done"
          style={[styles.input, { color: colors.foreground, backgroundColor: colors.secondary, borderColor: colors.border }]}
        />
      </Field>
      <Field label="Your main sport">
        <View style={styles.stack}>
          {SPORTS.map((sport) => (
            <OptionCard
              key={sport.value}
              testID={`sport-${sport.value}`}
              icon={sport.icon}
              title={sport.label}
              description={sport.description}
              selected={profile.sport === sport.value}
              onPress={() => update({ sport: sport.value })}
            />
          ))}
        </View>
      </Field>
      <Field label="Body weight" hint="Sets your daily calories, protein and carbs.">
        <View style={[styles.weight, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
          <TextInput
            testID="weight-input"
            value={weight}
            onChangeText={(text) => setWeight(text.replace(/[^0-9]/g, '').slice(0, 3))}
            onBlur={commitWeight}
            onSubmitEditing={commitWeight}
            keyboardType="number-pad"
            returnKeyType="done"
            style={[styles.weightInput, { color: colors.foreground }]}
          />
          <Text style={[t.bodyStrong, { color: colors.mutedForeground }]}>lb</Text>
        </View>
      </Field>
    </>
  );
}

export const aboutSummary = (p: Profile) =>
  `${SPORTS.find((s) => s.value === p.sport)?.label ?? 'Athlete'} · ${p.bodyWeightLb} lb`;

// ─── Work ───────────────────────────────────────────────────────────────────

const COMMUTES = [0, 10, 15, 20, 25, 30, 45, 60];

const sameBlock = (a: TimeBlock, b: TimeBlock) => a.start === b.start && a.end === b.end;

export function WorkStep({ profile, update }: StepProps) {
  const colors = useColors();
  const workdays = DAY_KEYS.filter((d) => profile.work[d]);
  const blocks = workdays.map((d) => profile.work[d]!) ;
  const usual: TimeBlock = blocks[0] ?? { start: hm(9), end: hm(17) };
  const [varied, setVaried] = useState(blocks.some((b) => !sameBlock(b, usual)));

  const setAll = (block: TimeBlock) =>
    update({ work: Object.fromEntries(DAY_KEYS.map((d) => [d, profile.work[d] ? block : null])) as Profile['work'] });
  const setDay = (day: DayKey, block: TimeBlock | null) => update({ work: { ...profile.work, [day]: block } });
  const fixEnd = (block: TimeBlock): TimeBlock => (block.end <= block.start ? { ...block, end: block.start + 60 } : block);

  return (
    <>
      <Field label="Which days do you work?">
        <DayPicker testID="workday" tone="sky" selected={workdays} onToggle={(day) => setDay(day, profile.work[day] ? null : usual)} />
      </Field>

      {workdays.length > 0 && !varied ? (
        <Field label="Your usual hours">
          <View style={styles.pair}>
            <TimeField testID="work-start" label="Start" value={usual.start} onChange={(start) => setAll(fixEnd({ ...usual, start }))} />
            <TimeField testID="work-end" label="Finish" value={usual.end} onChange={(end) => setAll(fixEnd({ ...usual, end }))} />
          </View>
        </Field>
      ) : null}

      {workdays.length > 0 && varied ? (
        <Field label="Hours by day">
          <View style={styles.stack}>
            {workdays.map((day) => {
              const block = profile.work[day]!;
              return (
                <View key={day} style={styles.dayRow}>
                  <Text style={[t.bodyStrong, styles.dayRowLabel, { color: colors.foreground }]}>{day}</Text>
                  <View style={[styles.pair, shared.row, { flex: 1 }]}>
                    <TimeField label="Start" value={block.start} onChange={(start) => setDay(day, fixEnd({ ...block, start }))} />
                    <TimeField label="Finish" value={block.end} onChange={(end) => setDay(day, fixEnd({ ...block, end }))} />
                  </View>
                </View>
              );
            })}
          </View>
        </Field>
      ) : null}

      {workdays.length > 0 ? (
        <Pressable
          testID="toggle-varied"
          accessibilityRole="switch"
          accessibilityState={{ checked: varied }}
          onPress={() => {
            if (varied) setAll(usual);
            setVaried(!varied);
          }}
          style={({ pressed }) => [styles.toggleRow, pressed && shared.pressed]}
        >
          <Feather name={varied ? 'check-square' : 'square'} size={20} color={varied ? colors.primary : colors.mutedForeground} />
          <Text style={[t.body, { color: colors.secondaryForeground }]}>My hours change day to day</Text>
        </Pressable>
      ) : null}

      <Field label="Commute, each way" hint="Training never overlaps the drive.">
        <View style={shared.wrap}>
          {COMMUTES.map((m) => (
            <Chip key={m} compact label={m === 0 ? 'None' : `${m} min`} tone="sky" selected={profile.commuteMinutes === m} onPress={() => update({ commuteMinutes: m })} />
          ))}
        </View>
      </Field>
    </>
  );
}

export function workSummary(p: Profile) {
  const days = DAY_KEYS.filter((d) => p.work[d]);
  if (days.length === 0) return 'No set hours';
  const first = p.work[days[0]]!;
  const uniform = days.every((d) => sameBlock(p.work[d]!, first));
  const hours = uniform ? `${formatClock(first.start)}–${formatClock(first.end)}` : 'varied hours';
  return `${dayRange(days)} · ${hours} · ${p.commuteMinutes} min commute`;
}

// ─── Training ───────────────────────────────────────────────────────────────

export function TrainingStep({ profile, update }: StepProps) {
  const colors = useColors();
  const toggle = (day: DayKey) => {
    const next = profile.availableDays.includes(day)
      ? profile.availableDays.filter((d) => d !== day)
      : [...profile.availableDays, day];
    update({ availableDays: DAY_KEYS.filter((d) => next.includes(d)) });
  };
  return (
    <>
      <Field label="Which days can you train?" hint="Pick every day you could realistically get a session in.">
        <DayPicker testID="train-day" selected={profile.availableDays} onToggle={toggle} />
      </Field>
      <Field label="Sessions per week">
        <Segmented
          testID="sessions"
          value={profile.trainingDays}
          onChange={(trainingDays) => update({ trainingDays })}
          options={[2, 3, 4, 5, 6].map((n) => ({ value: n, label: String(n) }))}
        />
        {profile.trainingDays > profile.availableDays.length ? (
          <Text style={[t.caption, { color: colors.accent }]}>
            You picked {profile.availableDays.length} days, so {profile.availableDays.length} sessions will be planned.
          </Text>
        ) : null}
      </Field>
      <Field label="Length of a main session">
        <Segmented
          testID="minutes"
          value={profile.sessionMinutes}
          onChange={(sessionMinutes) => update({ sessionMinutes })}
          options={[45, 60, 75, 90].map((n) => ({ value: n, label: `${n} min` }))}
        />
      </Field>
    </>
  );
}

export const trainingSummary = (p: Profile) =>
  `${p.availableDays.join(', ') || 'No days'} · ${p.trainingDays} × ${p.sessionMinutes} min`;

// ─── Sleep ──────────────────────────────────────────────────────────────────

const CHRONOTYPES: { value: Chronotype; label: string; description: string; icon: IconName }[] = [
  { value: 'early', label: 'Morning person', description: 'Sharp early, fading by evening', icon: 'sunrise' },
  { value: 'neutral', label: 'In between', description: 'No strong preference', icon: 'sun' },
  { value: 'late', label: 'Night owl', description: 'Slow mornings, strongest later on', icon: 'moon' },
];

export function SleepStep({ profile, update }: StepProps) {
  const colors = useColors();
  const sleep = sleepWindowFor(profile);
  return (
    <>
      <Field label="When do you need to be up?" hint="Use the same time every day, weekends included.">
        <TimeField testID="wake-time" label="Wake up" value={profile.wakeTime} min={hm(4)} max={hm(10)} onChange={(wakeTime) => update({ wakeTime })} />
      </Field>
      <Field label="Sleep you need">
        <Segmented
          testID="sleep-need"
          value={profile.sleepHours}
          onChange={(sleepHours) => update({ sleepHours })}
          options={[7, 7.5, 8, 8.5, 9].map((n) => ({ value: n, label: `${n} h` }))}
        />
      </Field>
      <View style={[styles.callout, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
        <Feather name="moon" size={17} color={colors.accent} />
        <Text style={[t.body, { color: colors.secondaryForeground, flex: 1 }]}>
          Lights out at <Text style={{ color: colors.foreground, fontFamily: fonts.semibold }}>{formatClock(sleep.lightsOut)}</Text>. Hard
          training will always finish by {formatClock(sleep.hardCutoff)}.
        </Text>
      </View>
      <Field label="When do you feel strongest?">
        <View style={styles.stack}>
          {CHRONOTYPES.map((c) => (
            <OptionCard
              key={c.value}
              testID={`chronotype-${c.value}`}
              icon={c.icon}
              title={c.label}
              description={c.description}
              selected={profile.chronotype === c.value}
              onPress={() => update({ chronotype: c.value })}
            />
          ))}
        </View>
      </Field>
    </>
  );
}

export const sleepSummary = (p: Profile) =>
  `Up ${formatClock(p.wakeTime)} · ${p.sleepHours} h · lights out ${formatClock(sleepWindowFor(p).lightsOut)}`;

// ─── Commitments ────────────────────────────────────────────────────────────

const KINDS: { value: CommitmentKind; label: string }[] = [
  { value: 'clients', label: 'Clients' },
  { value: 'team', label: 'Team' },
  { value: 'family', label: 'Family' },
  { value: 'other', label: 'Other' },
];

export function CommitmentsStep({ profile, update }: StepProps) {
  const colors = useColors();
  const [draft, setDraft] = useState({ day: 'Sat' as DayKey, start: hm(9), end: hm(11), kind: 'clients' as CommitmentKind, label: '' });
  const [adding, setAdding] = useState(false);

  const add = () => {
    const label = draft.label.trim() || KINDS.find((k) => k.value === draft.kind)!.label;
    update({
      commitments: [
        ...profile.commitments,
        { id: `${draft.day}-${Date.now()}`, day: draft.day, start: draft.start, end: Math.max(draft.end, draft.start + 30), label, kind: draft.kind },
      ],
    });
    setDraft((d) => ({ ...d, label: '' }));
    setAdding(false);
  };

  return (
    <>
      <Field label="Protected family time" hint="A daily block training will never touch, like dinner or your kid's bedtime.">
        <OptionCard
          testID="family-toggle"
          icon="home"
          title={profile.familyBlock ? 'On every day' : 'Off'}
          description={profile.familyBlock ? `${formatClock(profile.familyBlock.start)} – ${formatClock(profile.familyBlock.end)}` : 'Tap to protect a daily window'}
          selected={Boolean(profile.familyBlock)}
          onPress={() => update({ familyBlock: profile.familyBlock ? null : { start: hm(18), end: hm(19, 30) } })}
        />
        {profile.familyBlock ? (
          <View style={styles.pair}>
            <TimeField label="From" value={profile.familyBlock.start} onChange={(start) => update({ familyBlock: { ...profile.familyBlock!, start, end: Math.max(profile.familyBlock!.end, start + 30) } })} />
            <TimeField label="To" value={profile.familyBlock.end} onChange={(end) => update({ familyBlock: { ...profile.familyBlock!, end: Math.max(end, profile.familyBlock!.start + 30) } })} />
          </View>
        ) : null}
      </Field>

      <Field label="Weekly commitments" hint="Clients you train, team practice, anything fixed.">
        <View style={styles.stack}>
          {profile.commitments.length === 0 ? (
            <Text style={[t.caption, { color: colors.mutedForeground }]}>Nothing added yet.</Text>
          ) : null}
          {profile.commitments.map((c) => (
            <View key={c.id} style={[styles.commitment, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
              <View style={{ flex: 1 }}>
                <Text style={[t.bodyStrong, { color: colors.foreground }]}>{c.label}</Text>
                <Text style={[t.caption, { color: colors.mutedForeground, marginTop: 2 }]}>
                  {DAY_NAMES[c.day]} · {formatClock(c.start)} – {formatClock(c.end)}
                </Text>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Remove ${c.label}`}
                hitSlop={8}
                onPress={() => update({ commitments: profile.commitments.filter((x) => x.id !== c.id) })}
                style={({ pressed }) => [styles.remove, pressed && shared.pressed]}
              >
                <Feather name="trash-2" size={16} color={colors.destructive} />
              </Pressable>
            </View>
          ))}
        </View>
        {adding ? (
          <View style={[styles.addBox, { borderColor: colors.border, backgroundColor: colors.card }]}>
            <Eyebrow>NEW COMMITMENT</Eyebrow>
            <DayPicker tone="apricot" selected={[draft.day]} onToggle={(day) => setDraft((d) => ({ ...d, day }))} />
            <View style={styles.pair}>
              <TimeField label="From" value={draft.start} onChange={(start) => setDraft((d) => ({ ...d, start, end: Math.max(d.end, start + 30) }))} />
              <TimeField label="To" value={draft.end} onChange={(end) => setDraft((d) => ({ ...d, end }))} />
            </View>
            <View style={shared.wrap}>
              {KINDS.map((k) => (
                <Chip key={k.value} compact tone="apricot" label={k.label} selected={draft.kind === k.value} onPress={() => setDraft((d) => ({ ...d, kind: k.value }))} />
              ))}
            </View>
            <TextInput
              testID="commitment-label"
              value={draft.label}
              onChangeText={(label) => setDraft((d) => ({ ...d, label }))}
              placeholder="Name it (optional)"
              placeholderTextColor={colors.mutedForeground}
              style={[styles.input, { color: colors.foreground, backgroundColor: colors.secondary, borderColor: colors.border }]}
            />
            <View style={styles.pair}>
              <Button compact variant="ghost" label="Cancel" onPress={() => setAdding(false)} style={{ flex: 1 }} />
              <Button compact testID="save-commitment" label="Save" icon="check" onPress={add} style={{ flex: 1 }} />
            </View>
          </View>
        ) : (
          <Button compact testID="add-commitment" variant="secondary" icon="plus" label="Add a commitment" onPress={() => setAdding(true)} />
        )}
      </Field>
    </>
  );
}

export const commitmentsSummary = (p: Profile) => {
  const parts = p.commitments.map((c) => `${c.label} ${c.day}`);
  if (p.familyBlock) parts.unshift(`Family ${formatClock(p.familyBlock.start)}`);
  return parts.join(' · ') || 'Nothing fixed yet';
};

// ─── Event ──────────────────────────────────────────────────────────────────

const EVENT_ICONS: Record<EventKind, IconName> = {
  hypertrophy: 'trending-up',
  'midweek-match': 'target',
  'weekend-match': 'flag',
  '10k': 'navigation',
  hyrox: 'zap',
  deload: 'battery-charging',
};

export function EventStep({
  event,
  setEvent,
}: {
  event: WeekEvent;
  setEvent: (kind: EventKind, day?: DayKey | null, time?: Minutes | null) => void;
}) {
  const competition = isCompetition(event.kind);
  return (
    <>
      <Field label="What is this week built around?">
        <View style={styles.stack}>
          {EVENT_ORDER.map((kind) => (
            <OptionCard
              key={kind}
              testID={`event-${kind}`}
              icon={EVENT_ICONS[kind]}
              title={EVENT_PRESETS[kind].label}
              description={EVENT_PRESETS[kind].blurb}
              selected={event.kind === kind}
              onPress={() => setEvent(kind)}
            />
          ))}
        </View>
      </Field>
      {competition ? (
        <Field label={isMatch(event.kind) ? 'Match day and kick-off' : 'Race day and start time'}>
          <DayPicker testID="event-day" tone="apricot" selected={event.day ? [event.day] : []} onToggle={(day) => setEvent(event.kind, day, event.time)} />
          <TimeField
            testID="event-time"
            label={isMatch(event.kind) ? 'Kick-off' : 'Start'}
            value={event.time ?? hm(19)}
            min={hm(6)}
            max={hm(22)}
            onChange={(time) => setEvent(event.kind, event.day, time)}
          />
        </Field>
      ) : null}
    </>
  );
}

// ─── Food ───────────────────────────────────────────────────────────────────

const DIETS: { value: DietStyle; label: string; description: string; icon: IconName }[] = [
  { value: 'omnivore', label: 'I eat everything', description: 'Meat, fish, eggs and dairy', icon: 'grid' },
  { value: 'pescatarian', label: 'Pescatarian', description: 'Fish, but no meat', icon: 'droplet' },
  { value: 'vegetarian', label: 'Vegetarian', description: 'No meat or fish', icon: 'feather' },
];

const EXCLUSIONS: { value: Exclusion; label: string }[] = [
  { value: 'dairy', label: 'No dairy' },
  { value: 'gluten', label: 'No gluten' },
  { value: 'nuts', label: 'No nuts' },
];

export function FoodStep({ profile, update }: StepProps) {
  return (
    <>
      <Field label="How do you eat?">
        <View style={styles.stack}>
          {DIETS.map((d) => (
            <OptionCard key={d.value} testID={`diet-${d.value}`} icon={d.icon} title={d.label} description={d.description} selected={profile.diet === d.value} onPress={() => update({ diet: d.value })} />
          ))}
        </View>
      </Field>
      <Field label="Anything to leave out?">
        <View style={shared.wrap}>
          {EXCLUSIONS.map((ex) => (
            <Chip
              key={ex.value}
              tone="apricot"
              label={ex.label}
              selected={profile.exclusions.includes(ex.value)}
              onPress={() =>
                update({
                  exclusions: profile.exclusions.includes(ex.value)
                    ? profile.exclusions.filter((x) => x !== ex.value)
                    : [...profile.exclusions, ex.value],
                })
              }
            />
          ))}
        </View>
      </Field>
    </>
  );
}

export const foodSummary = (p: Profile) =>
  [DIETS.find((d) => d.value === p.diet)?.label ?? '', ...p.exclusions.map((x) => EXCLUSIONS.find((e) => e.value === x)?.label ?? '')]
    .filter(Boolean)
    .join(' · ');

const styles = StyleSheet.create({
  field: { gap: 12 },
  stack: { gap: 10 },
  pair: { flexDirection: 'row', gap: 10 },
  days: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  dayCell: { minWidth: 58 },
  dayRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  dayRowLabel: { width: 38 },
  input: { borderWidth: 1, borderRadius: 16, paddingHorizontal: 16, minHeight: 54, fontFamily: fonts.medium, fontSize: 16 },
  weight: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 16, paddingHorizontal: 16, alignSelf: 'flex-start', gap: 8 },
  weightInput: { fontFamily: fonts.display, fontSize: 40, minWidth: 90, paddingVertical: 6 },
  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 44 },
  callout: { flexDirection: 'row', gap: 12, borderRadius: 16, borderWidth: 1, padding: 14, alignItems: 'flex-start' },
  commitment: { flexDirection: 'row', alignItems: 'center', borderRadius: 16, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 12, gap: 10 },
  remove: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  addBox: { borderWidth: 1, borderRadius: 18, padding: 14, gap: 12 },
});
