import csv
import json
import os
import pathlib
import tempfile
import types
import unittest
from unittest import mock

import numpy as np

from vector_tongue.data import EmbeddingPair, PairDataset
from vector_tongue.empirical import (
    analyze_experiment,
    paired_bootstrap_gain,
    ridge_permutation_control,
)
from vector_tongue.experiment import (
    EmbeddingRecord,
    ResponseRecord,
    write_embedding_index,
    write_response_records,
)
from vector_tongue.openai_runner import (
    collect_responses,
    submit_response_batches,
    sync_response_batches,
)


class EmpiricalMathTests(unittest.TestCase):
    def test_paired_gain_interval_is_positive_for_better_model(self):
        interval = paired_bootstrap_gain(
            np.array([0.1, 0.2, 0.1, 0.2]),
            np.array([1.0, 1.1, 0.9, 1.0]),
            confidence=0.95,
            resamples=200,
            seed=4,
        )
        self.assertGreater(interval.estimate, 0.8)
        self.assertGreater(interval.lower, 0.0)

    def test_permutation_control_detects_pair_structure(self):
        rng = np.random.default_rng(8)
        source = rng.normal(size=(50, 6))
        weights = rng.normal(size=(6, 6))
        target = source @ weights + rng.normal(scale=0.01, size=(50, 6))
        pairs = [
            EmbeddingPair.create(f"p-{index}", source[index], target[index]) for index in range(50)
        ]
        dataset = PairDataset.from_pairs(pairs)
        train = dataset.subset(range(35))
        test = dataset.subset(range(35, 50))
        result = ridge_permutation_control(
            train,
            test,
            regularization=0.1,
            confidence=0.95,
            permutations=200,
            seed=2,
        )
        self.assertLess(result.observed_mse, result.null_mean_mse)
        self.assertLess(result.p_value_lower_tail, 0.02)


class FakeUsageDetails:
    cached_tokens = 0


class FakeUsage:
    input_tokens = 12
    output_tokens = 18
    total_tokens = 30
    input_tokens_details = FakeUsageDetails()


class FakeResponse:
    def __init__(self, model, prompt_id):
        self.model = model
        self.id = f"resp-{model}-{prompt_id}"
        self.status = "completed"
        self.incomplete_details = None
        self.output_text = f"Response from {model} for {prompt_id}."
        self.usage = FakeUsage()


class FakeResponses:
    def create(self, **kwargs):
        return FakeResponse(kwargs["model"], kwargs["metadata"]["prompt_id"])


class FakeOpenAI:
    def __init__(self, **kwargs):
        self.responses = FakeResponses()


class FakeBatchFiles:
    contents = {}
    counter = 0

    def create(self, *, file, purpose):
        self.__class__.counter += 1
        file_id = f"file-input-{self.counter}"
        self.__class__.contents[file_id] = file.read().decode("utf-8")
        return types.SimpleNamespace(id=file_id)

    def content(self, file_id):
        return types.SimpleNamespace(text=self.__class__.contents[file_id])


class FakeBatchService:
    batches = {}

    def create(self, *, input_file_id, endpoint, completion_window, metadata):
        batch_id = f"batch-{metadata['model_side']}"
        self.__class__.batches[batch_id] = {
            "input_file_id": input_file_id,
            "side": metadata["model_side"],
        }
        return types.SimpleNamespace(id=batch_id, status="validating")

    def retrieve(self, batch_id):
        details = self.__class__.batches[batch_id]
        output_file_id = f"file-output-{details['side']}"
        requests = [
            json.loads(line)
            for line in FakeBatchFiles.contents[details["input_file_id"]].splitlines()
        ]
        outputs = []
        for request in reversed(requests):
            body = request["body"]
            prompt_id = body["metadata"]["prompt_id"]
            outputs.append(
                json.dumps(
                    {
                        "custom_id": request["custom_id"],
                        "response": {
                            "status_code": 200,
                            "request_id": f"request-{prompt_id}",
                            "body": {
                                "id": f"response-{prompt_id}-{body['model']}",
                                "model": body["model"],
                                "status": "completed",
                                "created_at": 1760000000,
                                "output": [
                                    {
                                        "type": "message",
                                        "content": [
                                            {
                                                "type": "output_text",
                                                "text": (
                                                    f"Batch response for {prompt_id} "
                                                    f"from {body['model']}."
                                                ),
                                            }
                                        ],
                                    }
                                ],
                                "usage": {
                                    "input_tokens": 10,
                                    "output_tokens": 15,
                                    "total_tokens": 25,
                                    "input_tokens_details": {"cached_tokens": 0},
                                },
                            },
                        },
                        "error": None,
                    }
                )
            )
        FakeBatchFiles.contents[output_file_id] = "\n".join(outputs) + "\n"
        counts = types.SimpleNamespace(total=len(requests), completed=len(requests), failed=0)
        return types.SimpleNamespace(
            id=batch_id,
            status="completed",
            output_file_id=output_file_id,
            error_file_id=None,
            request_counts=counts,
        )


class FakeBatchOpenAI:
    def __init__(self, **kwargs):
        self.files = FakeBatchFiles()
        self.batches = FakeBatchService()


class EmpiricalPipelineTests(unittest.TestCase):
    def setUp(self):
        FakeBatchFiles.contents = {}
        FakeBatchFiles.counter = 0
        FakeBatchService.batches = {}
        self.root = pathlib.Path(__file__).parents[1]
        self.temp = tempfile.TemporaryDirectory(dir=self.root)
        self.directory = pathlib.Path(self.temp.name)
        self.relative = self.directory.relative_to(self.root)
        self.prompt_path = self.directory / "prompts.csv"
        with self.prompt_path.open("w", encoding="utf-8", newline="") as handle:
            writer = csv.writer(handle)
            writer.writerow(["id", "family", "split", "text"])
            writer.writerows(
                [
                    ["p1", "test", "calibration", "Prompt one"],
                    ["p2", "test", "calibration", "Prompt two"],
                    ["p3", "test", "heldout", "Prompt three"],
                    ["p4", "test", "heldout", "Prompt four"],
                ]
            )
        base = json.loads(
            (self.root / "experiments" / "real_models" / "config.json").read_text(encoding="utf-8")
        )
        base.update(
            {
                "experiment_id": "test-pilot",
                "prompt_file": str(self.relative / "prompts.csv"),
                "source_model": "source-model",
                "target_model": "target-model",
                "embedding_model": "embedding-model",
                "embedding_dimensions": 3,
                "bootstrap_resamples": 100,
                "permutation_resamples": 100,
                "concurrency": 1,
                "responses_file": str(self.relative / "responses.csv"),
                "embeddings_file": str(self.relative / "embeddings.npz"),
                "embedding_index_file": str(self.relative / "embedding_index.csv"),
                "analysis_file": str(self.relative / "analysis.json"),
                "manifest_file": str(self.relative / "manifest.json"),
                "results_markdown_file": str(self.relative / "RESULTS.md"),
                "price_usd_per_million_tokens": {
                    "source-model": {
                        "input": 1.0,
                        "cached_input": 0.1,
                        "output": 2.0,
                    },
                    "target-model": {
                        "input": 1.0,
                        "cached_input": 0.1,
                        "output": 2.0,
                    },
                    "embedding-model": {"input": 0.1},
                },
            }
        )
        self.config_path = self.directory / "config.json"
        self.config_path.write_text(json.dumps(base), encoding="utf-8")

    def tearDown(self):
        self.temp.cleanup()

    def test_collection_is_resumable_with_mock_client(self):
        with mock.patch.dict(os.environ, {"OPENAI_API_KEY": "test-key"}):
            with mock.patch(
                "vector_tongue.openai_runner._openai_class",
                return_value=FakeOpenAI,
            ):
                first = collect_responses(self.config_path, limit=1)
                second = collect_responses(self.config_path, limit=1)
        self.assertEqual(first["new_requests"], 2)
        self.assertEqual(second["new_requests"], 0)
        self.assertEqual(second["successful_responses"], 2)

    def test_batch_collection_uses_custom_ids_not_output_order(self):
        with mock.patch.dict(os.environ, {"OPENAI_API_KEY": "test-key"}):
            with mock.patch(
                "vector_tongue.openai_runner._openai_class",
                return_value=FakeBatchOpenAI,
            ):
                submitted = submit_response_batches(self.config_path)
                resubmitted = submit_response_batches(self.config_path)
                synced = sync_response_batches(self.config_path)
        self.assertEqual(set(submitted["batches"]), {"source", "target"})
        self.assertEqual(set(submitted["submitted_sides"]), {"source", "target"})
        self.assertEqual(resubmitted["submitted_sides"], [])
        self.assertEqual(FakeBatchFiles.counter, 2)
        self.assertTrue(synced["complete"])
        with (self.directory / "responses.csv").open(encoding="utf-8") as handle:
            rows = list(csv.DictReader(handle))
        self.assertEqual(len(rows), 8)
        self.assertEqual({row["collection_mode"] for row in rows}, {"batch"})
        self.assertEqual(rows[0]["prompt_id"], "p1")
        self.assertEqual(rows[-1]["prompt_id"], "p4")

    def test_analysis_writes_honest_result_and_manifest(self):
        response_records = []
        index_records = []
        vectors = []
        source_vectors = {
            "p1": [1.0, 0.2, 0.1],
            "p2": [0.2, 1.0, 0.2],
            "p3": [0.7, 0.3, 0.4],
            "p4": [0.4, 0.8, 0.3],
        }
        for prompt_id in ("p1", "p2", "p3", "p4"):
            split = "calibration" if prompt_id in {"p1", "p2"} else "heldout"
            for model in ("source-model", "target-model"):
                vector = np.asarray(source_vectors[prompt_id], dtype=float)
                if model == "target-model":
                    vector = vector[[1, 2, 0]] + [0.1, 0.05, 0.2]
                row = len(vectors)
                vectors.append(vector)
                response_id = f"resp-{prompt_id}-{model}"
                response_records.append(
                    ResponseRecord(
                        prompt_id=prompt_id,
                        family="test",
                        split=split,
                        replicate=1,
                        requested_model=model,
                        resolved_model=model,
                        response_id=response_id,
                        collection_mode="test",
                        response_status="completed",
                        incomplete_reason="",
                        response_text=f"Text for {prompt_id} from {model}",
                        input_tokens=10,
                        cached_input_tokens=0,
                        output_tokens=20,
                        total_tokens=30,
                        created_at_utc="2026-01-01T00:00:00Z",
                        latency_seconds=0.1,
                        attempts=1,
                        error="",
                    )
                )
                index_records.append(
                    EmbeddingRecord(
                        row_index=row,
                        prompt_id=prompt_id,
                        family="test",
                        split=split,
                        replicate=1,
                        requested_model=model,
                        resolved_model=model,
                        response_id=response_id,
                    )
                )
        write_response_records(self.directory / "responses.csv", response_records)
        write_embedding_index(self.directory / "embedding_index.csv", index_records)
        np.savez_compressed(
            self.directory / "embeddings.npz",
            embeddings=np.asarray(vectors),
            requested_embedding_model=np.asarray("embedding-model"),
            resolved_embedding_models=np.asarray(["embedding-model"]),
            embedding_dimensions=np.asarray(3),
            embedding_total_tokens=np.asarray(80),
        )
        result = analyze_experiment(self.config_path)
        self.assertTrue((self.directory / "analysis.json").is_file())
        self.assertTrue((self.directory / "manifest.json").is_file())
        markdown = (self.directory / "RESULTS.md").read_text(encoding="utf-8")
        self.assertIn("Preregistered decision", markdown)
        self.assertIn("Limitations", markdown)
        self.assertEqual(result["results"], str(self.relative / "RESULTS.md"))


if __name__ == "__main__":
    unittest.main()
