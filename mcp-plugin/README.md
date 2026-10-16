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
python -m pip install -r mcp-plugin/requirements.txt
# Provision and verify a fixed all-MiniLM-L6-v2 snapshot separately.
export VT_MODEL_PATH=/absolute/path/to/verified/model-snapshot
python mcp-plugin/server.py
```

The host starts this command over stdio. This is not a hosted Directory submission.
Dependency ranges are for prototype setup; freeze and audit dependencies before deployment.

```bash
PYTHONPATH=mcp-plugin python -m unittest discover -s mcp-plugin/tests -v
```

The core tests use deterministic vector fixtures. They do not measure MiniLM
accuracy, savings or MCP interoperability. Integration checks should run with the
installed dependencies and a verified local model snapshot.

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
