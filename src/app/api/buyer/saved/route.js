import mongoose from "mongoose";
import { requireAuth } from "@/lib/auth";
import { connectDB } from "@/lib/mongodb";
import BuyerSaved from "@/lib/models/BuyerSaved";
import Project from "@/lib/models/Project";
import ProjectUnit from "@/lib/models/ProjectUnit";
import LandListing from "@/lib/models/LandListing";
import { ok, fail, sanitizeText, validateRequired } from "@/lib/api";
import { withErrorHandling } from "@/lib/api";

const ENTITY_TYPES = ["project", "unit", "land"];
const REF_MAP = {
  project: { ref: "Project", model: Project },
  unit: { ref: "ProjectUnit", model: ProjectUnit },
  land: { ref: "LandListing", model: LandListing },
};

export const GET = withErrorHandling(async (request) => {
  const user = await requireAuth();
  await connectDB();
  const saved = await BuyerSaved.find({ buyerId: user._id })
    .sort({ createdAt: -1 })
    .lean();

  const result = [];
  for (const s of saved) {
    const meta = REF_MAP[s.entityType];
    let entity = null;
    try {
      entity = await meta.model.findById(s.entityId).lean();
    } catch {
      entity = null;
    }
    result.push({ ...s, entity });
  }

  return ok({ saved: result });
});

export const POST = withErrorHandling(async (request) => {
  const user = await requireAuth();
  const body = await request.json();
  await connectDB();

  const missing = validateRequired(body, ["entityType", "entityId"]);
  if (missing) return fail(`${missing} is required.`);
  if (!ENTITY_TYPES.includes(body.entityType)) return fail("Invalid entity type.", 400);
  if (!mongoose.isValidObjectId(body.entityId)) return fail("Invalid entity.", 400);

  const meta = REF_MAP[body.entityType];
  const exists = await meta.model.findById(body.entityId);
  if (!exists) return fail("Referenced entity not found.", 404);

  let saved = await BuyerSaved.findOne({
    buyerId: user._id,
    entityType: body.entityType,
    entityId: body.entityId,
  });
  if (saved) {
    return ok({ saved, message: "Already saved." });
  }

  saved = await BuyerSaved.create({
    buyerId: user._id,
    entityType: body.entityType,
    entityId: body.entityId,
    entityRef: meta.ref,
    note: sanitizeText(body.note, 500),
    forCompare: !!body.forCompare,
  });

  return ok({ saved, message: "Saved." }, 201);
});

export const DELETE = withErrorHandling(async (request) => {
  const user = await requireAuth();
  const { searchParams } = request.nextUrl;
  const entityType = searchParams.get("entityType");
  const entityId = searchParams.get("entityId");
  await connectDB();

  if (!entityType || !entityId) return fail("entityType and entityId are required.", 400);
  if (!ENTITY_TYPES.includes(entityType)) return fail("Invalid entity type.", 400);
  if (!mongoose.isValidObjectId(entityId)) return fail("Invalid entity.", 400);

  const result = await BuyerSaved.findOneAndDelete({
    buyerId: user._id,
    entityType,
    entityId,
  });

  if (!result) return fail("Saved item not found.", 404);
  return ok({ message: "Removed from saved items." });
});
