#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync, mkdirSync, copyFileSync, openSync, closeSync, unlinkSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { listAccounts, selectedAccount, selectAccount, createAccount, renameAccount, withAccountLock } from './accounts.mjs';

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

export function identity(env = process.env, claudeSessionId) {
  const host = claudeSessionId === undefined ? 'codex' : 'claude';
  const threadId = host === 'claude' ? claudeSessionId : env.CODEX_THREAD_ID || env.CODEX_SESSION_ID;
  if (!threadId || !/^[a-zA-Z0-9][a-zA-Z0-9_.:-]{0,255}$/.test(threadId)) {
    throw new Error('未取得有效的对话 ID。Codex 使用 CODEX_THREAD_ID；Claude Code 必须通过技能传入真实 CLAUDE_SESSION_ID。禁止回退到共享默认账号。');
  }
  // Keep existing Codex profiles; namespace Claude so equal IDs cannot share accounts.
  const key = createHash('sha256').update(host === 'claude' ? `claude:${threadId}` : threadId).digest('hex');
  const base = dataRoot(env);
  return { host, threadId, key, session: `muse-${key.slice(0, 24)}`, base, directory: join(base, 'chats', key), profile: join(base, 'chats', key, 'profile') };
}

export function parseInvocation(args) {
  const rest = [...args];
  let claudeSessionId;
  let accountSelector;
  while (rest[0] === '--claude-session-id' || rest[0] === '--account') {
    const option = rest.shift();
    const value = rest.shift();
    if (!value || value.startsWith('--')) throw new Error(`缺少 ${option} 的值。`);
    if (option === '--claude-session-id') {
      if (claudeSessionId !== undefined) throw new Error('不能重复指定会话 ID。');
      claudeSessionId = value;
      identity({}, claudeSessionId);
    } else {
      if (accountSelector !== undefined) throw new Error('不能重复指定账号。');
      accountSelector = value;
    }
  }
  const [command = 'help', ...commandArgs] = rest;
  const action = command === '1' ? 'open' : command === '0' ? 'close' : command;
  return { claudeSessionId, command: action, commandArgs, ...(accountSelector === undefined ? {} : { accountSelector }) };
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
  if (!allowed.has(command)) throw new Error(`不支持命令 ${command}。请用 account-list / account-use 选择插件账号；资料删除和外部浏览器连接未开放。`);
  return [`-s=${id.session}`, command, ...args];
}

// Maximized, not full screen: Chrome's tab strip and the Windows taskbar stay visible.
export function browserConfig(id, headless) {
  return { browser: { browserName: 'chromium', isolated: false, userDataDir: id.profile, launchOptions: { channel: 'chrome', headless, args: headless ? [] : ['--start-maximized'] }, contextOptions: { viewport: null } }, outputDir: join(id.directory, 'artifacts'), outputMode: 'stdout' };
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
  const { claudeSessionId, accountSelector, command, commandArgs: rest } = parseInvocation(args);
  if (command === 'help' || command === '--help') {
    console.log(`Museduo ${version}\n一个对话管理多个独立账号，也可选择其他对话已有的账号窗口。\n\naccount-list                    列出本机插件账号、名称及来源对话\naccount-new <名称>               创建并选中新账号（随后运行 1 打开登录窗口）\naccount-use <账号ID或名称>        切换当前对话的账号，不打开或重启窗口\naccount-rename <账号ID> <名称>    给旧账号或新账号命名\n--account <账号ID或名称> snapshot 本次命令明确指定账号，不改变当前选择\ninfo                            查看当前选择和真实调用对话\ndoctor                          检查浏览器和运行时\n1 / open                        打开选中账号；首次请手动登录\n0 / close                       仅关闭选中账号窗口并保留登录\nsnapshot / click / fill / press / tab-list / tab-select / goto / screenshot\n\n默认仍使用原对话资料，旧登录自动识别且不搬动。所有账号可跨对话显式选择。\nopen 可传 URL；open --headless 用于测试。窗口默认最大化（非全屏，标签页和任务栏可见）。\nClaude Code：命令前加 --claude-session-id <真实会话ID>。\n不要覆盖 session/profile/config；不要使用 close-all、kill-all、attach、delete-data。\n密码、验证码由用户手动输入；不要提取登录凭据。`);
    return;
  }
  if (command === 'setup') { await setup(dataRoot()); console.log('运行时已就绪。'); return; }
  const caller = identity(process.env, claudeSessionId);
  if (command.startsWith('account-')) {
    if (accountSelector !== undefined) throw new Error('account-* 命令直接接收账号参数，不使用 --account。');
    let result;
    if (command === 'account-list' && rest.length === 0) {
      const current = selectedAccount(caller).accountId;
      result = { callerHost: caller.host, callerThreadId: caller.threadId, selectedAccountId: current, accounts: listAccounts(caller).map(a => ({ ...a, selected: a.accountId === current, browserState: 'not-checked' })) };
    } else if (command === 'account-new' && rest.length === 1) result = createAccount(caller, rest[0]);
    else if (command === 'account-use' && rest.length === 1) result = selectAccount(caller, rest[0]);
    else if (command === 'account-rename' && rest.length === 2) result = renameAccount(caller, rest[0], rest[1]);
    else throw new Error('用法：account-list | account-new <名称> | account-use <ID或名称> | account-rename <ID> <名称>');
    console.log(JSON.stringify(result, null, 2));
    return;
  }
  const id = selectedAccount(caller, accountSelector);
  if (command === 'info') {
    console.log(JSON.stringify({ ...id, callerHost: caller.host, callerThreadId: caller.threadId, defaultAccountId: caller.key, defaultUrl: DEFAULT_URL, runtimeInstalled: existsSync(cliPath(id.base)), mode: 'persistent-chrome-per-account' }, null, 2));
    return;
  }
  const config = join(id.directory, 'browser.json');
  const forwarded = command === 'doctor' ? null : browserArgs(command, rest, id, config);
  const cli = await setup(id.base);
  if (command === 'doctor') {
    const chromePaths = process.platform === 'win32' ? [join(process.env.PROGRAMFILES || 'C:/Program Files', 'Google/Chrome/Application/chrome.exe'), join(process.env['PROGRAMFILES(X86)'] || 'C:/Program Files (x86)', 'Google/Chrome/Application/chrome.exe'), join(process.env.LOCALAPPDATA || '', 'Google/Chrome/Application/chrome.exe')] : [];
    const chrome = chromePaths.find(existsSync);
    console.log(JSON.stringify({ node: process.version, cli, callerThreadId: caller.threadId, accountId: id.accountId, name: id.name, session: id.session, profile: id.profile, chrome: chrome || '请确认系统已安装 Chrome；macOS/Linux 由 Playwright 按 channel=chrome 查找。', isolation: '每个账号独立资料；可跨对话显式选择；不复制账号凭据' }, null, 2));
    await run(process.execPath, [cli, '--version'], { env: cleanEnv(process.env) });
    return;
  }
  await withAccountLock(id, caller, async () => {
    mkdirSync(id.profile, { recursive: true, mode: 0o700 });
    if (command === 'open') {
      const headless = rest.includes('--headless');
      writeFileSync(config, JSON.stringify(browserConfig(id, headless), null, 2), { mode: 0o600 });
      if (id.kind === 'legacy' && !existsSync(join(id.directory, 'binding.json'))) writeFileSync(join(id.directory, 'binding.json'), JSON.stringify({ threadId: id.threadId, session: id.session, profile: id.profile }, null, 2), { mode: 0o600 });
    }
    console.error(`[Muse] 调用对话 ${caller.threadId} → 账号 ${id.name} (${id.accountId}) → ${id.session}`);
    await run(process.execPath, [cli, ...forwarded], { cwd: id.directory, env: cleanEnv(process.env) });
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch(error => { console.error(`[Muse] ${error.message}`); process.exitCode = 1; });
}
