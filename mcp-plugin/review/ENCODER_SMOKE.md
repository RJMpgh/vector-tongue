# Local encoder smoke test

On 2026-10-16, the optional encoder path was exercised with a separately downloaded
all-MiniLM-L6-v2 snapshot at revision
`1110a243fdf4706b3f48f1d95db1a4f5529b4d41`. Runtime inference was repeated with
HF_HUB_OFFLINE=1 and TRANSFORMERS_OFFLINE=1. Model weights are not included in git.

The two illustrative records in examples/redacted-demo.jsonl are SYNTHETIC_DEMO,
not production traffic. The valid GitHub lookup produced normalized squared
embedding distance approximately 1.4695 and status UNCALIBRATED. The malformed CRM
record returned FAIL_SCHEMA with no semantic score. Raw machine-readable results
are in local-model-smoke.json; runtime versions are in validation.json.

This confirms that the local model path can run. It does not establish error
prediction, security, coverage, economic value or any calibrated threshold. In
particular, the proposed universal 0.15 cutoff would reject this valid lookup.
A task-specific held-out comparison against schema/rules baselines is necessary.
