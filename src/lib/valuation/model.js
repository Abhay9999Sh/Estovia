/**
 * Runtime model loading and tree evaluation.
 *
 * The trained artefact is a ~22 MB JSON document (1200 exported XGBoost trees
 * written with indentation for human review). That is fine as an archive and
 * far too heavy to import into a route bundle, so
 * `ml-service/scripts/export_runtime_model.py` re-encodes the same trees into
 * parallel typed arrays in `artifacts/model_<segment>.bin`.
 *
 * The walk below is arithmetically identical to
 * `ml-service/estovia_ml/verify_parity.py::predict_xgboost_json`, which stays
 * the reference implementation. `verify_parity` is what proves the numbers the
 * UI shows are the numbers the evaluation report measured.
 *
 * The file is read once and cached on `globalThis` so concurrent requests in a
 * warm serverless instance reuse the same typed arrays instead of re-reading.
 */

import fs from "fs";
import path from "path";

const MAGIC = "ESTSVMB";

const cache = globalThis.__estoviaModelCache || (globalThis.__estoviaModelCache = new Map());

function fail(message) {
  const error = new Error(message);
  error.status = 503;
  return error;
}

/**
 * Resolve the runtime artefact directory. `ML_MODEL_DIR` wins when set;
 * otherwise walk up from the working directory looking for
 * `src/lib/valuation/artifacts`, so the module behaves identically under
 * `next dev` and when a verification script runs from a subdirectory.
 *
 * `next.config.mjs` declares this directory in `outputFileTracingIncludes`, so
 * the files travel with a production build even though they are read with `fs`
 * rather than imported.
 */
function resolveArtifactDir() {
  if (process.env.ML_MODEL_DIR) return path.resolve(process.env.ML_MODEL_DIR);
  let dir = process.cwd();
  for (let i = 0; i < 6; i += 1) {
    const candidate = path.join(dir, "src", "lib", "valuation", "artifacts");
    if (fs.existsSync(candidate)) return candidate;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return path.join(process.cwd(), "src", "lib", "valuation", "artifacts");
}

/**
 * Decode the .bin payload into typed arrays. Layout, in order, after the
 * magic + version + header-length prefix and the JSON header:
 *   Int32Array   treeOffsets      (nTrees + 1)
 *   Int32Array   splitIndices
 *   Int32Array   leftChildren
 *   Int32Array   rightChildren
 *   Float64Array splitConditions  (split threshold at internal nodes, leaf weight at leaves)
 *   Uint8Array   defaultLeft      (1 byte per node, therefore last)
 */
function decode(buffer) {
  if (buffer.length < MAGIC.length + 8) {
    throw fail("Valuation model artefact is truncated.");
  }
  if (buffer.toString("ascii", 0, MAGIC.length) !== MAGIC) {
    throw fail("Valuation model artefact is corrupt or not an Estovia model file.");
  }
  const formatVersion = buffer.readUInt32LE(MAGIC.length);
  if (formatVersion !== 2) {
    throw fail(`Unsupported valuation model format version ${formatVersion}.`);
  }

  const headerLength = buffer.readUInt32LE(MAGIC.length + 4);
  const headerStart = MAGIC.length + 8;
  if (headerStart + headerLength > buffer.length) {
    throw fail("Valuation model artefact header is truncated.");
  }
  const meta = JSON.parse(buffer.toString("utf8", headerStart, headerStart + headerLength));

  let cursor = headerStart + headerLength;
  const nTrees = meta.ensemble.nTrees;

  const take = (Type, length) => {
    // The exporter pads every array up to an 8-byte boundary, so each cursor
    // must skip the same padding. Getting this wrong shifts the arrays and the
    // last one overruns the buffer, so assert rather than guess.
    const bytes = length * Type.BYTES_PER_ELEMENT;
    const end = cursor + bytes;
    if (end > buffer.length) {
      throw fail("Valuation model artefact is truncated; re-run export_runtime_model.py.");
    }
    const view = new Type(buffer.buffer, buffer.byteOffset + cursor, length);
    // Match Python's `(-n) % 8`, which is always non-negative. JavaScript's `%`
    // keeps the dividend's sign, so `(-bytes) % 8` would step the cursor
    // backwards and desynchronise every array after the first.
    cursor = end + ((8 - (bytes % 8)) % 8);
    return view;
  };

  const treeOffsets = take(Int32Array, nTrees + 1);
  const nNodes = meta.ensemble.nNodes;
  const splitIndices = take(Int32Array, nNodes);
  const leftChildren = take(Int32Array, nNodes);
  const rightChildren = take(Int32Array, nNodes);
  const splitConditions = take(Float64Array, nNodes);
  const defaultLeft = take(Uint8Array, nNodes);

  return { meta, treeOffsets, splitIndices, leftChildren, rightChildren, defaultLeft, splitConditions };
}

function readSegment(segment) {
  if (cache.has(segment)) return cache.get(segment);

  const binPath = path.join(resolveArtifactDir(), `model_${segment}.bin`);
  let entry = null;

  if (fs.existsSync(binPath)) {
    const decoded = decode(fs.readFileSync(binPath));
    entry = { available: true, ...decoded, modelId: decoded.meta.modelId };
  } else {
    // No model was registered for this segment. This is an expected state, not
    // an error: the pipeline only writes a segment it actually trained, and
    // callers must surface "no model for this segment" rather than guessing.
    entry = { available: false, segment, reason: `no trained model registered for segment "${segment}"` };
  }

  cache.set(segment, entry);
  return entry;
}

/**
 * Evaluate one row. `x` is an array indexed by the model's feature order.
 * Returns the raw prediction, which for this model is log(price per sq ft).
 *
 * XGBoost's default-direction rule is spelled out here rather than inlined so
 * it stays auditable: a non-finite feature value follows `defaultLeft`. The
 * feature builder substitutes training medians first, so that branch is a
 * safety net rather than the normal path.
 */
export function predictTree(model, x) {
  const { baseScore, nTrees } = model.meta.ensemble;
  const { treeOffsets, splitIndices, splitConditions, leftChildren, rightChildren, defaultLeft } = model;

  let sum = baseScore;
  for (let t = 0; t < nTrees; t += 1) {
    // Child pointers inside an XGBoost tree are indices relative to that
    // tree's root, while the flat arrays are one contiguous block for all
    // trees, so every lookup is offset by this tree's base.
    const start = treeOffsets[t];
    let node = 0;
    while (leftChildren[start + node] !== -1) {
      const v = x[splitIndices[start + node]];
      const goLeft = Number.isFinite(v)
        ? v < splitConditions[start + node]
        : defaultLeft[start + node] === 1;
      node = goLeft ? leftChildren[start + node] : rightChildren[start + node];
    }
    sum += splitConditions[start + node];
  }
  return sum;
}

/**
 * Split-count importance, normalised to shares that sum to 1.
 *
 * This is deliberately NOT called "gain importance": an XGBoost tree dump does
 * not carry per-split gain, and `split_conditions` at an internal node is the
 * split THRESHOLD, not a gain. Reading it as gain produces confident,
 * meaningless numbers. Share of decision splits is derivable from the dump and
 * is an honest, if cruder, measure of how often the model actually consults
 * each feature.
 */
export function splitCountImportance(model, featureNames, topN = 12) {
  const { treeOffsets, leftChildren, splitIndices } = model;
  const nTrees = model.meta.ensemble.nTrees;
  const counts = new Float64Array(featureNames.length);

  for (let t = 0; t < nTrees; t += 1) {
    const start = treeOffsets[t];
    const end = treeOffsets[t + 1];
    for (let i = start; i < end; i += 1) {
      if (leftChildren[i] === -1) continue;
      const feature = splitIndices[i];
      if (feature < 0 || feature >= counts.length) continue;
      counts[feature] += 1;
    }
  }

  const sum = counts.reduce((acc, v) => acc + v, 0);
  if (sum <= 0) return [];

  return Array.from(counts, (count, index) => ({
    key: featureNames[index],
    splitPct: (count / sum) * 100,
  }))
    .filter((f) => f.splitPct > 0)
    .sort((a, b) => b.splitPct - a.splitPct)
    .slice(0, topN);
}

export function getModel(segment) {
  return readSegment(segment);
}

export function hasModel(segment) {
  return readSegment(segment).available === true;
}

export function clearModelCache() {
  cache.clear();
}
