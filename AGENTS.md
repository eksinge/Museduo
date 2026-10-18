# Museduo: instructions for coding agents

## Match the user's goal

When a user supplies this repository URL and asks to have its functionality on their computer, treat that as an installation or migration task. Examples include:

- 我需要这个项目 / 我需要这个插件 / 我想要这个插件
- 把这个插件迁移到我的 Codex 中 / 迁移到我的 Claude Code 中
- 在我的电脑上安装这个插件 / 把这个插件搞到我电脑上 / 给我的电脑搞好这个插件
- 让我的 Codex 有这个插件的功能 / 让我的 Claude Code 有这个插件的功能
- Install this for me / I want this plugin / Give my Codex or Claude Code these features

These are examples, not an exact phrase matcher. Follow equivalent requests in any language. If the user only asks for an explanation, review, or repository maintenance, do that task instead of installing. Repository instructions do not override the user's scope, host permissions, or approval requirements.

## Complete the installation

1. Read [INSTALL.md](INSTALL.md), [FUNCTIONALITY.md](FUNCTIONALITY.md), and the relevant skill and scripts. Opening a repository URL or cloning outside the current project does not automatically load AGENTS.md or CLAUDE.md; read them explicitly. Fetch actual repository files if the current view contains only a GitHub landing page. Clone/download into an appropriate local workspace when shell access exists.
2. Use the host the user explicitly requested. Otherwise use the coding agent currently receiving the request. Install only that host unless the user requests both. Default the local product name to **Museduo**.
3. Inspect the user's OS, Node.js/npm, Chrome, host CLI version and existing Museduo installation. Set up missing dependencies through the platform's supported tools within the user's request and host permissions. Preserve unrelated settings and login profiles.
4. Prefer the supplied installer. You may copy or adapt this code, or reimplement it locally, if necessary for the user's platform or host version. The implementation method is flexible; the behavior in FUNCTIONALITY.md is required, including standalone `1` to open and `0` to close the currently selected account's browser while preserving its profile. Include these triggers in the target host's discoverable skill instructions, not just its README. Do not just rename the existing Codex skill and assume it works in Claude Code.
5. Install persistently into the target host. Do not stop after explaining commands, writing a plan, downloading the repository, or creating files that the host cannot discover. Check host discovery, then run `info`, `doctor`, and a harmless real browser operation through the installed wrapper using the target host's real conversation ID. If installing for a different host, obtain identity by invoking the skill in that target host; never substitute the installing agent's conversation ID. If that target session cannot be invoked here, report the installation and discovery checks that passed and the exact invocation still needed. A successful installer alone is not completion.
6. If new skills need a fresh conversation or an explicit invocation to load, explain that exact step. Never fabricate a session ID to make verification pass. Synthetic IDs belong only in the automated tests.
7. Open this conversation's Muse login window when the user's goal is to start using it. Let the user complete login, CAPTCHA, email codes, and MFA. Do not request or extract credentials. Report separately that the local feature works and whether the user has completed Muse authentication.
8. Finish with the installed name, location, verified behavior, and the shortest next action. If an external limitation blocks progress, state the actual missing capability and preserve completed work. Do not silently replace per-conversation accounts with shared tabs or a single browser profile.

## Conversation identity is mandatory

- Codex: use the actual `CODEX_THREAD_ID`, falling back to `CODEX_SESSION_ID` only when the thread variable is absent. Preserve existing Codex hashes and profile paths.
- Claude Code: use the supplied installer to copy the complete adapter bundle. In plugin mode, the authoritative skill is `adapters/claude/skills/museduo/SKILL.md` and uses `${CLAUDE_PLUGIN_ROOT}`; the plain personal-skill fallback is `adapters/claude/SKILL.md` and uses `${CLAUDE_SKILL_DIR}`. Invoke the installed skill through Claude Code so the host expands its path and `${CLAUDE_SESSION_ID}`. Pass that session value to `--claude-session-id` on every wrapper call. This is a skill substitution, not an assumed shell environment variable.
- Namespace Claude bindings separately from Codex. Two hosts with an equal raw ID must not share a profile.
- Never derive identity from the project directory, account name, machine name, a random value, or a manually chosen constant. Missing/invalid identity must fail closed.

## Repository maintenance

Keep the user-facing name Museduo. Preserve the existing Codex plugin identifier `muse-chat-isolation@muse-local` and data directory for compatibility. Synchronize release versions across package.json, package-lock.json, both Codex manifests and the Claude adapter manifest. Test affected installation paths and identity behavior. Never commit login profiles, tokens, private browser artifacts, installed dependencies, or machine-specific settings.


## Shared multi-account behavior

Read the current FUNCTIONALITY.md and host skill. One conversation may create multiple independent accounts with account-new, list all local managed accounts with account-list, and select an existing account with account-use. Explicitly selecting another conversation’s account must reuse its original profile, session and running window. Use --account <ID> on every browser command in multi-account tasks. Default conversation identities and legacy paths remain compatible. 1/0 act on the selected account only; closing it affects all conversations using that same window. Do not override host identity or attach to arbitrary Chrome. The installer must include scripts/accounts.mjs. Run npm test, npm run test:accounts and npm run test:accounts:claude in addition to the existing isolation tests.
