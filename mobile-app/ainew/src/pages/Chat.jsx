import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Client } from "@stomp/stompjs";
import SockJS from "sockjs-client";
import {
  ArrowLeft,
  Briefcase,
  Clock3,
  FileText,
  FormInput,
  Image as ImageIcon,
  Link2,
  ListChecks,
  PanelRightClose,
  PanelRightOpen,
  Search,
  Send,
  UserRound,
  X,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import api from "../api/axios";
import { WS_BASE_URL } from "../config/env";
import { OPPORTUNITY_INDUSTRY_OPTIONS } from "../config/opportunityFields";
import MediaLibraryDialog from "../components/media/MediaLibraryDialog";
import DateRangeFilter, { dateRangeParams, presetDateRange } from "../components/common/DateRangeFilter";
import AiAssistPanel from "../components/ai/AiAssistPanel";
import TaskModal from "./TaskModal";

const INBOX_PAGE_SIZE = 30;
const MESSAGE_PAGE_SIZE = 30;
const TASK_STATUSES = ["OPEN", "IN_PROGRESS", "COMPLETED", "CANCELLED"];
const DEFAULT_STAGES = [
  { stageKey: "NEW", label: "New", displayOrder: 1, active: true },
  { stageKey: "QUALIFIED", label: "Qualified", displayOrder: 2, active: true },
  { stageKey: "FOLLOW_UP", label: "Follow Up", displayOrder: 3, active: true },
  { stageKey: "WON", label: "Won", displayOrder: 4, active: true },
  { stageKey: "LOST", label: "Lost", displayOrder: 5, active: true },
];

const INDUSTRY_OPTIONS = OPPORTUNITY_INDUSTRY_OPTIONS;

function industryLabel(value) {
  const option = INDUSTRY_OPTIONS.find((industry) => industry.key === value);
  if (option) return option.label;
  return String(value || "Generic")
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function normalizeStageKey(value) {
  return String(value || "NEW").trim().toUpperCase().replace(/[\s-]+/g, "_");
}

function normalizeKey(value) {
  return String(value || "").trim().toUpperCase().replace(/[\s-]+/g, "_");
}

function normalizeList(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.items)) return payload.items;
  if (Array.isArray(payload?.content)) return payload.content;
  return [];
}

function apiErrorMessage(error, fallback = "Request failed") {
  const data = error?.response?.data;
  if (typeof data === "string") return data;
  const metaDetails = data?.error_data?.details || data?.error?.error_data?.details;
  const metaMessage = data?.error?.message;
  return data?.message || data?.error || metaDetails || metaMessage || error?.message || fallback;
}

function buildStages(rawStages) {
  const source = rawStages?.length ? rawStages : DEFAULT_STAGES;
  return source
    .filter((stage) => stage.active !== false)
    .sort((a, b) => (a.displayOrder ?? 100) - (b.displayOrder ?? 100))
    .map((stage) => ({
      key: normalizeStageKey(stage.stageKey || stage.key || stage.label),
      label: stage.label || normalizeStageKey(stage.stageKey || stage.key || stage.label).replaceAll("_", " "),
    }));
}

function parseTags(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value.filter(Boolean);
  return String(value)
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function formatDateTime(value) {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleString();
}

function formatAmount(value) {
  if (value === null || value === undefined || value === "") return "";
  const number = Number(value);
  if (Number.isNaN(number)) return String(value);
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(number);
}

function timeAgo(value) {
  if (!value) return "";
  const diff = Date.now() - new Date(value).getTime();
  if (Number.isNaN(diff)) return "";
  if (diff < 60_000) return "just now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return `${Math.floor(diff / 86_400_000)}d ago`;
}

function normalizeMessage(raw) {
  return {
    ...raw,
    id: raw.messageId ?? raw.id,
  };
}

function sortMessagesAsc(items) {
  return [...items].sort(
    (a, b) => new Date(a.createdAt || 0) - new Date(b.createdAt || 0)
  );
}

function templateVariableCount(template) {
  const text = `${template?.body || ""}\n${template?.componentsJson || ""}`;
  let max = 0;
  for (const match of text.matchAll(/\{\{\s*(\d+)\s*}}/g)) {
    max = Math.max(max, Number(match[1]));
  }
  return max;
}

function renderTemplatePreview(body, params) {
  return String(body || "[WhatsApp template]").replace(/\{\{\s*(\d+)\s*}}/g, (_, index) => {
    const value = params[Number(index) - 1];
    return value?.trim() || `{{${index}}}`;
  });
}

function parseTemplateComponents(template) {
  try {
    const parsed = JSON.parse(template?.componentsJson || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function templateHeaderMediaFormat(template) {
  const header = parseTemplateComponents(template).find((component) => String(component?.type || "").toUpperCase() === "HEADER");
  const format = String(header?.format || "").toUpperCase();
  return ["IMAGE", "VIDEO", "DOCUMENT"].includes(format) ? format : "";
}

function templateBodyText(template) {
  if (template?.body) return template.body;
  const body = parseTemplateComponents(template).find((component) => String(component?.type || "").toUpperCase() === "BODY");
  return body?.text || "";
}

function isMetaSampleMediaUrl(value) {
  try {
    const hostname = new URL(value).hostname.toLowerCase();
    return hostname.includes("scontent.whatsapp.net") || hostname.includes("lookaside.fbsbx.com");
  } catch {
    return false;
  }
}

function sameId(left, right) {
  return String(left ?? "") === String(right ?? "");
}

function isDesktopChatViewport() {
  if (typeof window === "undefined") return true;
  return window.matchMedia("(min-width: 1280px)").matches;
}

function MediaBubble({ message }) {
  if (!message.mediaType) return null;

  const label = message.mediaFileName || message.mediaType;

  if (message.mediaType === "IMAGE" && message.mediaUrl) {
    return (
      <a href={message.mediaUrl} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-xl border border-gray-200">
        <img src={message.mediaUrl} alt={label} className="max-h-72 w-full object-cover" />
      </a>
    );
  }

  if (message.mediaType === "VIDEO" && message.mediaUrl) {
    return (
      <video controls className="max-h-72 w-full rounded-xl border border-gray-200 bg-black">
        <source src={message.mediaUrl} />
      </video>
    );
  }

  if (message.mediaType === "AUDIO" && message.mediaUrl) {
    return <audio controls className="w-full"><source src={message.mediaUrl} /></audio>;
  }

  if (message.mediaUrl) {
    return (
      <a
        href={message.mediaUrl}
        target="_blank"
        rel="noreferrer"
        className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-teal-700"
      >
        <Link2 size={16} />
        <span>{label}</span>
      </a>
    );
  }

  return (
    <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 px-3 py-2 text-xs text-gray-600">
      {message.mediaType} received
      {message.mediaFileName ? ` • ${message.mediaFileName}` : ""}
      {message.mediaMimeType ? ` • ${message.mediaMimeType}` : ""}
    </div>
  );
}

function MessageBubble({ message }) {
  const inbound = message.direction === "INBOUND";
  const failed = String(message.status || "").toUpperCase() === "FAILED";

  return (
    <article className={`flex ${inbound ? "justify-start" : "justify-end"}`}>
      <div className={`max-w-[88%] rounded-2xl px-4 py-3 shadow-sm sm:max-w-[75%] ${
        failed
          ? "border border-red-200 bg-red-50 text-red-900"
          : inbound
            ? "bg-white border border-gray-200 text-gray-900"
            : "bg-teal-700 text-white"
      }`}>
        <div className={`mb-2 flex flex-wrap items-center gap-2 text-[11px] ${
          failed ? "text-red-600" : inbound ? "text-gray-500" : "text-teal-100"
        }`}>
          <span>{message.direction || "UNKNOWN"}</span>
          <span>•</span>
          <span>{message.status || "—"}</span>
          <span>•</span>
          <span>{formatDateTime(message.createdAt)}</span>
        </div>

        {message.mediaType && (
          <div className="mb-3">
            <MediaBubble message={message} />
          </div>
        )}

        {message.textBody && (
          <p className="whitespace-pre-wrap break-words text-sm">
            {message.textBody}
          </p>
        )}

        {!message.textBody && !message.mediaType && (
          <p className={`text-sm ${failed ? "text-red-700" : inbound ? "text-gray-500" : "text-teal-100"}`}>
            No message body stored
          </p>
        )}

        {message.errorMessage && (
          <div className={`mt-3 rounded-xl px-3 py-2 text-xs ${
            failed ? "border border-red-200 bg-white text-red-700" : inbound ? "bg-red-50 text-red-700" : "bg-white/15 text-white"
          }`}>
            <span className="mb-1 block font-semibold">Failed reason</span>
            {message.errorMessage}
          </div>
        )}
      </div>
    </article>
  );
}

export default function ChatApp() {
  const navigate = useNavigate();
  const token = sessionStorage.getItem("token") || "";
  const tenantId = sessionStorage.getItem("tenantId") || "";

  const [conversations, setConversations] = useState([]);
  const [selectedContactId, setSelectedContactId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [draft, setDraft] = useState("");
  const [messageSearch, setMessageSearch] = useState("");
  const [inboxFilters, setInboxFilters] = useState({
    assignedToMe: false,
    unreadOnly: false,
    status: "ALL",
  });
  const [datePreset, setDatePreset] = useState("30D");
  const [dateRange, setDateRange] = useState(() => presetDateRange("30D"));
  const [inboxPageInfo, setInboxPageInfo] = useState({
    page: 0,
    size: INBOX_PAGE_SIZE,
    totalElements: 0,
    totalPages: 1,
    hasNext: false,
  });
  const [showMediaForm, setShowMediaForm] = useState(false);
  const [showTemplateForm, setShowTemplateForm] = useState(false);
  const [showFlowForm, setShowFlowForm] = useState(false);
  const [mediaDialogOpen, setMediaDialogOpen] = useState(false);
  const [templateHeaderMediaDialogOpen, setTemplateHeaderMediaDialogOpen] = useState(false);
  const [mediaForm, setMediaForm] = useState({
    mediaType: "IMAGE",
    mediaUrl: "",
    caption: "",
    fileName: "",
  });
  const [publishedFlows, setPublishedFlows] = useState([]);
  const [whatsAppTemplates, setWhatsAppTemplates] = useState([]);
  const [templateForm, setTemplateForm] = useState({
    templateId: "",
    bodyParameters: [],
    headerMediaUrl: "",
  });
  const [flowForm, setFlowForm] = useState({
    flowId: "",
    body: "",
    ctaText: "Open form",
  });
  const [loading, setLoading] = useState(false);
  const [mediaSending, setMediaSending] = useState(false);
  const [templateSending, setTemplateSending] = useState(false);
  const [flowSending, setFlowSending] = useState(false);
  const [loadingConversation, setLoadingConversation] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [messagePage, setMessagePage] = useState(0);
  const [hasOlderMessages, setHasOlderMessages] = useState(false);
  const [contactDetails, setContactDetails] = useState(null);
  const [assignableUsers, setAssignableUsers] = useState([]);
  const [assignmentValue, setAssignmentValue] = useState("");
  const [pipelines, setPipelines] = useState([]);
  const [selectedPipelineId, setSelectedPipelineId] = useState("");
  const [createPipelineId, setCreatePipelineId] = useState("");
  const [pipelineStages, setPipelineStages] = useState(buildStages(DEFAULT_STAGES));
  const [opportunities, setOpportunities] = useState([]);
  const [contactTasks, setContactTasks] = useState([]);
  const [domainItems, setDomainItems] = useState([]);
  const [selectedOpportunityId, setSelectedOpportunityId] = useState("");
  const [opportunityStageValue, setOpportunityStageValue] = useState("NEW");
  const [opportunityForm, setOpportunityForm] = useState({
    title: "",
    domainItemId: "",
    amount: "",
  });
  const [taskModal, setTaskModal] = useState(null);
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [activeCrmTab, setActiveCrmTab] = useState("contact");
  const [showCrmPanel, setShowCrmPanel] = useState(true);
  const [mobileCrmOpen, setMobileCrmOpen] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const [updatingStage, setUpdatingStage] = useState(false);
  const [savingOpportunity, setSavingOpportunity] = useState(false);
  const [loadingTasks, setLoadingTasks] = useState(false);
  const [updatingTaskId, setUpdatingTaskId] = useState(null);
  const [markingUnread, setMarkingUnread] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");

  const stompRef = useRef(null);
  const selectedContactIdRef = useRef(selectedContactId);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    if (!token) {
      window.location.href = "/login";
    }
  }, [token]);

  useEffect(() => {
    selectedContactIdRef.current = selectedContactId;
  }, [selectedContactId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const filteredConversations = useMemo(() => {
    return conversations;
  }, [conversations]);

  const visibleMessages = useMemo(() => {
    const query = messageSearch.trim().toLowerCase();
    if (!query) return messages;
    return messages.filter((message) =>
      message.textBody?.toLowerCase().includes(query) ||
      message.mediaFileName?.toLowerCase().includes(query) ||
      message.mediaType?.toLowerCase().includes(query)
    );
  }, [messages, messageSearch]);

  const selectedConversation = useMemo(
    () => conversations.find((conversation) => sameId(conversation.contactId, selectedContactId)) || null,
    [conversations, selectedContactId]
  );
  const selectedFlow = useMemo(
    () => publishedFlows.find((flow) => String(flow.id) === String(flowForm.flowId)) || null,
    [flowForm.flowId, publishedFlows]
  );
  const selectedTemplate = useMemo(
    () => whatsAppTemplates.find((template) => String(template.id) === String(templateForm.templateId)) || null,
    [templateForm.templateId, whatsAppTemplates]
  );
  const selectedTemplateVariableCount = useMemo(() => templateVariableCount(selectedTemplate), [selectedTemplate]);
  const selectedTemplateHeaderFormat = useMemo(() => templateHeaderMediaFormat(selectedTemplate), [selectedTemplate]);
  const selectedTemplatePreview = useMemo(
    () => renderTemplatePreview(templateBodyText(selectedTemplate), templateForm.bodyParameters),
    [selectedTemplate, templateForm.bodyParameters]
  );
  const selectedFlowNeedsMeta = Boolean(
    selectedFlow && (!selectedFlow.metaFlowId || String(selectedFlow.metaFlowId).startsWith("local-flow-"))
  );
  const selectedTags = useMemo(
    () => parseTags(contactDetails?.tags || selectedConversation?.tags),
    [contactDetails?.tags, selectedConversation?.tags]
  );

  const selectedOpportunity = useMemo(
    () => opportunities.find((opportunity) => String(opportunity.id) === String(selectedOpportunityId)) || null,
    [opportunities, selectedOpportunityId]
  );

  const aiMessageContext = useMemo(() => {
    const sourceMessages = visibleMessages.slice(-12);
    return sourceMessages
      .map((message) => {
        const speaker = message.direction === "INBOUND" ? "Customer" : "Agent";
        const body = message.textBody || message.text || message.caption || message.mediaFileName || message.mediaType || "";
        return `${speaker}: ${body}`;
      })
      .filter((line) => !line.endsWith(": "))
      .join("\n");
  }, [visibleMessages]);

  const selectedPipeline = useMemo(
    () => pipelines.find((pipeline) => String(pipeline.id) === String(selectedPipelineId)) || pipelines[0] || null,
    [pipelines, selectedPipelineId]
  );

  const createPipeline = useMemo(
    () => pipelines.find((pipeline) => String(pipeline.id) === String(createPipelineId)) || selectedPipeline || pipelines[0] || null,
    [createPipelineId, pipelines, selectedPipeline]
  );

  const createPipelineIndustryKey = createPipeline?.industryKey || "GENERIC";

  const taskSummary = useMemo(() => {
    const openStatuses = new Set(["OPEN", "IN_PROGRESS"]);
    return {
      open: contactTasks.filter((task) => openStatuses.has(task.status)).length,
      completed: contactTasks.filter((task) => task.status === "COMPLETED").length,
      overdue: contactTasks.filter((task) => {
        if (!task.dueAt || !openStatuses.has(task.status)) return false;
        return new Date(task.dueAt).getTime() < Date.now();
      }).length,
    };
  }, [contactTasks]);

  const mappedDomainItems = useMemo(() => {
    const pipelineKey = normalizeKey(createPipelineIndustryKey);
    if (!pipelineKey) return domainItems;
    return domainItems.filter((item) => normalizeKey(item.industryKey) === pipelineKey);
  }, [domainItems, createPipelineIndustryKey]);

  const totalUnread = useMemo(
    () => conversations.reduce((sum, conversation) => sum + (conversation.unreadCount || 0), 0),
    [conversations]
  );

  const mergeConversationUpdate = useCallback((incoming) => {
    setConversations((current) => {
      const next = [...current];
      const index = next.findIndex((item) => sameId(item.contactId, incoming.contactId));
      if (index >= 0) {
        next[index] = { ...next[index], ...incoming };
      } else {
        next.unshift(incoming);
      }
      return next.sort((a, b) => new Date(b.lastMessageAt || 0) - new Date(a.lastMessageAt || 0));
    });
  }, []);

  const loadInbox = useCallback(async (nextPage = 0, append = false) => {
    const response = await api.get("/api/inbox/page", {
      params: {
        page: nextPage,
        size: INBOX_PAGE_SIZE,
        assignedToMe: inboxFilters.assignedToMe || undefined,
        unreadOnly: inboxFilters.unreadOnly || undefined,
        status: inboxFilters.status === "ALL" ? undefined : inboxFilters.status,
        query: searchQuery.trim() || undefined,
        ...dateRangeParams(dateRange),
      },
    });

    const items = response.data?.items || [];
    const payload = response.data || {};
    setInboxPageInfo({
      page: payload.page ?? nextPage,
      size: payload.size ?? INBOX_PAGE_SIZE,
      totalElements: payload.totalElements ?? items.length,
      totalPages: Math.max(1, payload.totalPages ?? 1),
      hasNext: Boolean(payload.hasNext),
    });
    setConversations((current) => {
      if (!append) return items;
      const byContact = new Map(current.map((conversation) => [String(conversation.contactId), conversation]));
      items.forEach((conversation) => {
        byContact.set(String(conversation.contactId), conversation);
      });
      return [...byContact.values()].sort((a, b) => new Date(b.lastMessageAt || 0) - new Date(a.lastMessageAt || 0));
    });
    if (!append) {
      const hasActiveSearch = Boolean(searchQuery.trim());
      setSelectedContactId((current) => {
        if (!current) {
          return !hasActiveSearch && isDesktopChatViewport() ? items[0]?.contactId ?? null : null;
        }
        const stillVisible = items.some((item) => sameId(item.contactId, current));
        if (stillVisible) return current;
        return !hasActiveSearch && isDesktopChatViewport() ? items[0]?.contactId ?? null : null;
      });
    }
  }, [dateRange, inboxFilters, searchQuery]);

  const loadMoreConversations = async () => {
    if (!inboxPageInfo.hasNext || loading) return;
    setLoading(true);
    try {
      await loadInbox((inboxPageInfo.page || 0) + 1, true);
    } catch (err) {
      setError(err?.response?.data?.message || err.message || "Failed to load more conversations");
    } finally {
      setLoading(false);
    }
  };

  const loadMessages = useCallback(async (contactId, page = 0, appendOlder = false) => {
    if (!contactId) return;
    if (appendOlder) {
      setLoadingOlder(true);
    } else {
      setLoadingConversation(true);
    }
    try {
      const response = await api.get(`/api/messages/contact/${contactId}/page`, {
        params: { page, size: MESSAGE_PAGE_SIZE, ...dateRangeParams(dateRange) },
      });
      const items = sortMessagesAsc((response.data?.items || []).map(normalizeMessage));
      setMessagePage(response.data?.page ?? page);
      setHasOlderMessages(response.data?.hasNext ?? false);

      setMessages((current) => {
        if (!appendOlder) {
          return items;
        }

        const seen = new Set(current.map((message) => message.id));
        const older = items.filter((message) => !seen.has(message.id));
        return sortMessagesAsc([...older, ...current]);
      });

      if (!appendOlder) {
        await api.post(`/api/inbox/${contactId}/read`);
        setConversations((current) =>
          current.map((conversation) =>
            sameId(conversation.contactId, contactId)
              ? { ...conversation, unreadCount: 0 }
              : conversation
          )
        );
      }
    } catch (err) {
      setError(err?.response?.data?.message || err.message || "Failed to load messages");
    } finally {
      if (appendOlder) {
        setLoadingOlder(false);
      } else {
        setLoadingConversation(false);
      }
    }
  }, [dateRange]);

  const loadOlderMessages = async () => {
    if (!selectedContactId || loadingOlder || !hasOlderMessages) return;
    await loadMessages(selectedContactId, messagePage + 1, true);
  };

  const loadContactDetails = useCallback(async (contactId) => {
    if (!contactId) {
      setContactDetails(null);
      return;
    }

    try {
      const response = await api.get(`/api/contacts/${contactId}`);
      setContactDetails(response.data);
    } catch {
      setContactDetails(null);
    }
  }, []);

  const loadCrmSetup = useCallback(async () => {
    try {
      const pipelineResponse = await api.get("/api/pipelines");
      const nextPipelines = normalizeList(pipelineResponse.data);
      const defaultPipeline = nextPipelines.find((pipeline) => pipeline.defaultPipeline) || nextPipelines[0];
      const resolvedPipelineId = selectedPipelineId || defaultPipeline?.id || "";
      setPipelines(nextPipelines);
      if (!selectedPipelineId && resolvedPipelineId) {
        setSelectedPipelineId(String(resolvedPipelineId));
      }
      if (!createPipelineId && resolvedPipelineId) {
        setCreatePipelineId(String(resolvedPipelineId));
      }

      const [stageResponse, domainItemResponse] = await Promise.all([
        api.get("/api/crm-config/pipeline-stages", resolvedPipelineId ? { params: { pipelineId: resolvedPipelineId } } : undefined),
        api.get("/api/domain-items?activeOnly=true"),
      ]);
      const nextStages = buildStages(stageResponse.data || []);
      setPipelineStages(nextStages);
      setOpportunityStageValue((current) => current || nextStages[0]?.key || "NEW");
      setDomainItems(normalizeList(domainItemResponse.data));
    } catch {
      setPipelineStages(buildStages(DEFAULT_STAGES));
      setDomainItems([]);
    }
  }, [createPipelineId, selectedPipelineId]);

  const loadOpportunities = useCallback(async (contactId) => {
    if (!contactId) {
      setOpportunities([]);
      setSelectedOpportunityId("");
      return;
    }

    try {
      const response = await api.get(`/api/opportunities?contactId=${contactId}`);
      const rows = normalizeList(response.data);
      setOpportunities(rows);
      setSelectedOpportunityId((current) => {
        if (rows.some((opportunity) => String(opportunity.id) === String(current))) {
          return current;
        }
        return rows[0]?.id ? String(rows[0].id) : "";
      });
    } catch {
      setOpportunities([]);
      setSelectedOpportunityId("");
    }
  }, []);

  const loadContactTasks = useCallback(async (contactId) => {
    if (!contactId) {
      setContactTasks([]);
      return;
    }

    setLoadingTasks(true);
    try {
      const response = await api.get(`/api/contacts/${contactId}/tasks`);
      setContactTasks(normalizeList(response.data));
    } catch (err) {
      setContactTasks([]);
      setError(err?.response?.data?.message || err.message || "Failed to load tasks");
    } finally {
      setLoadingTasks(false);
    }
  }, []);

  const loadAssignableUsers = useCallback(async () => {
    try {
      const response = await api.get("/api/users");
      const rows = Array.isArray(response.data)
        ? response.data
        : response.data?.data ?? response.data?.users ?? [];
      setAssignableUsers(rows);
    } catch {
      setAssignableUsers([]);
    }
  }, []);

  const loadPublishedFlows = useCallback(async () => {
    try {
      const response = await api.get("/api/whatsapp-flows", { params: { status: "PUBLISHED" } });
      const rows = normalizeList(response.data);
      setPublishedFlows(rows);
      setFlowForm((current) => ({
        ...current,
        flowId: current.flowId || (rows[0]?.id ? String(rows[0].id) : ""),
      }));
    } catch {
      setPublishedFlows([]);
    }
  }, []);

  const loadWhatsAppTemplates = useCallback(async () => {
    try {
      const response = await api.get("/api/templates");
      const rows = normalizeList(response.data).filter((template) =>
        !template.status || ["APPROVED", "PUBLISHED"].includes(String(template.status).toUpperCase())
      );
      setWhatsAppTemplates(rows);
      setTemplateForm((current) => ({
        ...current,
        templateId: current.templateId || (rows[0]?.id ? String(rows[0].id) : ""),
      }));
    } catch {
      setWhatsAppTemplates([]);
    }
  }, []);

  const defaultTemplateParameter = useCallback((index) => {
    const source = contactDetails || selectedConversation || {};
    const values = [
      source.name || source.contactName,
      source.phone,
      source.email,
      source.city,
    ];
    return values[index] || values[0] || values[1] || "";
  }, [contactDetails, selectedConversation]);

  const handleTaskCreated = () => {
    setTaskModal(null);
    setShowTaskModal(false);
    setInfo("Follow-up task created.");
    if (selectedContactId) {
      loadContactTasks(selectedContactId);
    }
  };

  const sendTextMessage = async (event) => {
    event.preventDefault();
    if (!selectedContactId || !draft.trim()) return;

    setLoading(true);
    setError("");
    setInfo("");
    try {
      await api.post("/api/messages/send-whatsapp", {
        contactId: selectedContactId,
        text: draft.trim(),
      });
      setDraft("");
      setInfo("Message sent.");
      await loadMessages(selectedContactId, 0, false);
      await loadInbox();
    } catch (err) {
      setError(err?.response?.data?.message || err.message || "Failed to send message");
    } finally {
      setLoading(false);
    }
  };

  const sendMediaMessage = async (event) => {
    event.preventDefault();
    if (!selectedContactId || !mediaForm.mediaUrl.trim()) return;

    const trimmedMediaUrl = mediaForm.mediaUrl.trim();
    if (!isPublicHttpsUrl(trimmedMediaUrl)) {
      setError("WhatsApp media URL must be a public HTTPS URL. Localhost or private URLs cannot be downloaded by Meta.");
      return;
    }

    setMediaSending(true);
    setError("");
    setInfo("");
    try {
      await api.post("/api/messages/send-whatsapp/media", {
        contactId: selectedContactId,
        mediaType: mediaForm.mediaType,
        mediaUrl: trimmedMediaUrl,
        caption: mediaForm.caption.trim() || null,
        fileName: mediaForm.fileName.trim() || null,
      });
      setMediaForm({
        mediaType: "IMAGE",
        mediaUrl: "",
        caption: "",
        fileName: "",
      });
      setShowMediaForm(false);
      setInfo("Media message sent.");
      await loadMessages(selectedContactId, 0, false);
      await loadInbox();
    } catch (err) {
      setError(err?.response?.data?.message || err.message || "Failed to send media");
    } finally {
      setMediaSending(false);
    }
  };

  const sendTemplateMessage = async (event) => {
    event.preventDefault();
    if (!selectedContactId || !templateForm.templateId) return;

    const params = Array.from({ length: selectedTemplateVariableCount }, (_, index) =>
      templateForm.bodyParameters[index]?.trim() || ""
    );
    if (params.some((value) => !value)) {
      setError("Please fill all WhatsApp template variables before sending.");
      return;
    }
    if (selectedTemplateHeaderFormat && !templateForm.headerMediaUrl.trim()) {
      setError(`Please choose a public HTTPS ${selectedTemplateHeaderFormat.toLowerCase()} from Media Library for the template header.`);
      return;
    }
    if (selectedTemplateHeaderFormat && !isPublicHttpsUrl(templateForm.headerMediaUrl.trim())) {
      setError(`Template header ${selectedTemplateHeaderFormat.toLowerCase()} must use a public HTTPS URL. Upload/select media from CRM Media Library.`);
      return;
    }
    if (selectedTemplateHeaderFormat && isMetaSampleMediaUrl(templateForm.headerMediaUrl.trim())) {
      setError("Meta sample header media cannot be reused for sending. Upload/select a real image from CRM Media Library.");
      return;
    }

    setTemplateSending(true);
    setError("");
    setInfo("");
    try {
      const response = await api.post("/api/messages/send-whatsapp/template", {
        contactId: selectedContactId,
        templateId: Number(templateForm.templateId),
        bodyParameters: params,
        headerMediaUrl: templateForm.headerMediaUrl.trim() || null,
      });
      const result = normalizeMessage(response.data || {});
      if (String(result.status || "").toUpperCase() === "FAILED") {
        setError(result.errorMessage || "Template send failed. Check the message error details.");
      } else {
        setInfo("Template message sent.");
      }
      setShowTemplateForm(false);
      await loadMessages(selectedContactId, 0, false);
      await loadInbox();
    } catch (err) {
      setError(apiErrorMessage(err, "Failed to send WhatsApp template."));
    } finally {
      setTemplateSending(false);
    }
  };

  const sendFlowMessage = async (event) => {
    event.preventDefault();
    if (!selectedContactId || !flowForm.flowId) return;

    setFlowSending(true);
    setError("");
    setInfo("");
    try {
      await api.post("/api/messages/send-whatsapp/flow", {
        contactId: selectedContactId,
        flowId: Number(flowForm.flowId),
        body: flowForm.body.trim() || null,
        ctaText: flowForm.ctaText.trim() || null,
      });
      setFlowForm((current) => ({
        ...current,
        body: "",
        ctaText: current.ctaText || "Open form",
      }));
      setShowFlowForm(false);
      setInfo("WhatsApp Flow sent.");
      await loadMessages(selectedContactId, 0, false);
      await loadInbox();
    } catch (err) {
      setError(err?.response?.data?.message || err.message || "Failed to send WhatsApp Flow");
    } finally {
      setFlowSending(false);
    }
  };

  const applyMediaAsset = (asset) => {
    setMediaForm((current) => ({
      ...current,
      mediaType: asset.mediaType || current.mediaType || "IMAGE",
      mediaUrl: asset.publicUrl || "",
      fileName: asset.mediaType === "DOCUMENT" ? (asset.originalFileName || asset.name || current.fileName) : current.fileName,
      caption: current.caption,
    }));
  };

  const applyTemplateHeaderMediaAsset = (asset) => {
    const assetType = String(asset.mediaType || "").toUpperCase();
    if (selectedTemplateHeaderFormat && assetType && assetType !== selectedTemplateHeaderFormat) {
      setError(`This template requires ${selectedTemplateHeaderFormat.toLowerCase()} header media. Selected asset is ${assetType.toLowerCase()}.`);
      return;
    }
    setTemplateForm((current) => ({
      ...current,
      headerMediaUrl: asset.publicUrl || "",
    }));
    setTemplateHeaderMediaDialogOpen(false);
    setError("");
  };

  const toggleConversationStatus = async () => {
    if (!selectedConversation) return;

    setError("");
    setInfo("");
    const nextAction = selectedConversation.conversationStatus === "CLOSED" ? "reopen" : "close";
    try {
      await api.post(`/api/inbox/${selectedConversation.contactId}/${nextAction}`);
      await loadInbox();
      setInfo(nextAction === "close" ? "Conversation closed." : "Conversation reopened.");
    } catch (err) {
      setError(err?.response?.data?.message || err.message || "Failed to update conversation");
    }
  };

  const markConversationUnread = async () => {
    if (!selectedConversation) return;

    setMarkingUnread(true);
    setError("");
    setInfo("");
    try {
      await api.post(`/api/inbox/${selectedConversation.contactId}/unread`);
      setConversations((current) =>
        current.map((conversation) =>
          sameId(conversation.contactId, selectedConversation.contactId)
            ? {
                ...conversation,
                unreadCount: Math.max(1, conversation.unreadCount || 0),
                lastMessageStatus: "UNREAD",
              }
            : conversation
        )
      );
      setInfo("Conversation marked unread.");
    } catch (err) {
      setError(err?.response?.data?.message || err.message || "Failed to mark unread");
    } finally {
      setMarkingUnread(false);
    }
  };

  const assignConversation = async () => {
    if (!selectedConversation || !assignmentValue) return;

    setAssigning(true);
    setError("");
    setInfo("");
    try {
      await api.post(`/api/inbox/${selectedConversation.contactId}/assign`, {
        assignedUserId: Number(assignmentValue),
      });
      const selectedUser = assignableUsers.find((user) => String(user.id) === assignmentValue);
      setConversations((current) =>
        current.map((conversation) =>
          sameId(conversation.contactId, selectedConversation.contactId)
            ? {
                ...conversation,
                assignedUserId: Number(assignmentValue),
                assignedUserEmail: selectedUser?.email || conversation.assignedUserEmail,
              }
            : conversation
        )
      );
      setInfo("Conversation assigned.");
    } catch (err) {
      setError(err?.response?.data?.message || err.message || "Failed to assign conversation");
    } finally {
      setAssigning(false);
    }
  };

  const updateOpportunityStage = async () => {
    if (!selectedOpportunityId || !opportunityStageValue) return;

    setUpdatingStage(true);
    setError("");
    setInfo("");
    try {
      const response = await api.post(`/api/opportunities/${selectedOpportunityId}/stage`, {
        stage: opportunityStageValue,
      });
      setOpportunities((current) =>
        current.map((opportunity) =>
          opportunity.id === response.data.id ? response.data : opportunity
        )
      );
      setInfo("Opportunity stage updated.");
    } catch (err) {
      setError(err?.response?.data?.message || err.message || "Failed to update stage");
    } finally {
      setUpdatingStage(false);
    }
  };

  const updateTaskStatus = async (taskId, status) => {
    if (!selectedContactId || !taskId) return;

    setUpdatingTaskId(taskId);
    setError("");
    setInfo("");
    try {
      const response = await api.post(`/api/contacts/${selectedContactId}/tasks/${taskId}/status`, { status });
      setContactTasks((current) =>
        current.map((task) => (task.id === response.data.id ? response.data : task))
      );
      setInfo("Task status updated.");
    } catch (err) {
      setError(err?.response?.data?.message || err.message || "Failed to update task");
    } finally {
      setUpdatingTaskId(null);
    }
  };

  const createOpportunityFromChat = async () => {
    if (!selectedContactId || !createPipelineId || !opportunityForm.title.trim()) return;

    setSavingOpportunity(true);
    setError("");
    setInfo("");
    try {
      const response = await api.post("/api/opportunities", {
        contactId: selectedContactId,
        pipelineId: Number(createPipelineId),
        title: opportunityForm.title.trim(),
        industryKey: createPipelineIndustryKey,
        domainItemId: opportunityForm.domainItemId ? Number(opportunityForm.domainItemId) : null,
        stage: null,
        amount: opportunityForm.amount === "" ? null : Number(opportunityForm.amount),
        source: "WhatsApp Chat",
        notes: null,
      });
      setOpportunities((current) => [response.data, ...current]);
      setSelectedOpportunityId(String(response.data.id));
      setOpportunityForm({ title: "", domainItemId: "", amount: "" });
      setInfo("Opportunity created from chat.");
    } catch (err) {
      setError(err?.response?.data?.message || err.message || "Failed to create opportunity");
    } finally {
      setSavingOpportunity(false);
    }
  };

  useEffect(() => {
    if (!token) return;
    loadInbox().catch((err) => {
      setError(err?.response?.data?.message || err.message || "Failed to load inbox");
    });
  }, [token, loadInbox]);

  useEffect(() => {
    if (!token) return;
    loadAssignableUsers();
    loadPublishedFlows();
    loadWhatsAppTemplates();
    loadCrmSetup();
  }, [token, loadAssignableUsers, loadPublishedFlows, loadWhatsAppTemplates, loadCrmSetup]);

  useEffect(() => {
    if (!selectedTemplate) return;
    const count = templateVariableCount(selectedTemplate);
    setTemplateForm((current) => {
      const next = Array.from({ length: count }, (_, index) =>
        current.bodyParameters[index] || defaultTemplateParameter(index)
      );
      return {
        ...current,
        bodyParameters: next,
        headerMediaUrl: current.headerMediaUrl && !isMetaSampleMediaUrl(current.headerMediaUrl)
          ? current.headerMediaUrl
          : "",
      };
    });
  }, [selectedTemplate, defaultTemplateParameter]);

  useEffect(() => {
    if (!selectedContactId) return;
    setMessages([]);
    setMessagePage(0);
    setHasOlderMessages(false);
    loadMessages(selectedContactId, 0, false);
    loadContactDetails(selectedContactId);
    loadOpportunities(selectedContactId);
    loadContactTasks(selectedContactId);
  }, [selectedContactId, loadMessages, loadContactDetails, loadOpportunities, loadContactTasks]);

  useEffect(() => {
    setAssignmentValue(
      selectedConversation?.assignedUserId ? String(selectedConversation.assignedUserId) : ""
    );
  }, [selectedConversation?.assignedUserId]);

  useEffect(() => {
    setOpportunityStageValue(selectedOpportunity?.stage || pipelineStages[0]?.key || "NEW");
    if (selectedOpportunity?.pipelineId) {
      setSelectedPipelineId(String(selectedOpportunity.pipelineId));
    }
  }, [pipelineStages, selectedOpportunity]);

  useEffect(() => {
    if (!tenantId) return;

    if (stompRef.current) {
      stompRef.current.deactivate();
      stompRef.current = null;
    }

    const client = new Client({
      webSocketFactory: () => new SockJS(`${WS_BASE_URL}/ws`),
      reconnectDelay: 5000,
    });

    client.onConnect = () => {
      client.subscribe(`/topic/chat/${tenantId}`, (frame) => {
        const payload = normalizeMessage(JSON.parse(frame.body));
        const activeId = selectedContactIdRef.current;
        const isActive = sameId(payload.contactId, activeId);

        if (isActive) {
          setMessages((current) => {
            const index = current.findIndex((item) => sameId(item.id, payload.id));
            if (index >= 0) {
              const next = [...current];
              next[index] = payload;
              return sortMessagesAsc(next);
            }
            return sortMessagesAsc([...current, payload]);
          });
        }

        const refreshConversation = async () => {
          try {
            const response = isActive && payload.direction === "INBOUND"
              ? await api.post(`/api/inbox/${payload.contactId}/read`)
              : await api.get(`/api/inbox/${payload.contactId}`);
            const conversation = response.data?.conversation || response.data;
            if (conversation?.contactId) {
              mergeConversationUpdate(conversation);
            } else {
              loadInbox().catch(() => undefined);
            }
          } catch {
            loadInbox().catch(() => undefined);
          }
        };

        refreshConversation();
      });
    };

    client.onStompError = (frame) => {
      setError(frame.headers.message || "WebSocket error");
    };

    client.activate();
    stompRef.current = client;

    return () => {
      client.deactivate();
      stompRef.current = null;
    };
  }, [tenantId, mergeConversationUpdate, loadInbox]);

  if (!token) return null;

  const crmTabs = [
    { key: "contact", label: "Contact", icon: UserRound },
    { key: "opportunities", label: "Deals", icon: Briefcase },
    { key: "tasks", label: "Tasks", icon: ListChecks },
    { key: "activity", label: "Activity", icon: Clock3 },
  ];

  return (
    <div className="min-h-[calc(100vh-3.5rem)] bg-gray-50 p-3 sm:p-4 lg:h-screen lg:overflow-hidden lg:p-6">
      <div className={`mx-auto grid min-h-0 max-w-[1600px] gap-3 lg:h-full lg:gap-4 ${showCrmPanel ? "xl:grid-cols-[320px_minmax(0,1fr)_380px]" : "xl:grid-cols-[320px_minmax(0,1fr)]"}`}>
        <aside className={`${selectedContactId ? "hidden xl:flex" : "flex"} min-h-[calc(100vh-5.5rem)] flex-col overflow-hidden rounded-2xl border border-gray-100 bg-white p-3 shadow-sm sm:p-4 lg:min-h-0`}>
          <div className="mb-4 flex shrink-0 items-center justify-between">
            <button
              onClick={() => navigate(-1)}
              className="inline-flex items-center gap-2 rounded-lg bg-teal-700 px-3 py-2 text-sm font-medium text-white hover:bg-teal-800"
            >
              <ArrowLeft size={18} />
              Back
            </button>
            <span className="rounded-full bg-red-500 px-3 py-1 text-xs font-semibold text-white">
              {totalUnread} unread
            </span>
          </div>

          <div className="mb-4 shrink-0">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-teal-700">Inbox</p>
            <h1 className="mt-2 text-2xl font-bold text-gray-900">WhatsApp Chat</h1>
            <p className="mt-1 text-xs font-medium text-gray-500">
              Showing {conversations.length} of {inboxPageInfo.totalElements} conversations
            </p>
          </div>

          <div className="mb-3 grid shrink-0 gap-2">
            <label className="flex items-center gap-2 rounded-xl border border-gray-200 px-3 py-2 text-xs font-medium text-gray-700">
              <input
                type="checkbox"
                checked={inboxFilters.assignedToMe}
                onChange={(e) => setInboxFilters((current) => ({ ...current, assignedToMe: e.target.checked }))}
              />
              Assigned to me
            </label>
            <label className="flex items-center gap-2 rounded-xl border border-gray-200 px-3 py-2 text-xs font-medium text-gray-700">
              <input
                type="checkbox"
                checked={inboxFilters.unreadOnly}
                onChange={(e) => setInboxFilters((current) => ({ ...current, unreadOnly: e.target.checked }))}
              />
              Unread only
            </label>
            <select
              value={inboxFilters.status}
              onChange={(e) => setInboxFilters((current) => ({ ...current, status: e.target.value }))}
              className="rounded-xl border border-gray-300 px-3 py-2 text-xs font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-teal-500"
            >
              <option value="ALL">All statuses</option>
              <option value="OPEN">Open</option>
              <option value="CLOSED">Closed</option>
            </select>
          </div>

          <div className="mb-3 shrink-0">
            <DateRangeFilter
              value={dateRange}
              preset={datePreset}
              onChange={(nextRange) => {
                setDateRange(nextRange);
                setInboxPageInfo((current) => ({ ...current, page: 0, hasNext: false }));
              }}
              onPresetChange={setDatePreset}
              compact
            />
          </div>

          <label className="mb-4 flex shrink-0 items-center gap-2 rounded-xl border border-gray-300 bg-white px-3 py-2.5 focus-within:ring-2 focus-within:ring-teal-500">
            <Search size={16} className="text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search conversations..."
              className="w-full bg-transparent text-sm outline-none"
            />
          </label>

          <div
            className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-1"
            onScroll={(event) => {
              const target = event.currentTarget;
              const nearBottom = target.scrollHeight - target.scrollTop - target.clientHeight < 180;
              if (nearBottom && inboxPageInfo.hasNext && !loading) {
                loadMoreConversations();
              }
            }}
          >
            {filteredConversations.map((conversation) => {
              const active = sameId(conversation.contactId, selectedContactId);
              return (
                <button
                  key={conversation.contactId}
                  type="button"
                  onClick={() => {
                    setSelectedContactId(conversation.contactId);
                    setMobileCrmOpen(false);
                  }}
                  className={`w-full rounded-xl border px-4 py-3 text-left transition-colors ${
                    active
                      ? "border-teal-700 bg-teal-50"
                      : "border-gray-200 bg-white hover:border-teal-300 hover:bg-gray-50"
                  }`}
                >
                  <div className="mb-1 flex items-start justify-between gap-3">
                    <div>
                      <div className="font-semibold text-gray-900">{conversation.contactName || "Unnamed"}</div>
                      <div className="text-xs text-gray-500">{conversation.phone || "—"}</div>
                    </div>
                    <div className="text-right">
                      {conversation.lastMessageAt && (
                        <div className="text-[11px] text-gray-500">{timeAgo(conversation.lastMessageAt)}</div>
                      )}
                      {conversation.unreadCount > 0 && (
                        <span className="mt-1 inline-flex min-w-6 justify-center rounded-full bg-red-500 px-2 py-0.5 text-[11px] font-semibold text-white">
                          {conversation.unreadCount > 99 ? "99+" : conversation.unreadCount}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="truncate text-xs text-gray-600">{conversation.lastMessageText || "No messages yet"}</div>
                </button>
              );
            })}

            {filteredConversations.length === 0 && (
              <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 px-4 py-8 text-center text-sm text-gray-500">
                No conversations found.
              </div>
            )}

            {filteredConversations.length > 0 && inboxPageInfo.hasNext && (
              <button
                type="button"
                onClick={loadMoreConversations}
                disabled={loading}
                className="w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? "Loading..." : "Load more conversations"}
              </button>
            )}
          </div>
        </aside>

        <main className={`${selectedContactId && !mobileCrmOpen ? "flex" : "hidden xl:flex"} min-h-[calc(100vh-5.5rem)] min-w-0 flex-col overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm lg:min-h-0`}>
          <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-gray-100 px-3 py-3 sm:px-5 sm:py-4">
            <div className="flex min-w-0 items-start gap-3">
              {selectedConversation && (
                <button
                  type="button"
                  onClick={() => {
                    setSelectedContactId(null);
                    setMobileCrmOpen(false);
                  }}
                  className="mt-1 inline-flex rounded-lg border border-gray-200 p-2 text-gray-600 hover:bg-gray-50 xl:hidden"
                  aria-label="Back to conversations"
                >
                  <ArrowLeft size={18} />
                </button>
              )}
              <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-teal-700">Active Chat</p>
              <h2 className="mt-1 truncate text-lg font-bold text-gray-900 sm:text-xl">
                {selectedConversation?.contactName || "Select a conversation"}
              </h2>
              <p className="mt-1 truncate text-sm text-gray-500">
                {selectedConversation?.phone || "No conversation selected"}
              </p>
              </div>
            </div>
            {selectedConversation && (
              <div className="flex flex-wrap items-center gap-2">
                <span className={`rounded-full px-3 py-1 text-xs font-semibold ${
                  selectedConversation.conversationStatus === "CLOSED"
                    ? "bg-gray-100 text-gray-700"
                    : "bg-emerald-50 text-emerald-700"
                }`}>
                  {selectedConversation.conversationStatus || "OPEN"}
                </span>
                <button
                  onClick={toggleConversationStatus}
                  className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  {selectedConversation.conversationStatus === "CLOSED" ? "Reopen" : "Close"}
                </button>
                <button
                  type="button"
                  onClick={markConversationUnread}
                    disabled={markingUnread}
                    className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {markingUnread ? "Marking..." : "Mark unread"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setActiveCrmTab("tasks");
                    setShowTaskModal(true);
                  }}
                  className="rounded-lg border border-teal-200 bg-teal-50 px-3 py-2 text-sm font-medium text-teal-700 hover:bg-teal-100"
                >
                  Add task
                </button>
                <button
                  type="button"
                  onClick={() => setShowCrmPanel((current) => !current)}
                  className="hidden items-center gap-2 rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 xl:inline-flex"
                >
                  {showCrmPanel ? <PanelRightClose size={16} /> : <PanelRightOpen size={16} />}
                  CRM
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowCrmPanel(true);
                    setMobileCrmOpen(true);
                  }}
                  className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 xl:hidden"
                >
                  <PanelRightOpen size={16} />
                  CRM
                </button>
              </div>
            )}
          </div>

          <div className="shrink-0 border-b border-gray-100 px-3 py-3 sm:px-5">
            <label className="flex items-center gap-2 rounded-xl border border-gray-300 bg-white px-3 py-2.5 focus-within:ring-2 focus-within:ring-teal-500">
              <Search size={16} className="text-gray-400" />
              <input
                type="text"
                value={messageSearch}
                onChange={(e) => setMessageSearch(e.target.value)}
                placeholder="Search inside this conversation..."
                className="w-full bg-transparent text-sm outline-none"
              />
            </label>
          </div>

          <div
            className="min-h-0 flex-1 overflow-y-auto bg-gray-50 px-3 py-4 sm:px-5 sm:py-5"
            onScroll={(event) => {
              if (event.currentTarget.scrollTop < 96 && hasOlderMessages && !loadingOlder) {
                loadOlderMessages();
              }
            }}
          >
            {loadingConversation ? (
              <div className="rounded-xl border border-gray-200 bg-white px-4 py-8 text-center text-sm text-gray-500">
                Loading messages…
              </div>
            ) : visibleMessages.length === 0 ? (
              <div className="rounded-xl border border-dashed border-gray-200 bg-white px-4 py-8 text-center text-sm text-gray-500">
                No messages yet. Send a WhatsApp message or wait for an inbound reply.
              </div>
            ) : (
              <div className="space-y-4">
                {hasOlderMessages && (
                  <div className="flex justify-center">
                    <button
                      type="button"
                      onClick={loadOlderMessages}
                      disabled={loadingOlder}
                      className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {loadingOlder ? "Loading older messages..." : "Load older messages"}
                    </button>
                  </div>
                )}
                {visibleMessages.map((message, index) => (
                  <MessageBubble
                    key={message.id || `${message.createdAt}-${index}`}
                    message={message}
                  />
                ))}
                <div ref={messagesEndRef} />
              </div>
            )}
          </div>

          <div className="max-h-[52vh] shrink-0 overflow-y-auto border-t border-gray-100 bg-white px-3 py-3 sm:max-h-[45vh] sm:px-5 sm:py-4">
            <AiAssistPanel
              contactId={selectedContactId}
              title="AI Chat Assistant"
              contextPrompt={`Summarize this WhatsApp conversation and suggest the next best CRM action.
Contact: ${contactDetails?.name || selectedConversation?.contactName || selectedConversation?.phone || "Selected lead"}
Phone: ${contactDetails?.phone || selectedConversation?.phone || ""}
Stage: ${contactDetails?.stage || ""}
Recent messages:
${aiMessageContext || "No recent messages loaded."}`}
              replyPrompt={`Write a short WhatsApp reply for this CRM conversation. Keep it human, helpful, and ask one clear next step question.
Contact: ${contactDetails?.name || selectedConversation?.contactName || selectedConversation?.phone || "Lead"}
Recent messages:
${aiMessageContext || "No recent messages loaded."}`}
              onApply={(text) => setDraft((current) => [current, text].filter(Boolean).join(current ? "\n" : ""))}
              applyLabel="Use in message"
              compact
            />

            <form onSubmit={sendTextMessage} className="space-y-3">
              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="Type an individual WhatsApp message..."
                rows={3}
                className="w-full rounded-2xl border border-gray-300 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
              />

              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowMediaForm((current) => !current)}
                    className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                  >
                    {showMediaForm ? <X size={16} /> : <ImageIcon size={16} />}
                    {showMediaForm ? "Hide media" : "Send media"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowTemplateForm((current) => !current)}
                    className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                  >
                    {showTemplateForm ? <X size={16} /> : <FileText size={16} />}
                    {showTemplateForm ? "Hide template" : "Send template"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowFlowForm((current) => !current)}
                    className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                  >
                    {showFlowForm ? <X size={16} /> : <FormInput size={16} />}
                    {showFlowForm ? "Hide flow" : "Send flow"}
                  </button>
                  {(error || info) && (
                    <span className={`text-sm ${error ? "text-red-600" : "text-emerald-700"}`}>
                      {error || info}
                    </span>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={!selectedContactId || loading || !draft.trim()}
                  className="inline-flex items-center gap-2 rounded-lg bg-teal-700 px-5 py-2.5 text-sm font-medium text-white hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <Send size={16} />
                  {loading ? "Sending..." : "Send text"}
                </button>
              </div>
            </form>

            {showMediaForm && (
              <form onSubmit={sendMediaMessage} className="mt-5 rounded-2xl border border-gray-200 bg-gray-50 p-4">
                <div className="mb-4 flex flex-wrap items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2">
                  <button
                    type="button"
                    onClick={() => setMediaDialogOpen(true)}
                    className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-100"
                  >
                    <ImageIcon size={16} />
                    Choose media
                  </button>
                  <span className="text-xs font-medium text-gray-500">Select from library or upload. WhatsApp requires a public HTTPS URL.</span>
                </div>
                <MediaLibraryDialog
                  open={mediaDialogOpen}
                  title="Choose WhatsApp media"
                  helper="Upload or select media for this WhatsApp message."
                  allowedTypes={["IMAGE", "DOCUMENT", "AUDIO", "VIDEO"]}
                  onSelect={applyMediaAsset}
                  onClose={() => setMediaDialogOpen(false)}
                />
                <div className="mb-4 grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">Media type</label>
                    <select
                      value={mediaForm.mediaType}
                      onChange={(e) => setMediaForm((current) => ({ ...current, mediaType: e.target.value }))}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                    >
                      <option value="IMAGE">IMAGE</option>
                      <option value="DOCUMENT">DOCUMENT</option>
                      <option value="AUDIO">AUDIO</option>
                      <option value="VIDEO">VIDEO</option>
                    </select>
                  </div>

                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">Media URL</label>
                    <input
                      value={mediaForm.mediaUrl}
                      onChange={(e) => setMediaForm((current) => ({ ...current, mediaUrl: e.target.value }))}
                      placeholder="https://example.com/file.jpg"
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                    />
                    {mediaForm.mediaUrl.trim() && !isPublicHttpsUrl(mediaForm.mediaUrl.trim()) && (
                      <p className="mt-1 text-xs font-semibold text-amber-700">
                        Use a public HTTPS media URL. Meta cannot fetch localhost or private links.
                      </p>
                    )}
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">Caption</label>
                    <input
                      value={mediaForm.caption}
                      onChange={(e) => setMediaForm((current) => ({ ...current, caption: e.target.value }))}
                      placeholder="Optional caption"
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">File name</label>
                    <input
                      value={mediaForm.fileName}
                      onChange={(e) => setMediaForm((current) => ({ ...current, fileName: e.target.value }))}
                      placeholder="pricing-sheet.pdf"
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                    />
                  </div>
                </div>

                <div className="mt-4 flex justify-end">
                  <button
                    type="submit"
                    disabled={!selectedContactId || mediaSending || !mediaForm.mediaUrl.trim()}
                    className="rounded-lg bg-teal-700 px-5 py-2.5 text-sm font-medium text-white hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {mediaSending ? "Sending..." : "Send media"}
                  </button>
                </div>
              </form>
            )}

            {showTemplateForm && (
              <form onSubmit={sendTemplateMessage} className="mt-5 rounded-2xl border border-gray-200 bg-gray-50 p-4">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-semibold text-gray-900">WhatsApp Template</h3>
                    <p className="text-xs text-gray-500">Fill the values for Meta variables like {"{{1}}"}, {"{{2}}"} before sending.</p>
                  </div>
                  <button
                    type="button"
                    onClick={loadWhatsAppTemplates}
                    className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-100"
                  >
                    Refresh templates
                  </button>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">Template</label>
                    <select
                      value={templateForm.templateId}
                      onChange={(e) => setTemplateForm({ templateId: e.target.value, bodyParameters: [], headerMediaUrl: "" })}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                    >
                      <option value="">Select template</option>
                      {whatsAppTemplates.map((template) => (
                        <option key={template.id} value={template.id}>
                          {template.metaTemplateName} ({template.languageCode || "language"})
                        </option>
                      ))}
                    </select>
                    {whatsAppTemplates.length === 0 && (
                      <p className="mt-1 text-xs font-semibold text-amber-700">
                        No approved templates found. Sync templates from WhatsApp Manager first.
                      </p>
                    )}
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">Variables</label>
                    <div className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700">
                      {selectedTemplateVariableCount || 0} body variable{selectedTemplateVariableCount === 1 ? "" : "s"}
                    </div>
                  </div>
                </div>

                {selectedTemplateHeaderFormat && (
                  <div className="mt-4">
                    <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                      <label className="block text-sm font-medium text-gray-700">
                        Header {selectedTemplateHeaderFormat.toLowerCase()} URL
                      </label>
                      <button
                        type="button"
                        onClick={() => setTemplateHeaderMediaDialogOpen(true)}
                        className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-100"
                      >
                        <ImageIcon size={14} />
                        Choose header media
                      </button>
                    </div>
                    <MediaLibraryDialog
                      open={templateHeaderMediaDialogOpen}
                      title={`Choose ${selectedTemplateHeaderFormat.toLowerCase()} header media`}
                      helper="Select or upload a real public media asset. Meta's template example media cannot be reused for sending."
                      allowedTypes={[selectedTemplateHeaderFormat]}
                      onSelect={applyTemplateHeaderMediaAsset}
                      onClose={() => setTemplateHeaderMediaDialogOpen(false)}
                    />
                    <input
                      value={templateForm.headerMediaUrl}
                      onChange={(e) => setTemplateForm((current) => ({ ...current, headerMediaUrl: e.target.value }))}
                      placeholder={`https://example.com/header.${selectedTemplateHeaderFormat === "IMAGE" ? "jpg" : selectedTemplateHeaderFormat === "VIDEO" ? "mp4" : "pdf"}`}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                    />
                    {templateForm.headerMediaUrl.trim() && !isPublicHttpsUrl(templateForm.headerMediaUrl.trim()) && (
                      <p className="mt-1 text-xs font-semibold text-amber-700">
                        Header media must be a public HTTPS URL. Meta cannot fetch localhost or private links.
                      </p>
                    )}
                    {templateForm.headerMediaUrl.trim() && isMetaSampleMediaUrl(templateForm.headerMediaUrl.trim()) && (
                      <p className="mt-1 text-xs font-semibold text-red-700">
                        This is Meta's sample template media. Upload/select the actual image you want to send.
                      </p>
                    )}
                    <p className="mt-1 text-xs font-medium text-gray-500">
                      This template requires a real public HTTPS {selectedTemplateHeaderFormat.toLowerCase()} header for every send.
                    </p>
                  </div>
                )}

                {selectedTemplateVariableCount > 0 && (
                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    {Array.from({ length: selectedTemplateVariableCount }, (_, index) => (
                      <div key={index}>
                        <label className="mb-1 block text-sm font-medium text-gray-700">{"{{"}{index + 1}{"}}"}</label>
                        <input
                          value={templateForm.bodyParameters[index] || ""}
                          onChange={(e) =>
                            setTemplateForm((current) => {
                              const next = [...current.bodyParameters];
                              next[index] = e.target.value;
                              return { ...current, bodyParameters: next };
                            })
                          }
                          placeholder={defaultTemplateParameter(index) || `Value for {{${index + 1}}}`}
                          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                        />
                      </div>
                    ))}
                  </div>
                )}

                {selectedTemplate && (
                  <div className="mt-4 rounded-xl border border-gray-200 bg-white p-3">
                    <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">Preview</div>
                    <p className="whitespace-pre-wrap text-sm text-gray-800">{selectedTemplatePreview}</p>
                  </div>
                )}

                <div className="mt-4 flex justify-end">
                  <button
                    type="submit"
                    disabled={!selectedContactId || templateSending || !templateForm.templateId}
                    className="inline-flex items-center gap-2 rounded-lg bg-teal-700 px-5 py-2.5 text-sm font-medium text-white hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <FileText size={16} />
                    {templateSending ? "Sending..." : "Send template"}
                  </button>
                </div>
              </form>
            )}

            {showFlowForm && (
              <form onSubmit={sendFlowMessage} className="mt-5 rounded-2xl border border-gray-200 bg-gray-50 p-4">
                <div className="mb-4 flex flex-wrap items-start justify-between gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3">
                  <div>
                    <p className="text-sm font-semibold text-gray-900">Send WhatsApp Flow</p>
                    <p className="mt-1 text-xs text-gray-500">
                      Customer receives a native WhatsApp button. Submitted answers will map back to Contact and Opportunity.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={loadPublishedFlows}
                    className="rounded-lg border border-gray-300 px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50"
                  >
                    Refresh flows
                  </button>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">Published flow</label>
                    <select
                      value={flowForm.flowId}
                      onChange={(e) => setFlowForm((current) => ({ ...current, flowId: e.target.value }))}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                    >
                      <option value="">Select flow</option>
                      {publishedFlows.map((flow) => (
                        <option key={flow.id} value={flow.id}>
                          {flow.name}
                        </option>
                      ))}
                    </select>
                    {publishedFlows.length === 0 && (
                      <p className="mt-1 text-xs font-semibold text-amber-700">
                        No published flows found. Create and publish one from WhatsApp Flows first.
                      </p>
                    )}
                    {selectedFlowNeedsMeta && (
                      <p className="mt-1 text-xs font-semibold text-amber-700">
                        This flow is only published inside CRM. Connect it to a real Meta Flow ID before sending to WhatsApp.
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">Button text</label>
                    <input
                      value={flowForm.ctaText}
                      onChange={(e) => setFlowForm((current) => ({ ...current, ctaText: e.target.value }))}
                      placeholder="Open form"
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                    />
                  </div>
                </div>

                <div className="mt-4">
                  <label className="mb-1 block text-sm font-medium text-gray-700">Message body</label>
                  <textarea
                    value={flowForm.body}
                    onChange={(e) => setFlowForm((current) => ({ ...current, body: e.target.value }))}
                    rows={3}
                    placeholder={selectedFlow ? `Please complete this quick form: ${selectedFlow.name}` : "Please complete this quick form."}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
                </div>

                <div className="mt-4 flex justify-end">
                  <button
                    type="submit"
                    disabled={!selectedContactId || flowSending || !flowForm.flowId || selectedFlowNeedsMeta}
                    className="inline-flex items-center gap-2 rounded-lg bg-teal-700 px-5 py-2.5 text-sm font-medium text-white hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <FormInput size={16} />
                    {flowSending ? "Sending..." : "Send flow"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </main>

        {showCrmPanel && (
          <aside className={`${mobileCrmOpen ? "flex" : "hidden xl:flex"} min-h-[calc(100vh-5.5rem)] flex-col overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm lg:min-h-0`}>
            <div className="shrink-0 border-b border-gray-100 p-4">
              <div className="flex items-start justify-between gap-3">
                <button
                  type="button"
                  onClick={() => setMobileCrmOpen(false)}
                  className="mt-1 rounded-lg border border-gray-200 p-2 text-gray-500 hover:bg-gray-50 xl:hidden"
                  title="Back to chat"
                >
                  <ArrowLeft size={18} />
                </button>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-teal-700">CRM Panel</p>
                  <h2 className="mt-1 text-lg font-bold text-gray-900">
                    {selectedConversation?.contactName || "No contact selected"}
                  </h2>
                  <p className="mt-1 text-sm text-gray-500">{selectedConversation?.phone || "Select a chat first"}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowCrmPanel(false)}
                  className="hidden rounded-lg border border-gray-200 p-2 text-gray-500 hover:bg-gray-50 xl:inline-flex"
                  title="Hide CRM panel"
                >
                  <PanelRightClose size={18} />
                </button>
              </div>

              {selectedConversation && (
                <div className="mt-3 flex flex-wrap gap-2">
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                    {contactDetails?.stage || "No stage"}
                  </span>
                  <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-700">
                    {selectedConversation.assignedUserEmail || "Unassigned"}
                  </span>
                  {selectedTags.map((tag) => (
                    <span key={tag} className="rounded-full bg-teal-50 px-3 py-1 text-xs font-semibold text-teal-700">
                      {tag}
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div className="grid shrink-0 grid-cols-4 border-b border-gray-100">
              {crmTabs.map((tabItem) => {
                const Icon = tabItem.icon;
                const active = activeCrmTab === tabItem.key;
                return (
                  <button
                    key={tabItem.key}
                    type="button"
                    onClick={() => setActiveCrmTab(tabItem.key)}
                    className={`flex flex-col items-center gap-1 px-2 py-3 text-xs font-semibold ${
                      active ? "bg-teal-50 text-teal-700" : "text-gray-500 hover:bg-gray-50"
                    }`}
                  >
                    <Icon size={16} />
                    {tabItem.label}
                  </button>
                );
              })}
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto p-4">
              {!selectedConversation ? (
                <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 px-4 py-8 text-center text-sm text-gray-500">
                  Select a conversation to see CRM details.
                </div>
              ) : activeCrmTab === "contact" ? (
                <div className="space-y-4">
                  <section className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
                    <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-gray-500">Assignment</p>
                    {assignableUsers.length > 0 ? (
                      <div className="space-y-2">
                        <select
                          value={assignmentValue}
                          onChange={(e) => setAssignmentValue(e.target.value)}
                          className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                        >
                          <option value="">Select a user</option>
                          {assignableUsers.map((user) => (
                            <option key={user.id} value={user.id}>
                              {user.email} ({user.role})
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          onClick={assignConversation}
                          disabled={!assignmentValue || assigning}
                          className="w-full rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-black disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {assigning ? "Saving..." : "Assign conversation"}
                        </button>
                      </div>
                    ) : (
                      <p className="text-sm text-gray-500">Assignment controls appear here when tenant users are available.</p>
                    )}
                  </section>

                  <section className="rounded-2xl border border-gray-200 bg-white p-4">
                    <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-gray-500">Contact Snapshot</p>
                    <dl className="space-y-3 text-sm">
                      <div className="flex justify-between gap-3">
                        <dt className="text-gray-500">Name</dt>
                        <dd className="font-medium text-gray-900">{contactDetails?.name || selectedConversation.contactName || "Unnamed"}</dd>
                      </div>
                      <div className="flex justify-between gap-3">
                        <dt className="text-gray-500">Phone</dt>
                        <dd className="font-medium text-gray-900">{contactDetails?.phone || selectedConversation.phone || "—"}</dd>
                      </div>
                      <div className="flex justify-between gap-3">
                        <dt className="text-gray-500">Stage</dt>
                        <dd className="font-medium text-gray-900">{contactDetails?.stage || "—"}</dd>
                      </div>
                      <div className="flex justify-between gap-3">
                        <dt className="text-gray-500">Conversation</dt>
                        <dd className="font-medium text-gray-900">{selectedConversation.conversationStatus || "OPEN"}</dd>
                      </div>
                    </dl>
                  </section>
                </div>
              ) : activeCrmTab === "opportunities" ? (
                <div className="space-y-4">
                  <section className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
                    <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-gray-500">Move Opportunity</p>
                    <div className="space-y-2">
                      <select
                        value={selectedOpportunityId}
                        onChange={(e) => setSelectedOpportunityId(e.target.value)}
                        className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                      >
                        <option value="">Select opportunity</option>
                        {opportunities.map((opportunity) => (
                          <option key={opportunity.id} value={opportunity.id}>
                            {opportunity.title}
                            {opportunity.domainItemName ? ` - ${opportunity.domainItemName}` : ""}
                          </option>
                        ))}
                      </select>
                      <div className="grid grid-cols-[1fr_auto] gap-2">
                        <select
                          value={opportunityStageValue}
                          onChange={(e) => setOpportunityStageValue(e.target.value)}
                          className="rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                        >
                          {pipelineStages.map((stage) => (
                            <option key={stage.key} value={stage.key}>
                              {stage.label}
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          onClick={updateOpportunityStage}
                          disabled={!selectedOpportunityId || !opportunityStageValue || updatingStage}
                          className="rounded-lg bg-teal-700 px-4 py-2 text-sm font-medium text-white hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {updatingStage ? "Moving..." : "Move"}
                        </button>
                      </div>
                      {selectedOpportunity && (
                        <div className="rounded-xl border border-gray-200 bg-white p-3 text-sm text-gray-600">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="truncate font-semibold text-gray-900">{selectedOpportunity.title}</div>
                              <div className="mt-1 flex flex-wrap gap-2 text-xs">
                                <span className="rounded-full bg-teal-50 px-2 py-0.5 font-semibold text-teal-700">
                                  {selectedOpportunity.stage?.replaceAll("_", " ") || "NEW"}
                                </span>
                                {selectedOpportunity.industryKey && (
                                  <span className="rounded-full bg-slate-100 px-2 py-0.5 font-semibold text-slate-700">
                                    {selectedOpportunity.industryKey.replaceAll("_", " ")}
                                  </span>
                                )}
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => navigate(`/dashboard/opportunities/${selectedOpportunity.id}`)}
                              className="shrink-0 rounded-lg border border-gray-300 px-2.5 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50"
                            >
                              Open
                            </button>
                          </div>
                          <dl className="mt-3 grid grid-cols-2 gap-2 text-xs">
                            <div className="rounded-lg bg-slate-50 px-2 py-2">
                              <dt className="text-gray-500">Value</dt>
                              <dd className="mt-1 font-semibold text-gray-900">{formatAmount(selectedOpportunity.amount) || "—"}</dd>
                            </div>
                            <div className="rounded-lg bg-slate-50 px-2 py-2">
                              <dt className="text-gray-500">Expected</dt>
                              <dd className="mt-1 font-semibold text-gray-900">{selectedOpportunity.expectedCloseDate || "—"}</dd>
                            </div>
                            <div className="rounded-lg bg-slate-50 px-2 py-2">
                              <dt className="text-gray-500">Source</dt>
                              <dd className="mt-1 truncate font-semibold text-gray-900">{selectedOpportunity.source || "—"}</dd>
                            </div>
                            <div className="rounded-lg bg-slate-50 px-2 py-2">
                              <dt className="text-gray-500">Mapped</dt>
                              <dd className="mt-1 truncate font-semibold text-gray-900">{selectedOpportunity.domainItemName || "—"}</dd>
                            </div>
                          </dl>
                          {selectedOpportunity.notes && (
                            <p className="mt-3 line-clamp-3 rounded-lg bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-900">
                              {selectedOpportunity.notes}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  </section>

                  <section className="rounded-2xl border border-gray-200 bg-white p-4">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-500">Opportunity Summary</p>
                      <button
                        type="button"
                        onClick={() => navigate("/dashboard/pipeline")}
                        className="text-xs font-semibold text-teal-700 hover:text-teal-800"
                      >
                        Pipeline
                      </button>
                    </div>
                    {opportunities.length > 0 ? (
                      <div className="space-y-2">
                        {opportunities.slice(0, 4).map((opportunity) => (
                          <button
                            key={opportunity.id}
                            type="button"
                            onClick={() => setSelectedOpportunityId(String(opportunity.id))}
                            className={`w-full rounded-xl border px-3 py-2 text-left text-sm ${
                              String(opportunity.id) === String(selectedOpportunityId)
                                ? "border-teal-300 bg-teal-50"
                                : "border-gray-200 bg-white hover:bg-gray-50"
                            }`}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <span className="line-clamp-2 font-semibold text-gray-900">{opportunity.title}</span>
                              <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-700">
                                {opportunity.stage?.replaceAll("_", " ") || "NEW"}
                              </span>
                            </div>
                            <div className="mt-1 flex flex-wrap gap-2 text-xs text-gray-500">
                              {opportunity.domainItemName && <span>{opportunity.domainItemName}</span>}
                              {formatAmount(opportunity.amount) && <span>{formatAmount(opportunity.amount)}</span>}
                            </div>
                          </button>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-gray-500">No opportunities linked to this chat yet.</p>
                    )}
                  </section>

                  <section className="rounded-2xl border border-gray-200 bg-white p-4">
                    <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-gray-500">Create Opportunity</p>
                    <div className="space-y-2">
                      <input
                        value={opportunityForm.title}
                        onChange={(e) => setOpportunityForm((current) => ({ ...current, title: e.target.value }))}
                        placeholder="New requirement title"
                        className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                      />
                      <select
                        value={createPipelineId}
                        onChange={(e) => {
                          setCreatePipelineId(e.target.value);
                          setOpportunityForm((current) => ({ ...current, domainItemId: "", amount: "" }));
                        }}
                        className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                      >
                        <option value="">Select pipeline</option>
                        {pipelines.filter((pipeline) => pipeline.status === "ACTIVE").map((pipeline) => (
                          <option key={pipeline.id} value={pipeline.id}>
                            {pipeline.name}{pipeline.defaultPipeline ? " (Default)" : ""} - {pipeline.industryKey || "GENERIC"}
                          </option>
                        ))}
                      </select>
                      <div className="rounded-lg bg-gray-50 px-3 py-2 text-xs font-medium text-gray-500">
                        {createPipeline
                          ? `${createPipeline.name} controls stages and catalog key ${normalizeKey(createPipelineIndustryKey) || "GENERIC"}.`
                          : "Select a pipeline to create an opportunity."}
                      </div>
                      {mappedDomainItems.length > 0 ? (
                        <select
                          value={opportunityForm.domainItemId}
                          onChange={(e) => {
                            const item = mappedDomainItems.find((candidate) => String(candidate.id) === e.target.value);
                            setOpportunityForm((current) => ({
                              ...current,
                              domainItemId: e.target.value,
                              amount: current.amount || item?.price || "",
                            }));
                          }}
                          disabled={!createPipelineId}
                          className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                        >
                          <option value="">No catalog item mapping</option>
                          {mappedDomainItems.map((item) => (
                            <option key={item.id} value={item.id}>
                              {item.name}{item.category ? ` - ${item.category}` : ""}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <div className="rounded-xl border border-dashed border-gray-300 bg-white px-3 py-2 text-xs leading-5 text-gray-500">
                          No catalog items match this pipeline key yet. You can still create the opportunity, or add catalog items with key <span className="font-semibold text-gray-800">{normalizeKey(createPipelineIndustryKey) || "GENERIC"}</span> from Domain Catalog.
                        </div>
                      )}
                      <input
                        type="number"
                        value={opportunityForm.amount}
                        onChange={(e) => setOpportunityForm((current) => ({ ...current, amount: e.target.value }))}
                        placeholder="Amount"
                        className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                      />
                      <button
                        type="button"
                        onClick={createOpportunityFromChat}
                        disabled={!createPipelineId || !opportunityForm.title.trim() || savingOpportunity}
                        className="w-full rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-black disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {savingOpportunity ? "Creating..." : "Create opportunity"}
                      </button>
                    </div>
                  </section>
                </div>
              ) : activeCrmTab === "tasks" ? (
                <div className="space-y-4">
                  <section className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-500">Follow-up</p>
                      <button
                        type="button"
                        onClick={() => loadContactTasks(selectedContactId)}
                        disabled={loadingTasks}
                        className="text-xs font-semibold text-teal-700 hover:text-teal-800 disabled:opacity-60"
                      >
                        {loadingTasks ? "Loading..." : "Refresh"}
                      </button>
                    </div>
                    <div className="mb-3 grid grid-cols-3 gap-2 text-center text-xs">
                      <div className="rounded-xl bg-white px-2 py-2">
                        <div className="font-bold text-gray-900">{taskSummary.open}</div>
                        <div className="text-gray-500">Open</div>
                      </div>
                      <div className="rounded-xl bg-white px-2 py-2">
                        <div className="font-bold text-red-600">{taskSummary.overdue}</div>
                        <div className="text-gray-500">Overdue</div>
                      </div>
                      <div className="rounded-xl bg-white px-2 py-2">
                        <div className="font-bold text-emerald-700">{taskSummary.completed}</div>
                        <div className="text-gray-500">Done</div>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowTaskModal(true)}
                      className="w-full rounded-lg bg-teal-700 px-4 py-2 text-sm font-medium text-white hover:bg-teal-800"
                    >
                      Add follow-up task
                    </button>
                  </section>
                  <section className="rounded-2xl border border-gray-200 bg-white p-4">
                    <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-gray-500">Task History</p>
                    {loadingTasks ? (
                      <p className="rounded-xl border border-dashed border-gray-200 px-3 py-6 text-center text-sm text-gray-500">Loading tasks...</p>
                    ) : contactTasks.length > 0 ? (
                      <div className="space-y-3">
                        {contactTasks.map((task) => {
                          const overdue = task.dueAt && !["COMPLETED", "CANCELLED"].includes(task.status) && new Date(task.dueAt).getTime() < Date.now();
                          return (
                            <article key={task.id} className="rounded-xl border border-gray-200 bg-white p-3">
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <p className="line-clamp-2 text-sm font-semibold text-gray-900">{task.title}</p>
                                  {task.description && <p className="mt-1 line-clamp-2 text-xs leading-5 text-gray-500">{task.description}</p>}
                                </div>
                                <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                                  task.status === "COMPLETED"
                                    ? "bg-emerald-50 text-emerald-700"
                                    : task.status === "CANCELLED"
                                      ? "bg-gray-100 text-gray-600"
                                      : overdue
                                        ? "bg-red-50 text-red-700"
                                        : "bg-teal-50 text-teal-700"
                                }`}>
                                  {task.status?.replaceAll("_", " ") || "OPEN"}
                                </span>
                              </div>
                              <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-gray-500">
                                <span>{task.dueAt ? `Due ${formatDateTime(task.dueAt)}` : "No due date"}</span>
                                {task.assignedUserEmail && <span>{task.assignedUserEmail}</span>}
                              </div>
                              <select
                                value={task.status || "OPEN"}
                                onChange={(event) => updateTaskStatus(task.id, event.target.value)}
                                disabled={updatingTaskId === task.id}
                                className="mt-3 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-teal-500 disabled:opacity-60"
                              >
                                {TASK_STATUSES.map((status) => (
                                  <option key={status} value={status}>{status.replaceAll("_", " ")}</option>
                                ))}
                              </select>
                            </article>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="rounded-xl border border-dashed border-gray-200 px-3 py-6 text-center text-sm text-gray-500">No tasks yet. Add a follow-up from this chat.</p>
                    )}
                  </section>
                </div>
              ) : (
                <div className="space-y-4">
                  <section className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
                    <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-gray-500">Activity Summary</p>
                    <dl className="space-y-3 text-sm">
                      <div className="flex justify-between gap-3">
                        <dt className="text-gray-500">Messages loaded</dt>
                        <dd className="font-medium text-gray-900">{messages.length}</dd>
                      </div>
                      <div className="flex justify-between gap-3">
                        <dt className="text-gray-500">Unread</dt>
                        <dd className="font-medium text-gray-900">{selectedConversation.unreadCount || 0}</dd>
                      </div>
                      <div className="flex justify-between gap-3">
                        <dt className="text-gray-500">Opportunities</dt>
                        <dd className="font-medium text-gray-900">{opportunities.length}</dd>
                      </div>
                      <div className="flex justify-between gap-3">
                        <dt className="text-gray-500">Open tasks</dt>
                        <dd className="font-medium text-gray-900">{taskSummary.open}</dd>
                      </div>
                      <div className="flex justify-between gap-3">
                        <dt className="text-gray-500">Last message</dt>
                        <dd className="font-medium text-gray-900">{timeAgo(selectedConversation.lastMessageAt) || "—"}</dd>
                      </div>
                    </dl>
                  </section>
                  {(error || info) && (
                    <div className={`rounded-xl px-3 py-2 text-sm ${error ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-700"}`}>
                      {error || info}
                    </div>
                  )}
                </div>
              )}
            </div>
          </aside>
        )}
      </div>
      <TaskModal
        show={!!taskModal || showTaskModal}
        contact={
          taskModal ||
          contactDetails ||
          (selectedConversation
            ? {
                id: selectedConversation.contactId,
                _id: selectedConversation.contactId,
                name: selectedConversation.contactName,
                phone: selectedConversation.phone,
              }
            : null)
        }
        onClose={() => {
          setTaskModal(null);
          setShowTaskModal(false);
        }}
        onCreated={handleTaskCreated}
        defaultAssignedUserId={selectedConversation?.assignedUserId || ""}
      />
    </div>
  );
}

function isPublicHttpsUrl(value) {
  try {
    const parsed = new URL(value);
    const hostname = parsed.hostname.toLowerCase();
    return (
      parsed.protocol === "https:" &&
      hostname !== "localhost" &&
      hostname !== "127.0.0.1" &&
      hostname !== "::1" &&
      !hostname.endsWith(".local")
    );
  } catch {
    return false;
  }
}
