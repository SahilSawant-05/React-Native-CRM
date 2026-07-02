import { useState } from "react";
import { Copy, Loader2, Sparkles, Wand2 } from "lucide-react";
import api from "../../api/axios";

function aiErrorMessage(error) {
  const data = error?.response?.data;
  if (typeof data === "string") return data;
  return data?.message || data?.error || error?.message || "AI request failed";
}

export default function AiAssistPanel({
  contactId,
  title = "AI Assistant",
  contextPrompt = "",
  replyPrompt = "",
  onApply,
  applyLabel = "Use result",
  compact = false,
}) {
  const [loadingType, setLoadingType] = useState("");
  const [result, setResult] = useState("");
  const [error, setError] = useState("");

  const runSummary = async () => {
    if (!contactId) {
      setError("Link a contact before generating an AI summary.");
      return;
    }
    setLoadingType("summary");
    setError("");
    try {
      const response = await api.post(`/api/ai/contacts/${contactId}/summary`);
      setResult(response.data?.text || "No AI summary returned.");
    } catch (err) {
      setError(aiErrorMessage(err));
    } finally {
      setLoadingType("");
    }
  };

  const runReply = async () => {
    const prompt = replyPrompt || contextPrompt;
    if (!prompt.trim()) {
      setError("AI reply needs some CRM context first.");
      return;
    }
    setLoadingType("reply");
    setError("");
    try {
      const response = await api.post("/api/ai/generate", {
        prompt,
        purpose: "ai_reply",
      });
      setResult(response.data?.text || "No AI reply returned.");
    } catch (err) {
      setError(aiErrorMessage(err));
    } finally {
      setLoadingType("");
    }
  };

  const copyResult = async () => {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(result);
    } catch {
      setError("Could not copy result. You can still select and copy it manually.");
    }
  };

  return (
    <section className={`rounded-xl border border-teal-100 bg-teal-50/60 ${compact ? "p-3" : "p-4"}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <h3 className="flex items-center gap-2 text-sm font-extrabold text-teal-950">
            <Sparkles size={16} className="text-teal-700" />
            {title}
          </h3>
          <p className="mt-1 text-xs font-medium text-teal-700">
            Growth plan and above. Each successful AI action uses 0.25 credits.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={runSummary}
            disabled={Boolean(loadingType)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-2 text-xs font-bold text-teal-800 shadow-sm ring-1 ring-teal-200 hover:bg-teal-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loadingType === "summary" ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
            AI Summary
          </button>
          <button
            type="button"
            onClick={runReply}
            disabled={Boolean(loadingType)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-teal-700 px-3 py-2 text-xs font-bold text-white shadow-sm hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loadingType === "reply" ? <Loader2 size={14} className="animate-spin" /> : <Wand2 size={14} />}
            AI Reply
          </button>
        </div>
      </div>

      {error && (
        <div className="mt-3 rounded-lg border border-red-200 bg-white px-3 py-2 text-xs font-semibold text-red-700">
          {error}
        </div>
      )}

      {result && (
        <div className="mt-3 rounded-lg border border-teal-100 bg-white p-3">
          <div className="whitespace-pre-wrap break-words text-sm leading-6 text-gray-800">{result}</div>
          <div className="mt-3 flex flex-wrap justify-end gap-2">
            <button
              type="button"
              onClick={copyResult}
              className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-2 text-xs font-bold text-gray-700 hover:bg-gray-50"
            >
              <Copy size={14} />
              Copy
            </button>
            {onApply && (
              <button
                type="button"
                onClick={() => onApply(result)}
                className="rounded-lg bg-gray-950 px-3 py-2 text-xs font-bold text-white hover:bg-black"
              >
                {applyLabel}
              </button>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
