# Mathematics

## 1. Observational unit

Let:

- \(p\) be a prompt;
- \(m\) be a model/version/configuration;
- \(y_{m,p,r}\) be response replicate \(r\);
- \(E\) be a fixed external embedding encoder;
- \(z_{m,p,r}=E(y_{m,p,r})\in\mathbb{R}^d\).

All compared responses must use the same encoder version and preprocessing.
These vectors represent outputs *through that encoder*. They are not the
models' internal hidden states.

## 2. Descriptive drift

For matched source and target vectors \(a,b\):

\[
d_{\cos}(a,b)=1-\frac{a^\top b}{\lVert a\rVert_2\lVert b\rVert_2},
\]

\[
d_2(a,b)=\lVert b-a\rVert_2,
\]

\[
d_{\text{norm}}(a,b)=\lVert b\rVert_2-\lVert a\rVert_2.
\]

The historical index is:

\[
D_{\text{Marler-v1}}(a,b)=d_{\cos}(a,b)d_2(a,b).
\]

For unit-normalized vectors:

\[
d_2(a,b)=\sqrt{2d_{\cos}(a,b)}.
\]

The two factors are therefore not independent. V2 reports them separately and
keeps \(D_{\text{Marler-v1}}\) for historical continuity.

## 3. Translation hypotheses

### Identity baseline

\[
\hat b=a.
\]

This tests whether the source embedding is already the best target estimate.

### Target-mean baseline

\[
\hat b=\bar b_{\text{train}}.
\]

This ignores the source and predicts the average calibration target.

### Mean-shift baseline

\[
\bar\delta=\frac{1}{n}\sum_{i=1}^n(b_i-a_i),\qquad
\hat b=a+\bar\delta.
\]

Unlike the original per-example reconstruction, \(\bar\delta\) is estimated on
training prompts and fixed before evaluating unseen prompts.

### Affine ridge translator

\[
(\hat W,\hat b)=
\arg\min_{W,b}
\sum_{i\in\mathcal{T}}
\lVert a_iW+b-b_i\rVert_2^2+\lambda\lVert W\rVert_F^2.
\]

For held-out prompt \(j\):

\[
\hat b_j=a_j\hat W+\hat b.
\]

### Orthogonal translator

After centering source and target calibration matrices, solve:

\[
\hat R=\arg\min_{R^\top R=I}\lVert AR-B\rVert_F^2.
\]

This tests a more constrained geometry-preserving hypothesis.

## 4. Primary outcome

For held-out set \(\mathcal H\):

\[
\operatorname{MSE}(f)=
\frac{1}{|\mathcal H|}
\sum_{j\in\mathcal H}
\frac{1}{d}\lVert f(a_j)-b_j\rVert_2^2.
\]

Advantage over baseline \(g\):

\[
G(f;g)=1-\frac{\operatorname{MSE}(f)}
{\operatorname{MSE}(g)}.
\]

\(G>0\) indicates improvement; \(G=0\) parity; \(G<0\) worse performance.

## 5. Falsification

The cross-model translation hypothesis is weakened when:

- learned maps fail to outperform simple baselines;
- performance collapses on held-out prompt families;
- shuffled source–target pairings perform similarly;
- effects depend on one encoder;
- direction \(A\to B\) is unstable across runs or dates;
- predictive advantage vanishes after controlling for response length, topic,
  or refusal frequency.

## 6. What prediction means

Prediction means estimating a target *representation* under declared
conditions. It does not imply exact text reconstruction. Many distinct texts
can share similar embeddings, and an embedding generally has no unique inverse.
