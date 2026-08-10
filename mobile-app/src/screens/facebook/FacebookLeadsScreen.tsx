import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import api from "../../api/client";

/* ─── Types ──────────────────────────────────────────────────────────────── */
interface FbPage {
  id: string;
  name?: string;
  leadgenSubscribedAt?: string | null;
  leadgenSubscribeError?: string | null;
}
interface FbForm {
  id: string;
  name?: string;
  status?: string;
}
interface FbMapping {
  formId: string;
  formName?: string;
  tag?: string;
  ownerUserId?: string | number | null;
  pipelineId?: string | number | null;
  stage?: string;
  createOpportunity?: boolean;
  active?: boolean;
  importedCount?: number;
  lastImportedAt?: string | null;
  lastSyncedAt?: string | null;
  lastWebhookReceivedAt?: string | null;
  lastWebhookError?: string | null;
  lastWebhookEventId?: string | null;
  pageSubscribedAt?: string | null;
}
interface Pipeline { id: string | number; name?: string; status?: string; }
interface Stage { id?: string | number; stageKey?: string; label?: string; }
interface UserRow { id: string | number; email?: string; role?: string; }
interface ImportRow {
  id: string | number;
  contactId?: string | number | null;
  contactName?: string;
  contactPhone?: string;
  contactEmail?: string;
  formName?: string;
  formId?: string;
  pageName?: string;
  pageId?: string;
  ownerEmail?: string;
  importedAt?: string;
  matchedExistingContact?: boolean;
  metaLeadId?: string;
}
interface SyncResult { fetched?: number; created?: number; updated?: number; skipped?: number; warnings?: string[]; }
interface MappingDraft {
  tag: string;
  ownerUserId: string;
  pipelineId: string;
  stage: string;
  createOpportunity: boolean;
  active: boolean;
}

const DEFAULT_LIMIT = "100";

/* ─── Helpers ────────────────────────────────────────────────────────────── */
function errMsg(err: any, fallback = "Something went wrong."): string {
  const data = err?.response?.data;
  if (typeof data === "string") return data;
  return data?.message || data?.error || err?.message || fallback;
}
function asArray<T = any>(data: any): T[] {
  return Array.isArray(data) ? data : Array.isArray(data?.items) ? data.items : [];
}
function slugify(value?: string): string {
  return (
    String(value || "")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80) || "facebook-lead-form"
  );
}
function draftFromMapping(mapping: FbMapping | undefined, recommendedTag = ""): MappingDraft {
  return {
    tag: mapping?.tag || recommendedTag,
    ownerUserId: mapping?.ownerUserId != null ? String(mapping.ownerUserId) : "",
    pipelineId: mapping?.pipelineId != null ? String(mapping.pipelineId) : "",
    stage: mapping?.stage || "",
    createOpportunity: Boolean(mapping?.createOpportunity),
    active: mapping?.active !== false,
  };
}
function formatDate(value?: string | null): string {
  if (!value) return "";
  const d = new Date(value);
  return Number.isNaN(d.getTime())
    ? value
    : d.toLocaleString(undefined, { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

const STATUS_FILTERS = [
  { key: "ALL", label: "All" },
  { key: "MAPPED", label: "Mapped" },
  { key: "UNMAPPED", label: "Unmapped" },
  { key: "ERROR", label: "Errors" },
];

/* ─── Screen ─────────────────────────────────────────────────────────────── */
export default function FacebookLeadsScreen() {
  const [pages, setPages] = useState<FbPage[]>([]);
  const [forms, setForms] = useState<FbForm[]>([]);
  const [mappings, setMappings] = useState<FbMapping[]>([]);
  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [imports, setImports] = useState<ImportRow[]>([]);

  const [pageId, setPageId] = useState("");
  const [limit, setLimit] = useState(DEFAULT_LIMIT);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");

  const [loadingPages, setLoadingPages] = useState(false);
  const [loadingForms, setLoadingForms] = useState(false);
  const [subscribing, setSubscribing] = useState(false);
  const [syncingKey, setSyncingKey] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [result, setResult] = useState<SyncResult | null>(null);

  const [modalFormId, setModalFormId] = useState("");

  const selectedPage = useMemo(
    () => pages.find((p) => String(p.id) === String(pageId)) || null,
    [pages, pageId]
  );
  const mappingByFormId = useMemo(() => {
    const m = new Map<string, FbMapping>();
    mappings.forEach((mp) => m.set(String(mp.formId), mp));
    return m;
  }, [mappings]);
  const activePipelines = useMemo(
    () => pipelines.filter((p) => !p.status || p.status === "ACTIVE"),
    [pipelines]
  );
  const filteredForms = useMemo(() => {
    const q = search.trim().toLowerCase();
    return forms.filter((form) => {
      const mapping = mappingByFormId.get(String(form.id));
      const matchesSearch =
        !q ||
        String(form.name || "").toLowerCase().includes(q) ||
        String(form.id || "").toLowerCase().includes(q);
      const isMapped = Boolean(mapping);
      const hasError = Boolean(mapping?.lastWebhookError);
      const matchesStatus =
        statusFilter === "ALL" ||
        (statusFilter === "MAPPED" && isMapped) ||
        (statusFilter === "UNMAPPED" && !isMapped) ||
        (statusFilter === "ERROR" && hasError);
      return matchesSearch && matchesStatus;
    });
  }, [forms, mappingByFormId, search, statusFilter]);
  const modalForm = useMemo(
    () => forms.find((f) => String(f.id) === String(modalFormId)) || null,
    [forms, modalFormId]
  );
  const webhookActive =
    Boolean(selectedPage?.leadgenSubscribedAt) ||
    mappings.some((m) => m.pageSubscribedAt || m.lastWebhookReceivedAt);

  /* ─── Loaders ──────────────────────────────────────────────────────────── */
  const loadReferenceData = useCallback(async () => {
    const [pipelineRes, userRes] = await Promise.all([
      api.get("/api/pipelines").catch(() => ({ data: [] })),
      api.get("/api/users").catch(() => ({ data: [] })),
    ]);
    setPipelines(asArray<Pipeline>(pipelineRes.data));
    setUsers(asArray<UserRow>(userRes.data));
  }, []);

  const loadPages = useCallback(async () => {
    setError("");
    setLoadingPages(true);
    try {
      const res = await api.get("/api/facebook-leads/pages");
      const next = asArray<FbPage>(res.data);
      setPages(next);
      setPageId((current) => {
        if (current && next.some((p) => String(p.id) === String(current))) return current;
        return next[0]?.id || "";
      });
    } catch (err: any) {
      setError(errMsg(err, "Unable to load Facebook pages. Reconnect Meta with lead permissions."));
    } finally {
      setLoadingPages(false);
    }
  }, []);

  const loadMappings = useCallback(async (pid: string) => {
    try {
      const res = await api.get("/api/facebook-leads/mappings", {
        params: pid ? { pageId: pid } : undefined,
      });
      setMappings(asArray<FbMapping>(res.data));
    } catch {
      setMappings([]);
    }
  }, []);

  const loadImports = useCallback(async (pid: string) => {
    if (!pid) { setImports([]); return; }
    try {
      const res = await api.get("/api/facebook-leads/imports", {
        params: { pageId: pid, page: 0, size: 20 },
      });
      setImports(asArray<ImportRow>(res.data));
    } catch {
      setImports([]);
    }
  }, []);

  const loadForms = useCallback(async (pid: string) => {
    if (!pid) { setForms([]); setMappings([]); setImports([]); return; }
    setError("");
    setSuccess("");
    setLoadingForms(true);
    try {
      const [formsRes] = await Promise.all([
        api.get("/api/facebook-leads/forms", { params: { pageId: pid } }),
        loadMappings(pid),
      ]);
      setForms(asArray<FbForm>(formsRes.data));
      loadImports(pid);
    } catch (err: any) {
      setForms([]);
      setError(errMsg(err, "Unable to load lead forms. Check pages_manage_ads and leads_retrieval permissions."));
    } finally {
      setLoadingForms(false);
    }
  }, [loadMappings, loadImports]);

  useEffect(() => { loadReferenceData(); loadPages(); }, [loadReferenceData, loadPages]);
  useEffect(() => { loadForms(pageId); }, [pageId, loadForms]);

  /* ─── Actions ──────────────────────────────────────────────────────────── */
  const subscribePage = async () => {
    if (!pageId) return;
    setError(""); setSuccess(""); setSubscribing(true);
    try {
      const res = await api.post(`/api/facebook-leads/pages/${pageId}/subscribe`);
      setPages((cur) => cur.map((p) => (
        String(p.id) === String(pageId)
          ? { ...p, leadgenSubscribedAt: new Date().toISOString(), leadgenSubscribeError: "" }
          : p
      )));
      await loadMappings(pageId);
      setSuccess(res.data?.message || "Facebook Page subscribed to leadgen webhook.");
    } catch (err: any) {
      setError(errMsg(err, "Could not subscribe this Page to the Facebook leadgen webhook."));
    } finally {
      setSubscribing(false);
    }
  };

  const parsedLimit = () => Math.min(500, Math.max(1, parseInt(limit, 10) || 100));

  const syncForm = async (form: FbForm) => {
    setError(""); setSuccess(""); setResult(null); setSyncingKey(form.id);
    try {
      const res = await api.post("/api/facebook-leads/sync", null, {
        params: { pageId, formId: form.id, limit: parsedLimit() },
      });
      setResult(res.data);
      await loadMappings(pageId);
      loadImports(pageId);
      setSuccess(`Synced ${form.name || form.id}.`);
    } catch (err: any) {
      setError(errMsg(err, "Facebook lead sync failed."));
    } finally {
      setSyncingKey("");
    }
  };

  const syncAll = async () => {
    setError(""); setSuccess(""); setResult(null); setSyncingKey("all");
    try {
      const res = await api.post("/api/facebook-leads/sync-all", null, { params: { limit: parsedLimit() } });
      setResult(res.data);
      await loadMappings(pageId);
      loadImports(pageId);
      setSuccess(`Synced ${res.data?.forms ?? 0} forms across ${res.data?.pages ?? 0} pages.`);
    } catch (err: any) {
      setError(errMsg(err, "Facebook sync all failed."));
    } finally {
      setSyncingKey("");
    }
  };

  const saveMapping = async (form: FbForm, draft: MappingDraft): Promise<boolean> => {
    if (!pageId) return false;
    setError(""); setSuccess("");
    try {
      const res = await api.post("/api/facebook-leads/mappings", {
        pageId,
        pageName: selectedPage?.name || "",
        formId: form.id,
        formName: form.name,
        tag: draft.tag || "",
        ownerUserId: draft.ownerUserId || null,
        pipelineId: draft.pipelineId || null,
        stage: draft.stage || "",
        createOpportunity: Boolean(draft.createOpportunity),
        active: draft.active !== false,
      });
      setMappings((cur) => {
        const next = res.data as FbMapping;
        const idx = cur.findIndex((m) => String(m.formId) === String(next.formId));
        if (idx >= 0) { const copy = [...cur]; copy[idx] = next; return copy; }
        return [next, ...cur];
      });
      setSuccess(`Mapping saved for ${form.name || form.id}.`);
      return true;
    } catch (err: any) {
      setError(errMsg(err, "Could not save form mapping."));
      return false;
    }
  };

  const retryWebhook = async (eventId?: string | null) => {
    if (!eventId) return;
    setError(""); setSuccess("");
    try {
      const res = await api.post(`/api/webhook-events/${eventId}/replay`);
      await loadMappings(pageId);
      loadImports(pageId);
      setSuccess(res.data?.message || "Webhook retry completed.");
    } catch (err: any) {
      setError(errMsg(err, "Could not retry the failed Facebook lead import."));
    }
  };

  /* ─── Render ───────────────────────────────────────────────────────────── */
  return (
    <SafeAreaView style={styles.root} edges={[]}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        {/* Header */}
        <View style={styles.card}>
          <Text style={styles.tagline}>Meta Lead Ads</Text>
          <Text style={styles.heading}>Facebook Lead Assignment</Text>
          <Text style={styles.subheading}>
            Map each form to an owner, tag, and pipeline. New leads import automatically once the
            webhook is active.
          </Text>
          <View style={styles.headerBtns}>
            <TouchableOpacity
              style={[styles.outlineBtn, loadingPages && styles.btnDisabled]}
              onPress={loadPages}
              disabled={loadingPages}
            >
              {loadingPages ? (
                <ActivityIndicator size="small" color="#1d4ed8" />
              ) : (
                <View style={styles.btnInner}>
                  <Ionicons name="refresh-outline" size={16} color="#1d4ed8" />
                  <Text style={styles.outlineBtnText}>Refresh pages</Text>
                </View>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.darkBtn, syncingKey === "all" && styles.btnDisabled]}
              onPress={syncAll}
              disabled={syncingKey === "all" || !pageId}
            >
              {syncingKey === "all" ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <View style={styles.btnInner}>
                  <Ionicons name="cloud-download-outline" size={16} color="#fff" />
                  <Text style={styles.darkBtnText}>Sync all forms</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>
        </View>

        {!!error && (
          <View style={styles.errorBanner}>
            <Ionicons name="alert-circle-outline" size={18} color="#dc2626" style={{ marginTop: 1 }} />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}
        {!!success && (
          <View style={styles.successBanner}>
            <Ionicons name="checkmark-circle-outline" size={18} color="#047857" style={{ marginTop: 1 }} />
            <Text style={styles.successText}>{success}</Text>
          </View>
        )}

        {/* Page selector + webhook */}
        <View style={styles.card}>
          <Text style={styles.pickerLabel}>Facebook Page</Text>
          {loadingPages ? (
            <View style={styles.loadingRow}>
              <ActivityIndicator color="#1d4ed8" />
              <Text style={styles.loadingText}>Loading pages…</Text>
            </View>
          ) : pages.length === 0 ? (
            <View style={styles.pickerBox}>
              <Text style={styles.pickerPlaceholder}>No pages connected — tap Refresh pages</Text>
            </View>
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pickerChips}>
              {pages.map((p) => {
                const active = String(pageId) === String(p.id);
                return (
                  <TouchableOpacity
                    key={p.id}
                    style={[styles.chip, active && styles.chipActive]}
                    onPress={() => setPageId(p.id)}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.chipText, active && styles.chipTextActive]}>{p.name || p.id}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          )}

          <Text style={[styles.pickerLabel, { marginTop: 16 }]}>Per-form sync limit (max 500)</Text>
          <TextInput
            style={styles.limitInput}
            value={limit}
            onChangeText={setLimit}
            keyboardType="number-pad"
            maxLength={3}
            placeholder="100"
            placeholderTextColor="#94a3b8"
          />

          {/* Webhook status */}
          {webhookActive ? (
            <View style={styles.webhookOk}>
              <View style={styles.btnInner}>
                <Ionicons name="checkmark-circle" size={16} color="#047857" />
                <Text style={styles.webhookOkTitle}>Lead webhook active</Text>
              </View>
              <Text style={styles.webhookOkBody}>New leads from this Page import automatically.</Text>
            </View>
          ) : (
            <View style={styles.webhookBox}>
              <TouchableOpacity
                style={[styles.darkBtn, styles.fullBtn, (!pageId || subscribing) && styles.btnDisabled]}
                onPress={subscribePage}
                disabled={!pageId || subscribing}
              >
                {subscribing ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <View style={styles.btnInner}>
                    <Ionicons name="flash-outline" size={16} color="#fff" />
                    <Text style={styles.darkBtnText}>Activate lead webhook</Text>
                  </View>
                )}
              </TouchableOpacity>
              <Text style={styles.webhookHint}>
                After activation, new form leads come into the CRM automatically. Use Sync only to import
                older leads.
              </Text>
            </View>
          )}
          {!!selectedPage?.leadgenSubscribeError && (
            <Text style={styles.subError}>Last activation failed: {selectedPage.leadgenSubscribeError}</Text>
          )}
        </View>

        {/* Forms list */}
        <View style={styles.card}>
          <View style={styles.rowBetween}>
            <Text style={styles.sectionTitle}>Forms</Text>
            <Text style={styles.mutedSmall}>{filteredForms.length} of {forms.length}</Text>
          </View>
          <TextInput
            style={[styles.limitInput, { width: "100%", marginTop: 10 }]}
            value={search}
            onChangeText={setSearch}
            placeholder="Search form name or ID"
            placeholderTextColor="#94a3b8"
          />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
            {STATUS_FILTERS.map((f) => {
              const active = statusFilter === f.key;
              return (
                <TouchableOpacity
                  key={f.key}
                  style={[styles.filterChip, active && styles.filterChipActive]}
                  onPress={() => setStatusFilter(f.key)}
                >
                  <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>{f.label}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {loadingForms ? (
            <View style={styles.loadingRow}>
              <ActivityIndicator color="#1d4ed8" />
              <Text style={styles.loadingText}>Loading forms…</Text>
            </View>
          ) : filteredForms.length === 0 ? (
            <Text style={styles.emptyText}>{pageId ? "No forms match this filter." : "Select a page to load forms."}</Text>
          ) : (
            <View style={{ marginTop: 8 }}>
              {filteredForms.map((form) => {
                const mapping = mappingByFormId.get(String(form.id));
                return (
                  <TouchableOpacity
                    key={form.id}
                    style={styles.formRow}
                    activeOpacity={0.7}
                    onPress={() => setModalFormId(form.id)}
                  >
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={styles.formName} numberOfLines={1}>{form.name || form.id}</Text>
                      <Text style={styles.formId} numberOfLines={1}>ID: {form.id}</Text>
                      <View style={styles.badgeRow}>
                        <Badge tone={mapping ? "emerald" : "amber"}>{mapping ? "Mapped" : "Unmapped"}</Badge>
                        {!!mapping?.lastWebhookError && <Badge tone="red">Error</Badge>}
                        <Text style={styles.importedText}>Imported: {mapping?.importedCount ?? 0}</Text>
                      </View>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color="#94a3b8" />
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </View>

        {/* Sync result */}
        {result && (
          <View style={[styles.card, styles.resultCard]}>
            <Text style={styles.resultTitle}>Sync result</Text>
            <View style={styles.metricsGrid}>
              <Metric label="Fetched" value={result.fetched} />
              <Metric label="Created" value={result.created} />
              <Metric label="Updated" value={result.updated} />
              <Metric label="Skipped" value={result.skipped} />
            </View>
            {Array.isArray(result.warnings) && result.warnings.length > 0 && (
              <View style={styles.warningBox}>
                {result.warnings.map((w, i) => <Text key={i} style={styles.warningText}>{w}</Text>)}
              </View>
            )}
          </View>
        )}

        {/* Import history */}
        <View style={styles.card}>
          <Text style={styles.tagline}>Import history</Text>
          <Text style={styles.sectionTitle}>Recent Facebook leads</Text>
          {imports.length === 0 ? (
            <Text style={styles.emptyText}>No imported leads yet.</Text>
          ) : (
            <View style={{ marginTop: 8 }}>
              {imports.map((item) => (
                <View key={String(item.id)} style={styles.importRow}>
                  <Text style={styles.importName} numberOfLines={1}>
                    {item.contactName || item.contactPhone || item.contactEmail || "Facebook Lead"}
                  </Text>
                  <Text style={styles.importMeta} numberOfLines={1}>
                    {[item.contactPhone, item.contactEmail].filter(Boolean).join(" · ") || item.metaLeadId}
                  </Text>
                  <View style={styles.rowBetween}>
                    <Text style={styles.importMeta} numberOfLines={1}>
                      {item.formName || item.formId || "Unknown form"}
                    </Text>
                    <Text style={styles.importDate}>{formatDate(item.importedAt)}</Text>
                  </View>
                  {item.matchedExistingContact && <Badge tone="amber">Existing contact updated</Badge>}
                </View>
              ))}
            </View>
          )}
        </View>

        <View style={{ height: 32 }} />
      </ScrollView>

      {/* Mapping modal */}
      <MappingModal
        visible={!!modalForm}
        form={modalForm}
        mapping={modalForm ? mappingByFormId.get(String(modalForm.id)) : undefined}
        pipelines={activePipelines}
        users={users}
        syncing={syncingKey === (modalForm?.id || "")}
        onClose={() => setModalFormId("")}
        onSave={async (form, draft) => { const ok = await saveMapping(form, draft); if (ok) setModalFormId(""); }}
        onSync={syncForm}
        onRetryWebhook={retryWebhook}
      />
    </SafeAreaView>
  );
}

/* ─── Mapping modal ──────────────────────────────────────────────────────── */
function MappingModal({
  visible, form, mapping, pipelines, users, syncing, onClose, onSave, onSync, onRetryWebhook,
}: {
  visible: boolean;
  form: FbForm | null;
  mapping?: FbMapping;
  pipelines: Pipeline[];
  users: UserRow[];
  syncing: boolean;
  onClose: () => void;
  onSave: (form: FbForm, draft: MappingDraft) => void;
  onSync: (form: FbForm) => void;
  onRetryWebhook: (eventId?: string | null) => void;
}) {
  const recommendedTag = slugify(form?.name || (form ? `form-${form.id}` : ""));
  const [draft, setDraft] = useState<MappingDraft>(() => draftFromMapping(mapping, recommendedTag));
  const [stages, setStages] = useState<Stage[]>([]);
  const [saving, setSaving] = useState(false);

  // Reset the draft whenever a different form/mapping opens.
  useEffect(() => {
    if (visible) setDraft(draftFromMapping(mapping, recommendedTag));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, form?.id]);

  // Load stages for the selected pipeline.
  useEffect(() => {
    let cancelled = false;
    if (!draft.pipelineId) { setStages([]); return; }
    api.get("/api/crm-config/pipeline-stages", { params: { pipelineId: draft.pipelineId } })
      .then((res) => { if (!cancelled) setStages(asArray<Stage>(res.data)); })
      .catch(() => { if (!cancelled) setStages([]); });
    return () => { cancelled = true; };
  }, [draft.pipelineId]);

  if (!form) return null;
  const set = (patch: Partial<MappingDraft>) => setDraft((c) => ({ ...c, ...patch }));

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalCard}>
          <View style={styles.modalHeader}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.tagline}>Form mapping</Text>
              <Text style={styles.modalTitle} numberOfLines={1}>{form.name || form.id}</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={20} color="#475569" />
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={styles.modalBody} keyboardShouldPersistTaps="handled">
            {/* Status pills */}
            <View style={styles.badgeRow}>
              <Badge tone={mapping ? "emerald" : "amber"}>{mapping ? "Mapped" : "Imports to owner"}</Badge>
              <Text style={styles.importedText}>Imported: {mapping?.importedCount ?? 0}</Text>
            </View>
            <Text style={styles.formId}>Form ID: {form.id}</Text>

            {/* Webhook error + retry */}
            {!!mapping?.lastWebhookError && (
              <View style={styles.webhookErrBox}>
                <Text style={styles.webhookErrTitle}>Last webhook failed</Text>
                <Text style={styles.webhookErrBody}>{mapping.lastWebhookError}</Text>
                {!!mapping.lastWebhookEventId && (
                  <TouchableOpacity
                    style={styles.retryBtn}
                    onPress={() => onRetryWebhook(mapping.lastWebhookEventId)}
                  >
                    <Ionicons name="refresh-outline" size={14} color="#dc2626" />
                    <Text style={styles.retryText}>Retry failed import</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}

            {/* Tag */}
            <Text style={styles.fieldLabel}>Tag</Text>
            <TextInput
              style={styles.fieldInput}
              value={draft.tag}
              onChangeText={(t) => set({ tag: t })}
              placeholder={recommendedTag}
              placeholderTextColor="#94a3b8"
              autoCapitalize="none"
            />

            {/* Owner */}
            <Text style={styles.fieldLabel}>Owner</Text>
            <OptionChips
              options={[{ value: "", label: "Assignment rules" }, ...users.map((u) => ({ value: String(u.id), label: u.email || String(u.id) }))]}
              value={draft.ownerUserId}
              onChange={(v) => set({ ownerUserId: v })}
            />

            {/* Pipeline */}
            <Text style={styles.fieldLabel}>Pipeline</Text>
            <OptionChips
              options={[{ value: "", label: "Contact only" }, ...pipelines.map((p) => ({ value: String(p.id), label: p.name || String(p.id) }))]}
              value={draft.pipelineId}
              onChange={(v) => set({ pipelineId: v, stage: "" })}
            />

            {/* Stage */}
            {!!draft.pipelineId && (
              <>
                <Text style={styles.fieldLabel}>Stage</Text>
                <OptionChips
                  options={[{ value: "", label: "First stage" }, ...stages.map((s) => ({ value: s.stageKey || "", label: s.label || s.stageKey || "" }))]}
                  value={draft.stage}
                  onChange={(v) => set({ stage: v })}
                />
              </>
            )}

            {/* Toggles */}
            <View style={styles.toggleRow}>
              <Text style={styles.toggleLabel}>Create opportunity on import</Text>
              <Switch
                value={draft.createOpportunity}
                onValueChange={(v) => set({ createOpportunity: v })}
                trackColor={{ true: "#1d4ed8", false: "#cbd5e1" }}
              />
            </View>
            <View style={styles.toggleRow}>
              <Text style={styles.toggleLabel}>Mapping active</Text>
              <Switch
                value={draft.active}
                onValueChange={(v) => set({ active: v })}
                trackColor={{ true: "#1d4ed8", false: "#cbd5e1" }}
              />
            </View>

            {/* Actions */}
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.outlineBtn, styles.flex1, syncing && styles.btnDisabled]}
                onPress={() => onSync(form)}
                disabled={syncing}
              >
                {syncing ? (
                  <ActivityIndicator size="small" color="#1d4ed8" />
                ) : (
                  <View style={styles.btnInner}>
                    <Ionicons name="cloud-download-outline" size={16} color="#1d4ed8" />
                    <Text style={styles.outlineBtnText}>Sync form</Text>
                  </View>
                )}
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.darkBtn, styles.flex1, saving && styles.btnDisabled]}
                onPress={async () => { setSaving(true); await onSave(form, draft); setSaving(false); }}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <View style={styles.btnInner}>
                    <Ionicons name="save-outline" size={16} color="#fff" />
                    <Text style={styles.darkBtnText}>Save mapping</Text>
                  </View>
                )}
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

/* ─── Small components ───────────────────────────────────────────────────── */
function Badge({ tone, children }: { tone: "emerald" | "amber" | "red"; children: React.ReactNode }) {
  const map = {
    emerald: { bg: "#ecfdf5", fg: "#047857" },
    amber: { bg: "#fffbeb", fg: "#b45309" },
    red: { bg: "#fef2f2", fg: "#dc2626" },
  }[tone];
  return (
    <View style={[styles.badge, { backgroundColor: map.bg }]}>
      <Text style={[styles.badgeText, { color: map.fg }]}>{children}</Text>
    </View>
  );
}

function Metric({ label, value }: { label: string; value?: number }) {
  return (
    <View style={styles.metric}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={styles.metricValue}>{value ?? 0}</Text>
    </View>
  );
}

function OptionChips({
  options, value, onChange,
}: { options: { value: string; label: string }[]; value: string; onChange: (v: string) => void }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pickerChips}>
      {options.map((opt) => {
        const active = String(value) === String(opt.value);
        return (
          <TouchableOpacity
            key={opt.value || "__none"}
            style={[styles.chip, active && styles.chipActive]}
            onPress={() => onChange(opt.value)}
            activeOpacity={0.8}
          >
            <Text style={[styles.chipText, active && styles.chipTextActive]} numberOfLines={1}>{opt.label}</Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

/* ─── Styles ─────────────────────────────────────────────────────────────── */
const mediumFont = Platform.OS === "android" ? "sans-serif-medium" : undefined;
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#f1f5f9" },
  scroll: { padding: 16, gap: 12 },

  card: {
    backgroundColor: "#fff", borderRadius: 14, padding: 16,
    shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 2,
  },

  tagline: { fontSize: 11, fontWeight: "600", color: "#6b7280", letterSpacing: 0.8, textTransform: "uppercase", marginBottom: 4, fontFamily: mediumFont },
  heading: { fontSize: 19, fontWeight: "600", color: "#111827", letterSpacing: Platform.OS === "ios" ? -0.4 : 0, fontFamily: mediumFont },
  subheading: { fontSize: 13, color: "#64748b", lineHeight: 20, marginTop: 4 },

  headerBtns: { flexDirection: "row", gap: 8, marginTop: 12, flexWrap: "wrap" },
  btnInner: { flexDirection: "row", alignItems: "center", gap: 6 },
  outlineBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6,
    borderRadius: 8, borderWidth: 1, borderColor: "#bfdbfe", backgroundColor: "#eff6ff",
    paddingHorizontal: 14, paddingVertical: 10,
  },
  outlineBtnText: { fontSize: 13, fontWeight: "600", color: "#1d4ed8", fontFamily: mediumFont },
  darkBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6,
    borderRadius: 8, backgroundColor: "#0f172a", paddingHorizontal: 14, paddingVertical: 10,
  },
  darkBtnText: { fontSize: 13, fontWeight: "600", color: "#fff", fontFamily: mediumFont },
  fullBtn: { width: "100%", paddingVertical: 12 },
  flex1: { flex: 1 },
  btnDisabled: { opacity: 0.5 },

  errorBanner: { flexDirection: "row", alignItems: "flex-start", gap: 8, backgroundColor: "#fef2f2", borderRadius: 10, borderWidth: 1, borderColor: "#fecaca", padding: 12 },
  errorText: { flex: 1, fontSize: 13, fontWeight: "600", color: "#dc2626" },
  successBanner: { flexDirection: "row", alignItems: "flex-start", gap: 8, backgroundColor: "#ecfdf5", borderRadius: 10, borderWidth: 1, borderColor: "#a7f3d0", padding: 12 },
  successText: { flex: 1, fontSize: 13, fontWeight: "600", color: "#047857" },
  subError: { fontSize: 12, fontWeight: "600", color: "#dc2626", marginTop: 10 },

  loadingRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 8 },
  loadingText: { fontSize: 13, color: "#64748b" },

  pickerLabel: { fontSize: 12, fontWeight: "700", color: "#475569", letterSpacing: 0.4, textTransform: "uppercase" },
  pickerBox: { borderWidth: 1, borderColor: "#e2e8f0", borderRadius: 8, padding: 12, backgroundColor: "#f8fafc", marginTop: 6 },
  pickerPlaceholder: { fontSize: 13, color: "#94a3b8" },
  pickerChips: { flexDirection: "row", gap: 8, paddingVertical: 6 },
  chip: { borderRadius: 8, borderWidth: 1, borderColor: "#bfdbfe", backgroundColor: "#eff6ff", paddingHorizontal: 14, paddingVertical: 8, maxWidth: 220 },
  chipActive: { backgroundColor: "#1d4ed8", borderColor: "#1d4ed8" },
  chipText: { fontSize: 13, fontWeight: "600", color: "#1d4ed8" },
  chipTextActive: { color: "#fff" },

  limitInput: { borderWidth: 1, borderColor: "#e2e8f0", borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: "#0f172a", backgroundColor: "#f8fafc", width: 120, marginTop: 6 },

  webhookOk: { marginTop: 16, backgroundColor: "#ecfdf5", borderRadius: 10, borderWidth: 1, borderColor: "#a7f3d0", padding: 12 },
  webhookOkTitle: { fontSize: 13.5, fontWeight: "700", color: "#047857", fontFamily: mediumFont },
  webhookOkBody: { fontSize: 12, color: "#059669", marginTop: 4 },
  webhookBox: { marginTop: 16, borderWidth: 1, borderColor: "#e2e8f0", borderRadius: 10, padding: 12 },
  webhookHint: { fontSize: 12, color: "#64748b", lineHeight: 18, marginTop: 8 },

  rowBetween: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  sectionTitle: { fontSize: 16, fontWeight: "600", color: "#111827", fontFamily: mediumFont },
  mutedSmall: { fontSize: 12, color: "#94a3b8", fontWeight: "600" },

  filterRow: { flexDirection: "row", gap: 8, paddingVertical: 10 },
  filterChip: { borderRadius: 20, backgroundColor: "#f1f5f9", paddingHorizontal: 14, paddingVertical: 7 },
  filterChipActive: { backgroundColor: "#1d4ed8" },
  filterChipText: { fontSize: 12.5, fontWeight: "700", color: "#475569" },
  filterChipTextActive: { color: "#fff" },

  emptyText: { fontSize: 13, color: "#94a3b8", paddingVertical: 14, textAlign: "center" },

  formRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 12, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: "#e2e8f0" },
  formName: { fontSize: 14.5, fontWeight: "700", color: "#0f172a" },
  formId: { fontSize: 11.5, color: "#94a3b8", marginTop: 2 },
  badgeRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 6, flexWrap: "wrap" },
  importedText: { fontSize: 11.5, fontWeight: "600", color: "#64748b" },

  badge: { borderRadius: 20, paddingHorizontal: 8, paddingVertical: 2 },
  badgeText: { fontSize: 10, fontWeight: "800", textTransform: "uppercase", letterSpacing: 0.3 },

  resultCard: { borderWidth: 1, borderColor: "#bbf7d0" },
  resultTitle: { fontSize: 15, fontWeight: "600", color: "#111827", marginBottom: 12, fontFamily: mediumFont },
  metricsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  metric: { flex: 1, minWidth: "40%", backgroundColor: "#f8fafc", borderRadius: 10, borderWidth: 1, borderColor: "#e2e8f0", padding: 12 },
  metricLabel: { fontSize: 10.5, fontWeight: "600", color: "#6b7280", textTransform: "uppercase", letterSpacing: 0.8 },
  metricValue: { fontSize: 24, fontWeight: "700", color: "#111827", marginTop: 4, fontFamily: mediumFont },
  warningBox: { marginTop: 12, backgroundColor: "#fffbeb", borderRadius: 8, padding: 10, gap: 4 },
  warningText: { fontSize: 12, fontWeight: "600", color: "#92400e" },

  importRow: { paddingVertical: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: "#e2e8f0", gap: 3 },
  importName: { fontSize: 14, fontWeight: "700", color: "#0f172a" },
  importMeta: { fontSize: 12, color: "#64748b", flex: 1 },
  importDate: { fontSize: 11.5, color: "#94a3b8", marginLeft: 8 },

  /* Modal */
  modalOverlay: { flex: 1, backgroundColor: "rgba(15,23,42,0.5)", justifyContent: "flex-end" },
  modalCard: { backgroundColor: "#fff", borderTopLeftRadius: 18, borderTopRightRadius: 18, maxHeight: "92%" },
  modalHeader: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 16, paddingTop: 16, paddingBottom: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: "#e2e8f0" },
  modalTitle: { fontSize: 17, fontWeight: "700", color: "#0f172a", marginTop: 2 },
  closeBtn: { padding: 6, borderRadius: 8, backgroundColor: "#f1f5f9" },
  modalBody: { padding: 16, gap: 4 },

  webhookErrBox: { marginTop: 12, backgroundColor: "#fef2f2", borderRadius: 10, borderWidth: 1, borderColor: "#fecaca", padding: 12 },
  webhookErrTitle: { fontSize: 13, fontWeight: "800", color: "#dc2626" },
  webhookErrBody: { fontSize: 12.5, color: "#b91c1c", marginTop: 4 },
  retryBtn: { flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start", marginTop: 10, borderWidth: 1, borderColor: "#fecaca", backgroundColor: "#fff", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
  retryText: { fontSize: 12, fontWeight: "700", color: "#dc2626" },

  fieldLabel: { fontSize: 12, fontWeight: "700", color: "#475569", textTransform: "uppercase", letterSpacing: 0.4, marginTop: 14 },
  fieldInput: { borderWidth: 1, borderColor: "#e2e8f0", borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: "#0f172a", backgroundColor: "#f8fafc", marginTop: 6 },

  toggleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 16 },
  toggleLabel: { fontSize: 14, fontWeight: "600", color: "#334155", flex: 1, marginRight: 10 },

  modalActions: { flexDirection: "row", gap: 10, marginTop: 22 },
});
