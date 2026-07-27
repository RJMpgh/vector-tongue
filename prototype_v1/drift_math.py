"""Historical Vector Tongue prototype supplied by RJ Marler.

Preserved for provenance. Not imported by the v2 package.
"""

from itertools import combinations

import matplotlib.pyplot as plt
import numpy as np
from numpy.linalg import norm
import pandas as pd
import streamlit as st


def cosine_similarity(a, b):
    """Computes cosine similarity between two embedding vectors."""
    return np.dot(a, b) / (norm(a) * norm(b))


def compute_metrics(models, embeddings):
    """Computes pairwise Cosine Similarities, Delta Vectors, and Drift Scores."""
    sim_matrix = pd.DataFrame(index=models, columns=models)
    deltas = {}
    drift_scores = {}

    for m1, m2 in combinations(models, 2):
        vec1, vec2 = embeddings[m1], embeddings[m2]
        sim = cosine_similarity(vec1, vec2)
        delta = np.subtract(vec2, vec1)
        drift = (1 - sim) * norm(delta)

        sim_matrix.loc[m1, m2] = sim
        sim_matrix.loc[m2, m1] = sim
        deltas[f"{m1}   {m2}"] = delta
        drift_scores[f"{m1}   {m2}"] = drift

    np.fill_diagonal(sim_matrix.values, 1.0)
    return sim_matrix.astype(float), deltas, drift_scores


def display_heatmap(models, sim_matrix):
    """Generates heatmaps representing model-to-model alignment."""
    fig, ax = plt.subplots()
    cax = ax.matshow(sim_matrix.values, cmap="coolwarm")
    plt.xticks(range(len(models)), models, rotation=45)
    plt.yticks(range(len(models)), models)

    for (i, j), val in np.ndenumerate(sim_matrix.values):
        ax.text(
            j,
            i,
            f"{val:.2f}",
            va="center",
            ha="center",
            color="white" if val < 0.7 else "black",
        )

    fig.colorbar(cax)
    st.pyplot(fig)


def predict_embedding(source_vec, delta_vec):
    """Predicts target embedding given source vector and observed delta vector."""
    return np.add(source_vec, delta_vec)


def find_best_prediction(base_model, embeddings, deltas):
    """Calculates predicted embeddings across models."""
    predictions = {}
    base_vec = embeddings[base_model]
    for key, delta in deltas.items():
        if key.startswith(f"{base_model}   "):
            target_model = key.split("   ")[1]
            predictions[target_model] = predict_embedding(base_vec, delta)
    return predictions
