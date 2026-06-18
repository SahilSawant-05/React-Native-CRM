import { forwardRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/axios";
import { createPortal } from "react-dom";

const UploadCsv = forwardRef(function UploadCsv({ closemodal }, ref) {
  const navigate = useNavigate();
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [preview, setPreview] = useState(null);
  const [selectedRows, setSelectedRows] = useState(new Set());
  const [updateExisting, setUpdateExisting] = useState(false);
  const [previewPage, setPreviewPage] = useState(1);
  const [previewPageSize, setPreviewPageSize] = useState(100);

  const previewImport = async () => {
    if (!file) {
      setError("Select a CSV or XLSX file before uploading.");
      setSuccess("");
      return;
    }

    const fileName = file.name?.toLowerCase() || "";
    const isCsv = fileName.endsWith(".csv");
    const isXlsx = fileName.endsWith(".xlsx");

    if (!isCsv && !isXlsx) {
      setError("Only .csv and .xlsx files are supported right now.");
      setSuccess("");
      return;
    }

    const formData = new FormData();
    formData.append("file", file);

    try {
      setLoading(true);
      setError("");
      setSuccess("");
      const res = await api.post("/api/contacts/upload/preview", formData);
      const rows = Array.isArray(res.data?.rows) ? res.data.rows : [];
      setPreview(res.data);
      setPreviewPage(1);
      setSelectedRows(new Set(rows.filter((row) => row.status === "NEW").map((row) => row.rowNumber)));
    } catch (uploadError) {
      setError(
        uploadError.response?.data?.message ||
          uploadError.response?.data?.error ||
          "Upload failed. Please check the file format and try again."
      );
    } finally {
      setLoading(false);
    }
  };

  const commitImport = async () => {
    const rows = (preview?.rows || []).filter((row) => selectedRows.has(row.rowNumber));
    if (rows.length === 0) {
      setError("Select at least one row to import.");
      return;
    }

    try {
      setCommitting(true);
      setError("");
      setSuccess("");
      const res = await api.post("/api/contacts/upload/commit", {
        updateExisting,
        rows,
      });
      setSuccess(
        `Import complete. Created ${res.data.created || 0}, updated ${res.data.updated || 0}, skipped ${res.data.skipped || 0}.`
      );
      setFile(null);
      setPreview(null);
      setPreviewPage(1);
      setSelectedRows(new Set());
      setUpdateExisting(false);
    } catch (commitError) {
      setError(
        commitError.response?.data?.message ||
          commitError.response?.data?.error ||
          "Import failed. Please review selected rows and try again."
      );
    } finally {
      setCommitting(false);
    }
  };

  const toggleRow = (rowNumber) => {
    setSelectedRows((prev) => {
      const next = new Set(prev);
      if (next.has(rowNumber)) next.delete(rowNumber);
      else next.add(rowNumber);
      return next;
    });
  };

  const selectRows = (predicate) => {
    setSelectedRows(new Set((preview?.rows || []).filter(predicate).map((row) => row.rowNumber)));
  };

  const content = (
    <>
      <div className="flex">
        <div className="px-6 py-4">
          <h2 className="text-xl font-bold text-gray-900">Upload Contacts</h2>
          <p className="mt-1 text-sm text-gray-500">Preview CSV/XLSX leads before importing them into CRM.</p>
        </div>
        {closemodal && (
          <button onClick={closemodal} className="ml-auto px-5 text-xl text-gray-400 hover:text-gray-700">×</button>
        )}
      </div>

      <div className={`${ref ? "max-h-[72vh] overflow-y-auto" : ""} px-6 pb-6`}>
          <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
            <input
              type="file"
              accept=".csv,.xlsx"
              onChange={(e) => {
                setFile(e.target.files[0] || null);
                setError("");
                setSuccess("");
                setPreview(null);
                setPreviewPage(1);
                setSelectedRows(new Set());
              }}
              className="w-full rounded-lg border border-gray-200 bg-white p-2 text-sm"
            />
            <p className="mt-2 text-xs text-gray-400">
              Supported columns: name, phone, email, tags, leadSource, leadSourceDetail, industryKey, city.
            </p>
          </div>

        {error && <p className="mt-3 text-sm text-rose-500">{error}</p>}
        {success && (
          <div className="mt-3 rounded-lg border border-emerald-100 bg-emerald-50 p-3">
            <p className="text-sm text-emerald-700">{success}</p>
            <button
              type="button"
              onClick={() => {
                closemodal?.();
                navigate("/dashboard/duplicate-cleanup");
              }}
              className="mt-2 rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700"
            >
              Review duplicates
            </button>
          </div>
        )}

          {preview && (
            <div className="mt-4">
              <div className="mb-3 grid gap-2 sm:grid-cols-4">
                <Stat label="Rows" value={preview.summary?.total || 0} />
                <Stat label="New" value={preview.summary?.new || 0} />
                <Stat label="Duplicates" value={preview.summary?.duplicates || 0} />
                <Stat label="Invalid" value={preview.summary?.invalid || 0} />
              </div>

              <div className="mb-3 flex flex-wrap items-center gap-2">
                <button type="button" onClick={() => selectRows((row) => row.status === "NEW")} className="rounded-lg border border-gray-200 px-3 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-50">
                  Select new only
                </button>
                <button type="button" onClick={() => selectRows((row) => row.status !== "INVALID")} className="rounded-lg border border-gray-200 px-3 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-50">
                  Select valid rows
                </button>
                <button type="button" onClick={() => setSelectedRows(new Set())} className="rounded-lg border border-gray-200 px-3 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-50">
                  Clear
                </button>
                <label className="ml-auto flex items-center gap-2 text-xs font-semibold text-gray-600">
                  <input
                    type="checkbox"
                    checked={updateExisting}
                    onChange={(event) => setUpdateExisting(event.target.checked)}
                    className="rounded border-gray-300 text-teal-500"
                  />
                  Update matched duplicates
                </label>
              </div>

              <PreviewPager
                totalRows={(preview.rows || []).length}
                page={previewPage}
                pageSize={previewPageSize}
                onPageChange={setPreviewPage}
                onPageSizeChange={(size) => {
                  setPreviewPageSize(size);
                  setPreviewPage(1);
                }}
              />

              <div className="overflow-x-auto rounded-xl border border-gray-200">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-xs uppercase text-gray-400">
                    <tr>
                      <th className="px-3 py-2 text-left">Use</th>
                      <th className="px-3 py-2 text-left">Status</th>
                      <th className="px-3 py-2 text-left">Name</th>
                      <th className="px-3 py-2 text-left">Phone</th>
                      <th className="px-3 py-2 text-left">Email</th>
                      <th className="px-3 py-2 text-left">Industry</th>
                      <th className="px-3 py-2 text-left">City</th>
                      <th className="px-3 py-2 text-left">Match</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 bg-white">
                    {visiblePreviewRows(preview.rows || [], previewPage, previewPageSize).map((row) => (
                      <tr key={row.rowNumber}>
                        <td className="px-3 py-2">
                          <input
                            type="checkbox"
                            checked={selectedRows.has(row.rowNumber)}
                            disabled={row.status === "INVALID"}
                            onChange={() => toggleRow(row.rowNumber)}
                            className="rounded border-gray-300 text-teal-500"
                          />
                        </td>
                        <td className="px-3 py-2"><StatusBadge status={row.status} /></td>
                        <td className="px-3 py-2 text-gray-800">{row.name || "-"}</td>
                        <td className="px-3 py-2 text-gray-600">{row.phone || "-"}</td>
                        <td className="px-3 py-2 text-gray-600">{row.email || "-"}</td>
                        <td className="px-3 py-2 text-gray-600">{row.industryKey || "-"}</td>
                        <td className="px-3 py-2 text-gray-600">{row.city || "-"}</td>
                        <td className="px-3 py-2 text-xs text-gray-500">{row.existingContactName || row.reason}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <PreviewPager
                totalRows={(preview.rows || []).length}
                page={previewPage}
                pageSize={previewPageSize}
                onPageChange={setPreviewPage}
                onPageSizeChange={(size) => {
                  setPreviewPageSize(size);
                  setPreviewPage(1);
                }}
                compact
              />
            </div>
          )}

          <div className="mt-5 flex justify-end gap-2">
            <button onClick={previewImport} disabled={loading || committing} className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-60">
              {loading ? "Previewing..." : "Preview"}
            </button>
            {preview && (
              <button onClick={commitImport} disabled={committing || selectedRows.size === 0} className="rounded-lg bg-teal-500 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-600 disabled:bg-teal-300">
                {committing ? "Importing..." : `Import ${selectedRows.size} row${selectedRows.size === 1 ? "" : "s"}`}
              </button>
            )}
          </div>
      </div>
    </>
  );

  if (ref) {
    return createPortal(
      <dialog ref={ref} className="m-auto w-[920px] max-w-[94vw] max-h-[86vh] overflow-hidden rounded-2xl p-0">
        {content}
      </dialog>,
      document.getElementById("modal")
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="mx-auto max-w-6xl rounded-lg border border-gray-200 bg-white shadow-sm">
        {content}
      </div>
    </div>
  );
});

function visiblePreviewRows(rows, page, pageSize) {
  if (pageSize === "ALL") return rows;
  const size = Number(pageSize) || 100;
  const start = (Math.max(Number(page) || 1, 1) - 1) * size;
  return rows.slice(start, start + size);
}

function PreviewPager({ totalRows, page, pageSize, onPageChange, onPageSizeChange, compact = false }) {
  if (!totalRows) return null;
  const showAll = pageSize === "ALL";
  const size = showAll ? totalRows : Number(pageSize) || 100;
  const totalPages = showAll ? 1 : Math.max(Math.ceil(totalRows / size), 1);
  const safePage = Math.min(Math.max(Number(page) || 1, 1), totalPages);
  const start = showAll ? 1 : (safePage - 1) * size + 1;
  const end = showAll ? totalRows : Math.min(start + size - 1, totalRows);

  return (
    <div className={`flex flex-wrap items-center gap-2 ${compact ? "mt-3" : "mb-3"}`}>
      <p className="mr-auto text-xs font-medium text-gray-500">
        Showing {start}-{end} of {totalRows} preview rows
      </p>
      {!compact && (
        <select
          value={pageSize}
          onChange={(event) => onPageSizeChange(event.target.value === "ALL" ? "ALL" : Number(event.target.value))}
          className="rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-xs font-semibold text-gray-600 outline-none focus:border-teal-500"
        >
          <option value={50}>50 / page</option>
          <option value={100}>100 / page</option>
          <option value={250}>250 / page</option>
          <option value="ALL">Show all</option>
        </select>
      )}
      <button
        type="button"
        onClick={() => onPageChange(Math.max(safePage - 1, 1))}
        disabled={safePage <= 1}
        className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-600 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
      >
        Previous
      </button>
      <span className="text-xs font-semibold text-gray-500">
        Page {safePage} of {totalPages}
      </span>
      <button
        type="button"
        onClick={() => onPageChange(Math.min(safePage + 1, totalPages))}
        disabled={safePage >= totalPages}
        className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-600 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
      >
        Next
      </button>
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div className="rounded-lg bg-white p-3 shadow-sm">
      <div className="text-xs font-semibold uppercase text-gray-400">{label}</div>
      <div className="mt-1 text-xl font-bold text-gray-900">{value}</div>
    </div>
  );
}

function StatusBadge({ status }) {
  const styles = {
    NEW: "bg-emerald-50 text-emerald-700",
    EXACT_DUPLICATE: "bg-amber-50 text-amber-700",
    INVALID: "bg-rose-50 text-rose-700",
  };
  return (
    <span className={`rounded-full px-2 py-1 text-xs font-semibold ${styles[status] || "bg-gray-100 text-gray-600"}`}>
      {status?.replaceAll("_", " ") || "Unknown"}
    </span>
  );
}

export default UploadCsv;
