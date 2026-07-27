# Vector Tongue Pilot 003 Preregistration

**Frozen:** 2026-07-27T16:22:18Z

**Experiment ID:** `vt-openai-pilot-003`

**Status at freeze:** no Pilot 003 Batch API job had been submitted.

Pilot 002 revealed an operational design failure before embedding or analysis:
five of 180 source responses reached the frozen 180-token ceiling and returned
with `status=incomplete` and `reason=max_output_tokens`. Only status, reason,
token usage, and output structure were inspected to diagnose the failure;
response text and all semantic outcomes remained uninspected.

Pilot 003 repeats the design in [`PREREGISTRATION.md`](PREREGISTRATION.md) and
the Batch handling in
[`PREREGISTRATION_BATCH.md`](PREREGISTRATION_BATCH.md), with exactly one
protocol change:

| Parameter | Pilot 002 | Pilot 003 |
|---|---:|---:|
| `max_output_tokens` | 180 | 512 |

The higher ceiling is intended to prevent administrative truncation, not to
select prompts or outcomes. The prompt registry and split, dated source and
target models, instructions, reasoning effort, replicate count, encoder,
embedding dimensions, ridge regularization, baselines, Procrustes comparator,
bootstrap, permutation control, random seed, primary outcomes, exclusions,
four-part decision rule, and interpretation boundary are unchanged.

Pilot 001 and Pilot 002 responses are not reused. Pilot 003 starts from zero
responses and uses one consistent Batch API collection mode. A missing, empty,
failed, expired, or incomplete Pilot 003 response blocks analysis and must be
reported rather than silently excluded.
