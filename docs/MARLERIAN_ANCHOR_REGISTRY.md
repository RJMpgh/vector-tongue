# Marlerian Anchor Registry

## Purpose

The Marlerian Anchor Registry is a proposed shared semantic calibration layer
for otherwise incompatible AI systems.

Vector Tongue v2 learns directed pairwise maps:

\[
f_{A\rightarrow B},\quad f_{A\rightarrow C},\quad f_{B\rightarrow C}.
\]

Pairwise maps scale quadratically with the number of models. A common reference
space \(M\) instead gives each model one calibration map:

\[
T_A:z_A\rightarrow M,\qquad
T_B:z_B\rightarrow M,\qquad
T_C:z_C\rightarrow M.
\]

Model outputs can then be compared after calibration:

\[
\tilde z_{m,p}=T_m(z_{m,p}).
\]

The registry defines the reference observations used to estimate and test
\(T_m\). It does not require models to return identical language.

## Dictionary versus registry

“Marlerian Baseline Dictionary” is the human-facing concept. **Marlerian Anchor
Registry** is the technical name because each entry contains substantially more
than a word definition:

- an operational definition;
- semantic invariants;
- inclusions and exclusions;
- boundary cases;
- known confounders;
- an ordered path from position \(0\) to \(1\);
- evaluation prompts;
- expected properties and prohibited inferences;
- governance and version metadata.

The initial illustrative registry contains anchors for:

- evidential certainty;
- harm;
- meaningful agency;
- burden transfer.

These entries demonstrate the format. They are not declared universal,
complete, culturally neutral, or production-ready.

## Anchored paths

An anchor path is a controlled semantic trajectory:

\[
x_i(\lambda),\qquad \lambda\in[0,1].
\]

Only the intended property should change materially as \(\lambda\) increases.
Each stage declares invariants that should remain stable.

For example, an evidential-certainty path can move from unsupported, through
partially supported, to strongly supported while preserving these invariants:

- confidence remains distinct from evidence quality;
- correlated repetitions are not counted as independent evidence;
- uncertainty is not silently removed.

The registry validates that every path:

- begins at \(0\);
- ends at \(1\);
- has strictly increasing positions;
- has unique stage identifiers;
- declares expected invariants.

## Calibration

Suppose one model produces anchor-observation matrix \(X_m\) and the reference
process produces matrix \(R\). The initial implementation fits:

\[
T_m(X)=XW_m+b_m
\]

by regularized least squares:

\[
(\hat W_m,\hat b_m)
=\arg\min_{W,b}
\lVert X_mW+b-R\rVert_F^2+\lambda\lVert W\rVert_F^2.
\]

Calibration error is reported using mean squared error and cosine distance. A
map fitted to anchor observations must still be tested on held-out prompts and
path stages. Low calibration error alone does not establish semantic
equivalence.

## Anti-flattening rule

The objective is comparable coordinates, not homogenized outputs.

A model may disagree with the registry or express an anchor differently.
Vector Tongue should record the disagreement, its uncertainty, and the path
location. It should not automatically overwrite the output or call variation a
defect.

## Governance requirements

A shared baseline can encode the assumptions of whoever controls it. That risk
is structural, not incidental. A credible registry must therefore be:

- versioned and content-hashed;
- multilingual;
- explicit about operational definitions;
- contestable through documented change proposals;
- evaluated for cultural and demographic coverage;
- capable of representing disagreement distributions;
- governed separately from any single model provider;
- backward-compatible enough to measure semantic change over time.

No anchor should be called neutral merely because it is encoded numerically.

## Validation

Validate the illustrative registry:

```bash
vector-tongue validate-anchors anchors/marlerian-baseline-v0.1.json
```

The command verifies structural and semantic invariants and prints a SHA-256
content fingerprint with registry counts.

## Research sequence

1. Freeze a candidate registry version.
2. Obtain responses from each model for every anchor prompt and path stage.
3. Encode the responses using multiple fixed encoders.
4. Fit one model-to-reference calibration map per model.
5. Evaluate held-out anchor prompts and intermediate path positions.
6. Measure cross-model residual disagreement after calibration.
7. Compare against pairwise Vector Tongue mappings.
8. Run adversarial boundary cases and translated versions.
9. Publish negative results and registry revisions.

## Defensible current claim

> The Marlerian Anchor Registry specifies and validates a versioned format for
> shared semantic anchors and controlled paths, and provides an implemented
> mechanism for fitting model-specific maps into a common reference space.

Whether the resulting reference space improves real cross-model comparison
remains an empirical question.
