import { useState } from "react";
import { Loader2, Sparkles } from "lucide-react";
import api from "../../api/axios";

function readError(error, fallback) {
  const data = error?.response?.data;
  return data?.message || data?.error || (typeof data === "string" ? data : null) || error.message || fallback;
}

export default function AiCallSummaryButton({ callId, contactId, opportunityId, compact = false, onSaved }) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [summary, setSummary] = useState("");
  const [error, setError] = useState("");

  if (!callId) return null;

  const generate = async () => {
    setLoading(true);
    setError("");
    try {
      const response = await api.post(`/api/ai/calls/${callId}/summary`);
      setSummary(response.data?.text || "No AI call summary returned.");
    } catch (err) {
      setError(readError(err, "AI call summary failed."));
    } finally {
      setLoading(false);
    }
  };

  const saveAsNote = async () => {
    if (!contactId || !summary.trim()) return;
    setSaving(true);
    setError("");
    try {
      await api.post(`/api/contacts/${contactId}/notes`, {
        note: `AI call summary:\n\n${summary.trim()}`,
        opportunityId: opportunityId || null,
      });
      onSaved?.();
    } catch (err) {
      setError(readError(err, "Could not save AI summary as note."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={compact ? "mt-2" : "mt-3"}>
      <button
        type="button"
        onClick={generate}
        disabled={loading}
        className="inline-flex items-center gap-1.5 rounded-lg border border-violet-200 bg-violet-50 px-2.5 py-1 text-xs font-bold text-violet-700 hover:bg-violet-100 disabled:opacity-60"
      >
        {loading ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
        {loading ? "Thinking..." : "AI call summary"}
      </button>
      {(summary || error) && (
        <div className={`mt-2 rounded-lg border p-3 text-xs leading-5 ${error ? "border-red-100 bg-red-50 text-red-700" : "border-violet-100 bg-white text-gray-700"}`}>
          {error || <pre className="whitespace-pre-wrap font-sans">{summary}</pre>}
          {summary && contactId && (
            <button
              type="button"
              onClick={saveAsNote}
              disabled={saving}
              className="mt-2 rounded-lg border border-gray-200 bg-gray-50 px-2.5 py-1 text-xs font-bold text-gray-700 hover:bg-gray-100 disabled:opacity-60"
            >
              {saving ? "Saving..." : "Save as note"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
