import { requireAuth } from "@/lib/auth";
import { connectDB } from "@/lib/mongodb";
import Project from "@/lib/models/Project";
import ProjectUnit from "@/lib/models/ProjectUnit";
import BuilderProfile from "@/lib/models/BuilderProfile";
import { ok } from "@/lib/api";
import { withErrorHandling } from "@/lib/api";

export const GET = withErrorHandling(async (request) => {
  const user = await requireAuth();
  const url = new URL(request.url);
  const q = (url.searchParams.get("q") || "").toLowerCase();
  const city = url.searchParams.get("city") || "";
  const type = url.searchParams.get("type") || "";

  await connectDB();

  const filter = {
    // Only show projects that are "visible" to buyers on the marketplace:
    // must not be in planning-only private states. Show active development.
    status: {
      $in: [
        "Documentation",
        "Approvals",
        "Under Construction",
        "Completed",
      ],
    },
  };
  if (city) filter["location.city"] = city;
  if (type) filter.projectType = type;
  if (q) {
    filter.$or = [{ name: { $regex: q, $options: "i" } }, { "location.city": { $regex: q, $options: "i" } }];
  }

  const projects = await Project.find(filter).lean();

  const projectIds = projects.map((p) => p._id);
  const unitCounts = await ProjectUnit.aggregate([
    { $match: { projectId: { $in: projectIds }, isActive: true, status: { $in: ["Available"] } } },
    { $group: { _id: "$projectId", count: { $sum: 1 }, minPrice: { $min: "$price" }, avgSqft: { $avg: "$sizeSqFt" } } },
  ]);
  const countMap = unitCounts.reduce((acc, u) => {
    acc[String(u._id)] = u;
    return acc;
  }, {});

  const builderIds = projects.map((p) => String(p.builderId));
  const builderProfiles = await BuilderProfile.find({ userId: { $in: builderIds } })
    .select("userId companyName logo reraRegistrations")
    .lean();
  const builderMap = builderProfiles.reduce((acc, b) => {
    acc[String(b.userId)] = b;
    return acc;
  }, {});

  const result = projects
    .map((p) => {
      const units = countMap[String(p._id)];
      const builder = builderMap[String(p.builderId)];
      const reraVerified = builder?.reraRegistrations?.some((r) => r.status === "verified");
      return {
        _id: p._id,
        name: p.name,
        description: p.description,
        projectType: p.projectType,
        location: p.location,
        images: p.images,
        status: p.status,
        completionDate: p.completionDate,
        builderId: p.builderId,
        builderName: builder?.companyName || "",
        builderLogo: builder?.logo || "",
        reraVerified,
        unitSummary: units
          ? { count: units.count, minPrice: units.minPrice, avgSqft: Math.round(units.avgSqft || 0) }
          : { count: 0, minPrice: 0, avgSqft: 0 },
      };
    })
    .sort((a, b) => (b.unitSummary.count || 0) - (a.unitSummary.count || 0));

  return ok({ projects: result });
});
