# Goals System — UX Design Decisions

Research-backed decisions for the Goals, Habits, Timeline, and Life Areas features.

---

## Habits: "Momentum" not "Streaks"

**Sources:** DopaLoop (ADHD-specific), Loop Habit Tracker, Streaks (iOS), Daylio

- Never call it a "streak" — call it **momentum**. Streaks create a binary win/lose dynamic that triggers avoidance after a single miss.
- Momentum **decays slowly** instead of resetting to 0. Miss one day? Score dips from 85% to 82%, not to zero. Formula: weighted sum over 30 days with 0.95 decay factor.
- Allow **partial credit** (1-5 intensity scale via hold-click). Binary yes/no triggers perfectionism — "I did 2 min of exercise" should still count.
- **Warm amber heatmap** (not GitHub green) to match the app's palette. Levels: transparent → amber-100 → amber-200 → amber-400 → amber-500.
- Never show "Streak: 0" or "days since last activity."
- Show "most consistent month" instead of "longest streak" — frame patterns over chains.
- One-tap completion is the friction minimum (Streaks app pattern).

---

## Goal Cards

**Sources:** Linear (project cards), Notion (gallery view), Monday.com (cards view)

- **4-6 data points max** per card: name, progress bar, life area chip, milestone fraction, target date.
- 2-column grid default, 3 columns when sidebar is hidden. CSS Grid `auto-fill, minmax(280px, 1fr)`.
- Sort by **"most recently active"** by default — reduces decision paralysis about which goal to work on.
- Show **"Not started"** instead of "0%" — no empty progress bar shame.
- Celebrate milestones at 25/50/75/100% with a subtle pulse animation (once, not recurring).
- Click-to-expand (not hover-reveal). Hover is reserved for subtle highlights.
- **"Best momentum" highlight:** Optionally highlight the goal with the most recent activity.
- No "days since last activity" counter — that's guilt-inducing for no benefit.

---

## Timeline View

**Sources:** Linear (primary reference), Asana, Notion, ClickUp

- **Two zoom levels only** (month + week) — more creates decision fatigue.
- **Auto-scroll to today** on open. Don't make the user hunt for "now."
- **Today marker:** Vertical dashed line in warm amber with "Today" label. Always visible.
- **Goal bars:** 24px height, pill-shaped (border-radius: 12px). Fill color based on health: warm green (on-track), amber (needs attention), warm coral (behind). Active = 100% opacity, completed = 40%.
- **Gentle overdue treatment:** Extend the bar with a dashed outline past the target date, label "still active" in neutral text. NO red. Red = emergency = avoidance.
- **Milestone diamonds** on bars: gray (upcoming), amber (current focus), green (complete). 8px diamond shapes. Nearby milestones collapse into a numbered badge.
- **Frozen left panel** (200px) with goal names + life area chips. Right panel scrolls horizontally.
- **Off-screen arrow indicators** (Notion pattern): when a bar extends beyond the visible area, show a small arrow at the edge of its row.
- **"Today" snap button** in top-right corner. Keyboard shortcut: `T`.
- Don't show empty past stretches — center on "last month + next 2 months."

---

## Goal Progress

**Sources:** Linear, Strides, Lattice/Perdoo (OKR tools)

- Auto-derive progress from completed milestones + tasks in linked projects.
- Separate **progress** (objective: what % done) from **health** (contextual: is this enough given the timeline).
- Always frame as **"X% complete"** not "X% remaining."
- **Pace indicator:** A diamond marker on the progress bar showing where you *should* be given the current date vs. start/target dates.
- If a goal has zero progress, show "Not started" in neutral text instead of an empty bar.
- Progress = milestones completed / total milestones (primary). If no milestones, fall back to tasks completed / total tasks in linked projects.

---

## Life Areas

**Sources:** Wheel of Life, Level10Life, Reclaim.ai

- 6 pre-populated areas with **persistent color + icon pairs:**
  - Career (#3b82f6, Briefcase)
  - Health (#22c55e, Heart)
  - Creative (#f59e0b, Palette)
  - Financial (#8b5cf6, DollarSign)
  - Personal (#ec4899, User)
  - Learning (#06b6d4, GraduationCap)
- Colored chips used **everywhere** (cards, timeline, today page) for instant visual recognition.
- "Uncategorized" is a valid option — don't force categorization.
- Quick-assign via icon buttons during goal creation.

---

## Milestone Markers

**Sources:** Linear, Jira

- **Diamond markers** are the universal standard (10px diamonds on timeline bars).
- Status-colored: gray (upcoming), amber (current focus), green (complete).
- Subtle **pulse animation** when a milestone is within 7 days.
- Auto-suggest milestones at 25/50/75% intervals to reduce planning friction.
- Milestones are **binary checkpoints** — name + optional target date + done/not-done.
- Nearby milestones on the timeline collapse into a numbered badge to prevent visual clutter.

---

## ADHD-Friendly Adaptations (applied across all features)

- **No guilt UI:** No streaks, no "you've been away" messages, no overdue shaming. Use neutral "still open" framing.
- **Momentum over streaks:** Scores decay slowly — one missed day doesn't destroy progress.
- **Partial credit:** Any effort counts (1-5 intensity for habits).
- **Progress celebrations:** Subtle pulse at milestone thresholds, not recurring notifications.
- **Decision reduction:** Default sort by "most recently active." Don't force the user to choose.
- **Warm framing:** "Not started" instead of "0%." "Still active" instead of "overdue." No red.
- **Return celebrations:** After a break, the app should welcome you back without judgment. "Welcome back — here's where you left off."
