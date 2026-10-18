#!/usr/bin/env node
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve, delimiter } from 'node:path';
import { homedir } from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
import { dataRoot } from './muse.mjs';

const sourceRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const commonFiles = ['package.json', 'package-lock.json', 'scripts/muse.mjs', 'scripts/accounts.mjs', 'LICENSE', 'THIRD_PARTY_NOTICES.md'];
const codexFiles = [...commonFiles, 'plugin.json', '.codex-plugin/plugin.json', 'assets/icon.svg', 'skills/museduo/SKILL.md', 'skills/museduo/agents/openai.yaml'];
const readJson = file => JSON.parse(readFileSync(file, 'utf8'));
function writeJson(file, value) {
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, JSON.stringify(value, null, 2) + '\n', 'utf8');
}

export function runCommand(command, args) {
  let executable = command;
  if (process.platform === 'win32' && !command.includes('/') && !command.includes('\\')) {
    const candidates = (process.env.PATH || '').split(delimiter).flatMap(folder => ['.exe', '.cmd', '.bat', ''].map(ext => join(folder, command + ext)));
    executable = candidates.find(existsSync);
    if (!executable) throw new Error(`找不到 ${command}。请先安装并加入 PATH。`);
  }
  // Use JSON data rather than interpolating executable shell text for Windows shims.
  const isShim = process.platform === 'win32' && /\.(cmd|bat)$/i.test(executable);
  const script = "$ErrorActionPreference='Stop'; $request=[Console]::In.ReadToEnd() | ConvertFrom-Json; $commandArgs=@($request.args); & $request.command @commandArgs; if ($null -ne $LASTEXITCODE) { exit $LASTEXITCODE }";
  const result = isShim
    ? spawnSync('powershell.exe', ['-NoLogo', '-NoProfile', '-NonInteractive', '-Command', script], { input: JSON.stringify({ command: executable, args }), encoding: 'utf8', windowsHide: true })
    : spawnSync(executable, args, { encoding: 'utf8', windowsHide: true });
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${command} 失败 (${result.status ?? result.signal})`);
}

export function install({ host, source = sourceRoot, home = homedir(), claudeConfig = process.env.CLAUDE_CONFIG_DIR || join(home, '.claude'), base = dataRoot(), run = runCommand } = {}) {
  if (!['codex', 'claude'].includes(host)) throw new Error('请指定 --host codex 或 --host claude；只安装用户要求的目标宿主。');
  if (Number(process.versions.node.split('.')[0]) < 20) throw new Error('需要 Node.js 20+，含 npm。');
  const version = readJson(join(source, 'package.json')).version;
  const marketplace = join(base, 'marketplace');
  const target = host === 'claude' ? resolve(claudeConfig, 'skills', 'museduo') : join(marketplace, 'plugins', `muse-chat-isolation-${version}`);
  if (resolve(target) === resolve(source)) throw new Error('安装源和目标不能相同。');
  const marker = join(target, '.museduo-install.json');
  if (host === 'claude' && existsSync(target) && readdirSync(target).length && (!existsSync(marker) || readJson(marker).name !== 'Museduo')) {
    throw new Error(`目标已有未由 Museduo 安装的技能，保留原文件：${target}`);
  }
  const catalogFile = join(marketplace, '.agents', 'plugins', 'marketplace.json');
  let catalog;
  if (host === 'codex') {
    catalog = existsSync(catalogFile) ? readJson(catalogFile) : { name: 'muse-local', interface: { displayName: 'Museduo 本地插件' }, plugins: [] };
    if (catalog.name !== 'muse-local' || !Array.isArray(catalog.plugins)) throw new Error('现有市场配置不兼容；保留原文件，请检查后再安装。');
  }
  const files = host === 'claude' ? [...commonFiles, 'adapters/claude/SKILL.md', 'adapters/claude/.claude-plugin/plugin.json', 'adapters/claude/skills/museduo/SKILL.md'] : codexFiles;
  for (const file of files) if (!existsSync(join(source, file))) throw new Error(`安装源缺少文件：${file}`);
  for (const file of files) {
    const destination = join(target, file.startsWith('adapters/claude/') ? file.slice('adapters/claude/'.length) : file);
    mkdirSync(dirname(destination), { recursive: true });
    copyFileSync(join(source, file), destination);
  }
  writeJson(marker, { name: 'Museduo', host, version });
  run(process.execPath, [join(target, 'scripts', 'muse.mjs'), 'setup']);
  if (host === 'codex') {
    const entry = { name: 'muse-chat-isolation', source: { source: 'local', path: `./plugins/muse-chat-isolation-${version}` }, policy: { installation: 'AVAILABLE', authentication: 'ON_INSTALL' }, category: 'Productivity' };
    const index = catalog.plugins.findIndex(plugin => plugin.name === entry.name);
    if (index < 0) catalog.plugins.push(entry); else catalog.plugins[index] = { ...catalog.plugins[index], ...entry };
    writeJson(catalogFile, catalog);
    run('codex', ['plugin', 'marketplace', 'add', marketplace, '--json']);
    run('codex', ['plugin', 'add', 'muse-chat-isolation@muse-local', '--json']);
  }
  return { name: 'Museduo', host, version, target, next: host === 'claude' ? '在 Claude Code 中调用 /museduo，然后为当前对话打开 Muse。' : '在 Codex 中选择 Museduo，然后为当前对话打开 Muse。新技能未加载时新建对话。' };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const args = process.argv.slice(2);
    if (args.length !== 2 || args[0] !== '--host') throw new Error('用法：node scripts/install.mjs --host codex|claude');
    console.log(JSON.stringify(install({ host: args[1] }), null, 2));
  } catch (error) { console.error(`[Museduo] ${error.message}`); process.exitCode = 1; }
}
