# Public Disclosure: Model Esperanto Layer (MEL)

**Author:** RJ Marler  
**Disclosure date:** September 29, 2026  
**Repository:** RJMpgh/vector-tongue  
**Status:** Experimental specification and falsifiable research proposal

## Origin

MEL extends the Vector Tongue research line from a simple output-only question:

> Can one AI infer which AI produced a given output?

That question leads naturally to model attribution and behavioral fingerprints. The next questions are whether those behavioral differences can be represented, whether systematic relationships between models can be measured, and whether models can communicate through a common intermediate representation rather than relying entirely on unconstrained natural language.

MEL is the proposed common intermediate representation.

## Core proposal

A language-model handoff is represented as:

```text
Model A -> MEL packet -> Model B
```

rather than only:

```text
Model A -> free-form natural language -> Model B
```

A MEL packet separates:

- goal
- semantic atoms
- relations/actions
- constraints
- evidence
- provenance
- epistemic state (known, inferred, assumed, unknown)
- optional confidence

The intended object is not a sentence. It is an explicit semantic state that can be validated, logged, compared, and passed between different model families.

## Falsifiable hypothesis

MEL is useful only if, under matched experiments, MEL-mediated model-to-model handoffs preserve task-relevant semantic state better than direct natural-language handoffs.

For an initial packet (M_0) and a packet after one or more model hops (M_n), define a measured translation loss:

```text
L_translation = D(M_0, M_n)
```

where (D) is an explicitly declared comparison protocol.

The current v0.1 implementation reports atom precision/recall/F1, goal preservation, constraint preservation, confidence error when confidence is actually present, and a transparent protocol-level semantic-loss score.

A stronger future evaluation should compare MEL loss with independent Vector Tongue embedding drift and with human/evaluator judgments.

## Proposed applications

### Automated multi-agent systems

Planning, coding, retrieval, execution, and review agents can exchange canonical state packets instead of repeatedly reconstructing goals and constraints from prose.

Testable outcomes include lower constraint loss, fewer invented parameters, and lower semantic drift across multi-agent chains.

### Auditable compliance and safety

Persisted MEL packets can expose what semantic payload was passed at a decision boundary: goal, assumptions, constraints, evidence, provenance, and declared tool intent.

MEL does not reveal hidden model activations or independently prove why an action occurred. Auditability depends on persisting MEL packets alongside actual tool/action logs.

### Cross-model benchmarking, fine-tuning, and distillation

The same source task can be encoded by different providers or model versions, then compared as explicit semantic states.

This provides an output-only way to test whether model replacement, fine-tuning, distillation, or migration preserves meaning across held-out tasks.

### Prompt-injection attack-surface reduction

Rigid schema validation can reject malformed messages, unknown fields, and unauthorized action/tool requests before downstream execution. This may reduce some ambiguity-driven and surface-text prompt-injection paths.

This is not a claim that MEL eliminates prompt injection. Valid structured fields can still contain adversarial semantics. Safe deployment therefore requires independent authorization, tool allowlists, least privilege, provenance checks, and policy enforcement.

The security hypothesis is itself testable by comparing matched attack-success rates between direct natural-language handoffs and validated MEL handoffs.

## Relationship to Vector Tongue

Vector Tongue asks whether systematic behavioral translation exists between black-box model outputs.

MEL asks whether an explicit, canonical intermediate representation can reduce translation loss between those models.

Together they permit three independent measurements:

```text
1. direct natural-language handoff loss
2. MEL-mediated semantic loss
3. Vector Tongue embedding-space drift
```

Agreement between independent measures would be stronger evidence than any single metric. Disagreement is also informative and should remain visible.

## Scientific boundary

This disclosure does **not** claim:

- that LLMs secretly use MEL internally;
- that MEL is already superior to natural language;
- that the v0.1 vocabulary is optimal;
- that structural semantic loss is equivalent to human judgment;
- that MEL prevents all prompt injection;
- or that cross-model semantic invariance has already been demonstrated.

Those are empirical questions.

The claim disclosed here is the architecture and experimental program: a canonical, output-only semantic interchange layer for measurable cross-model communication, provenance-preserving multi-agent handoffs, and falsifiable comparison against ordinary natural-language communication.
