# Claims and Limitations

| Level | Claim | Status |
|---|---|---|
| 1 | Known model outputs can be compared in a shared external embedding space | Implemented |
| 2 | Cross-model maps can be learned without target leakage | Implemented |
| 3 | Maps can be tested against declared baselines on held-out prompts | Implemented |
| 4 | A map predicts a real target model better than baselines | Not yet established |
| 5 | A map remains stable across time, topics, encoders, and providers | Not established |
| 6 | Exact target text can be reconstructed without querying the target | Not demonstrated |
| 7 | Output geometry reveals a proprietary model's internal latent language | Not inferable |

## Output-only means output-only

Vector Tongue observes prompts, outputs, public configuration metadata, and
representations created by an external encoder. It can measure stable behavioral
regularities without claiming privileged access to weights or activations.

## Encoder dependence

An external encoder determines which distinctions become geometrically visible.
A result may characterize the encoder as much as the compared models. Strong
evidence therefore requires replication across materially different encoders
and non-embedding outcome measures.

## Prompt and sampling dependence

Model identity is not the only source of variation. System prompts, sampling
parameters, provider-side changes, tool access, safety policies, and random
seeds can alter outputs. These must be fixed, randomized, or explicitly modeled.

## Drift is not automatically harm

Large semantic displacement can be beneficial, neutral, or harmful. Calling a
change “alignment drift,” “suppression,” or “bias” requires an external outcome
definition and evidence beyond geometric distance.

## Priority is separate from validity

A timestamp or blockchain record may help document that an artifact existed,
subject to verification. It does not prove that a scientific claim is correct,
novel over all prior work, patented, or legally enforceable.
