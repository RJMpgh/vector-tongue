# Run Deviations and Interruptions

## `vt-openai-pilot-001`

Pilot 001 was publicly preregistered before collection. The synchronous run was
stopped after the newly provisioned project reached provider request limits.

At interruption:

- 177 response rows had been attempted;
- 166 responses completed successfully;
- 11 rows ended in recorded API errors;
- 183 planned rows had not yet been attempted;
- no embeddings were created;
- no transform was fitted;
- no held-out metric was calculated;
- response text was not inspected during the run.

Because the preregistration prohibited excluding successful responses, the
project does not mix those rows with later Batch API rows or present Pilot 001
as a completed experiment. Its partial `responses.csv` remains an auditable
interrupted-run artifact. The provider organization identifier in API error
strings was redacted before publication; response text, usage, timing, and
failure details were otherwise retained.

## `vt-openai-pilot-002`

Pilot 002 was preregistered before Batch submission. It begins from zero
responses and uses the Batch API consistently for both models. Any further
deviation will be appended here before affected results are interpreted.

The source batch completed all 180 API requests, but five creative-family
responses returned `status=incomplete` with `reason=max_output_tokens` after
reaching the frozen 180-token ceiling. This is an administrative collection
failure under the preregistered exclusion rule, so Pilot 002 will not be
embedded or analyzed. At the Pilot 003 freeze time, the target batch remained
in provider processing. Only status, reason, token usage, and output structure
were inspected to diagnose the failure; response text and semantic outcomes
were not inspected.
