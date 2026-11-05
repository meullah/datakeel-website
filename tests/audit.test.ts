import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:net';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  KEY_PAGES,
  artifactName,
  assertPortAvailable,
  auditExitCode,
  auditUrl,
  chromeFlags,
  cleanupResources,
  dedupeViolations,
  evaluateRow,
  isLocalAuditUrl,
  lighthouseScore,
  routeFromHtmlFile,
  runAudit,
  runPageScans,
  scanPage,
  seriousViolations,
  startChrome,
  startPreview,
  summaryLines,
  withTimeout,
} from '../scripts/audit.mjs';

type AnyObject = Record<string, any>;
const dist = fileURLToPath(new URL('../dist/', import.meta.url));

test('route discovery is URL-safe and rejects paths outside dist', () => {
  assert.equal(routeFromHtmlFile(join(dist, 'index.html')), '/');
  assert.equal(routeFromHtmlFile(join(dist, 'about', 'index.html')), '/about/');
  assert.equal(routeFromHtmlFile(join(dist, '404.html')), '/404.html');
  assert.throws(() => routeFromHtmlFile(join(dist, '..', 'outside.html')), /outside dist/);
  if (process.platform === 'win32') {
    assert.throws(() => routeFromHtmlFile('D:\\other\\index.html', 'C:\\dist'), /outside dist/);
  }
});

test('artifact names are collision-free for routes that slugify alike', () => {
  const routes = ['/', '/a-b/', '/a/b/', '/404.html', '/space%20name/'];
  assert.equal(new Set(routes.map(artifactName)).size, routes.length);
});

test('browser network policy permits loopback and proxies every other address', () => {
  assert.equal(auditUrl('/about/', 'http://127.0.0.1:4322'), 'http://127.0.0.1:4322/about/');
  for (const url of ['http://127.0.0.1:4322/', 'http://localhost:4322/', 'data:text/plain,x', 'about:blank']) {
    assert.equal(isLocalAuditUrl(url), true, url);
  }
  for (const url of ['https://datakeelai.com/', 'http://192.0.2.1/', 'https://example.com/script.js']) {
    assert.equal(isLocalAuditUrl(url), false, url);
  }
  assert.ok(chromeFlags().some((flag: string) => flag.startsWith('--proxy-server=http://127.0.0.1:')));
  assert.ok(chromeFlags().some((flag: string) => flag.includes('proxy-bypass-list=localhost;127.0.0.1;[::1]')));
});

test('raw Lighthouse score decides pass even when display rounds to 90', () => {
  assert.deepEqual(lighthouseScore(0.9), { raw: 0.9, display: 90, pass: true });
  assert.deepEqual(lighthouseScore(0.8999), { raw: 0.8999, display: 90, pass: false });
});

test('every required page failure makes the row and process decision fail', () => {
  const passScan = { violations: [], overflow: [] };
  const seriousScan = { violations: [{ id: 'image-alt', impact: 'critical', nodes: [{}] }], overflow: [] };
  const overflowScan = { violations: [], overflow: [{ width: 360, innerWidth: 360, scrollWidth: 361 }] };
  const cases = [
    { lighthouseResult: { score: lighthouseScore(0.8999) }, scan: passScan },
    { lighthouseResult: { error: 'Lighthouse crashed' }, scan: passScan },
    { lighthouseResult: { score: lighthouseScore(1) }, scan: seriousScan },
    { lighthouseResult: { score: lighthouseScore(1) }, scan: overflowScan },
    { lighthouseResult: { score: lighthouseScore(1) }, scanError: 'page timed out' },
  ];
  for (const input of cases) {
    const row = evaluateRow({ route: '/about/', theme: 'light', ...input });
    assert.equal(row.pass, false, JSON.stringify(input));
    assert.equal(auditExitCode(row.pass), 1);
  }
  const row = evaluateRow({ route: '/about/', theme: 'light', lighthouseResult: { score: lighthouseScore(1) }, scan: passScan });
  assert.equal(row.pass, true);
  assert.equal(auditExitCode(row.pass), 0);
});

test('axe filtering and dual-width deduplication retain unique nodes and widths', () => {
  const shared = { id: 'image-alt', impact: 'critical', nodes: [{ target: ['img'] }] };
  const scans = [
    { width: 360, violations: seriousViolations([shared, { id: 'minor', impact: 'minor', nodes: [] }]) },
    { width: 1024, violations: seriousViolations([shared, { id: 'label', impact: 'serious', nodes: [{ target: ['input'] }] }]) },
  ];
  const merged = dedupeViolations(scans);
  assert.equal(merged.length, 2);
  assert.deepEqual(merged.find((item: AnyObject) => item.id === 'image-alt').widths, [360, 1024]);
  assert.equal(merged.find((item: AnyObject) => item.id === 'image-alt').nodes.length, 1);
});

test('summary has one concise line per page and theme', () => {
  const lines = summaryLines([
    { page: '/', theme: 'light', lighthouse: 98, axeCount: 0, pass: true },
    { page: '/', theme: 'dark', lighthouse: 98, axeCount: 1, pass: false },
  ]);
  assert.equal(lines.length, 4);
  assert.match(lines[2], /^\/ \| light \| 98 \| 0 \| PASS$/);
  assert.match(lines[3], /^\/ \| dark \| 98 \| 1 \| FAIL$/);
});

test('timeouts are bounded and Chrome startup gives the required message', async () => {
  await assert.rejects(withTimeout(() => new Promise(() => {}), 5, 'hung operation'), /hung operation timed out after 5ms/);
  await assert.rejects(startChrome(async () => { throw new Error('missing executable'); }), /Chrome\/Chromium was not found.*missing executable/);
});

test('programmatic preview owns exactly 127.0.0.1:4322 and rejects any fallback', async () => {
  let received: AnyObject | undefined;
  let stops = 0;
  const owned = {
    host: '127.0.0.1',
    port: 4322,
    server: { address: () => ({ address: '127.0.0.1', port: 4322 }) },
    closed: async () => {},
    stop: async () => { stops += 1; },
  };
  assert.equal(await startPreview(async (config: AnyObject) => { received = config; return owned; }), owned);
  assert.deepEqual(received?.server, { host: '127.0.0.1', port: 4322 });
  assert.equal(received?.vite.preview.strictPort, true);
  assert.match(received?.root, /datakeel-website$/);
  assert.equal(stops, 0);

  const moved = {
    ...owned,
    port: 4329,
    server: { address: () => ({ address: '127.0.0.1', port: 4329 }) },
  };
  await assert.rejects(startPreview(async () => moved), /did not own 127\.0\.0\.1:4322/);
  assert.equal(stops, 1, 'a rejected server is stopped without touching another preview');
});

test('occupied ports fail before preview can move to another port', async () => {
  const server = createServer();
  await new Promise<void>((resolveReady) => server.listen(0, '127.0.0.1', resolveReady));
  const address = server.address();
  assert.ok(address && typeof address === 'object');
  await assert.rejects(assertPortAvailable('127.0.0.1', address.port), /Fixed audit port .* already in use/);
  await new Promise<void>((resolveClosed) => server.close(() => resolveClosed()));
});

function fakePage({ injectionDefinesAxe = true } = {}) {
  let width = 0;
  let closeCount = 0;
  let axeAvailable = false;
  let injectionCount = 0;
  const viewports: number[] = [];
  const page = {
    setRequestInterception: async () => {},
    on: () => {},
    evaluateOnNewDocument: async () => {},
    emulateMediaFeatures: async () => {},
    setViewport: async (viewport: { width: number }) => {
      width = viewport.width;
      viewports.push(width);
      axeAvailable = false;
    },
    goto: async () => {},
    addScriptTag: async () => {
      injectionCount += 1;
      axeAvailable = injectionDefinesAxe;
    },
    evaluate: async (fn: Function) => {
      const source = fn.toString();
      if (source.includes('document.fonts.ready')) return undefined;
      if (source.includes("typeof window.axe?.run")) return axeAvailable;
      if (source.includes('document.documentElement.dataset.theme')) return 'light';
      if (source.includes('window.axe.run')) {
        if (!axeAvailable) throw new Error("Cannot read properties of undefined (reading 'run')");
        return {
          violations: [
            { id: 'image-alt', impact: 'critical', nodes: [{ target: ['img'] }] },
            ...(width === 1024 ? [{ id: 'label', impact: 'serious', nodes: [{ target: ['input'] }] }] : []),
            { id: 'minor', impact: 'minor', nodes: [] },
          ],
        };
      }
      if (source.includes('scrollWidth')) return { innerWidth: width, scrollWidth: width === 1024 ? 1025 : width };
      throw new Error(`unexpected evaluate: ${source}`);
    },
    close: async () => { closeCount += 1; },
  };
  return { page, viewports, closeCount: () => closeCount, injectionCount: () => injectionCount };
}

test('page scan runs axe and overflow at 360px and 1024px, then closes', async () => {
  const fake = fakePage();
  const resources = { pages: new Set() };
  const result = await scanPage({ newPage: async () => fake.page }, '/about/', 'light', {
    resources,
    axeSource: 'axe',
    operationTimeout: 50,
    navigationTimeout: 50,
  });
  assert.deepEqual(fake.viewports, [360, 1024]);
  assert.equal(fake.injectionCount(), 2);
  assert.equal(result.scans.length, 2);
  assert.deepEqual(result.violations.map((item: AnyObject) => item.id).sort(), ['image-alt', 'label']);
  assert.deepEqual(result.overflow, [{ width: 1024, innerWidth: 1024, scrollWidth: 1025 }]);
  assert.equal(fake.closeCount(), 1);
  assert.equal(resources.pages.size, 0);
});

test('page scan rejects when axe injection does not define the browser API', async () => {
  const fake = fakePage({ injectionDefinesAxe: false });
  await assert.rejects(
    scanPage({ newPage: async () => fake.page }, '/', 'light', {
      axeSource: 'axe',
      operationTimeout: 50,
      navigationTimeout: 50,
    }),
    /axe injection failed at 360px: window\.axe\.run is unavailable/,
  );
  assert.equal(fake.closeCount(), 1);
});

test('partial page setup timeout still closes the page', async () => {
  const fake = fakePage();
  fake.page.setRequestInterception = async () => new Promise(() => {});
  await assert.rejects(
    scanPage({ newPage: async () => fake.page }, '/', 'light', { operationTimeout: 5, navigationTimeout: 5 }),
    /request interception setup timed out/,
  );
  assert.equal(fake.closeCount(), 1);
});

test('page-scan orchestration covers every route and theme with both widths', async () => {
  const calls: AnyObject[] = [];
  const resources = { browser: null, pages: new Set() };
  const rows = await runPageScans(
    { port: 1234 },
    ['/', '/about/'],
    new Map([['/', { score: lighthouseScore(1) }], ['/about/', { score: lighthouseScore(1) }]]),
    resources,
    {
      connectBrowser: async () => ({ disconnect: async () => {} }),
      scanPage: async (_browser: unknown, route: string, theme: string, options: AnyObject) => {
        calls.push({ route, theme, widths: options.widths });
        return { violations: [], overflow: [], scans: [] };
      },
      mkdir: async () => {},
      writeFile: async () => {},
      log: () => {},
      logLine: () => {},
    },
  );
  assert.deepEqual(calls, [
    { route: '/', theme: 'light', widths: [360, 1024] },
    { route: '/', theme: 'dark', widths: [360, 1024] },
    { route: '/about/', theme: 'light', widths: [360, 1024] },
    { route: '/about/', theme: 'dark', widths: [360, 1024] },
  ]);
  assert.equal(rows.length, 4);
});

function orchestration(overrides: AnyObject = {}) {
  const events: string[] = [];
  const commands: unknown[] = [];
  let portChecks = 0;
  const passRow = { page: '/', theme: 'light', lighthouse: 100, axeCount: 0, errors: [], pass: true };
  const dependencies = {
    acquireLock: async () => ({ release: async () => { events.push('release'); } }),
    resetArtifacts: async () => { events.push('reset'); },
    assertPortAvailable: async () => { portChecks += 1; events.push('port'); },
    runCommand: async (...args: unknown[]) => { commands.push(args); events.push(`command:${args[0]}`); },
    builtRoutes: async () => [...KEY_PAGES],
    startPreview: async () => ({ id: 'preview' }),
    startChrome: async () => ({ id: 'chrome' }),
    runLighthouse: async () => new Map(),
    runPageScans: async () => [passRow],
    writeSummary: async () => { events.push('write'); },
    cleanup: async (resources: AnyObject) => {
      events.push(`cleanup:${resources.preview?.id ?? 'none'}:${resources.chrome?.id ?? 'none'}`);
      await resources.lock?.release();
    },
    print: () => { events.push('print'); },
    printError: () => { events.push('printError'); },
    ...overrides,
  };
  return { events, commands, dependencies, portChecks: () => portChecks, passRow };
}

test('audit orchestration preserves order, skips duplicate pretest build, cleans before summary', async () => {
  const run = orchestration();
  assert.equal(await runAudit(run.dependencies), true);
  assert.deepEqual(run.commands, [
    ['check', ['run', 'check']],
    ['build', ['run', 'build']],
    ['test', ['run', 'test', '--ignore-scripts']],
  ]);
  assert.equal(run.portChecks(), 2);
  assert.ok(run.events.indexOf('cleanup:preview:chrome') < run.events.indexOf('print'));
});

test('audit returns false for failed rows and writes that decision', async () => {
  let written: boolean | undefined;
  const run = orchestration({
    runPageScans: async () => [{ page: '/', theme: 'light', lighthouse: 90, axeCount: 1, errors: ['axe'], pass: false }],
    writeSummary: async (passed: boolean) => { written = passed; },
  });
  assert.equal(await runAudit(run.dependencies), false);
  assert.equal(written, false);
  assert.equal(auditExitCode(false), 1);
});

test('fixed-port and Chrome startup failures propagate after cleanup', async () => {
  let commands = 0;
  const occupied = orchestration({
    assertPortAvailable: async () => { throw new Error('Fixed audit port 4322 is already in use.'); },
    runCommand: async () => { commands += 1; },
  });
  await assert.rejects(runAudit(occupied.dependencies), /Fixed audit port 4322/);
  assert.equal(commands, 0);
  assert.ok(occupied.events.some((event) => event.startsWith('cleanup:none:none')));

  const chromeMissing = orchestration({ startChrome: async () => { throw new Error('Chrome/Chromium was not found'); } });
  await assert.rejects(runAudit(chromeMissing.dependencies), /Chrome\/Chromium was not found/);
  assert.ok(chromeMissing.events.includes('cleanup:preview:none'));
});

test('central cleanup closes pages, browser, Chrome, preview and lock in order', async () => {
  const events: string[] = [];
  const page = { close: async () => { events.push('page'); } };
  const resources: AnyObject = {
    pages: new Set([page]),
    browser: { disconnect: async () => { events.push('browser'); } },
    chrome: { kill: () => { events.push('chrome'); } },
    preview: { stop: async () => { events.push('preview'); } },
    lock: { release: async () => { events.push('lock'); } },
    cleanupPromise: null,
  };
  await cleanupResources(resources);
  assert.deepEqual(events, ['page', 'browser', 'chrome', 'preview', 'lock']);
  await cleanupResources(resources);
  assert.deepEqual(events, ['page', 'browser', 'chrome', 'preview', 'lock'], 'cleanup is idempotent');
});
