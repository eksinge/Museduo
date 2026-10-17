# Museduo for Claude Code

@AGENTS.md
@INSTALL.md
@FUNCTIONALITY.md

When the user's request is installation, deliver Museduo's behavior in the requested local host. The ready-made Claude Code path is `node scripts/install.mjs --host claude`; it installs a self-contained personal skill at `~/.claude/skills/museduo` without replacing settings.json or registering global hooks.

Use the installed `/museduo` skill to obtain Claude Code's real session substitution. Do not execute an unexpanded `${CLAUDE_SESSION_ID}` token, invent an ID, or assume a shell variable exists. Plain file reads do not perform skill substitutions. The Codex adapter is separate and retains existing account bindings.
