"""Command-line interface for reproducible Vector Tongue experiments."""

from __future__ import annotations

import argparse
import dataclasses
import json
from collections.abc import Sequence

from .demo import synthetic_translation_dataset
from .evaluation import evaluate_translator
from .io import load_embedding_pairs_csv, write_json
from .models import OrthogonalTranslator, RidgeTranslator
from .provenance import verify_manifest


def _parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="vector-tongue",
        description="Held-out cross-model translation and output drift analysis.",
    )
    subcommands = parser.add_subparsers(dest="command", required=True)

    demo = subcommands.add_parser("demo", help="run a deterministic synthetic demonstration")
    demo.add_argument("--output", default="results/demo-report.json")
    demo.add_argument("--seed", type=int, default=17)

    evaluate = subcommands.add_parser("evaluate", help="evaluate paired embeddings from CSV")
    evaluate.add_argument("csv")
    evaluate.add_argument("--model", choices=("ridge", "orthogonal"), default="ridge")
    evaluate.add_argument("--regularization", type=float, default=1.0)
    evaluate.add_argument("--test-fraction", type=float, default=0.25)
    evaluate.add_argument("--seed", type=int, default=17)
    evaluate.add_argument("--output", default="results/evaluation.json")

    proof = subcommands.add_parser(
        "verify-proof",
        help="validate provenance fields and recompute hashes for available local artifacts",
    )
    proof.add_argument("manifest")
    proof.add_argument("--artifact-root")

    return parser


def run_demo(output: str, seed: int) -> int:
    dataset = synthetic_translation_dataset(seed=seed)
    train, test = dataset.split(seed=seed)
    report = evaluate_translator(RidgeTranslator(regularization=0.1), train, test, seed=seed)
    payload = {
        "demonstration": True,
        "warning": "Synthetic data validates the pipeline; it is not empirical model evidence.",
        "report": report.to_dict(),
    }
    write_json(output, payload)
    print(json.dumps(payload, indent=2))
    return 0


def run_evaluate(args: argparse.Namespace) -> int:
    dataset = load_embedding_pairs_csv(args.csv)
    train, test = dataset.split(test_fraction=args.test_fraction, seed=args.seed)
    model = (
        RidgeTranslator(regularization=args.regularization)
        if args.model == "ridge"
        else OrthogonalTranslator()
    )
    report = evaluate_translator(model, train, test, seed=args.seed)
    write_json(args.output, report.to_dict())
    print(json.dumps(report.to_dict(), indent=2))
    return 0


def run_verify_proof(manifest: str, artifact_root: str | None) -> int:
    check = verify_manifest(manifest, artifact_root=artifact_root)
    payload = dataclasses.asdict(check)
    payload["all_local_hashes_match"] = check.all_local_hashes_match
    print(json.dumps(payload, indent=2))
    statuses = {artifact.status for artifact in check.artifacts}
    return 1 if {"mismatch", "invalid_hash"}.intersection(statuses) else 0


def main(argv: Sequence[str] | None = None) -> int:
    parser = _parser()
    args = parser.parse_args(argv)
    if args.command == "demo":
        return run_demo(args.output, args.seed)
    if args.command == "evaluate":
        return run_evaluate(args)
    if args.command == "verify-proof":
        return run_verify_proof(args.manifest, args.artifact_root)
    parser.error(f"unknown command: {args.command}")
    return 2


if __name__ == "__main__":
    raise SystemExit(main())
