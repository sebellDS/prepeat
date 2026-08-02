# Lessons from building Prep+Eat

*Written 2026-08-02, the week Prep+Eat was submitted to the App Store.*

A keepsake, not a spec. The scope, data model and open work live in
[projektgrundlag.md](projektgrundlag.md) and [backlog.md](backlog.md). This
page is the step back: how the app actually got built, what worked, where the
wasted rounds came from, and what to carry into the next thing. Written for
Thomas, who is not a developer and built a real consumer app anyway.

## The arc

More disciplined than it felt from the inside:

- **April–June 2026** – the Sebell Design System came first: colours, forms,
  tab bar, chips, pills, an accessibility audit. Roughly twenty sessions
  before the app existed.
- **3 July** – the app begins.
- **6–20 July** – design tokens wired in, then Recipes and Plan built screen by
  screen from Figma.
- **22–24 July** – the whole household journey: multi-household, invite, leave,
  delete, onboarding.
- **24–27 July** – EAS cloud builds, TestFlight, the Apple Developer account.
- **27–31 July** – the unglamorous launch layer: trademark search, privacy
  policy, website, DNS, the reviewer demo account, all the App Store Connect
  paperwork.
- **31 July** – submitted for review.

A real consumer app, on the store, in under a month of app work, on top of a
design system built alongside it. That is the headline, and it should be read
before any of the criticism below: the process mostly worked.

## What worked unusually well – keep doing these

**A written backlog with a decisions log.** The single best habit in the
project. Decisions are recorded *with their reasoning* – why `hello@prepeat.app`
over a personal address, why the auth-schema OTP trigger was rejected in favour
of a real demo mailbox. Ideas are attributed and dated. That is why a cold
thread can be picked up without re-arguing settled questions. Very few
professional teams keep a log this good.

**Design-system-first.** Building the DS before the app is why the screens feel
like one product instead of fifteen. It cost time up front and repaid it on
every screen after.

**Small, reviewable chunks.** Numbered pull requests, dedicated review passes.
That is how the app stayed coherent across dozens of separate sessions.

**Scope discipline.** Recipe-sharing and Sign-in-with-Apple were deferred *on
purpose*, with the reasoning written down, instead of letting v1 sprawl. Saying
no to good ideas at the right time is the hardest part of shipping, and it was
done well.

## Where the rework came from

Almost every painful round traces to one of two root causes. Naming them is the
real lesson.

### Root cause 1 – building an approximation instead of the design

It bit twice, hard. On 12 July a screen was built by guessing instead of
fetching the Figma spec, and cost an eleven-bug QA round. On 17 July a set of
sheets shipped with an invented switch, header and row style. Both produced the
same rule: **fetch the real spec first, build the actual design, never
improvise and let it read as the designer's work.** The on-device app is the
instrument the design is judged with; an improvised implementation makes design
flaws invisible and the review meaningless, on top of the wasted correction
rounds.

### Root cause 2 – not knowing what was actually live

- The Plan tab spun forever on every phone because a migration dropped a
  database column that the *shipped* app still read. The code and the deployed
  app had drifted apart.
- The pre-launch audit concluded "you need a website" while a stale privacy
  policy was already live on an old branch – two different privacy policies on
  the internet at once, the older one wrong.
- The privacy policy shipped naming two data processors when there were three;
  the missing one (Resend) handles every user's email. Found by luck, from a
  screenshot.

Different symptoms, one gap: **the code was ahead of, or out of sync with, the
thing users were actually touching.**

Everything else that hurt – a stuck TLS certificate, the SQL editor truncating
long pastes, the submit CLI hanging – was friction with outside tools, not a
process failure. Annoying, not avoidable by working differently.

## The lessons, written down

These were promoted into the global `~/.claude/CLAUDE.md` on 2026-08-02 so
every future project inherits them, not just this one. Recorded here too,
because this is where they were learned.

**On how the work is done**

1. The owner is not a developer: plain language, click-by-click steps for
   anything only he can do, decisions framed as product trade-offs.
2. Keep a written backlog with a decisions log – the *why*, not just the *what*.

**On design-driven work**

3. Fetch the real design spec before building. Guessing produces avoidable
   rework.
4. Build the actual design, not an approximation. Every state is part of it
   (default, pressed, error, disabled, empty); a screen is not done until those
   states exist. Where the design has a genuine gap, say so and flag the
   improvisation.
5. When a design system exists, its token values are the source of truth for
   colour, spacing, radius and type – not the raw hex numbers in a design file,
   which lag behind.

**On shipping**

6. Know the difference between what is in the code and what is actually live. A
   database change reaches users immediately; app code only reaches a phone on
   the next build. Never let the two drift silently.
7. Migration safety: never remove a database column, or break an API, that a
   build already in users' hands still relies on. Add first, remove a version
   later.
8. Before concluding something is missing, check what is actually deployed –
   read the live state, not just the repo.
9. Trust the platform's own confirmation of success (the App Store showing a
   build as valid), not an upload tool's spinner, which can hang both when
   stuck and after it has succeeded.
10. Cloud builds do not get local secrets automatically – environment variables
    have to be supplied to the build service, or the app breaks in a way that
    looks like a native crash.

## Skills worth growing

Not "learn to code" – the setup handles that. The literacy that makes the owner
a stronger partner and cuts the rounds:

- **What is shipped vs what is in the code.** The highest-value idea in the
  whole project. Both root-cause-2 incidents come from this one gap.
- **Reading a design spec as a contract, not a picture** – every state is part
  of the design.
- **Structured QA feedback**: what you expected, what you saw, and *on which
  build*. That last part turns "won't load" into a diagnosable report.
- **Knowing when a question is legal, not product** – as with the trademark and
  imported-recipe copyright questions, which were flagged and parked for an
  attorney rather than guessed.
- **Basic release literacy**: TestFlight vs App Store, why builds are numbered,
  why "manual release" means you press the button.

## What we would do differently

- **A real definition of done.** Nothing is marked done until it is confirmed
  on-device *and* the build it landed in is noted. That alone removes most of
  root cause 2.
- **A standing migration rule**, not a scar: add a column before you rely on it,
  remove it a version after nothing live reads it.
- **Check what is actually deployed** at the start of any launch-prep work – a
  thirty-second look at the live state before deciding anything is missing.

The process was good. The friction was concentrated in two learnable places,
and both are now written rules. That is the right ending: not a project with no
mistakes, but one that turned its mistakes into things it will not repeat.
