# Real-Model Experiment

This directory turns Vector Tongue from a synthetic demonstration into a
frozen, auditable model-to-model pilot.

## What is fixed

- 180 distinct prompts in six families;
- a balanced 70/30 calibration and held-out split;
- dated OpenAI source and target model snapshots;
- one fixed external encoder and dimensional projection;
- affine ridge, Procrustes, and three simple baselines;
- paired bootstrap intervals and calibration-pair permutation controls;
- decision criteria written before response collection.

The active run is
[`vt-openai-pilot-003`](PREREGISTRATION_PILOT_003.md), which uses one
consistent Batch API collection mode and a corrected output ceiling. Earlier
interruptions are preserved in [`DEVIATIONS.md`](DEVIATIONS.md).

## One-time setup

From the repository root:

```bash
python -m venv .venv
source .venv/bin/activate
python -m pip install -r experiments/real_models/requirements.lock
python -m pip install -e .
```

Set `OPENAI_API_KEY` in the environment or in an ignored `.env.local`. Never
commit that file.

## Validate without spending money

```bash
vector-tongue experiment validate
```

This checks the corpus and configuration, prints their SHA-256 hashes, and
shows a conservative maximum cost estimate. It makes no API calls.

## Run the complete pilot

```bash
vector-tongue experiment batch-submit --acknowledge-api-cost
vector-tongue experiment batch-sync
vector-tongue experiment embed --acknowledge-api-cost
vector-tongue experiment analyze
```

Batch work can finish any time within 24 hours. Run `batch-sync` again until
both model batches are complete. It imports results by `custom_id`; batch output
order is deliberately ignored.

The original synchronous collector remains available for other protocols, but
must not be used to fill Pilot 002.

## Produced artifacts

| Artifact | Purpose |
|---|---|
| `artifacts/vt-openai-pilot-003/responses.csv` | Raw text, exact model IDs, usage, collection mode, and status |
| `artifacts/vt-openai-pilot-003/batch_*.jsonl` | Raw input, output, and error records |
| `artifacts/vt-openai-pilot-003/batch_state.json` | Batch identifiers, status, and counts |
| `artifacts/vt-openai-pilot-003/embedding_index.csv` | Stable mapping from responses to matrix rows |
| `artifacts/vt-openai-pilot-003/embeddings.npz` | Fixed-encoder vectors and encoder metadata |
| `artifacts/vt-openai-pilot-003/analysis.json` | Complete machine-readable metrics and prompt-level errors |
| `artifacts/vt-openai-pilot-003/run_manifest.json` | Code commit and SHA-256 hashes for every run artifact |
| [`../../RESULTS.md`](../../RESULTS.md) | Human-readable positive, null, or negative result |

Artifacts are intentionally versionable. API credentials are not.

## Reproduction notes

The API can reproduce configuration and model snapshots, but model sampling and
provider infrastructure can prevent bit-for-bit text replay. The repository
therefore preserves the raw responses and hashes the exact data used for
analysis.

The current pilot is not an independent replication. A stronger follow-up
should add another provider, a materially different encoder, and multiple
response replicates without altering this run.
