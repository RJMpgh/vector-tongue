# VT MCP Drift Auditor — experimental diagnostic

Concept and OOA framing: RJ Marler. This is an additional experiment alongside
Vector Tongue's held-out model-change assurance, not validation of that research.

## Implemented

A strict service/action schema registry rejects unknown routes, extra fields,
coercion and out-of-range values before embedding. The illustrative CRM contract
uses discount tiers 0–3; these are demo bounds, not a real provider specification.

A local stdio MCP tool measures squared Euclidean distance between unit-normalized
embeddings of model-supplied intent and canonical tool-call JSON. Values range
from 0 to 4. It returns structured diagnostics; no API calls are executed.
Encoder failure, non-finite data, excessive input and truncation risk never become
a zero drift score. The runtime uses only a separately provisioned local model.
No credentials, prompts or payloads are written to logs by this implementation.
Do not pass secrets as payload fields; the MCP client and host may retain inputs.

## Run

Use Python 3.10+ in an isolated environment:

```bash
python -m pip install -r mcp-plugin/requirements-model.txt
# Provision and verify a fixed all-MiniLM-L6-v2 snapshot separately.
export VT_MODEL_PATH=/absolute/path/to/verified/model-snapshot
python mcp-plugin/server.py
```

The host starts this command over stdio. A portable plugin manifest and a repo
marketplace entry are included for local preview testing. Install the dependencies
in the Python environment the host uses; the plugin does not auto-install them.
Without the optional model, schema validation still works and drift is NOT_MEASURED.
This is not an approved or hosted Directory submission.
The MCP runtime dependencies are pinned; model dependencies are optional and their direct versions are pinned. Audit and lock the complete dependency graph before production.

```bash
PYTHONPATH=mcp-plugin python -m unittest discover -s mcp-plugin/tests -v
```

The core tests use deterministic vector fixtures. They do not measure MiniLM accuracy or savings. Integration tests exercise actual
FastMCP discovery, in-process calls and a stdio child process. The optional local MiniLM path also passed an offline smoke test on illustrative
fixtures; see review/ENCODER_SMOKE.md. This is not an accuracy benchmark.

## Trust boundaries

- Model-supplied `user_intent` is unverified. A production host must capture intent
  outside the model and bind it to tenant, principal, action scope and expiry.
- A low embedding distance cannot establish correct IDs, quantities, negation,
  authorization or JSON schema compliance. Real provider argument schemas and
  deterministic constraints must run before any execution adapter.
- The 0.15 threshold is uncalibrated. The MCP tool deliberately has no pass/block
  threshold. Core-library thresholds are experimental diagnostics only.
- This tool cannot intercept other installed MCP servers. Enforcement requires
  all target-service access to traverse an authorized gateway; disable bypass paths.
- Local embeddings incur compute/hosting costs, although no paid embedding API is used.
- Failed preflight can still consume model tokens and host credits. Bound retries
  in the host; do not instruct a model to retry until it gets a low score.

## Execution and credentials: not implemented

Do not replace a service token with a random string. Production adapters need a
real secret manager, least-privilege service authorization, tenant isolation,
fixed service endpoints, schema validation, request deadlines, replay protection,
idempotency, rate limits and redacted operational traces. Token lifetime and
revocation are provider-specific; short-lived does not mean single-use. Revoking
a credential does not prove cryptographic destruction of every copy.

## Evidence required before a paid enforcement product

Freeze a labeled corpus of intent/call pairs with correct calls and failures:
wrong IDs, missing constraints, negation, injection, schema errors and harmless
paraphrases. Split by task family, select thresholds on calibration data, and
report false blocks and false accepts on untouched held-out cases. Compare
schema-only, rules-only and embedding-assisted policies and multiple encoders.
Start in shadow mode and track total tokens, retries, external calls, latency,
local compute and actual provider charges. Calculate net savings including
false blocks and gateway overhead. Current failure-rate, savings, ROI and
near-zero hallucination claims are `NOT_MEASURED`.

A scoped paid evaluation is a possible offer; $49/seat is an untested pricing
hypothesis. No subscriptions, marketplace revenue share, sales or Directory
verification are established by this code.

## Protocol and platform notes

MCP publishes tool schemas through protocol discovery; an OpenAPI file alone
cannot register an MCP plugin. `openapi.yaml` is a future REST adapter contract,
not a running REST endpoint. A portable instruction file would guide usage, not
make the gateway mandatory or confer trust on the intent.

Official sources reviewed 2026-10-16:
- https://developers.openai.com/plugins/build/mcp-server
- https://learn.chatgpt.com/docs/migrate-custom-gpts

These document MCP plugins and custom GPT migration. The reviewed migration page
is Enterprise-focused and does not establish a universal December 11 retirement
date. The supplied 28–35% failure rate, $4.50–$8/1,000 query cost, 30% savings,
$300/month ROI and Agensi 70% split need independent evidence before publication.

See [PILOT.md](PILOT.md) for a scoped evaluation offer and
[review/READINESS.md](review/READINESS.md) for the current publication blockers.

## Offline pilot reports

Process redacted JSONL records (intent, service, action, payload only):

```bash
python mcp-plugin/batch_audit.py mcp-plugin/examples/redacted-demo.jsonl --synthetic-demo
```

The report omits prompts and payloads, counts structural outcomes, and leaves
accuracy and savings NOT_MEASURED. Add `--semantic` to use an independently
provisioned local model. Limit: 1,000 records, 16 KiB per line. Demo records are
illustrative fixtures, not production traffic.
