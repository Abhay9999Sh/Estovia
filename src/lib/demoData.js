/**
 * Realistic demo data used as a fallback for the homepage when MongoDB
 * does not yet contain listings. This is clearly separated from real
 * database data and is never written back into business logic.
 */

export const DEMO_LAND_LISTINGS = [
  {
    _id: "demo-1",
    title: "Premium Development Land",
    description:
      "Prime development plot located in a fast-growing residential corridor with excellent connectivity and clear title.",
    propertyType: "land",
    landUse: "residential",
    area: { value: 12000, unit: "sqft" },
    location: {
      address: "Greater Noida West, Uttar Pradesh",
      city: "Greater Noida",
      district: "Gautam Buddha Nagar",
      state: "Uttar Pradesh",
      pincode: "201310",
      latitude: 28.5546,
      longitude: 77.3925,
    },
    pricing: { amount: 24000000, type: "total", negotiable: true },
    verificationStatus: "verified",
    status: "active",
    views: 1284,
    interestedUsers: 24,
    ownerName: "Anil Verma",
    badges: ["Ownership Documents", "Location Verified"],
    image:
      "https://images.pexels.com/photos/462358/pexels-photo-462358.jpeg?cs=srgb&dl=architectural-design-architecture-blue-sky-462358.jpg&fm=jpg",
    images: [
      "https://images.pexels.com/photos/462358/pexels-photo-462358.jpeg?cs=srgb&dl=architectural-design-architecture-blue-sky-462358.jpg&fm=jpg",
    ],
    createdAt: "2026-01-15T00:00:00Z",
  },
  {
    _id: "demo-2",
    title: "Agricultural Farmland with Clear Title",
    description:
      "Irrigated agricultural land with fertile soil, water access and proximity to main highway.",
    propertyType: "land",
    landUse: "agricultural",
    area: { value: 2.5, unit: "acre" },
    location: {
      address: "Ranchi, Jharkhand",
      city: "Ranchi",
      district: "Ranchi",
      state: "Jharkhand",
      pincode: "834001",
      latitude: 23.3441,
      longitude: 85.3096,
    },
    pricing: { amount: 45000000, type: "per_acre", negotiable: false },
    verificationStatus: "verified",
    status: "active",
    views: 842,
    interestedUsers: 12,
    ownerName: "Meena Singh",
    badges: ["Ownership Documents", "Location Verified"],
    image:
      "https://images.pexels.com/photos/462358/pexels-photo-462358.jpeg?cs=srgb&dl=architectural-design-architecture-blue-sky-462358.jpg&fm=jpg",
    images: [
      "https://images.pexels.com/photos/462358/pexels-photo-462358.jpeg?cs=srgb&dl=architectural-design-architecture-blue-sky-462358.jpg&fm=jpg",
    ],
    createdAt: "2026-02-02T00:00:00Z",
  },
  {
    _id: "demo-3",
    title: "Commercial Plot Near Highway",
    description:
      "Strategically located commercial plot with high footfall potential, ideal for retail or office development.",
    propertyType: "plot",
    landUse: "commercial",
    area: { value: 0.8, unit: "acre" },
    location: {
      address: "Faridabad, Haryana",
      city: "Faridabad",
      district: "Faridabad",
      state: "Haryana",
      pincode: "121001",
      latitude: 28.4089,
      longitude: 77.3178,
    },
    pricing: { amount: 68000000, type: "total", negotiable: true },
    verificationStatus: "partially_verified",
    status: "active",
    views: 566,
    interestedUsers: 8,
    ownerName: "Rakesh Gupta",
    badges: ["Location Verified"],
    image:
      "https://images.pexels.com/photos/462358/pexels-photo-462358.jpeg?cs=srgb&dl=architectural-design-architecture-blue-sky-462358.jpg&fm=jpg",
    images: [
      "https://images.pexels.com/photos/462358/pexels-photo-462358.jpeg?cs=srgb&dl=architectural-design-architecture-blue-sky-462358.jpg&fm=jpg",
    ],
    createdAt: "2026-02-20T00:00:00Z",
  },
];

export function formatINR(amount) {
  if (!amount) return "₹0";
  return "₹" + new Intl.NumberFormat("en-IN", {
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatArea(area) {
  if (!area || area.value == null) return "—";
  const unitLabels = {
    sqft: "sq.ft",
    sqm: "sq.m",
    acre: "acre",
    hectare: "hectare",
    gunta: "gunta",
    bigha: "bigha",
    marla: "marla",
  };
  return `${area.value} ${unitLabels[area.unit] || area.unit}`;
}

export function formatDate(input) {
  if (!input) return "—";
  const d = new Date(input);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}
