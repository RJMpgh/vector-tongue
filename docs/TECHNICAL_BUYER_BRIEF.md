# Technical Buyer Brief

## Why this exists

Production teams change model providers, model versions, prompts, and routing policies. Existing tracing tells them what happened to a request; it does not by itself qualify a replacement as a software release.

Vector Tongue is a black-box assurance layer for the narrower question: what observable behavior changed between a source and target model, on a frozen prompt suite, and is the measured evidence sufficient for a release decision?

## What is implemented

- held-out cross-model embedding translation with declared baselines and negative controls;
- MEL v0.1 validation, canonicalization, semantic-atom comparison, and policy checks;
- a migration-audit input contract with per-prompt hashes, output observations, declared constraint checks, and optional fixed-encoder embedding MSE;
- explicit PASS, REVIEW, FAIL, and INSUFFICIENT_DATA gate states;
- offline fixture connectors and a reproducible CLI path;
- provenance and limitations documentation.

## What generic observability does not replace

This is not a claim that Vector Tongue replaces tracing, evaluation, red-teaming, or policy enforcement. Its wedge is release qualification across model changes: preserve the prompt suite, compare source and target evidence, expose affected prompts, and record why a gate did or did not pass.

## Evidence currently available

The repository contains deterministic synthetic demonstrations and unit tests. Those prove implementation behavior only. They are not customer evidence, live-provider benchmarks, or evidence of MEL superiority.

## Evidence still missing

- replicated live-provider runs across multiple provider/model pairs;
- representative customer prompt suites and longitudinal baselines;
- independent external-encoder replication;
- held-out MEL-versus-natural-language results with blinded or independently adjudicated evaluators;
- correlation analysis between MEL semantic loss and independently measured Vector Tongue drift;
- agent-trajectory and prompt-injection experiments under a preregistered protocol;
- operational evidence from pilots, deployment, reliability, and buyer willingness to pay.

Every missing result is intentionally NOT_MEASURED until supplied.

## Pilot shape

A customer can export a de-identified prompt suite, freeze source/target settings, run both models through approved connectors, review per-family changes, and decide whether to ship, review, or hold. The first integration can be batch-based; persistent storage and CI gating can follow after the measurement contract is accepted.

## Potential long-term defensibility

Longitudinal, permissioned behavioral baselines and model-pair histories could become difficult to replicate if they accumulate across customers and model changes. That is a hypothesis about data/network effects, not a moat claim.
