import { useEffect, useMemo, useState } from "react";
import { Loader2, Send, X } from "lucide-react";
import api from "../../api/axios";

const readyForWhatsApp = (flow) =>
  flow?.status === "PUBLISHED" &&
  flow?.metaFlowId &&
  !String(flow.metaFlowId).startsWith("local-flow-");

export default function SendWhatsAppFlowModal({ open, contact, contextLabel = "", onClose, onSent }) {
  const [flows, setFlows] = useState([]);
  const [form, setForm] = useState({ flowId: "", body: "", ctaText: "Open form" });
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  const sendableFlows = useMemo(() => flows.filter(readyForWhatsApp), [flows]);
  const selectedFlow = flows.find((flow) => String(flow.id) === String(form.flowId));

  useEffect(() => {
    if (!open) return;
    let alive = true;
    setLoading(true);
    setError("");
    api.get("/api/whatsapp-flows", { params: { status: "PUBLISHED" } })
      .then((response) => {
        if (!alive) return;
        const rows = Array.isArray(response.data) ? response.data : [];
        setFlows(rows);
        const firstReady = rows.find(readyForWhatsApp);
        setForm((current) => ({
          ...current,
          flowId: current.flowId || (firstReady?.id ? String(firstReady.id) : ""),
          body: current.body || (firstReady?.name ? `Please complete this quick form: ${firstReady.name}` : ""),
        }));
      })
      .catch((err) => {
        if (!alive) return;
        setFlows([]);
        setError(err?.response?.data?.message || "Could not load published WhatsApp Flows.");
      })
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [open]);

  useEffect(() => {
    if (!open) {
      setForm({ flowId: "", body: "", ctaText: "Open form" });
      setError("");
    }
  }, [open]);

  const submit = async (event) => {
    event.preventDefault();
    if (!contact?.id || !form.flowId) return;
    setSending(true);
    setError("");
    try {
      const response = await api.post("/api/messages/send-whatsapp/flow", {
        contactId: contact.id,
        flowId: Number(form.flowId),
        body: form.body.trim() || null,
        ctaText: form.ctaText.trim() || null,
      });
      if (response.data?.status === "FAILED") {
        setError(response.data?.errorMessage || "Meta rejected this Flow message.");
        return;
      }
      onSent?.(response.data);
      onClose?.();
    } catch (err) {
      setError(err?.response?.data?.message || err?.response?.data?.error || err.message || "Could not send WhatsApp Flow.");
    } finally {
      setSending(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-2xl rounded-2xl bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-3 border-b border-slate-100 p-5">
          <div>
            <h2 className="text-lg font-extrabold text-slate-950">Send WhatsApp Flow</h2>
            <p className="mt-1 text-sm text-slate-500">
              {contact?.name || contact?.phone || "Selected contact"}{contextLabel ? ` - ${contextLabel}` : ""}
            </p>
          </div>
          <button type="button" onClick={onClose} className="rounded-xl p-2 text-slate-500 hover:bg-slate-100" aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={submit} className="space-y-4 p-5">
          {error && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{error}</div>}

          {loading ? (
            <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm font-semibold text-slate-500">
              <Loader2 className="animate-spin" size={16} /> Loading published flows...
            </div>
          ) : (
            <>
              <label className="block">
                <span className="text-xs font-bold uppercase tracking-wide text-slate-500">Published Flow</span>
                <select
                  value={form.flowId}
                  onChange={(event) => {
                    const flow = flows.find((item) => String(item.id) === event.target.value);
                    setForm((current) => ({
                      ...current,
                      flowId: event.target.value,
                      body: current.body || (flow?.name ? `Please complete this quick form: ${flow.name}` : ""),
                    }));
                  }}
                  className="mt-1 min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
                >
                  <option value="">Select Flow</option>
                  {flows.map((flow) => (
                    <option key={flow.id} value={flow.id} disabled={!readyForWhatsApp(flow)}>
                      {flow.name}{readyForWhatsApp(flow) ? "" : " - connect Meta Flow ID first"}
                    </option>
                  ))}
                </select>
              </label>

              {sendableFlows.length === 0 && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">
                  No send-ready Flow found. Publish a Flow and link a real Meta Flow ID before sending.
                </div>
              )}

              {selectedFlow && !readyForWhatsApp(selectedFlow) && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">
                  This Flow is published in CRM but not connected to a real Meta Flow ID yet.
                </div>
              )}

              <label className="block">
                <span className="text-xs font-bold uppercase tracking-wide text-slate-500">Message Text</span>
                <textarea
                  rows={3}
                  value={form.body}
                  onChange={(event) => setForm((current) => ({ ...current, body: event.target.value }))}
                  placeholder="Short message shown above the Flow button"
                  className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm leading-6 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
                />
              </label>

              <label className="block">
                <span className="text-xs font-bold uppercase tracking-wide text-slate-500">Button Text</span>
                <input
                  value={form.ctaText}
                  onChange={(event) => setForm((current) => ({ ...current, ctaText: event.target.value }))}
                  placeholder="Open form"
                  className="mt-1 min-h-11 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
                />
              </label>
            </>
          )}

          <div className="flex flex-wrap justify-end gap-2 border-t border-slate-100 pt-4">
            <button type="button" onClick={onClose} className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50">
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || sending || !contact?.id || !readyForWhatsApp(selectedFlow)}
              className="inline-flex items-center gap-2 rounded-xl bg-teal-700 px-4 py-2 text-sm font-bold text-white hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {sending ? <Loader2 className="animate-spin" size={16} /> : <Send size={16} />}
              {sending ? "Sending..." : "Send Flow"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
