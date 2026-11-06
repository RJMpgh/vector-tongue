# MEL Assurance v0.1 — Ground-truth-led model handoff integrity

**Status:** experimental, runnable, output-only evaluation. **Not** a universal LLM semantic oracle, prompt-injection firewall, or verified live-provider advantage.

## Developer-facing problem

Models can hand off perfectly schema-conformant payloads that nonetheless corrupt a task. Examples: CAUSES(A,B) reverses to CAUSES(B,A); "unknown" becomes "known"; a "never send email" constraint disappears; a made-up source identifier substitutes for a recorded source. Plain string matching also penalizes legitimate paraphrases.

**Vector Tongue / OOA / MEL roles:** MEL defines the explicit interchange packet. OOA specifies that we measure observable behaviors, not hidden activations. VT embedding drift is a separate potential diagnostic, not an independent truth label unless its external encoder and validation are controlled.

## Run

```bash
python -m vector_tongue.mel_assurance examples/mel_assurance_demo.json \
  --seed 42 --resamples 2000 --output assurance-report.json
python -m unittest discover -s tests -v
```

A convenience command may also be exposed as `vector-tongue mel-assurance`. The bundled examples are **SYNTHETIC_DEMO** only. They include an explicit MEL regression and a case where both routes fail, so do not use the demo score to claim efficacy.

## Contract and measurements

- Strict packet validation: malformed/missing/extra keys, illegal confidence, duplicates, invalid relation predicates are rejected. Duplicate JSON keys are rejected by the loader.
- Argument-level aliases allow only manually reviewed, **frozen** whole-argument equivalences; they are not automatic entailment. Review labels are unauthenticated strings, not proof of actual independent review.
- Atom match preserves predicate, argument order and epistemic status; flags certainty changes and novel "known" assertions relative to the supplied reference.
- Constraint F1, provenance F1, atom source recall and goal preservation are **separate** measurements. The comparator reports unexpected TOOL/ACTION atoms but does not execute them.
- Source identifiers and the ground-truth reference are treated as input data, **not authenticated evidence**. Source equality is not source authenticity.
- The declared **protocol loss** is a tunable engineering convention:

```text
L = 1 - (0.55*atom_F1 + 0.15*constraint_F1
         + 0.10*goal_match + 0.10*provenance_F1
         + 0.10*atom_source_recall)
```

It is **not** a universal semantic distance. Also report component metrics, exact anchor match and a confidence MAE only when both packets include measured confidence. "Exact handoff" means equality against the provided reference, not that the underlying claim is true.

For two routes, compute a **paired** improvement for every `case_id`: `protocol_loss(direct) - protocol_loss(mel)`. Resample whole cases (never individual atoms), and report paired percentile bootstrap 95% intervals, per-family outcomes, and any MEL regressions. A synthetic run must report `model_capability_advantage: NOT_MEASURED`.

## Research motivation and adversarial controls

| Published result | MEL Assurance response | Still unresolved |
| --- | --- | --- |
| Schaeffer, Miranda and Koyejo, *Are Emergent Abilities of Large Language Models a Mirage?* (NeurIPS 2023), https://arxiv.org/abs/2304.15004 | Expose continuous component metrics alongside strict exact matching | No universal equivalence measure |
| OpenAI, *Why Language Models Hallucinate* (2025), https://openai.com/index/why-language-models-hallucinate/ | Detect unknown/inferred -> known promotions relative to reference | Does not prevent hallucinations |
| Debenedetti et al., *AgentDojo* (NeurIPS 2024), https://arxiv.org/abs/2406.13352 | Report injected/unexpected tool/action atoms and provenance changes | No arbitrary agent security guarantee |
| Shi et al., *Judging the Judges* (IJCNLP 2025), https://aclanthology.org/2025.ijcnlp-long.18/ | Use externally frozen anchors instead of relying entirely on an LLM grading itself | Humans and extracted direct-route outputs can introduce bias |

MCP provides tool context (https://modelcontextprotocol.io/specification/2025-11-25); A2A addresses agent interactions (https://a2a-protocol.org/v1.0.0/). MEL Assurance is intended to verify **handoff content**, not replace either wire protocol.

## Preregistered live falsification protocol

1. Freeze task family, reference packets, independently adjudicated aliases, metrics, model/provider versions, model order, context budgets, decoding parameters and sampling seeds **before candidate generation**.
2. Blind ground-truth reviewers to the MEL vs direct route; preserve adjudication disagreements and at least one independent re-review.
3. Sample held-out tasks **by task/source family**, not by individual paraphrase; avoid adjusting aliases, scorer weights or prompts using hidden test outcomes.
4. Obtain paired natural-language and MEL handoffs with identical retrieval access and downstream model; log every raw output, tool request, source ID, provider version, token usage, latency and retry.
5. To score natural-language handoffs, either independently validate NL-to-MEL extraction with manual audits or assess route outcomes in a shared task-specific environment; **report extraction bias separately**.
6. Repeat across providers and stochastic seeds, preserving case-level dependencies during resampling. Include negative controls for reversed relations, false certainty, missing constraints, fabricated sources, hidden extra actions, schema-valid injection text, and deliberately wrong reference packets.
7. Falsify MEL's advantage when the preregistered paired effect fails its criterion, when security regressions rise, or when cost/latency overwhelms benefit.

## Honest status

**Implemented:** strict evaluator, reviewed-alias interface, component-wise anchor retention, paired bootstrap, deterministic adversarial unit tests, synthetic benchmark and CLI.

**NOT_MEASURED:** superiority in production; live provider accuracy; universal model interoperability; semantic entailment beyond explicitly reviewed aliases; internal latent state; real prompt-injection prevention; independent authentication of provenance; token/latency ROI.

The defensible promise to modern LLM developers is a *testable, observable semantic regression diagnostic across handoffs*. Any claim that MEL already solves frontier model hallucinations or aligns model internals would be false.
