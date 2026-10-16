"""Public MCP result contract; semantic results never confer permission."""
from typing import Literal
from pydantic import BaseModel, ConfigDict, Field

class AuditResult(BaseModel):
    model_config = ConfigDict(extra='forbid')
    status: Literal['NOT_MEASURED', 'INVALID_INPUT', 'INPUT_TOO_LARGE', 'FAIL_SCHEMA',
                    'UNCALIBRATED', 'REVIEW_REQUIRED', 'BELOW_EXPERIMENTAL_THRESHOLD']
    g: float | None = Field(default=None, ge=0, le=4, allow_inf_nan=False)
    model: str
    metric: Literal['squared_unit_euclidean_v1']
    threshold: float | None = Field(default=None, ge=0, le=4, allow_inf_nan=False)
    intent_provenance: Literal['MODEL_SUPPLIED_UNVERIFIED']
    execution: Literal['DISABLED']
    savings: Literal['NOT_MEASURED']
    schema_status: Literal['NOT_VALIDATED', 'VALID', 'INVALID_OR_UNSUPPORTED']
    reason: str | None = None
