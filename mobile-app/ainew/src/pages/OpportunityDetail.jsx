import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  CalendarPlus,
  CheckCircle2,
  CircleDollarSign,
  Clock3,
  Edit3,
  Image as ImageIcon,
  Mail,
  MessageCircle,
  Phone,
  Send,
  Target,
  UserRound,
} from "lucide-react";
import api from "../api/axios";
import EmailTemplatePicker from "../components/email/EmailTemplatePicker";
import MediaLibraryDialog from "../components/media/MediaLibraryDialog";
import SendWhatsAppFlowModal from "../components/whatsapp/SendWhatsAppFlowModal";
import AiAssistPanel from "../components/ai/AiAssistPanel";
import {
  OPPORTUNITY_INDUSTRY_OPTIONS,
  opportunityFieldConfig,
  parseOpportunityDetails,
  serializeOpportunityDetails,
} from "../config/opportunityFields";

const EmailDesigner = lazy(() => import("../components/email/EmailDesigner"));

function EmailComposeModal({
  open,
  opportunity,
  contact,
  form,
  sending,
  templateVersion,
  mergeData,
  onClose,
  onSubmit,
  onChange,
  onDesignChange,
  onTemplateApply,
  onMediaAsset,
}) {
  const [mediaDialogOpen, setMediaDialogOpen] = useState(false);

  if (!open || !opportunity) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="max-h-[94vh] w-full max-w-6xl overflow-y-auto rounded-xl bg-white p-6 shadow-2xl">
        <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-extrabold text-gray-950">Compose Email</h2>
            <p className="mt-1 text-sm text-gray-500">
              {opportunity.title} {contact?.name ? `- ${contact.name}` : ""}
            </p>
          </div>
          <button type="button" onClick={onClose} className="rounded-md px-2 py-1 text-gray-500 hover:bg-gray-100">
            x
          </button>
        </div>

        <form onSubmit={onSubmit} className="space-y-3">
          <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <input
              value={form.toEmail}
              onChange={(event) => onChange("toEmail", event.target.value)}
              placeholder="To email, or use contact email"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-teal-500"
            />
            <input
              value={form.subject}
              onChange={(event) => onChange("subject", event.target.value)}
              placeholder="Subject"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-teal-500"
            />
          </div>

          <EmailTemplatePicker onApply={onTemplateApply} mergeData={mergeData} />

          <AiAssistPanel
            contactId={opportunity.contactId}
            title="AI Opportunity Email"
            contextPrompt={`Draft a professional follow-up email for this opportunity.
Opportunity: ${opportunity.title || ""}
Stage: ${opportunity.stage || ""}
Contact: ${contact?.name || opportunity.contactName || ""}
Phone: ${contact?.phone || opportunity.contactPhone || ""}
Subject: ${form.subject || ""}
Current draft:
${form.bodyText || ""}`}
            replyPrompt={`Write a concise CRM follow-up email body for this opportunity. Include one clear next step.
Opportunity: ${opportunity.title || ""}
Stage: ${opportunity.stage || ""}
Contact: ${contact?.name || opportunity.contactName || "Customer"}
Pipeline: ${mergeData.pipelineName || ""}
Subject: ${form.subject || ""}`}
            onApply={(text) => onChange("bodyText", [form.bodyText, text].filter(Boolean).join(form.bodyText ? "\n\n" : ""))}
            applyLabel="Use in email"
            compact
          />

          <div className="flex flex-wrap items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
            <button
              type="button"
              onClick={() => setMediaDialogOpen(true)}
              className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-100"
            >
              <ImageIcon size={16} />
              Choose media
            </button>
            <span className="text-xs font-medium text-gray-500">Use the designer image block for direct image upload or replacement.</span>
          </div>

          <MediaLibraryDialog
            open={mediaDialogOpen}
            title="Choose opportunity email media"
            helper="Select an image or file to insert into this opportunity email."
            allowedTypes={["IMAGE", "DOCUMENT", "VIDEO", "AUDIO"]}
            onSelect={onMediaAsset}
            onClose={() => setMediaDialogOpen(false)}
          />

          <Suspense fallback={<div className="rounded-lg border border-gray-200 p-4 text-center text-sm text-gray-500">Loading email designer...</div>}>
            <div className="email-designer-scroll">
              <EmailDesigner
                key={`opportunity-email-${opportunity.id}-${templateVersion}`}
                subject={form.subject}
                value={form}
                onChange={onDesignChange}
                height="640px"
              />
            </div>
          </Suspense>

          <textarea
            rows={4}
            value={form.bodyText}
            onChange={(event) => onChange("bodyText", event.target.value)}
            placeholder="Plain text fallback"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-teal-500"
          />

          <div className="flex flex-col gap-2 border-t border-gray-100 pt-4 sm:flex-row sm:justify-end">
            <button type="button" onClick={onClose} className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50">
              Cancel
            </button>
            <button
              disabled={sending || !form.subject.trim() || (!form.bodyHtml.trim() && !form.bodyText.trim())}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-teal-700 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-800 disabled:opacity-60"
            >
              <Send size={16} />
              {sending ? "Sending..." : "Send Email"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

const DEFAULT_STAGES = [
  { stageKey: "NEW", label: "New", displayOrder: 1, active: true },
  { stageKey: "QUALIFIED", label: "Qualified", displayOrder: 2, active: true },
  { stageKey: "FOLLOW_UP", label: "Follow Up", displayOrder: 3, active: true },
  { stageKey: "WON", label: "Won", displayOrder: 4, active: true },
  { stageKey: "LOST", label: "Lost", displayOrder: 5, active: true },
];

const DOMAIN_FIELD_LABELS = {
  bedrooms: "Bedrooms",
  bathrooms: "Bathrooms",
  carpetArea: "Carpet area",
  possession: "Possession",
  furnishing: "Furnishing",
  developer: "Developer",
  duration: "Duration",
  batchDate: "Batch date",
  mode: "Mode",
  eligibility: "Eligibility",
  counselor: "Counselor",
  seats: "Seats",
  variant: "Variant",
  color: "Color",
  fuelType: "Fuel type",
  stockStatus: "Stock",
  registrationYear: "Registration year",
  testRideAvailable: "Test ride",
};

const APPOINTMENT_LABELS = {
  SITE_VISIT: "Site Visit",
  COUNSELING_SESSION: "Counseling Session",
  DEMO_SESSION: "Demo Session",
  TEST_RIDE: "Test Ride",
  FOLLOW_UP_MEETING: "Follow-up Meeting",
  GENERAL: "General Appointment",
};

const APPOINTMENT_STATUSES = ["SCHEDULED", "COMPLETED", "NO_SHOW", "CANCELLED"];
const INDUSTRY_OPTIONS = OPPORTUNITY_INDUSTRY_OPTIONS;

const industryLabel = (value) => {
  const option = INDUSTRY_OPTIONS.find((industry) => industry.key === value);
  if (option) return option.label;
  return String(value || "Generic")
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
};

const appointmentTypeForIndustry = (industryKey) => {
  if (industryKey === "REAL_ESTATE") return "SITE_VISIT";
  if (industryKey === "EDUCATION") return "COUNSELING_SESSION";
  if (industryKey === "BIKE_SALES") return "TEST_RIDE";
  return "FOLLOW_UP_MEETING";
};

const normalizeList = (payload) => {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.items)) return payload.items;
  if (Array.isArray(payload?.content)) return payload.content;
  return [];
};

const buildStages = (rawStages) => {
  const source = rawStages?.length ? rawStages : DEFAULT_STAGES;
  return source
    .filter((stage) => stage.active !== false)
    .sort((a, b) => (a.displayOrder ?? 100) - (b.displayOrder ?? 100))
    .map((stage) => ({
      key: String(stage.stageKey || stage.key || stage.label || "NEW").trim().toUpperCase().replace(/[\s-]+/g, "_"),
      label: stage.label || String(stage.stageKey || stage.key || "NEW").replaceAll("_", " "),
    }));
};

const formatAmount = (value) => {
  if (value === null || value === undefined || value === "") return "-";
  const number = Number(value);
  if (Number.isNaN(number)) return String(value);
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(number);
};

const formatDate = (value) => {
  if (!value) return "-";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString("en-IN");
};

const toDateTimeLocal = (date = new Date()) => {
  const offsetMs = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
};

const parseMetadata = (value) => {
  if (!value) return {};
  if (typeof value === "object") return value;
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
};

const visibleMetadataEntries = (metadata) =>
  Object.entries(parseMetadata(metadata)).filter(([key, value]) => {
    if (!key || key.startsWith("__")) return false;
    if (value === null || value === undefined) return false;
    if (typeof value === "object") return false;
    return String(value).trim() !== "";
  });

const timelineLabel = (item) => {
  if (item.itemType === "APPOINTMENT") return "Appointment";
  if (item.itemType === "EMAIL") return "Email";
  if (item.itemType === "OPPORTUNITY") return "Opportunity";
  if (item.itemType === "MESSAGE") {
    const text = `${item.title || ""} ${item.description || ""} ${item.textBody || ""}`;
    return item.mediaType === "FLOW" || text.includes("[WhatsApp Flow]") ? "WhatsApp Flow" : "WhatsApp";
  }
  if (item.itemType === "TASK") return "Task";
  if (item.itemType === "NOTE") return "Note";
  return item.itemType || "Activity";
};

const stageTone = (stage) => {
  const normalized = String(stage || "").toUpperCase();
  if (normalized === "WON") return "bg-emerald-50 text-emerald-700 border-emerald-200";
  if (normalized === "LOST") return "bg-red-50 text-red-700 border-red-200";
  if (normalized.includes("FOLLOW")) return "bg-amber-50 text-amber-700 border-amber-200";
  return "bg-teal-50 text-teal-700 border-teal-200";
};

const priorityTone = (priority) => {
  const normalized = String(priority || "").toUpperCase();
  if (normalized === "URGENT") return "bg-red-50 text-red-700";
  if (normalized === "HIGH") return "bg-orange-50 text-orange-700";
  if (normalized === "LOW") return "bg-slate-100 text-slate-600";
  return "bg-blue-50 text-blue-700";
};

const textPreview = (value) =>
  String(value || "")
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();

function EditOpportunityModal({ open, opportunity, stages, domainItems, saving, onClose, onSave }) {
  const [form, setForm] = useState({
    title: "",
    domainItemId: "",
    amount: "",
    expectedRevenue: "",
    probability: "",
    priority: "MEDIUM",
    lostReason: "",
    activitySlaHours: "",
    expectedCloseDate: "",
    source: "",
    notes: "",
    details: {},
  });

  useEffect(() => {
    if (!open || !opportunity) return;
    setForm({
      title: opportunity.title || "",
      domainItemId: opportunity.domainItemId ? String(opportunity.domainItemId) : "",
      amount: opportunity.amount ?? "",
      expectedRevenue: opportunity.expectedRevenue ?? "",
      probability: opportunity.probability ?? "",
      priority: opportunity.priority || "MEDIUM",
      lostReason: opportunity.lostReason || "",
      activitySlaHours: opportunity.activitySlaHours ?? "",
      expectedCloseDate: opportunity.expectedCloseDate || "",
      source: opportunity.source || "",
      notes: opportunity.notes || "",
      details: parseOpportunityDetails(opportunity.detailsJson),
    });
  }, [open, opportunity, stages]);

  if (!open || !opportunity) return null;

  const opportunityIndustryKey = opportunity.industryKey || "GENERIC";
  const config = opportunityFieldConfig(opportunityIndustryKey);
  const setValue = (field, value) => setForm((current) => ({ ...current, [field]: value }));
  const setDetailValue = (fieldKey, value) => {
    setForm((current) => ({
      ...current,
      details: {
        ...(current.details || {}),
        [fieldKey]: value,
      },
    }));
  };

  const submit = () => {
    if (!form.title.trim()) return;
    if (opportunity.stage === "LOST" && !form.lostReason.trim()) {
      window.alert("Lost reason is required before saving a Lost opportunity.");
      return;
    }
    const activeDetailKeys = new Set(config.fields.map((field) => field.key));
    const activeDetails = Object.fromEntries(
      Object.entries(form.details || {}).filter(([key]) => activeDetailKeys.has(key))
    );
    onSave({
      contactId: opportunity.contactId,
      pipelineId: opportunity.pipelineId || null,
      ownerUserId: opportunity.ownerUserId,
      title: form.title.trim(),
      industryKey: opportunityIndustryKey,
      domainItemId: form.domainItemId ? Number(form.domainItemId) : null,
      stage: opportunity.stage || stages[0]?.key || "NEW",
      amount: form.amount === "" ? null : Number(form.amount),
      expectedRevenue: form.expectedRevenue === "" ? null : Number(form.expectedRevenue),
      probability: form.probability === "" ? null : Number(form.probability),
      priority: form.priority || "MEDIUM",
      lostReason: form.lostReason.trim() || null,
      activitySlaHours: form.activitySlaHours === "" ? null : Number(form.activitySlaHours),
      expectedCloseDate: form.expectedCloseDate || null,
      source: form.source.trim() || null,
      notes: form.notes.trim() || null,
      detailsJson: serializeOpportunityDetails(activeDetails),
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-xl bg-white p-6 shadow-2xl">
        <div className="mb-5 flex items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-gray-950">Edit Opportunity</h2>
            <p className="text-sm text-gray-500">{opportunity.contactName || "Unknown contact"}</p>
          </div>
          <button onClick={onClose} className="rounded-md px-2 py-1 text-gray-500 hover:bg-gray-100">x</button>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <label className="block md:col-span-2">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">Title</span>
            <input
              value={form.title}
              onChange={(event) => setValue("title", event.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-teal-500"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">Pipeline</span>
            <div className="min-h-10 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm font-semibold text-gray-700">
              {opportunity.pipelineName || "Selected Pipeline"} <span className="font-medium text-gray-400">• {industryLabel(opportunityIndustryKey)}</span>
            </div>
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">{config.amountLabel}</span>
            <input
              type="number"
              value={form.amount}
              onChange={(event) => setValue("amount", event.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-teal-500"
            />
          </label>
          <label className="block md:col-span-2">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">Mapped Catalog Item</span>
            <select
              value={form.domainItemId}
              onChange={(event) => {
                const value = event.target.value;
                const selectedItem = domainItems.find((item) => String(item.id) === value);
                setForm((current) => ({
                  ...current,
                  domainItemId: value,
                  amount: selectedItem?.price != null && current.amount === "" ? selectedItem.price : current.amount,
                }));
              }}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-teal-500"
            >
              <option value="">No catalog item mapped</option>
              {domainItems.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}{item.category ? ` - ${item.category}` : ""}{item.location ? ` - ${item.location}` : ""}
                </option>
              ))}
            </select>
            {domainItems.length === 0 && (
              <p className="mt-1 text-xs font-medium text-amber-700">
                No active catalog items found for this pipeline context. Add items from Domain Catalog first.
              </p>
            )}
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">{config.closeLabel}</span>
            <input
              type="date"
              value={form.expectedCloseDate}
              onChange={(event) => setValue("expectedCloseDate", event.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-teal-500"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">Expected Revenue</span>
            <input
              type="number"
              value={form.expectedRevenue}
              onChange={(event) => setValue("expectedRevenue", event.target.value)}
              placeholder="Auto from amount x probability"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-teal-500"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">Probability %</span>
            <input
              type="number"
              min="0"
              max="100"
              value={form.probability}
              onChange={(event) => setValue("probability", event.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-teal-500"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">Priority</span>
            <select
              value={form.priority}
              onChange={(event) => setValue("priority", event.target.value)}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-teal-500"
            >
              <option value="LOW">Low</option>
              <option value="MEDIUM">Medium</option>
              <option value="HIGH">High</option>
              <option value="URGENT">Urgent</option>
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">Activity SLA Hours</span>
            <input
              type="number"
              min="0"
              value={form.activitySlaHours}
              onChange={(event) => setValue("activitySlaHours", event.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-teal-500"
            />
          </label>
          {(opportunity.stage === "LOST" || form.lostReason) && (
            <label className="block md:col-span-2">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">Lost Reason</span>
              <input
                value={form.lostReason}
                onChange={(event) => setValue("lostReason", event.target.value)}
                placeholder="Budget, no response, competitor, not eligible..."
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-teal-500"
              />
            </label>
          )}
          <label className="block md:col-span-2">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">Source</span>
            <input
              value={form.source}
              onChange={(event) => setValue("source", event.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-teal-500"
            />
          </label>

          <div className="md:col-span-2">
            <div className="mb-2 flex items-center justify-between gap-3">
              <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">Opportunity Details</span>
              <span className="text-[11px] font-medium text-gray-400">{config.itemLabel}</span>
            </div>
            <div className="grid gap-3 rounded-lg border border-gray-100 bg-slate-50 p-3 md:grid-cols-2">
              {config.fields.map((field) => (
                <label key={field.key} className="block">
                  <span className="mb-1 block text-xs font-semibold text-gray-500">{field.label}</span>
                  {field.type === "select" ? (
                    <select
                      value={form.details?.[field.key] || ""}
                      onChange={(event) => setDetailValue(field.key, event.target.value)}
                      className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-teal-500"
                    >
                      <option value="">Select</option>
                      {(field.options || []).map((option) => (
                        <option key={option} value={option}>{option}</option>
                      ))}
                    </select>
                  ) : (
                    <input
                      value={form.details?.[field.key] || ""}
                      onChange={(event) => setDetailValue(field.key, event.target.value)}
                      placeholder={field.placeholder || field.label}
                      className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-teal-500"
                    />
                  )}
                </label>
              ))}
            </div>
          </div>

          <label className="block md:col-span-2">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">Notes</span>
            <textarea
              rows={4}
              value={form.notes}
              onChange={(event) => setValue("notes", event.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-teal-500"
            />
          </label>
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50">
            Cancel
          </button>
          <button onClick={submit} disabled={saving || !form.title.trim()} className="rounded-lg bg-teal-700 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-800 disabled:opacity-60">
            {saving ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function OpportunityDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [opportunity, setOpportunity] = useState(null);
  const [contact, setContact] = useState(null);
  const [domainItem, setDomainItem] = useState(null);
  const [domainItems, setDomainItems] = useState([]);
  const [timeline, setTimeline] = useState([]);
  const [emails, setEmails] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [stages, setStages] = useState(buildStages(DEFAULT_STAGES));
  const [stageValue, setStageValue] = useState("");
  const [emailForm, setEmailForm] = useState({ toEmail: "", subject: "", bodyHtml: "", bodyText: "", designJson: "", mjml: "" });
  const [emailComposeOpen, setEmailComposeOpen] = useState(false);
  const [emailTemplateVersion, setEmailTemplateVersion] = useState(0);
  const [appointmentForm, setAppointmentForm] = useState({
    appointmentType: "FOLLOW_UP_MEETING",
    startAt: toDateTimeLocal(new Date(Date.now() + 24 * 60 * 60 * 1000)),
    endAt: toDateTimeLocal(new Date(Date.now() + 25 * 60 * 60 * 1000)),
    location: "",
    description: "",
  });
  const [appointmentEdits, setAppointmentEdits] = useState({});
  const [updatingAppointmentId, setUpdatingAppointmentId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [savingStage, setSavingStage] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [flowModalOpen, setFlowModalOpen] = useState(false);
  const [savingOpportunity, setSavingOpportunity] = useState(false);
  const [noteText, setNoteText] = useState("");
  const [savingNote, setSavingNote] = useState(false);
  const [sendingEmail, setSendingEmail] = useState(false);
  const [message, setMessage] = useState("");

  const currentStage = useMemo(
    () => stages.find((stage) => stage.key === opportunity?.stage),
    [opportunity?.stage, stages]
  );

  const opportunityDetails = useMemo(
    () => parseOpportunityDetails(opportunity?.detailsJson),
    [opportunity?.detailsJson]
  );

  const opportunityConfig = useMemo(
    () => opportunityFieldConfig(opportunity?.industryKey),
    [opportunity?.industryKey]
  );

  const visibleOpportunityDetails = useMemo(
    () => opportunityConfig.fields
      .map((field) => ({ ...field, value: opportunityDetails[field.key] }))
      .filter((field) => field.value !== null && field.value !== undefined && String(field.value).trim() !== ""),
    [opportunityConfig, opportunityDetails]
  );

  const timelineCounts = useMemo(() => {
    const counts = { MESSAGE: 0, TASK: 0, EMAIL: 0, APPOINTMENT: 0 };
    timeline.forEach((item) => {
      if (counts[item.itemType] !== undefined) counts[item.itemType] += 1;
    });
    return counts;
  }, [timeline]);

  const nextAppointment = useMemo(() => {
    const now = Date.now();
    return appointments
      .filter((appointment) => appointment.startAt && new Date(appointment.startAt).getTime() >= now)
      .sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime())[0] || null;
  }, [appointments]);

  const latestEmail = useMemo(
    () => [...emails].sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())[0] || null,
    [emails]
  );

  const latestActivity = useMemo(
    () => [...timeline].sort((a, b) => new Date(b.occurredAt || 0).getTime() - new Date(a.occurredAt || 0).getTime())[0] || null,
    [timeline]
  );

  const recentTimeline = useMemo(
    () => [...timeline].sort((a, b) => new Date(b.occurredAt || 0).getTime() - new Date(a.occurredAt || 0).getTime()),
    [timeline]
  );

  const emailMergeData = useMemo(
    () => ({
      contactName: contact?.name || opportunity?.contactName || "",
      contactPhone: contact?.phone || opportunity?.contactPhone || "",
      contactEmail: contact?.email || emailForm.toEmail || "",
      leadSource: contact?.leadSource || opportunity?.source || "",
      opportunityName: opportunity?.title || "",
      pipelineName: opportunity?.pipelineName || "",
      agentName: opportunity?.ownerUserEmail || "",
    }),
    [contact, opportunity, emailForm.toEmail]
  );

  const probabilityValue = Number(opportunity?.probability ?? 0);
  const probabilityWidth = Number.isFinite(probabilityValue) ? Math.max(0, Math.min(100, probabilityValue)) : 0;

  const loadDetail = useCallback(async () => {
    setLoading(true);
    setMessage("");
    try {
      const opportunityResponse = await api.get(`/api/opportunities/${id}`);
      const nextOpportunity = opportunityResponse.data;
      const [stageResponse, emailResponse, appointmentResponse, domainItemsResponse] = await Promise.all([
        api.get(
          "/api/crm-config/pipeline-stages",
          nextOpportunity.pipelineId ? { params: { pipelineId: nextOpportunity.pipelineId } } : undefined
        ),
        api.get("/api/email/logs", { params: { opportunityId: id } }),
        api.get(`/api/events/opportunity/${id}`),
        api.get("/api/domain-items", {
          params: {
            industryKey: nextOpportunity.industryKey || undefined,
            activeOnly: true,
          },
        }),
      ]);
      const nextStages = buildStages(stageResponse.data || []);
      setOpportunity(nextOpportunity);
      setStageValue(nextOpportunity.stage || nextStages[0]?.key || "NEW");
      setStages(nextStages);
      setEmails(normalizeList(emailResponse.data));
      setAppointments(normalizeList(appointmentResponse.data));
      setDomainItems(normalizeList(domainItemsResponse.data));
      setAppointmentEdits(
        normalizeList(appointmentResponse.data).reduce((next, appointment) => {
          next[appointment.id] = {
            status: appointment.status || "SCHEDULED",
            outcome: appointment.outcome || "",
            followUpDueAt: toDateTimeLocal(new Date(Date.now() + 24 * 60 * 60 * 1000)),
            followUpTitle: `Follow up after ${appointment.title}`,
          };
          return next;
        }, {})
      );
      setAppointmentForm((current) => ({
        ...current,
        appointmentType: current.appointmentType === "FOLLOW_UP_MEETING"
          ? appointmentTypeForIndustry(nextOpportunity.industryKey)
          : current.appointmentType,
      }));
      setEmailForm((current) => ({
        ...current,
        subject: current.subject || `Regarding ${nextOpportunity.title}`,
      }));
      if (nextOpportunity.domainItemId) {
        try {
          const domainItemResponse = await api.get(`/api/domain-items/${nextOpportunity.domainItemId}`);
          setDomainItem(domainItemResponse.data);
        } catch {
          setDomainItem(null);
        }
      } else {
        setDomainItem(null);
      }

      if (nextOpportunity.contactId) {
        const [contactResponse, timelineResponse] = await Promise.allSettled([
          api.get(`/api/contacts/${nextOpportunity.contactId}`),
          api.get(`/api/opportunities/${id}/timeline`),
        ]);
        setContact(contactResponse.status === "fulfilled" ? contactResponse.value.data : null);
        setTimeline(timelineResponse.status === "fulfilled" ? normalizeList(timelineResponse.value.data?.items) : []);
      }
    } catch (error) {
      setMessage(error?.response?.data?.message || error.message || "Failed to load opportunity");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadDetail();
  }, [loadDetail]);

  const moveStage = async () => {
    if (!stageValue || !opportunity) return;
    let lostReason = opportunity.lostReason || "";
    if (stageValue === "LOST") {
      const enteredReason = window.prompt("Lost reason is required before marking this opportunity as Lost.", lostReason);
      if (!enteredReason || !enteredReason.trim()) {
        setMessage("Lost reason is required.");
        return;
      }
      lostReason = enteredReason.trim();
    }
    setSavingStage(true);
    setMessage("");
    try {
      const response = await api.post(`/api/opportunities/${opportunity.id}/stage`, {
        stage: stageValue,
        lostReason: stageValue === "LOST" ? lostReason : null,
      });
      setOpportunity(response.data);
      setMessage("Opportunity stage updated.");
      await loadDetail();
    } catch (error) {
      setMessage(error?.response?.data?.message || error.message || "Stage update failed");
    } finally {
      setSavingStage(false);
    }
  };

  const saveOpportunityDetails = async (payload) => {
    if (!opportunity) return;
    setSavingOpportunity(true);
    setMessage("");
    try {
      const response = await api.put(`/api/opportunities/${opportunity.id}`, payload);
      setOpportunity(response.data);
      setStageValue(response.data.stage || stages[0]?.key || "NEW");
      setEditOpen(false);
      setMessage("Opportunity details updated.");
      await loadDetail();
    } catch (error) {
      setMessage(error?.response?.data?.message || error.message || "Opportunity update failed");
    } finally {
      setSavingOpportunity(false);
    }
  };

  const sendEmail = async (event) => {
    event.preventDefault();
    if (!opportunity || !emailForm.subject.trim() || (!emailForm.bodyHtml.trim() && !emailForm.bodyText.trim())) return;
    setSendingEmail(true);
    setMessage("");
    try {
      await api.post("/api/email/send", {
        contactId: opportunity.contactId,
        opportunityId: opportunity.id,
        toEmail: emailForm.toEmail.trim() || null,
        subject: emailForm.subject.trim(),
        bodyHtml: emailForm.bodyHtml.trim() || null,
        bodyText: emailForm.bodyText.trim(),
      });
      setEmailForm({ toEmail: "", subject: `Regarding ${opportunity.title}`, bodyHtml: "", bodyText: "", designJson: "", mjml: "" });
      setEmailTemplateVersion((version) => version + 1);
      setEmailComposeOpen(false);
      setMessage("Email sent.");
      await loadDetail();
    } catch (error) {
      setMessage(error?.response?.data?.message || error.message || "Email failed");
    } finally {
      setSendingEmail(false);
    }
  };

  const flowContact = useMemo(() => {
    if (!opportunity?.contactId) return null;
    return {
      ...(contact || {}),
      id: opportunity.contactId,
      name: contact?.name || opportunity.contactName,
      phone: contact?.phone || opportunity.contactPhone,
    };
  }, [contact, opportunity]);

  const handleFlowSent = async () => {
    setFlowModalOpen(false);
    setMessage("WhatsApp Flow sent. Delivery status will appear in the contact timeline.");
    await loadDetail();
  };

  const saveOpportunityNote = async (event) => {
    event.preventDefault();
    if (!opportunity?.contactId || !noteText.trim()) return;
    setSavingNote(true);
    setMessage("");
    try {
      await api.post(`/api/contacts/${opportunity.contactId}/notes`, {
        note: noteText.trim(),
        opportunityId: opportunity.id,
      });
      setNoteText("");
      setMessage("Opportunity note added.");
      await loadDetail();
    } catch (error) {
      setMessage(error?.response?.data?.message || error.message || "Note save failed");
    } finally {
      setSavingNote(false);
    }
  };

  const setEmailDesign = (designerValue) => {
    setEmailForm((current) => ({
      ...current,
      designJson: designerValue.designJson || current.designJson || "",
      mjml: designerValue.mjml || current.mjml || "",
      bodyHtml: designerValue.bodyHtml || current.bodyHtml || "",
    }));
  };

  const setEmailValue = (field, value) => {
    setEmailForm((current) => ({ ...current, [field]: value }));
  };

  const applyEmailTemplate = (payload) => {
    setEmailForm((current) => ({
      ...current,
      subject: payload.subject || current.subject,
      bodyHtml: payload.bodyHtml || "",
      bodyText: payload.bodyText || "",
      designJson: payload.designJson || "",
      mjml: payload.mjml || "",
    }));
    setEmailTemplateVersion((version) => version + 1);
  };

  const insertEmailMedia = (asset) => {
    const htmlSnippet = mediaHtmlSnippet(asset);
    const textSnippet = `${asset.name || asset.originalFileName}: ${asset.publicUrl}`;
    setEmailForm((current) => ({
      ...current,
      bodyHtml: `${current.bodyHtml || ""}${htmlSnippet}`,
      bodyText: [current.bodyText, textSnippet].filter(Boolean).join("\n"),
    }));
    setEmailTemplateVersion((version) => version + 1);
  };

  const scheduleAppointment = async (event) => {
    event.preventDefault();
    if (!opportunity) {
      setMessage("Appointment cannot be scheduled because the opportunity is not loaded yet.");
      return;
    }
    if (!appointmentForm.startAt) {
      setMessage("Appointment cannot be scheduled because start date and time are missing.");
      return;
    }
    if (appointmentForm.endAt && new Date(appointmentForm.endAt) <= new Date(appointmentForm.startAt)) {
      setMessage("Appointment cannot be scheduled because end time must be after start time.");
      return;
    }
    setMessage("");
    try {
      await api.post("/api/events", {
        title: `${APPOINTMENT_LABELS[appointmentForm.appointmentType] || "Appointment"} - ${opportunity.title}`,
        description: appointmentForm.description || null,
        category: "MEETING",
        appointmentType: appointmentForm.appointmentType,
        status: "SCHEDULED",
        location: appointmentForm.location || null,
        contactId: opportunity.contactId,
        opportunityId: opportunity.id,
        startAt: new Date(appointmentForm.startAt).toISOString(),
        endAt: appointmentForm.endAt ? new Date(appointmentForm.endAt).toISOString() : null,
        allDay: false,
      });
      setMessage("Appointment scheduled.");
      setAppointmentForm((current) => ({
        ...current,
        startAt: toDateTimeLocal(new Date(Date.now() + 24 * 60 * 60 * 1000)),
        endAt: toDateTimeLocal(new Date(Date.now() + 25 * 60 * 60 * 1000)),
        location: "",
        description: "",
      }));
      await loadDetail();
    } catch (error) {
      setMessage(error?.response?.data?.message || error.message || "Appointment scheduling failed");
    }
  };

  const updateAppointmentEdit = (appointmentId, field, value) => {
    setAppointmentEdits((current) => ({
      ...current,
      [appointmentId]: {
        ...(current[appointmentId] || {}),
        [field]: value,
      },
    }));
  };

  const updateAppointmentOutcome = async (appointment, createFollowUpTask = false) => {
    const edit = appointmentEdits[appointment.id] || {};
    setUpdatingAppointmentId(appointment.id);
    setMessage("");
    try {
      await api.put(`/api/events/${appointment.id}`, {
        title: appointment.title,
        description: appointment.description || null,
        category: appointment.category || "MEETING",
        appointmentType: appointment.appointmentType || "GENERAL",
        status: edit.status || appointment.status || "SCHEDULED",
        location: appointment.location || null,
        contactId: appointment.contactId || opportunity.contactId,
        opportunityId: appointment.opportunityId || opportunity.id,
        startAt: appointment.startAt,
        endAt: appointment.endAt,
        allDay: Boolean(appointment.allDay),
        outcome: edit.outcome || null,
        createFollowUpTask,
        followUpTitle: edit.followUpTitle || `Follow up after ${appointment.title}`,
        followUpDescription: edit.outcome || appointment.description || null,
        followUpDueAt: edit.followUpDueAt ? new Date(edit.followUpDueAt).toISOString() : null,
      });
      setMessage(createFollowUpTask ? "Appointment updated and follow-up task created." : "Appointment updated.");
      await loadDetail();
    } catch (error) {
      setMessage(error?.response?.data?.message || error.message || "Appointment update failed");
    } finally {
      setUpdatingAppointmentId(null);
    }
  };

  if (loading && !opportunity) {
    return <div className="min-h-screen bg-slate-50 p-6 text-sm text-gray-500">Loading opportunity...</div>;
  }

  if (!opportunity) {
    return (
      <div className="min-h-screen bg-slate-50 p-6">
        <button onClick={() => navigate("/dashboard/pipeline")} className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700">
          Back to Pipeline
        </button>
        <p className="mt-4 text-sm text-red-600">{message || "Opportunity not found."}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 p-6 text-gray-900">
      <EditOpportunityModal
        open={editOpen}
        opportunity={opportunity}
        stages={stages}
        domainItems={domainItems}
        saving={savingOpportunity}
        onClose={() => setEditOpen(false)}
        onSave={saveOpportunityDetails}
      />
      <EmailComposeModal
        open={emailComposeOpen}
        opportunity={opportunity}
        contact={contact}
        form={emailForm}
        sending={sendingEmail}
        templateVersion={emailTemplateVersion}
        mergeData={emailMergeData}
        onClose={() => setEmailComposeOpen(false)}
        onSubmit={sendEmail}
        onChange={setEmailValue}
        onDesignChange={setEmailDesign}
        onTemplateApply={applyEmailTemplate}
        onMediaAsset={insertEmailMedia}
      />
      <SendWhatsAppFlowModal
        open={flowModalOpen}
        contact={flowContact}
        contextLabel={opportunity.title}
        onClose={() => setFlowModalOpen(false)}
        onSent={handleFlowSent}
      />
      <div className="mx-auto max-w-[1500px]">
        <header className="mb-6 rounded-lg border border-gray-200 bg-white shadow-sm">
          <div className="border-b border-gray-100 p-5">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
              <div className="min-w-0">
                <Link to="/dashboard/pipeline" className="inline-flex items-center gap-2 text-sm font-semibold text-teal-700">
                  <ArrowLeft size={16} />
                  Pipeline
                </Link>
                <div className="mt-3 flex flex-wrap items-center gap-3">
                  <h1 className="break-words text-3xl font-extrabold text-gray-950">{opportunity.title}</h1>
                  <span className={`rounded-full border px-3 py-1 text-xs font-bold ${stageTone(opportunity.stage)}`}>
                    {currentStage?.label || opportunity.stage}
                  </span>
                  <span className={`rounded-full px-3 py-1 text-xs font-bold ${priorityTone(opportunity.priority)}`}>
                    {opportunity.priority || "MEDIUM"}
                  </span>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-gray-500">
                  <span className="inline-flex items-center gap-2">
                    <UserRound size={16} />
                    {opportunity.contactName || contact?.name || "Unknown contact"}
                  </span>
                  {(opportunity.contactPhone || contact?.phone) && (
                    <span className="inline-flex items-center gap-2">
                      <Phone size={16} />
                      {opportunity.contactPhone || contact?.phone}
                    </span>
                  )}
                  {opportunity.pipelineName && <span>{opportunity.pipelineName}</span>}
                  {opportunity.industryKey && <span>Catalog type: {opportunity.industryKey}</span>}
                  {opportunity.domainItemName && <span>{opportunity.domainItemName}</span>}
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <a href="#send-email" className="inline-flex h-10 items-center gap-2 rounded-lg bg-teal-700 px-4 text-sm font-semibold text-white hover:bg-teal-800">
                  <Mail size={16} />
                  Email
                </a>
                <Link to="/dashboard/chat" className="inline-flex h-10 items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 text-sm font-semibold text-gray-700 hover:bg-gray-50">
                  <MessageCircle size={16} />
                  WhatsApp
                </Link>
                <button
                  type="button"
                  onClick={() => setFlowModalOpen(true)}
                  disabled={!opportunity.contactId}
                  className="inline-flex h-10 items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 text-sm font-semibold text-emerald-700 hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Send size={16} />
                  Send Flow
                </button>
                <a href="#appointments" className="inline-flex h-10 items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 text-sm font-semibold text-gray-700 hover:bg-gray-50">
                  <CalendarPlus size={16} />
                  Appointment
                </a>
                <button
                  type="button"
                  onClick={() => setEditOpen(true)}
                  className="inline-flex h-10 items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 text-sm font-semibold text-gray-700 hover:bg-gray-50"
                >
                  <Edit3 size={16} />
                  Edit
                </button>
              </div>
            </div>
          </div>

          <div className="grid gap-4 p-5 lg:grid-cols-[minmax(0,1fr)_320px]">
            <div>
              <div className="mb-4 flex flex-wrap items-center gap-2">
                {stages.map((stage, index) => {
                  const active = stage.key === opportunity.stage;
                  const passed = stages.findIndex((item) => item.key === opportunity.stage) > index;
                  return (
                    <button
                      key={stage.key}
                      type="button"
                      onClick={() => setStageValue(stage.key)}
                      className={`flex min-h-10 items-center gap-2 rounded-full border px-3 text-sm font-bold ${
                        active
                          ? "border-teal-600 bg-teal-600 text-white"
                          : passed
                            ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                            : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
                      }`}
                    >
                      {passed ? <CheckCircle2 size={15} /> : <span className="h-2 w-2 rounded-full bg-current" />}
                      {stage.label}
                    </button>
                  );
                })}
              </div>
              <div className="flex flex-col gap-3 rounded-lg border border-gray-100 bg-slate-50 p-4 md:flex-row md:items-center md:justify-between">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-gray-700">
                    Move to: {stages.find((stage) => stage.key === stageValue)?.label || stageValue}
                  </span>
                  <button onClick={moveStage} disabled={savingStage || stageValue === opportunity.stage} className="h-10 rounded-lg bg-gray-950 px-4 text-sm font-semibold text-white hover:bg-black disabled:opacity-50">
                    {savingStage ? "Saving..." : "Move Stage"}
                  </button>
                </div>
                <div className="min-w-0 text-sm text-gray-500">
                  Last activity: <span className="font-semibold text-gray-800">{latestActivity ? `${timelineLabel(latestActivity)} - ${formatDate(latestActivity.occurredAt)}` : "No activity yet"}</span>
                </div>
              </div>
            </div>

            <div className="rounded-lg border border-gray-100 bg-slate-50 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide text-gray-500">Win Probability</p>
                  <p className="mt-1 text-2xl font-extrabold text-gray-950">{opportunity.probability ?? 0}%</p>
                </div>
                <Target className="text-teal-700" size={28} />
              </div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-gray-200">
                <div className="h-full rounded-full bg-teal-600" style={{ width: `${probabilityWidth}%` }} />
              </div>
            </div>
          </div>

          <div className="grid gap-3 border-t border-gray-100 p-5 md:grid-cols-2 xl:grid-cols-5">
            <WorkspaceMetric icon={CircleDollarSign} label="Value" value={formatAmount(opportunity.amount)} helper={`Expected ${formatAmount(opportunity.expectedRevenue)}`} />
            <WorkspaceMetric icon={Mail} label="Emails" value={emails.length} helper={latestEmail ? latestEmail.subject || "Latest email" : "No email yet"} />
            <WorkspaceMetric icon={MessageCircle} label="WhatsApp" value={timelineCounts.MESSAGE} helper="Linked chat activity" />
            <WorkspaceMetric icon={CalendarPlus} label="Appointments" value={appointments.length} helper={nextAppointment ? formatDate(nextAppointment.startAt) : "No upcoming appointment"} />
            <WorkspaceMetric icon={Clock3} label="Tasks" value={timelineCounts.TASK} helper={opportunity.activitySlaBreached ? "SLA overdue" : "Follow-up workload"} />
          </div>
        </header>

        {message && <div className="mb-5 rounded-lg border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-700">{message}</div>}

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(520px,640px)]">
          <main className="space-y-6">
            <section className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-bold text-gray-950">Deal Snapshot</h2>
                  <p className="mt-1 text-sm text-gray-500">Commercial, ownership, and domain details for this opportunity.</p>
                </div>
                <button
                  type="button"
                  onClick={() => setEditOpen(true)}
                  className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
                >
                  Edit
                </button>
              </div>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <Info label={opportunityConfig.amountLabel} value={formatAmount(opportunity.amount)} />
                <Info label={opportunityConfig.closeLabel} value={opportunity.expectedCloseDate || "-"} />
                <Info label="Expected Revenue" value={formatAmount(opportunity.expectedRevenue)} />
                <Info label="Probability" value={opportunity.probability !== null && opportunity.probability !== undefined ? `${opportunity.probability}%` : "-"} />
                <Info label="Priority" value={opportunity.priority || "-"} />
                <Info label="Activity SLA" value={opportunity.activitySlaDueAt ? `${formatDate(opportunity.activitySlaDueAt)}${opportunity.activitySlaBreached ? " overdue" : ""}` : "-"} />
                <Info label="Source" value={opportunity.source || "-"} />
                <Info label="Owner User" value={opportunity.ownerUserId || "-"} />
                {opportunity.lostReason && <Info label="Lost Reason" value={opportunity.lostReason} />}
                {visibleOpportunityDetails.map((field) => (
                  <Info key={field.key} label={field.label} value={field.value} />
                ))}
              </div>
              {opportunity.notes && (
                <div className="mt-4 rounded-lg bg-slate-50 p-4 text-sm leading-6 text-gray-700">
                  {opportunity.notes}
                </div>
              )}
            </section>

            <section className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
              <div className="mb-4 flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
                <div>
                  <h2 className="text-lg font-bold text-gray-950">Communication Hub</h2>
                  <p className="mt-1 text-sm text-gray-500">Everything the agent needs before contacting the lead again.</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <a href="#send-email" className="rounded-lg bg-teal-700 px-3 py-2 text-sm font-semibold text-white hover:bg-teal-800">Send Email</a>
                  <Link to="/dashboard/chat" className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50">Open WhatsApp</Link>
                  <button type="button" onClick={() => setFlowModalOpen(true)} disabled={!opportunity.contactId} className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700 hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-50">Send Flow</button>
                  <a href="#appointments" className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50">Schedule</a>
                </div>
              </div>
              <div className="grid gap-4 lg:grid-cols-3">
                <div className="lg:col-span-3">
                  <AiAssistPanel
                    contactId={opportunity.contactId}
                    title="AI Opportunity Summary"
                    contextPrompt={`Summarize this opportunity for an agent and recommend the next best action.
Opportunity: ${opportunity.title || ""}
Stage: ${currentStage?.label || opportunity.stage || ""}
Priority: ${opportunity.priority || ""}
Value: ${formatAmount(opportunity.amount)}
Expected revenue: ${formatAmount(opportunity.expectedRevenue)}
Probability: ${opportunity.probability ?? 0}%
Contact: ${contact?.name || opportunity.contactName || ""}
Phone: ${contact?.phone || opportunity.contactPhone || ""}
Latest email: ${latestEmail?.subject || ""} ${latestEmail ? textPreview(latestEmail.body) : ""}
Next appointment: ${nextAppointment ? `${APPOINTMENT_LABELS[nextAppointment.appointmentType] || "Appointment"} at ${formatDate(nextAppointment.startAt)}` : "None"}
Recent activity: ${recentTimeline.slice(0, 5).map((item) => `${timelineLabel(item)} ${formatDate(item.occurredAt)}`).join(" | ") || "No recent activity"}`}
                    replyPrompt={`Write a short follow-up message for this opportunity. Keep it warm and action-oriented.
Opportunity: ${opportunity.title || ""}
Stage: ${currentStage?.label || opportunity.stage || ""}
Contact: ${contact?.name || opportunity.contactName || "Customer"}
Next appointment: ${nextAppointment ? formatDate(nextAppointment.startAt) : "No appointment scheduled"}`}
                    compact
                  />
                </div>
                <article className="rounded-lg border border-gray-100 bg-slate-50 p-4">
                  <div className="flex items-center gap-2 text-sm font-bold text-gray-950"><Mail size={16} /> Latest Email</div>
                  <p className="mt-3 line-clamp-2 text-sm font-semibold text-gray-800">{latestEmail?.subject || "No linked email yet"}</p>
                  <p className="mt-2 line-clamp-2 text-xs leading-5 text-gray-500">{latestEmail ? textPreview(latestEmail.body) || latestEmail.status : "Send or sync email to build history."}</p>
                </article>
                <article className="rounded-lg border border-gray-100 bg-slate-50 p-4">
                  <div className="flex items-center gap-2 text-sm font-bold text-gray-950"><MessageCircle size={16} /> WhatsApp Activity</div>
                  <p className="mt-3 text-2xl font-extrabold text-gray-950">{timelineCounts.MESSAGE}</p>
                  <p className="mt-2 text-xs leading-5 text-gray-500">WhatsApp messages linked through the contact timeline.</p>
                </article>
                <article className="rounded-lg border border-gray-100 bg-slate-50 p-4">
                  <div className="flex items-center gap-2 text-sm font-bold text-gray-950"><Clock3 size={16} /> Next Step</div>
                  <p className="mt-3 line-clamp-2 text-sm font-semibold text-gray-800">
                    {nextAppointment ? `${APPOINTMENT_LABELS[nextAppointment.appointmentType] || "Appointment"} at ${formatDate(nextAppointment.startAt)}` : latestActivity ? `${timelineLabel(latestActivity)} on ${formatDate(latestActivity.occurredAt)}` : "No next activity yet"}
                  </p>
                  <p className="mt-2 text-xs leading-5 text-gray-500">{opportunity.activitySlaBreached ? "Activity SLA is overdue. Follow up now." : "Use appointment or email to create the next touch."}</p>
                </article>
              </div>
            </section>

            {domainItem && (
              <section className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
                <h2 className="text-lg font-bold text-gray-950">Mapped Catalog Item</h2>
                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  <Info label="Name" value={domainItem.name} />
                  <Info label="Catalog Type Key" value={domainItem.industryKey} />
                  <Info label="Category" value={domainItem.category || "-"} />
                  <Info label="Location" value={domainItem.location || "-"} />
                  <Info label="Price" value={formatAmount(domainItem.price)} />
                  <Info label="Status" value={domainItem.active === false ? "Inactive" : "Active"} />
                </div>
                {visibleMetadataEntries(domainItem.metadataJson).length > 0 && (
                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    {visibleMetadataEntries(domainItem.metadataJson).map(([key, value]) => (
                        <Info key={key} label={DOMAIN_FIELD_LABELS[key] || key} value={String(value)} />
                      ))}
                  </div>
                )}
                {domainItem.description && (
                  <p className="mt-4 rounded-lg bg-slate-50 p-4 text-sm leading-6 text-gray-700">{domainItem.description}</p>
                )}
              </section>
            )}

            <section id="appointments" className="scroll-mt-6 rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-bold text-gray-950">Appointments</h2>
                  <p className="mt-1 text-sm text-gray-500">Schedule and track site visits, counseling sessions, demos, or test rides.</p>
                </div>
                <Link to="/dashboard/event" className="text-sm font-semibold text-teal-700">Open Calendar</Link>
              </div>

              <form onSubmit={scheduleAppointment} className="grid gap-3 rounded-lg border border-gray-100 bg-slate-50 p-4 md:grid-cols-2">
                <label className="block">
                  <span className="mb-1 block text-xs font-semibold uppercase text-gray-500">Type</span>
                  <select
                    value={appointmentForm.appointmentType}
                    onChange={(event) => setAppointmentForm((current) => ({ ...current, appointmentType: event.target.value }))}
                    className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm"
                  >
                    {Object.entries(APPOINTMENT_LABELS).map(([value, label]) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className="mb-1 block text-xs font-semibold uppercase text-gray-500">Location</span>
                  <input
                    value={appointmentForm.location}
                    onChange={(event) => setAppointmentForm((current) => ({ ...current, location: event.target.value }))}
                    placeholder="Office, project site, showroom, online"
                    className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm"
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-xs font-semibold uppercase text-gray-500">Start</span>
                  <input
                    type="datetime-local"
                    value={appointmentForm.startAt}
                    onChange={(event) => setAppointmentForm((current) => ({ ...current, startAt: event.target.value }))}
                    className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm"
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-xs font-semibold uppercase text-gray-500">End</span>
                  <input
                    type="datetime-local"
                    value={appointmentForm.endAt}
                    onChange={(event) => setAppointmentForm((current) => ({ ...current, endAt: event.target.value }))}
                    className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm"
                  />
                </label>
                <label className="block md:col-span-2">
                  <span className="mb-1 block text-xs font-semibold uppercase text-gray-500">Notes</span>
                  <textarea
                    rows={3}
                    value={appointmentForm.description}
                    onChange={(event) => setAppointmentForm((current) => ({ ...current, description: event.target.value }))}
                    placeholder="What should the agent prepare or discuss?"
                    className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm"
                  />
                </label>
                <div className="md:col-span-2">
                  {!appointmentForm.startAt && (
                    <p className="mb-2 rounded-lg border border-amber-100 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800">
                      Select a start date and time before scheduling this appointment.
                    </p>
                  )}
                  {appointmentForm.endAt && appointmentForm.startAt && new Date(appointmentForm.endAt) <= new Date(appointmentForm.startAt) && (
                    <p className="mb-2 rounded-lg border border-rose-100 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700">
                      End time must be after start time.
                    </p>
                  )}
                  <button className="rounded-lg bg-teal-700 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-800">
                    Schedule Appointment
                  </button>
                </div>
              </form>

              <div className="mt-4 space-y-3">
                {appointments.map((appointment) => (
                  <article key={appointment.id} className="rounded-lg border border-gray-100 bg-white p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold text-gray-900">{appointment.title}</p>
                        <p className="mt-1 text-xs text-gray-500">
                          {APPOINTMENT_LABELS[appointment.appointmentType] || appointment.appointmentType || "Appointment"}
                          {" · "}
                          {formatDate(appointment.startAt)}
                          {appointment.location ? ` · ${appointment.location}` : ""}
                        </p>
                      </div>
                      <span className="rounded-full bg-teal-50 px-2 py-1 text-xs font-semibold text-teal-700">{appointment.status}</span>
                    </div>
                    {appointment.description && <p className="mt-3 text-sm leading-6 text-gray-600">{appointment.description}</p>}
                    {appointment.outcome && <p className="mt-3 rounded-lg bg-emerald-50 p-3 text-sm leading-6 text-emerald-800">{appointment.outcome}</p>}
                    <div className="mt-4 grid gap-3 rounded-lg bg-slate-50 p-3 md:grid-cols-2">
                      <label className="block">
                        <span className="mb-1 block text-xs font-semibold uppercase text-gray-500">Status</span>
                        <select
                          value={appointmentEdits[appointment.id]?.status || appointment.status || "SCHEDULED"}
                          onChange={(event) => updateAppointmentEdit(appointment.id, "status", event.target.value)}
                          className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm"
                        >
                          {APPOINTMENT_STATUSES.map((status) => (
                            <option key={status} value={status}>{status.replaceAll("_", " ")}</option>
                          ))}
                        </select>
                      </label>
                      <label className="block">
                        <span className="mb-1 block text-xs font-semibold uppercase text-gray-500">Follow-up Due</span>
                        <input
                          type="datetime-local"
                          value={appointmentEdits[appointment.id]?.followUpDueAt || ""}
                          onChange={(event) => updateAppointmentEdit(appointment.id, "followUpDueAt", event.target.value)}
                          className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm"
                        />
                      </label>
                      <label className="block md:col-span-2">
                        <span className="mb-1 block text-xs font-semibold uppercase text-gray-500">Outcome Notes</span>
                        <textarea
                          rows={3}
                          value={appointmentEdits[appointment.id]?.outcome || ""}
                          onChange={(event) => updateAppointmentEdit(appointment.id, "outcome", event.target.value)}
                          placeholder="What happened in the visit/session/test ride?"
                          className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm"
                        />
                      </label>
                      <label className="block md:col-span-2">
                        <span className="mb-1 block text-xs font-semibold uppercase text-gray-500">Follow-up Task Title</span>
                        <input
                          value={appointmentEdits[appointment.id]?.followUpTitle || ""}
                          onChange={(event) => updateAppointmentEdit(appointment.id, "followUpTitle", event.target.value)}
                          placeholder={`Follow up after ${appointment.title}`}
                          className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm"
                        />
                      </label>
                      <div className="flex flex-wrap gap-2 md:col-span-2">
                        <button
                          type="button"
                          disabled={updatingAppointmentId === appointment.id}
                          onClick={() => updateAppointmentOutcome(appointment, false)}
                          className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-60"
                        >
                          {updatingAppointmentId === appointment.id ? "Saving..." : "Save Outcome"}
                        </button>
                        <button
                          type="button"
                          disabled={updatingAppointmentId === appointment.id}
                          onClick={() => updateAppointmentOutcome(appointment, true)}
                          className="rounded-lg bg-teal-700 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-800 disabled:opacity-60"
                        >
                          Save + Create Follow-up
                        </button>
                      </div>
                    </div>
                  </article>
                ))}
                {appointments.length === 0 && <p className="rounded-lg border border-dashed border-gray-200 p-6 text-center text-sm text-gray-500">No appointments scheduled for this opportunity.</p>}
              </div>
            </section>

            <section id="emails" className="scroll-mt-6 rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-lg font-bold text-gray-950">Linked Emails</h2>
                <Link to="/dashboard/mail" className="text-sm font-semibold text-teal-700">Open Mail</Link>
              </div>
              <div className="space-y-3">
                {emails.map((email) => (
                  <article key={email.id} className="rounded-lg border border-gray-100 bg-slate-50 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold text-gray-900">{email.subject || "(No subject)"}</p>
                        <p className="mt-1 text-xs text-gray-500">
                          {email.direction} · {email.fromEmail || "-"} to {email.toEmail || "-"}
                        </p>
                      </div>
                      <span className="rounded-full bg-white px-2 py-1 text-xs font-semibold text-gray-600">{email.status}</span>
                    </div>
                    {email.body && <p className="mt-3 line-clamp-3 text-sm leading-6 text-gray-600">{textPreview(email.body)}</p>}
                  </article>
                ))}
                {emails.length === 0 && <p className="rounded-lg border border-dashed border-gray-200 p-6 text-center text-sm text-gray-500">No linked emails yet.</p>}
              </div>
            </section>

            <section id="timeline" className="scroll-mt-6 rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
              <div className="flex flex-col gap-1">
                <h2 className="text-lg font-bold text-gray-950">Opportunity Notes & Activity</h2>
                <p className="text-sm text-gray-500">Add deal-specific notes and review the day-wise activity history for this opportunity.</p>
              </div>
              <form onSubmit={saveOpportunityNote} className="mt-4 rounded-lg border border-gray-100 bg-slate-50 p-3">
                <label className="block">
                  <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">New Note</span>
                  <textarea
                    rows={3}
                    value={noteText}
                    onChange={(event) => setNoteText(event.target.value)}
                    placeholder="Example: Customer wants a 2BHK under 80L, prefers weekend site visit..."
                    className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-teal-500"
                  />
                </label>
                <div className="mt-3 flex justify-end">
                  <button
                    type="submit"
                    disabled={savingNote || !noteText.trim()}
                    className="rounded-lg bg-teal-700 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {savingNote ? "Saving..." : "Add Note"}
                  </button>
                </div>
              </form>
              <div className="mt-4 space-y-3">
                {recentTimeline.slice(0, 12).map((item, index) => (
                  <article key={`${item.itemType}-${item.emailId || item.opportunityId || item.messageId || item.taskId || item.noteId || index}`} className="flex gap-3 rounded-lg border border-gray-100 bg-white p-3">
                    <div className="mt-1 h-2.5 w-2.5 flex-shrink-0 rounded-full bg-teal-600" />
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-semibold text-gray-900">
                          {timelineLabel(item)}: {item.title || item.description || item.eventType}
                        </p>
                        {item.status && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-700">{item.status.replaceAll("_", " ")}</span>}
                      </div>
                      {(item.description || item.textBody) && (
                        <p className="mt-1 line-clamp-2 text-sm leading-6 text-gray-600">{item.description || item.textBody}</p>
                      )}
                      <p className="mt-1 text-xs text-gray-400">{item.actorUserEmail || "System"} · {formatDate(item.occurredAt)}</p>
                    </div>
                  </article>
                ))}
                {timeline.length === 0 && <p className="rounded-lg border border-dashed border-gray-200 p-6 text-center text-sm text-gray-500">No opportunity activity yet.</p>}
              </div>
            </section>
          </main>

          <aside className="space-y-6">
            <section id="send-email" className="scroll-mt-6 rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-bold text-gray-950">Send Email</h2>
                  <p className="mt-1 text-sm text-gray-500">Use a saved template, personalize it, and send from the connected CRM mailbox.</p>
                </div>
                <Mail size={20} className="text-teal-700" />
              </div>
              <div className="rounded-lg border border-gray-100 bg-gray-50 p-4">
                <p className="text-sm font-semibold text-gray-900">{contact?.email || "Contact email will be used if available"}</p>
                <p className="mt-1 text-xs leading-5 text-gray-500">The full composer opens in a wide view so templates and rich editing have enough space.</p>
              </div>
              <button
                type="button"
                onClick={() => setEmailComposeOpen(true)}
                className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal-800"
              >
                <Send size={16} />
                Compose Email
              </button>
            </section>

            <section className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
              <h2 className="text-lg font-bold text-gray-950">Contact</h2>
              <div className="mt-4 space-y-3 text-sm">
                <Info label="Name" value={contact?.name || opportunity.contactName || "-"} />
                <Info label="Phone" value={contact?.phone || opportunity.contactPhone || "-"} />
                <Info label="Email" value={contact?.email || "-"} />
                <Info label="Stage" value={contact?.stage || "-"} />
              </div>
              <div className="mt-4 grid gap-2">
                <Link to="/dashboard/chat" className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50">
                  <MessageCircle size={16} />
                  Open WhatsApp Chat
                </Link>
                <button
                  type="button"
                  onClick={() => setFlowModalOpen(true)}
                  disabled={!opportunity.contactId}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-700 hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Send size={16} />
                  Send WhatsApp Flow
                </button>
                {opportunity.contactId && (
                  <button onClick={() => navigate("/dashboard/contacts")} className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50">
                    Open Contact
                  </button>
                )}
              </div>
            </section>

            <section className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
              <h2 className="text-lg font-bold text-gray-950">Agent Checklist</h2>
              <div className="mt-4 space-y-3">
                <ChecklistItem complete={emails.length > 0} label="Email conversation started" />
                <ChecklistItem complete={timelineCounts.MESSAGE > 0} label="WhatsApp activity available" />
                <ChecklistItem complete={appointments.length > 0} label="Appointment scheduled" />
                <ChecklistItem complete={!opportunity.activitySlaBreached} label="SLA follow-up healthy" />
              </div>
            </section>
          </aside>
        </div>
      </div>
    </div>
  );
}

function mediaHtmlSnippet(asset) {
  const url = asset?.publicUrl || "";
  const label = asset?.name || asset?.originalFileName || "Media";
  if (!url) return "";
  if (asset?.mediaType === "IMAGE") {
    return `<p><img src="${escapeHtml(url)}" alt="${escapeHtml(label)}" style="max-width:100%;height:auto;border-radius:8px;" /></p>`;
  }
  return `<p><a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(label)}</a></p>`;
}

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function Info({ label, value }) {
  return (
    <div className="flex justify-between gap-4 rounded-lg bg-slate-50 px-3 py-2 text-sm">
      <span className="text-gray-400">{label}</span>
      <span className="text-right font-semibold text-gray-700">{value || "-"}</span>
    </div>
  );
}

function WorkspaceMetric({ icon: Icon, label, value, helper }) {
  return (
    <div className="rounded-lg border border-gray-100 bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-wide text-gray-500">{label}</p>
          <p className="mt-2 truncate text-2xl font-extrabold text-gray-950">{value}</p>
          <p className="mt-1 truncate text-xs text-gray-500">{helper}</p>
        </div>
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-teal-50 text-teal-700">
          <Icon size={18} />
        </div>
      </div>
    </div>
  );
}

function ChecklistItem({ complete, label }) {
  return (
    <div className="flex items-center gap-3 rounded-lg bg-slate-50 px-3 py-2 text-sm">
      <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${complete ? "bg-emerald-100 text-emerald-700" : "bg-gray-200 text-gray-500"}`}>
        <CheckCircle2 size={15} />
      </span>
      <span className={`font-semibold ${complete ? "text-gray-800" : "text-gray-500"}`}>{label}</span>
    </div>
  );
}
