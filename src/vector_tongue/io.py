"""CSV and JSONL ingestion for precomputed shared-space embeddings."""

from __future__ import annotations

import csv
import json
import pathlib
from collections.abc import Iterable
from typing import Any

from .data import EmbeddingPair, PairDataset


def load_embedding_pairs_csv(path: str | pathlib.Path) -> PairDataset:
    pairs: list[EmbeddingPair] = []
    with pathlib.Path(path).open("r", encoding="utf-8", newline="") as handle:
        reader = csv.DictReader(handle)
        required = {"prompt_id", "source_embedding", "target_embedding"}
        missing = required.difference(reader.fieldnames or ())
        if missing:
            raise ValueError(f"CSV is missing columns: {', '.join(sorted(missing))}")
        for row in reader:
            pairs.append(
                EmbeddingPair.create(
                    prompt_id=row["prompt_id"],
                    source=json.loads(row["source_embedding"]),
                    target=json.loads(row["target_embedding"]),
                    category=row.get("category") or "unspecified",
                )
            )
    return PairDataset.from_pairs(pairs)


def write_json(path: str | pathlib.Path, payload: Any) -> None:
    destination = pathlib.Path(path)
    destination.parent.mkdir(parents=True, exist_ok=True)
    destination.write_text(
        json.dumps(payload, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
    )


def write_jsonl(path: str | pathlib.Path, rows: Iterable[dict[str, Any]]) -> None:
    destination = pathlib.Path(path)
    destination.parent.mkdir(parents=True, exist_ok=True)
    with destination.open("w", encoding="utf-8") as handle:
        for row in rows:
            handle.write(json.dumps(row, sort_keys=True) + "\n")
