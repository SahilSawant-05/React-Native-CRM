import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/axios";
import DateRangeFilter, { dateRangeParams, presetDateRange } from "../components/common/DateRangeFilter";
import EmailTemplatePicker from "../components/email/EmailTemplatePicker";
import {
  OPPORTUNITY_INDUSTRY_OPTIONS,
  opportunityFieldConfig,
  parseOpportunityDetails,
  serializeOpportunityDetails,
} from "../config/opportunityFields";

const EmailDesigner = lazy(() => import("../components/email/EmailDesigner"));

const DEFAULT_STAGES = [
  { stageKey: "NEW", label: "New", displayOrder: 1, active: true },
  { stageKey: "QUALIFIED", label: "Qualified", displayOrder: 2, active: true },
  { stageKey: "FOLLOW_UP", label: "Follow Up", displayOrder: 3, active: true },
  { stageKey: "WON", label: "Won", displayOrder: 4, active: true },
  { stageKey: "LOST", label: "Lost", displayOrder: 5, active: true },
];

const INDUSTRY_OPTIONS = OPPORTUNITY_INDUSTRY_OPTIONS;

const COLORS = ["#0f766e", "#2563eb", "#7c3aed", "#d97706", "#059669", "#dc2626", "#0891b2"];
const STALE_DAYS = 3;
const INITIAL_STAGE_CARD_LIMIT = 12;
const STAGE_CARD_LIMIT_STEP = 12;
const OPPORTUNITY_PAGE_SIZE = 100;
const EMPTY_FILTERS = {
  ownerUserId: "",
  source: "",
  expectedClose: "",
  staleOnly: false,
};

const normalizeStageKey = (value) =>
  String(value || "NEW").trim().toUpperCase().replace(/[\s-]+/g, "_");

const normalizeList = (payload) => {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.content)) return payload.content;
  if (Array.isArray(payload?.items)) return payload.items;
  return [];
};

const buildStages = (rawStages) => {
  const source = rawStages?.length ? rawStages : DEFAULT_STAGES;
  return source
    .filter((stage) => stage.active !== false)
    .sort((a, b) => (a.displayOrder ?? 100) - (b.displayOrder ?? 100))
    .map((stage, index) => {
      const key = normalizeStageKey(stage.stageKey || stage.key || stage.label);
      return {
        key,
        label: stage.label || key.replaceAll("_", " "),
        color: COLORS[index % COLORS.length],
      };
    });
};

const displayDate = (raw) => {
  if (!raw) return "";
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? raw : date.toLocaleDateString("en-IN");
};

const startOfToday = () => {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date;
};

const isStaleCard = (card) => {
  if (!card.updatedAt) return false;
  const updated = new Date(card.updatedAt);
  if (Number.isNaN(updated.getTime())) return false;
  return updated < new Date(Date.now() - STALE_DAYS * 24 * 60 * 60 * 1000);
};

const matchesExpectedClose = (card, filter) => {
  if (!filter) return true;
  if (!card.expectedCloseDate) return filter === "NO_DATE";
  const closeDate = new Date(`${card.expectedCloseDate}T00:00:00`);
  if (Number.isNaN(closeDate.getTime())) return true;
  const today = startOfToday();
  const next7 = new Date(today);
  next7.setDate(today.getDate() + 7);
  const next30 = new Date(today);
  next30.setDate(today.getDate() + 30);
  if (filter === "OVERDUE") return closeDate < today;
  if (filter === "THIS_WEEK") return closeDate >= today && closeDate <= next7;
  if (filter === "NEXT_30") return closeDate >= today && closeDate <= next30;
  return true;
};

const formatAmount = (amount) => {
  if (amount === null || amount === undefined || amount === "") return "";
  const number = Number(amount);
  if (Number.isNaN(number)) return String(amount);
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(number);
};

const formatCount = (value) => new Intl.NumberFormat("en-IN").format(Number(value) || 0);

const industryLabel = (value) => {
  const option = INDUSTRY_OPTIONS.find((industry) => industry.key === value);
  if (option) return option.label;
  return String(value || "Generic")
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
};

const prettySource = (value) =>
  String(value || "")
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());

const parseWebsiteSource = (detail) => {
  const value = String(detail || "").trim();
  if (!value) return null;
  const parts = value.split("|").map((part) => part.trim()).filter(Boolean);
  const domainCandidate = parts.find((part) => !/^https?:\/\//i.test(part)) || parts[0];
  try {
    const urlPart = parts.find((part) => /^https?:\/\//i.test(part));
    const url = urlPart ? new URL(urlPart) : null;
    const domain = domainCandidate && domainCandidate !== "website" ? domainCandidate : url?.hostname;
    return {
      label: domain || value,
      form: parts.find((part) => part !== domainCandidate && !/^https?:\/\//i.test(part)) || "",
      page: urlPart || "",
      raw: value,
    };
  } catch {
    return {
      label: domainCandidate || value,
      form: parts.find((part) => part !== domainCandidate) || "",
      page: "",
      raw: value,
    };
  }
};

const websiteSource = (card) => {
  const source = String(card.contactLeadSource || card.source || "").toUpperCase();
  const detail = card.contactLeadSourceDetail || "";
  if (!source.includes("WEBSITE") && !detail) return null;
  return parseWebsiteSource(detail) || { label: prettySource(card.source || "Website"), form: "", page: "", raw: "" };
};

const sourceFilterValue = (card) => {
  const website = websiteSource(card);
  if (website?.label) return `Website: ${website.label}`;
  return card.source || card.contactLeadSource || "";
};

const priorityClass = (priority) => {
  if (priority === "URGENT") return "bg-red-100 text-red-800";
  if (priority === "HIGH") return "bg-orange-50 text-orange-700";
  if (priority === "LOW") return "bg-gray-100 text-gray-600";
  return "bg-amber-50 text-amber-700";
};

const toCard = (opportunity, stages) => {
  const stageKeys = new Set(stages.map((stage) => stage.key));
  const firstStage = stages[0]?.key || "NEW";
  const stage = normalizeStageKey(opportunity.stage || firstStage);

  return {
    id: String(opportunity.id),
    contactId: opportunity.contactId,
    pipelineId: opportunity.pipelineId || "",
    pipelineName: opportunity.pipelineName || "",
    ownerUserId: opportunity.ownerUserId || "",
    title: opportunity.title || "Untitled Opportunity",
    contactName: opportunity.contactName || "Unknown Contact",
    contactPhone: opportunity.contactPhone || "",
    contactLeadSource: opportunity.contactLeadSource || "",
    contactLeadSourceDetail: opportunity.contactLeadSourceDetail || "",
    amount: opportunity.amount ?? "",
    expectedRevenue: opportunity.expectedRevenue ?? "",
    probability: opportunity.probability ?? "",
    priority: opportunity.priority || "MEDIUM",
    lostReason: opportunity.lostReason || "",
    activitySlaHours: opportunity.activitySlaHours ?? "",
    lastActivityAt: opportunity.lastActivityAt || "",
    activitySlaDueAt: opportunity.activitySlaDueAt || "",
    activitySlaBreached: Boolean(opportunity.activitySlaBreached),
    source: opportunity.source || "",
    notes: opportunity.notes || "",
    detailsJson: opportunity.detailsJson || "",
    details: parseOpportunityDetails(opportunity.detailsJson),
    industryKey: opportunity.industryKey || "",
    domainItemId: opportunity.domainItemId || "",
    domainItemName: opportunity.domainItemName || "",
    expectedCloseDate: opportunity.expectedCloseDate || "",
    stage: stageKeys.has(stage) ? stage : firstStage,
    updatedAt: opportunity.updatedAt || opportunity.createdAt || "",
    raw: opportunity,
  };
};

const buildColumns = (cards, stages) => {
  const columns = {};
  stages.forEach((stage) => {
    columns[stage.key] = [];
  });
  const firstStage = stages[0]?.key || "NEW";
  cards.forEach((card) => {
    const key = columns[card.stage] ? card.stage : firstStage;
    columns[key].push({ ...card, stage: key });
  });
  return columns;
};

function Toast({ toast, onClose }) {
  useEffect(() => {
    if (!toast) return undefined;
    const timer = setTimeout(onClose, 3200);
    return () => clearTimeout(timer);
  }, [toast, onClose]);

  if (!toast) return null;

  const classes =
    toast.type === "error"
      ? "border-red-200 bg-red-50 text-red-700"
      : toast.type === "info"
        ? "border-blue-200 bg-blue-50 text-blue-700"
        : "border-emerald-200 bg-emerald-50 text-emerald-700";

  return (
    <div className={`fixed bottom-6 right-6 z-50 rounded-lg border px-4 py-3 text-sm shadow-xl ${classes}`}>
      <div className="flex items-center gap-3">
        <span>{toast.message}</span>
        <button onClick={onClose} className="font-bold opacity-60 hover:opacity-100">x</button>
      </div>
    </div>
  );
}

function Avatar({ name }) {
  const initials = (name || "?")
    .split(" ")
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase())
    .join("");

  return (
    <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-teal-600 text-xs font-bold text-white">
      {initials}
    </div>
  );
}

function OpportunityCard({ card, stage, onClick, onEdit, onEmail, onDelete, onDragStart }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const website = websiteSource(card);
  const sourceLabel = sourceFilterValue(card);

  const runAction = (event, action) => {
    event.stopPropagation();
    setMenuOpen(false);
    action();
  };

  return (
    <article
      draggable
      onDragStart={onDragStart}
      onClick={onClick}
      className="mb-3 cursor-grab rounded-lg border border-gray-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
      style={{ borderLeft: `4px solid ${stage.color}` }}
    >
      <div className="mb-3 flex items-start justify-between gap-2">
        <div className="flex min-w-0 flex-1 items-start gap-2">
          <Avatar name={card.contactName} />
          <div className="min-w-0 flex-1">
            <h4 className="line-clamp-2 break-words text-sm font-bold leading-5 text-gray-950">{card.title}</h4>
            <p className="truncate text-xs text-gray-500">{card.contactName} · {card.contactPhone || "No phone"}</p>
          </div>
        </div>
        <div className="relative flex-shrink-0" onClick={(event) => event.stopPropagation()}>
          <button
            type="button"
            onClick={() => setMenuOpen((value) => !value)}
            className="rounded-md px-2 py-1 text-lg leading-none text-gray-400 hover:bg-gray-100 hover:text-gray-700"
            aria-label="Opportunity actions"
          >
            ...
          </button>
          {menuOpen && (
            <div className="absolute right-0 top-8 z-20 w-36 overflow-hidden rounded-lg border border-gray-200 bg-white shadow-xl">
              <button type="button" onClick={(event) => runAction(event, onEdit)} className="block w-full px-3 py-2 text-left text-sm font-semibold text-gray-700 hover:bg-gray-50">
                Edit
              </button>
              <button type="button" onClick={(event) => runAction(event, onEmail)} className="block w-full px-3 py-2 text-left text-sm font-semibold text-teal-700 hover:bg-teal-50">
                Email
              </button>
              <button type="button" onClick={(event) => runAction(event, onDelete)} className="block w-full px-3 py-2 text-left text-sm font-semibold text-red-600 hover:bg-red-50">
                Delete
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="mb-3 flex flex-wrap gap-1">
        {card.domainItemName && (
          <span className="rounded-full bg-violet-50 px-2 py-0.5 text-[11px] font-medium text-violet-700">
            {card.domainItemName}
          </span>
        )}
        {website?.label && (
          <span
            className="max-w-full truncate rounded-full bg-cyan-50 px-2 py-0.5 text-[11px] font-medium text-cyan-700"
            title={[website.raw, website.page].filter(Boolean).join(" | ")}
          >
            Website: {website.label}
          </span>
        )}
        {!website?.label && sourceLabel && (
          <span className="max-w-full truncate rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-600">
            Source: {prettySource(sourceLabel)}
          </span>
        )}
        {card.amount !== "" && (
          <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700">
            {formatAmount(card.amount)}
          </span>
        )}
        {card.priority && (
          <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${priorityClass(card.priority)}`}>
            {card.priority}
          </span>
        )}
        {card.probability !== "" && (
          <span className="rounded-full bg-sky-50 px-2 py-0.5 text-[11px] font-medium text-sky-700">
            {card.probability}%
          </span>
        )}
        {card.activitySlaBreached && (
          <span className="rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-medium text-red-700">
            SLA overdue
          </span>
        )}
        {card.expectedCloseDate && (
          <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-medium text-blue-700">
            Close {displayDate(card.expectedCloseDate)}
          </span>
        )}
        {isStaleCard(card) && (
          <span className="rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-medium text-red-700">
            Stale
          </span>
        )}
      </div>

      <div className="flex items-center justify-between border-t border-gray-100 pt-2 text-[11px] text-gray-400">
        <span>{displayDate(card.updatedAt) || "No activity"}</span>
        <span style={{ color: stage.color }} className="font-bold">{stage.label}</span>
      </div>
    </article>
  );
}

function StageColumn({ stage, cards, totalCount, visibleLimit, onShowMore, onAdd, onCardClick, onEdit, onEmail, onDelete, onDragStart, onDrop }) {
  const [dragOver, setDragOver] = useState(false);
  const visibleCards = cards.slice(0, visibleLimit);
  const hiddenCount = Math.max(cards.length - visibleCards.length, 0);
  const realTotal = Number.isFinite(Number(totalCount)) ? Number(totalCount) : cards.length;
  const stageHasUnloadedRecords = realTotal > cards.length;

  return (
    <section
      onDragOver={(event) => {
        event.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={() => {
        setDragOver(false);
        onDrop(stage.key);
      }}
      className={`flex w-80 flex-shrink-0 flex-col rounded-xl border p-3 shadow-sm ${
        dragOver ? "border-teal-400 bg-teal-50" : "border-gray-200 bg-gray-50"
      }`}
    >
      <div className="mb-3 flex items-center justify-between rounded-lg border border-gray-200 bg-white px-3 py-2">
        <div className="flex min-w-0 items-center gap-2">
          <span className="h-2.5 w-2.5 flex-shrink-0 rounded-full" style={{ background: stage.color }} />
          <h3 className="truncate text-xs font-bold uppercase tracking-wide text-gray-700">{stage.label}</h3>
          <span className="rounded-full px-2 py-0.5 text-[11px] font-bold" style={{ color: stage.color, background: `${stage.color}18` }}>
            {formatCount(realTotal)}
          </span>
        </div>
        <button onClick={() => onAdd(stage.key)} className="rounded-md px-2 py-1 text-lg leading-none text-gray-400 hover:bg-gray-100 hover:text-teal-700">
          +
        </button>
      </div>

      <div className="min-h-24 flex-1">
        {visibleCards.map((card) => (
          <OpportunityCard
            key={card.id}
            card={card}
            stage={stage}
            onClick={() => onCardClick(card)}
            onEdit={() => onEdit(card)}
            onEmail={() => onEmail(card)}
            onDelete={() => onDelete(card)}
            onDragStart={() => onDragStart(stage.key, card.id)}
          />
        ))}
      </div>

      {hiddenCount > 0 && (
        <div className="mt-2 rounded-lg border border-gray-200 bg-white p-2 text-center">
          <p className="text-xs font-semibold text-gray-500">
            Showing {visibleCards.length} of {cards.length}
          </p>
          <button
            type="button"
            onClick={() => onShowMore(stage.key)}
            className="mt-2 w-full rounded-md border border-teal-200 bg-teal-50 px-3 py-2 text-xs font-bold text-teal-700 hover:bg-teal-100"
          >
            Load {Math.min(STAGE_CARD_LIMIT_STEP, hiddenCount)} more
          </button>
        </div>
      )}

      {hiddenCount === 0 && stageHasUnloadedRecords && (
        <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50 p-2 text-center">
          <p className="text-xs font-semibold text-amber-800">
            {formatCount(cards.length)} loaded of {formatCount(realTotal)}
          </p>
          <p className="mt-1 text-[11px] text-amber-700">Use Load next records below to bring more cards onto the board.</p>
        </div>
      )}

      <button
        onClick={() => onAdd(stage.key)}
        className="mt-1 rounded-lg border border-dashed border-gray-300 py-2 text-xs font-semibold text-gray-500 hover:border-teal-500 hover:bg-white hover:text-teal-700"
      >
        + Add Opportunity
      </button>
    </section>
  );
}

function OpportunityModal({ open, stages, contacts, domainItems, initial, defaultStage, pipeline, saving, onClose, onSave }) {
  const pipelineIndustryKey = pipeline?.industryKey || "GENERIC";
  const [form, setForm] = useState({
    contactId: "",
    title: "",
    industryKey: pipelineIndustryKey,
    domainItemId: "",
    stage: defaultStage,
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
    if (!open) return;
    setForm({
      contactId: initial?.contactId || contacts[0]?.id || "",
      title: initial?.title || "",
      industryKey: pipelineIndustryKey,
      domainItemId: initial?.domainItemId || "",
      stage: initial?.stage || defaultStage || stages[0]?.key || "NEW",
      amount: initial?.amount ?? "",
      expectedRevenue: initial?.expectedRevenue ?? "",
      probability: initial?.probability ?? "",
      priority: initial?.priority || "MEDIUM",
      lostReason: initial?.lostReason || "",
      activitySlaHours: initial?.activitySlaHours ?? "",
      expectedCloseDate: initial?.expectedCloseDate || "",
      source: initial?.source || "",
      notes: initial?.notes || "",
      details: initial?.details || parseOpportunityDetails(initial?.detailsJson),
    });
  }, [open, initial, defaultStage, stages, contacts, pipelineIndustryKey]);

  if (!open) return null;

  const setValue = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const submit = () => {
    if (!form.contactId || !form.title.trim()) return;
    const nextStage = normalizeStageKey(form.stage);
    if (nextStage === "LOST" && !form.lostReason.trim()) {
      window.alert("Lost reason is required before marking an opportunity as Lost.");
      return;
    }
    onSave({
      ...initial,
      contactId: Number(form.contactId),
      title: form.title.trim(),
      industryKey: pipelineIndustryKey,
      domainItemId: form.domainItemId ? Number(form.domainItemId) : null,
      stage: nextStage,
      amount: form.amount === "" ? null : Number(form.amount),
      expectedRevenue: form.expectedRevenue === "" ? null : Number(form.expectedRevenue),
      probability: form.probability === "" ? null : Number(form.probability),
      priority: form.priority || "MEDIUM",
      lostReason: form.lostReason.trim() || null,
      activitySlaHours: form.activitySlaHours === "" ? null : Number(form.activitySlaHours),
      expectedCloseDate: form.expectedCloseDate || null,
      source: form.source.trim() || null,
      notes: form.notes.trim() || null,
      detailsJson: serializeOpportunityDetails(form.details),
    });
  };

  const config = opportunityFieldConfig(pipelineIndustryKey);

  const setDetailValue = (fieldKey, value) => {
    setForm((current) => ({
      ...current,
      details: {
        ...(current.details || {}),
        [fieldKey]: value,
      },
    }));
  };

  const selectableDomainItems = domainItems.filter((item) => {
    if (!pipelineIndustryKey) return true;
    return item.industryKey === pipelineIndustryKey;
  });

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-3 sm:p-4">
      <div className="my-4 flex max-h-[calc(100vh-2rem)] w-full max-w-xl flex-col rounded-xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
          <h2 className="text-lg font-bold text-gray-950">{initial ? "Edit Opportunity" : "Add Opportunity"}</h2>
          <button onClick={onClose} className="rounded-md px-2 py-1 text-gray-500 hover:bg-gray-100">x</button>
        </div>

        <div className="grid min-h-0 flex-1 gap-4 overflow-y-auto px-5 py-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">Contact</label>
            <select
              value={form.contactId}
              onChange={(event) => setValue("contactId", event.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-teal-500"
            >
              <option value="">Select contact</option>
              {contacts.map((contact) => (
                <option key={contact.id} value={contact.id}>
                  {contact.name || contact.phone} {contact.phone ? `(${contact.phone})` : ""}
                </option>
              ))}
            </select>
          </div>
          <div className="sm:col-span-2">
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">Opportunity title</label>
            <input
              value={form.title}
              onChange={(event) => setValue("title", event.target.value)}
              placeholder={config.titlePlaceholder}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-teal-500"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">Pipeline</label>
            <div className="min-h-10 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm font-semibold text-gray-700">
              {pipeline?.name || "Selected Pipeline"} <span className="font-medium text-gray-400">• {industryLabel(pipelineIndustryKey)}</span>
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">{config.itemLabel}</label>
            <select
              value={form.domainItemId}
              onChange={(event) => {
                const item = domainItems.find((candidate) => String(candidate.id) === event.target.value);
                setForm((current) => ({
                  ...current,
                  domainItemId: event.target.value,
                  amount: current.amount || item?.price || "",
                }));
              }}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-teal-500"
            >
              <option value="">No mapped item</option>
              {selectableDomainItems.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}{item.category ? ` - ${item.category}` : ""}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">Stage</label>
            <select
              value={form.stage}
              onChange={(event) => setValue("stage", event.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-teal-500"
            >
              {stages.map((stage) => (
                <option key={stage.key} value={stage.key}>{stage.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">{config.amountLabel}</label>
            <input
              type="number"
              value={form.amount}
              onChange={(event) => setValue("amount", event.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-teal-500"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">{config.closeLabel}</label>
            <input
              type="date"
              value={form.expectedCloseDate}
              onChange={(event) => setValue("expectedCloseDate", event.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-teal-500"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">Expected Revenue</label>
            <input
              type="number"
              value={form.expectedRevenue}
              onChange={(event) => setValue("expectedRevenue", event.target.value)}
              placeholder="Auto from amount x probability"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-teal-500"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">Probability %</label>
            <input
              type="number"
              min="0"
              max="100"
              value={form.probability}
              onChange={(event) => setValue("probability", event.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-teal-500"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">Priority</label>
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
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">Activity SLA Hours</label>
            <input
              type="number"
              min="0"
              value={form.activitySlaHours}
              onChange={(event) => setValue("activitySlaHours", event.target.value)}
              placeholder="Example: 24"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-teal-500"
            />
          </div>
          {normalizeStageKey(form.stage) === "LOST" && (
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">Lost Reason</label>
              <input
                value={form.lostReason}
                onChange={(event) => setValue("lostReason", event.target.value)}
                placeholder="Budget, no response, competitor, not eligible..."
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-teal-500"
              />
            </div>
          )}
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">Source</label>
            <input
              value={form.source}
              onChange={(event) => setValue("source", event.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-teal-500"
            />
          </div>
          <div className="sm:col-span-2">
            <div className="mb-1 flex items-center justify-between">
              <label className="block text-xs font-semibold uppercase tracking-wide text-gray-500">Requirement Details</label>
              <span className="text-[11px] font-medium text-gray-400">Generic flexible fields</span>
            </div>
            <div className="grid gap-3 rounded-lg border border-gray-100 bg-gray-50 p-3 sm:grid-cols-2">
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
          <div className="sm:col-span-2">
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">Notes</label>
            <textarea
              rows={4}
              value={form.notes}
              onChange={(event) => setValue("notes", event.target.value)}
              placeholder={config.notesPlaceholder}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-teal-500"
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t border-gray-100 bg-white px-5 py-4">
          <button onClick={onClose} className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50">
            Cancel
          </button>
          <button onClick={submit} disabled={saving} className="rounded-lg bg-teal-700 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-800 disabled:opacity-60">
            {saving ? "Saving..." : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}

function DetailModal({ card, stage, onClose, onEdit }) {
  if (!card) return null;
  const config = opportunityFieldConfig(card.industryKey);
  const sourceLabel = sourceFilterValue(card);
  const website = websiteSource(card);
  const details = card.details || parseOpportunityDetails(card.detailsJson);
  const visibleDetails = config.fields
    .map((field) => ({ ...field, value: details[field.key] }))
    .filter((field) => field.value !== null && field.value !== undefined && String(field.value).trim() !== "");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-2xl">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-950">Opportunity Details</h2>
          <button onClick={onClose} className="rounded-md px-2 py-1 text-gray-500 hover:bg-gray-100">x</button>
        </div>
        <div className="mb-5 flex items-center gap-3">
          <Avatar name={card.contactName} />
          <div>
            <h3 className="font-bold text-gray-950">{card.title}</h3>
            <p className="text-sm text-gray-500">{card.contactName} · {card.contactPhone || "No phone"}</p>
          </div>
        </div>
        <div className="space-y-3 text-sm">
          <div className="flex justify-between gap-4">
            <span className="text-gray-400">Stage</span>
            <span className="font-semibold" style={{ color: stage?.color }}>{stage?.label || card.stage}</span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-gray-400">Mapped Item</span>
            <span className="text-right text-gray-700">{card.domainItemName || "-"}</span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-gray-400">Amount</span>
            <span className="text-right text-gray-700">{formatAmount(card.amount) || "-"}</span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-gray-400">Expected Close</span>
            <span className="text-right text-gray-700">{displayDate(card.expectedCloseDate) || "-"}</span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-gray-400">Expected Revenue</span>
            <span className="text-right text-gray-700">{formatAmount(card.expectedRevenue) || "-"}</span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-gray-400">Probability</span>
            <span className="text-right text-gray-700">{card.probability !== "" ? `${card.probability}%` : "-"}</span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-gray-400">Priority</span>
            <span className="text-right text-gray-700">{card.priority || "-"}</span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-gray-400">Lead Source</span>
            <span className="text-right text-gray-700">{sourceLabel || "-"}</span>
          </div>
          {website?.page && (
            <div className="flex justify-between gap-4">
              <span className="text-gray-400">Website Page</span>
              <span className="max-w-64 truncate text-right text-gray-700" title={website.page}>{website.page}</span>
            </div>
          )}
          <div className="flex justify-between gap-4">
            <span className="text-gray-400">Activity SLA</span>
            <span className={`text-right ${card.activitySlaBreached ? "font-semibold text-red-700" : "text-gray-700"}`}>
              {card.activitySlaDueAt ? `${displayDate(card.activitySlaDueAt)}${card.activitySlaBreached ? " overdue" : ""}` : "-"}
            </span>
          </div>
          {card.lostReason && (
            <div className="flex justify-between gap-4">
              <span className="text-gray-400">Lost Reason</span>
              <span className="text-right text-gray-700">{card.lostReason}</span>
            </div>
          )}
          {visibleDetails.map((field) => (
            <div key={field.key} className="flex justify-between gap-4">
              <span className="text-gray-400">{field.label}</span>
              <span className="text-right text-gray-700">{field.value}</span>
            </div>
          ))}
          <div className="flex justify-between gap-4">
            <span className="text-gray-400">Notes</span>
            <span className="text-right text-gray-700">{card.notes || "-"}</span>
          </div>
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50">
            Close
          </button>
          <button onClick={() => onEdit(card)} className="rounded-lg bg-teal-700 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-800">
            Edit
          </button>
        </div>
      </div>
    </div>
  );
}

function EmailModal({ card, sending, onClose, onSend }) {
  const [form, setForm] = useState({
    toEmail: "",
    subject: "",
    bodyHtml: "",
    bodyText: "",
    designJson: "",
    mjml: "",
  });
  const [templateVersion, setTemplateVersion] = useState(0);

  useEffect(() => {
    if (!card) return;
    setForm({
      toEmail: "",
      subject: `Regarding ${card.title}`,
      bodyHtml: "",
      bodyText: "",
      designJson: "",
      mjml: "",
    });
  }, [card]);

  if (!card) return null;

  const setValue = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const setDesign = (designerValue) => {
    setForm((current) => ({
      ...current,
      designJson: designerValue.designJson || current.designJson || "",
      mjml: designerValue.mjml || current.mjml || "",
      bodyHtml: designerValue.bodyHtml || current.bodyHtml || "",
    }));
  };

  const applyTemplate = (payload) => {
    setForm((current) => ({
      ...current,
      subject: payload.subject || current.subject,
      bodyHtml: payload.bodyHtml || "",
      bodyText: payload.bodyText || "",
      designJson: payload.designJson || "",
      mjml: payload.mjml || "",
    }));
    setTemplateVersion((version) => version + 1);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="max-h-[92vh] w-full max-w-6xl overflow-y-auto rounded-xl bg-white p-6 shadow-2xl">
        <div className="mb-5 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-gray-950">Send Email</h2>
            <p className="text-sm text-gray-500">{card.title} · {card.contactName}</p>
          </div>
          <button onClick={onClose} className="rounded-md px-2 py-1 text-gray-500 hover:bg-gray-100">x</button>
        </div>
        <div className="space-y-3">
          <input
            value={form.toEmail}
            onChange={(event) => setValue("toEmail", event.target.value)}
            placeholder="To email, or leave blank to use contact email"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-teal-500"
          />
          <input
            value={form.subject}
            onChange={(event) => setValue("subject", event.target.value)}
            placeholder="Subject"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-teal-500"
          />
          <EmailTemplatePicker
            onApply={applyTemplate}
            mergeData={{
              contactName: card.contactName,
              contactPhone: card.contactPhone,
              leadSource: sourceFilterValue(card),
              leadSourceDetail: card.contactLeadSourceDetail,
              opportunityName: card.title,
              pipelineName: card.pipelineName,
            }}
          />
          <Suspense fallback={<div className="rounded-lg border border-gray-200 p-4 text-center text-sm text-gray-500">Loading email designer...</div>}>
            <div className="email-designer-scroll">
              <EmailDesigner
                key={`pipeline-email-${card.id}-${templateVersion}`}
                subject={form.subject}
                value={form}
                onChange={setDesign}
                height="560px"
              />
            </div>
          </Suspense>
          <textarea
            rows={4}
            value={form.bodyText}
            onChange={(event) => setValue("bodyText", event.target.value)}
            placeholder="Plain text fallback"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-teal-500"
          />
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50">
            Cancel
          </button>
          <button
            onClick={() => onSend(form)}
            disabled={sending || !form.subject.trim() || (!form.bodyHtml.trim() && !form.bodyText.trim())}
            className="rounded-lg bg-teal-700 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-800 disabled:opacity-60"
          >
            {sending ? "Sending..." : "Send"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ContactPipeline() {
  const navigate = useNavigate();
  const dragging = useRef(null);
  const [stages, setStages] = useState(buildStages(DEFAULT_STAGES));
  const [pipelines, setPipelines] = useState([]);
  const [selectedPipelineId, setSelectedPipelineId] = useState("");
  const [columns, setColumns] = useState(() => buildColumns([], buildStages(DEFAULT_STAGES)));
  const [stageTotals, setStageTotals] = useState({});
  const [opportunityPage, setOpportunityPage] = useState({
    page: 0,
    size: OPPORTUNITY_PAGE_SIZE,
    totalElements: 0,
    totalPages: 0,
    hasNext: false,
  });
  const [stageVisibleLimits, setStageVisibleLimits] = useState({});
  const [contacts, setContacts] = useState([]);
  const [contactTotal, setContactTotal] = useState(0);
  const [users, setUsers] = useState([]);
  const [domainItems, setDomainItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [sendingEmail, setSendingEmail] = useState(false);
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [datePreset, setDatePreset] = useState("ALL");
  const [dateRange, setDateRange] = useState(() => presetDateRange("ALL"));
  const [toast, setToast] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editCard, setEditCard] = useState(null);
  const [activeStage, setActiveStage] = useState("NEW");
  const [detailCard, setDetailCard] = useState(null);
  const [emailCard, setEmailCard] = useState(null);

  const showToast = useCallback((message, type = "success") => setToast({ message, type }), []);

  const setFilter = (key, value) => {
    setFilters((current) => ({ ...current, [key]: value }));
  };

  const resetStageVisibleLimits = useCallback((nextStages = []) => {
    setStageVisibleLimits(
      Object.fromEntries(nextStages.map((stage) => [stage.key, INITIAL_STAGE_CARD_LIMIT]))
    );
  }, []);

  const reloadBoard = useCallback(async ({ page = 0, append = false } = {}) => {
    setLoading(true);
    try {
      const pipelineResponse = await api.get("/api/pipelines");
      const nextPipelines = normalizeList(pipelineResponse.data);
      const defaultPipeline = nextPipelines.find((pipeline) => pipeline.defaultPipeline) || nextPipelines[0];
      const resolvedPipelineId = selectedPipelineId || defaultPipeline?.id || "";
      setPipelines(nextPipelines);
      if (!selectedPipelineId && resolvedPipelineId) {
        setSelectedPipelineId(String(resolvedPipelineId));
      }

      const [stageResponse, opportunityResponse, stageCountResponse, contactResponse, domainItemResponse] = await Promise.all([
        api.get("/api/crm-config/pipeline-stages", resolvedPipelineId ? { params: { pipelineId: resolvedPipelineId } } : undefined),
        api.get("/api/opportunities/page", {
          params: {
            ...(resolvedPipelineId ? { pipelineId: resolvedPipelineId } : {}),
            ...dateRangeParams(dateRange),
            page,
            size: OPPORTUNITY_PAGE_SIZE,
          },
        }),
        api.get("/api/opportunities/stage-counts", {
          params: {
            ...(resolvedPipelineId ? { pipelineId: resolvedPipelineId } : {}),
            ...dateRangeParams(dateRange),
          },
        }),
        api.get("/api/contacts/page?page=0&size=500"),
        api.get("/api/domain-items?activeOnly=true"),
      ]);

      const nextStages = buildStages(stageResponse.data || []);
      const opportunities = normalizeList(opportunityResponse.data);
      const nextContacts = normalizeList(contactResponse.data);
      const nextDomainItems = normalizeList(domainItemResponse.data);
      const cards = opportunities.map((opportunity) => toCard(opportunity, nextStages));
      const totalContacts = Number(contactResponse.data?.totalElements);
      const nextOpportunityPage = {
        page: Number(opportunityResponse.data?.page) || page,
        size: Number(opportunityResponse.data?.size) || OPPORTUNITY_PAGE_SIZE,
        totalElements: Number(opportunityResponse.data?.totalElements) || opportunities.length,
        totalPages: Number(opportunityResponse.data?.totalPages) || 0,
        hasNext: Boolean(opportunityResponse.data?.hasNext),
      };

      setStages(nextStages);
      setContacts(nextContacts.map((contact) => ({
        id: contact.id || contact._id,
        name: contact.name || contact.email || contact.phone || "Unknown Contact",
        phone: contact.phone || "",
      })).filter((contact) => contact.id));
      setContactTotal(Number.isFinite(totalContacts) ? totalContacts : nextContacts.length);
      setDomainItems(nextDomainItems);
      setStageTotals(stageCountResponse.data || {});
      setColumns((current) => {
        const nextColumns = buildColumns(cards, nextStages);
        if (!append) return nextColumns;
        const merged = {};
        nextStages.forEach((stage) => {
          const existing = current[stage.key] || [];
          const incoming = nextColumns[stage.key] || [];
          const seen = new Set(existing.map((card) => String(card.id)));
          merged[stage.key] = [
            ...existing,
            ...incoming.filter((card) => !seen.has(String(card.id))),
          ];
        });
        return merged;
      });
      setOpportunityPage(nextOpportunityPage);
      setActiveStage(nextStages[0]?.key || "NEW");
      if (!append) {
        resetStageVisibleLimits(nextStages);
      }

      api.get("/api/users")
        .then((response) => setUsers(normalizeList(response.data)))
        .catch(() => setUsers([]));
    } catch (error) {
      showToast(error?.response?.data?.message || error.message || "Failed to load opportunity pipeline", "error");
    } finally {
      setLoading(false);
    }
  }, [dateRange, resetStageVisibleLimits, selectedPipelineId, showToast]);

  useEffect(() => {
    reloadBoard();
  }, [reloadBoard]);

  const total = useMemo(
    () => stages.reduce((sum, stage) => sum + (columns[stage.key]?.length || 0), 0),
    [columns, stages]
  );

  const wonCount = (columns.WON || columns.BOOKED || columns.BOOKING || columns.ADMISSION || []).length;
  const closeRate = total > 0 ? Math.round((wonCount / total) * 100) : 0;
  const allCards = useMemo(
    () => stages.flatMap((stage) => columns[stage.key] || []),
    [columns, stages]
  );
  const sourceOptions = useMemo(
    () => Array.from(new Set(allCards.map(sourceFilterValue).filter(Boolean))).sort(),
    [allCards]
  );
  const ownerOptions = useMemo(() => {
    const userMap = new Map(users.map((user) => [String(user.id), user]));
    return Array.from(new Set(allCards.map((card) => String(card.ownerUserId || "")).filter(Boolean)))
      .map((ownerId) => ({
        id: ownerId,
        label: userMap.get(ownerId)?.email || `User #${ownerId}`,
      }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [allCards, users]);
  const selectedPipeline = useMemo(
    () => pipelines.find((pipeline) => String(pipeline.id) === String(selectedPipelineId)) || pipelines[0] || null,
    [pipelines, selectedPipelineId]
  );

  const filteredColumns = useMemo(() => {
    const query = search.trim().toLowerCase();
    const next = {};
    stages.forEach((stage) => {
      next[stage.key] = (columns[stage.key] || []).filter((card) => {
        const matchesSearch = !query || (
          card.title.toLowerCase().includes(query) ||
          card.contactName.toLowerCase().includes(query) ||
          card.contactPhone.toLowerCase().includes(query) ||
          sourceFilterValue(card).toLowerCase().includes(query) ||
          String(card.contactLeadSourceDetail || "").toLowerCase().includes(query)
        );
        return matchesSearch
          && (!filters.ownerUserId || String(card.ownerUserId) === String(filters.ownerUserId))
          && (!filters.source || sourceFilterValue(card) === filters.source)
          && matchesExpectedClose(card, filters.expectedClose)
          && (!filters.staleOnly || isStaleCard(card));
      });
    });
    return next;
  }, [columns, filters, search, stages]);
  const hasClientSidePipelineFilter = Boolean(
    search.trim()
    || filters.ownerUserId
    || filters.source
    || filters.expectedClose
    || filters.staleOnly
  );
  const filteredTotal = useMemo(
    () => stages.reduce((sum, stage) => sum + (filteredColumns[stage.key]?.length || 0), 0),
    [filteredColumns, stages]
  );
  const visibleTotal = useMemo(
    () => stages.reduce((sum, stage) => {
      const cards = filteredColumns[stage.key] || [];
      const limit = stageVisibleLimits[stage.key] || INITIAL_STAGE_CARD_LIMIT;
      return sum + Math.min(cards.length, limit);
    }, 0),
    [filteredColumns, stageVisibleLimits, stages]
  );

  useEffect(() => {
    resetStageVisibleLimits(stages);
  }, [dateRange, filters, resetStageVisibleLimits, search, selectedPipelineId, stages]);

  const showMoreInStage = (stageKey) => {
    setStageVisibleLimits((current) => ({
      ...current,
      [stageKey]: (current[stageKey] || INITIAL_STAGE_CARD_LIMIT) + STAGE_CARD_LIMIT_STEP,
    }));
  };

  const loadNextOpportunityPage = () => {
    if (loading || !opportunityPage.hasNext) return;
    reloadBoard({ page: opportunityPage.page + 1, append: true });
  };

  const onDragStart = (stageKey, cardId) => {
    dragging.current = { stageKey, cardId };
  };

  const onDrop = async (destKey) => {
    if (!dragging.current) return;
    const { stageKey: sourceKey, cardId } = dragging.current;
    dragging.current = null;
    if (sourceKey === destKey) return;

    const previous = columns;
    const sourceCards = columns[sourceKey] || [];
    const draggedCard = sourceCards.find((card) => card.id === cardId);
    let lostReason = draggedCard?.lostReason || "";
    if (destKey === "LOST") {
      const enteredReason = window.prompt("Lost reason is required before marking this opportunity as Lost.", lostReason);
      if (!enteredReason || !enteredReason.trim()) {
        showToast("Lost reason is required.", "error");
        return;
      }
      lostReason = enteredReason.trim();
    }

    setColumns((current) => {
      const next = {};
      stages.forEach((stage) => {
        next[stage.key] = [...(current[stage.key] || [])];
      });
      const source = next[sourceKey] || [];
      const destination = next[destKey] || [];
      const index = source.findIndex((card) => card.id === cardId);
      if (index === -1) return current;
      const [card] = source.splice(index, 1);
      destination.push({ ...card, stage: destKey, lostReason: destKey === "LOST" ? lostReason : "" });
      return next;
    });

    try {
      await api.post(`/api/opportunities/${cardId}/stage`, { stage: destKey, lostReason: destKey === "LOST" ? lostReason : null });
      showToast(`Moved to ${stages.find((stage) => stage.key === destKey)?.label || destKey}`);
    } catch (error) {
      setColumns(previous);
      showToast(error?.response?.data?.error || error?.response?.data?.message || "Stage update failed", "error");
    }
  };

  const openAdd = (stageKey) => {
    setEditCard(null);
    setActiveStage(stageKey);
    setModalOpen(true);
  };

  const openEdit = (card) => {
    setEditCard(card);
    setActiveStage(card.stage);
    setDetailCard(null);
    setModalOpen(true);
  };

  const saveCard = async (card) => {
    setSaving(true);
    const payload = {
      contactId: card.contactId,
      title: card.title,
      stage: card.stage,
      pipelineId: selectedPipelineId ? Number(selectedPipelineId) : null,
      industryKey: selectedPipeline?.industryKey || card.industryKey || "GENERIC",
      domainItemId: card.domainItemId,
      amount: card.amount,
      expectedRevenue: card.expectedRevenue,
      probability: card.probability,
      priority: card.priority,
      lostReason: card.lostReason,
      activitySlaHours: card.activitySlaHours,
      expectedCloseDate: card.expectedCloseDate,
      source: card.source,
      notes: card.notes,
      detailsJson: card.detailsJson,
    };

    try {
      if (editCard) {
        const response = await api.put(`/api/opportunities/${card.id}`, payload);
        const updated = toCard(response.data, stages);
        setColumns((current) => {
          const next = {};
          stages.forEach((stage) => {
            next[stage.key] = (current[stage.key] || []).filter((item) => item.id !== card.id);
          });
          next[updated.stage] = [...(next[updated.stage] || []), updated];
          return next;
        });
        showToast("Opportunity updated");
      } else {
        const response = await api.post("/api/opportunities", payload);
        const created = toCard(response.data, stages);
        setColumns((current) => ({
          ...current,
          [created.stage]: [...(current[created.stage] || []), created],
        }));
        showToast("Opportunity added");
      }
      setModalOpen(false);
      setEditCard(null);
    } catch (error) {
      showToast(error?.response?.data?.error || error?.response?.data?.message || "Save failed", "error");
    } finally {
      setSaving(false);
    }
  };

  const deleteCard = async (card) => {
    if (!window.confirm(`Delete opportunity "${card.title}"?`)) return;
    try {
      await api.delete(`/api/opportunities/${card.id}`);
      setColumns((current) => ({
        ...current,
        [card.stage]: (current[card.stage] || []).filter((item) => item.id !== card.id),
      }));
      showToast("Opportunity deleted", "info");
    } catch (error) {
      showToast(error?.response?.data?.error || error?.response?.data?.message || "Delete failed", "error");
    }
  };

  const sendOpportunityEmail = async (form) => {
    if (!emailCard) return;
    setSendingEmail(true);
    try {
      await api.post("/api/email/send", {
        contactId: emailCard.contactId,
        opportunityId: Number(emailCard.id),
        toEmail: form.toEmail.trim() || null,
        subject: form.subject.trim(),
        bodyHtml: form.bodyHtml.trim() || null,
        bodyText: form.bodyText.trim(),
      });
      setEmailCard(null);
      showToast("Email sent");
    } catch (error) {
      showToast(error?.response?.data?.message || error.message || "Email failed", "error");
    } finally {
      setSendingEmail(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-gray-900">
      <header className="sticky top-0 z-30 border-b border-gray-200 bg-white px-6 py-4 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight text-gray-950">Opportunity Pipeline</h1>
            <p className="text-sm text-gray-500">Work one pipeline at a time. The selected pipeline controls industry context.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={selectedPipelineId}
              onChange={(event) => setSelectedPipelineId(event.target.value)}
              className="min-h-10 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-semibold text-gray-700 outline-none focus:border-teal-500"
            >
              {pipelines.map((pipeline) => (
                <option key={pipeline.id} value={pipeline.id}>
                  {pipeline.name}{pipeline.defaultPipeline ? " (Default)" : ""}
                </option>
              ))}
            </select>
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search opportunities..."
              className="min-h-10 w-64 rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-teal-500"
            />
            <button onClick={() => reloadBoard()} className="min-h-10 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50">
              Refresh
            </button>
            <button
              onClick={() => openAdd(stages[0]?.key || "NEW")}
              disabled={contacts.length === 0}
              className="min-h-10 rounded-lg bg-teal-700 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              + Add Opportunity
            </button>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-4 text-xs text-gray-500">
          <span>{formatCount(total)} loaded</span>
          {opportunityPage.totalElements > total && <span>{formatCount(opportunityPage.totalElements)} in pipeline</span>}
          <span>{filteredTotal} matching filters</span>
          {filteredTotal > visibleTotal && <span>{visibleTotal} loaded on board</span>}
          <span>{formatCount(contactTotal || contacts.length)} contacts total</span>
          {contactTotal > contacts.length && <span>{formatCount(contacts.length)} loaded for add dialog</span>}
          <span>{stages.length} stages</span>
          {selectedPipeline && <span>{industryLabel(selectedPipeline.industryKey)} context</span>}
          <span>Close rate {closeRate}%</span>
          {loading && <span className="text-teal-700">Loading...</span>}
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-[180px_180px_190px_auto_auto]">
          <select
            value={filters.ownerUserId}
            onChange={(event) => setFilter("ownerUserId", event.target.value)}
            className="min-h-10 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-teal-500"
          >
            <option value="">All owners</option>
            {ownerOptions.map((owner) => (
              <option key={owner.id} value={owner.id}>{owner.label}</option>
            ))}
          </select>
          <select
            value={filters.source}
            onChange={(event) => setFilter("source", event.target.value)}
            className="min-h-10 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-teal-500"
          >
            <option value="">All sources</option>
            {sourceOptions.map((source) => (
              <option key={source} value={source}>{source.replaceAll("_", " ")}</option>
            ))}
          </select>
          <select
            value={filters.expectedClose}
            onChange={(event) => setFilter("expectedClose", event.target.value)}
            className="min-h-10 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-teal-500"
          >
            <option value="">Any close date</option>
            <option value="OVERDUE">Overdue close</option>
            <option value="THIS_WEEK">Closing this week</option>
            <option value="NEXT_30">Closing next 30 days</option>
            <option value="NO_DATE">No close date</option>
          </select>
          <label className="flex min-h-10 items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-semibold text-gray-700">
            <input
              type="checkbox"
              checked={filters.staleOnly}
              onChange={(event) => setFilter("staleOnly", event.target.checked)}
              className="rounded border-gray-300 text-teal-600"
            />
            Stale only
          </label>
          <button
            type="button"
            onClick={() => {
              setSearch("");
              setFilters(EMPTY_FILTERS);
            }}
            className="min-h-10 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
          >
            Clear filters
          </button>
        </div>
        <div className="mt-3 max-w-xl">
          <DateRangeFilter
            value={dateRange}
            preset={datePreset}
            onChange={setDateRange}
            onPresetChange={setDatePreset}
            compact
          />
        </div>
      </header>

      <main className="flex gap-5 overflow-x-auto p-6">
        {stages.map((stage) => (
          <StageColumn
            key={stage.key}
            stage={stage}
            cards={filteredColumns[stage.key] || []}
            totalCount={hasClientSidePipelineFilter ? (filteredColumns[stage.key] || []).length : stageTotals[stage.key]}
            visibleLimit={stageVisibleLimits[stage.key] || INITIAL_STAGE_CARD_LIMIT}
            onShowMore={showMoreInStage}
            onAdd={openAdd}
            onCardClick={(card) => navigate(`/dashboard/opportunities/${card.id}`)}
            onEdit={openEdit}
            onEmail={setEmailCard}
            onDelete={deleteCard}
            onDragStart={onDragStart}
            onDrop={onDrop}
          />
        ))}
      </main>

      {(opportunityPage.hasNext || opportunityPage.totalElements > total) && (
        <div className="border-t border-gray-200 bg-white px-6 py-4">
          <div className="flex flex-col gap-3 rounded-xl border border-dashed border-gray-300 bg-gray-50 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-bold text-gray-900">
                Loaded {formatCount(total)} of {formatCount(opportunityPage.totalElements)} opportunities
              </p>
              <p className="mt-1 text-xs text-gray-500">
                Load more records when you need to search or move older opportunities on this board.
              </p>
            </div>
            <button
              type="button"
              onClick={loadNextOpportunityPage}
              disabled={loading || !opportunityPage.hasNext}
              className="min-h-10 rounded-lg border border-teal-200 bg-teal-50 px-4 py-2 text-sm font-bold text-teal-700 hover:bg-teal-100 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? "Loading..." : `Load next ${formatCount(OPPORTUNITY_PAGE_SIZE)}`}
            </button>
          </div>
        </div>
      )}

      <OpportunityModal
        open={modalOpen}
        stages={stages}
        contacts={contacts}
        domainItems={domainItems}
        initial={editCard}
        defaultStage={activeStage}
        pipeline={selectedPipeline}
        saving={saving}
        onClose={() => {
          setModalOpen(false);
          setEditCard(null);
        }}
        onSave={saveCard}
      />

      <DetailModal
        card={detailCard}
        stage={stages.find((stage) => stage.key === detailCard?.stage)}
        onClose={() => setDetailCard(null)}
        onEdit={openEdit}
      />

      <EmailModal
        card={emailCard}
        sending={sendingEmail}
        onClose={() => setEmailCard(null)}
        onSend={sendOpportunityEmail}
      />

      <Toast toast={toast} onClose={() => setToast(null)} />
    </div>
  );
}
