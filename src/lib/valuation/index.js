/**
 * Public surface of the valuation engine.
 *
 * Routes and server components import from here only, so the internals can move
 * without touching call sites.
 */

export { predict, describeModel, FEATURE_LABELS } from "./predict.js";
export { normalizeInput, ValidationError, SUPPORTED_CITIES, SUPPORTED_CATEGORIES, SUPPORTED_SEGMENT, AREA_UNITS, AREA_UNIT_LABELS, LIMITS } from "./schema.js";
export { PROPERTY_CATEGORIES } from "./features.js";
export { listLocalities } from "./comparables.js";
export { hasModel } from "./model.js";
