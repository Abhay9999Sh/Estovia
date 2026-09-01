import { connectDB } from "@/lib/mongodb";
import { requireAdmin } from "@/lib/admin";
import { ok, fail, sanitizeText } from "@/lib/api";
import { withErrorHandling } from "@/lib/api";
import { createNotification } from "@/lib/notifications";
import { audit } from "@/lib/audit";
import mongoose from "mongoose";
import Report from "@/lib/models/Report";
import User from "@/lib/models/User";

const WORKFLOW = ["OPEN", "UNDER_REVIEW", "WAITING_FOR_INFORMATION", "RESOLVED", "CLOSED"];

export const GET = withErrorHandling(async (request, ctx) => {
  await requireAdmin();
  const { id } = await ctx.params;
  if (!mongoose.isValidObjectId(id)) return fail("Invalid report.", 400);
  await connectDB();

  const report = await Report.findById(id).lean();
  if (!report) return fail("Report not found.", 404);
  const [reporter, assignee] = await Promise.all([
    User.findById(report.reporterId).select("name username email roles").lean(),
    report.assignedTo ? User.findById(report.assignedTo).select("name username").lean() : Promise.resolve(null),
  ]);

  return ok({ report, reporter, assignee });
});

export const PATCH = withErrorHandling(async (request, ctx) => {
  const admin = await requireAdmin();
  const { id } = await ctx.params;
  if (!mongoose.isValidObjectId(id)) return fail("Invalid report.", 400);

  const body = await request.json();
  const action = sanitizeText(body.action, 40);
  const note = sanitizeText(body.note, 1500);

  await connectDB();

  const report = await Report.findById(id);
  if (!report) return fail("Report not found.", 404);
  const prev = report.status;

  if (action === "assign") {
    if (!mongoose.isValidObjectId(body.assigneeId || "")) return fail("A valid assignee is required.", 400);
    report.assignedTo = body.assigneeId;
    if (report.status !== "WAITING_FOR_INFORMATION") report.status = "UNDER_REVIEW";
    report.history.push({
      status: report.status,
      note: note || "Assigned to a team member.",
      by: admin._id,
      byRole: "admin",
      at: new Date(),
    });
  } else if (action === "update_status") {
    const next = sanitizeText(body.status, 30);
    if (!WORKFLOW.includes(next)) return fail("Invalid report status.", 400);
    if (next === "WAITING_FOR_INFORMATION" && !note) return fail("A note is required when waiting for information.", 400);
    if (report.status === "RESOLVED" || report.status === "CLOSED" || report.status === next) return fail("This report is already closed or unchanged.", 400);
    report.status = next;
    report.history.push({
      status: next,
      note,
      by: admin._id,
      byRole: "admin",
      at: new Date(),
    });
    if (next === "RESOLVED") report.resolutionNote = note || report.resolutionNote;
  } else {
    return fail("Invalid action.", 400);
  }

  await report.save();

  audit({
    actor: admin._id,
    actorRole: "admin",
    entity: "report",
    entityId: String(report._id),
    action: `report_${action}`,
    previousStatus: prev,
    newStatus: report.status,
    reason: note,
  });

  await createNotification({
    userId: String(report.reporterId),
    type: "report_update",
    title: "Report status updated",
    message: `Your report (#${String(report._id).slice(-6)}) is now ${report.status.replace(/_/g, " ").toLowerCase()}. ${note ? "Note: " + note : ""}`,
    link: "/account",
  });

  return ok({ report, message: "Report updated." });
});