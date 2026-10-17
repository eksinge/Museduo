# 给 Codex / Claude Code 的安装指引 · Agent installation guide

用户在发送仓库链接并表达“我需要这个项目”或类似需求后，请在其电脑上完成安装和验证。默认名称是 **Museduo**。可以复用源码、适配接口或重新实现，但必须满足 [功能验收标准](FUNCTIONALITY.md)。本文件用于执行用户已提出的任务，不要求绕过宿主权限。

When the user sends this repository and asks to have it, complete the local installation and verification. The default name is **Museduo**. Reuse, adapt, or reimplement as needed while preserving the [behavior contract](FUNCTIONALITY.md). Follow the user's scope and the host's permissions.

## 获取文件 / Get the source

```text
git clone https://github.com/eksinge/Museduo.git
```

没有 Git 时可下载仓库 ZIP 并解压。进入源码目录后读取 AGENTS.md、FUNCTIONALITY.md 及目标宿主的技能。不要将 GitHub 网页 HTML 当作源码。

If Git is unavailable, download and extract the repository ZIP. Read AGENTS.md, FUNCTIONALITY.md and the target adapter. A GitHub HTML page is not the source files.

## 依赖 / Requirements

- Node.js 20+ with npm, Google Chrome, and a local coding-agent session with shell and file access.
- Codex path requires the `codex` CLI with local-plugin support. Claude Code path uses personal skills and requires support for `${CLAUDE_SESSION_ID}` and `${CLAUDE_SKILL_DIR}` substitutions.
- Install the host requested by the user; default to the current host. Do not change model/provider, network proxy, authentication settings, or unrelated plugins to perform this task.
- Windows is tested. The Node installer also contains macOS/Linux paths; inspect the local environment and verify real browser operation before claiming those platforms work. A remote cloud session cannot install on a user's physical computer without a supported local execution connection.

## Codex

```text
node scripts/install.mjs --host codex
```

Windows also supports `Install.ps1` (defaults to Codex). The installer merges the Museduo entry into the existing `muse-local` marketplace, installs a versioned source copy and registers it through the Codex CLI. It preserves other catalog entries and does not copy browser data.

Verify the installed manifest's display name is Museduo and the skill is discoverable. Use its absolute installed wrapper path:

```text
node <installed-plugin-path>/scripts/muse.mjs info
node <installed-plugin-path>/scripts/muse.mjs doctor
node <installed-plugin-path>/scripts/muse.mjs open
node <installed-plugin-path>/scripts/muse.mjs snapshot
```

The process must inherit this conversation's real Codex ID. Select Museduo or open a new Codex conversation if it has not loaded the new skill. Do not claim the account is authenticated from navigation alone.

## Claude Code

```text
node scripts/install.mjs --host claude
```

This installs a self-contained personal skill at `~/.claude/skills/museduo` (or under `CLAUDE_CONFIG_DIR/skills/museduo` when the user configures that directory). It keeps the wrapper, pinned package files and host-specific SKILL.md together, and does not modify settings.json. A compatibility manifest also lets current Claude Code versions recognize it as a skills-directory plugin named Museduo. Re-running updates a Museduo-owned installation; an unrelated existing skill at that path is left intact and reported.

Invoke `/museduo` in Claude Code (or `/museduo:museduo` if the host displays the plugin namespace). Use the commands from the skill the host actually loads.

**Plugin mode (the supplied manifest):** the loaded skill is `<installation root>/skills/museduo/SKILL.md`, while the scripts are under the installation root. Use `${CLAUDE_PLUGIN_ROOT}`, not the nested skill directory:

```text
node "${CLAUDE_PLUGIN_ROOT}/scripts/muse.mjs" --claude-session-id "${CLAUDE_SESSION_ID}" info
node "${CLAUDE_PLUGIN_ROOT}/scripts/muse.mjs" --claude-session-id "${CLAUDE_SESSION_ID}" doctor
node "${CLAUDE_PLUGIN_ROOT}/scripts/muse.mjs" --claude-session-id "${CLAUDE_SESSION_ID}" open
```

**Plain personal-skill fallback:** if the host loads `<installation root>/SKILL.md` directly, the scripts and that skill share the same root. Use its `${CLAUDE_SKILL_DIR}/scripts/muse.mjs` command prefix instead. In plugin mode, `${CLAUDE_SKILL_DIR}/scripts/muse.mjs` would point into the nested skill folder, where there is no wrapper. Do not mix these layouts.

These variables are substituted when Claude Code loads a skill. They are not literal placeholders to copy into an ordinary shell and are not guaranteed environment variables. If they remain literal, load/invoke the skill; if the installed host cannot provide them, update through a supported flow or adapt a documented real-session mechanism. Never replace them with a chosen ID. When installing Claude Code from Codex (or vice versa), obtain the real session ID from the target host, not from the installing agent.

## 复刻或适配 / Adapt or reimplement

If a host/version/platform cannot use the installer, inspect its current official integration mechanism. Install an equivalent local skill/plugin named Museduo; preserve independent persistent profiles, real conversation identity, same-conversation reuse, manual authentication, browser automation, and scoped closing. Keep a durable installation outside a temporary clone, register it so the host discovers it, and verify through that host. A shared browser tab group is not equivalent.

## 验证 / Verification

```text
npm test
npm run test:e2e
npm run test:e2e:claude
```

Unit/integration tests cover namespace isolation, invalid session rejection, existing Codex hash compatibility, self-contained installation, repeat installation and preservation of unrelated settings/catalog entries. Browser tests use temporary profiles with synthetic IDs and fake local account values, not Muse credentials. On Windows, a long checkout path can exceed browser storage path limits; set `MUSE_TEST_ROOT` to a shorter scratch directory for these tests only.

Before reporting completion, also perform a real-host discovery check and a harmless browser call using the real current conversation. Distinguish tests using synthetic IDs from proof of live host integration. Manual Muse authentication is a separate user action.

## Technical references

- [Claude Code personal skills and session substitutions](https://code.claude.com/docs/en/skills#available-string-substitutions)
- [Microsoft Playwright CLI](https://github.com/microsoft/playwright-cli)
