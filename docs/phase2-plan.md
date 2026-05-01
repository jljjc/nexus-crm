# NexusCRM Phase 2 — Upgrade NexusCRM AI Capabilities (Weeks 3–4)

## Three Deliverables

### 1. Integrate Manus API backend — replace direct Claude call in api/claude.js
- Replace direct Anthropic API call with Manus API
- Resolves the snapshot issue and unlocks per-case Skill injection

### 2. Programmatically create Manus Projects per active case with injected Skills
- Each active case gets its own Manus Project
- Skills injected: ozsky-sop, ozsky-visa-criteria, ozsky-templates

### 3. Refine CaseAI component for deeper, more accurate case summaries
- Better prompts
- More structured output
- Deeper integration with Drive + Gmail context
