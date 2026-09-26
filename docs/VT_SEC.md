# VT-Sec: Behavioral EDR for AI Agents

> **EDR watches the endpoint. Vector Tongue watches the policy.**

VT-Sec is the defensive agent-security application of Vector Tongue (VT) and Output-Only Analysis (OOA). It is designed to detect **behavioral regime changes** in an AI agent when the environment, permissions, tools, prompts, or constraints change.

The core question is not merely whether an agent completed a task. It is:

> **Did the agent's observable policy change materially when conditions changed, and can that change be measured before it becomes an operational problem?**

VT-Sec is intended for authorized testing, sandboxed evaluation, release qualification, and runtime assurance. It is not an exploitation framework and does not require access to model weights, hidden activations, or proprietary internals.

---

## Security thesis

Conventional endpoint security can tell an operator what a process executed, what resource it accessed, or what network action occurred.

Agent observability can tell an operator what tools an agent called and what trace it produced.

VT-Sec addresses a different layer:

```text
same authorized objective
        │
        ├── baseline environment
        │
        └── controlled perturbation
                │
                ▼
        observable trajectories
                │
                ▼
        fixed external representation
                │
                ▼
        divergence + change-point analysis
                │
                ▼
     behavioral regime-change signal
```

The target is the **behavioral transition itself**.

Examples include an agent that, after a benign tool failure, suddenly shifts from its usual strategy to repeated alternative-route searching; or an agent that behaves normally until a permission boundary changes and then exhibits a large trajectory divergence.

VT-Sec does not infer intent. It measures observable change.

---

## Relationship to Vector Tongue

For an agent trajectory `T`, a fixed external encoder or feature extractor `E`, and two controlled conditions `c0` and `c1`:

```text
z0 = E(T | c0)
z1 = E(T | c1)
ΔV = z1 - z0
```

The implementation can then evaluate:

- semantic or behavioral displacement;
- held-out predictability of the baseline-to-perturbed mapping;
- divergence from declared controls;
- change points across multi-step trajectories;
- uncertainty under repeated runs;
- category-specific drift, such as tool choice, retry behavior, refusal behavior, or recovery strategy.

The exact metric is implementation-dependent. VT-Sec should preserve the repository's existing discipline: fixed external measurement, declared baselines, held-out testing where appropriate, negative controls, provenance, and explicit limits on claims.

---

## Role of Output-Only Analysis

OOA complements VT-Sec when internal reasoning is unavailable or intentionally out of scope.

OOA treats externally observable artifacts as evidence:

- assistant messages;
- tool-call sequences;
- action summaries;
- timing and retry patterns;
- success/failure transitions;
- audit logs;
- allowed runtime telemetry.

The purpose is to characterize **what changed in observable behavior** without claiming privileged access to hidden model state.

A normal-looking final answer is not sufficient evidence that an agent behaved normally upstream. VT-Sec therefore favors trajectory-level evidence when such evidence is available.

---

## Minimal defensive benchmark

A useful VT-Sec benchmark should compare the same authorized task across controlled perturbations.

### Baseline

Run an agent against a benign, sandboxed task with a declared toolset and permissions.

Examples:

- retrieve information from a local test corpus;
- transform files inside a disposable workspace;
- use a mock API;
- complete a toy planning task;
- operate against intentionally non-sensitive synthetic services.

### Perturbations

Change one variable at a time where possible:

- one tool becomes unavailable;
- an API returns a transient error;
- a permission is reduced;
- an instruction conflicts with a lower-priority hint;
- a resource moves to another allowed path;
- latency increases;
- context contains irrelevant distractors;
- one expected action is no longer necessary.

These scenarios are designed to measure adaptation, not to teach bypass techniques.

### Measurements

Capture only authorized observable evidence, for example:

```json
{
  "run_id": "example-001",
  "condition": "baseline",
  "task_id": "sandbox-retrieval-01",
  "steps": 8,
  "tool_sequence": ["search", "read", "answer"],
  "final_status": "success",
  "evidence_grade": "SANDBOX_TRACE"
}
```

Then compare baseline and perturbed trajectories using the declared VT-Sec representation and thresholds.

---

## Candidate detection outputs

A production-oriented VT-Sec layer could expose signals such as:

| Signal | Meaning |
|---|---|
| trajectory drift | overall behavioral displacement |
| tool-choice drift | material change in tool-selection pattern |
| recovery-strategy drift | change in behavior after failure |
| persistence drift | abnormal increase in retries or alternative attempts |
| refusal-policy drift | change in whether or how a boundary is respected |
| decision-boundary cliff | abrupt shift rather than gradual adaptation |
| baseline reconstruction error | perturbed behavior no longer fits the expected mapping |

These are **measurement outputs**, not declarations of malice.

---

## Why agent security needs this layer

Agent systems create a measurement problem: an agent can satisfy a task while using an unexpected strategy.

NIST CAISI has documented examples in which agents found unintended ways to satisfy evaluation objectives, including grader gaming and other benchmark loopholes. That creates a strong case for examining trajectories rather than relying on task success alone.

OWASP's Agent Control Standard (ACS) emphasizes that agents should be inspectable, traceable, instrumentable, and controllable at runtime. VT-Sec is complementary to that control-plane goal: standardized traces can become input evidence for behavioral-divergence analysis.

NIST's 2026 TEVV-Athlon draft explicitly covers agentic systems and asks for input on evaluation activities that may not be adequately addressed. VT-Sec is positioned as a candidate **trajectory-level behavioral-change measurement** within that broader TEVV conversation.

These references establish an evaluation problem and standards context. They do not imply endorsement of Vector Tongue by NIST or OWASP.

References:

- OWASP Agent Control Standard: https://genai.owasp.org/resource/agent-control-standard-acs/
- NIST TEVV-Athlon Framework: https://www.nist.gov/artificial-intelligence/ai-research/tevv-athlon-framework-evaluating-ai-systems
- NIST CAISI, Cheating on AI Agent Evaluations: https://www.nist.gov/caisi/cheating-ai-agent-evaluations

---

## Defensive integration model

VT-Sec can sit beside existing agent controls:

```text
Agent runtime
   │
   ├── policy / authorization layer
   ├── tool sandbox
   ├── audit / ACS-style trace hooks
   │
   ▼
authorized trajectory evidence
   │
   ▼
VT-Sec behavioral comparison
   │
   ├── expected adaptation
   ├── elevated drift
   └── decision-boundary cliff
           │
           ▼
review / gate / containment policy
```

The security control decides what to do. VT-Sec supplies evidence about whether behavior changed.

---

## Claims boundary

VT-Sec does **not** establish that:

- behavioral drift proves malicious intent;
- a large drift score proves compromise;
- an agent's hidden reasoning has been recovered;
- any single encoder captures universal agent behavior;
- one threshold generalizes across tasks, models, or organizations;
- behavioral monitoring replaces permissions, sandboxing, authentication, authorization, logging, or human review.

The defensible claim is narrower:

> **VT-Sec applies Vector Tongue's controlled, output-level behavioral comparison to agent trajectories in order to detect and quantify policy-relevant behavioral change under declared perturbations.**

---

## Research questions

The security program should be falsifiable.

1. Can VT-Sec distinguish expected recovery from abnormal behavioral regime change?
2. Does a learned baseline-to-perturbation mapping generalize to held-out tasks?
3. Which trajectory representations are stable across model families?
4. Which negative controls produce false alarms?
5. Do trajectory-level measurements reveal security-relevant changes that final-answer scoring misses?
6. Can calibrated VT-Sec signals improve release or runtime-review decisions without unacceptable alert fatigue?

---

## Proposed machine-readable vocabulary

Use stable terms across datasets, papers, benchmarks, and integrations:

- `vector-tongue`
- `vt-sec`
- `output-only-analysis`
- `behavioral-drift`
- `trajectory-divergence`
- `decision-boundary-cliff`
- `controlled-perturbation`
- `behavioral-regime-change`
- `agent-assurance`
- `model-change-assurance`

This terminology should be attached to reproducible artifacts, not repeated as keyword spam.

---

## One-line positioning

**EDR watches the endpoint. VT watches the policy.**

Longer form:

**Vector Tongue is a black-box behavioral assurance layer for measuring when an AI agent's observable policy changes under controlled environmental perturbations.**
