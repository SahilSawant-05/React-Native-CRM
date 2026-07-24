import { Image, X } from "lucide-react";
import MediaLibraryPicker from "./MediaLibraryPicker";

export default function MediaLibraryDialog({
  open,
  title = "Choose media",
  helper = "Upload or select media from your library.",
  allowedTypes,
  onSelect,
  onClose,
}) {
  if (!open) return null;

  const handleSelect = (asset) => {
    onSelect?.(asset);
    onClose?.();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
      <div className="flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-xl bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-gray-200 px-5 py-4">
          <div className="min-w-0">
            <h3 className="flex items-center gap-2 text-base font-extrabold text-gray-950">
              <Image size={18} />
              {title}
            </h3>
            <p className="mt-1 text-sm text-gray-500">{helper}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-gray-200 p-2 text-gray-500 hover:bg-gray-50 hover:text-gray-900"
            aria-label="Close media dialog"
          >
            <X size={18} />
          </button>
        </div>
        <div className="overflow-y-auto p-5">
          <MediaLibraryPicker
            title="Media Library"
            helper="Choose an existing file or upload a new one."
            allowedTypes={allowedTypes}
            onSelect={handleSelect}
          />
        </div>
      </div>
    </div>
  );
}
