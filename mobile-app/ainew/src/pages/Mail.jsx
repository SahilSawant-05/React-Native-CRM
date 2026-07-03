import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  ArrowDownLeft,
  ArrowUpRight,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Image as ImageIcon,
  Inbox,
  MailCheck,
  MailPlus,
  MailWarning,
  PencilLine,
  RefreshCw,
  Search,
  Send,
  UserRound,
  X,
} from "lucide-react";
import api from "../api/axios";
import EmailTemplatePicker from "../components/email/EmailTemplatePicker";
import MediaLibraryDialog from "../components/media/MediaLibraryDialog";
import DateRangeFilter, { dateRangeParams, presetDateRange } from "../components/common/DateRangeFilter";
import AiAssistPanel from "../components/ai/AiAssistPanel";
import {
  SYNC_STAGES,
  formatDate,
  initials,
  normalizeList,
  shortDate,
  textPreview,
} from "../components/email/emailUtils";

const EmailDesigner = lazy(() => import("../components/email/EmailDesigner"));
const EMAIL_PAGE_SIZE = 25;

const emptyComposer = {
  contactId: "",
  opportunityId: "",
  toEmail: "",
  subject: "",
  bodyHtml: "",
  bodyText: "",
  designJson: "",
  mjml: "",
};

const emptyInbound = {
  contactId: "",
  opportunityId: "",
  fromEmail: "",
  toEmail: "",
  subject: "",
  bodyText: "",
};

function SyncProgress({ syncing, syncStage, lastSyncAt, lastSyncResult }) {
  const activeIndex = SYNC_STAGES.findIndex((item) => item.key === syncStage);

  return (
    <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
      <div className="grid grid-cols-4 gap-1">
        {SYNC_STAGES.map((stage, index) => {
          const done = !syncing && syncStage === "DONE";
          const active = syncing && stage.key === syncStage;
          const completed = done || (syncing && index < activeIndex);
          return (
            <div key={stage.key} className="min-w-0">
              <div className={`h-1.5 rounded-full ${completed ? "bg-teal-600" : active ? "bg-amber-500" : "bg-gray-200"}`} />
              <div className={`mt-1 truncate text-[10px] font-bold ${active ? "text-amber-700" : completed ? "text-teal-700" : "text-gray-400"}`}>
                {stage.label}
              </div>
            </div>
          );
        })}
      </div>
      <div className="mt-3 text-xs leading-5 text-gray-500">
        <div>Last synced: {lastSyncAt ? formatDate(lastSyncAt) : "Not synced this session"}</div>
        {lastSyncResult && !lastSyncResult.error && (
          <div>
            Scanned {lastSyncResult.scanned || 0}, imported {lastSyncResult.imported || 0}, skipped {lastSyncResult.skipped || 0}
          </div>
        )}
        {lastSyncResult?.error && <div className="font-semibold text-red-600">{lastSyncResult.error}</div>}
      </div>
    </div>
  );
}

function ComposeModal({
  open,
  saving,
  composer,
  contacts,
  opportunities,
  contactOptions,
  templateVersion,
  mergeData,
  onClose,
  onSubmit,
  onValue,
  onContact,
  onDesign,
  onTemplate,
  onMediaAsset,
}) {
  const [mediaDialogOpen, setMediaDialogOpen] = useState(false);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="max-h-[94vh] w-full max-w-7xl overflow-y-auto rounded-xl bg-white shadow-2xl">
        <div className="sticky top-0 z-10 flex flex-wrap items-start justify-between gap-3 border-b border-gray-200 bg-white px-5 py-4">
          <div>
            <h2 className="text-xl font-extrabold text-gray-950">Compose Email</h2>
            <p className="mt-1 text-sm text-gray-500">Choose a CRM record, apply a template, then edit before sending.</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-2 text-gray-500 hover:bg-gray-100">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={onSubmit} className="space-y-4 p-5">
          <div className="grid gap-3 lg:grid-cols-4">
            <select value={composer.contactId} onChange={(event) => onContact(event.target.value)} className="rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-teal-500">
              <option value="">No contact</option>
              {contactOptions.map((contact) => <option key={contact.id} value={contact.id}>{contact.label}</option>)}
            </select>
            <select value={composer.opportunityId} onChange={(event) => onValue("opportunityId", event.target.value)} className="rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-teal-500">
              <option value="">No opportunity</option>
              {opportunities.map((opportunity) => <option key={opportunity.id} value={opportunity.id}>{opportunity.title}</option>)}
            </select>
            <div className="relative">
              <UserRound size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input value={composer.toEmail} onChange={(event) => onValue("toEmail", event.target.value)} placeholder="To email" className="w-full rounded-lg border border-gray-300 px-9 py-2 text-sm outline-none focus:border-teal-500" />
            </div>
            <input value={composer.subject} onChange={(event) => onValue("subject", event.target.value)} placeholder="Subject" className="rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-teal-500" />
          </div>

          <EmailTemplatePicker onApply={onTemplate} mergeData={mergeData} />

          <AiAssistPanel
            contactId={composer.contactId || null}
            opportunityId={composer.opportunityId || null}
            title="AI Email Assistant"
            contextPrompt={`Draft a professional CRM email.
To: ${composer.toEmail || mergeData.contactEmail || ""}
Subject: ${composer.subject || ""}
Contact: ${mergeData.contactName || ""}
Phone: ${mergeData.contactPhone || ""}
Opportunity: ${mergeData.opportunityName || ""}
Pipeline: ${mergeData.pipelineName || ""}
Current draft:
${composer.bodyText || ""}`}
            replyPrompt={`Write a clear, concise email body for this CRM contact. Keep it warm, professional, and include one next-step CTA.
Contact: ${mergeData.contactName || composer.toEmail || "Customer"}
Opportunity: ${mergeData.opportunityName || ""}
Subject: ${composer.subject || ""}
Current draft:
${composer.bodyText || ""}`}
            onApply={(text) => onValue("bodyText", [composer.bodyText, text].filter(Boolean).join(composer.bodyText ? "\n\n" : ""))}
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
            <span className="text-xs font-medium text-gray-500">Images can also be uploaded directly inside the email designer image block.</span>
          </div>

          <MediaLibraryDialog
            open={mediaDialogOpen}
            title="Choose email media"
            helper="Select an image or file to insert into this email."
            allowedTypes={["IMAGE", "DOCUMENT", "VIDEO", "AUDIO"]}
            onSelect={onMediaAsset}
            onClose={() => setMediaDialogOpen(false)}
          />

          <Suspense fallback={<div className="rounded-lg border border-gray-200 p-6 text-center text-sm text-gray-500">Loading email designer...</div>}>
            <div className="email-designer-scroll">
              <EmailDesigner
                key={`mail-compose-designer-${templateVersion}`}
                subject={composer.subject}
                value={composer}
                onChange={onDesign}
                height="640px"
              />
            </div>
          </Suspense>

          <textarea rows={4} value={composer.bodyText} onChange={(event) => onValue("bodyText", event.target.value)} placeholder="Plain text fallback" className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-teal-500" />

          <div className="flex flex-col gap-2 border-t border-gray-100 pt-4 sm:flex-row sm:justify-end">
            <button type="button" onClick={onClose} className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50">
              Cancel
            </button>
            <button disabled={saving || !composer.subject.trim() || (!composer.bodyHtml.trim() && !composer.bodyText.trim())} className="inline-flex items-center justify-center gap-2 rounded-lg bg-teal-700 px-5 py-2 text-sm font-semibold text-white hover:bg-teal-800 disabled:opacity-60">
              <Send size={16} />
              {saving ? "Sending..." : "Send Email"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function ManualLogModal({ open, saving, inbound, contacts, opportunities, onClose, onSubmit, onValue }) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-2xl rounded-xl bg-white p-5 shadow-2xl">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-extrabold text-gray-950">Manual Email Log</h2>
            <p className="mt-1 text-sm text-gray-500">Use this only when an email happened outside the connected inbox.</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-2 text-gray-500 hover:bg-gray-100">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={onSubmit} className="space-y-3">
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs font-semibold leading-5 text-amber-800">
            For Gmail/IMAP, prefer Sync Inbox. Manual log is for historical or offline email records.
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <select value={inbound.contactId} onChange={(event) => onValue("contactId", event.target.value)} className="rounded-lg border border-gray-300 px-3 py-2 text-sm">
              <option value="">No contact</option>
              {contacts.map((contact) => <option key={contact.id || contact._id} value={contact.id || contact._id}>{contact.name || contact.email || contact.phone}</option>)}
            </select>
            <select value={inbound.opportunityId} onChange={(event) => onValue("opportunityId", event.target.value)} className="rounded-lg border border-gray-300 px-3 py-2 text-sm">
              <option value="">No opportunity</option>
              {opportunities.map((opportunity) => <option key={opportunity.id} value={opportunity.id}>{opportunity.title}</option>)}
            </select>
          </div>
          <input value={inbound.fromEmail} onChange={(event) => onValue("fromEmail", event.target.value)} placeholder="From email" className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
          <input value={inbound.toEmail} onChange={(event) => onValue("toEmail", event.target.value)} placeholder="To email" className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
          <input value={inbound.subject} onChange={(event) => onValue("subject", event.target.value)} placeholder="Subject" className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
          <textarea rows={7} value={inbound.bodyText} onChange={(event) => onValue("bodyText", event.target.value)} placeholder="Received body" className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
          <div className="flex justify-end gap-2">
            <button type="button" onClick={onClose} className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50">
              Cancel
            </button>
            <button disabled={saving || !inbound.fromEmail.trim() || !inbound.subject.trim() || !inbound.bodyText.trim()} className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-black disabled:opacity-60">
              {saving ? "Saving..." : "Save Log"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function Mail() {
  const navigate = useNavigate();
  const location = useLocation();
  const [emails, setEmails] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [opportunities, setOpportunities] = useState([]);
  const [filter, setFilter] = useState("ALL");
  const [searchTerm, setSearchTerm] = useState("");
  const [mailToolsOpen, setMailToolsOpen] = useState(false);
  const [datePreset, setDatePreset] = useState("30D");
  const [dateRange, setDateRange] = useState(() => presetDateRange("30D"));
  const [page, setPage] = useState(1);
  const [pageInfo, setPageInfo] = useState({
    page: 0,
    size: EMAIL_PAGE_SIZE,
    totalElements: 0,
    totalPages: 1,
    hasNext: false,
    hasPrevious: false,
  });
  const [composer, setComposer] = useState(emptyComposer);
  const [composerTemplateVersion, setComposerTemplateVersion] = useState(0);
  const [composeOpen, setComposeOpen] = useState(false);
  const [inbound, setInbound] = useState(emptyInbound);
  const [manualOpen, setManualOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncStage, setSyncStage] = useState("DONE");
  const [lastSyncAt, setLastSyncAt] = useState("");
  const [lastSyncResult, setLastSyncResult] = useState(null);
  const [message, setMessage] = useState("");

  const visibleEmails = emails;
  const totalPages = Math.max(1, pageInfo.totalPages || 1);
  const pageStart = pageInfo.totalElements === 0 ? 0 : (pageInfo.page || 0) * (pageInfo.size || EMAIL_PAGE_SIZE) + 1;
  const pageEmails = visibleEmails;
  const pageEnd = Math.min(pageInfo.totalElements, pageStart + pageEmails.length - 1);

  const folderItems = useMemo(() => {
    return [
      { key: "ALL", label: "All Mail", icon: Inbox, count: filter === "ALL" ? pageInfo.totalElements : null },
      { key: "INBOX", label: "Inbox", icon: ArrowDownLeft, count: filter === "INBOX" ? pageInfo.totalElements : null },
      { key: "UNREAD", label: "Unread", icon: MailWarning, count: filter === "UNREAD" ? pageInfo.totalElements : null },
      { key: "SENT", label: "Sent", icon: ArrowUpRight, count: filter === "SENT" ? pageInfo.totalElements : null },
      { key: "FAILED", label: "Failed", icon: MailWarning, count: filter === "FAILED" ? pageInfo.totalElements : null },
    ];
  }, [filter, pageInfo.totalElements]);

  const contactOptions = useMemo(
    () => contacts.map((contact) => ({
      id: contact.id || contact._id,
      label: contact.name || contact.email || contact.phone || "Unknown Contact",
      email: contact.email || "",
    })).filter((contact) => contact.id),
    [contacts]
  );

  const composerContact = useMemo(
    () => contacts.find((contact) => String(contact.id || contact._id) === String(composer.contactId)) || null,
    [contacts, composer.contactId]
  );

  const composerOpportunity = useMemo(
    () => opportunities.find((opportunity) => String(opportunity.id) === String(composer.opportunityId)) || null,
    [opportunities, composer.opportunityId]
  );

  const composerMergeData = useMemo(
    () => ({
      contactName: composerContact?.name || "",
      contactPhone: composerContact?.phone || "",
      contactEmail: composerContact?.email || composer.toEmail || "",
      leadSource: composerContact?.leadSource || composerOpportunity?.source || "",
      opportunityName: composerOpportunity?.title || "",
      pipelineName: composerOpportunity?.pipelineName || "",
    }),
    [composerContact, composerOpportunity, composer.toEmail]
  );

  const loadData = useCallback(async () => {
    setLoading(true);
    setMessage("");
    try {
      const [emailResponse, contactResponse, opportunityResponse] = await Promise.all([
        api.get("/api/email/logs/page", {
          params: {
            folder: filter,
            query: searchTerm.trim() || undefined,
            ...dateRangeParams(dateRange),
            page: Math.max(0, page - 1),
            size: EMAIL_PAGE_SIZE,
          },
        }),
        api.get("/api/contacts/page?page=0&size=500"),
        api.get("/api/opportunities"),
      ]);
      const emailPayload = emailResponse.data || {};
      setEmails(normalizeList(emailPayload));
      setPageInfo({
        page: emailPayload.page ?? Math.max(0, page - 1),
        size: emailPayload.size ?? EMAIL_PAGE_SIZE,
        totalElements: emailPayload.totalElements ?? 0,
        totalPages: Math.max(1, emailPayload.totalPages ?? 1),
        hasNext: Boolean(emailPayload.hasNext),
        hasPrevious: Boolean(emailPayload.hasPrevious),
      });
      setContacts(normalizeList(contactResponse.data));
      setOpportunities(normalizeList(opportunityResponse.data));
    } catch (error) {
      setMessage(error?.response?.data?.message || error.message || "Failed to load mail");
    } finally {
      setLoading(false);
    }
  }, [dateRange, filter, page, searchTerm]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    const contact = location.state?.composeContact;
    if (!contact) return;
    const contactId = contact.id || contact._id || "";
    setComposer((current) => ({
      ...current,
      contactId: contactId ? String(contactId) : "",
      toEmail: contact.email || current.toEmail,
    }));
    setComposeOpen(true);
    navigate(location.pathname, { replace: true, state: null });
  }, [location.pathname, location.state, navigate]);

  useEffect(() => {
    setPage(1);
  }, [dateRange, filter, searchTerm]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const setComposerValue = (field, value) => {
    setComposer((current) => ({ ...current, [field]: value }));
  };

  const selectContactForComposer = (contactId) => {
    const contact = contactOptions.find((item) => String(item.id) === String(contactId));
    setComposer((current) => ({ ...current, contactId, toEmail: contact?.email || current.toEmail }));
  };

  const setComposerDesign = (designerValue) => {
    setComposer((current) => ({
      ...current,
      designJson: designerValue.designJson || current.designJson || "",
      mjml: designerValue.mjml || current.mjml || "",
      bodyHtml: designerValue.bodyHtml || current.bodyHtml || "",
    }));
  };

  const applyComposerTemplate = (payload) => {
    setComposer((current) => ({
      ...current,
      subject: payload.subject || current.subject,
      bodyHtml: payload.bodyHtml || "",
      bodyText: payload.bodyText || "",
      designJson: payload.designJson || "",
      mjml: payload.mjml || "",
    }));
    setComposerTemplateVersion((version) => version + 1);
  };

  const insertComposerMedia = (asset) => {
    const htmlSnippet = mediaHtmlSnippet(asset);
    const textSnippet = `${asset.name || asset.originalFileName}: ${asset.publicUrl}`;
    setComposer((current) => ({
      ...current,
      bodyHtml: `${current.bodyHtml || ""}${htmlSnippet}`,
      bodyText: [current.bodyText, textSnippet].filter(Boolean).join("\n"),
    }));
    setComposerTemplateVersion((version) => version + 1);
  };

  const sendEmail = async (event) => {
    event.preventDefault();
    if (!composer.subject.trim() || (!composer.bodyHtml.trim() && !composer.bodyText.trim())) return;
    setSaving(true);
    setMessage("");
    try {
      const response = await api.post("/api/email/send", {
        contactId: composer.contactId ? Number(composer.contactId) : null,
        opportunityId: composer.opportunityId ? Number(composer.opportunityId) : null,
        toEmail: composer.toEmail.trim() || null,
        subject: composer.subject.trim(),
        bodyHtml: composer.bodyHtml.trim() || null,
        bodyText: composer.bodyText.trim(),
      });
      setComposer(emptyComposer);
      setComposerTemplateVersion((version) => version + 1);
      setComposeOpen(false);
      setMessage("Email sent.");
      await loadData();
      if (response.data?.id) navigate(`/dashboard/mail/${response.data.id}`);
    } catch (error) {
      setMessage(error?.response?.data?.message || error.message || "Send failed");
    } finally {
      setSaving(false);
    }
  };

  const setInboundValue = (field, value) => {
    setInbound((current) => ({ ...current, [field]: value }));
  };

  const recordInbound = async (event) => {
    event.preventDefault();
    if (!inbound.fromEmail.trim() || !inbound.subject.trim() || !inbound.bodyText.trim()) return;
    setSaving(true);
    setMessage("");
    try {
      const response = await api.post("/api/email/receive", {
        contactId: inbound.contactId ? Number(inbound.contactId) : null,
        opportunityId: inbound.opportunityId ? Number(inbound.opportunityId) : null,
        fromEmail: inbound.fromEmail.trim(),
        toEmail: inbound.toEmail.trim() || null,
        subject: inbound.subject.trim(),
        bodyText: inbound.bodyText.trim(),
      });
      setInbound(emptyInbound);
      setManualOpen(false);
      setMessage("Received email recorded.");
      await loadData();
      if (response.data?.id) navigate(`/dashboard/mail/${response.data.id}`);
    } catch (error) {
      setMessage(error?.response?.data?.message || error.message || "Could not record email");
    } finally {
      setSaving(false);
    }
  };

  const syncInbox = async () => {
    setSyncing(true);
    setSyncStage("CONNECTING");
    setLastSyncResult(null);
    setMessage("Connecting to inbox...");
    let readingTimer;
    let importingTimer;
    try {
      readingTimer = window.setTimeout(() => {
        setSyncStage("READING");
        setMessage("Reading inbox...");
      }, 500);
      importingTimer = window.setTimeout(() => {
        setSyncStage("IMPORTING");
        setMessage("Importing unread emails...");
      }, 1500);
      const response = await api.post("/api/email/sync", null, { params: { maxMessages: 10 } });
      const result = response.data || {};
      setSyncStage("DONE");
      setLastSyncAt(new Date().toISOString());
      setLastSyncResult(result);
      setMessage(`Sync completed. Imported ${result.imported || 0}, skipped ${result.skipped || 0}.`);
      await loadData();
      setFilter("INBOX");
      setPage(1);
    } catch (error) {
      setSyncStage("DONE");
      setLastSyncResult({ error: error?.response?.data?.message || error.message || "Email sync failed" });
      setMessage(error?.response?.data?.message || error.message || "Email sync failed");
    } finally {
      window.clearTimeout(readingTimer);
      window.clearTimeout(importingTimer);
      setSyncing(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f6f8fc] p-4 text-gray-900 md:p-6">
      <ComposeModal
        open={composeOpen}
        saving={saving}
        composer={composer}
        contacts={contacts}
        opportunities={opportunities}
        contactOptions={contactOptions}
        templateVersion={composerTemplateVersion}
        mergeData={composerMergeData}
        onClose={() => setComposeOpen(false)}
        onSubmit={sendEmail}
        onValue={setComposerValue}
        onContact={selectContactForComposer}
        onDesign={setComposerDesign}
        onTemplate={applyComposerTemplate}
        onMediaAsset={insertComposerMedia}
      />
      <ManualLogModal
        open={manualOpen}
        saving={saving}
        inbound={inbound}
        contacts={contacts}
        opportunities={opportunities}
        onClose={() => setManualOpen(false)}
        onSubmit={recordInbound}
        onValue={setInboundValue}
      />

      <div className="mx-auto max-w-[1500px]">
        <header className="mb-4 flex flex-col gap-3 rounded-2xl border border-gray-200 bg-white px-4 py-3 shadow-sm lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-700 text-white">
              <MailCheck size={20} />
            </div>
            <div>
              <h1 className="text-xl font-extrabold text-gray-950">Mail</h1>
              <p className="text-sm text-gray-500">Inbox, sent mail, sync, and CRM-linked email activity.</p>
            </div>
          </div>
          <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto] lg:flex lg:items-center">
          <div className="relative">
            <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Search mail"
              className="h-11 w-full rounded-full border border-gray-200 bg-gray-50 pl-10 pr-4 text-sm outline-none focus:border-teal-500 focus:bg-white lg:w-96"
            />
          </div>
          <button
            type="button"
            onClick={() => setMailToolsOpen((current) => !current)}
            className="h-11 rounded-full border border-gray-200 bg-white px-4 text-sm font-extrabold text-gray-700 hover:bg-gray-50 lg:hidden"
          >
            {mailToolsOpen ? "Hide tools" : "Mail tools"}
          </button>
          </div>
        </header>

        <div className="grid gap-4 lg:grid-cols-[260px_minmax(0,1fr)]">
          <aside className={`${mailToolsOpen ? "space-y-4" : "hidden"} lg:block lg:space-y-4`}>
            <section className="rounded-2xl border border-gray-200 bg-white p-3 shadow-sm">
              <button
                type="button"
                onClick={() => setComposeOpen(true)}
                className="mb-3 flex w-full items-center justify-center gap-2 rounded-2xl bg-teal-700 px-4 py-3 text-sm font-extrabold text-white shadow-sm hover:bg-teal-800"
              >
                <PencilLine size={16} />
                Compose
              </button>
              <button
                type="button"
                onClick={() => setManualOpen(true)}
                className="mb-3 flex w-full items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-bold text-gray-700 hover:bg-gray-50"
              >
                <MailPlus size={16} />
                Manual Log
              </button>
              <nav className="space-y-1">
                {folderItems.map(({ key, label, icon: Icon, count }) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => {
                      setFilter(key);
                      setPage(1);
                    }}
                    className={`flex w-full items-center justify-between gap-3 rounded-xl border px-3 py-2 text-sm font-bold transition ${
                      filter === key
                        ? "border-teal-200 bg-teal-700 text-white shadow-sm"
                        : "border-transparent text-gray-600 hover:bg-gray-50"
                    }`}
                  >
                    <span className="flex items-center gap-3">
                      <Icon size={16} />
                      {label}
                    </span>
                    {count !== null && (
                      <span className={`rounded-full px-2 py-0.5 text-xs ${filter === key ? "bg-white/20 text-white" : "bg-gray-100 text-gray-600"}`}>
                        {count}
                      </span>
                    )}
                  </button>
                ))}
              </nav>
            </section>

            <section className="rounded-2xl border border-gray-200 bg-white p-3 shadow-sm">
              <button
                onClick={syncInbox}
                disabled={syncing}
                className="mb-3 inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-gray-950 px-4 text-sm font-bold text-white hover:bg-black disabled:opacity-60"
              >
                <RefreshCw size={16} className={syncing ? "animate-spin" : ""} />
                {syncing ? "Syncing" : "Sync Inbox"}
              </button>
              <SyncProgress syncing={syncing} syncStage={syncStage} lastSyncAt={lastSyncAt} lastSyncResult={lastSyncResult} />
            </section>

            <DateRangeFilter
              value={dateRange}
              preset={datePreset}
              onChange={setDateRange}
              onPresetChange={setDatePreset}
              compact
            />
          </aside>

          <main className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
            <div className="flex min-h-16 flex-col gap-2 border-b border-gray-100 px-5 py-3 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="text-sm font-extrabold text-gray-950">{folderItems.find((item) => item.key === filter)?.label || "Mail"}</h2>
                <p className="text-xs text-gray-500">{pageInfo.totalElements} messages</p>
              </div>
              <div className="flex items-center gap-2">
                {pageInfo.totalElements > 0 && (
                  <span className="text-xs font-semibold text-gray-500">
                    {pageStart}-{pageEnd} of {pageInfo.totalElements}
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => setPage((current) => Math.max(1, current - 1))}
                  disabled={page <= 1}
                  className="rounded-lg border border-gray-200 p-2 text-gray-600 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
                  aria-label="Previous page"
                >
                  <ChevronLeft size={16} />
                </button>
                <button
                  type="button"
                  onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
                  disabled={page >= totalPages}
                  className="rounded-lg border border-gray-200 p-2 text-gray-600 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
                  aria-label="Next page"
                >
                  <ChevronRight size={16} />
                </button>
                {loading && <Clock3 size={16} className="animate-spin text-gray-400" />}
              </div>
            </div>

            <div className="divide-y divide-gray-100">
              {pageEmails.map((email) => {
                const unread = email.direction === "INBOUND" && !email.readAt;
                return (
                  <Link
                    key={email.id}
                    to={`/dashboard/mail/${email.id}`}
                    className={`grid gap-3 px-5 py-3 hover:bg-gray-50 md:grid-cols-[36px_minmax(160px,240px)_minmax(0,1fr)_auto] md:items-center ${
                      unread ? "bg-white font-bold" : "bg-white"
                    }`}
                  >
                    <div className={`flex h-9 w-9 items-center justify-center rounded-full text-xs font-extrabold ${
                      email.direction === "INBOUND" ? "bg-blue-50 text-blue-700" : "bg-emerald-50 text-emerald-700"
                    }`}>
                      {initials(email.direction === "INBOUND" ? email.fromEmail : email.toEmail)}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        {unread && <span className="h-2 w-2 rounded-full bg-teal-600" />}
                        <p className="truncate text-sm text-gray-950">
                          {email.direction === "INBOUND" ? email.fromEmail || "Unknown sender" : email.toEmail || "Unknown recipient"}
                        </p>
                      </div>
                      <p className="mt-0.5 text-xs font-semibold text-gray-400">{email.direction === "INBOUND" ? "Inbox" : "Sent"}</p>
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm text-gray-900">{email.subject || "(No subject)"}</p>
                      <p className="mt-1 line-clamp-1 text-xs font-normal text-gray-500">{textPreview(email.body) || "No preview available"}</p>
                    </div>
                    <div className="flex items-center justify-between gap-3 md:justify-end">
                      {email.status === "FAILED" && (
                        <span className="rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-bold text-red-700">Failed</span>
                      )}
                      <span className="shrink-0 text-xs font-semibold text-gray-400">{shortDate(email.createdAt)}</span>
                    </div>
                  </Link>
                );
              })}
              {!loading && pageInfo.totalElements === 0 && (
                <div className="px-5 py-16 text-center text-sm text-gray-500">No emails found.</div>
              )}
            </div>
          </main>
        </div>

        {message && <p className="mt-4 rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-600 shadow-sm">{message}</p>}
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
