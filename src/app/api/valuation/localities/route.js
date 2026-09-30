import { requireRole } from "@/lib/auth";
import { ok, fail, withErrorHandling } from "@/lib/api";
import { listLocalities, SUPPORTED_CITIES } from "@/lib/valuation";

const ROLES = ["landowner", "builder", "buyer", "admin", "viewer"];

/**
 * Locality autocomplete.
 *
 * This exists for correctness, not convenience. The model keys its locality
 * target encoding and frequency count on the exact training string, which
 * includes the original casing and any stray whitespace. A hand-typed
 * "Sector 150" may not match a stored "sector 150 " and would silently fall back
 * to the city-wide median, so the UI offers the spellings that actually hit.
 */
export const GET = withErrorHandling(async (request) => {
  await requireRole(ROLES);
  const { searchParams } = new URL(request.url);
  const city = searchParams.get("city");
  const query = (searchParams.get("q") || "").trim().toLowerCase();

  if (city && !SUPPORTED_CITIES.includes(city)) {
    return fail(`${city} is outside the model's coverage.`, 400);
  }

  let localities = listLocalities(city || undefined, { limit: 400 });
  if (query) {
    localities = localities.filter((l) => l.locality.toLowerCase().includes(query));
  }
  localities = localities.slice(0, 100);

  return ok({
    city: city || null,
    count: localities.length,
    localities: localities.map((l) => ({
      // Returned verbatim. Do not normalise this value on the way out.
      locality: l.locality,
      n: l.n,
      medianPricePerSqFt: l.medianPricePerSqFt,
    })),
  });
});
