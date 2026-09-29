# MEL — Model Esperanto Layer

MEL is an experimental, output-only interchange layer for testing whether different language models can preserve the same semantic state through a canonical representation.

It is not a claim that models already possess a shared hidden language. It is a protocol that makes that broader idea falsifiable.

## Core hypothesis

If a model converts a task into MEL, another model reads the MEL packet, and the task survives with less semantic loss than an ordinary natural-language handoff, MEL is useful.

The basic experiment is:

```text
input
  -> Model A
  -> MEL_0
  -> Model B
  -> MEL_1
  -> Model C ...
```

Measure semantic loss after every hop. Compare the MEL route with a direct natural-language route using the same prompts and model order.

## v0.1 semantic packet

A MEL packet separates:

- goal
- semantic atoms
- constraints
- provenance
- epistemic status
- optional confidence

Atoms use a small vocabulary of kinds such as CLAIM, RELATION, ACTION, EVIDENCE, UNCERTAINTY, TOOL, RESULT, and PROVENANCE.

For directional relations, v0.1 defines canonical predicates including CAUSES, ENABLES, PREVENTS, BEFORE, AFTER, DEPENDS_ON, IMPLIES, and CONTRADICTS.

Example:

```json
{
  "mel_version": "0.1",
  "goal": "explain",
  "atoms": [
    {
      "kind": "RELATION",
      "predicate": "CAUSES",
      "arguments": ["heavy rainfall", "river level increase"],
      "confidence": 0.76,
      "epistemic_status": "inferred"
    }
  ],
  "constraints": ["avoid jargon"],
  "provenance": ["weather-observation-001"]
}
```

## Canonicalization

The Python implementation normalizes whitespace, uppercases kinds and predicates, lowercases epistemic status, sorts atoms by a canonical key, and sorts/deduplicates constraints and provenance.

This means equivalent packet orderings serialize identically.

## Semantic loss

v0.1 reports:

- atom precision
- atom recall
- atom F1
- goal preservation
- constraint Jaccard similarity
- confidence MAE when both packets actually provide confidence
- one protocol-level semantic-loss score

The semantic-loss weights are explicit protocol choices, not learned scientific constants:

```text
70% atom preservation
20% goal preservation
10% constraint preservation
```

Confidence error is reported separately and is not silently folded into the score.

## Falsification test

MEL fails its central claim if, across preregistered model chains and prompt families, MEL-mediated handoffs do not preserve task meaning better than direct natural-language handoffs.

A proper experiment should freeze:

1. prompt set
2. model versions
3. model order
4. encoding instructions
5. decoding instructions
6. primary loss metric
7. human/eval adjudication protocol

before running the comparison.

## Adapter contract for an LLM

To encode natural language into MEL, instruct the model to return only one JSON object conforming to `schemas/mel-v0.1.schema.json`.

Rules:

- Do not invent facts absent from the source.
- Mark inference as `inferred`.
- Mark assumptions as `assumed`.
- Use `unknown` when the source leaves something unresolved.
- Omit confidence unless the model actually has a basis for expressing one.
- Preserve constraints literally when possible.
- Preserve source identifiers in provenance.

To decode MEL back into natural language:

- Render the packet for the requested audience.
- Do not strengthen epistemic status.
- Do not add claims not represented in the packet.
- Preserve constraints.

## Relationship to Vector Tongue

Vector Tongue measures cross-model behavioral translation from outputs.

MEL supplies an explicit candidate intermediate representation.

That gives a direct experiment:

```text
direct handoff loss
vs
MEL-mediated handoff loss
vs
Vector Tongue embedding drift
```

If MEL reduces semantic loss while Vector Tongue independently observes lower drift, the two systems provide convergent evidence. If they disagree, that disagreement is itself measurable and should be investigated rather than hidden.

## Current status

Implemented:

- canonical MEL v0.1 packet
- validation
- canonical serialization
- structural semantic-loss comparison
- JSON Schema
- deterministic unit tests

Not yet established:

- superiority over natural-language handoffs
- stability across providers
- correspondence with internal model representations
- optimal vocabulary
- optimal scoring weights
