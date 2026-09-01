import { connectDB } from "@/lib/mongodb";
import { requireAuth } from "@/lib/auth";
import { ok, fail, sanitizeText } from "@/lib/api";
import { withErrorHandling } from "@/lib/api";
import { audit } from "@/lib/audit";
import Report from "@/lib/models/Report";

export const POST = withErrorHandling(async (request) => {
  const user = await requireAuth();
  const body = await request.json();

  const subjectType = sanitizeText(body.subjectType, 20);
  const category = sanitizeText(body.category, 60);
  const description = sanitizeText(body.description, 2000);
  const subjectId = String(body.subjectId || "").slice(0, 64);
  const priority = sanitizeText(body.priority, 10).toUpperCase();
  const documents = Array.isArray(body.documents)
    ? body.documents.map((d) => String(d).slice(0, 500)).filter(Boolean)
    : [];

  if (!description || description.length < 10) {
    return fail("Please describe the issue in at least 10 characters.", 400);
  }
  if (!["land", "project", "order", "application", "user", "other"].includes(subjectType)) {
    return fail("Please choose a valid subject.", 400);
  }

  await connectDB();

  const report = await Report.create({
    reporterId: user._id,
    subjectType,
    subjectId,
    category,
    description,
    documents,
    priority: ["LOW", "MEDIUM", "HIGH", "URGENT"].includes(priority) ? priority : "MEDIUM",
    status: "OPEN",
    history: [
      {
        status: "OPEN",
        note: "Report submitted.",
        by: user._id,
        byRole: "user",
        at: new Date(),
      },
    ],
  });

  audit({
    actor: user._id,
    actorRole: (user.roles || [])[0] || "user",
    entity: "report",
    entityId: String(report._id),
    action: "report_created",
    newStatus: "OPEN",
    reason: description.slice(0, 300),
  });

  return ok({ report, message: "Report submitted. Our team will review it shortly." });
});