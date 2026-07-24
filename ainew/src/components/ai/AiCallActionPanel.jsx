import { useState } from "react";
import { CheckCircle2, ClipboardList, Loader2, NotebookPen, Sparkles } from "lucide-react";
import api from "../../api/axios";

function readError(error, fallback) {
  const data = error?.response?.data;
  return data?.message || data?.error || (typeof data === "string" ? data : null) || error.message || fallback;
}

function toLocalDateTime(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const offsetMs = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
}

function fromLocalDateTime(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export default function AiCallActionPanel({ callId, contactId, opportunityId, compact = false, onSaved }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [savingNote, setSavingNote] = useState(false);
  const [savingTask, setSavingTask] = useState(false);
  const [savedMessage, setSavedMessage] = useState("");
  const [error, setError] = useState("");
  const [suggestion, setSuggestion] = useState(null);
  const [form, setForm] = useState({
    note: "",
    taskTitle: "",
    taskDescription: "",
    dueAt: "",
    priority: "MEDIUM",
  });

  if (!callId || !contactId) return null;

  const loadSuggestion = async () => {
    setOpen(true);
    setLoading(true);
    setError("");
    setSavedMessage("");
    try {
      const response = await api.post(`/api/ai/calls/${callId}/action-suggestion`);
      const next = response.data || {};
      setSuggestion(next);
      setForm({
        note: next.note || "",
        taskTitle: next.taskTitle || "Follow up from call",
        taskDescription: next.taskDescription || next.followUpMessage || "",
        dueAt: toLocalDateTime(next.dueAt),
        priority: next.priority || "MEDIUM",
      });
    } catch (err) {
      setError(readError(err, "AI call action suggestion failed."));
    } finally {
      setLoading(false);
    }
  };

  const saveNote = async () => {
    if (!form.note.trim()) return;
    setSavingNote(true);
    setError("");
    setSavedMessage("");
    try {
      await api.post(`/api/contacts/${contactId}/notes`, {
        note: `AI call note:\n\n${form.note.trim()}`,
        opportunityId: opportunityId || null,
      });
      setSavedMessage("AI note saved to the contact timeline.");
      onSaved?.();
    } catch (err) {
      setError(readError(err, "Could not save AI note."));
    } finally {
      setSavingNote(false);
    }
  };

  const createTask = async () => {
    if (!form.taskTitle.trim()) {
      setError("Task title is required.");
      return;
    }
    if (!form.dueAt) {
      setError("Task due date and time is required.");
      return;
    }
    setSavingTask(true);
    setError("");
    setSavedMessage("");
    try {
      await api.post(`/api/contacts/${contactId}/tasks`, {
        title: form.taskTitle.trim(),
        description: form.taskDescription,
        priority: form.priority || "MEDIUM",
        dueAt: fromLocalDateTime(form.dueAt),
      });
      setSavedMessage("Follow-up task created.");
      onSaved?.();
    } catch (err) {
      setError(readError(err, "Could not create follow-up task."));
    } finally {
      setSavingTask(false);
    }
  };

  return (
    <div className={compact ? "mt-2" : "mt-3"}>
      <button
        type="button"
        onClick={loadSuggestion}
        disabled={loading}
        className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700 hover:bg-emerald-100 disabled:opacity-60"
      >
        {loading ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
        {loading ? "Preparing..." : "AI notes + follow-up"}
      </button>

      {open && (
        <div className="mt-2 rounded-xl border border-emerald-100 bg-white p-3 text-xs text-gray-700 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="font-bold text-gray-900">Review AI call actions</p>
              <p className="mt-0.5 text-[11px] text-gray-500">Edit before saving. Uses one AI action credit for the suggestion.</p>
            </div>
            {suggestion?.provider && (
              <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-bold uppercase text-gray-500">
                {suggestion.provider}
              </span>
            )}
          </div>

          {error && <div className="mt-2 rounded-lg border border-red-100 bg-red-50 p-2 text-red-700">{error}</div>}
          {savedMessage && (
            <div className="mt-2 flex items-center gap-1.5 rounded-lg border border-green-100 bg-green-50 p-2 text-green-700">
              <CheckCircle2 size={13} /> {savedMessage}
            </div>
          )}

          {loading ? (
            <div className="mt-3 flex items-center gap-2 text-gray-500">
              <Loader2 size={14} className="animate-spin" /> Reading call context...
            </div>
          ) : (
            <div className="mt-3 space-y-3">
              <label className="block">
                <span className="mb-1 block font-bold text-gray-700">AI call note</span>
                <textarea
                  value={form.note}
                  onChange={(event) => setForm((current) => ({ ...current, note: event.target.value }))}
                  rows={5}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-emerald-400"
                  placeholder="Generate a suggestion first, then review the note."
                />
              </label>

              <div className="grid gap-2 sm:grid-cols-[1.2fr_0.8fr]">
                <label className="block">
                  <span className="mb-1 block font-bold text-gray-700">Follow-up task</span>
                  <input
                    value={form.taskTitle}
                    onChange={(event) => setForm((current) => ({ ...current, taskTitle: event.target.value }))}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-emerald-400"
                    placeholder="Task title"
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block font-bold text-gray-700">Due date & time</span>
                  <input
                    type="datetime-local"
                    value={form.dueAt}
                    onChange={(event) => setForm((current) => ({ ...current, dueAt: event.target.value }))}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-emerald-400"
                  />
                </label>
              </div>

              <div className="grid gap-2 sm:grid-cols-[1fr_140px]">
                <label className="block">
                  <span className="mb-1 block font-bold text-gray-700">Task details</span>
                  <textarea
                    value={form.taskDescription}
                    onChange={(event) => setForm((current) => ({ ...current, taskDescription: event.target.value }))}
                    rows={3}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-emerald-400"
                    placeholder="What should the agent do next?"
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block font-bold text-gray-700">Priority</span>
                  <select
                    value={form.priority}
                    onChange={(event) => setForm((current) => ({ ...current, priority: event.target.value }))}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-emerald-400"
                  >
                    <option value="HIGH">High</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="LOW">Low</option>
                  </select>
                </label>
              </div>

              {suggestion?.followUpMessage && (
                <div className="rounded-lg border border-gray-100 bg-gray-50 p-2">
                  <p className="font-bold text-gray-700">Suggested message</p>
                  <p className="mt-1 whitespace-pre-wrap text-gray-600">{suggestion.followUpMessage}</p>
                </div>
              )}

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={saveNote}
                  disabled={savingNote || !form.note.trim()}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-gray-900 px-3 py-2 font-bold text-white hover:bg-gray-800 disabled:opacity-60"
                >
                  {savingNote ? <Loader2 size={14} className="animate-spin" /> : <NotebookPen size={14} />}
                  Save note
                </button>
                <button
                  type="button"
                  onClick={createTask}
                  disabled={savingTask || !form.taskTitle.trim() || !form.dueAt}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 font-bold text-emerald-700 hover:bg-emerald-100 disabled:opacity-60"
                >
                  {savingTask ? <Loader2 size={14} className="animate-spin" /> : <ClipboardList size={14} />}
                  Create task
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
