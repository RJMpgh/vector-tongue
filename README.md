# Vector Tongue

[![CI](https://github.com/RJMpgh/vector-tongue/actions/workflows/ci.yml/badge.svg)](https://github.com/RJMpgh/vector-tongue/actions/workflows/ci.yml)
[![Python 3.10+](https://img.shields.io/badge/python-3.10%2B-3776AB.svg)](https://www.python.org/)
[![Concept: RJ Marler](https://img.shields.io/badge/concept-RJ%20Marler-6f42c1.svg)](AUTHORS.md)
[![Product category: Model Change Assurance](https://img.shields.io/badge/category-Model%20Change%20Assurance-4f46e5.svg)](#model-change-assurance)

## Know what your AI changed before your users do.

**Vector Tongue is a black-box Model Change Assurance platform for AI model migrations, upgrades, prompt changes, and release decisions.**

It turns model change into four engineering questions:

1. **What changed?**
2. **Where did it change?**
3. **Does it matter?**
4. **Can I ship?**

Vector Tongue compares observable model behavior without requiring access to proprietary weights, hidden activations, or internal latent states. It combines held-out cross-model translation, semantic drift, declared baselines, negative controls, evidence grading, and release gating in one reproducible workflow.

**Concept, terminology, and original prototype: RJ Marler.**

---

## Model Change Assurance

Traditional software release systems can tell you whether code changed. They do not reliably tell you whether an AI system's behavior changed in a way that matters to production.

Vector Tongue is designed to occupy that missing control point:

```text
Current model / prompt / provider
            │
            ├── representative prompts
            │
            ▼
      observed outputs
            │
            ▼
    fixed external encoder
            │
            ▼
  held-out translation + drift
            │
     baselines + controls
            │
            ▼
     evidence-graded verdict
            │
            ▼
         release gate
```

This makes Vector Tongue relevant to:

- model-provider migrations;
- checkpoint and API-version qualification;
- prompt and policy regressions;
- fine-tune replacement decisions;
- AI gateway and routing validation;
- vendor due diligence;
- continuous model-change monitoring;
- enterprise release governance.

---

## What is differentiated here

Many AI evaluation and observability tools score known outputs, trace requests, or monitor production systems. Vector Tongue focuses on a narrower and more operational question: **whether a behavioral mapping learned between two AI systems generalizes to unseen prompts, and whether the residual change is acceptable for release.**

For prompt `p`, model `m`, response `y(m,p)`, and a fixed external encoder `E`:

```text
z(m,p) = E(y(m,p))
```

For source model `A` and target model `B`, Vector Tongue learns on calibration prompts:

```text
z_hat(B,p) = f_A→B(z(A,p))
```

The current affine implementation is:

```text
z_hat(B,p) = z(A,p)W + b
```

The claim succeeds only to the degree that the learned map improves held-out prediction over declared baselines and survives controls.

That distinction matters: **similarity describes outputs you already have; Vector Tongue tests whether observed cross-model behavior is predictably translatable on prompts you did not fit on.**

---

## Evidence grades

Vector Tongue now treats provenance as part of the decision contract.

| Grade | Meaning | Production release use |
|---|---|---|
| `SYNTHETIC_DEMO` | Deterministic generated test data | **Never** |
| `USER_SUPPLIED` | User-provided paired embeddings or outputs | Conditional on dataset provenance |
| `LIVE_PROVIDER_CALLS` | Measured outputs from configured provider APIs | Eligible for decision support, with representative prompts and policy thresholds |

Synthetic demo results are explicitly barred from producing a production pass/fail verdict.

---

## Live provider comparison

The industry-launch branch includes a server-side live comparison path for OpenAI and Gemini endpoints. Provider credentials stay in server environment variables and are never requested in the browser UI.

For a live run, Vector Tongue:

1. sends the same prompt set to Model A and Model B;
2. stores observed outputs in the returned evidence record;
3. encodes those outputs with one fixed external encoder;
4. runs held-out translation, baselines, drift, and release logic;
5. marks the result `LIVE_PROVIDER_CALLS`;
6. exports a machine-readable audit record.

This starter mode is a smoke-test path. Enterprise use should replace the starter prompt suite with production-representative traffic and organization-specific thresholds.

---

## Quick start

### Research package

```bash
git clone https://github.com/RJMpgh/vector-tongue.git
cd vector-tongue
python -m venv .venv
source .venv/bin/activate
python -m pip install -e .
vector-tongue demo
python -m unittest discover -s tests -v
```

### Web application

```bash
npm install
npm run lint
npm run build
npm run dev
```

Environment configuration:

```bash
cp .env.example .env
```

The public UI supports three evidence paths:

- deterministic demo;
- uploaded paired embeddings;
- live provider comparison when server credentials are configured.

---

## Evaluate real paired embeddings

Prepare a CSV using one fixed external encoder:

```csv
prompt_id,category,source_embedding,target_embedding
p001,factual,"[0.12, 0.34, -0.08]","[0.10, 0.30, -0.02]"
p002,reasoning,"[0.07, -0.11, 0.44]","[0.03, -0.04, 0.41]"
```

Then run:

```bash
vector-tongue evaluate paired_embeddings.csv \
  --model ridge \
  --regularization 1.0 \
  --test-fraction 0.25 \
  --output results/evaluation.json
```

For publishable or enterprise-grade work, freeze prompt families and hypotheses first, preserve raw response metadata, repeat generations when stochasticity matters, compare encoder sensitivity, and preregister the primary metric. See [`docs/RESEARCH_PROTOCOL.md`](docs/RESEARCH_PROTOCOL.md).

---

## Release engineering

The repository includes:

- Python unit and integration tests;
- TypeScript typecheck and production build checks;
- a CI truth-boundary test that rejects simulated commerce language;
- a truth-boundary check requiring synthetic-data disclosure;
- release-gate logic and machine-readable evidence exports;
- a provenance manifest and verification tooling.

This is intentional: the product is being built so claims, evidence, and release logic can be reviewed by a technical buyer rather than hidden behind presentation-only UI.

---

## Strategic buyer fit

Vector Tongue is especially relevant to organizations that already own one of these surfaces:

- AI observability and evaluation;
- model gateways and routing;
- foundation-model APIs;
- AI developer platforms;
- enterprise software delivery and release governance;
- cloud AI platforms;
- model-risk, testing, or assurance infrastructure.

A buyer does not need Vector Tongue to replace an existing observability stack. The stronger integration thesis is to add **model-change qualification and release assurance** as a differentiated control layer inside an existing platform.

See [`docs/STRATEGIC_BUYER_BRIEF.md`](docs/STRATEGIC_BUYER_BRIEF.md).

---

## Historical v1 and mathematical correction

The August 5, 2025 public disclosure proposed:

```text
delta = z_B - z_A
z_hat_B = z_A + delta
```

and the historical Marler Drift v1 index:

```text
D_Marler-v1 = (1 - cos(z_A,z_B)) * ||z_B-z_A||_2
```

Those equations are preserved in [`prototype_v1/`](prototype_v1/) and [`docs/ORIGINAL_DISCLOSURE.md`](docs/ORIGINAL_DISCLOSURE.md).

Version 2 corrects two issues:

1. A delta computed from the same target being reconstructed is tautological; v2 estimates transformations on calibration prompts and evaluates on unseen prompts.
2. For unit-normalized vectors, cosine distance and Euclidean distance are algebraically dependent; v2 reports interpretable components separately and retains the product only as the historical v1 index.

The correction is part of the provenance record rather than being hidden.

---

## Scientific and commercial status

Implemented:

- safe geometric measures;
- historical Marler Drift v1;
- mean-shift, affine ridge, and orthogonal translation operators;
- held-out evaluation;
- declared baselines;
- bootstrap uncertainty;
- shuffled-pair controls;
- deterministic synthetic demonstration;
- provenance verification;
- evidence grading;
- release-gate logic;
- production web build checks;
- live provider-comparison path when credentials are configured.

Not yet established as a general scientific fact:

- universal predictive advantage across all model families;
- universal stability across encoders and domains;
- exact future-response reconstruction;
- equivalence to any private model representation;
- universal migration-safety thresholds.

The strongest defensible product claim is:

> **Vector Tongue is an implemented black-box Model Change Assurance system for testing whether cross-model behavioral transformations generalize on held-out outputs, quantifying residual drift, and turning that evidence into an explicit release decision.**

---

## Repository map

```text
src/vector_tongue/       tested v2 research package
src/components/          production application surfaces
src/lib/                 model-change analysis and release logic
prototype_v1/            preserved historical prototype
tests/                   deterministic research tests
docs/                    methods, claims, buyer diligence, provenance
provenance/              machine-readable priority manifest
examples/                reproducible input examples
.github/workflows/        build, test, and truth-boundary CI
```

---

## Authorship, rights, and strategic inquiries

RJ Marler originated the Vector Tongue framework, Output-Only Analysis framing, terminology, and original prototype. Version 2 and the product implementation were developed with AI assistance under RJ Marler's direction.

- Authorship: [`AUTHORS.md`](AUTHORS.md)
- Citation: [`CITATION.cff`](CITATION.cff)
- Priority/provenance: [`docs/PRIORITY_AND_PROVENANCE.md`](docs/PRIORITY_AND_PROVENANCE.md)
- Claims boundary: [`docs/CLAIMS_AND_LIMITATIONS.md`](docs/CLAIMS_AND_LIMITATIONS.md)
- Security: [`SECURITY.md`](SECURITY.md)

Copyright © 2025–2026 RJ Marler. All rights reserved. See [`LICENSE`](LICENSE).

For enterprise licensing, strategic partnership, exclusive-rights discussions, or acquisition diligence: **rjmarler8@gmail.com**
