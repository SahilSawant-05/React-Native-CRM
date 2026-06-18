import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/axios";

const CONVERSATION_OPTIONS = ["", "OPEN", "CLOSED"];
const LEAD_SOURCE_OPTIONS = ["", "WHATSAPP", "EMAIL", "WEBSITE", "FACEBOOK", "INSTAGRAM", "GOOGLE_ADS", "CSV_IMPORT", "REFERRAL", "MANUAL"];
const INDUSTRY_OPTIONS = ["", "REAL_ESTATE", "EDUCATION", "BIKE_SALES", "GENERIC"];

const FILTER_DEFS = [
  { key: "pipelineId", label: "Pipeline" },
  { key: "stage", label: "Pipeline Stage" },
  { key: "leadSource", label: "Lead Source" },
  { key: "industryKey", label: "Industry" },
  { key: "city", label: "City" },
  { key: "tag", label: "Tag" },
  { key: "query", label: "Contact Search" },
  { key: "assignedUserId", label: "Owner" },
  { key: "conversationStatus", label: "Conversation Status" },
];

const blankForm = {
  name: "",
  pipelineId: "",
  query: "",
  tag: "",
  stage: "",
  leadSource: "",
  industryKey: "",
  city: "",
  assignedUserId: "",
  conversationStatus: "",
};

const labelFor = (value) => String(value || "").replaceAll("_", " ");

const normalizeList = (payload) => {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.items)) return payload.items;
  if (Array.isArray(payload?.content)) return payload.content;
  return [];
};

function formatDateTime(value) {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return value;
  }
}

export default function Segments() {
  const navigate = useNavigate();
  const [segments, setSegments] = useState([]);
  const [users, setUsers] = useState([]);
  const [pipelines, setPipelines] = useState([]);
  const [stages, setStages] = useState([]);
  const [previewCounts, setPreviewCounts] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveAndUseSaving, setSaveAndUseSaving] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [form, setForm] = useState(blankForm);
  const [filterRows, setFilterRows] = useState(["stage"]);
  const [editingId, setEditingId] = useState(null);
  const [preview, setPreview] = useState({ loading: false, count: null, contacts: [], error: "" });
  const [contactsModal, setContactsModal] = useState({ open: false, segment: null, contacts: [], loading: false, error: "" });

  const buildPayload = useCallback(() => ({
    name: form.name.trim() || "Draft segment",
    pipelineId: form.pipelineId ? Number(form.pipelineId) : null,
    query: form.query.trim() || null,
    tag: form.tag.trim() || null,
    stage: form.stage || null,
    leadSource: form.leadSource || null,
    industryKey: form.industryKey || null,
    city: form.city.trim() || null,
    assignedUserId: form.assignedUserId ? Number(form.assignedUserId) : null,
    conversationStatus: form.conversationStatus || null,
  }), [form]);

  const visibleFilterKeys = filterRows.length > 0 ? filterRows : ["stage"];
  const hasAllFiltersVisible = visibleFilterKeys.length >= FILTER_DEFS.length;

  useEffect(() => {
    const hasAnyFilter = FILTER_DEFS.some((filter) => form[filter.key]);
    if (!hasAnyFilter) {
      setPreview({ loading: false, count: null, contacts: [], error: "" });
      return;
    }

    let cancelled = false;
    setPreview((current) => ({ ...current, loading: true, error: "" }));
    const timer = setTimeout(async () => {
      try {
        const response = await api.post("/api/segments/preview", buildPayload());
        if (cancelled) return;
        setPreview({
          loading: false,
          count: response.data?.matchCount ?? 0,
          contacts: Array.isArray(response.data?.sampleContacts) ? response.data.sampleContacts : [],
          error: "",
        });
      } catch (err) {
        if (cancelled) return;
        setPreview({
          loading: false,
          count: null,
          contacts: [],
          error: err.response?.data?.error || err.message || "Preview failed",
        });
      }
    }, 400);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [buildPayload, form]);

  const loadSegments = async () => {
    setLoading(true);
    setError("");
    try {
      const [segmentRes, usersRes, pipelinesRes] = await Promise.allSettled([
        api.get("/api/segments"),
        api.get("/api/users"),
        api.get("/api/pipelines"),
      ]);

      if (segmentRes.status !== "fulfilled") {
        throw new Error(segmentRes.reason?.response?.data?.error || "Failed to load segments");
      }

      const segmentRows = Array.isArray(segmentRes.value.data) ? segmentRes.value.data : [];
      setSegments(segmentRows);

      if (usersRes.status === "fulfilled") {
        setUsers(Array.isArray(usersRes.value.data) ? usersRes.value.data : []);
      } else {
        setUsers([]);
      }
      setPipelines(pipelinesRes.status === "fulfilled" ? normalizeList(pipelinesRes.value.data) : []);
      setPreviewCounts(Object.fromEntries(segmentRows.map((segment) => [segment.id, null])));

      segmentRows.forEach(async (segment) => {
        try {
          const preview = await api.get(`/api/segments/${segment.id}/preview`);
          setPreviewCounts((prev) => ({
            ...prev,
            [segment.id]: preview.data?.matchCount ?? 0,
          }));
        } catch {
          setPreviewCounts((prev) => ({
            ...prev,
            [segment.id]: null,
          }));
        }
      });
    } catch (err) {
      setError(err.response?.data?.error || err.message || "Failed to load segments");
      setSegments([]);
      setPreviewCounts({});
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSegments();
  }, []);

  const selectedStagePipelineId = form.pipelineId
    || String(pipelines.find((pipeline) => pipeline.defaultPipeline)?.id || pipelines[0]?.id || "");

  useEffect(() => {
    let cancelled = false;
    const loadStages = async () => {
      if (!selectedStagePipelineId) {
        setStages([]);
        return;
      }
      try {
        const stagesRes = await api.get("/api/crm-config/pipeline-stages", { params: { pipelineId: selectedStagePipelineId } });
        if (!cancelled) {
          setStages(normalizeList(stagesRes.data).filter((stage) => stage.active !== false));
        }
      } catch {
        if (!cancelled) setStages([]);
      }
    };
    loadStages();
    return () => {
      cancelled = true;
    };
  }, [selectedStagePipelineId]);

  const filteredSegments = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return segments;
    return segments.filter((segment) =>
      [
        segment.name,
        segment.query,
        segment.tag,
        segment.stage,
        segment.leadSource,
        segment.industryKey,
        segment.city,
        segment.conversationStatus,
        segment.createdByUserEmail,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(q))
    );
  }, [segments, search]);

  const resetForm = () => {
    setEditingId(null);
    setForm(blankForm);
    setFilterRows(["stage"]);
  };

  const availableFilterKeys = (currentKey = "") =>
    FILTER_DEFS
      .map((filter) => filter.key)
      .filter((key) => key === currentKey || !filterRows.includes(key));

  const addFilter = () => {
    const nextKey = FILTER_DEFS.find((filter) => !filterRows.includes(filter.key))?.key;
    if (!nextKey) return;
    setFilterRows((current) => [...current, nextKey]);
    setForm((current) => ({ ...current, [nextKey]: defaultFilterValue(nextKey, stages, users, pipelines) }));
  };

  const removeFilter = (key) => {
    setForm((current) => ({ ...current, [key]: "" }));
    setFilterRows((current) => {
      const next = current.filter((item) => item !== key);
      return next.length > 0 ? next : ["stage"];
    });
  };

  const changeFilterKey = (oldKey, newKey) => {
    if (oldKey === newKey) return;
    setFilterRows((current) => current.map((key) => (key === oldKey ? newKey : key)));
    setForm((current) => ({
      ...current,
      [oldKey]: "",
      [newKey]: current[newKey] || defaultFilterValue(newKey, stages, users, pipelines),
    }));
  };

  const setFilterValue = (key, value) => {
    setForm((current) => {
      const next = { ...current, [key]: value };
      if (key === "pipelineId") {
        next.stage = "";
      }
      if (key === "stage" && value && !next.pipelineId && selectedStagePipelineId) {
        next.pipelineId = String(selectedStagePipelineId);
        if (!filterRows.includes("pipelineId")) {
          setFilterRows((rows) => ["pipelineId", ...rows.filter((row) => row !== "pipelineId")]);
        }
      }
      return next;
    });
  };

  const startEdit = (segment) => {
    setEditingId(segment.id);
    const keys = FILTER_DEFS.map((filter) => filter.key).filter((key) => segment[key]);
    setFilterRows(keys.length > 0 ? keys : ["stage"]);
    setForm({
      name: segment.name || "",
      pipelineId: segment.pipelineId ? String(segment.pipelineId) : "",
      query: segment.query || "",
      tag: segment.tag || "",
      stage: segment.stage || "",
      leadSource: segment.leadSource || "",
      industryKey: segment.industryKey || "",
      city: segment.city || "",
      assignedUserId: segment.assignedUserId ? String(segment.assignedUserId) : "",
      conversationStatus: segment.conversationStatus || "",
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const saveSegment = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) {
      setError("Segment name is required");
      return;
    }

    setSaving(true);
    setError("");
    const payload = buildPayload();

    try {
      if (editingId) {
        await api.put(`/api/segments/${editingId}`, payload);
      } else {
        await api.post("/api/segments", payload);
      }
      resetForm();
      await loadSegments();
    } catch (err) {
      setError(err.response?.data?.error || err.message || "Failed to save segment");
    } finally {
      setSaving(false);
    }
  };

  const deleteSegment = async (segment) => {
    if (!window.confirm(`Delete segment "${segment.name}"?`)) return;
    try {
      await api.delete(`/api/segments/${segment.id}`);
      if (editingId === segment.id) {
        resetForm();
      }
      await loadSegments();
    } catch (err) {
      setError(err.response?.data?.error || err.message || "Failed to delete segment");
    }
  };

  const openContacts = async (segment) => {
    setContactsModal({ open: true, segment, contacts: [], loading: true, error: "" });
    try {
      const res = await api.get(`/api/segments/${segment.id}/contacts`);
      setContactsModal({
        open: true,
        segment,
        contacts: Array.isArray(res.data) ? res.data : [],
        loading: false,
        error: "",
      });
    } catch (err) {
      setContactsModal({
        open: true,
        segment,
        contacts: [],
        loading: false,
        error: err.response?.data?.error || err.message || "Failed to load segment contacts",
      });
    }
  };

  return (
    <div style={{ minHeight: "100vh", background: "#f8fafc", padding: "24px", fontFamily: "'DM Sans', sans-serif" }}>
      <div style={{ maxWidth: 1280, margin: "0 auto", display: "grid", gap: 24 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, flexWrap: "wrap" }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 32, color: "#0f172a", fontWeight: 800 }}>Segments</h1>
            <p style={{ margin: "8px 0 0", color: "#475569" }}>
              Build dynamic audiences from contact filters. Matching contacts are included automatically whenever you use the segment.
            </p>
          </div>
          <button
            onClick={() => navigate("/dashboard/campaigns/create")}
            style={{
              border: "none",
              borderRadius: 12,
              background: "linear-gradient(135deg, #14b8a6, #0f766e)",
              color: "#fff",
              padding: "12px 18px",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            Open Campaign Builder
          </button>
        </div>

        {error && (
          <div style={{ padding: "12px 14px", borderRadius: 12, background: "#fef2f2", border: "1px solid #fecaca", color: "#b91c1c" }}>
            {error}
          </div>
        )}

        <div style={{ display: "grid", gridTemplateColumns: "minmax(320px, 420px) minmax(0, 1fr)", gap: 24, alignItems: "start" }}>
          <form
            onSubmit={saveSegment}
            style={{ background: "#fff", borderRadius: 20, padding: 20, border: "1px solid #e2e8f0", boxShadow: "0 18px 50px rgba(15, 23, 42, 0.05)" }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <div>
                <h2 style={{ margin: 0, fontSize: 20, color: "#0f172a" }}>{editingId ? "Edit Segment" : "Create Segment"}</h2>
                <p style={{ margin: "6px 0 0", color: "#64748b", fontSize: 14 }}>
                  Save filter rules, not manual contact lists. This segment will always resolve the latest matching audience.
                </p>
              </div>
              {editingId && (
                <button
                  type="button"
                  onClick={resetForm}
                  style={{ border: "1px solid #cbd5e1", background: "#fff", borderRadius: 10, padding: "8px 12px", cursor: "pointer" }}
                >
                  Cancel edit
                </button>
              )}
            </div>

            <div style={{ display: "grid", gap: 14 }}>
              <label style={{ display: "grid", gap: 6 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: "#334155" }}>Segment Name</span>
                <input
                  value={form.name}
                  onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                  placeholder="Qualified open leads"
                  style={inputStyle}
                />
              </label>

              <div style={{ display: "grid", gap: 10 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                  <span style={{ fontSize: 13, fontWeight: 800, color: "#334155" }}>Audience Filters</span>
                  <span style={{ fontSize: 12, color: "#64748b" }}>Match all filters</span>
                </div>
                {visibleFilterKeys.map((key) => (
                  <div key={key} style={{ display: "grid", gridTemplateColumns: "150px minmax(0, 1fr) auto", gap: 8, alignItems: "center" }}>
                    <select value={key} onChange={(event) => changeFilterKey(key, event.target.value)} style={inputStyle}>
                      {FILTER_DEFS.filter((filter) => availableFilterKeys(key).includes(filter.key)).map((filter) => (
                        <option key={filter.key} value={filter.key}>{filter.label}</option>
                      ))}
                    </select>
                    {renderFilterValue(key, form[key], {
                      stages,
                      users,
                      pipelines,
                      setValue: setFilterValue,
                    })}
                    <button
                      type="button"
                      onClick={() => removeFilter(key)}
                      disabled={!form[key]}
                      style={{
                        border: "1px solid #fecaca",
                        background: form[key] ? "#fff1f2" : "#f8fafc",
                        color: form[key] ? "#b91c1c" : "#94a3b8",
                        borderRadius: 10,
                        padding: "10px 12px",
                        cursor: form[key] ? "pointer" : "default",
                        fontWeight: 800,
                      }}
                    >
                      Remove
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={addFilter}
                  disabled={hasAllFiltersVisible}
                  style={{
                    border: "1px dashed #14b8a6",
                    background: "#f0fdfa",
                    color: "#0f766e",
                    borderRadius: 12,
                    padding: "11px 13px",
                    fontWeight: 800,
                    cursor: hasAllFiltersVisible ? "default" : "pointer",
                    opacity: hasAllFiltersVisible ? 0.6 : 1,
                  }}
                >
                  + Add Filter
                </button>
              </div>

              <PreviewPanel preview={preview} />
            </div>

            <div style={{ display: "flex", gap: 10, marginTop: 18 }}>
              <button
                type="submit"
                disabled={saving || saveAndUseSaving}
                style={{
                  border: "none",
                  borderRadius: 12,
                  background: "linear-gradient(135deg, #0f766e, #14b8a6)",
                  color: "#fff",
                  padding: "12px 16px",
                  fontWeight: 700,
                  cursor: saving || saveAndUseSaving ? "default" : "pointer",
                  opacity: saving || saveAndUseSaving ? 0.7 : 1,
                }}
              >
                {saving ? "Saving..." : editingId ? "Update Segment" : "Create Segment"}
              </button>
              <button
                type="button"
                onClick={async () => {
                  if (!form.name.trim()) {
                    setError("Segment name is required");
                    return;
                  }
                  if (saveAndUseSaving || saving) {
                    return;
                  }
                  setSaveAndUseSaving(true);
                  setError("");
                  const draft = buildPayload();
                  try {
                    const response = editingId
                      ? await api.put(`/api/segments/${editingId}`, draft)
                      : await api.post("/api/segments", draft);
                    const segment = response.data;
                    navigate(`/dashboard/campaigns/create?segmentId=${segment.id}`);
                  } catch (err) {
                    setError(err.response?.data?.error || err.message || "Failed to create segment for campaign");
                  } finally {
                    setSaveAndUseSaving(false);
                  }
                }}
                style={{
                  border: "1px solid #94a3b8",
                  borderRadius: 12,
                  background: "#fff",
                  color: "#0f172a",
                  padding: "12px 16px",
                  fontWeight: 700,
                  cursor: saveAndUseSaving || saving ? "default" : "pointer",
                  opacity: saveAndUseSaving || saving ? 0.7 : 1,
                }}
                disabled={saveAndUseSaving || saving}
              >
                {saveAndUseSaving ? "Saving..." : "Save and Use in Campaign"}
              </button>
            </div>
          </form>

          <div style={{ display: "grid", gap: 16 }}>
            <div style={{ background: "#fff", borderRadius: 20, padding: 18, border: "1px solid #e2e8f0", boxShadow: "0 18px 50px rgba(15, 23, 42, 0.05)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
                <div>
                  <h2 style={{ margin: 0, fontSize: 20, color: "#0f172a" }}>Saved Segments</h2>
                  <p style={{ margin: "6px 0 0", color: "#64748b", fontSize: 14 }}>
                    {segments.length} saved segment{segments.length !== 1 ? "s" : ""}
                  </p>
                </div>
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search segments..."
                  style={{ ...inputStyle, width: 260 }}
                />
              </div>
            </div>

            {loading ? (
              <div style={emptyCardStyle}>Loading segments...</div>
            ) : filteredSegments.length === 0 ? (
              <div style={emptyCardStyle}>No segments found yet.</div>
            ) : (
              filteredSegments.map((segment) => (
                <div
                  key={segment.id}
                  style={{
                    background: "#fff",
                    borderRadius: 20,
                    padding: 18,
                    border: "1px solid #e2e8f0",
                    boxShadow: "0 18px 50px rgba(15, 23, 42, 0.05)",
                    display: "grid",
                    gap: 14,
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
                    <div>
                      <h3 style={{ margin: 0, fontSize: 18, color: "#0f172a" }}>{segment.name}</h3>
                      <p style={{ margin: "6px 0 0", color: "#64748b", fontSize: 13 }}>
                        Created by {segment.createdByUserEmail || "Unknown"} on {formatDateTime(segment.createdAt)}
                      </p>
                    </div>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <button onClick={() => startEdit(segment)} style={miniButtonStyle}>Edit</button>
                      <button onClick={() => openContacts(segment)} style={miniButtonStyle}>View Contacts</button>
                      <button onClick={() => navigate(`/dashboard/campaigns/create?segmentId=${segment.id}`)} style={campaignButtonStyle}>
                        Use in Campaign
                      </button>
                      <button onClick={() => deleteSegment(segment)} style={dangerButtonStyle}>Delete</button>
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                    <Badge label={`Matches: ${previewCounts[segment.id] ?? "—"}`} color="#0f766e" bg="#ccfbf1" />
                    {segment.pipelineId && <Badge label={`Pipeline: ${pipelineName(pipelines, segment.pipelineId)}`} color="#1d4ed8" bg="#dbeafe" />}
                    {segment.stage && <Badge label={`Stage: ${labelFor(segment.stage)}`} color="#1d4ed8" bg="#dbeafe" />}
                    {segment.leadSource && <Badge label={`Source: ${labelFor(segment.leadSource)}`} color="#0e7490" bg="#cffafe" />}
                    {segment.industryKey && <Badge label={`Industry: ${labelFor(segment.industryKey)}`} color="#047857" bg="#d1fae5" />}
                    {segment.city && <Badge label={`City: ${segment.city}`} color="#4338ca" bg="#e0e7ff" />}
                    {segment.tag && <Badge label={`Tag: ${segment.tag}`} color="#7c3aed" bg="#ede9fe" />}
                    {segment.conversationStatus && <Badge label={`Conversation: ${segment.conversationStatus}`} color="#b45309" bg="#fef3c7" />}
                    {segment.assignedUserId && <Badge label={`Owner ID: ${segment.assignedUserId}`} color="#334155" bg="#e2e8f0" />}
                  </div>

                  <div style={{ display: "grid", gap: 8 }}>
                    <div style={{ color: "#334155", fontSize: 14 }}>
                      <strong>Audience rule:</strong> {segment.query || "Any contact matching the selected filters"}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {contactsModal.open && (
        <div
          onClick={() => setContactsModal({ open: false, segment: null, contacts: [], loading: false, error: "" })}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15, 23, 42, 0.55)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 20,
            zIndex: 50,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "min(900px, 100%)",
              maxHeight: "85vh",
              overflow: "auto",
              background: "#fff",
              borderRadius: 24,
              padding: 22,
              boxShadow: "0 30px 80px rgba(15, 23, 42, 0.2)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, marginBottom: 18 }}>
              <div>
                <h2 style={{ margin: 0, fontSize: 22, color: "#0f172a" }}>{contactsModal.segment?.name}</h2>
                <p style={{ margin: "6px 0 0", color: "#64748b" }}>Contacts currently matched by this dynamic segment.</p>
              </div>
              <button onClick={() => setContactsModal({ open: false, segment: null, contacts: [], loading: false, error: "" })} style={miniButtonStyle}>
                Close
              </button>
            </div>

            {contactsModal.loading ? (
              <div style={emptyCardStyle}>Loading segment contacts...</div>
            ) : contactsModal.error ? (
              <div style={{ ...emptyCardStyle, color: "#b91c1c", background: "#fef2f2", borderColor: "#fecaca" }}>{contactsModal.error}</div>
            ) : contactsModal.contacts.length === 0 ? (
              <div style={emptyCardStyle}>No contacts matched this segment.</div>
            ) : (
              <div style={{ display: "grid", gap: 10 }}>
                {contactsModal.contacts.map((contact) => (
                  <div
                    key={contact.id}
                    style={{
                      padding: "14px 16px",
                      borderRadius: 14,
                      border: "1px solid #e2e8f0",
                      display: "flex",
                      justifyContent: "space-between",
                      gap: 12,
                      flexWrap: "wrap",
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 700, color: "#0f172a" }}>{contact.name}</div>
                      <div style={{ color: "#64748b", fontSize: 14 }}>{contact.phone}</div>
                    </div>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      {contact.stage && <Badge label={labelFor(contact.stage)} color="#1d4ed8" bg="#dbeafe" />}
                      {contact.leadSource && <Badge label={labelFor(contact.leadSource)} color="#0e7490" bg="#cffafe" />}
                      {contact.industryKey && <Badge label={labelFor(contact.industryKey)} color="#047857" bg="#d1fae5" />}
                      {contact.city && <Badge label={contact.city} color="#4338ca" bg="#e0e7ff" />}
                      {contact.conversationStatus && <Badge label={contact.conversationStatus} color="#b45309" bg="#fef3c7" />}
                      {contact.tags && <Badge label={contact.tags} color="#7c3aed" bg="#ede9fe" />}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Badge({ label, color, bg }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "6px 10px",
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 700,
        color,
        background: bg,
      }}
    >
      {label}
    </span>
  );
}

function renderFilterValue(key, value, { stages, users, pipelines, setValue }) {
  if (key === "pipelineId") {
    return (
      <select value={value} onChange={(event) => setValue(key, event.target.value)} style={inputStyle}>
        <option value="">Any pipeline</option>
        {pipelines.map((pipeline) => (
          <option key={pipeline.id} value={pipeline.id}>
            {pipeline.name} {pipeline.defaultPipeline ? "(Default)" : ""}
          </option>
        ))}
      </select>
    );
  }
  if (key === "stage") {
    return (
      <select value={value} onChange={(event) => setValue(key, event.target.value)} style={inputStyle}>
        <option value="">Any pipeline stage</option>
        {stages.map((stage) => (
          <option key={stage.stageKey || stage.key} value={stage.stageKey || stage.key}>
            {stage.label || labelFor(stage.stageKey || stage.key)}
          </option>
        ))}
      </select>
    );
  }
  if (key === "leadSource") {
    return (
      <select value={value} onChange={(event) => setValue(key, event.target.value)} style={inputStyle}>
        {LEAD_SOURCE_OPTIONS.map((option) => (
          <option key={option || "all"} value={option}>{option ? labelFor(option) : "Any source"}</option>
        ))}
      </select>
    );
  }
  if (key === "industryKey") {
    return (
      <select value={value} onChange={(event) => setValue(key, event.target.value)} style={inputStyle}>
        {INDUSTRY_OPTIONS.map((option) => (
          <option key={option || "all"} value={option}>{option ? labelFor(option) : "Any industry"}</option>
        ))}
      </select>
    );
  }
  if (key === "assignedUserId") {
    return (
      <select value={value} onChange={(event) => setValue(key, event.target.value)} style={inputStyle}>
        <option value="">Any owner</option>
        {users.map((user) => (
          <option key={user.id} value={user.id}>{user.email} ({user.role})</option>
        ))}
      </select>
    );
  }
  if (key === "conversationStatus") {
    return (
      <select value={value} onChange={(event) => setValue(key, event.target.value)} style={inputStyle}>
        {CONVERSATION_OPTIONS.map((option) => (
          <option key={option || "all"} value={option}>{option || "Any status"}</option>
        ))}
      </select>
    );
  }

  const placeholders = {
    city: "Mumbai",
    tag: "lead",
    query: "Name or phone",
  };
  return (
    <input
      value={value}
      onChange={(event) => setValue(key, event.target.value)}
      placeholder={placeholders[key] || "Value"}
      style={inputStyle}
    />
  );
}

function PreviewPanel({ preview }) {
  return (
    <div style={{ border: "1px solid #ccfbf1", background: "#f0fdfa", borderRadius: 16, padding: 14, display: "grid", gap: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 800, color: "#115e59" }}>Live Preview</div>
          <div style={{ fontSize: 12, color: "#0f766e", marginTop: 3 }}>
            {preview.loading
              ? "Checking audience..."
              : preview.count == null
                ? "Add a filter to preview matching contacts"
                : `${preview.count} contacts matched`}
          </div>
        </div>
        {preview.count != null && (
          <div style={{ fontSize: 24, fontWeight: 900, color: "#0f766e" }}>{preview.count}</div>
        )}
      </div>
      {preview.error && (
        <div style={{ color: "#b91c1c", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 12, padding: "9px 10px", fontSize: 12 }}>
          {preview.error}
        </div>
      )}
      {preview.contacts.length > 0 && (
        <div style={{ display: "grid", gap: 6 }}>
          {preview.contacts.slice(0, 5).map((contact) => (
            <div key={contact.id} style={{ display: "flex", justifyContent: "space-between", gap: 8, borderTop: "1px solid #ccfbf1", paddingTop: 7 }}>
              <span style={{ fontSize: 12.5, fontWeight: 700, color: "#134e4a" }}>{contact.name || contact.phone}</span>
              <span style={{ fontSize: 12, color: "#0f766e" }}>{contact.phone}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function defaultFilterValue(key, stages, users, pipelines) {
  if (key === "pipelineId") return pipelines.find((pipeline) => pipeline.defaultPipeline)?.id
    ? String(pipelines.find((pipeline) => pipeline.defaultPipeline).id)
    : pipelines[0]?.id ? String(pipelines[0].id) : "";
  if (key === "stage") return stages[0]?.stageKey || stages[0]?.key || "";
  if (key === "leadSource") return "WHATSAPP";
  if (key === "industryKey") return "REAL_ESTATE";
  if (key === "assignedUserId") return users[0]?.id ? String(users[0].id) : "";
  if (key === "conversationStatus") return "OPEN";
  return "";
}

function pipelineName(pipelines, pipelineId) {
  return pipelines.find((pipeline) => String(pipeline.id) === String(pipelineId))?.name || `Pipeline #${pipelineId}`;
}

const inputStyle = {
  width: "100%",
  borderRadius: 12,
  border: "1px solid #cbd5e1",
  padding: "11px 13px",
  fontSize: 14,
  outline: "none",
  background: "#fff",
  color: "#0f172a",
  boxSizing: "border-box",
};

const miniButtonStyle = {
  border: "1px solid #cbd5e1",
  background: "#fff",
  borderRadius: 10,
  padding: "9px 12px",
  cursor: "pointer",
  fontWeight: 600,
  color: "#334155",
};

const campaignButtonStyle = {
  border: "none",
  background: "#0f766e",
  color: "#fff",
  borderRadius: 10,
  padding: "9px 12px",
  cursor: "pointer",
  fontWeight: 700,
};

const dangerButtonStyle = {
  border: "1px solid #fecaca",
  background: "#fff1f2",
  color: "#b91c1c",
  borderRadius: 10,
  padding: "9px 12px",
  cursor: "pointer",
  fontWeight: 700,
};

const emptyCardStyle = {
  background: "#fff",
  borderRadius: 20,
  padding: 22,
  border: "1px dashed #cbd5e1",
  color: "#64748b",
  textAlign: "center",
};
