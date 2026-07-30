# App Store Connect – App Privacy & Age Rating answers

Drafted 2026-07-30, ready to enter in App Store Connect. These are the
questionnaire answers, not the privacy-policy document (that lives at
[privacy-policy.md](privacy-policy.md) and prepeat.app/privacy.html).

**Grounding.** Verified against the code, not memory: no analytics, crash,
advertising or tracking SDK is present (checked package.json); `expo-device`
is a transitive dependency and is not imported anywhere; there are no push
notifications, no location, no IDFA/advertising identifier, and no in-app
browser. The app collects only what sign-in and the shared cookbook need.

Two things below are flagged **CONFIRM** – judgement calls worth a second
opinion (fold into the attorney conversation already queued in the backlog),
not blockers.

---

## 1. App Privacy ("nutrition label")

App Store Connect → your app → **App Privacy** → "Get Started". For each data
type it asks: *do you collect it, is it linked to the user's identity, is it
used to track them, and for what purpose.*

**Nothing here is used for tracking** (Apple's definition of tracking = linking
with third-party data for ads, or sharing with data brokers – the app does
neither). So every "Used to Track You" answer is **No**, and the finished label
will read **"Data Linked to You"** with **no** "Data Used to Track You" section.

| Apple data type | Collected? | Linked to identity? | Tracking? | Purpose |
|---|---|---|---|---|
| **Contact Info → Email Address** | Yes | Yes | No | App Functionality (sign-in / account) |
| **Contact Info → Name** (first name only) | Yes | Yes | No | App Functionality (member attribution / the household member's initial) |
| **User Content → Other User Content** (recipes, meal plans, shopping items) | Yes | Yes | No | App Functionality |
| **Identifiers → User ID** (the account ID) | Yes — **CONFIRM** | Yes | No | App Functionality |

Everything else Apple lists – Health, Financial, Location, Contacts, Browsing
History, Search History, Purchases, Diagnostics, Usage Data, Advertising Data,
Sensitive Info, etc. – answer **Not Collected**.

**Per-type detail Apple asks for each "Yes":**
- **Email Address** – Purpose: *App Functionality*. Linked to identity: *Yes*.
  Used for tracking: *No*.
- **Name** – Purpose: *App Functionality*. Linked: *Yes*. Tracking: *No*.
- **Other User Content** – Purpose: *App Functionality*. Linked: *Yes*.
  Tracking: *No*.
- **User ID** – Purpose: *App Functionality*. Linked: *Yes*. Tracking: *No*.

**CONFIRM – whether to declare "User ID".** The app's backend (Supabase)
assigns each account an internal UUID and stamps it on recipes and checked-off
items (`created_by_user_id`, `checked_by_user_id`). It is never shown to the
user, never shared, never used for ads. Apple's "User ID" type is "account ID
or other user-level ID", which this technically is. Declaring it is the
conservative, defensible choice and costs nothing (it does not add a tracking
disclosure). Leaving it off is arguable since it is a purely internal operating
key. **Recommendation: declare it.** Worth one line to the attorney.

**Consistency check that matters.** The listing's "NO ADS. NO TRACKING. NO
NONSENSE." section and the privacy policy both promise no tracking and no
advertising. This label must agree – and it does: no tracking, no ads, no
data-broker sharing. If any of those three ever changes, all three surfaces
(label, listing, policy) change together.

---

## 2. Age Rating

App Store Connect → your app → the app's page → **Age Rating → Edit**. Apple
refreshed this questionnaire in 2025; the substance below maps to whichever
wording is shown.

**Target result: 4+ (Apple's lowest rating).** Answer every content question
**None / No**:

| Question | Answer |
|---|---|
| Cartoon or Fantasy Violence | None |
| Realistic Violence | None |
| Sexual Content or Nudity | None |
| Profanity or Crude Humor | None |
| Horror / Fear Themes | None |
| Mature / Suggestive Themes | None |
| Alcohol, Tobacco, or Drug Use or References | None — **CONFIRM**, see note |
| Simulated Gambling / Contests | None |
| Medical / Treatment Information | None |
| Unrestricted Web Access | No |
| Made for Kids / Kids Category | **No** – do NOT enrol |

**Do not enrol in the Kids Category.** It is for apps aimed at children and
brings COPPA obligations (no external links, stricter data rules). Prep+Eat is
a family utility, not a children's app; 4+ without the Kids Category is right.

**CONFIRM – alcohol as a recipe ingredient.** Some imported recipes list
alcohol as an ingredient (the Bolognese has "dry red wine"). Apple's
alcohol/tobacco/drug question is about content that *depicts or encourages*
use – bars, drinking, promotion – not an ingredient in a cooking app, which
reviewers routinely pass at 4+. Answer **None**. If a reviewer ever flags it,
the fallback is the lowest tier ("Infrequent/Mild"), which still yields a low
rating. Noting it so it is a decision, not a surprise.

**IMPORTANT – "User-Generated Content" and the v1.1 sharing feature.** In v1.0
recipes, plans and lists are user-created but shared **only inside the
household** (invite-only, no public library, no contact with strangers – the
public recipe library is deliberately excluded). So the UGC questions that push
a rating to 17+ or require moderation/reporting/blocking (Guideline 1.2) do
**not** apply: no stranger ever sees a household's content. Answer the UGC
questions on that basis for v1.0.
**This changes the day sharing ships (v1.1+).** Once a recipe can be sent by
public link to someone outside the household, the app has genuine
user-generated content visible to others, and Apple will expect a way to report
and block objectionable content plus a content policy. Re-answer the age-rating
questionnaire and add those controls as part of the share feature – it is on
the share item under Later, but flag it here too so the rating is revisited,
not carried over blindly.

---

## Not covered here (separate checklist items)

Category (Food & Drink), copyright line, and territory selection are the
"remaining App Store Connect paperwork" item – small, but the territory choice
is where the UK-tagline trademark decision actually gets made, so it is its own
call.
