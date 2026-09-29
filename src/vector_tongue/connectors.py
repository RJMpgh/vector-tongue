"""Provider connector contracts for real calls and offline fixtures.

Connectors return observable response metadata and never expose credentials in the
returned object. Network execution is intentionally opt-in for application code.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Mapping, Optional, Protocol


@dataclass(frozen=True)
class ModelRequest:
    prompt_id: str
    prompt_text: str
    system_prompt_hash: Optional[str] = None
    temperature: Optional[float] = None
    max_tokens: Optional[int] = None


@dataclass(frozen=True)
class ModelResponse:
    provider: str
    model: str
    prompt_id: str
    text: str
    timestamp: str
    latency_ms: Optional[float] = None
    input_tokens: Optional[int] = None
    output_tokens: Optional[int] = None
    response_hash: Optional[str] = None
    metadata: Mapping[str, Any] = field(default_factory=dict)


class ModelConnector(Protocol):
    provider: str
    model: str

    def generate(self, request: ModelRequest) -> ModelResponse:
        """Execute one request without returning secrets."""


class FixtureConnector:
    """Offline connector for reproducible demos; evidence must be labeled SYNTHETIC."""

    provider = "fixture"

    def __init__(self, model: str, responses: Mapping[str, str]):
        self.model = model
        self._responses = dict(responses)

    def generate(self, request: ModelRequest) -> ModelResponse:
        if request.prompt_id not in self._responses:
            raise KeyError(f"fixture has no response for prompt_id={request.prompt_id}")
        import hashlib
        import time

        started = time.perf_counter()
        text = self._responses[request.prompt_id]
        elapsed = (time.perf_counter() - started) * 1000.0
        return ModelResponse(
            provider=self.provider,
            model=self.model,
            prompt_id=request.prompt_id,
            text=text,
            timestamp="FIXTURE_TIME_NOT_MEASURED",
            latency_ms=elapsed,
            response_hash=hashlib.sha256(text.encode("utf-8")).hexdigest(),
            metadata={"evidence_grade": "SYNTHETIC_DEMO"},
        )
