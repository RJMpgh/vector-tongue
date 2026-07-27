"""Command-line interface for reproducible Vector Tongue experiments."""

from __future__ import annotations

import argparse
import dataclasses
import json
from collections.abc import Sequence

from .demo import synthetic_translation_dataset
from .empirical import analyze_experiment
from .evaluation import evaluate_translator
from .experiment import ExperimentConfig, protocol_summary
from .io import load_embedding_pairs_csv, write_json
from .models import OrthogonalTranslator, RidgeTranslator
from .openai_runner import (
    collect_responses,
    embed_responses,
    submit_response_batches,
    sync_response_batches,
)
from .provenance import verify_manifest

DEFAULT_EXPERIMENT_CONFIG = "experiments/real_models/config-pilot-003.json"


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

    experiment = subcommands.add_parser(
        "experiment",
        help="validate or run the frozen real-model experiment",
    )
    experiment_commands = experiment.add_subparsers(dest="experiment_command", required=True)
    validate_experiment = experiment_commands.add_parser(
        "validate", help="validate the protocol without making API calls"
    )
    validate_experiment.add_argument("--config", default=DEFAULT_EXPERIMENT_CONFIG)

    collect = experiment_commands.add_parser("collect", help="collect resumable model responses")
    collect.add_argument("--config", default=DEFAULT_EXPERIMENT_CONFIG)
    collect.add_argument("--limit", type=int)
    collect.add_argument(
        "--acknowledge-api-cost",
        action="store_true",
        help="confirm that this stage makes billable API calls",
    )

    embed = experiment_commands.add_parser(
        "embed", help="embed every completed response with the frozen encoder"
    )
    embed.add_argument("--config", default=DEFAULT_EXPERIMENT_CONFIG)
    embed.add_argument("--batch-size", type=int, default=64)
    embed.add_argument(
        "--acknowledge-api-cost",
        action="store_true",
        help="confirm that this stage makes billable API calls",
    )

    analyze = experiment_commands.add_parser(
        "analyze", help="fit, evaluate, control, and generate RESULTS.md"
    )
    analyze.add_argument("--config", default=DEFAULT_EXPERIMENT_CONFIG)

    batch_submit = experiment_commands.add_parser(
        "batch-submit",
        help="submit incomplete responses through the asynchronous Batch API",
    )
    batch_submit.add_argument("--config", default=DEFAULT_EXPERIMENT_CONFIG)
    batch_submit.add_argument(
        "--acknowledge-api-cost",
        action="store_true",
        help="confirm that this stage submits billable API work",
    )

    batch_sync = experiment_commands.add_parser(
        "batch-sync",
        help="check Batch API status and import completed responses",
    )
    batch_sync.add_argument("--config", default=DEFAULT_EXPERIMENT_CONFIG)

    run = experiment_commands.add_parser(
        "run", help="collect, embed, analyze, and report the complete pilot"
    )
    run.add_argument("--config", default=DEFAULT_EXPERIMENT_CONFIG)
    run.add_argument("--batch-size", type=int, default=64)
    run.add_argument(
        "--acknowledge-api-cost",
        action="store_true",
        help="confirm that collection and embedding make billable API calls",
    )

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


def _require_cost_acknowledgement(args: argparse.Namespace) -> None:
    if not args.acknowledge_api_cost:
        raise SystemExit(
            "This stage makes billable OpenAI API calls. Review "
            "`vector-tongue experiment validate`, then rerun with "
            "--acknowledge-api-cost."
        )


def _reject_synchronous_batch_protocol(config_path: str) -> None:
    config = ExperimentConfig.load(config_path)
    if config.status == "preregistered_batch_pilot":
        raise SystemExit(
            "This preregistration requires one consistent Batch API collection "
            "mode. Use experiment batch-submit and batch-sync."
        )


def run_experiment_command(args: argparse.Namespace) -> int:
    if args.experiment_command == "validate":
        payload = dataclasses.asdict(protocol_summary(args.config))
    elif args.experiment_command == "collect":
        _require_cost_acknowledgement(args)
        _reject_synchronous_batch_protocol(args.config)
        payload = collect_responses(args.config, limit=args.limit)
    elif args.experiment_command == "embed":
        _require_cost_acknowledgement(args)
        payload = embed_responses(args.config, batch_size=args.batch_size)
    elif args.experiment_command == "analyze":
        payload = analyze_experiment(args.config)
    elif args.experiment_command == "batch-submit":
        _require_cost_acknowledgement(args)
        payload = submit_response_batches(args.config)
    elif args.experiment_command == "batch-sync":
        payload = sync_response_batches(args.config)
    elif args.experiment_command == "run":
        _require_cost_acknowledgement(args)
        _reject_synchronous_batch_protocol(args.config)
        payload = {
            "collection": collect_responses(args.config),
            "embedding": embed_responses(
                args.config,
                batch_size=args.batch_size,
            ),
            "analysis": analyze_experiment(args.config),
        }
    else:
        raise ValueError(f"unknown experiment command: {args.experiment_command}")
    print(json.dumps(payload, indent=2))
    return 0


def main(argv: Sequence[str] | None = None) -> int:
    parser = _parser()
    args = parser.parse_args(argv)
    if args.command == "demo":
        return run_demo(args.output, args.seed)
    if args.command == "evaluate":
        return run_evaluate(args)
    if args.command == "verify-proof":
        return run_verify_proof(args.manifest, args.artifact_root)
    if args.command == "experiment":
        return run_experiment_command(args)
    parser.error(f"unknown command: {args.command}")
    return 2


if __name__ == "__main__":
    raise SystemExit(main())
