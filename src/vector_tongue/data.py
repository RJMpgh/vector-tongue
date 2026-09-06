"""Data structures, validation, and prompt-grouped splitting for paired embeddings."""

from dataclasses import dataclass, field
import math
import random
from typing import List, Dict, Any, Tuple, Optional


@dataclass
class PairedExample:
    prompt_id: str
    category: str
    source_embedding: List[float]
    target_embedding: List[float]
    metadata: Dict[str, Any] = field(default_factory=dict)

    def validate(self, expected_source_dim: Optional[int] = None, expected_target_dim: Optional[int] = None) -> None:
        if not self.prompt_id or not isinstance(self.prompt_id, str):
            raise ValueError(f"Invalid prompt_id: {self.prompt_id}")
        
        # Check source embedding
        if not self.source_embedding:
            raise ValueError(f"Empty source embedding for prompt {self.prompt_id}")
        if expected_source_dim is not None and len(self.source_embedding) != expected_source_dim:
            raise ValueError(
                f"Source dimension mismatch for {self.prompt_id}: expected {expected_source_dim}, got {len(self.source_embedding)}"
            )
        for i, val in enumerate(self.source_embedding):
            if not isinstance(val, (int, float)) or not math.isfinite(val):
                raise ValueError(f"Non-finite source embedding value at index {i} for {self.prompt_id}: {val}")

        # Check target embedding
        if not self.target_embedding:
            raise ValueError(f"Empty target embedding for prompt {self.prompt_id}")
        if expected_target_dim is not None and len(self.target_embedding) != expected_target_dim:
            raise ValueError(
                f"Target dimension mismatch for {self.prompt_id}: expected {expected_target_dim}, got {len(self.target_embedding)}"
            )
        for i, val in enumerate(self.target_embedding):
            if not isinstance(val, (int, float)) or not math.isfinite(val):
                raise ValueError(f"Non-finite target embedding value at index {i} for {self.prompt_id}: {val}")


class PairedDataset:
    def __init__(self, examples: List[PairedExample]):
        if not examples:
            raise ValueError("Cannot initialize empty PairedDataset")
        self.examples = examples
        self.source_dim = len(examples[0].source_embedding)
        self.target_dim = len(examples[0].target_embedding)
        self._validate_all()

    def _validate_all(self) -> None:
        for ex in self.examples:
            ex.validate(self.source_dim, self.target_dim)

    def __len__(self) -> int:
        return len(self.examples)

    def __iter__(self):
        return iter(self.examples)

    def __getitem__(self, index: int) -> PairedExample:
        return self.examples[index]

    @property
    def source_matrix(self) -> List[List[float]]:
        return [ex.source_embedding for ex in self.examples]

    @property
    def target_matrix(self) -> List[List[float]]:
        return [ex.target_embedding for ex in self.examples]

    @property
    def prompt_ids(self) -> List[str]:
        return [ex.prompt_id for ex in self.examples]

    @property
    def categories(self) -> List[str]:
        return [ex.category for ex in self.examples]


def split_dataset(
    dataset: PairedDataset,
    test_fraction: float = 0.25,
    seed: int = 42,
) -> Tuple[PairedDataset, PairedDataset]:
    """Split dataset at the unique prompt level to guarantee no prompt leakage across splits."""
    if not 0.0 < test_fraction < 1.0:
        raise ValueError(f"test_fraction must be strictly between 0 and 1, got {test_fraction}")

    unique_prompts = sorted(list(set(dataset.prompt_ids)))
    if len(unique_prompts) < 2:
        raise ValueError("Cannot split dataset with fewer than 2 distinct prompt_ids")

    rng = random.Random(seed)
    shuffled_prompts = list(unique_prompts)
    rng.shuffle(shuffled_prompts)

    num_test = max(1, int(round(len(shuffled_prompts) * test_fraction)))
    if num_test >= len(shuffled_prompts):
        num_test = len(shuffled_prompts) - 1

    test_prompt_set = set(shuffled_prompts[:num_test])

    train_examples = [ex for ex in dataset if ex.prompt_id not in test_prompt_set]
    test_examples = [ex for ex in dataset if ex.prompt_id in test_prompt_set]

    return PairedDataset(train_examples), PairedDataset(test_examples)
