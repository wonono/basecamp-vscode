---
name: ask
description: Answer questions by adopting relevant expert personas with structured multi-perspective reasoning
argument-hint: "<your question>"
---

# Skill: Expert Q&A

Answer the user's question by assembling a panel of relevant experts, then
synthesizing their perspectives into a clear, actionable response.

## Context loading

If the question relates to this project:

1. Read `specs/manifest.yaml` to understand the project scope
2. Load any specs relevant to the question (match by `id` and `summary`)
3. If a spec has `knowledge_required`, load those knowledge files too
4. Use this project context to ground expert answers in actual system facts

If the question is general (not project-specific), skip context loading.

## Input

The user provides: `$ARGUMENTS`

This is a free-form question on any topic — technical, strategic, conceptual,
or project-specific.

## Procedure

### Step 1 — Analyze the question

Determine:
- **Domain(s)**: What fields of expertise does this question touch?
- **Complexity**: Is one expert sufficient, or does this need multiple perspectives?
- **Type**: Is this factual, architectural, strategic, or opinion-based?
- **Project relevance**: Does this relate to the current project? If yes, load specs.

### Step 2 — Assemble the expert panel

Select 1–3 experts whose combined expertise covers the question. For each:
- Give them a **title** (e.g., "Senior Backend Architect", "SEO Strategist")
- State their **relevant specialty** in one line
- Only add multiple experts when the question genuinely benefits from
  different perspectives (e.g., a technical vs. business trade-off)

### Step 3 — Produce expert analyses

For each expert, provide their analysis:
- Reason from their specific domain expertise
- Reference concrete facts, patterns, or established practices
- If project context was loaded, ground the analysis in actual specs and code
- Be direct — no filler, no hedging without substance

### Step 4 — Synthesize

End with a synthesis section that:
- Identifies **consensus** across experts (if multiple)
- Highlights **tensions** or trade-offs between perspectives
- Gives a **clear recommendation** when the question calls for one
- States **confidence level** (high / medium / low) with a brief justification

### Step 5 — Actionable follow-up

After the synthesis, evaluate whether the response leads to a concrete action
on the project.

**Skill discovery** — do NOT use a hardcoded list. Instead:
1. Scan `.claude/skills/*/SKILL.md` frontmatter (`name` + `description`)
2. Exclude `/ask` itself (non-actionable)
3. Match the synthesis recommendation against skill descriptions
4. Select the best-matching skill

**When an actionable skill is found**, end the response with a plain text
suggestion in the same language as the rest of the response. Example:

> To apply this, I can run `/<skill-name>`. Shall I?

Do NOT use `AskUserQuestion` — just write the suggestion as regular text.
The user replies with a confirmation (e.g., "yes", "oui") and you invoke the
skill via the Skill tool with a self-contained argument capturing key decisions
from the expert analysis (the invoked skill has no access to this conversation).

**When NO actionable skill is found**, end normally.

**If the user replies with a follow-up question** (instead of confirming),
treat it as a new question. Go back to Step 1 with this new input, keeping
the existing context. Do NOT re-invoke `/ask` via the Skill tool — continue
the analysis in place. Adjust the expert panel if needed.

## Output format

Structure your response as follows:

```
## Expert panel

**[Title 1]** — [Specialty]
**[Title 2]** — [Specialty]  (if needed)

## Analysis

### [Expert 1 title]

[Their analysis]

### [Expert 2 title]  (if applicable)

[Their analysis]

## Synthesis

[Consensus, tensions, recommendation, confidence level]
```

Then, if an actionable skill was found, add the text suggestion (see Step 5).

## Constraints

- Never hardcode paths, frameworks, or technologies — read them from specs
  when answering project-related questions
- Maximum 3 experts — more dilutes quality. Prefer 1–2 for focused questions
- Experts must genuinely disagree or complement each other — do not add
  a second expert just to echo the first
- Keep each expert analysis concise: prioritize insight density over length
- Always answer in the user's conversation language (French by default)
- If the question is ambiguous, state your interpretation before answering
  rather than asking for clarification (the user can follow up if needed)
