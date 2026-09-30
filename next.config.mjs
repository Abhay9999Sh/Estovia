/** @type {import('next').NextConfig} */

// The valuation engine reads its model artefact and comparable index from disk
// with `fs` rather than importing them, so the 5 MB binary is not inlined into
// a route bundle. Declaring the directory here makes the file tracer include
// those reads in a production build.
const VALUATION_ARTIFACT_GLOB = "./src/lib/valuation/artifacts/**/*";

const nextConfig = {
  /* config options here */
  reactCompiler: true,
  outputFileTracingIncludes: {
    "/api/valuation": [VALUATION_ARTIFACT_GLOB],
    "/api/valuation/*": [VALUATION_ARTIFACT_GLOB],
    "/api/admin/valuation": [VALUATION_ARTIFACT_GLOB],
  },
  serverExternalPackages: [],
};

export default nextConfig;
