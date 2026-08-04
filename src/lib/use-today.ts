// The app's clock: what day is it, and therefore what week is it.
//
// ONE source, deliberately. Both values come off the same tick, so the app can
// never render a week that starts on Monday while still marking Sunday as
// today – which is exactly what Thomas saw on the phone on 2026-08-04 when the
// week and the day highlight were computed independently.
//
// WHY A HOOK AND NOT `new Date()` IN A COMPONENT (this is the trap, and it is
// specific to this project): `reactCompiler: true` in app.json. The React
// Compiler memoizes render-body expressions by their reactive inputs, and
// `toDateKey(new Date())` has NONE – so it is cached for the lifetime of the
// component and never recomputed, however many times the component re-renders.
// It LOOKS like live code and behaves like a value frozen at mount. Reading the
// clock during render is unsupported in a compiled component (the same warning
// the React Compiler gives about Date.now() and Math.random()), so the clock
// has to arrive as state, from here.
//
// Known bug 3 was the provider-level half of this: both providers held the
// current week in an empty-dependency useMemo, so an app left open or
// backgrounded across Sunday midnight went on treating the finished week as
// current, and a meal added to what LOOKED like this week landed on last
// week's plan and list.
//
// Two things move the clock, and neither covers the other:
//   * coming back to the foreground – the overnight case, where iOS suspended
//     the JS thread so no timer of ours ever ran;
//   * a plain short tick – the app genuinely left open across midnight, where
//     'active' never fires because the app never left.
//
// WHY THE TICK IS DUMB AND SHORT (rewritten 2026-08-04 after the first version
// failed on the phone). That version scheduled one timer to land exactly on
// midnight, capped at 15 minutes so React Native never saw a multi-day
// setTimeout. The flaw: a timer fires after that much REAL time has passed and
// knows nothing about the wall clock moving underneath it. Set the phone's
// clock forward to Sunday 23:58 with the app open and the pending timer still
// had its original delay to run, so the week rolled over eleven minutes late.
// A clock jump is not only a test artifact either – a phone coming back from
// being switched off, or correcting itself against the network, does the same.
// Re-reading the clock every ten seconds has none of that cleverness and none
// of its failure modes.
//
// The cost is one date read and one string compare six times a minute for the
// WHOLE APP – a single shared ticker rather than one per component – and only
// while the app is in the foreground, since iOS suspends timers otherwise.
// Nothing is notified unless the day actually changed.
import { useSyncExternalStore } from 'react';
import { AppState } from 'react-native';

import { fromDateKey, toDateKey, weekStartOf } from '@/lib/week';

const TICK_MS = 10 * 1000;

let today = toDateKey(new Date());
const listeners = new Set<() => void>();
let timer: ReturnType<typeof setInterval> | undefined;
let appStateSubscription: { remove: () => void } | undefined;

function sync() {
  const next = toDateKey(new Date());
  if (next === today) return;
  today = next;
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (listeners.size === 1) {
    timer = setInterval(sync, TICK_MS);
    appStateSubscription = AppState.addEventListener('change', (appState) => {
      if (appState === 'active') sync();
    });
    // The day may have turned while nothing was subscribed – on the very first
    // mount this is a no-op, but a remount after the last consumer unmounted
    // (a household switch tears the providers down) would otherwise start from
    // a stale module-level value.
    sync();
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size > 0) return;
    if (timer) clearInterval(timer);
    timer = undefined;
    appStateSubscription?.remove();
    appStateSubscription = undefined;
  };
}

function getSnapshot() {
  return today;
}

/** Today as a local 'YYYY-MM-DD' key, kept current while the app runs. */
export function useTodayKey(): string {
  return useSyncExternalStore(subscribe, getSnapshot);
}

/**
 * The Monday of the week we are in now, kept current while the app runs.
 * Derived from the same tick as useTodayKey, so the two always agree.
 */
export function useCurrentWeekStart(): string {
  return weekStartOf(fromDateKey(useTodayKey()));
}
