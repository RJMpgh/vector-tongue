# Architecture

## Boundary

Vector Tongue starts after model responses have been generated. Provider
adapters and embedding encoders are intentionally outside the core package so
that evaluation math is not coupled to one vendor.

## Pipeline

1. Collect matched prompts and responses.
2. Encode responses using one fixed external encoder.
3. Validate dimensions, identifiers, and finite values.
4. Split at the prompt level.
5. Fit baseline and candidate translations on calibration data.
6. Predict held-out target embeddings.
7. calculate paired errors, advantages, and intervals.
8. Run negative controls and save versioned results.

## Modules

| Module | Responsibility |
|---|---|
| `data.py` | validated paired datasets and splitting |
| `geometry.py` | descriptive drift measures |
| `models.py` | translation hypotheses and baselines |
| `evaluation.py` | held-out metrics and cross-validation |
| `statistics.py` | bootstrap intervals and permutation controls |
| `anchors.py` | anchor-registry validation and reference-space calibration |
| `provenance.py` | artifact hashing and manifest validation |
| `io.py` | portable CSV/JSON interfaces |
| `cli.py` | reproducible command-line entry points |

## Extension points

Future versions can add:

- nonlinear translators with nested validation;
- sparse translators for feature attribution;
- retrieval metrics;
- hierarchical prompt-family models;
- longitudinal change-point detection;
- provider adapters in a separate optional package;
- signed result manifests.

## Shared anchor layer

Pairwise translation remains useful for direct model comparisons. The
Marlerian Anchor Registry adds a hub-and-spoke alternative:

\[
z_m\rightarrow T_m(z_m)\in M.
\]

The registry supplies versioned operational anchors and controlled paths.
`AnchorSpaceCalibrator` estimates a model-specific affine map into the shared
reference representation. This is a calibration mechanism, not a claim that
one numerical reference contains universal semantic truth.
