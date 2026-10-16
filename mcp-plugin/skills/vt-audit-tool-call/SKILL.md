---
name: vt-audit-tool-call
description: Inspect planned CRM or GitHub tool-call arguments using Vector Tongue's schema and experimental semantic diagnostics. Use when asked to audit an agent's proposed tool call without executing it, inspect its contract, or explain VT diagnostic results.
---

Call `list_audit_contracts` to find the supported service/action pair and exact schema.
Use `audit_tool_call` once for the proposed call, preserving the user's stated intent
as an unverified report. Do not send secrets, access tokens or sensitive customer data.

Explain schema results separately from semantic distance:
- `FAIL_SCHEMA`: the payload violates or lacks a supported contract; identify the
  mismatch using the published schema without claiming the action was attempted.
- `NOT_MEASURED`: semantic analysis did not complete; never substitute a zero score.
- `UNCALIBRATED`: a diagnostic was measured but no decision threshold is validated.
- `INPUT_TOO_LARGE` or `INVALID_INPUT`: explain the input limit or format issue.

Always state that execution is disabled. A valid schema does not establish correct
business intent, authorization, or correctness of identifiers. Do not call another
tool as a consequence of a low drift score. Do not repeatedly paraphrase intent
or retry payloads to lower the score. Do not claim to intercept other plugins.

If the VT MCP tool is unavailable, say so and inspect the visible contract manually;
label the result manual and do not invent a measured score. Do not install packages,
start a server, or request credentials merely to answer an audit question.
