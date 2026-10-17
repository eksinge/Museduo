#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync, mkdirSync, copyFileSync, openSync, closeSync, unlinkSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const version = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).version;
const packageLock = JSON.parse(readFileSync(join(root, 'package-lock.json'), 'utf8'));
export function dependencyKey(lock) {
  // Plugin metadata changes must not create a second daemon for the same profile.
  const packages = Object.fromEntries(Object.entries(lock.packages).filter(([name]) => name !== ''));
  return `playwright-${createHash('sha256').update(JSON.stringify(packages)).digest('hex').slice(0, 16)}`;
}
const runtimeKey = dependencyKey(packageLock);
export const DEFAULT_URL = 'https://muse.ai/';
const allowed = new Set(('goto close type click dblclick fill drag drop hover select upload check uncheck snapshot find eval dialog-accept dialog-dismiss resize go-back go-forward reload press keydown keyup mousemove mousedown mouseup mousewheel screenshot pdf tab-list tab-new tab-close tab-select console run-code generate-locator highlight webmcp-list webmcp-call').split(' '));

export function dataRoot(env = process.env) {
  return env.MUSE_CHAT_DATA_DIR ? resolve(env.MUSE_CHAT_DATA_DIR) : join(env.LOCALAPPDATA || env.XDG_DATA_HOME || join(env.HOME || '', '.local', 'share'), 'CodexMuse');
}

export function identity(env = process.env) {
  const threadId = env.CODEX_THREAD_ID || env.CODEX_SESSION_ID;
  if (!threadId || !/^[a-zA-Z0-9][a-zA-Z0-9_.:-]{0,255}$/.test(threadId)) {
    throw new Error('未取得有效的 CODEX_THREAD_ID。请从 Codex 对话运行；禁止回退到共享默认账号。');
  }
  const key = createHash('sha256').update(threadId).digest('hex');
  const base = dataRoot(env);
  return { threadId, key, session: `muse-${key.slice(0, 24)}`, base, directory: join(base, 'chats', key), profile: join(base, 'chats', key, 'profile') };
}

export function cleanEnv(env) {
  // Upstream CLI/MCP settings must never attach this chat to another profile/CDP session.
  return Object.fromEntries(Object.entries(env).filter(([name]) => !/^PLAYWRIGHT_|^PW_TEST_/i.test(name)));
}

export function browserArgs(command, args, id, config) {
  for (const arg of args) {
    if (/^(?:-s(?:=|$)|--(?:session|profile|config|browser|extension|cdp|persistent|isolated|user-data-dir)(?:=|$))/i.test(arg)) {
      throw new Error('会话与浏览器资料目录由插件固定，不允许覆盖。');
    }
  }
  if (command === 'open') {
    const headless = args.includes('--headless');
    const rest = args.filter(a => a !== '--headless' && a !== '--headed');
    if (!rest.length || rest[0].startsWith('--')) rest.unshift(DEFAULT_URL);
    return [`-s=${id.session}`, 'open', ...rest, `--config=${config}`, `--profile=${id.profile}`, '--persistent', ...(headless ? [] : ['--headed'])];
  }
  if (!allowed.has(command)) throw new Error(`不支持命令 ${command}。跨会话操作、资料删除和外部浏览器连接未开放。运行 help 查看用法。`);
  return [`-s=${id.session}`, command, ...args];
}

function run(command, args, options = {}) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(command, args, { stdio: 'inherit', windowsHide: true, shell: false, ...options });
    child.on('error', reject);
    child.on('exit', (code, signal) => code === 0 ? resolvePromise() : reject(new Error(`子进程失败 (${code ?? signal})`)));
  });
}

export function runtimePath(base) { return join(base, 'runtime', runtimeKey); }
function cliPath(base) { return join(runtimePath(base), 'node_modules', '@playwright', 'cli', 'playwright-cli.js'); }

export async function setup(base) {
  if (existsSync(cliPath(base))) return cliPath(base);
  const runtime = runtimePath(base);
  mkdirSync(runtime, { recursive: true, mode: 0o700 });
  const lock = join(runtime, '.install.lock');
  let descriptor;
  try { descriptor = openSync(lock, 'wx', 0o600); }
  catch (error) {
    if (error.code !== 'EEXIST') throw error;
    throw new Error(`另一个安装正在进行。完成后重试；若安装中断，确认无安装进程后移除 ${lock}`);
  }
  try {
    copyFileSync(join(root, 'package.json'), join(runtime, 'package.json'));
    copyFileSync(join(root, 'package-lock.json'), join(runtime, 'package-lock.json'));
    console.error('正在安装已锁定版本的 Microsoft Playwright CLI（不运行安装脚本）…');
    const nodeRequire = createRequire(import.meta.url);
    const npmCandidates = [join(dirname(process.execPath), 'node_modules', 'npm', 'bin', 'npm-cli.js')];
    try { npmCandidates.push(nodeRequire.resolve('npm/bin/npm-cli.js')); } catch {}
    const npm = npmCandidates.find(existsSync);
    if (!npm) throw new Error('未找到 npm-cli.js，请安装包含 npm 的 Node.js 20+。');
    await run(process.execPath, [npm, 'ci', '--ignore-scripts', '--omit=dev', '--no-audit', '--no-fund'], { cwd: runtime, env: cleanEnv(process.env) });
    if (!existsSync(cliPath(base))) throw new Error('运行时安装未完成。');
  } finally { closeSync(descriptor); unlinkSync(lock); }
  return cliPath(base);
}

export async function main(args = process.argv.slice(2)) {
  const [command = 'help', ...rest] = args;
  if (command === 'help' || command === '--help') {
    console.log(`Museduo ${version}\n每个 Codex 对话自动绑定独立持久化 Chrome 资料。\n\nnode <插件路径>/scripts/muse.mjs info       查看当前对话绑定\nnode <插件路径>/scripts/muse.mjs setup      安装锁定版本运行时\nnode <插件路径>/scripts/muse.mjs doctor     检查运行时和浏览器\nnode <插件路径>/scripts/muse.mjs open       打开 Muse，首次请手动登录\nnode <插件路径>/scripts/muse.mjs snapshot   读取当前页面\nnode <插件路径>/scripts/muse.mjs click e12  点击快照中的元素\nnode <插件路径>/scripts/muse.mjs fill e9 文本\nnode <插件路径>/scripts/muse.mjs close      关闭当前对话浏览器，保留登录\n\nopen 可传 URL；open --headless 用于自动化测试。\n禁止指定其他 session/profile，禁止 close-all、kill-all、attach、delete-data。\n登录密码和验证码由用户在独立浏览器窗口输入。`);
    return;
  }
  if (command === 'setup') { await setup(dataRoot()); console.log('运行时已就绪。'); return; }
  const id = identity();
  if (command === 'info') {
    console.log(JSON.stringify({ ...id, defaultUrl: DEFAULT_URL, runtimeInstalled: existsSync(cliPath(id.base)), mode: 'persistent-chrome-per-codex-thread' }, null, 2));
    return;
  }
  const config = join(id.directory, 'browser.json');
  const forwarded = command === 'doctor' ? null : browserArgs(command, rest, id, config);
  const cli = await setup(id.base);
  if (command === 'doctor') {
    const chromePaths = process.platform === 'win32' ? [join(process.env.PROGRAMFILES || 'C:/Program Files', 'Google/Chrome/Application/chrome.exe'), join(process.env['PROGRAMFILES(X86)'] || 'C:/Program Files (x86)', 'Google/Chrome/Application/chrome.exe'), join(process.env.LOCALAPPDATA || '', 'Google/Chrome/Application/chrome.exe')] : [];
    const chrome = chromePaths.find(existsSync);
    console.log(JSON.stringify({ node: process.version, cli, threadId: id.threadId, session: id.session, profile: id.profile, chrome: chrome || '请确认系统已安装 Chrome；macOS/Linux 由 Playwright 按 channel=chrome 查找。', isolation: '独立资料目录；不复制日常浏览器账号' }, null, 2));
    await run(process.execPath, [cli, '--version'], { env: cleanEnv(process.env) });
    return;
  }
  mkdirSync(id.directory, { recursive: true, mode: 0o700 });
  mkdirSync(id.profile, { recursive: true, mode: 0o700 });
  if (command === 'open') {
    writeFileSync(config, JSON.stringify({ browser: { browserName: 'chromium', isolated: false, userDataDir: id.profile, launchOptions: { channel: 'chrome', headless: rest.includes('--headless') }, contextOptions: { viewport: null } }, outputDir: join(id.directory, 'artifacts'), outputMode: 'stdout' }, null, 2), { mode: 0o600 });
    writeFileSync(join(id.directory, 'binding.json'), JSON.stringify({ threadId: id.threadId, session: id.session, profile: id.profile }, null, 2), { mode: 0o600 });
  }
  console.error(`[Muse] 当前对话 ${id.threadId} → ${id.session}`);
  await run(process.execPath, [cli, ...forwarded], { cwd: id.directory, env: cleanEnv(process.env) });
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch(error => { console.error(`[Muse] ${error.message}`); process.exitCode = 1; });
}
