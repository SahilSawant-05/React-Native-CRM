import { useEffect, useMemo, useState } from "react";
import { Copy, FileText, Image, Music, Upload, Video } from "lucide-react";
import api from "../../api/axios";

const mediaTypes = ["ALL", "IMAGE", "DOCUMENT", "VIDEO", "AUDIO"];
const typeIcons = {
  IMAGE: Image,
  DOCUMENT: FileText,
  VIDEO: Video,
  AUDIO: Music,
};

export default function MediaLibraryPicker({
  title = "Media Library",
  helper = "Pick existing media or upload a new file.",
  allowedTypes = mediaTypes,
  onSelect,
  compact = false,
}) {
  const [assets, setAssets] = useState([]);
  const [filter, setFilter] = useState(allowedTypes.includes("ALL") ? "ALL" : allowedTypes[0] || "ALL");
  const [file, setFile] = useState(null);
  const [fileInputKey, setFileInputKey] = useState(0);
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState("");

  const effectiveTypes = useMemo(() => {
    const types = allowedTypes.length ? allowedTypes : mediaTypes;
    return types.includes("ALL") ? types : ["ALL", ...types];
  }, [allowedTypes]);

  const visibleAssets = useMemo(() => {
    return assets.filter((asset) => {
      if (!effectiveTypes.includes("ALL") && !effectiveTypes.includes(asset.mediaType)) return false;
      if (filter === "ALL") return true;
      return asset.mediaType === filter;
    });
  }, [assets, effectiveTypes, filter]);

  const loadAssets = async () => {
    setLoading(true);
    setMessage("");
    try {
      const response = await api.get("/api/media-assets");
      setAssets(Array.isArray(response.data) ? response.data : []);
    } catch (error) {
      setMessage(error?.response?.data?.message || error.message || "Failed to load media");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAssets();
  }, []);

  const uploadFile = async () => {
    if (!file) {
      setMessage("Choose a file first.");
      return;
    }

    setUploading(true);
    setMessage("");
    const formData = new FormData();
    formData.append("file", file);
    if (name.trim()) formData.append("name", name.trim());

    try {
      const response = await api.post("/api/media-assets", formData);
      const asset = response.data;
      setAssets((current) => [asset, ...current]);
      setFile(null);
      setName("");
      setFileInputKey((current) => current + 1);
      setMessage("Uploaded.");
      if (onSelect) onSelect(asset);
    } catch (error) {
      setMessage(error?.response?.data?.message || error.message || "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const copyUrl = async (asset) => {
    try {
      await navigator.clipboard.writeText(asset.publicUrl || "");
      setMessage("URL copied.");
    } catch {
      setMessage(asset.publicUrl || "No URL available.");
    }
  };

  return (
    <section className={`rounded-lg border border-gray-200 bg-white ${compact ? "p-3" : "p-4"}`}>
      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="text-sm font-extrabold text-gray-950">{title}</h3>
          <p className="mt-1 text-xs leading-5 text-gray-500">{helper}</p>
        </div>
        <div className="flex flex-wrap gap-1">
          {effectiveTypes.map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => setFilter(type)}
              className={`rounded-md px-2 py-1 text-xs font-bold ${
                filter === type ? "bg-teal-700 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {type === "ALL" ? "All" : type}
            </button>
          ))}
        </div>
      </div>

      <div className="mb-3 grid gap-2 md:grid-cols-[minmax(0,1fr)_minmax(0,180px)_auto]">
        <input key={fileInputKey} type="file" onChange={(event) => setFile(event.target.files?.[0] || null)} className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs" />
        <input value={name} onChange={(event) => setName(event.target.value)} placeholder="Display name" className="rounded-lg border border-gray-300 px-3 py-2 text-xs outline-none focus:border-teal-500" />
        <button type="button" onClick={uploadFile} disabled={uploading} className="inline-flex items-center justify-center gap-2 rounded-lg bg-teal-700 px-3 py-2 text-xs font-bold text-white hover:bg-teal-800 disabled:opacity-60">
          <Upload size={14} />
          {uploading ? "Uploading" : "Upload"}
        </button>
      </div>

      {message && <p className="mb-2 text-xs font-semibold text-gray-600">{message}</p>}

      <div className={`grid gap-2 ${compact ? "max-h-56 overflow-y-auto" : "max-h-72 overflow-y-auto"} sm:grid-cols-2`}>
        {visibleAssets.map((asset) => <MediaOption key={asset.id} asset={asset} onSelect={onSelect} onCopy={copyUrl} />)}
        {!loading && visibleAssets.length === 0 && <div className="rounded-lg bg-gray-50 p-4 text-center text-xs text-gray-500 sm:col-span-2">No media available.</div>}
        {loading && <div className="rounded-lg bg-gray-50 p-4 text-center text-xs text-gray-500 sm:col-span-2">Loading media...</div>}
      </div>
    </section>
  );
}

function MediaOption({ asset, onSelect, onCopy }) {
  const Icon = typeIcons[asset.mediaType] || FileText;
  return (
    <article className="flex gap-3 rounded-lg border border-gray-200 p-2">
      <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-md bg-slate-100 text-slate-500">
        {asset.mediaType === "IMAGE" && asset.publicUrl ? (
          <img src={asset.publicUrl} alt={asset.name} className="h-full w-full object-cover" />
        ) : (
          <Icon size={22} />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-xs font-extrabold text-gray-950">{asset.name || asset.originalFileName}</div>
        <div className="mt-1 truncate text-[11px] font-semibold text-gray-500">{asset.mediaType} · {asset.originalFileName}</div>
        <div className="mt-2 flex gap-1">
          <button type="button" onClick={() => onSelect?.(asset)} className="rounded-md bg-teal-700 px-2 py-1 text-[11px] font-bold text-white hover:bg-teal-800">
            Use
          </button>
          <button type="button" onClick={() => onCopy(asset)} className="inline-flex items-center rounded-md border border-gray-200 px-2 py-1 text-[11px] font-bold text-gray-600 hover:bg-gray-50">
            <Copy size={12} />
          </button>
        </div>
      </div>
    </article>
  );
}
