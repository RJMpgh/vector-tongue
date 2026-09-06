"""Portable CSV and JSON I/O routines for paired vector experiments."""

import csv
import json
from pathlib import Path
from typing import Dict, Any, List
from .data import PairedExample, PairedDataset


def parse_embedding_string(val: str) -> List[float]:
    """Parse string representation of vector, e.g. '[0.1, 0.2, 0.3]' or '0.1, 0.2'."""
    val = val.strip()
    if val.startswith("[") and val.endswith("]"):
        parsed = json.loads(val)
        return [float(x) for x in parsed]
    # Fallback to comma-separated
    return [float(x.strip()) for x in val.split(",") if x.strip()]


def load_paired_csv(csv_path: str) -> PairedDataset:
    """Load PairedDataset from CSV containing prompt_id, category, source_embedding, target_embedding."""
    path = Path(csv_path)
    if not path.exists():
        raise FileNotFoundError(f"CSV file not found: {csv_path}")

    examples: List[PairedExample] = []
    with open(path, "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        required_cols = {"prompt_id", "category", "source_embedding", "target_embedding"}
        if not required_cols.issubset(set(reader.fieldnames or [])):
            raise ValueError(f"CSV must contain columns {required_cols}, found {reader.fieldnames}")

        for row_idx, row in enumerate(reader, start=1):
            try:
                src = parse_embedding_string(row["source_embedding"])
                tgt = parse_embedding_string(row["target_embedding"])
                ex = PairedExample(
                    prompt_id=row["prompt_id"].strip(),
                    category=row["category"].strip(),
                    source_embedding=src,
                    target_embedding=tgt,
                )
                examples.append(ex)
            except Exception as e:
                raise ValueError(f"Error parsing row {row_idx}: {e}")

    return PairedDataset(examples)


def save_results_json(results: Dict[str, Any], output_path: str) -> None:
    """Save results dictionary as formatted JSON, ensuring directory exists."""
    path = Path(output_path)
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(results, f, indent=2)
