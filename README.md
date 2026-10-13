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

## Using the app

New users go through a 2-minute setup (sport, work hours, training days, sleep, fixed commitments, this week's focus, food). Every answer can be changed later under **You**.

| Tab | What it does |
| --- | --- |
| **Today** | What's up next, with one button to log it. Your whole day in time order (training, meals, recovery), each with a check circle, a morning check-in prompt, and fuel and week progress. |
| **Plan** | The week day by day. Each session shows its time and effort, a check circle, and a "See workout & why" panel. Change this week's focus from the top card. |
| **＋ Log** | One place to log a day: how you slept and feel (gives a plain "push / hold back" call), sessions with a 1–10 effort rating, meals (or "ate all as planned"), and recovery habits. Earlier days this week can be logged too. |
| **Fuel** | Meals timed to training, with eaten vs planned for the day; add your own meals or swap one in for a planned meal (saved to My meals for one-tap re-use); the two prep sessions step by step; and a checkable shopping list. |
| **You** | Profile and schedule settings, tips, run setup again, reset. |

Everything is stored on the device (AsyncStorage). Logs are kept per week.

## Share it with your team (private link)

`server/index.mjs` hosts the web version behind a team password. Teammates open the link on their phone, enter the password once (they stay signed in for 60 days), and can **Add to Home Screen** to use it like an app. Each person's data stays on their own phone.

**Deploy on Render (free):**

1. Sign in at [render.com](https://render.com) with GitHub and allow access to this repo.
2. **New → Blueprint**, pick this repo. Render reads `render.yaml`.
3. When asked for `ACCESS_PASSWORD`, enter a team password (use something long, e.g. three random words).
4. Wait for the first build (~5 min). Share the `https://perform-….onrender.com` link and the password.

Free instances sleep after 15 minutes idle, so the first visit after a break takes up to a minute. Every push to the branch redeploys automatically. To lock everyone out, change `ACCESS_PASSWORD` in Render.

**Run the same thing locally:**

```bash
ACCESS_PASSWORD=pick-a-password npm run preview   # builds, then serves on http://localhost:3000
npm run test:server                               # server tests
```

The server is plain Node 20+ with no dependencies, so any Node host works: build with `npm run build:web`, start with `npm run serve`, and set `ACCESS_PASSWORD`.

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
src/app/            routes: onboarding, (tabs)/index · plan · fuel · you, log · meal · edit/[section] (modals)
server/             password-protected web host + tests
public/             web manifest and home-screen icons
src/context/        PlannerContext: state, persistence, derived plan + fuel
src/lib/            pure logic: scheduler, sessions, events, nutrition, foods, recipes, mealPlanner, logbook
src/lib/__tests__/  jest tests for the engines and the logbook
src/components/     ui (design system), setup (shared setup steps), log (effort picker, task rows)
src/constants/      colors and type scale
```

App icons and splash images are still the Expo template placeholders.
