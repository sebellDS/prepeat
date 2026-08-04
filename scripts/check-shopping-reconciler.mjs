// Checks the plan -> shopping-list reconciler's RULES, by walking every state a
// line can be in rather than the handful of scenarios someone happens to think
// of. Run it with:  node scripts/check-shopping-reconciler.mjs
//
// WHY THIS EXISTS (2026-08-04). The reconciler was got wrong three times in one
// afternoon, and every time Thomas found it on the device while the migration's
// own verifying SELECT said everything was fine:
//   1. a serving bump on a ticked-off line did nothing at all
//   2. the fix showed the new TOTAL (4 l) instead of what was still owed (1 l)
//   3. "Clear done items" silently switched the whole mechanism off
// The first was a decision made silently. The other two were STATES NOBODY
// ENUMERATED – "cleared" is a button in the UI and it never entered the
// reasoning. Written as a grid, both would have been one obviously-wrong row.
// It then immediately found two more: a hand-edited outstanding line being
// overwritten, and a swipe-deleted one coming back.
//
// HONEST LIMITATION, so nobody trusts this further than it deserves: this is a
// MIRROR of the SQL in migrations 0013/0025/0029/0030, not the SQL itself. It
// proves the rules are coherent; it cannot prove the SQL implements them. If the
// two drift, this file lies. So keep it beside the migration when changing one,
// and treat a device walk-through as the thing that actually settles a change.
// A real Postgres harness would close that gap and does not exist yet.

const r2 = (n) => Math.round(n * 100) / 100;
const problems = [];
const flag = (what) => { if (!problems.includes(what)) problems.push(what); };

// --- the rules, mirroring sync_plan_outstanding (0029 + 0030) ----------------
// An outstanding line is either LIVE AND UNTICKED – the amount still being asked
// for – or it is settled: ticked, cleared, or deleted by the shopper.
function sync({ main, extra, needed, covered }) {
  if (!main.checked) return { action: 'no outstanding line (the reconciler owns this line)' };
  const outstanding = needed - covered;
  const settled = extra && (extra.checked || extra.deleted) ? extra.quantity : 0;
  const need = r2(Math.max(0, outstanding - settled));
  const target = extra && !extra.deleted && !extra.checked ? extra : null;
  if (target && target.edited) return { action: 'left alone (hand-edited)' };
  if (need === 0) return { action: target ? 'outstanding line removed' : 'nothing to do' };
  if (target) return { action: `outstanding line set to ${need}`, wrote: target };
  return { action: `outstanding line created at ${need}` };
}

// --- part 1: every combination of states ------------------------------------
const MAIN_STATES = [
  ['ticked, still on the list', { checked: true, deleted: false }],
  ['ticked, then cleared away', { checked: true, deleted: true }],
  ['not ticked', { checked: false, deleted: false }],
];
const EXTRA_STATES = [
  ['none yet', null],
  ['live, not ticked', { quantity: 1, checked: false, deleted: false, edited: false }],
  ['live, hand-edited', { quantity: 5, checked: false, deleted: false, edited: true }],
  ['ticked off', { quantity: 1, checked: true, deleted: false, edited: false }],
  ['ticked, then cleared', { quantity: 1, checked: true, deleted: true, edited: false }],
  ['deleted by the shopper', { quantity: 1, checked: false, deleted: true, edited: false }],
];
const CHANGES = [
  ['plan needs 1 more', { needed: 2, covered: 1 }],
  ['plan back to level', { needed: 1, covered: 1 }],
];

console.log('STATE GRID – every line state against every plan change\n');
for (const [mainLabel, main] of MAIN_STATES) {
  console.log(`main line: ${mainLabel}`);
  for (const [extraLabel, proto] of EXTRA_STATES) {
    for (const [changeLabel, change] of CHANGES) {
      const extra = proto ? { ...proto } : null;
      const r = sync({ main, extra, ...change });
      let note = '';
      if (r.wrote?.edited) { note = '  <-- overwrites a hand-edited amount'; flag('a hand-edited outstanding line is overwritten'); }
      if (proto?.deleted && !proto.checked && r.action.includes('created')) {
        note = '  <-- recreates a line the shopper deleted'; flag('a swipe-deleted outstanding line comes back');
      }
      console.log(`  ${extraLabel.padEnd(24)} ${changeLabel.padEnd(19)} -> ${r.action}${note}`);
    }
  }
  console.log('');
}

// --- part 2: sequences, because some bugs need several steps ----------------
// Each step gives the state after it, so a wrong intermediate value shows up
// rather than being averaged away by a correct final one.
console.log('SEQUENCES – the walks that caught the three real bugs\n');
let items, contribs, nextId;
const reset = () => { items = []; contribs = []; nextId = 1; };
const addLine = (o) => { const it = { id: nextId++, name: 'Milk', unit: 'l', quantity: null, checked: false, edited: false, deleted: false, outstandingFor: null, ...o }; items.push(it); return it; };
const liveRows = () => items.filter((i) => !i.deleted);

function syncLine(L) {
  if (!L) return;
  const needed = contribs.filter((c) => c.item === L.id && !c.gone).reduce((s, c) => s + (c.quantity ?? 0), 0);
  const covered = contribs.filter((c) => c.item === L.id && !c.gone).reduce((s, c) => s + (c.applied ?? 0), 0);
  const extra = items.find((i) => i.outstandingFor === L.id && !i.deleted && !i.checked)
    ?? items.find((i) => i.outstandingFor === L.id);
  const r = sync({ main: L, extra: extra ?? null, needed, covered });
  if (!L.checked) { items = items.filter((i) => !(i.outstandingFor === L.id && !i.deleted && !i.checked)); return; }
  if (r.action.includes('hand-edited')) return;
  const settled = items.filter((i) => i.outstandingFor === L.id && (i.checked || i.deleted)).reduce((s, i) => s + (i.quantity ?? 0), 0);
  const need = r2(Math.max(0, needed - covered - settled));
  const target = items.find((i) => i.outstandingFor === L.id && !i.deleted && !i.checked);
  if (need === 0) { if (target) items = items.filter((i) => i !== target); return; }
  if (target) target.quantity = need;
  else addLine({ quantity: need, outstandingFor: L.id });
}
const contribute = (L, entry, amount) => {
  const applied = !L.checked && !L.edited && amount != null ? amount : null;
  if (applied != null) L.quantity = r2((L.quantity ?? 0) + amount);
  contribs.push({ item: L.id, entry, quantity: amount, applied });
  syncLine(L);
};
const rescale = (entry, from, to) => {
  for (const c of contribs.filter((c) => c.entry === entry && !c.gone && c.quantity != null)) {
    c.quantity = r2(c.quantity * (to / from));
    const L = items.find((i) => i.id === c.item);
    if (!L.deleted && !L.checked && !L.edited && L.quantity != null && c.applied != null) {
      L.quantity = r2(Math.max(0, L.quantity - c.applied + c.quantity)); c.applied = c.quantity;
    }
    syncLine(L);
  }
};
const removeMeal = (entry) => {
  const touched = new Set();
  for (const c of contribs.filter((c) => c.entry === entry && !c.gone)) {
    const L = items.find((i) => i.id === c.item);
    const others = contribs.some((o) => o.item === c.item && o !== c && !o.gone);
    if (!L.deleted && !L.checked && !L.edited) {
      if (!others) L.deleted = true;
      else if (c.applied != null && L.quantity != null) L.quantity = r2(Math.max(0, L.quantity - c.applied)) || null;
    }
    c.gone = true; touched.add(L);
  }
  touched.forEach(syncLine);
};
const clearDone = () => liveRows().filter((i) => i.checked).forEach((i) => (i.deleted = true));
const shown = () => liveRows().map((i) => `${i.quantity ?? '-'} ${i.unit}${i.checked ? ' [ticked]' : ''}`).join(' + ') || '(nothing)';
const step = (label, expected) => {
  const got = shown();
  const ok = got === expected;
  if (!ok) flag(`sequence step wrong: ${label}`);
  console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${label.padEnd(42)} ${got}${ok ? '' : `   expected: ${expected}`}`);
};

// Thomas's 3x "Test 1", 1 litre of milk each.
reset();
let L = addLine({});
contribute(L, 'E1', 1); contribute(L, 'E2', 1); contribute(L, 'E3', 1);
step('three meals added', '3 l');
L.checked = true;
step('milk ticked off', '3 l [ticked]');
rescale('E1', 4, 8);
step('one meal doubled', '3 l [ticked] + 1 l');
rescale('E1', 8, 4);
step('un-doubled again', '3 l [ticked]');
rescale('E1', 4, 8); rescale('E2', 4, 8);
step('two meals doubled', '3 l [ticked] + 2 l');
removeMeal('E1');
step('the doubled meal removed', '3 l [ticked] + 1 l');

// The same, with "Clear done items" in the middle.
reset();
L = addLine({});
contribute(L, 'E1', 1); contribute(L, 'E2', 1); contribute(L, 'E3', 1);
L.checked = true; clearDone();
step('ticked off, then cleared away', '(nothing)');
rescale('E1', 4, 8);
step('one meal doubled after clearing', '1 l');
rescale('E1', 8, 4);
step('un-doubled after clearing', '(nothing)');

// Buying the extra, then changing again: must ask for 1 more, never 2.
reset();
L = addLine({});
contribute(L, 'E1', 1); contribute(L, 'E2', 1); contribute(L, 'E3', 1);
L.checked = true;
rescale('E1', 4, 8);
liveRows().find((i) => i.outstandingFor === L.id).checked = true;
step('the extra litre bought too', '3 l [ticked] + 1 l [ticked]');
rescale('E2', 4, 8);
step('a second meal doubled', '3 l [ticked] + 1 l [ticked] + 1 l');

// A meal added after shopping – the original report.
reset();
L = addLine({});
contribute(L, 'E1', 2);
L.checked = true;
contribute(L, 'E9', 1);
step('new meal added after shopping', '2 l [ticked] + 1 l');

console.log('');
if (problems.length) {
  console.log('PROBLEMS:');
  problems.forEach((p) => console.log('  * ' + p));
  process.exit(1);
}
console.log('All rules coherent. Remember: this checks the RULES, not the SQL – walk it on a device.');
