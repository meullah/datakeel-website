import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { open, mkdir, readFile, readdir, rm, unlink, writeFile } from 'node:fs/promises';
import { createServer } from 'node:net';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import process from 'node:process';
import { preview as astroPreview } from 'astro';
import axeCore from 'axe-core';
import { launch } from 'chrome-launcher';
import lighthouse from 'lighthouse';
import puppeteer from 'puppeteer-core';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DIST_DIR = join(ROOT, 'dist');
const AUDIT_DIR = join(ROOT, '.audit');
const LOCK_FILE = join(AUDIT_DIR, 'audit.lock');
const HOST = '127.0.0.1';
const PORT = 4322;
const ORIGIN = `http://${HOST}:${PORT}`;
const PERFORMANCE_THRESHOLD = 0.9;
const THEMES = ['light', 'dark'];
const VIEWPORTS = [360, 1024];
const SERIOUS_IMPACTS = new Set(['critical', 'serious']);
const TIMEOUTS = { operation: 10_000, navigation: 30_000, cleanup: 5_000 };

export const KEY_PAGES = ['/', '/case-studies/', '/case-studies/health-claims-review-proof-of-concept/', '/readiness-review/', '/contact/', '/self-assessment/', '/about/'];

export function routeFromHtmlFile(file, distDir = DIST_DIR) {
  const local = relative(resolve(distDir), resolve(file));
  if (isAbsolute(local) || local === '..' || local.startsWith(`..${sep}`)) {
    throw new Error(`HTML file is outside dist: ${file}`);
  }
  const normalized = local.split(sep).join('/');
  if (normalized === 'index.html') return '/';
  if (normalized.endsWith('/index.html')) return `/${normalized.slice(0, -'index.html'.length)}`;
  return `/${normalized}`;
}

export function isLocalAuditUrl(value) {
  const url = new URL(value);
  return ['about:', 'blob:', 'data:', 'devtools:'].includes(url.protocol)
    || ((url.protocol === 'http:' || url.protocol === 'https:') && ['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname));
}

export function seriousViolations(violations) {
  return violations.filter((violation) => SERIOUS_IMPACTS.has(violation.impact));
}

export function auditUrl(route, origin = ORIGIN) {
  return new URL(route, `${origin}/`).href;
}

export function artifactName(route) {
  return route === '/' ? 'root' : Buffer.from(route).toString('base64url');
}

export function lighthouseScore(raw) {
  return { raw, display: Math.round(raw * 100), pass: raw >= PERFORMANCE_THRESHOLD };
}

export function dedupeViolations(scans) {
  const merged = new Map();
  for (const { width, violations } of scans) {
    for (const violation of violations) {
      const current = merged.get(violation.id) ?? { ...violation, nodes: [], widths: [] };
      current.widths.push(width);
      const seen = new Set(current.nodes.map((node) => JSON.stringify(node.target ?? node.html ?? node)));
      for (const node of violation.nodes ?? []) {
        const key = JSON.stringify(node.target ?? node.html ?? node);
        if (!seen.has(key)) {
          current.nodes.push(node);
          seen.add(key);
        }
      }
      merged.set(violation.id, current);
    }
  }
  return [...merged.values()].map((violation) => ({
    ...violation,
    widths: [...new Set(violation.widths)].sort((a, b) => a - b),
  }));
}

/** @param {{ route: string, theme: string, lighthouseResult?: any, scan?: any, scanError?: string | null }} input */
export function evaluateRow({ route, theme, lighthouseResult = null, scan = null, scanError = null }) {
  const errors = [];
  if (lighthouseResult?.error) errors.push(`Lighthouse: ${lighthouseResult.error}`);
  if (lighthouseResult?.score && !lighthouseResult.score.pass) {
    errors.push(`Lighthouse Performance ${lighthouseResult.score.display} < 90`);
  }
  if (scanError) errors.push(`scan error: ${scanError}`);
  if (scan) {
    errors.push(...scan.violations.map((violation) => `axe ${violation.id} (${violation.impact}, ${violation.nodes.length} nodes)`));
    errors.push(...scan.overflow.map((item) => `overflow at ${item.width}px (${item.scrollWidth}px > ${item.innerWidth}px)`));
  }
  return {
    page: route,
    theme,
    lighthouse: lighthouseResult?.score?.display ?? null,
    lighthouseRaw: lighthouseResult?.score?.raw ?? null,
    axeCount: scan?.violations.length ?? 0,
    overflow: scan?.overflow ?? [],
    errors,
    pass: errors.length === 0,
  };
}

export function auditExitCode(passed) {
  return passed ? 0 : 1;
}

export async function withTimeout(task, timeoutMs, label) {
  let timer;
  try {
    return await Promise.race([
      Promise.resolve().then(task),
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error(`${label} timed out after ${timeoutMs}ms`)), timeoutMs);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

function messageOf(error) {
  return error instanceof Error ? error.message : String(error);
}

async function runCommand(label, args) {
  console.log(`\n[${label}] npm ${args.join(' ')}`);
  const npmCli = process.env.npm_execpath;
  const command = npmCli ? process.execPath : 'npm';
  const commandArgs = npmCli ? [npmCli, ...args] : args;
  const child = spawn(command, commandArgs, {
    cwd: ROOT,
    env: { ...process.env, ASTRO_TELEMETRY_DISABLED: '1' },
    shell: !npmCli && process.platform === 'win32',
    stdio: 'inherit',
  });
  const code = await new Promise((resolveCode, reject) => {
    child.once('error', reject);
    child.once('exit', resolveCode);
  });
  if (code !== 0) throw new Error(`${label} failed with exit code ${code ?? 'unknown'}`);
}

function processIsRunning(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error?.code === 'EPERM';
  }
}

export async function acquireAuditLock(lockFile = LOCK_FILE) {
  await mkdir(dirname(lockFile), { recursive: true });
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const handle = await open(lockFile, 'wx');
      const owner = { pid: process.pid, id: randomUUID(), startedAt: new Date().toISOString() };
      await handle.writeFile(JSON.stringify(owner));
      let released = false;
      return {
        owner,
        async release() {
          if (released) return;
          released = true;
          await handle.close();
          try {
            const current = JSON.parse(await readFile(lockFile, 'utf8'));
            if (current.id === owner.id) await unlink(lockFile);
          } catch (error) {
            if (error?.code !== 'ENOENT') throw error;
          }
        },
      };
    } catch (error) {
      if (error?.code !== 'EEXIST') throw error;
      let owner;
      try {
        owner = JSON.parse(await readFile(lockFile, 'utf8'));
      } catch {
        owner = null;
      }
      if (owner && processIsRunning(owner.pid)) {
        throw new Error(`Another audit owns ${lockFile} (pid ${owner.pid}).`);
      }
      await rm(lockFile, { force: true });
    }
  }
  throw new Error(`Could not acquire audit lock ${lockFile}.`);
}

export async function assertPortAvailable(host = HOST, port = PORT, createServerFn = createServer) {
  await new Promise((resolveReady, reject) => {
    const server = createServerFn();
    const done = (error) => {
      server.removeAllListeners();
      if (error) reject(error);
      else resolveReady();
    };
    server.once('error', (error) => {
      const detail = error?.code === 'EADDRINUSE' ? `Fixed audit port ${port} is already in use.` : messageOf(error);
      done(new Error(detail));
    });
    server.once('listening', () => server.close((error) => done(error)));
    server.listen({ host, port, exclusive: true });
  });
}

async function resetArtifacts() {
  await mkdir(AUDIT_DIR, { recursive: true });
  await Promise.all([
    rm(join(AUDIT_DIR, 'axe'), { recursive: true, force: true }),
    rm(join(AUDIT_DIR, 'lighthouse'), { recursive: true, force: true }),
    rm(join(AUDIT_DIR, 'summary.json'), { force: true }),
  ]);
}

export async function startPreview(previewFn = astroPreview) {
  let server;
  try {
    server = await withTimeout(() => previewFn({
      root: ROOT,
      server: { host: HOST, port: PORT },
      vite: { preview: { strictPort: true } },
    }), TIMEOUTS.navigation, 'Astro preview startup');
    const address = server.server?.address?.();
    const boundPort = address && typeof address === 'object' ? address.port : server.port;
    const boundHost = address && typeof address === 'object' ? address.address : server.host;
    if (server.port !== PORT || boundPort !== PORT || ![HOST, `::ffff:${HOST}`].includes(boundHost)) {
      throw new Error(`Astro preview did not own ${HOST}:${PORT} (reported ${server.host}:${server.port}, bound ${boundHost}:${boundPort}).`);
    }
    console.log(`[preview] ${ORIGIN}`);
    return server;
  } catch (error) {
    if (server) await withTimeout(() => server.stop(), TIMEOUTS.cleanup, 'rejected preview cleanup').catch(() => {});
    throw error;
  }
}

async function builtRoutes() {
  const files = (await readdir(DIST_DIR, { recursive: true })).filter((file) => file.endsWith('.html')).map((file) => join(DIST_DIR, file));
  if (!files.length) throw new Error('No HTML pages were found in dist/.');
  return files.map((file) => routeFromHtmlFile(file)).sort((a, b) => a.localeCompare(b));
}

export function chromeFlags() {
  return [
    '--headless=new', '--disable-background-networking', '--disable-component-update', '--disable-default-apps',
    '--disable-sync', '--metrics-recording-only', '--no-first-run', '--safebrowsing-disable-auto-update',
    '--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE localhost, EXCLUDE 127.0.0.1',
    '--proxy-server=http://127.0.0.1:9', '--proxy-bypass-list=localhost;127.0.0.1;[::1]',
  ];
}

export async function startChrome(launchChrome = launch) {
  try {
    return await withTimeout(() => launchChrome({ chromeFlags: chromeFlags() }), TIMEOUTS.operation, 'Chrome startup');
  } catch (error) {
    throw new Error(`Chrome/Chromium was not found or could not be started. Install a local Chrome or Chromium browser and retry. (${messageOf(error)})`);
  }
}

async function runLighthouse(chrome, lighthouseFn = lighthouse) {
  const results = new Map();
  await mkdir(join(AUDIT_DIR, 'lighthouse'), { recursive: true });
  for (const route of KEY_PAGES) {
    process.stdout.write(`[lighthouse] ${route} ... `);
    try {
      const result = await withTimeout(() => lighthouseFn(auditUrl(route), {
        port: chrome.port, logLevel: 'error', output: 'json', onlyCategories: ['performance'], formFactor: 'mobile',
      }), TIMEOUTS.navigation, `Lighthouse ${route}`);
      if (!result) throw new Error('Lighthouse returned no result');
      const score = lighthouseScore(result.lhr.categories.performance.score ?? 0);
      results.set(route, { score });
      const report = Array.isArray(result.report) ? result.report[0] : result.report;
      await writeFile(join(AUDIT_DIR, 'lighthouse', `${artifactName(route)}.json`), report ?? JSON.stringify(result.lhr, null, 2));
      console.log(score.pass ? `${score.display} PASS` : `${score.display} FAIL`);
    } catch (error) {
      results.set(route, { error: messageOf(error) });
      console.log('ERROR');
    }
  }
  return results;
}

async function closePage(page, resources, timeoutMs = TIMEOUTS.cleanup) {
  if (!page) return;
  try {
    await withTimeout(() => page.close({ runBeforeUnload: false }), timeoutMs, 'page closure');
  } finally {
    resources?.pages.delete(page);
  }
}

async function preparePage(browser, theme, resources, timeoutMs = TIMEOUTS.operation) {
  let page;
  try {
    page = await withTimeout(() => browser.newPage(), timeoutMs, 'page creation');
    resources?.pages.add(page);
    await withTimeout(() => page.setRequestInterception(true), timeoutMs, 'request interception setup');
    page.on('request', (request) => {
      const action = () => (isLocalAuditUrl(request.url()) ? request.continue() : request.abort('blockedbyclient'));
      Promise.resolve().then(action).catch(() => Promise.resolve().then(() => request.abort('blockedbyclient')).catch(() => {}));
    });
    // Reduced motion: the reveal island then hides nothing, so axe checks every section's contrast.
    await withTimeout(() => page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]), timeoutMs, 'reduced motion');
    await withTimeout(() => page.evaluateOnNewDocument((selectedTheme) => {
      localStorage.setItem('dk-theme', selectedTheme);
    }, theme), timeoutMs, 'theme preparation');
    return page;
  } catch (error) {
    await closePage(page, resources, timeoutMs).catch(() => {});
    throw error;
  }
}

async function settleLayout(page, timeoutMs = TIMEOUTS.operation) {
  await withTimeout(() => page.evaluate(async () => {
    await document.fonts.ready;
    await new Promise((resolveFrame) => requestAnimationFrame(() => requestAnimationFrame(resolveFrame)));
  }), timeoutMs, 'layout settling');
}

export async function scanPage(browser, route, theme, options = {}) {
  const resources = options.resources ?? { pages: new Set() };
  const widths = options.widths ?? VIEWPORTS;
  const operationTimeout = options.operationTimeout ?? TIMEOUTS.operation;
  const navigationTimeout = options.navigationTimeout ?? TIMEOUTS.navigation;
  let page;
  let failure;
  const scans = [];
  const overflow = [];
  try {
    page = await preparePage(browser, theme, resources, operationTimeout);
    for (const [index, width] of widths.entries()) {
      await withTimeout(() => page.setViewport({ width, height: 800, deviceScaleFactor: 1, isMobile: width === 360, hasTouch: width === 360 }), operationTimeout, `viewport ${width}`);
      if (index === 0) {
        await withTimeout(() => page.goto(auditUrl(route), { waitUntil: 'networkidle0', timeout: navigationTimeout }), navigationTimeout, `navigation ${route}`);
      }
      await settleLayout(page, operationTimeout);
      await withTimeout(() => page.addScriptTag({ content: options.axeSource ?? axeCore.source }), operationTimeout, `axe injection at ${width}px`);
      const axeReady = await withTimeout(() => page.evaluate(() => typeof window.axe?.run === 'function'), operationTimeout, `axe injection verification at ${width}px`);
      if (!axeReady) throw new Error(`axe injection failed at ${width}px: window.axe.run is unavailable`);
      const actualTheme = await withTimeout(() => page.evaluate(() => document.documentElement.dataset.theme), operationTimeout, 'theme verification');
      if (actualTheme !== theme) throw new Error(`expected ${theme} theme, found ${actualTheme ?? 'none'}`);
      const axeResults = await withTimeout(() => page.evaluate(async () => window.axe.run(document)), operationTimeout, `axe scan at ${width}px`);
      scans.push({ width, violations: seriousViolations(axeResults.violations) });
      const dimensions = await withTimeout(() => page.evaluate(() => ({ innerWidth, scrollWidth: document.documentElement.scrollWidth })), operationTimeout, `overflow check at ${width}px`);
      if (dimensions.scrollWidth > dimensions.innerWidth) overflow.push({ width, ...dimensions });
    }
  } catch (error) {
    failure = error;
  } finally {
    try {
      await closePage(page, resources, operationTimeout);
    } catch (error) {
      failure ??= error;
    }
  }
  if (failure) throw failure;
  return { violations: dedupeViolations(scans), overflow, scans };
}

export async function runPageScans(chrome, routes, lighthouseResults, resources, options = {}) {
  const connectBrowser = options.connectBrowser ?? ((connection) => puppeteer.connect(connection));
  const scanPageFn = options.scanPage ?? scanPage;
  const makeDirectory = options.mkdir ?? mkdir;
  const writeArtifact = options.writeFile ?? writeFile;
  const log = options.log ?? ((value) => process.stdout.write(value));
  const logLine = options.logLine ?? ((value) => console.log(value));
  const browser = await withTimeout(() => connectBrowser({ browserURL: `http://${HOST}:${chrome.port}` }), TIMEOUTS.operation, 'Puppeteer connection');
  resources.browser = browser;
  const rows = [];
  await makeDirectory(join(AUDIT_DIR, 'axe'), { recursive: true });
  for (const route of routes) {
    for (const theme of THEMES) {
      log(`[axe] ${route} ${theme} ... `);
      let scan;
      let scanError;
      try {
        scan = await scanPageFn(browser, route, theme, { resources, widths: VIEWPORTS });
        await writeArtifact(join(AUDIT_DIR, 'axe', `${artifactName(route)}-${theme}.json`), JSON.stringify({ page: route, theme, ...scan }, null, 2));
      } catch (error) {
        scanError = messageOf(error);
      }
      const row = evaluateRow({ route, theme, lighthouseResult: lighthouseResults.get(route), scan, scanError });
      rows.push(row);
      logLine(row.pass ? 'PASS' : 'FAIL');
    }
  }
  return rows;
}

export function summaryLines(rows) {
  const header = 'Page | Theme | Lighthouse perf | Axe serious/critical | Result';
  const separator = '--- | --- | ---: | ---: | ---';
  const lines = rows.map((row) => [row.page, row.theme, row.lighthouse === null ? '-' : row.lighthouse, row.axeCount, row.pass ? 'PASS' : 'FAIL'].join(' | '));
  return [header, separator, ...lines];
}

function createResources() {
  return { lock: null, preview: null, chrome: null, browser: null, pages: new Set(), cleanupPromise: null };
}

export async function cleanupResources(resources) {
  if (resources.cleanupPromise) return resources.cleanupPromise;
  resources.cleanupPromise = (async () => {
    const errors = [];
    for (const page of [...resources.pages]) await closePage(page, resources).catch((error) => errors.push(error));
    if (resources.browser) {
      await withTimeout(() => resources.browser.disconnect(), TIMEOUTS.cleanup, 'browser disconnect').catch((error) => errors.push(error));
      resources.browser = null;
    }
    if (resources.chrome) {
      try { resources.chrome.kill(); } catch (error) { errors.push(error); }
      resources.chrome = null;
    }
    if (resources.preview) {
      await withTimeout(() => resources.preview.stop(), TIMEOUTS.cleanup, 'preview shutdown').catch((error) => errors.push(error));
    }
    resources.preview = null;
    if (resources.lock) {
      await resources.lock.release().catch((error) => errors.push(error));
      resources.lock = null;
    }
    if (errors.length) throw new AggregateError(errors, 'Audit cleanup failed');
  })();
  return resources.cleanupPromise;
}

const defaultDependencies = {
  acquireLock: acquireAuditLock,
  resetArtifacts,
  assertPortAvailable,
  runCommand,
  builtRoutes,
  startPreview,
  startChrome,
  runLighthouse,
  runPageScans,
  writeSummary: (passed, rows) => writeFile(join(AUDIT_DIR, 'summary.json'), JSON.stringify({ passed, rows }, null, 2)),
  cleanup: cleanupResources,
  print: (value) => console.log(value),
  printError: (value) => console.error(value),
};

export async function runAudit(overrides = {}) {
  const deps = { ...defaultDependencies, ...overrides };
  const resources = createResources();
  deps.onCleanupReady?.(() => deps.cleanup(resources));
  let rows;
  let passed;
  let failure;
  try {
    resources.lock = await deps.acquireLock();
    await deps.resetArtifacts();
    await deps.assertPortAvailable();
    await deps.runCommand('check', ['run', 'check']);
    await deps.runCommand('build', ['run', 'build']);
    await deps.runCommand('test', ['run', 'test', '--ignore-scripts']);
    const routes = await deps.builtRoutes();
    const missingKeyPages = KEY_PAGES.filter((route) => !routes.includes(route));
    if (missingKeyPages.length) throw new Error(`Lighthouse key pages were not built: ${missingKeyPages.join(', ')}`);
    await deps.assertPortAvailable();
    resources.preview = await deps.startPreview();
    resources.chrome = await deps.startChrome();
    const lighthouseResults = await deps.runLighthouse(resources.chrome);
    rows = await deps.runPageScans(resources.chrome, routes, lighthouseResults, resources);
    passed = rows.every((row) => row.pass);
    await deps.writeSummary(passed, rows);
  } catch (error) {
    failure = error;
  }
  try {
    await deps.cleanup(resources);
  } catch (error) {
    failure ??= error;
  }
  if (failure) throw failure;
  deps.print(`\n${summaryLines(rows).join('\n')}`);
  for (const row of rows.filter((item) => !item.pass)) deps.printError(`FAIL ${row.page} [${row.theme}]: ${row.errors.join('; ')}`);
  deps.print(`\nOverall: ${passed ? 'PASS' : 'FAIL'}`);
  return passed;
}

export async function runMain(run = runAudit) {
  let activeCleanup = async () => {};
  let handlingSignal = false;
  const handlers = new Map();
  for (const signal of ['SIGINT', 'SIGTERM']) {
    const handler = async () => {
      if (handlingSignal) return;
      handlingSignal = true;
      await activeCleanup().catch(() => {});
      process.exit(128 + (signal === 'SIGINT' ? 2 : 15));
    };
    handlers.set(signal, handler);
    process.once(signal, handler);
  }
  try {
    const passed = await run({ onCleanupReady: (cleanup) => { activeCleanup = cleanup; } });
    process.exitCode = auditExitCode(passed);
  } catch (error) {
    console.error(`\nAudit stopped: ${messageOf(error)}`);
    console.log('\nOverall: FAIL');
    process.exitCode = 1;
  } finally {
    for (const [signal, handler] of handlers) process.removeListener(signal, handler);
  }
  return process.exitCode;
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href;
if (isMain) await runMain();
