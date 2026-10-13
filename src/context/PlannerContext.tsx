import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';

import { DEFAULT_EVENT, DEFAULT_PROFILE } from '@/lib/defaults';
import { EVENT_PRESETS, makeEvent, nextEventKind } from '@/lib/events';
import {
  emptyWeek,
  migrateLogs,
  removeCustomMeal,
  saveCheckIn as saveCheckInTo,
  saveCustomMeal,
  setEffort,
  setSessionDone,
  toggleItem,
  toggleMeal as toggleMealIn,
  toggleShopping,
  type CheckIn,
  type CustomMeal,
  type SavedMeal,
  type WeekLog,
} from '@/lib/logbook';
import { buildWeekFuel, type WeekFuel } from '@/lib/mealPlanner';
import { buildWeekPlan } from '@/lib/scheduler';
import { dayKeyOf, startOfWeek, toISODate, weekIdOf } from '@/lib/time';
import type { DayKey, EventKind, Minutes, PlanSession, Profile, WeekEvent, WeekPlan } from '@/lib/types';

export type { PlanSession } from '@/lib/types';

const STORAGE_KEY = 'perform:v1';

type Stored = {
  profile: Profile;
  event: WeekEvent;
  onboarded: boolean;
  /** Tips the athlete has dismissed. */
  hints: string[];
  logs: Record<string, WeekLog>;
  /** Favourite own meals for one-tap re-adding. */
  myMeals: SavedMeal[];
};

type PlannerContextValue = {
  ready: boolean;
  onboarded: boolean;
  completeOnboarding: () => void;
  restartOnboarding: () => void;
  today: Date;
  todayKey: DayKey;
  todayISO: string;
  profile: Profile;
  updateProfile: (patch: Partial<Profile>) => void;
  resetProfile: () => void;
  weekEvent: WeekEvent;
  setEvent: (kind: EventKind, day?: DayKey | null, time?: Minutes | null) => void;
  cycleEvent: () => void;
  plan: WeekPlan;
  fuel: WeekFuel;
  sessions: PlanSession[];
  week: WeekLog;
  toggleSession: (id: string) => void;
  rateSession: (id: string, effort: number) => void;
  isDone: (key: string) => boolean;
  toggleDone: (key: string) => void;
  isEaten: (mealId: string) => boolean;
  toggleMeal: (mealId: string) => void;
  isBought: (food: string) => boolean;
  toggleBought: (food: string) => void;
  checkIn: (date: string) => CheckIn | undefined;
  saveCheckIn: (date: string, patch: Omit<CheckIn, 'at'>) => void;
  customMeals: (date: string) => CustomMeal[];
  saveMeal: (date: string, meal: CustomMeal, remember: boolean) => void;
  deleteMeal: (date: string, id: string) => void;
  myMeals: SavedMeal[];
  forgetMeal: (id: string) => void;
  hintSeen: (id: string) => boolean;
  dismissHint: (id: string) => void;
  resetHints: () => void;
};

const PlannerContext = createContext<PlannerContextValue | null>(null);

/** Keep the last few weeks of logs so storage doesn't grow forever. */
const recent = (logs: Record<string, WeekLog>) =>
  Object.fromEntries(Object.entries(logs).sort(([a], [b]) => b.localeCompare(a)).slice(0, 8));

export function PlannerProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [today, setToday] = useState(() => new Date());
  const [stored, setStored] = useState<Stored>({
    profile: DEFAULT_PROFILE,
    event: DEFAULT_EVENT,
    onboarded: false,
    hints: [],
    logs: {},
    myMeals: [],
  });
  const loaded = useRef(false);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (!raw) return;
        const saved = JSON.parse(raw) as Partial<Stored> & {
          completed?: Record<string, string[]>;
          done?: Record<string, string[]>;
          shopping?: Record<string, string[]>;
        };
        setStored((current) => ({
          profile: { ...current.profile, ...saved.profile },
          event: saved.event ?? current.event,
          // Anyone with saved data from before onboarding existed has already set up.
          onboarded: saved.onboarded ?? Boolean(saved.profile),
          hints: saved.hints ?? [],
          logs: migrateLogs(saved),
          myMeals: saved.myMeals ?? [],
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
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({ ...stored, logs: recent(stored.logs) })).catch(() => undefined);
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
  const week = useMemo(() => stored.logs[weekId] ?? emptyWeek(), [stored.logs, weekId]);

  const completed = useMemo(() => new Set(Object.keys(week.sessions)), [week.sessions]);
  const plan = useMemo(
    () => buildWeekPlan(stored.profile, stored.event, weekStart, completed),
    [stored.profile, stored.event, weekStart, completed],
  );
  const fuel = useMemo(() => buildWeekFuel(stored.profile, plan), [stored.profile, plan]);
  const sessions = useMemo(() => plan.days.flatMap((day) => day.sessions), [plan]);

  const updateWeek = useCallback(
    (fn: (log: WeekLog) => WeekLog) =>
      setStored((current) => ({
        ...current,
        logs: { ...current.logs, [weekId]: fn(current.logs[weekId] ?? emptyWeek()) },
      })),
    [weekId],
  );

  const updateProfile = useCallback((patch: Partial<Profile>) => {
    setStored((current) => ({ ...current, profile: { ...current.profile, ...patch } }));
  }, []);

  const resetProfile = useCallback(() => {
    setStored((current) => ({ ...current, profile: DEFAULT_PROFILE, event: DEFAULT_EVENT }));
  }, []);

  const completeOnboarding = useCallback(() => setStored((current) => ({ ...current, onboarded: true })), []);
  const restartOnboarding = useCallback(() => setStored((current) => ({ ...current, onboarded: false })), []);

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
    (id: string) => updateWeek((log) => setSessionDone(log, id, !log.sessions[id])),
    [updateWeek],
  );
  const rateSession = useCallback((id: string, effort: number) => updateWeek((log) => setEffort(log, id, effort)), [updateWeek]);
  const toggleDone = useCallback((key: string) => updateWeek((log) => toggleItem(log, key)), [updateWeek]);
  const toggleMeal = useCallback((id: string) => updateWeek((log) => toggleMealIn(log, id)), [updateWeek]);
  const toggleBought = useCallback((food: string) => updateWeek((log) => toggleShopping(log, food)), [updateWeek]);
  const saveCheckIn = useCallback(
    (date: string, patch: Omit<CheckIn, 'at'>) => updateWeek((log) => saveCheckInTo(log, date, patch)),
    [updateWeek],
  );

  const saveMeal = useCallback(
    (date: string, meal: CustomMeal, remember: boolean) => {
      updateWeek((log) => saveCustomMeal(log, date, meal));
      if (!remember) return;
      setStored((current) => {
        const name = meal.name.trim().toLowerCase();
        const others = current.myMeals.filter((m) => m.name.trim().toLowerCase() !== name);
        const saved: SavedMeal = { id: `saved-${meal.id}`, name: meal.name.trim(), kcal: meal.kcal, p: meal.p, c: meal.c, f: meal.f };
        return { ...current, myMeals: [saved, ...others].slice(0, 30) };
      });
    },
    [updateWeek],
  );
  const deleteMeal = useCallback((date: string, id: string) => updateWeek((log) => removeCustomMeal(log, date, id)), [updateWeek]);
  const customMeals = useCallback((date: string) => week.custom[date] ?? [], [week.custom]);
  const forgetMeal = useCallback(
    (id: string) => setStored((current) => ({ ...current, myMeals: current.myMeals.filter((m) => m.id !== id) })),
    [],
  );

  const isDone = useCallback((key: string) => week.items.includes(key), [week.items]);
  const isEaten = useCallback((id: string) => week.meals.includes(id), [week.meals]);
  const isBought = useCallback((food: string) => week.shopping.includes(food), [week.shopping]);
  const checkIn = useCallback((date: string) => week.checkIns[date], [week.checkIns]);

  const hintSeen = useCallback((id: string) => stored.hints.includes(id), [stored.hints]);
  const dismissHint = useCallback(
    (id: string) => setStored((current) => ({ ...current, hints: [...new Set([...current.hints, id])] })),
    [],
  );
  const resetHints = useCallback(() => setStored((current) => ({ ...current, hints: [] })), []);

  const value = useMemo<PlannerContextValue>(
    () => ({
      ready,
      onboarded: stored.onboarded,
      completeOnboarding,
      restartOnboarding,
      today,
      todayKey: dayKeyOf(today),
      todayISO: toISODate(today),
      profile: stored.profile,
      updateProfile,
      resetProfile,
      weekEvent: stored.event,
      setEvent,
      cycleEvent,
      plan,
      fuel,
      sessions,
      week,
      toggleSession,
      rateSession,
      isDone,
      toggleDone,
      isEaten,
      toggleMeal,
      isBought,
      toggleBought,
      checkIn,
      saveCheckIn,
      customMeals,
      saveMeal,
      deleteMeal,
      myMeals: stored.myMeals,
      forgetMeal,
      hintSeen,
      dismissHint,
      resetHints,
    }),
    [
      ready,
      stored.onboarded,
      stored.profile,
      stored.event,
      completeOnboarding,
      restartOnboarding,
      today,
      updateProfile,
      resetProfile,
      setEvent,
      cycleEvent,
      plan,
      fuel,
      sessions,
      week,
      toggleSession,
      rateSession,
      isDone,
      toggleDone,
      isEaten,
      toggleMeal,
      isBought,
      toggleBought,
      checkIn,
      saveCheckIn,
      customMeals,
      saveMeal,
      deleteMeal,
      stored.myMeals,
      forgetMeal,
      hintSeen,
      dismissHint,
      resetHints,
    ],
  );

  return <PlannerContext.Provider value={value}>{children}</PlannerContext.Provider>;
}

export function usePlanner(): PlannerContextValue {
  const context = useContext(PlannerContext);
  if (!context) throw new Error('usePlanner must be used inside <PlannerProvider>');
  return context;
}
