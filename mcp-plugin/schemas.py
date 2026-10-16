"""Illustrative CRM contract; replace with the actual provider's documented bounds."""
from typing import Literal
from pydantic import BaseModel, ConfigDict, Field, ValidationError

class CRMUpdate(BaseModel):
    model_config = ConfigDict(strict=True, extra='forbid', hide_input_in_errors=True)
    customer_id: str = Field(min_length=1, max_length=128, pattern=r'^\S+$')
    status: Literal['active', 'inactive', 'pending']
    discount_tier: int = Field(ge=0, le=3)

SCHEMAS = {('crm', 'crm_update'): CRMUpdate}

def validate_payload(service, action, payload):
    schema = SCHEMAS.get((service, action))
    if schema is None:
        return False
    try:
        schema.model_validate(payload, strict=True)
    except ValidationError:
        return False
    return True

class GitHubGetIssue(BaseModel):
    model_config = ConfigDict(strict=True, extra='forbid', hide_input_in_errors=True)
    owner: str = Field(min_length=1, max_length=39, pattern=r'^[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?$')
    repo: str = Field(min_length=1, max_length=100, pattern=r'^[A-Za-z0-9_.-]+$')
    issue_number: int = Field(ge=1, le=2147483647)

SCHEMAS[('github', 'get_issue')] = GitHubGetIssue
