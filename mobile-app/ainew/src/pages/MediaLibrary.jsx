import { useEffect, useMemo, useState } from "react";
import { Copy, FileText, Image, Music, Trash2, Upload, Video } from "lucide-react";
import api from "../api/axios";

const mediaTypes = ["ALL", "IMAGE", "DOCUMENT", "VIDEO", "AUDIO"];
const categories = ["General", "Property", "Course", "Vehicle", "Product", "Brochure", "Quotation"];
const IMAGE_UPLOAD_ACCEPT = "image/png,image/jpeg,.png,.jpg,.jpeg";
const imageUploadMessage = "Only PNG and JPEG images are allowed. Please upload a .png, .jpg, or .jpeg file.";

const typeIcons = {
  IMAGE: Image,
  DOCUMENT: FileText,
  VIDEO: Video,
  AUDIO: Music,
};

function isImageFile(file) {
  const type = String(file?.type || "").toLowerCase();
  const name = String(file?.name || "").toLowerCase();
  return type.startsWith("image/") || /\.(png|jpe?g|gif|webp|svg|bmp|heic|heif|tiff?)$/.test(name);
}

function isAllowedImageFile(file) {
  const type = String(file?.type || "").toLowerCase();
  const name = String(file?.name || "").toLowerCase();
  return ["image/png", "image/jpeg", "image/jpg"].includes(type) || /\.(png|jpe?g)$/.test(name);
}

export default function MediaLibrary() {
  const [assets, setAssets] = useState([]);
  const [filter, setFilter] = useState("ALL");
  const [file, setFile] = useState(null);
  const [name, setName] = useState("");
  const [category, setCategory] = useState("General");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState("");

  const visibleAssets = useMemo(() => {
    if (filter === "ALL") return assets;
    return assets.filter((asset) => asset.mediaType === filter);
  }, [assets, filter]);

  const loadAssets = async () => {
    setLoading(true);
    setMessage("");
    try {
      const response = await api.get("/api/media-assets", {
        params: filter === "ALL" ? {} : { mediaType: filter },
      });
      setAssets(Array.isArray(response.data) ? response.data : []);
    } catch (error) {
      setMessage(error?.response?.data?.message || error.message || "Failed to load media library");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAssets();
  }, [filter]);

  const uploadFile = async (event) => {
    event.preventDefault();
    if (!file) {
      setMessage("Choose a file before uploading.");
      return;
    }
    if (isImageFile(file) && !isAllowedImageFile(file)) {
      setMessage(imageUploadMessage);
      return;
    }

    setUploading(true);
    setMessage("");
    const formData = new FormData();
    formData.append("file", file);
    if (name.trim()) formData.append("name", name.trim());
    if (category.trim()) formData.append("category", category.trim());
    if (description.trim()) formData.append("description", description.trim());

    try {
      await api.post("/api/media-assets", formData);
      setFile(null);
      setName("");
      setCategory("General");
      setDescription("");
      event.target.reset();
      setMessage("Media uploaded.");
      await loadAssets();
    } catch (error) {
      setMessage(error?.response?.data?.message || error.message || "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const deleteAsset = async (asset) => {
    setMessage("");
    try {
      await api.delete(`/api/media-assets/${asset.id}`);
      setAssets((current) => current.filter((item) => item.id !== asset.id));
      setMessage("Media deleted.");
    } catch (error) {
      setMessage(error?.response?.data?.message || error.message || "Delete failed");
    }
  };

  const copyUrl = async (asset) => {
    try {
      await navigator.clipboard.writeText(asset.publicUrl || "");
      setMessage("Public URL copied.");
    } catch {
      setMessage(asset.publicUrl || "No public URL available");
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 p-6 text-gray-900">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-2xl font-extrabold text-gray-950">Media Library</h1>
            <p className="mt-1 text-sm text-gray-500">Upload reusable images, brochures, quotations, videos, and audio for WhatsApp, email, catalog, and opportunities.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {mediaTypes.map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => setFilter(type)}
                className={`rounded-lg px-3 py-2 text-sm font-bold ${
                  filter === type ? "bg-teal-700 text-white" : "border border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
                }`}
              >
                {type === "ALL" ? "All" : type}
              </button>
            ))}
          </div>
        </header>

        <form onSubmit={uploadFile} className="grid gap-4 rounded-lg border border-gray-200 bg-white p-5 shadow-sm lg:grid-cols-[minmax(0,1.5fr)_1fr_1fr_auto] lg:items-end">
          <Field label="File">
            <input
              type="file"
              accept={filter === "IMAGE" ? IMAGE_UPLOAD_ACCEPT : undefined}
              onChange={(event) => {
                const nextFile = event.target.files?.[0] || null;
                if (nextFile && isImageFile(nextFile) && !isAllowedImageFile(nextFile)) {
                  setMessage(imageUploadMessage);
                  setFile(null);
                  event.target.value = "";
                  return;
                }
                setMessage("");
                setFile(nextFile);
              }}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm"
            />
          </Field>
          <Field label="Display name">
            <input value={name} onChange={(event) => setName(event.target.value)} placeholder={file?.name || "Optional"} className={inputClass} />
          </Field>
          <Field label="Category">
            <select value={category} onChange={(event) => setCategory(event.target.value)} className={inputClass}>
              {categories.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </Field>
          <button disabled={uploading} className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-teal-700 px-4 text-sm font-bold text-white hover:bg-teal-800 disabled:opacity-60">
            <Upload size={17} />
            {uploading ? "Uploading..." : "Upload"}
          </button>
          <div className="lg:col-span-4">
            <Field label="Description">
              <input value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Example: 2BHK brochure, course fee PDF, vehicle quotation" className={inputClass} />
            </Field>
          </div>
          {message && <p className="text-sm font-medium text-gray-600 lg:col-span-4">{message}</p>}
        </form>

        <section className="rounded-lg border border-gray-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
            <div>
              <h2 className="text-lg font-bold text-gray-950">Assets</h2>
              <p className="text-sm text-gray-500">{loading ? "Loading..." : `${visibleAssets.length} media files`}</p>
            </div>
          </div>

          {visibleAssets.length === 0 ? (
            <div className="px-5 py-16 text-center text-sm text-gray-500">No media uploaded yet.</div>
          ) : (
            <div className="grid gap-4 p-5 md:grid-cols-2 xl:grid-cols-3">
              {visibleAssets.map((asset) => <MediaCard key={asset.id} asset={asset} onCopy={copyUrl} onDelete={deleteAsset} />)}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function MediaCard({ asset, onCopy, onDelete }) {
  const Icon = typeIcons[asset.mediaType] || FileText;
  return (
    <article className="overflow-hidden rounded-lg border border-gray-200 bg-white">
      <div className="flex aspect-video items-center justify-center bg-slate-100">
        {asset.mediaType === "IMAGE" && asset.publicUrl ? (
          <img src={asset.publicUrl} alt={asset.name} className="h-full w-full object-cover" />
        ) : asset.mediaType === "VIDEO" && asset.publicUrl ? (
          <video controls className="h-full w-full object-cover"><source src={asset.publicUrl} /></video>
        ) : asset.mediaType === "AUDIO" && asset.publicUrl ? (
          <div className="w-full px-4"><audio controls className="w-full"><source src={asset.publicUrl} /></audio></div>
        ) : (
          <div className="flex flex-col items-center gap-2 text-slate-500">
            <Icon size={36} />
            <span className="text-xs font-bold">{asset.mediaType}</span>
          </div>
        )}
      </div>
      <div className="space-y-3 p-4">
        <div>
          <h3 className="truncate text-sm font-extrabold text-gray-950">{asset.name}</h3>
          <p className="mt-1 truncate text-xs text-gray-500">{asset.originalFileName}</p>
        </div>
        <div className="flex flex-wrap gap-2 text-xs">
          <span className="rounded-full bg-teal-50 px-2 py-1 font-bold text-teal-700">{asset.mediaType}</span>
          {asset.category && <span className="rounded-full bg-slate-100 px-2 py-1 font-bold text-slate-600">{asset.category}</span>}
          <span className="rounded-full bg-slate-100 px-2 py-1 font-bold text-slate-600">{formatSize(asset.fileSize)}</span>
        </div>
        {asset.description && <p className="line-clamp-2 text-sm text-gray-600">{asset.description}</p>}
        <div className="rounded-lg bg-slate-50 p-2 text-xs text-gray-500">
          <div className="truncate">{asset.publicUrl}</div>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={() => onCopy(asset)} className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm font-bold text-gray-700 hover:bg-gray-50">
            <Copy size={15} />
            Copy URL
          </button>
          <button type="button" onClick={() => onDelete(asset)} className="inline-flex items-center justify-center rounded-lg border border-red-200 px-3 py-2 text-red-600 hover:bg-red-50">
            <Trash2 size={16} />
          </button>
        </div>
      </div>
    </article>
  );
}

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-gray-500">{label}</span>
      {children}
    </label>
  );
}

function formatSize(size) {
  const value = Number(size || 0);
  if (value >= 1024 * 1024) return `${(value / 1024 / 1024).toFixed(1)} MB`;
  if (value >= 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${value} B`;
}

const inputClass = "w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100";
