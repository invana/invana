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
// Routes come from screen-map.json. Live shots sign in once with INVANA_MIGRATION_USER / _PASSWORD
// (default admin / change_me_please) against INVANA_MIGRATION_STUDIO_URL (default http://localhost:8300).
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
  await page.goto(`${base}/login`);
  if (page.url().includes('/login')) {
    await page.getByLabel(/username/i).fill(process.env.INVANA_MIGRATION_USER ?? 'admin');
    await page.getByLabel(/password/i).fill(process.env.INVANA_MIGRATION_PASSWORD ?? 'change_me_please');
    await page.getByRole('button', { name: /sign in/i }).click();
    await page.waitForLoadState('networkidle');
  }
  const targets = flag('--smoke')
    ? SMOKE.map((r, i) => [`smoke-${i}`, r])
    : boards.map((b) => [b, map.boards[b]?.route]).filter(([, r]) => r);
  for (const [name, route] of targets) {
    await page.goto(base + route, { waitUntil: 'networkidle' }).catch(() => {});
    await page.waitForTimeout(800);
    await page.screenshot({ path: path.join(out, `${name}.png`) });
    console.log(`${route} → ${path.join(out, `${name}.png`)}`);
  }
}
await browser.close();
