import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';

import { DEFAULT_EVENT, DEFAULT_PROFILE } from '@/lib/defaults';
import { EVENT_PRESETS, makeEvent, nextEventKind } from '@/lib/events';
import { buildWeekFuel, type WeekFuel } from '@/lib/mealPlanner';
import { buildWeekPlan } from '@/lib/scheduler';
import { dayKeyOf, startOfWeek, toISODate, weekIdOf } from '@/lib/time';
import type { DayKey, EventKind, Minutes, PlanSession, Profile, WeekEvent, WeekPlan } from '@/lib/types';

export type { PlanSession } from '@/lib/types';

const STORAGE_KEY = 'perform:v1';

type Stored = {
  profile: Profile;
  event: WeekEvent;
  /** Per-week ticks: session ids, timeline item keys, shopping items. */
  completed: Record<string, string[]>;
  done: Record<string, string[]>;
  shopping: Record<string, string[]>;
};

type PlannerContextValue = {
  ready: boolean;
  today: Date;
  todayKey: DayKey;
  profile: Profile;
  updateProfile: (patch: Partial<Profile>) => void;
  resetProfile: () => void;
  weekEvent: WeekEvent;
  setEvent: (kind: EventKind, day?: DayKey | null, time?: Minutes | null) => void;
  cycleEvent: () => void;
  plan: WeekPlan;
  fuel: WeekFuel;
  sessions: PlanSession[];
  toggleSession: (id: string) => void;
  isDone: (key: string) => boolean;
  toggleDone: (key: string) => void;
  isBought: (food: string) => boolean;
  toggleBought: (food: string) => void;
};

const PlannerContext = createContext<PlannerContextValue | null>(null);

const toggleIn = (list: string[] = [], value: string) =>
  list.includes(value) ? list.filter((item) => item !== value) : [...list, value];

/** Keep only the last few weeks of ticks so storage doesn't grow forever. */
const recent = (record: Record<string, string[]>) =>
  Object.fromEntries(Object.entries(record).sort(([a], [b]) => b.localeCompare(a)).slice(0, 6));

export function PlannerProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [today, setToday] = useState(() => new Date());
  const [stored, setStored] = useState<Stored>({
    profile: DEFAULT_PROFILE,
    event: DEFAULT_EVENT,
    completed: {},
    done: {},
    shopping: {},
  });
  const loaded = useRef(false);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (!raw) return;
        const saved = JSON.parse(raw) as Partial<Stored>;
        setStored((current) => ({
          profile: { ...current.profile, ...saved.profile },
          event: saved.event ?? current.event,
          completed: saved.completed ?? {},
          done: saved.done ?? {},
          shopping: saved.shopping ?? {},
        }));
      })
      .catch(() => undefined)
      .finally(() => {
        loaded.current = true;
        setReady(true);
      });
  }, []);

  useEffect(() => {
    if (!loaded.current) return;
    const toSave: Stored = {
      ...stored,
      completed: recent(stored.completed),
      done: recent(stored.done),
      shopping: recent(stored.shopping),
    };
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(toSave)).catch(() => undefined);
  }, [stored]);

  // Roll over to a new day/week when the app comes back to the foreground.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state !== 'active') return;
      const now = new Date();
      setToday((current) => (toISODate(current) === toISODate(now) ? current : now));
    });
    return () => sub.remove();
  }, []);

  const weekStart = useMemo(() => startOfWeek(today), [today]);
  const weekId = weekIdOf(weekStart);

  const plan = useMemo(
    () => buildWeekPlan(stored.profile, stored.event, weekStart, new Set(stored.completed[weekId] ?? [])),
    [stored.profile, stored.event, stored.completed, weekStart, weekId],
  );
  const fuel = useMemo(() => buildWeekFuel(stored.profile, plan), [stored.profile, plan]);
  const sessions = useMemo(() => plan.days.flatMap((day) => day.sessions), [plan]);

  const updateProfile = useCallback((patch: Partial<Profile>) => {
    setStored((current) => ({ ...current, profile: { ...current.profile, ...patch } }));
  }, []);

  const resetProfile = useCallback(() => {
    setStored((current) => ({ ...current, profile: DEFAULT_PROFILE }));
  }, []);

  const setEvent = useCallback((kind: EventKind, day?: DayKey | null, time?: Minutes | null) => {
    setStored((current) => {
      const sameKind = current.event.kind === kind;
      const nextDay = day !== undefined ? day : sameKind ? current.event.day : EVENT_PRESETS[kind].day;
      const nextTime = time !== undefined ? time : sameKind ? current.event.time : EVENT_PRESETS[kind].time;
      return { ...current, event: makeEvent(kind, nextDay, nextTime) };
    });
  }, []);

  const cycleEvent = useCallback(() => {
    setStored((current) => ({ ...current, event: makeEvent(nextEventKind(current.event.kind)) }));
  }, []);

  const toggleSession = useCallback(
    (id: string) => {
      setStored((current) => ({
        ...current,
        completed: { ...current.completed, [weekId]: toggleIn(current.completed[weekId], id) },
      }));
    },
    [weekId],
  );

  const toggleDone = useCallback(
    (key: string) => {
      setStored((current) => ({
        ...current,
        done: { ...current.done, [weekId]: toggleIn(current.done[weekId], key) },
      }));
    },
    [weekId],
  );

  const toggleBought = useCallback(
    (food: string) => {
      setStored((current) => ({
        ...current,
        shopping: { ...current.shopping, [weekId]: toggleIn(current.shopping[weekId], food) },
      }));
    },
    [weekId],
  );

  const doneList = stored.done[weekId];
  const boughtList = stored.shopping[weekId];
  const isDone = useCallback((key: string) => Boolean(doneList?.includes(key)), [doneList]);
  const isBought = useCallback((food: string) => Boolean(boughtList?.includes(food)), [boughtList]);

  const value = useMemo<PlannerContextValue>(
    () => ({
      ready,
      today,
      todayKey: dayKeyOf(today),
      profile: stored.profile,
      updateProfile,
      resetProfile,
      weekEvent: stored.event,
      setEvent,
      cycleEvent,
      plan,
      fuel,
      sessions,
      toggleSession,
      isDone,
      toggleDone,
      isBought,
      toggleBought,
    }),
    [
      ready,
      today,
      stored.profile,
      stored.event,
      updateProfile,
      resetProfile,
      setEvent,
      cycleEvent,
      plan,
      fuel,
      sessions,
      toggleSession,
      isDone,
      toggleDone,
      isBought,
      toggleBought,
    ],
  );

  return <PlannerContext.Provider value={value}>{children}</PlannerContext.Provider>;
}

export function usePlanner(): PlannerContextValue {
  const context = useContext(PlannerContext);
  if (!context) throw new Error('usePlanner must be used inside <PlannerProvider>');
  return context;
}
