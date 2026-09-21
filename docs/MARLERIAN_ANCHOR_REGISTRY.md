# Marlerian Anchor Registry

The Marlerian Anchor Registry is an optional shared-reference layer for Vector Tongue. Pairwise translation asks how Model A maps to Model B; the registry adds declared, versioned reference anchors so multiple models can be calibrated against the same operational coordinates.

The current illustrative draft contains four anchors: evidential certainty, harm, meaningful agency, and burden transfer. Each anchor declares invariants, inclusions, exclusions, boundary cases, confounders, an ordered semantic path, and evaluation prompts.

Validate the bundled draft with:

```bash
vector-tongue validate-anchors anchors/marlerian-baseline-v0.1.json
```

The registry is deliberately contestable and versioned. It is a measurement contract, not a moral, legal, medical, or regulatory authority.
