# Historical prototype v1

These files preserve the original proof-of-concept code supplied by RJ Marler.
They are intentionally excluded from the installable v2 package.

The prototype:

- compared known paired outputs with one external embedding model;
- calculated cosine similarity, delta vectors, and Marler Drift v1;
- reconstructed a known target as `source + observed_delta`;
- mixed mathematical functions with Streamlit presentation;
- used the legacy OpenAI Python client interface.

The archive should be read as evidence of the evolving concept, not as the
recommended implementation. V2 replaces target-reusing reconstruction with
held-out prediction and explicit baselines.
