"""Command-line interface for Vector Tongue: demo, evaluate, and verify-proof."""

import argparse
import json
import random
import sys
from typing import List, Optional

from .data import PairedExample, PairedDataset, split_dataset
from .models import AffineRidgeTranslator, OrthogonalTranslator, MeanShiftBaseline
from .evaluation import evaluate_experiment
from .statistics import bootstrap_confidence_interval, permutation_control
from .provenance import verify_manifest
from .io import load_paired_csv, save_results_json
from .anchors import load_anchor_registry


def generate_synthetic_data(num_prompts: int = 40, dim: int = 8, seed: int = 42) -> PairedDataset:
    """Generate synthetic paired embeddings with known transformation and prompt families."""
    rng = random.Random(seed)
    categories = ["factual", "reasoning", "creative", "safety"]
    examples = []

    # Fixed true transformation matrix W and shift b
    true_W = [[0.8 if i == j else 0.05 for j in range(dim)] for i in range(dim)]
    true_b = [0.1 * (i % 3) for i in range(dim)]

    for idx in range(num_prompts):
        pid = f"prompt_{idx+1:03d}"
        cat = categories[idx % len(categories)]
        src = [rng.gauss(0.0, 1.0) for _ in range(dim)]

        # Target = src * W + b + noise
        tgt = list(true_b)
        for j in range(dim):
            for i in range(dim):
                tgt[j] += src[i] * true_W[i][j]
            tgt[j] += rng.gauss(0.0, 0.05)  # small noise

        examples.append(PairedExample(prompt_id=pid, category=cat, source_embedding=src, target_embedding=tgt))

    return PairedDataset(examples)


def cmd_demo(args: argparse.Namespace) -> int:
    """Run deterministic synthetic demonstration."""
    print("=" * 60)
    print("Vector Tongue — Synthetic Experiment Demonstration")
    print("=" * 60)
    dataset = generate_synthetic_data(num_prompts=args.num_prompts, dim=args.dim, seed=args.seed)
    train_data, test_data = split_dataset(dataset, test_fraction=args.test_fraction, seed=args.seed)

    print(f"Calibration samples: {len(train_data)}")
    print(f"Held-out test samples: {len(test_data)}")
    print(f"Embedding dimension: {train_data.source_dim}")
    print("-" * 60)

    candidate = AffineRidgeTranslator(regularization=args.regularization)
    results = evaluate_experiment(train_data, test_data, candidate, candidate_name="affine_ridge")

    # Bootstrap interval on per-dimension MSE
    prompt_mses = [item["per_dimension_mse"] for item in results["prompt_errors"]]
    mean_mse, ci_low, ci_high = bootstrap_confidence_interval(prompt_mses, seed=args.seed)
    results["candidate"]["bootstrap_95ci"] = [ci_low, ci_high]

    # Permutation control
    perm_results = permutation_control(train_data, test_data, lambda: AffineRidgeTranslator(args.regularization), num_permutations=25, seed=args.seed)
    results["permutation_control"] = perm_results

    # Print summary table
    print(f"{'Model':<20} | {'Held-out MSE':<14} | {'Advantage (MSE)':<16}")
    print("-" * 60)
    print(f"{'Identity Baseline':<20} | {results['baselines']['identity']['held_out_mse']:<14.6f} | {'0.0% (ref)':<16}")
    print(f"{'Target-Mean Baseline':<20} | {results['baselines']['target_mean']['held_out_mse']:<14.6f} | {'baseline':<16}")
    print(f"{'Mean-Shift Baseline':<20} | {results['baselines']['mean_shift']['held_out_mse']:<14.6f} | {'baseline':<16}")
    cand_mse = results['candidate']['held_out_mse']
    adv_id = results['candidate']['advantage_over_identity'] * 100
    adv_ms = results['candidate']['advantage_over_mean_shift'] * 100
    print(f"{'Affine Ridge (v2)':<20} | {cand_mse:<14.6f} | {f'+{adv_id:.1f}% vs id':<16}")
    print("-" * 60)
    print(f"95% CI on MSE: [{ci_low:.6f}, {ci_high:.6f}]")
    print(f"Advantage vs Mean-Shift: +{adv_ms:.1f}%")
    print(f"Permutation control MSE (null): {perm_results['mean_null_mse']:.6f} (higher is expected)")

    if args.output:
        save_results_json(results, args.output)
        print(f"\nDemonstration results written to: {args.output}")

    return 0


def cmd_evaluate(args: argparse.Namespace) -> int:
    """Evaluate paired embeddings from CSV file."""
    print(f"Loading paired embeddings from: {args.csv_path}")
    dataset = load_paired_csv(args.csv_path)
    train_data, test_data = split_dataset(dataset, test_fraction=args.test_fraction, seed=args.seed)

    if args.model == "ridge":
        model = AffineRidgeTranslator(regularization=args.regularization)
        model_name = f"affine_ridge(lambda={args.regularization})"
    elif args.model == "orthogonal":
        model = OrthogonalTranslator()
        model_name = "orthogonal_procrustes"
    elif args.model == "mean_shift":
        model = MeanShiftBaseline()
        model_name = "mean_shift"
    else:
        raise ValueError(f"Unknown model: {args.model}")

    results = evaluate_experiment(train_data, test_data, model, candidate_name=model_name)

    print("\n--- Evaluation Results ---")
    print(f"Candidate: {model_name}")
    print(f"Held-out MSE: {results['candidate']['held_out_mse']:.6f}")
    print(f"Held-out Cosine Distance: {results['candidate']['held_out_cosine_distance']:.6f}")
    for k, v in results['candidate'].items():
        if k.startswith("advantage_over_"):
            print(f"  {k}: {v * 100:.2f}%")

    if args.output:
        save_results_json(results, args.output)
        print(f"\nResults saved to: {args.output}")

    return 0


def cmd_verify_proof(args: argparse.Namespace) -> int:
    """Verify priority manifest structure and any local artifacts."""
    print(f"Verifying priority manifest: {args.manifest_path}")
    report = verify_manifest(args.manifest_path)

    print("=" * 60)
    print(f"Project: {report['project']}")
    print(f"Recorded by: {report['recorded_by']}")
    print(f"Manifest version: {report['manifest_version']}")
    print(f"Title on record: {report['hashchain_record'].get('title_on_record')}")
    print(f"Inventor on record: {report['hashchain_record'].get('inventor_name_on_record')}")
    print(f"Contact email: {report['hashchain_record'].get('contact_email')}")
    print("-" * 60)
    summary = report["summary"]
    print(f"Total artifacts declared: {summary['total_artifacts']}")
    print(f"Verified locally: {summary['verified_locally']}")
    print(f"Missing locally (expected if unbundled): {summary['missing_locally']}")
    print(f"Checksum mismatches: {summary['mismatch_count']}")
    print(f"Manifest structural validation: {'PASSED' if report['is_valid_structure'] else 'FAILED'}")
    print("=" * 60)

    return 0 if report["is_valid_structure"] else 1



def cmd_validate_anchors(args: argparse.Namespace) -> int:
    """Validate and summarize a Marlerian Anchor Registry."""
    registry = load_anchor_registry(args.registry_path)
    print(json.dumps(registry.summary(), indent=2))
    return 0


def main(argv: Optional[List[str]] = None) -> int:
    parser = argparse.ArgumentParser(
        prog="vector-tongue",
        description="Vector Tongue: Falsifiable Output-Only Cross-Model Translation Framework",
    )
    subparsers = parser.add_subparsers(dest="command", required=True)

    # Demo
    demo_parser = subparsers.add_parser("demo", help="Run deterministic synthetic demonstration")
    demo_parser.add_argument("--output", type=str, default=None, help="Output JSON path")
    demo_parser.add_argument("--num-prompts", type=int, default=40, help="Number of synthetic prompts")
    demo_parser.add_argument("--dim", type=int, default=8, help="Vector dimension")
    demo_parser.add_argument("--test-fraction", type=float, default=0.25, help="Held-out fraction")
    demo_parser.add_argument("--regularization", type=float, default=1.0, help="Ridge lambda")
    demo_parser.add_argument("--seed", type=int, default=42, help="Random seed")

    # Evaluate
    eval_parser = subparsers.add_parser("evaluate", help="Evaluate paired embeddings from CSV")
    eval_parser.add_argument("csv_path", type=str, help="Path to input CSV")
    eval_parser.add_argument("--model", type=str, default="ridge", choices=["ridge", "orthogonal", "mean_shift"])
    eval_parser.add_argument("--regularization", type=float, default=1.0, help="Regularization parameter")
    eval_parser.add_argument("--test-fraction", type=float, default=0.25, help="Test fraction")
    eval_parser.add_argument("--output", type=str, default=None, help="Output JSON path")
    eval_parser.add_argument("--seed", type=int, default=42, help="Random seed")

    # Verify Proof
    verify_parser = subparsers.add_parser("verify-proof", help="Verify priority manifest structure")
    verify_parser.add_argument("manifest_path", type=str, help="Path to manifest JSON")

    anchor_parser = subparsers.add_parser("validate-anchors", help="Validate a Marlerian Anchor Registry")
    anchor_parser.add_argument("registry_path", type=str, help="Path to anchor registry JSON")

    args = parser.parse_args(argv)

    if args.command == "demo":
        return cmd_demo(args)
    elif args.command == "evaluate":
        return cmd_evaluate(args)
    elif args.command == "verify-proof":
        return cmd_verify_proof(args)
    elif args.command == "validate-anchors":
        return cmd_validate_anchors(args)
    else:
        parser.print_help()
        return 1


if __name__ == "__main__":
    sys.exit(main())
