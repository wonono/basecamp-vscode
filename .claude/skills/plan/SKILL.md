---
name: plan
description: "Deep multi-expert analysis via parallel sub-agents, then structured implementation planning. For complex changes needing multiple perspectives before action."
argument-hint: "<description of what to implement or change>"
---

# Skill: Multi-expert implementation planning

Analyze a user request by spawning 2–5 expert sub-agents in parallel, then
synthesize their findings into a structured implementation plan. Designed for
complex, cross-domain changes where multiple perspectives prevent blind spots.

## Context loading

1. Read `specs/manifest.yaml` — understand the full project scope
2. Identify specs relevant to the user's request (match by folder/domain)
3. Scan `.claude/skills/*/SKILL.md` frontmatter — know what skills exist
   (experts may recommend using specific skills in the plan)

## Input

The user provides: `$ARGUMENTS`

This is a free-form description of what they want to implement or change.
Examples:
- "Add user authentication with OAuth"
- "Migrate the data layer from JSON to SQLite"
- "Scale content generation to 1000+ pages"
- "Add a new department for German energy market"

## Procedure

### Step 1 — Analyze the request

Parse the user's request and determine:

- **Domains involved**: Which areas of the project does this touch?
  (architecture, pipelines, content, deployment, knowledge, legal, etc.)
- **Scope**: Is this a focused change (1–2 domains) or cross-cutting (3+)?
- **Risk level**: Does this affect existing content, data, or workflows?
- **Relevant specs**: Which spec files should experts consult?
- **Relevant skills**: Which existing skills touch the same domain?
  (e.g., spec changes → `/spec`, new skill → `/skill`, site config → `/site`)

Use the manifest entries and folder structure to map domains:
- `architecture/*` → system design, routing, storage, rendering
- `pipelines/*` → content generation, data collection, optimization
- `deployment/*` → CI/CD, hosting, Cloudflare
- `knowledge/*` → domain knowledge, editorial rules
- `sites/*` → site-specific configuration
- `legal/*` → legal and compliance constraints

Map skills to action types (read from `.claude/skills/*/SKILL.md`):
- Spec create/update/delete → read `/spec` procedure for side-effects
- Skill create/update → read `/skill` procedure for side-effects
- Site config changes → read `/site` procedure for side-effects
- Code/script writing → read `/todo` constraints
- Knowledge files → read `/spec` (handles knowledge too)

### Step 2 — Select expert personas

Based on the domains identified, dynamically select 2–5 expert personas.
**Never use a hardcoded list** — infer the right experts from the request.

Guidelines for expert count:
- **2 experts**: focused, single-domain changes (e.g., "add a new blueprint")
- **3 experts**: multi-domain changes (e.g., "new data pipeline + content type")
- **4–5 experts**: cross-cutting changes with risk (e.g., "architecture migration",
  "new department with full pipeline")

Each expert needs:
- A **title** (e.g., "Senior Content Architect", "Data Pipeline Engineer")
- A **specialty** relevant to the request
- A **focus area**: what specific aspect of the request they should analyze

Expert selection heuristics:
- Architecture change → Software Architect, possibly DevOps Engineer
- Content/SEO change → Content Strategist, SEO Specialist
- Data pipeline change → Data Pipeline Engineer, possibly QA Engineer
- New department/site → Domain Expert, Content Architect
- Performance/scaling → Performance Engineer, Software Architect
- Legal/compliance → Compliance Analyst
- Cross-cutting → add a Generalist/Integration Expert to bridge domains

### Step 3 — Spawn expert sub-agents in parallel

Launch all expert sub-agents simultaneously using multiple `Agent` tool calls
in a single message. Each sub-agent runs with `subagent_type: "general-purpose"`.

**Each sub-agent prompt MUST be fully self-contained.** Include:

1. The expert's role and specialty
2. The user's full request (verbatim)
3. Instructions to read `specs/manifest.yaml` first
4. The list of specific specs to read (from Step 1)
5. The list of relevant skills to read (from Step 1) — so experts know
   what side-effects each action type requires
6. Instructions to explore the codebase as needed (read files, grep, glob)
7. The expected output format (see below)

**Sub-agent prompt template:**

```
You are a {title} with expertise in {specialty}.

## Your task

A user wants to: {user_request}

## Your focus area

Analyze this request specifically from the perspective of {focus_area}.

## Context loading

1. Read specs/manifest.yaml at /Users/{...}/ACP/specs/manifest.yaml
2. Read these specific specs: {list of spec paths}
3. Read these skill procedures to understand side-effects:
   {list of skill SKILL.md paths — e.g., .claude/skills/spec/SKILL.md}
   Focus on: what files does each skill update beyond the primary target?
   (manifest, cross-refs, CLAUDE.md, etc.)
4. Explore the codebase as needed — read files, grep for patterns, check
   existing implementations

## Expected output

Provide a structured analysis with these sections:

### Observations
- What exists today that is relevant to this request?
- What patterns, conventions, or constraints did you find?

### Recommendations
- What specific changes do you recommend?
- What files need to be created or modified?
- What approach do you suggest?

### Side-effects per action
For each recommended file change, list ALL side-effects required:
- e.g., "Create spec X" → also update manifest.yaml, add to depends_on
  of spec Y, add knowledge_required if applicable
- e.g., "Create skill Z" → also update CLAUDE.md skills table
- e.g., "Modify site.yaml" → check if blueprints reference new fields
These come from reading the skill procedures above.

### Risks
- What could go wrong?
- What edge cases or conflicts exist?
- What dependencies might break?

### Concrete suggestions
- List specific, actionable items (file paths, code changes, config updates)
- Include side-effect files alongside primary files
- Order them by priority or dependency

Be thorough but concise. Cite specific file paths and spec sections.
Do NOT write code — only analyze and recommend.
```

**Important**: sub-agents must be told to do RESEARCH ONLY — no code writing.

### Step 4 — Synthesize expert findings

After ALL sub-agents complete, synthesize their findings in the main
conversation. Structure the synthesis as:

#### Consensus points
- What do all experts agree on?
- Which recommendations are universal?

#### Tensions and trade-offs
- Where do experts disagree?
- What are the competing priorities?
- What trade-offs need a decision?

#### Key decisions
- What architectural or design decisions emerged?
- What are the options for each decision, with pros/cons?

#### Risk assessment
- Combined risk inventory from all experts
- Severity ranking (high / medium / low)

#### Recommended approach
- The synthesized recommendation incorporating expert consensus
- How tensions were resolved (or flagged for user decision)

Display this synthesis to the user in the conversation BEFORE entering
plan mode — this gives them context for reviewing the plan.

### Step 5 — Enter Plan mode

Call `EnterPlanMode` to switch to planning mode.

### Step 6 — Write the implementation plan

In plan mode, write a structured plan to the plan file. The plan must:

1. **Reference expert recommendations** — cite which expert(s) informed
   each section of the plan
2. **Be actionable** — each step should be concrete enough to execute
3. **Include file paths** — list files to create, modify, or delete
4. **Respect dependencies** — order steps so prerequisites come first
5. **Flag decisions** — if a tension was not resolved, note it in the plan

**Plan structure:**

```markdown
# Plan: {concise title}

## Context
{Brief description of the request and why it matters}

## Expert panel
- {Expert 1 title} — {focus area}
- {Expert 2 title} — {focus area}
...

## Key decisions
{Decisions made based on expert synthesis. Reference which expert(s)
informed each decision.}

## Implementation steps

### Step 1 — {title}
- Files: {primary files to create/modify}
- Side-effects: {housekeeping files — manifest.yaml, CLAUDE.md, cross-refs, etc.}
- Details: {what to do, including side-effect actions}
- Informed by: {expert title(s)}
- Verify: {how to confirm this step is complete}

### Step 2 — {title}
...
```

**Step field guide:**
- **Files**: the primary deliverable (the spec, the script, the config)
- **Side-effects**: secondary files that MUST also be updated for consistency
  (e.g., `specs/manifest.yaml` when creating a spec, `CLAUDE.md` skills table
  when creating a skill, `depends_on`/`used_by` cross-refs in related specs)
- **Details**: what to do — explicit enough to execute without re-reading
  the skill procedure. Include the side-effect actions inline.
- **Verify**: a concrete check (file exists, field present, no broken refs)

```markdown
## Risks and mitigations
- {Risk}: {mitigation strategy}
...

## Verification
{How to verify the full implementation — cross-ref integrity, manifest
completeness, CLAUDE.md accuracy, etc.}

## Out of scope
{What is explicitly NOT part of this plan}
```

### Step 7 — Exit Plan mode

Call `ExitPlanMode` to present the plan for user approval.

## Constraints

- Expert personas are NEVER hardcoded — always dynamically inferred
- Minimum 2 experts, maximum 5 — use judgment based on scope
- Sub-agents run in PARALLEL (all Agent calls in one message)
- Sub-agent prompts must be fully self-contained (no shared context)
- Sub-agents do RESEARCH ONLY — never write code or modify files
- Synthesis happens in main conversation BEFORE entering plan mode
- The plan must reference which expert recommendations it follows
- Never hardcode paths, frameworks, or technologies — read from specs
- Conversation in French, files in English
- If the request is too vague to select experts, ask for clarification
  via `AskUserQuestion` BEFORE spawning sub-agents
- Each sub-agent must read `specs/manifest.yaml` independently
- The plan file follows standard plan mode format (written to the plan file
  path provided by the system)
