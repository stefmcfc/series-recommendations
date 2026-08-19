---
name: ears-spec
description: Draft a new EARS-format feature spec for the TV Series Tracker (backend or frontend) and save it to .claude/specs/. Use when the user asks to spec out a new feature, write requirements for something, or plan work before implementing it.
---

# Writing an EARS-format spec

This project's specs (`.claude/specs/`) all follow EARS (Easy Approach to Requirements Syntax). Full reference: `.claude/steering/ears_format.md` — read it before drafting if you haven't already in this session.

## Steps

1. **Confirm scope with the user** if it's not already clear: is this a backend spec (Java/Spring/Spock) or frontend spec (React/TS/Vitest)? What does it depend on? Check `.claude/specs/` for the next available number in the right sequence (`series_spec_00N_*` or `frontend_spec_00N`).

2. **Ground it in reality, not assumption.** Before writing requirements:
   - Backend: read `.claude/steering/structure.md` and `.claude/steering/tech.md`, and grep the actual `backend/src/main/java/...` for related existing classes.
   - Frontend: read `.claude/steering/frontend_structure.md` and `.claude/steering/frontend_conventions.md`, and check what actually exists under `frontend/src/` (a lot of the target layout in that steering doc isn't built yet — don't assume a file exists because the steering doc mentions it).
   - Check dependency specs' actual `Status` line and cross-check against the real source — a spec's stated status has drifted from reality before in this project.

3. **Write requirements as numbered EARS statements**, grouped into named "Requirement N" sections, each with a one-line user story and acceptance criteria using the canonical EARS patterns (Ubiquitous, Event-driven, State-driven, Unwanted behaviour, Optional feature). Assign each AC an ID in the form `<AREA>-<SPEC-NUMBER>-AC-<NN>` (`SERIES-005-AC-01`, `FRONTEND-003-AC-02`, ...) plus a `[AUTO]`/`[MANUAL]` verification marker — see `.claude/steering/ears_format.md` for the full scheme. Note: specs `series_spec_001`–`004` and `frontend_spec_001`–`002` predate this scheme and use an older `SH-`/`IF-`/`MA-`/`SN-` ID style; don't copy that style into new specs.

4. **Include a cross-reference table** linking to the specific endpoints, types, or specs this one depends on or contracts against.

5. **Include TDD test case sketches** (red, before implementation) in the target framework — Spock `given/when/then` for backend, Vitest + React Testing Library for frontend — one per major acceptance criterion, named after its requirement ID.

6. **End with a flat "Acceptance Criteria Summary" checklist** mirroring every criterion above, unchecked (`- [ ]`).

7. **Save** to `.claude/specs/{name}.md` and tell the user what to hand off next — usually the `backend-dev` or `frontend-dev` agent to implement it via red/green TDD.

## What NOT to do

- Don't mark anything as done/implemented in the new spec — it hasn't been built yet, that's the point of writing it first.
- Don't invent API contracts that don't match what's actually in `backend/src/main/java/uk/co/stefirby/seriestracker/dto/` — check the real DTOs.
- Don't skip the test case sketches — every existing spec in this project has them, and `backend-dev`/`frontend-dev` rely on them as the starting point for TDD.
