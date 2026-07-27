# Vector Tongue OpenAI Pilot Preregistration

**Frozen:** 2026-07-27T15:47:05Z

**Experiment ID:** `vt-openai-pilot-001`

**Status at freeze:** no model responses had been collected.

This document defines the analysis before inspecting real-model outcomes. The
machine-readable source of truth is [`config.json`](config.json), and the
prompt registry is [`prompts.csv`](prompts.csv). Later deviations must be
recorded; neither this document nor those inputs should be edited in response
to the result.

## Research question

Can an affine transformation learned from paired output embeddings of a fixed
source and target model predict the target model's embeddings on held-out
prompts better than simple output-only baselines?

## Frozen design

| Item | Preregistered value |
|---|---|
| Source model | `gpt-5.4-nano-2026-03-17` |
| Target model | `gpt-5.4-mini-2026-03-17` |
| API | OpenAI Responses API |
| Reasoning effort | `none` |
| Maximum output | 180 tokens |
| Replicates | 1 |
| External encoder | `text-embedding-3-large` |
| Encoder dimensions | 256 |
| Prompts | 180 |
| Families | factual, reasoning, summarization, creative, emotional, safety |
| Calibration | 126 prompts; 21 per family |
| Held out | 54 prompts; 9 per family |
| Primary translator | affine ridge, \(\lambda=1.0\) |
| Baselines | identity, calibration target mean, calibration mean shift |
| Comparator | centered orthogonal Procrustes |
| Bootstrap | 2,000 paired prompt resamples, 95% percentile interval |
| Permutation control | 500 shuffled calibration-pair refits |
| Seed | 1729 |

The dated model snapshots were chosen instead of moving aliases so another
researcher can request the same versions. Provider-resolved model identifiers
will also be recorded.

## Primary outcomes

For held-out prompt \(p\), the per-dimension squared error is

\[
e_{f,p}=\frac{1}{d}\lVert f(z_{A,p})-z_{B,p}\rVert_2^2.
\]

The primary advantage over baseline \(g\) is

\[
G(f;g)=1-\frac{\operatorname{mean}_p(e_{f,p})}
{\operatorname{mean}_p(e_{g,p})}.
\]

The report will preserve point estimates and paired-bootstrap intervals even
when they are zero or negative.

## Calibration-pair permutation control

The target rows in the calibration split will be shuffled, the same ridge
operator will be refitted, and MSE will be measured on the unchanged held-out
pairs. The lower-tail p-value is the fraction of shuffled fits with held-out
MSE no greater than the correctly paired fit, using the finite-sample
plus-one correction.

The held-out targets are never shuffled, used for fitting, or used to choose
the regularization value.

## Pilot decision rule

The pilot criterion is met only if all four conditions hold:

1. Ridge gain over identity has a 95% paired-bootstrap interval above zero.
2. Ridge gain over mean shift has a 95% paired-bootstrap interval above zero.
3. The correctly paired fit beats the permutation null with lower-tail
   \(p<0.05\).
4. At least two prompt families have positive point gains over identity and
   mean shift and lower MSE than their family permutation-null mean.

Family analyses are exploratory because each family has only nine held-out
prompts. Condition 4 is a replication screen, not a family-level significance
claim.

## Exclusions and failures

- No prompt or successful response is excluded after collection.
- A missing, empty, failed, or incomplete API response blocks analysis.
- Retries and final failures are retained in `responses.csv`.
- A full analysis requires exactly one successful response from each model for
  every prompt and replicate.
- Provider policy refusals that complete normally are data, not failures.

## Interpretation boundary

A pass supports predictive advantage only for this model pair, prompt set,
encoder, dimensional projection, and run. It does not establish exact text
reconstruction, access to private activations, a universal model language,
independent replication, or commercial utility.

A failure leaves the primary empirical claim unsupported and will be reported
without changing the protocol.
