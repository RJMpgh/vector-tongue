# Vector Tongue Batch Pilot Preregistration

**Frozen:** 2026-07-27T16:07:05Z

**Experiment ID:** `vt-openai-pilot-002`

**Status at freeze:** no Batch API job had been submitted.

Pilot 001 was interrupted before completion by newly provisioned account
request limits. Its 166 successful synchronous responses are preserved but are
not reused, selected, or analyzed in this pilot. See [`DEVIATIONS.md`](DEVIATIONS.md).

Pilot 002 repeats the same frozen scientific design in
[`PREREGISTRATION.md`](PREREGISTRATION.md), with these operational changes:

1. All 180 source requests and all 180 target requests are submitted through
   OpenAI's asynchronous Batch API.
2. The source and target are separate batches because each batch input file is
   restricted to one model.
3. Batch `custom_id` values—not output order—bind results to prompts.
4. Raw batch input, output, state, and error files are preserved and hashed.
5. No response from Pilot 001 enters Pilot 002.

The prompts, split, models, instructions, maximum output, encoder, dimensions,
ridge regularization, baselines, bootstrap, permutations, seed, outcomes, and
four-part decision rule are unchanged.

The use of one consistent collection mode removes the service-mode mixture that
would result from filling only Pilot 001's missing rows through Batch.

The Batch API may complete any time within its 24-hour window. Timing does not
alter the analysis. A missing, expired, incomplete, or failed batch response
blocks analysis and must be reported rather than silently excluded.
