import hashlib
import json
import pathlib
import tempfile
import unittest

from vector_tongue.provenance import sha256_file, verify_manifest


class ProvenanceTests(unittest.TestCase):
    def test_sha256_file(self):
        with tempfile.TemporaryDirectory() as directory:
            path = pathlib.Path(directory) / "artifact.bin"
            path.write_bytes(b"vector tongue")
            self.assertEqual(
                sha256_file(path),
                hashlib.sha256(b"vector tongue").hexdigest(),
            )

    def test_manifest_match_missing_and_polygon_pending(self):
        with tempfile.TemporaryDirectory() as directory:
            root = pathlib.Path(directory)
            artifact = root / "present.txt"
            artifact.write_text("proof", encoding="utf-8")
            manifest = root / "manifest.json"
            manifest.write_text(
                json.dumps(
                    {
                        "manifest_version": "1.0",
                        "artifacts": [
                            {
                                "path": "present.txt",
                                "sha256": sha256_file(artifact),
                            },
                            {
                                "path": "missing.txt",
                                "sha256": "0" * 64,
                            },
                        ],
                        "polygon": {
                            "transaction_hash": None,
                            "contract_address": None,
                            "token_id": None,
                        },
                    }
                ),
                encoding="utf-8",
            )
            result = verify_manifest(manifest)
            self.assertEqual(result.artifacts[0].status, "match")
            self.assertEqual(result.artifacts[1].status, "missing")
            self.assertEqual(result.polygon_status, "identifiers_missing")
            self.assertFalse(result.all_local_hashes_match)

    def test_malformed_hash_reported(self):
        with tempfile.TemporaryDirectory() as directory:
            root = pathlib.Path(directory)
            manifest = root / "manifest.json"
            manifest.write_text(
                json.dumps(
                    {
                        "manifest_version": "1.0",
                        "artifacts": [{"path": "x", "sha256": "not-a-hash"}],
                        "polygon": {},
                    }
                ),
                encoding="utf-8",
            )
            result = verify_manifest(manifest)
            self.assertEqual(result.artifacts[0].status, "invalid_hash")


if __name__ == "__main__":
    unittest.main()
