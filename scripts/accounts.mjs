import { createHash, randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync, renameSync, unlinkSync, openSync, closeSync, rmdirSync } from 'node:fs';
import { join } from 'node:path';

const validKey = key => /^[a-f0-9]{64}$/.test(key);
const readJson = file => JSON.parse(readFileSync(file, 'utf8'));
function save(file, value) {
  const temp = `${file}.${randomUUID()}.tmp`;
  writeFileSync(temp, JSON.stringify(value, null, 2) + '\n', { mode: 0o600 });
  try { renameSync(temp, file); } finally { if (existsSync(temp)) unlinkSync(temp); }
}
function label(value) {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > 80 || /[\x00-\x1f]/.test(value)) throw new Error('账号名称应为 1–80 个字符。');
  return value.trim();
}
function location(caller, key, kind, metadata) {
  const directory = join(caller.base, kind === 'legacy' ? 'chats' : 'accounts', key);
  return { ...metadata, key, accountId: key, kind, session: `muse-${key.slice(0, 24)}`, base: caller.base, directory, profile: join(directory, 'profile') };
}
export function defaultAccount(caller) {
  return location(caller, caller.key, 'legacy', { name: `默认账号 ${caller.host}:${caller.threadId}`, host: caller.host, threadId: caller.threadId });
}
export function listAccounts(caller) {
  const found = new Map();
  for (const kind of ['legacy', 'named']) {
    const folder = join(caller.base, kind === 'legacy' ? 'chats' : 'accounts');
    if (!existsSync(folder)) continue;
    for (const entry of readdirSync(folder, { withFileTypes: true })) {
      if (!entry.isDirectory() || !validKey(entry.name)) continue;
      const file = join(folder, entry.name, kind === 'legacy' ? 'binding.json' : 'account.json');
      if (!existsSync(file)) continue;
      const value = readJson(file);
      let metadata;
      if (kind === 'legacy') {
        if (typeof value.threadId !== 'string' || !/^[a-zA-Z0-9][a-zA-Z0-9_.:-]{0,255}$/.test(value.threadId)) throw new Error(`账号绑定无效：${file}`);
        const host = ['codex', 'claude'].find(h => createHash('sha256').update(h === 'claude' ? `claude:${value.threadId}` : value.threadId).digest('hex') === entry.name);
        if (!host) throw new Error(`账号绑定与目录不符：${file}`);
        const aliasFile = join(folder, entry.name, 'account-name.json');
        metadata = { name: existsSync(aliasFile) ? label(readJson(aliasFile).name) : `默认账号 ${host}:${value.threadId}`, host, threadId: value.threadId };
      } else {
        if (value.accountId !== entry.name) throw new Error(`账号登记与目录不符：${file}`);
        metadata = { name: label(value.name), host: value.host, threadId: value.threadId, createdAt: value.createdAt };
      }
      found.set(entry.name, location(caller, entry.name, kind, metadata));
    }
  }
  if (!found.has(caller.key)) found.set(caller.key, defaultAccount(caller));
  return [...found.values()];
}
export function resolveAccount(caller, selector) {
  if (typeof selector !== 'string' || !selector.trim()) throw new Error('缺少账号 ID 或名称。');
  const all = listAccounts(caller);
  const exactId = all.find(a => a.accountId === selector);
  if (exactId) return exactId;
  const names = all.filter(a => a.name === selector);
  const matches = names.length ? names : /^[a-f0-9]{8,63}$/.test(selector) ? all.filter(a => a.accountId.startsWith(selector)) : [];
  if (matches.length !== 1) throw new Error(matches.length ? '账号名称或 ID 前缀不唯一，请使用 account-list 中的完整账号 ID。' : '未找到账号，请先运行 account-list；新账号使用 account-new 创建。');
  return matches[0];
}
export function selectedAccount(caller, selector) {
  if (selector !== undefined) return resolveAccount(caller, selector);
  const file = join(caller.directory, 'selected-account.json');
  return existsSync(file) ? resolveAccount(caller, readJson(file).accountId) : resolveAccount(caller, caller.key);
}
export function selectAccount(caller, selector) {
  const account = resolveAccount(caller, selector);
  mkdirSync(caller.directory, { recursive: true, mode: 0o700 });
  save(join(caller.directory, 'selected-account.json'), { accountId: account.accountId });
  return account;
}
export function createAccount(caller, name) {
  const accountName = label(name);
  const key = createHash('sha256').update(`account:${randomUUID()}`).digest('hex');
  const account = location(caller, key, 'named', { name: accountName, host: caller.host, threadId: caller.threadId, createdAt: new Date().toISOString() });
  mkdirSync(account.directory, { recursive: true, mode: 0o700 });
  save(join(account.directory, 'account.json'), { accountId: key, name: accountName, host: caller.host, threadId: caller.threadId, createdAt: account.createdAt });
  return selectAccount(caller, key);
}
export function renameAccount(caller, selector, name) {
  const account = resolveAccount(caller, selector);
  const accountName = label(name);
  if (account.kind === 'legacy') {
    // Register an unopened default so a later list/selection can retain its alias.
    mkdirSync(account.directory, { recursive: true, mode: 0o700 });
    const binding = join(account.directory, 'binding.json');
    if (!existsSync(binding)) save(binding, { threadId: account.threadId, session: account.session, profile: account.profile });
    save(join(account.directory, 'account-name.json'), { name: accountName });
  } else {
    save(join(account.directory, 'account.json'), { accountId: account.key, name: accountName, host: account.host, threadId: account.threadId, createdAt: account.createdAt });
  }
  return { ...account, name: accountName };
}
export async function withAccountLock(account, caller, operation) {
  mkdirSync(account.directory, { recursive: true, mode: 0o700 });
  const file = join(account.directory, 'command.lock');
  const gate = join(account.directory, 'command-gate');
  const token = randomUUID();
  let fd;
  // Serialize acquisition AND recovery so two callers cannot reclaim the same
  // stale lock and accidentally unlink a newly acquired live lock.
  try { mkdirSync(gate, { mode: 0o700 }); }
  catch (error) {
    if (error.code !== 'EEXIST') throw error;
    throw new Error('此账号正在分配命令锁，请稍后重试；若持续失败，请确认无命令运行后检查 command-gate。');
  }
  try {
    if (existsSync(file)) {
      // A live process owns the command. Only reclaim a provably dead owner.
      let owner;
      try { owner = readJson(file); } catch { throw new Error('此账号正被另一条命令占用，请稍后重试。'); }
      let dead = false;
      if (Number.isInteger(owner.pid) && owner.pid > 0) {
        try { process.kill(owner.pid, 0); } catch (e) { dead = e.code === 'ESRCH'; }
      }
      if (!dead) throw new Error('此账号正被另一条命令占用，请稍后重试。');
      unlinkSync(file);
    }
    fd = openSync(file, 'wx', 0o600);
    writeFileSync(fd, JSON.stringify({ pid: process.pid, token, host: caller.host, threadId: caller.threadId }));
  } catch (error) {
    if (fd !== undefined) { closeSync(fd); unlinkSync(file); }
    throw error;
  } finally {
    rmdirSync(gate);
  }
  try {
    return await operation();
  } finally {
    closeSync(fd);
    if (existsSync(file) && readJson(file).token === token) unlinkSync(file);
  }
}
