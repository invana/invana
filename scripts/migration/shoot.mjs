// Screenshots for the migration's design review — prototype boards and the live Studio, at 1920×1080.
//
//   node scripts/migration/shoot.mjs --proto --boards a,b --out <dir>   prototype boards (.design/canvas-products/project)
//   node scripts/migration/shoot.mjs --live  --boards a,b --out <dir>   the same boards' routes in the running Studio
//   node scripts/migration/shoot.mjs --live  --smoke      --out <dir>   a fixed route set, for move sessions (before/after)
//   node scripts/migration/shoot.mjs --diff <baseline>    --out <dir>   pixel-diff every shot in <dir> against <baseline>
//
// --diff writes <dir>/diff.json: board → share of pixels changed (0–1), or "new" with no baseline shot.
// Only boards past a small threshold need a reviewer's eyes; the rest are unchanged.
//
// Routes come from screen-map.json. Live shots sign in with INVANA_MIGRATION_USER / _PASSWORD
// (default admin / change_me_please) against INVANA_MIGRATION_STUDIO_URL (default http://localhost:8300);
// a board whose map entry has `as` is shot signed in as that account instead, and one with `click`
// has those buttons pressed in order after it loads — for a state no URL may hold, like a secret shown once.
// A `click` entry may also be `text:<visible text>` (click that text), `label:<label>`, `scroll:<text>`, `tick:<row text>` (that row's checkbox), `upload:<repo path>` (the page's file input) or `dark` (dark theme, through the user menu; the previous mode is restored after the shot).
import { createRequire } from 'node:module';
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../..');
// The app's devDependency is `@playwright/test`, which re-exports `chromium`.
const req = createRequire(path.join(root, 'studio/apps/studio/package.json'));
const { chromium } = req('@playwright/test');

const args = process.argv.slice(2);
const flag = (n) => args.includes(n);
const val = (n) => (args.includes(n) ? args[args.indexOf(n) + 1] : null);
const out = path.resolve(root, val('--out') ?? '.migration-cache/shots');
mkdirSync(out, { recursive: true });
const map = JSON.parse(readFileSync(path.join(here, 'screen-map.json'), 'utf8'));
const base = process.env.INVANA_MIGRATION_STUDIO_URL ?? 'http://localhost:8300';
const SMOKE = ['/graphs', '/u/admin/airways', '/u/admin/airways?panel=model', '/u/admin/airways?panel=agents',
  '/u/admin/airways?panel=runs', '/u/admin/airways?panel=library', '/settings/profile'];

// The accounts e2e/roles-agents.spec.ts makes (passwords from e2e/members.ts).
const PASSWORDS = { 'e2e-viewer': 'e2e-member-password-1' };

const boards = (val('--boards') ?? '').split(',').filter(Boolean);
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });

if (val('--diff')) {
  const baseline = path.resolve(root, val('--diff'));
  const result = {};
  for (const file of readdirSync(out).filter((f) => f.endsWith('.png')).sort()) {
    const name = file.slice(0, -4);
    const before = path.join(baseline, file);
    if (!existsSync(before)) { result[name] = 'new'; continue; }
    const [a, b] = [readFileSync(path.join(out, file)), readFileSync(before)].map((x) => x.toString('base64'));
    // A channel off by more than 24 counts the pixel as changed, so anti-aliasing is not a change.
    result[name] = await page.evaluate(async ([a, b]) => {
      const load = async (s) => createImageBitmap(await (await fetch(`data:image/png;base64,${s}`)).blob());
      const [x, y] = await Promise.all([load(a), load(b)]);
      if (x.width !== y.width || x.height !== y.height) return 1;
      const px = (img) => {
        const c = new OffscreenCanvas(img.width, img.height);
        const g = c.getContext('2d');
        g.drawImage(img, 0, 0);
        return g.getImageData(0, 0, img.width, img.height).data;
      };
      const [p, q] = [px(x), px(y)];
      let changed = 0;
      for (let i = 0; i < p.length; i += 4) {
        if (Math.abs(p[i] - q[i]) > 24 || Math.abs(p[i + 1] - q[i + 1]) > 24 || Math.abs(p[i + 2] - q[i + 2]) > 24) changed++;
      }
      return changed / (p.length / 4);
    }, [a, b]);
  }
  writeFileSync(path.join(out, 'diff.json'), `${JSON.stringify(result, null, 2)}\n`);
  console.log(JSON.stringify(result));
} else if (flag('--proto')) {
  for (const b of boards) {
    const file = path.join(root, '.design/canvas-products/project', `${b}.dc.html`);
    if (!existsSync(file)) { console.log(`missing prototype board ${b}`); continue; }
    const html = readFileSync(file, 'utf8').replace('<script src="./support.js"></script>', '')
      .replace('<x-dc>', '').replace('</x-dc>', '');
    await page.setContent(html, { waitUntil: 'load' });
    await page.screenshot({ path: path.join(out, `${b}.png`), clip: { x: 0, y: 0, width: 1920, height: 1080 } });
    console.log(path.join(out, `${b}.png`));
  }
} else if (flag('--live')) {
  const fallback = process.env.INVANA_MIGRATION_USER ?? 'admin';
  const signIn = async (p, user) => {
    await p.goto(`${base}/login`);
    if (!p.url().includes('/login')) return;
    await p.getByLabel(/username/i).fill(user);
    await p.getByLabel(/password/i).fill(PASSWORDS[user] ?? process.env.INVANA_MIGRATION_PASSWORD ?? 'change_me_please');
    await p.getByRole('button', { name: /sign in/i }).click();
    // A click before the form hydrates is lost; wait until sign-in has left /login.
    await p.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 60000 });
  };
  // A board's `as` names the account it is drawn for; each account signs in once, in its own context.
  const pages = {};
  const pageFor = async (user) => {
    if (!pages[user]) {
      pages[user] = user === fallback ? page : await browser.newPage({ viewport: { width: 1920, height: 1080 } });
      await signIn(pages[user], user);
    }
    return pages[user];
  };
  // User menu › Theme › <label>; returns the mode that was checked before, so a dark shot can put it back.
  const setMode = async (p, label) => {
    await p.getByRole('button', { name: 'User menu' }).click({ timeout: 15000 });
    await p.getByRole('menuitem', { name: 'Theme' }).hover({ timeout: 15000 });
    await p.getByRole('menuitemradio').first().waitFor({ timeout: 15000 });
    const checked = await p.getByRole('menuitemradio', { checked: true }).first().textContent().catch(() => null);
    await p.getByRole('menuitemradio', { name: label, exact: true }).focus();
    await p.keyboard.press('Enter');
    await p.keyboard.press('Escape');
    await p.waitForTimeout(1200);
    return checked?.trim() ?? null;
  };
  const targets = flag('--smoke')
    ? SMOKE.map((r, i) => [`smoke-${i}`, r, fallback])
    : boards.map((b) => [b, map.boards[b]?.route, map.boards[b]?.as ?? fallback, map.boards[b]?.click ?? []])
        .filter(([, r]) => r);
  for (const [name, route, user, clicks = []] of targets) {
    const page = await pageFor(user);
    let priorMode = null;
    await page.goto(base + route, { waitUntil: 'networkidle' }).catch(() => {});
    await page.waitForTimeout(800);
    for (const button of clicks) {
      if (button === 'dark') {
        // The profile's saved theme wins over localStorage on load, so drive the user menu; the choice is saved to the profile.
        priorMode = await setMode(page, 'Dark');
      } else if (button.startsWith('text:')) {
        // With a dialog open the text is looked for inside it.
        const inDialog = (await page.locator('[role=dialog]').count()) > 0;
        const scope = inDialog ? page.locator('[role=dialog]') : page;
        await scope.getByText(button.slice(5), { exact: inDialog }).first().click({ timeout: 15000 }).catch(() => {});
      } else if (button.startsWith('scroll:')) {
        await page.getByText(button.slice(7)).first().scrollIntoViewIfNeeded({ timeout: 15000 }).catch(() => {});
      } else if (button.startsWith('tick:')) {
        await page.locator('tr, [role=row]').filter({ hasText: button.slice(5) }).getByRole('checkbox').first()
          .check({ timeout: 15000 }).catch(() => {});
      } else if (button.startsWith('upload:')) {
        await page.locator('input[type=file]').first().setInputFiles(path.resolve(root, button.slice(7))).catch(() => {});
      } else if (button.startsWith('label:')) {
        await page.getByLabel(button.slice(6)).first().click({ timeout: 15000 }).catch(() => {});
      } else await page.getByRole('button', { name: button, exact: true }).click({ timeout: 15000 }).catch(() => {});
      await page.waitForLoadState('networkidle').catch(() => {});
      await page.waitForTimeout(800);
    }
    // A board that opens on a running check is shot once it has settled.
    await page.getByText('Testing…').waitFor({ state: 'detached', timeout: 15000 }).catch(() => {});
    await page.screenshot({ path: path.join(out, `${name}.png`) });
    if (priorMode) await setMode(page, priorMode);
    console.log(`${route} → ${path.join(out, `${name}.png`)}`);
  }
}
await browser.close();
