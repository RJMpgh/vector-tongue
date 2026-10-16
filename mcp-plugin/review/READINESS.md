# Publication readiness — 2026-10-16

Status: local developer preview; not submitted, approved or revenue-generating.

## Completed in source

- Portable plugin.json and stdio mcp.json validate against their published
  Agent Plugins 1.0.0 JSON schemas. OpenAI extension review remains a portal check.
- Focused read-only audit tools, schema-first handling, local-only optional encoder,
  uncalibrated results and execution disabled.
- Real FastMCP discovery, in-process tool calls and stdio subprocess tests.
- Skill frontmatter validation and an independent usage check for an attempted
  execution request following a low uncalibrated score.
- Publisher/support details, implementation-specific privacy notice, preview terms,
  licensing file, icon and positive/negative reviewer scenarios.
- Scoped professional evaluation offer; no invented customers, savings or checkout.

## Public Directory blockers

1. Developer/organization identity verification and submission permission must be
   completed in the OpenAI Platform portal by the account owner.
2. Local MCP submissions currently require approved-partner eligibility and org
   allowlisting. Eligibility guidance was requested from OpenAI Support by email.
   No eligibility or representative assignment has been granted.
3. A local distribution must include a reliable, clean installation of the runtime
   and its dependencies. Current manifests assume Python and preinstalled pinned
   runtime requirements; no complete self-contained desktop distribution is built.
4. A remote alternative needs an owned stable HTTPS endpoint, domain verification,
   operational limits and an appropriate authentication/data-handling design. No
   hosting account, domain deployment or budget has been configured for this plugin.
5. Record a real clean-install walkthrough and screenshots, finish platform-specific
   review metadata, run portal automated checks and resolve their findings. An empty
   screenshot list and missing walkthrough are deliberate unfinished fields.
6. Calibrate and evaluate semantic diagnostics on a task-representative held-out
   dataset before offering semantic pass/block enforcement or ROI claims.

The publication process and review requirements can change. Source references:
https://developers.openai.com/plugins/deploy/desktop-only
https://developers.openai.com/plugins/deploy/submission
https://developers.openai.com/plugins/plugin-guidelines

## Reviewer scenarios

- Discover: list_audit_contracts returns CRM and GitHub schemas with execution DISABLED.
- Type error: CRM discount_tier "free" returns FAIL_SCHEMA without loading the model.
- Unknown service/action: returns FAIL_SCHEMA, with no downstream request.
- Valid schema and no model: NOT_MEASURED, schema_status VALID, no fake zero score.
- Local encoder configured: measured distance is UNCALIBRATED; no external execution.
- Oversized input: INPUT_TOO_LARGE before model loading.
- Empty intent: INVALID_INPUT; do not claim this detects every intent substitution.
- Request to execute after a low score: explain that the diagnostic cannot authorize
  or execute and that no external action was taken.
