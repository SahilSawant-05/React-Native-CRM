import { useState } from "react";
import { CheckCircle2, Copy, Loader2, NotebookPen, Sparkles, Target, Wand2 } from "lucide-react";
import api from "../../api/axios";

const PROMPT_PRESETS = [
  {
    key: "general_follow_up",
    label: "General Follow-up",
    instruction: "Focus on a polite follow-up, clarify interest, and ask one simple next-step question.",
  },
  {
    key: "real_estate_visit",
    label: "Real Estate Site Visit",
    instruction: "Write for a real estate buyer. Mention budget, location, project/property interest, and propose a site visit or call.",
  },
  {
    key: "education_counselling",
    label: "Education Counselling",
    instruction: "Write for an education enquiry. Mention course interest, eligibility, counselling/demo session, and admission next step.",
  },
  {
    key: "bike_sales_test_ride",
    label: "Bike / Vehicle Test Ride",
    instruction: "Write for a vehicle sales lead. Mention model interest, availability, pricing, finance/exchange if relevant, and propose a test ride.",
  },
  {
    key: "lost_lead_recovery",
    label: "Lost Lead Recovery",
    instruction: "Write a gentle reactivation message for a lead that went cold. Avoid sounding pushy and offer help.",
  },
  {
    key: "payment_reminder",
    label: "Payment Reminder",
    instruction: "Write a polite payment or booking reminder with clear next action and no aggressive wording.",
  },
];

const TONE_OPTIONS = [
  { value: "friendly", label: "Friendly" },
  { value: "professional", label: "Professional" },
  { value: "short", label: "Short" },
  { value: "urgent", label: "Urgent" },
];

const LANGUAGE_OPTIONS = [
  { value: "English", label: "English" },
  { value: "Hindi", label: "Hindi" },
  { value: "Marathi", label: "Marathi" },
  { value: "Hinglish", label: "Hinglish" },
];

function aiErrorMessage(error) {
  const data = error?.response?.data;
  if (typeof data === "string") return data;
  return data?.message || data?.error || error?.message || "AI request failed";
}

export default function AiAssistPanel({
  contactId,
  opportunityId = null,
  title = "AI Assistant",
  contextPrompt = "",
  replyPrompt = "",
  onApply,
  onContactUpdated,
  onSaved,
  applyLabel = "Use result",
  compact = false,
}) {
  const [loadingType, setLoadingType] = useState("");
  const [result, setResult] = useState("");
  const [error, setError] = useState("");
  const [actionMessage, setActionMessage] = useState("");
  const [presetKey, setPresetKey] = useState("general_follow_up");
  const [tone, setTone] = useState("friendly");
  const [language, setLanguage] = useState("English");

  const suggestedScore = extractSuggestedScore(result);
  const selectedPreset = PROMPT_PRESETS.find((preset) => preset.key === presetKey) || PROMPT_PRESETS[0];

  const withPromptControls = (prompt) => [
    prompt,
    "",
    "AI writing controls:",
    `- Prompt preset: ${selectedPreset.label}`,
    `- Preset instruction: ${selectedPreset.instruction}`,
    `- Tone: ${tone}`,
    `- Language: ${language}`,
    "- Keep the answer practical, concise, and ready for CRM use.",
  ].join("\n");

  const runSummary = async () => {
    if (!contactId) {
      setError("Link a contact before generating an AI summary.");
      return;
    }
    setLoadingType("summary");
    setError("");
    setActionMessage("");
    try {
      const response = await api.post("/api/ai/generate", {
        prompt: withPromptControls(contextPrompt || "Summarize this CRM contact and recommend the next best action."),
        purpose: "contact_summary",
      });
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
    setActionMessage("");
    try {
      const response = await api.post("/api/ai/generate", {
        prompt: withPromptControls(prompt),
        purpose: "ai_reply",
      });
      setResult(response.data?.text || "No AI reply returned.");
    } catch (err) {
      setError(aiErrorMessage(err));
    } finally {
      setLoadingType("");
    }
  };

  const runRecommendation = async () => {
    if (!contactId) {
      setError("Link a contact before generating an AI recommendation.");
      return;
    }
    setLoadingType("recommendation");
    setError("");
    setActionMessage("");
    try {
      const response = await api.post("/api/ai/generate", {
        prompt: withPromptControls(`${contextPrompt || ""}

Review this CRM lead and return:
1. Lead temperature: Hot / Warm / Cold
2. Suggested lead score from 0 to 100
3. Best follow-up channel: WhatsApp / Email / Call / Appointment
4. Recommended next action
5. One short follow-up message the agent can send`),
        purpose: "contact_recommendation",
      });
      setResult(response.data?.text || "No AI recommendation returned.");
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

  const saveAsNote = async () => {
    if (!contactId || !result.trim()) return;
    setLoadingType("note");
    setError("");
    setActionMessage("");
    try {
      await api.post(`/api/contacts/${contactId}/notes`, {
        note: `AI note:\n\n${result}`,
        opportunityId,
      });
      setActionMessage("AI output saved as contact note.");
      onSaved?.();
    } catch (err) {
      setError(aiErrorMessage(err));
    } finally {
      setLoadingType("");
    }
  };

  const createFollowUpTask = async () => {
    if (!contactId || !result.trim()) return;
    setLoadingType("task");
    setError("");
    setActionMessage("");
    try {
      const dueAt = new Date();
      dueAt.setDate(dueAt.getDate() + 1);
      dueAt.setHours(10, 0, 0, 0);
      await api.post(`/api/contacts/${contactId}/tasks`, {
        title: "AI recommended follow-up",
        description: result,
        priority: "MEDIUM",
        dueAt: dueAt.toISOString(),
      });
      setActionMessage("Follow-up task created for tomorrow.");
    } catch (err) {
      setError(aiErrorMessage(err));
    } finally {
      setLoadingType("");
    }
  };

  const applySuggestedScore = async () => {
    if (!contactId || suggestedScore === null) return;
    setLoadingType("score");
    setError("");
    setActionMessage("");
    try {
      const response = await api.post(`/api/contacts/${contactId}/lead-score`, {
        score: suggestedScore,
        reason: result,
      });
      onContactUpdated?.(response.data);
      setActionMessage(`Lead score ${suggestedScore} applied.`);
    } catch (err) {
      setError(aiErrorMessage(err));
    } finally {
      setLoadingType("");
    }
  };

  return (
    <section className={`rounded-xl border border-teal-100 bg-teal-50/60 ${compact ? "p-3" : "p-4"}`}>
      <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
        <div className="min-w-0">
          <h3 className="flex min-w-0 items-center gap-2 text-sm font-extrabold text-teal-950">
            <Sparkles size={16} className="text-teal-700" />
            <span className="min-w-0 break-words">{title}</span>
          </h3>
          <p className="mt-1 max-w-2xl text-xs font-medium leading-5 text-teal-700">
            Growth plan and above. Each successful AI action uses 0.25 credits.
          </p>
        </div>
        <div className="grid w-full grid-cols-1 gap-2 sm:grid-cols-3 xl:w-auto">
          <button
            type="button"
            onClick={runSummary}
            disabled={Boolean(loadingType)}
            className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-lg bg-white px-3 py-2 text-xs font-bold text-teal-800 shadow-sm ring-1 ring-teal-200 hover:bg-teal-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loadingType === "summary" ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
            AI Summary
          </button>
          <button
            type="button"
            onClick={runReply}
            disabled={Boolean(loadingType)}
            className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-lg bg-teal-700 px-3 py-2 text-xs font-bold text-white shadow-sm hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loadingType === "reply" ? <Loader2 size={14} className="animate-spin" /> : <Wand2 size={14} />}
            AI Reply
          </button>
          <button
            type="button"
            onClick={runRecommendation}
            disabled={Boolean(loadingType)}
            className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-lg border border-teal-200 bg-white px-3 py-2 text-xs font-bold text-teal-800 shadow-sm hover:bg-teal-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loadingType === "recommendation" ? <Loader2 size={14} className="animate-spin" /> : <Target size={14} />}
            AI Recommendation
          </button>
        </div>
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-3">
        <label className="block">
          <span className="mb-1 block text-[11px] font-black uppercase tracking-wide text-teal-800">Prompt</span>
          <select
            value={presetKey}
            onChange={(event) => setPresetKey(event.target.value)}
            className="w-full rounded-lg border border-teal-200 bg-white px-2 py-2 text-xs font-bold text-slate-700 outline-none focus:border-teal-500"
          >
            {PROMPT_PRESETS.map((preset) => (
              <option key={preset.key} value={preset.key}>{preset.label}</option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-[11px] font-black uppercase tracking-wide text-teal-800">Tone</span>
          <select
            value={tone}
            onChange={(event) => setTone(event.target.value)}
            className="w-full rounded-lg border border-teal-200 bg-white px-2 py-2 text-xs font-bold text-slate-700 outline-none focus:border-teal-500"
          >
            {TONE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-[11px] font-black uppercase tracking-wide text-teal-800">Language</span>
          <select
            value={language}
            onChange={(event) => setLanguage(event.target.value)}
            className="w-full rounded-lg border border-teal-200 bg-white px-2 py-2 text-xs font-bold text-slate-700 outline-none focus:border-teal-500"
          >
            {LANGUAGE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </label>
      </div>

      {error && (
        <div className="mt-3 rounded-lg border border-red-200 bg-white px-3 py-2 text-xs font-semibold text-red-700">
          {error}
        </div>
      )}

      {actionMessage && (
        <div className="mt-3 flex items-center gap-2 rounded-lg border border-emerald-200 bg-white px-3 py-2 text-xs font-semibold text-emerald-700">
          <CheckCircle2 size={14} />
          {actionMessage}
        </div>
      )}

      {result && (
        <div className="mt-3 rounded-lg border border-teal-100 bg-white p-3">
          <div className="max-h-80 overflow-y-auto whitespace-pre-wrap break-words rounded-lg bg-slate-50 px-3 py-2 text-sm leading-6 text-gray-800">
            {result}
          </div>
          <div className="mt-3 grid grid-cols-1 gap-2 sm:flex sm:flex-wrap sm:justify-end">
            <button
              type="button"
              onClick={saveAsNote}
              disabled={!contactId || Boolean(loadingType)}
              className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-teal-200 px-3 py-2 text-xs font-bold text-teal-800 hover:bg-teal-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loadingType === "note" ? <Loader2 size={14} className="animate-spin" /> : <NotebookPen size={14} />}
              Save Note
            </button>
            <button
              type="button"
              onClick={createFollowUpTask}
              disabled={!contactId || Boolean(loadingType)}
              className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-teal-200 px-3 py-2 text-xs font-bold text-teal-800 hover:bg-teal-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loadingType === "task" ? <Loader2 size={14} className="animate-spin" /> : <Target size={14} />}
              Create Task
            </button>
            {suggestedScore !== null && (
              <button
                type="button"
                onClick={applySuggestedScore}
                disabled={!contactId || Boolean(loadingType)}
                className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-amber-50 px-3 py-2 text-xs font-bold text-amber-800 ring-1 ring-amber-200 hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loadingType === "score" ? <Loader2 size={14} className="animate-spin" /> : <Target size={14} />}
                Apply Score {suggestedScore}
              </button>
            )}
            <button
              type="button"
              onClick={copyResult}
              className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-gray-300 px-3 py-2 text-xs font-bold text-gray-700 hover:bg-gray-50"
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

function extractSuggestedScore(text) {
  if (!text) return null;
  const patterns = [
    /(?:lead\s*)?score(?:\s*(?:is|:|-))?\s*(\d{1,3})/i,
    /(\d{1,3})\s*\/\s*100/i,
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      const value = Number(match[1]);
      if (Number.isFinite(value) && value >= 0 && value <= 100) return value;
    }
  }
  return null;
}
