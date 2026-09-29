# Perform

A training + fueling planner for athletes who work full-time. You enter your shifts, sleep, open training days and the week's main event. Perform works out **which day and what time** each session goes, and builds a **weekly meal prep** sized to that week's training load.

Built with Expo SDK 57 + Expo Router (iOS, Android, web).

## Run it

```bash
npm install
npx expo start        # press i / a / w, or scan with Expo Go
npm test              # scheduler + meal-planner tests
npm run typecheck
npm run lint
```

## Screens

| Tab | What it does |
| --- | --- |
| **Today** | The week rail, the next window, the day's timeline (session, mobility, fuel, wind-down), weekly load, and the week's main event. Tap the event card to cycle event types. |
| **Plan** | Pick the event (build muscle, mid-week match, weekend match, 10K, HYROX, deload) plus its day and time. Shows the sleep anchor and the reasoning behind the week, and each day's session with *why this slot* and the full workout. |
| **Fuel** | Daily macro targets vs what's planned, meals timed around training, two prep sessions (what to cook, how much, in what order), and a checkable shopping list. |
| **Profile** | Shifts per day, commute, wake time and sleep need, chronotype, open days, sessions per week, clients/team/family blocks, diet and exclusions. |

Everything is stored on the device (AsyncStorage). Completed sessions, ticked timeline items and shopping checks are kept per week.

## How the schedule is built (`src/lib/scheduler.ts`)

1. **Sleep comes first.** Lights-out is wake time minus sleep need. Hard sessions must finish at least 2 h before lights-out; closer than that they are penalized, and closer than 1 h they are not allowed. The night before an early race, lights-out moves earlier to match the race-morning alarm.
2. **Free windows** are what's left of each open day after work ± commute, commitments, the family block and the event.
3. **Every 15-min slot is scored** on a time-of-day performance curve (strength and power peak late afternoon, shifted by chronotype), minus penalties for sleep proximity, sleep inertia and a long shift just finished.
4. **Days are assigned by exhaustive search** over the week's sessions (`src/lib/sessions.ts`). It respects event spacing (e.g. heavy legs 72 h+ from kick-off, primer on MD-1, flush on MD+1, last hard run 4+ days before a 10K), avoids back-to-back same-muscle days and long streaks, and drops the lowest-priority session when days run out.
5. Main sessions are nudged toward a shared start time so the week has a rhythm. Every placement comes with a plain-English reason.

## How meal prep is built (`src/lib/mealPlanner.ts`)

- **Targets** (`nutrition.ts`): protein 2.0 g/kg (2.2 in a hypertrophy block). Carbs scale with the day's load, from 4 g/kg on rest days to 7–8 g/kg the day before and the day of a match or HYROX. Fat fills the rest, lower before competition.
- **Meals are timed to training**: early dinner on the break before an evening session, a recovery shake after, a pre-match meal 3–4 h out, and a race breakfast 2–3 h before an early start.
- **Prepped bowls are sized by a small solver** so each day lands within a few percent of target. Very high-carb days get simple-carb top-ups (bagel, sports drink) rather than giant bowls.
- **Two prep sessions**: Sunday for the first half of the week and a mid-week refresh (Wed or Thu, never match day), so no container is more than 4 days old. You get batch amounts, an order of work, and one aggregated shopping list.
- Recipes rotate weekly and respect omnivore/pescatarian/vegetarian plus dairy-, gluten- and nut-free.

This is general performance guidance, not medical or dietetic advice. Adjust body weight, sleep need and targets to how you respond.

## Project layout

```
src/app/            routes: (tabs)/index (Today), plan, fuel; profile (modal)
src/context/        PlannerContext: state, persistence, derived plan + fuel
src/lib/            pure logic: scheduler, sessions, events, nutrition, foods, recipes, mealPlanner
src/lib/__tests__/  jest tests for the engines
src/components/     shared UI (chips, steppers, cards)
```

App icons and splash images are still the Expo template placeholders.
