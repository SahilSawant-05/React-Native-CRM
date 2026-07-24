export const OPPORTUNITY_INDUSTRY_OPTIONS = [
  { key: "", label: "Generic" },
  { key: "REAL_ESTATE", label: "Real Estate" },
  { key: "EDUCATION", label: "Education" },
  { key: "BIKE_SALES", label: "Bike Sales" },
  { key: "GENERIC", label: "Generic" },
];

const COMMON_FIELDS = [
  { key: "requirement", label: "Requirement", placeholder: "What is the customer looking for?", type: "text" },
  { key: "priority", label: "Priority", placeholder: "High, medium, low", type: "select", options: ["High", "Medium", "Low"] },
  { key: "nextStep", label: "Next Step", placeholder: "Next action to move this forward", type: "text" },
];

const INDUSTRY_FIELD_MAP = {
  REAL_ESTATE: {
    titlePlaceholder: "Rahul - 2BHK Wakad",
    itemLabel: "Property",
    amountLabel: "Budget / Deal Value",
    closeLabel: "Expected Booking Date",
    notesPlaceholder: "Preferred locality, family size, financing status, objections...",
    fields: [
      { key: "propertyType", label: "Property Type", type: "select", options: ["Flat", "Villa", "Plot", "Commercial"] },
      { key: "configuration", label: "Configuration", placeholder: "1BHK, 2BHK, 3BHK", type: "text" },
      { key: "preferredLocation", label: "Preferred Location", placeholder: "Wakad, Baner, Hinjewadi", type: "text" },
      { key: "budgetRange", label: "Budget Range", placeholder: "70L - 90L", type: "text" },
      { key: "possessionTimeline", label: "Possession Timeline", placeholder: "Ready, 6 months, 1 year", type: "text" },
      { key: "visitPreference", label: "Visit Preference", placeholder: "Weekend morning", type: "text" },
    ],
  },
  EDUCATION: {
    titlePlaceholder: "Aarav - Java Full Stack admission",
    itemLabel: "Course / Program",
    amountLabel: "Fee / Deal Value",
    closeLabel: "Expected Admission Date",
    notesPlaceholder: "Student goal, parent discussion, preferred batch, fee concerns...",
    fields: [
      { key: "courseInterest", label: "Course Interest", placeholder: "Java Full Stack, Spoken English", type: "text" },
      { key: "studentName", label: "Student Name", placeholder: "Student name", type: "text" },
      { key: "parentName", label: "Parent / Guardian", placeholder: "Parent or guardian name", type: "text" },
      { key: "batchPreference", label: "Batch Preference", type: "select", options: ["Morning", "Afternoon", "Evening", "Weekend"] },
      { key: "counselingStatus", label: "Counseling Status", type: "select", options: ["Pending", "Completed", "Demo Scheduled", "Fee Discussed"] },
      { key: "feeStatus", label: "Fee Status", type: "select", options: ["Not Discussed", "Pending", "Partial Paid", "Paid"] },
    ],
  },
  BIKE_SALES: {
    titlePlaceholder: "Priya - scooter test ride",
    itemLabel: "Vehicle",
    amountLabel: "Quotation Value",
    closeLabel: "Expected Booking Date",
    notesPlaceholder: "Model preference, exchange, finance, test ride feedback...",
    fields: [
      { key: "modelInterest", label: "Model Interest", placeholder: "Activa, Jupiter, Access", type: "text" },
      { key: "variant", label: "Variant", placeholder: "Disc, alloy, top model", type: "text" },
      { key: "colorPreference", label: "Color Preference", placeholder: "Black, red, white", type: "text" },
      { key: "exchangeVehicle", label: "Exchange Vehicle", type: "select", options: ["No", "Yes", "Maybe"] },
      { key: "financeRequired", label: "Finance Required", type: "select", options: ["No", "Yes", "Maybe"] },
      { key: "testRidePreference", label: "Test Ride Preference", placeholder: "Today evening", type: "text" },
    ],
  },
  GENERIC: {
    titlePlaceholder: "New customer requirement",
    itemLabel: "Mapped Item",
    amountLabel: "Amount",
    closeLabel: "Expected Close",
    notesPlaceholder: "Requirement details, objections, decision maker, next action...",
    fields: COMMON_FIELDS,
  },
};

export function normalizeIndustryKey(value) {
  return String(value || "GENERIC").trim().toUpperCase().replace(/[\s-]+/g, "_") || "GENERIC";
}

export function opportunityFieldConfig(industryKey) {
  return INDUSTRY_FIELD_MAP[normalizeIndustryKey(industryKey)] || INDUSTRY_FIELD_MAP.GENERIC;
}

export function parseOpportunityDetails(value) {
  if (!value) return {};
  if (typeof value === "object" && !Array.isArray(value)) return value;
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

export function serializeOpportunityDetails(details) {
  const cleaned = Object.fromEntries(
    Object.entries(details || {}).filter(([, value]) => value !== null && value !== undefined && String(value).trim() !== "")
  );
  return Object.keys(cleaned).length ? JSON.stringify(cleaned) : null;
}
