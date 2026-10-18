# Museduo for Claude Code

@AGENTS.md
@INSTALL.md
@FUNCTIONALITY.md

When the user's request is installation, deliver Museduo's behavior in the requested local host. The ready-made Claude Code path is `node scripts/install.mjs --host claude`; it installs a self-contained personal skill at `~/.claude/skills/museduo` without replacing settings.json or registering global hooks.

Use the installed `/museduo` skill (or `/museduo:museduo` when namespaced) to obtain Claude Code's real session substitution. In plugin mode, read the installed `skills/museduo/SKILL.md` and use `${CLAUDE_PLUGIN_ROOT}/scripts/muse.mjs`; the root `SKILL.md` is the plain personal-skill fallback and uses `${CLAUDE_SKILL_DIR}/scripts/muse.mjs`. Do not mix the two layouts. Do not execute an unexpanded `${CLAUDE_SESSION_ID}` token, invent an ID, or assume a shell variable exists. Plain file reads do not perform skill substitutions. The Codex adapter is separate and retains existing account bindings.


## Same functionality as Codex

When the user gives you this repository and asks for its features, finish the installation and validation instead of only explaining the code. Read FUNCTIONALITY.md as the shared behavior contract. Claude Code must offer the same capabilities: different default accounts in different conversations, multiple independent account windows in one conversation, explicitly selecting and controlling accounts opened in other conversations, naming accounts, and preserving login after close/reopen. Selecting an existing running window requires no reopen or login copying. Reimplementation is allowed if the full behavior is preserved.

Install the full bundle, including `scripts/accounts.mjs`. Use the host-expanded real session ID for every command, including account-list/new/use/rename. Use `--account <ID>` for each browser command in multi-account work. Both bare messages and skill arguments `1`/`0` must work for the selected account. When source code and installed skills differ, update through the installer and load a new Claude Code session; do not keep executing stale skill instructions.

Verify installation in Claude Code, then run info, doctor and a harmless browser operation using Claude Code's actual current session. When validating from a different host, report that limitation accurately; synthetic test identities do not prove model-side skill expansion. See INSTALL.md for installed-bundle browser tests and isolated CLI discovery checks. Do not modify the user's actual Claude settings just to run a test.
