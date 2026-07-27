# Preregisterable Research Protocol

## Research question

Can a translation operator learned from matched outputs of two models predict
the target model's held-out response embeddings better than identity,
target-mean, and mean-shift baselines?

## Confirmatory hypotheses

- **H1:** The preregistered translator has positive held-out MSE advantage over
  identity.
- **H2:** It has positive advantage over mean shift.
- **H3:** Its paired error is lower than the distribution obtained after
  permuting target-prompt correspondence.
- **H0:** Each corresponding advantage is zero or negative.

## Design

1. Freeze model identifiers, provider versions, system instructions, sampling
   settings, encoder, preprocessing, prompts, and exclusions.
2. Use content-balanced prompt families.
3. Generate multiple independent response replicates where stochastic sampling
   is used.
4. Keep all responses for a prompt in the same data split.
5. Fit transformations only on calibration prompts.
6. Evaluate once on a sequestered test set.
7. Run the same protocol after shuffling target-prompt correspondence.
8. Repeat with at least one materially different encoder.

## Minimum prompt families

- factual questions with known answers;
- multi-step reasoning;
- summarization;
- creative generation;
- emotionally valenced but harmless prompts;
- safety-policy prompts analyzed as a separate stratum.

## Primary outcomes

- held-out per-dimension MSE;
- mean held-out cosine distance;
- MSE advantage over identity;
- MSE advantage over mean shift.

## Secondary outcomes

- top-\(k\) retrieval of the correct target among candidate target embeddings;
- response length and sentence length;
- refusal or deferral rate under a blinded rubric;
- factual accuracy where ground truth exists;
- calibration drift across model versions and dates;
- residual error by prompt family.

## Analysis

- Report prompt-level confidence intervals.
- Cluster resampling by prompt when multiple responses share a prompt.
- Correct the declared family of confirmatory comparisons.
- Report failed generations and provider retries.
- Treat hyperparameter selection as training-set activity.
- Do not tune against the final test set.

## Minimum evidence for a positive result

- positive advantage over identity and mean shift;
- uncertainty interval excluding zero for the preregistered primary contrast;
- worse performance after target permutation;
- replication across at least two prompt families;
- no material data leakage;
- exact versioned data and code record.

## Required reporting

- repository commit;
- prompt-set hash;
- raw-response access plan;
- model/provider/version;
- encoder/version;
- all decoding settings;
- seeds where supported;
- calibration/test split identifiers;
- exclusions and retry counts;
- complete baseline results;
- negative and null results.

## Optional shared-anchor arm

For experiments using the Marlerian Anchor Registry:

1. freeze and hash the registry version;
2. keep registry-development prompts outside final evaluation;
3. fit one model-to-reference map using calibration anchors;
4. test unseen anchor prompts and intermediate path stages;
5. report residual disagreement before and after calibration;
6. compare shared-reference calibration against direct pairwise mappings;
7. replicate with translated and adversarial boundary cases;
8. report whose judgments defined expected properties.
