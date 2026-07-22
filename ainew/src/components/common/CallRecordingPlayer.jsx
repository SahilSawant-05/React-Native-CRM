import { useEffect, useState } from "react";
import { ExternalLink, Loader2, PlayCircle } from "lucide-react";
import api from "../../api/axios";

export default function CallRecordingPlayer({ recordingUrl, callId, compact = false }) {
  const [objectUrl, setObjectUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => () => {
    if (objectUrl) URL.revokeObjectURL(objectUrl);
  }, [objectUrl]);

  if (!recordingUrl) {
    return (
      <span className={`inline-flex rounded-lg border border-gray-100 bg-gray-50 text-gray-500 ${compact ? "px-2 py-1 text-xs" : "px-3 py-2 text-sm"}`}>
        No recording
      </span>
    );
  }

  const loadRecording = async () => {
    if (!callId) {
      window.open(recordingUrl, "_blank", "noopener,noreferrer");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const response = await api.get(`/api/telephony/calls/${callId}/recording`, { responseType: "blob" });
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      setObjectUrl(URL.createObjectURL(response.data));
    } catch (err) {
      const message = err?.response?.data?.message || err?.response?.data?.error || err.message || "Recording could not be loaded.";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const playbackUrl = objectUrl || (!callId ? recordingUrl : "");

  return (
    <div className={`w-full min-w-[220px] max-w-full rounded-lg border border-teal-100 bg-teal-50 ${compact ? "p-2" : "p-3"}`}>
      {playbackUrl ? (
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-xs font-extrabold text-teal-800">
            <PlayCircle size={15} />
            <span>Call recording</span>
          </div>
          <audio controls preload="metadata" className="h-10 w-full min-w-[210px] max-w-full">
            <source src={playbackUrl} />
            Your browser cannot play this recording.
          </audio>
        </div>
      ) : (
        <button
          type="button"
          onClick={loadRecording}
          disabled={loading}
          className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-teal-200 bg-white px-3 py-2 text-xs font-extrabold text-teal-700 hover:bg-teal-50 disabled:opacity-60"
        >
          {loading && <Loader2 size={13} className="animate-spin" />}
          {!loading && <PlayCircle size={14} />}
          {loading ? "Loading recording..." : "Load recording"}
        </button>
      )}
      <a
        href={playbackUrl}
        target="_blank"
        rel="noreferrer"
        onClick={(event) => {
          if (!playbackUrl) {
            event.preventDefault();
            loadRecording();
          }
        }}
        className="mt-2 inline-flex items-center gap-1 text-xs font-bold text-teal-700 hover:text-teal-800"
      >
        <ExternalLink size={12} />
        Open recording
      </a>
      {error && <p className="mt-1 text-xs font-semibold text-red-600">{error}</p>}
    </div>
  );
}
