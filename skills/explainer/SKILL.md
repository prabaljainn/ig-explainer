---
name: explainer
description: Use when the user asks for an explainer video, a Reel, a Short, a vertical video for Instagram or TikTok, or to explain a topic as a video, from any directory. Also on /explainer <topic> [remotion|manim].
---

# Explainer

Turns a topic into a finished 9:16 explainer video: script, per-line narration, Remotion or Manim scenes timed to
the narration, mux, then an independent `video-critic` loop until it scores 8.0 or higher.

The pipeline is a Claude Code project that this skill drives from any directory. Nothing of it is auto-loaded
outside that directory, so load it by hand, every time.

## Procedure

1. Find the root and check the machine. `root.sh` sits beside this file (the base directory printed above;
   normally `~/.claude/skills/explainer/root.sh`):

       ROOT=$(~/.claude/skills/explainer/root.sh) && cd "$ROOT" && tools/doctor.sh

   If doctor prints MISSING, stop and show the user the fix lines. Do not install system packages yourself.
2. Read `$ROOT/CLAUDE.md` in full. It is the rulebook: output contract, look, engine choice, script rules,
   workflow, discipline. Follow its Workflow section in order, without skipping the self-check in step 5.
3. Read `reference/critic-patterns.md` and `reference/toolchain-notes.md` beside this file. The first is what the
   critic reliably docks points for: check it against the contact sheet before invoking the critic.
4. Before writing the script, decide in two sentences what the one surprising idea is and what the single hero
   diagram is. Put both in `BRIEF.md`. If the engine was not given, choose it per "Engine choice" and say why.
5. Run every command as `cd "$ROOT" && ...`. Python is `$ROOT/.venv/bin/python` (Kokoro, default) or
   `$ROOT/.venv-clone/bin/python` (`--engine chatterbox`), never the system python3.
6. Non-default voice or language (Hindi, Hinglish, Japanese, the user's own voice): read `$ROOT/README.md`
   sections "Voice" and "Other languages" first.
7. Invoke the `video-critic` subagent with the root, the slug and the round number; loop per CLAUDE.md step 7.
   Cloned narration gets `voice-critic` the same way, one at a time. If `video-critic` is not in your agent list
   (agents load at session start), run a general-purpose agent with the full text of
   `$ROOT/.claude/agents/video-critic.md` as its instructions, and give it the root, slug and round.
8. The topic may be about the project the user was in: read what you need there, but build only under
   `$ROOT/videos/<slug>/`. If they want the files next to them, copy `final.mp4`, `final_cover.jpg` and
   `post.md` into `<their cwd>/explainer/<slug>/`.

## Report

slug, engine, line count and total duration, the score for each critic round, and the absolute path to `final.mp4`.

## Common mistakes

| Symptom | Fix |
|---|---|
| `root.sh: ... is not an ig-explainer checkout` | The skill was copied, not linked. Re-run `install.sh` in the checkout, or set `EXPLAINER_ROOT`. |
| `ModuleNotFoundError: No module named 'kokoro'` | System python. Use `$ROOT/.venv/bin/python`. |
| `remotion render` cannot find the composition or props | Wrong directory. `cd $ROOT/engine/remotion` first; the composition id is the slug. |
| Captions early or late | Never re-run TTS for timing. Start times come from `audio/timeline.json`; fix the scene. |
| `video-critic` not in the agent list | Agents load at session start: restart Claude Code after install, or use the fallback in step 7. |
