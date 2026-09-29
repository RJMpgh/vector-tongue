# Model Migration Audit

The migration audit is the commercial wedge: compare the same prompt suite against a source and target model, preserve per-prompt evidence, and make the release decision explicit.

## Input contract

examples/migration_audit.json is a reproducible fixture. A record contains:

- prompt_id and prompt_family;
- source and target observable outputs;
- optional declared constraints;
- optional expected_format;
- optional paired embeddings from one fixed external encoder.

Run it with:

    vector-tongue migration-audit examples/migration_audit.json --output /tmp/vector-tongue-audit.json

## What is actually measured

The audit computes hashes, word counts, word-count deltas, exact-response equality, a documented refusal-marker heuristic, declared constraint presence, JSON parseability when expected_format is json, and caller-supplied embedding MSE.

It does not infer semantic equivalence from text similarity. Without paired embeddings, semantic drift and translation predictability are NOT_MEASURED, and the default gate is INSUFFICIENT_DATA.

A FAIL is reserved for a configured measured failure, such as a constraint violation or supplied embedding distance above threshold. A REVIEW is used for measured observable refusal or format changes. A PASS means only that the configured measured gates passed; it is not a guarantee of migration safety.

## Provenance boundary

The Python connector contract records provider, model, prompt ID, timestamp, response hash, latency, token usage when returned, and non-secret metadata. Fixture responses are labeled SYNTHETIC_DEMO; fixture latency and time are not treated as production measurements.

The audit never stores API keys and never claims access to activations or private chain-of-thought.
