# Priority and Provenance

This directory separates historical evidence from scientific evaluation.

## Records currently available

1. The `RJMpgh/RJMpgh` GitHub profile contains a public Vector Tongue
   disclosure labeled August 5, 2025.
2. RJ supplied a UTC timestamp and SHA-256 values for October 2025 documents,
   a provisional-package ZIP, source code, and simulation output.
3. RJ reported that related material was minted or published through OpenSea on
   Polygon in February 2026.

## Verification status

During construction of this repository:

- the October artifacts themselves were not available, so their hashes could
  not be independently recomputed;
- no Polygon transaction hash, contract address, token ID, wallet address, or
  IPFS URI was available;
- public search did not identify a uniquely attributable Vector Tongue item.

Accordingly, the manifest labels the supplied hashes as `user_supplied` and the
Polygon fields as pending. This is an evidence-handling decision, not a
challenge to RJ's account.

## Important distinctions

A valid SHA-256 match can establish that two byte sequences are identical.
A verified transaction can establish that particular on-chain data existed by
a block timestamp. Additional evidence is needed to connect:

- a wallet to a person;
- a token to a specific off-chain document;
- mutable marketplace metadata to an immutable content hash;
- an artifact timestamp to legal inventorship or patent priority.

OpenSea is a marketplace interface. Polygon is the chain. The evidentiary value
comes from verifiable chain data and content-addressed material, not from a
marketplace description alone.

## Completing the record

Add the following to
`provenance/vector_tongue_priority_manifest.json` when available:

- `wallet_address`;
- `transaction_hash`;
- `contract_address`;
- `token_id`;
- `ipfs_uri`;
- the exact metadata JSON;
- local copies of the referenced artifacts, where disclosure is intended.

Then run:

```bash
vector-tongue verify-proof \
  provenance/vector_tongue_priority_manifest.json \
  --artifact-root /path/to/artifacts
```

For legal conclusions about provisional applications, public disclosure,
inventorship, priority, or patent rights, consult a qualified intellectual
property attorney.
