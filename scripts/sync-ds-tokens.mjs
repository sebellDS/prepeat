// Sync the Sebell Design System's generated Prep+Eat theme fragment into this
// app. The DS emits a NativeWind/Tailwind theme at
// packages/tokens/dist/prep-eat-theme.cjs (generated + gitignored in the DS
// repo), which we copy to src/constants/ds-theme.cjs (committed here).
//
// Re-run after any DS token change:
//   1. In the DS repo:  npm run tokens:build
//   2. Here:            npm run sync-ds-tokens
//
// The DS repo location defaults to ~/Documents/Sebell Design System/
// design-system and can be overridden with the DS_REPO env var.

import { copyFileSync, existsSync, mkdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const appRoot = join(here, '..');

const dsRepo =
  process.env.DS_REPO ??
  join(homedir(), 'Documents', 'Sebell Design System', 'design-system');

const source = join(dsRepo, 'packages', 'tokens', 'dist', 'prep-eat-theme.cjs');
const dest = join(appRoot, 'src', 'constants', 'ds-theme.cjs');

if (!existsSync(source)) {
  console.error(
    `\n✗ DS theme fragment not found at:\n    ${source}\n\n` +
      `Generate it first:\n` +
      `    cd "${dsRepo}" && npm run tokens:build\n\n` +
      `Or point DS_REPO at the design-system repo:\n` +
      `    DS_REPO=/path/to/design-system npm run sync-ds-tokens\n`
  );
  process.exit(1);
}

mkdirSync(dirname(dest), { recursive: true });
copyFileSync(source, dest);

console.log(`✓ Synced DS Prep+Eat theme\n    from ${source}\n    to   ${dest}`);
