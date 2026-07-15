import { useState } from "react";
import { FileText, Loader2 } from "lucide-react";
import api from "../../api/axios";

function readError(error, fallback) {
  const data = error?.response?.data;
  return data?.message || data?.error || (typeof data === "string" ? data : null) || error.message || fallback;
}

export default function CallTranscriptButton({
  callId,
  recordingUrl,
  transcriptText,
  transcriptStatus,
  transcriptError,
  transcriptProvider,
  transcriptModel,
  compact = false,
  onDone,
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [expanded, setExpanded] = useState(false);

  if (!callId) return null;

  const status = transcriptStatus || (transcriptText ? "COMPLETED" : "NOT_REQUESTED");
  const canGenerate = Boolean(recordingUrl) && !loading;

  const generate = async () => {
    if (!canGenerate) {
      setError("Recording is not available yet. Wait for provider recording callback first.");
      setExpanded(true);
      return;
    }
    setLoading(true);
    setError("");
    setExpanded(true);
    try {
      await api.post(`/api/ai/calls/${callId}/transcript`);
      onDone?.();
    } catch (err) {
      setError(readError(err, "Call transcription failed."));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={compact ? "mt-2" : "mt-3"}>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={generate}
          disabled={loading}
          className="inline-flex items-center gap-1.5 rounded-lg border border-sky-200 bg-sky-50 px-2.5 py-1 text-xs font-bold text-sky-700 hover:bg-sky-100 disabled:opacity-60"
        >
          {loading ? <Loader2 size={13} className="animate-spin" /> : <FileText size={13} />}
          {transcriptText ? "Regenerate transcript" : loading ? "Transcribing..." : "Generate transcript"}
        </button>
        <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-bold text-gray-600">
          {String(status).replaceAll("_", " ")}
        </span>
        {transcriptText && (
          <button type="button" onClick={() => setExpanded((value) => !value)} className="text-xs font-bold text-sky-700 hover:text-sky-800">
            {expanded ? "Hide transcript" : "View transcript"}
          </button>
        )}
      </div>
      <p className="mt-1 rounded-lg border border-amber-100 bg-amber-50 px-2 py-1.5 text-[11px] font-semibold leading-4 text-amber-800">
        Uses CRM AI credits. Your selected AI provider may also charge separately based on transcript model and recording duration.
      </p>
      {(transcriptProvider || transcriptModel) && (
        <p className="mt-1 text-[11px] font-bold text-sky-700">
          Generated with {[transcriptProvider, transcriptModel].filter(Boolean).join(" · ")}
        </p>
      )}
      {(expanded || error || transcriptError) && (
        <div className={`mt-2 rounded-lg border p-3 text-xs leading-5 ${error || transcriptError ? "border-red-100 bg-red-50 text-red-700" : "border-sky-100 bg-white text-gray-700"}`}>
          {error || transcriptError || (
            transcriptText
              ? <pre className="max-h-56 overflow-auto whitespace-pre-wrap font-sans">{transcriptText}</pre>
              : "Transcript will appear here after generation."
          )}
        </div>
      )}
    </div>
  );
}
