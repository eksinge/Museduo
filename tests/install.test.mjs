import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { install } from '../scripts/install.mjs';

const source = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const version = JSON.parse(readFileSync(join(source, 'package.json'))).version;
const scratch = resolve(source, '..', '..', 'work');
mkdirSync(scratch, { recursive: true });
function fixture() {
  const folder = mkdtempSync(join(scratch, 'museduo-install-'));
  return { source, home: join(folder, 'user home'), base: join(folder, 'local data') };
}
function writeJson(file, value) {
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, JSON.stringify(value));
}

test('Claude installation is standalone, repeatable and preserves settings and profiles', () => {
  const options = fixture();
  const settingsFile = join(options.home, '.claude', 'settings.json');
  const settings = '{"model":"keep-my-model","hooks":{"UserPromptSubmit":[]}}';
  mkdirSync(dirname(settingsFile), { recursive: true });
  writeFileSync(settingsFile, settings);
  const profile = join(options.base, 'chats', 'existing', 'profile', 'keep.json');
  writeJson(profile, { account: 'synthetic-existing-account' });
  const calls = [];
  const run = (...args) => calls.push(args);
  const installed = install({ ...options, host: 'claude', run });
  assert.equal(installed.name, 'Museduo');
  assert.equal(installed.target, join(options.home, '.claude', 'skills', 'museduo'));
  assert.match(readFileSync(join(installed.target, 'SKILL.md'), 'utf8'), /\$\{CLAUDE_SESSION_ID\}/);
  const pluginSkill = readFileSync(join(installed.target, 'skills', 'museduo', 'SKILL.md'), 'utf8');
  assert.match(pluginSkill, /\$\{CLAUDE_PLUGIN_ROOT\}/);
  assert.equal(pluginSkill, readFileSync(join(installed.target, 'SKILL.md'), 'utf8').replaceAll('${CLAUDE_SKILL_DIR}', '${CLAUDE_PLUGIN_ROOT}'));
  assert.equal(calls.length, 1);
  assert.equal(calls[0][1].at(-1), 'setup');
  const info = JSON.parse(execFileSync(process.execPath, [join(installed.target, 'scripts', 'muse.mjs'), '--claude-session-id', 'synthetic-session', 'info'], {
    env: { ...process.env, CODEX_THREAD_ID: 'synthetic-session', MUSE_CHAT_DATA_DIR: options.base }, encoding: 'utf8'
  }));
  assert.equal(info.host, 'claude');
  assert.equal(info.threadId, 'synthetic-session');
  assert.equal(info.base, options.base);
  assert.equal(readFileSync(settingsFile, 'utf8'), settings);
  assert.equal(JSON.parse(readFileSync(profile)).account, 'synthetic-existing-account');
  assert.ok(!existsSync(join(installed.target, 'chats')));
  assert.ok(!existsSync(join(installed.target, 'node_modules')));
  assert.equal(install({ ...options, host: 'claude', run }).target, installed.target);
  assert.equal(readFileSync(settingsFile, 'utf8'), settings);
});

test('Claude installer leaves an unrelated existing skill intact', () => {
  const options = fixture();
  const skill = join(options.home, '.claude', 'skills', 'museduo', 'SKILL.md');
  mkdirSync(dirname(skill), { recursive: true });
  writeFileSync(skill, 'unrelated user skill');
  assert.throws(() => install({ ...options, host: 'claude', run: () => assert.fail('should not run') }), /保留原文件/);
  assert.equal(readFileSync(skill, 'utf8'), 'unrelated user skill');
});

test('Codex installation merges its catalog entry and preserves other plugins and metadata', () => {
  const options = fixture();
  const catalogFile = join(options.base, 'marketplace', '.agents', 'plugins', 'marketplace.json');
  const other = { name: 'other-plugin', source: { source: 'local', path: './keep' } };
  writeJson(catalogFile, { name: 'muse-local', interface: { displayName: 'Keep my catalog title' }, custom: 'keep', plugins: [other] });
  const calls = [];
  const run = (...args) => calls.push(args);
  const installed = install({ ...options, host: 'codex', run });
  install({ ...options, host: 'codex', run });
  const catalog = JSON.parse(readFileSync(catalogFile));
  assert.equal(catalog.plugins.length, 2);
  assert.deepEqual(catalog.plugins[0], other);
  assert.equal(catalog.custom, 'keep');
  assert.equal(catalog.interface.displayName, 'Keep my catalog title');
  assert.equal(catalog.plugins[1].source.path, `./plugins/muse-chat-isolation-${version}`);
  assert.equal(JSON.parse(readFileSync(join(installed.target, '.codex-plugin', 'plugin.json'))).interface.displayName, 'Museduo');
  assert.deepEqual(calls[2], ['codex', ['plugin', 'add', 'muse-chat-isolation@muse-local', '--json']]);
  assert.ok(!existsSync(join(options.home, '.claude')));
});

test('ambiguous hosts and malformed marketplace data fail without running setup', () => {
  const options = fixture();
  const run = () => assert.fail('should not run');
  for (const host of [undefined, 'both', 'other']) assert.throws(() => install({ ...options, host, run }), /--host/);
  const catalogFile = join(options.base, 'marketplace', '.agents', 'plugins', 'marketplace.json');
  writeJson(catalogFile, { name: 'another-marketplace', plugins: [] });
  const before = readFileSync(catalogFile, 'utf8');
  assert.throws(() => install({ ...options, host: 'codex', run }), /保留原文件/);
  assert.equal(readFileSync(catalogFile, 'utf8'), before);
});

test('installed Claude and Codex bundles offer the same account commands and share only explicit selections', () => {
  const options = fixture();
  const codex = install({ ...options, host: 'codex', run: () => {} });
  const claude = install({ ...options, host: 'claude', run: () => {} });
  const env = { ...process.env, MUSE_CHAT_DATA_DIR: options.base, CODEX_THREAD_ID: 'installed-parity-test' };
  function cli(host, args) {
    const root = host === 'claude' ? claude.target : codex.target;
    const prefix = host === 'claude' ? ['--claude-session-id', 'installed-parity-test'] : [];
    return JSON.parse(execFileSync(process.execPath, [join(root, 'scripts', 'muse.mjs'), ...prefix, ...args], { env, encoding: 'utf8' }));
  }
  const original = cli('codex', ['info']);
  const first = cli('claude', ['account-new', '账号 A']);
  const second = cli('claude', ['account-new', '账号 B']);
  assert.notEqual(first.profile, second.profile);
  assert.equal(cli('codex', ['info']).accountId, original.accountId);
  assert.equal(cli('codex', ['account-use', first.accountId]).session, first.session);
  assert.equal(cli('claude', ['info']).accountId, second.accountId);
  const fromCodex = cli('codex', ['--account', second.accountId, 'info']);
  assert.equal(fromCodex.callerHost, 'codex');
  assert.equal(fromCodex.host, 'claude');
  assert.equal(fromCodex.profile, second.profile);
  for (const root of [codex.target, claude.target]) assert.ok(existsSync(join(root, 'scripts', 'accounts.mjs')));
});
