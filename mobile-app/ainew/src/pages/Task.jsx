import { useState, useRef, useEffect, useCallback } from "react";
import apiClient from "../api/axios";

/* ─── Constants ──────────────────────────────────────────────────── */
const PRIORITY_META = {
  high:   { label: "High",   dot: "bg-red-500",   badge: "bg-red-500/15 text-red-400 border border-red-500/30" },
  medium: { label: "Medium", dot: "bg-amber-500",  badge: "bg-amber-500/15 text-amber-400 border border-amber-500/30" },
  low:    { label: "Low",    dot: "bg-emerald-500",badge: "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30" },
};

const COLUMN_ACCENT = [
  "border-t-blue-500",
  "border-t-amber-500",
  "border-t-emerald-500",
  "border-t-purple-500",
  "border-t-red-500",
];

const COLUMN_DOT = ["bg-blue-500","bg-amber-500","bg-emerald-500","bg-purple-500","bg-red-500"];
const COLUMN_COUNT_COLOR = ["text-blue-400","text-amber-400","text-emerald-400","text-purple-400","text-red-400"];
const COLUMN_COUNT_BG = ["bg-blue-500/15","bg-amber-500/15","bg-emerald-500/15","bg-purple-500/15","bg-red-500/15"];

const TAGS = ["Admin","Layout","Dashboard","Design","Website","Marketing","Business","Logo","UI/UX","Analysis","Product","Ecommerce","Graphic"];
const TEAM = [
  { id:1, name:"Sarah Kim",  color:"#6366f1" },
  { id:2, name:"James Park", color:"#f59e0b" },
  { id:3, name:"Tom Reed",   color:"#ec4899" },
  { id:4, name:"Maya Singh", color:"#10b981" },
  { id:5, name:"Lucas Chen", color:"#3b82f6" },
];

let _seq = 100;
const uid = () => `id-${++_seq}`;

const STATUS_COLUMNS = [
  { id: "OPEN", name: "Open" },
  { id: "IN_PROGRESS", name: "In Progress" },
  { id: "COMPLETED", name: "Completed" },
  { id: "CANCELLED", name: "Cancelled" },
];

const STATUS_LABELS = STATUS_COLUMNS.reduce((acc, item) => ({ ...acc, [item.id]: item.name }), {});

const normalizeStatus = (value) => {
  const normalized = String(value || "OPEN").trim().toUpperCase().replaceAll(" ", "_");
  if (normalized === "TO_DO" || normalized === "TODO") return "OPEN";
  if (normalized === "DONE") return "COMPLETED";
  if (normalized === "REVIEW") return "IN_PROGRESS";
  return STATUS_LABELS[normalized] ? normalized : "OPEN";
};

const toDueAt = (date) => {
  if (!date) return null;
  if (String(date).includes("T")) return new Date(date).toISOString();
  return `${date}T09:00:00+05:30`;
};

const toDateTimeInputValue = (value) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value).slice(0, 16);
  const offsetMs = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
};

const quickDateTimeValue = (daysFromToday, hour, minute = 0) => {
  const date = new Date();
  date.setDate(date.getDate() + daysFromToday);
  date.setHours(hour, minute, 0, 0);
  return toDateTimeInputValue(date.toISOString());
};

const displayDateTime = (value) => {
  if (!value) return "No date";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const dueMeta = (date) => {
  if (!date) return { label: "No calendar date", cls: "bg-gray-100 text-gray-600 border-gray-200" };
  const dateOnly = String(date).split("T")[0];
  const due = new Date(`${dateOnly}T23:59:59`);
  if (Number.isNaN(due.getTime())) return { label: date, cls: "bg-gray-100 text-gray-600 border-gray-200" };
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  const dueDay = new Date(due);
  dueDay.setHours(0, 0, 0, 0);
  if (dueDay < today) return { label: "Overdue", cls: "bg-red-50 text-red-700 border-red-200" };
  if (dueDay.getTime() === today.getTime()) return { label: "Today", cls: "bg-blue-50 text-blue-700 border-blue-200" };
  if (dueDay.getTime() === tomorrow.getTime()) return { label: "Tomorrow", cls: "bg-amber-50 text-amber-700 border-amber-200" };
  return { label: "Upcoming", cls: "bg-emerald-50 text-emerald-700 border-emerald-200" };
};

const currentRole = () => {
  const sessionRole = sessionStorage.getItem("role") || localStorage.getItem("role");
  if (sessionRole) return sessionRole.toUpperCase();
  try {
    const token = sessionStorage.getItem("token") || localStorage.getItem("token");
    if (!token) return "";
    const payload = JSON.parse(atob(token.split(".")[1]));
    return String(payload.role || payload.Role || "").toUpperCase();
  } catch {
    return "";
  }
};

const canViewTenantTasks = () => ["OWNER", "ADMIN"].includes(currentRole());

/* ─── API ────────────────────────────────────────────────────────── */
const taskApi = {
  getContacts: async () => {
    try {
      const pageResponse = await apiClient.get("/api/contacts/page", {
        params: { page: 0, size: 200 },
      });
      return pageResponse.data?.items || [];
    } catch {
      const fallback = await apiClient.get("/api/contacts");
      return Array.isArray(fallback.data)
        ? fallback.data
        : fallback.data?.data ?? fallback.data?.contacts ?? [];
    }
  },
  getTasks: (cid) => apiClient.get(`/api/contacts/${cid}/tasks`).then((r) => r.data),
  createTask: (cid, data) => apiClient.post(`/api/contacts/${cid}/tasks`, data).then((r) => r.data),
  updateTask: (cid, tid, data) => apiClient.put(`/api/contacts/${cid}/tasks/${tid}`, data).then((r) => r.data),
  deleteTask: (cid, tid) => apiClient.delete(`/api/contacts/${cid}/tasks/${tid}`).then(() => true),
  updateStatus: (cid, tid, status) =>
    apiClient.post(`/api/contacts/${cid}/tasks/${tid}/status`, { status }).then((r) => r.data),
  getToday: () => apiClient.get("/api/tasks/today").then((r) => r.data),
  getOverdue: () => apiClient.get("/api/tasks/overdue").then((r) => r.data),
  getMyTasks: () => apiClient.get("/api/tasks/my-tasks").then((r) => r.data),
  getTeamTasks: () => apiClient.get("/api/tasks/team").then((r) => r.data),
};

/* ─── Data helpers ───────────────────────────────────────────────── */
const normalize = (raw) => {
  if (Array.isArray(raw)) return raw;
  if (raw?.data && Array.isArray(raw.data)) return raw.data;
  if (raw?.tasks && Array.isArray(raw.tasks)) return raw.tasks;
  if (raw?.items && Array.isArray(raw.items)) return raw.items;
  if (raw?.id || raw?.title) return [raw];
  return [];
};

const toColumns = (tasks) => {
  const map = {};
  tasks.forEach(t => {
    const status = normalizeStatus(t.status);
    const card = {
      id: String(t.id ?? t._id ?? uid()),
      contactId: t.contactId,
      contactName: t.contactName,
      contactPhone: t.contactPhone,
      assignedUserEmail: t.assignedUserEmail,
      assignedUserId: t.assignedUserId,
      createdByUserEmail: t.createdByUserEmail,
      title: t.title || t.name || "Untitled",
      text: t.description || t.text || "",
      priority: (t.priority || "medium").toLowerCase(),
      tags: Array.isArray(t.tags) ? t.tags : [],
      members: Array.isArray(t.members) ? t.members : [],
      date: t.dueAt ? toDateTimeInputValue(t.dueAt) : (t.date || t.dueDate || ""),
      dueAt: t.dueAt || "",
      assignedAt: t.assignedAt || t.createdAt || "",
      createdAt: t.createdAt || "",
      status,
    };
    if (!map[status]) map[status] = [];
    map[status].push(card);
  });
  return STATUS_COLUMNS.map((column) => ({
    ...column,
    cards: (map[column.id] || []).sort(
      (a, b) => new Date(b.assignedAt || b.createdAt || 0) - new Date(a.assignedAt || a.createdAt || 0)
    ),
  }));
};

const EMPTY_COLS = STATUS_COLUMNS.map((column) => ({ ...column, cards: [] }));

/* ─── Avatar ─────────────────────────────────────────────────────── */
function Avatar({ name, size = "sm", color }) {
  const initials = (name || "?").split(" ").slice(0,2).map(w => w[0]?.toUpperCase()).join("");
  const bg = color || TEAM.find(t => t.name === name)?.color || "#6366f1";
  const sz = size === "lg" ? "w-10 h-10 text-sm" : size === "md" ? "w-8 h-8 text-xs" : "w-6 h-6 text-[10px]";
  return (
    <div className={`${sz} rounded-full flex items-center justify-center font-bold text-white flex-shrink-0 border-2 border-[#161b22]`} style={{ background: bg }}>
      {initials}
    </div>
  );
}

/* ─── Toast ──────────────────────────────────────────────────────── */
function Toast({ message, type, onClose }) {
  useEffect(() => { const t = setTimeout(onClose, 3500); return () => clearTimeout(t); }, [onClose]);
  const styles = {
    success: "bg-emerald-500/15 border-emerald-500/40 text-emerald-400",
    error:   "bg-red-500/15 border-red-500/40 text-red-400",
    info:    "bg-blue-500/15 border-blue-500/40 text-blue-400",
  };
  const icons = { success:"✓", error:"✕", info:"ℹ" };
  return (
    <div className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 px-4 py-3 rounded-xl border text-sm    max-w-sm shadow-2xl ${styles[type] || styles.info}`}>
      <span>{icons[type] || "ℹ"}</span>
      <span>{message}</span>
      <button onClick={onClose} className="ml-auto opacity-70 hover:opacity-100">×</button>
    </div>
  );
}

/* ─── Modal shell ────────────────────────────────────────────────── */
function Modal({ open, onClose, title, children, width = "max-w-xl" }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div className={`bg-[#ffff] border border-[#30363d] rounded-2xl w-full ${width} max-h-[90vh] overflow-y-auto shadow-2xl`} onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 pt-5 pb-0 mb-5">
          <h2 className="text-lg font-bold text-[#0c0c0c]" style={{ fontFamily:"'Syne',sans-serif" }}>{title}</h2>
          <button onClick={onClose} className="w-8 h-8 rounded-lg border border-[#30363d] text-[#7d8590] hover:text-[#e6edf3] flex items-center justify-center text-base transition-colors">✕</button>
        </div>
        <div className="px-6 pb-6">{children}</div>
      </div>
    </div>
  );
}

/* ─── Field ──────────────────────────────────────────────────────── */
function Field({ label, error, children }) {
  return (
    <div className="mb-4">
      <label className="block text-[11px] font-semibold text-[#7d8590] mb-1.5 uppercase tracking-widest   ">{label}</label>
      {children}
      {error && <p className="text-xs text-red-400 mt-1">{error}</p>}
    </div>
  );
}

const inputCls = "w-full px-3.5 py-2.5 bg-white border border-gray-300 rounded-xl text-sm text-gray-950 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 transition-colors placeholder:text-gray-400";

/* ─── Contact Picker Modal ───────────────────────────────────────── */
function ContactPicker({ open, onClose, onSelect }) {
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [q, setQ] = useState("");

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    taskApi.getContacts()
      .then(r => setContacts(Array.isArray(r) ? r : r.data ?? r.contacts ?? []))
      .catch(() => setContacts([]))
      .finally(() => setLoading(false));
  }, [open]);

  const filtered = contacts.filter(c =>
    c.name?.toLowerCase().includes(q.toLowerCase()) ||
    c.email?.toLowerCase().includes(q.toLowerCase()) ||
    c.phone?.toLowerCase().includes(q.toLowerCase())
  );

  return (
    <Modal open={open} onClose={onClose} title="Select Contact" width="max-w-md">
      <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search contacts…" className={`${inputCls} mb-4`} />
      {loading ? (
        <div className="text-center text-[#7d8590] py-8">Loading contacts…</div>
      ) : filtered.length === 0 ? (
        <div className="text-center text-[#7d8590] py-8">No contacts found</div>
      ) : (
        <div className="max-h-80 overflow-y-auto flex flex-col gap-2 pr-1">
          {filtered.map(c => {
            const id = c.id || c._id;
            return (
              <button key={id} onClick={() => { onSelect(c); onClose(); }}
                className="flex items-center gap-3 p-3 rounded-xl  hover:border-emerald-500/50 hover:bg-emerald-500/5 transition-all text-left w-full group">
                <Avatar name={c.name} size="md" color="#10b981" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-[#0c0c0c] truncate">{c.name || "—"}</p>
                  <p className="text-xs text-[#7d8590]    truncate">{c.email || c.phone || `ID: ${id}`}</p>
                </div>
                <span className="text-[10px]    text-[#484f58] group-hover:text-emerald-400 transition-colors">ID:{id}</span>
              </button>
            );
          })}
        </div>
      )}
    </Modal>
  );
}

/* ─── Add Board Modal ────────────────────────────────────────────── */
function AddBoardModal({ open, onClose, onAdd }) {
  const [name, setName] = useState("");
  const [err, setErr] = useState("");
  const submit = () => {
    if (!name.trim()) { setErr("Board name is required"); return; }
    onAdd(name.trim()); setName(""); setErr(""); onClose();
  };
  return (
    <Modal open={open} onClose={onClose} title="Add Board" width="max-w-sm">
      <Field label="Board Name" error={err}>
        <input value={name} onChange={e => { setName(e.target.value); setErr(""); }} placeholder="e.g. Sprint 12…" className={inputCls} />
      </Field>
      <div className="flex gap-2 justify-end mt-2">
        <button onClick={onClose} className="px-4 py-2 rounded-xl border border-[#30363d] text-[#7d8590] hover:text-[#e6edf3] text-sm transition-colors">Cancel</button>
        <button onClick={submit} className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-semibold transition-colors">Add Board</button>
      </div>
    </Modal>
  );
}

/* ─── Task Form Modal ────────────────────────────────────────────── */
function TaskFormModal({ open, onClose, onSave, initial, colId, columns, users, loading }) {
  const blank = { title:"", text:"", priority:"medium", assignedUserId:"", tags:[], date:"" };
  const [form, setForm] = useState(blank);
  const [errors, setErrors] = useState({});
  const isEdit = !!initial;

  useEffect(() => {
    if (open) { setForm(initial ? { ...blank, ...initial } : blank); setErrors({}); }
  }, [open, initial]);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const submit = () => {
    const e = {};
    if (!form.title.trim()) e.title = "Task name is required";
    if (!form.date) e.date = "Due date and time is required";
    if (Object.keys(e).length) { setErrors(e); return; }
    onSave({ ...form, id: initial?.id || uid(), colId: form.colId || colId });
    onClose();
  };

  const toggleTag = t => set("tags", form.tags.includes(t) ? form.tags.filter(x => x !== t) : [...form.tags, t]);

  return (
    <Modal open={open} onClose={onClose} title={isEdit ? "Update Task" : "Add New Task"}>
      <Field label="Task Name *" error={errors.title}>
        <input value={form.title} onChange={e => { set("title", e.target.value); setErrors(er => ({ ...er, title:"" })); }} placeholder="Enter task name…" className={inputCls} />
      </Field>
      <Field label="Description (optional)" error={errors.text}>
        <textarea value={form.text} onChange={e => { set("text", e.target.value); setErrors(er => ({ ...er, text:"" })); }} placeholder="What needs to be done?" rows={3} className={`${inputCls} resize-none`} />
      </Field>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Priority">
          <div className="flex gap-1.5">
            {["low","medium","high"].map(p => {
              const meta = PRIORITY_META[p];
              const active = form.priority === p;
              return (
                <button key={p} type="button" onClick={() => set("priority", p)}
                  className={`flex-1 py-2 rounded-lg text-xs font-semibold border transition-all ${active ? meta.badge : "border-gray-200 bg-white text-gray-600 hover:border-emerald-300 hover:text-emerald-700"}`}>
                  {meta.label}
                </button>
              );
            })}
          </div>
        </Field>
        <Field label="Due Date & Time *" error={errors.date}>
          <input type="datetime-local" value={form.date} onChange={e => { set("date", e.target.value); setErrors(er => ({ ...er, date:"" })); }} className={`${inputCls} [color-scheme:light]`} />
          <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {[
              ["Today 10:00", quickDateTimeValue(0, 10)],
              ["Today 18:00", quickDateTimeValue(0, 18)],
              ["Tomorrow 10:00", quickDateTimeValue(1, 10)],
              ["Clear", ""],
            ].map(([label, value]) => (
              <button
                key={label}
                type="button"
                onClick={() => set("date", value)}
                className="rounded-lg border border-gray-200 bg-gray-50 px-2 py-1.5 text-xs font-semibold text-gray-700 hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-700"
              >
                {label}
              </button>
            ))}
          </div>
        </Field>
      </div>

      <Field label="Assign To">
        <select
          value={form.assignedUserId || ""}
          onChange={e => set("assignedUserId", e.target.value)}
          className={inputCls}
        >
          <option value="">Use contact owner / keep current assignee</option>
          {users.map(user => (
            <option key={user.id} value={user.id}>
              {user.email} ({user.role})
            </option>
          ))}
        </select>
      </Field>

      <Field label="Tags">
        <div className="flex flex-wrap gap-1.5 mb-2">
          {form.tags.map(t => (
            <span key={t} className="flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-xs border border-emerald-200">
              {t}
              <button type="button" onClick={() => toggleTag(t)} className="hover:opacity-70 ml-0.5">×</button>
            </span>
          ))}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {TAGS.filter(t => !form.tags.includes(t)).map(t => (
            <button key={t} type="button" onClick={() => toggleTag(t)} className="px-2.5 py-0.5 rounded-full border border-gray-200 bg-white text-gray-600 text-xs hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-700 transition-colors">
              {t}
            </button>
          ))}
        </div>
      </Field>

      {columns && (
        <Field label="Column">
          <select value={form.colId || colId} onChange={e => set("colId", e.target.value)} className={inputCls}>
            {columns.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </Field>
      )}

      <div className="flex gap-2 justify-end mt-2">
        <button onClick={onClose} className="px-5 py-2.5 rounded-xl border border-gray-300 text-gray-700 hover:bg-gray-50 text-sm transition-colors">Cancel</button>
        <button onClick={submit} disabled={loading}
          className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 text-white text-sm font-semibold disabled:opacity-60 transition-all hover:shadow-lg hover:shadow-emerald-500/20">
          {loading ? "Saving…" : isEdit ? "Update Task" : "Create Task"}
        </button>
      </div>
    </Modal>
  );
}

/* ─── Delete Modal ───────────────────────────────────────────────── */
function DeleteModal({ open, onClose, onConfirm, cardTitle, loading }) {
  return (
    <Modal open={open} onClose={onClose} title="Delete Task" width="max-w-sm">
      <p className="text-sm text-[#7d8590] mb-5 leading-relaxed">
        Are you sure you want to delete <strong className="text-[#e6edf3]">"{cardTitle}"</strong>? This cannot be undone.
      </p>
      <div className="flex gap-2 justify-end">
        <button onClick={onClose} className="px-4 py-2 rounded-xl border border-[#30363d] text-[#7d8590] hover:text-[#e6edf3] text-sm transition-colors">Cancel</button>
        <button onClick={onConfirm} disabled={loading} className="px-4 py-2 rounded-xl bg-red-500 hover:bg-red-600 text-white text-sm font-semibold disabled:opacity-60 transition-colors">
          {loading ? "Deleting…" : "Delete"}
        </button>
      </div>
    </Modal>
  );
}

/* ─── Task Card ──────────────────────────────────────────────────── */
function TaskCard({ card, onEdit, onDelete, onDragStart, onDrop, index }) {
  const [menu, setMenu] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const pri = PRIORITY_META[card.priority] || PRIORITY_META.medium;
  const due = dueMeta(card.date);

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragOver={e => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={() => { setDragOver(false); onDrop(index); }}
      onMouseLeave={() => setMenu(false)}
      className={`group relative bg-teal-700 rounded-2xl p-4 mb-2.5 cursor-grab border-l-[3px] transition-all duration-200
        hover:-translate-y-0.5 hover:shadow-xl hover:shadow-black/30 hover:bg-[#1c2128]
        ${dragOver ? "border border-emerald-500/60 shadow-lg shadow-emerald-500/10" : "border border-transparent hover:border-[#30363d]"}
      `}
      style={{ borderLeftColor: card.priority === "high" ? "#ffff" : card.priority === "low" ? "#ffff" : "black" }}
    >
      {/* header */}
      <div className="flex items-start justify-between mb-3">
        <span className="text-[10px] text-white   ">#{String(card.id).slice(-4)}</span>
        <div className="relative">
          <button onClick={() => setMenu(o => !o)} className="w-6 h-6 rounded-md flex items-center justify-center text-[#ffff] hover:text-[#7d8590] hover:bg-white/5 transition-colors text-base leading-none">⋯</button>
          {menu && (
            <div className="absolute right-0 top-full mt-1 w-32 bg-[#1c2128] border border-[#30363d] rounded-xl shadow-xl z-20 overflow-hidden">
              {[["✏️ Edit", onEdit], ["🗑 Delete", onDelete]].map(([lbl, fn]) => (
                <button key={lbl} onClick={() => { fn(); setMenu(false); }}
                  className="w-full text-left px-3 py-2.5 text-sm text-[#e6edf3] hover:bg-emerald-500/10 hover:text-emerald-400 transition-colors">
                  {lbl}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <h4 className="text-sm font-bold text-[#e6edf3] mb-1.5 leading-snug" style={{ fontFamily:"'Syne',sans-serif" }}>{card.title}</h4>

      <div className="mb-3 rounded-xl border border-white/10 bg-white/10 p-2 text-[11px] text-white">
        <div className="flex items-start justify-between gap-2">
          <span className="text-white/70">For contact</span>
          <span className="max-w-[150px] truncate font-semibold text-white">{card.contactName || `Contact #${card.contactId || "-"}`}</span>
        </div>
        {card.contactPhone && (
          <div className="mt-1 flex items-start justify-between gap-2">
            <span className="text-white/70">Phone</span>
            <span className="max-w-[150px] truncate font-semibold text-white">{card.contactPhone}</span>
          </div>
        )}
        <div className="mt-1 flex items-start justify-between gap-2">
          <span className="text-white/70">Assigned to</span>
          <span className="max-w-[150px] truncate font-semibold text-white">{card.assignedUserEmail || "Unassigned"}</span>
        </div>
        {card.createdByUserEmail && (
          <div className="mt-1 flex items-start justify-between gap-2">
            <span className="text-white/70">Created by</span>
            <span className="max-w-[150px] truncate font-semibold text-white">{card.createdByUserEmail}</span>
          </div>
        )}
        <div className="mt-1 flex items-start justify-between gap-2">
          <span className="text-white/70">Assigned</span>
          <span className="max-w-[150px] truncate font-semibold text-white">{displayDateTime(card.assignedAt || card.createdAt)}</span>
        </div>
      </div>

      {card.text && (
        <p className="text-xs text-white leading-relaxed mb-3 line-clamp-2">{card.text}</p>
      )}

      {card.tags?.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-3">
          {card.tags.slice(0,3).map(t => (
            <span key={t} className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400    border border-emerald-500/20">{t}</span>
          ))}
          {card.tags.length > 3 && <span className="text-[10px] text-[#484f58]    px-1">+{card.tags.length - 3}</span>}
        </div>
      )}

      <div className="flex items-center justify-between mb-3">
        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full    ${pri.badge}`}>{pri.label}</span>
        <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${due.cls}`}>{due.label}</span>
      </div>

      <div className="flex items-center justify-between pt-2.5 border-t border-[#30363d]/60">
        <span className="text-[10px] text-white    flex items-center gap-1">📅 {displayDateTime(card.dueAt || card.date)}</span>
      </div>
    </div>
  );
}

/* ─── Column ─────────────────────────────────────────────────────── */
function Column({ col, colIdx, onAddCard, onEditCard, onDeleteCard, onDragStart, onDrop, onDropOnCol, onDeleteCol }) {
  const [dragOver, setDragOver] = useState(false);
  const accent = COLUMN_ACCENT[colIdx % COLUMN_ACCENT.length];
  const dot    = COLUMN_DOT[colIdx % COLUMN_DOT.length];
  const countC = COLUMN_COUNT_COLOR[colIdx % COLUMN_COUNT_COLOR.length];
  const countB = COLUMN_COUNT_BG[colIdx % COLUMN_COUNT_BG.length];

  return (
    <div className="flex w-[82vw] max-w-sm flex-shrink-0 snap-start flex-col sm:w-72"
      onDragOver={e => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={() => { setDragOver(false); onDropOnCol(col.id, col.cards.length); }}>

      {/* header */}
      <div className={`flex items-center justify-between mb-3.5 px-3.5 py-2.5 rounded-xl border-t-2 ${accent} ${dragOver ? "bg-white/5 border border-white/10" : "bg-transparent border border-transparent"} transition-all`}>
        <div className="flex items-center gap-2">
          <div className={`w-2.5 h-2.5 rounded-full ${dot}`} />
          <span className="text-xs font-bold text-black uppercase tracking-widest" style={{ fontFamily:"'Syne',sans-serif" }}>{col.name}</span>
          <span className={`text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center    ${countC} ${countB}`}>{col.cards.length}</span>
        </div>
        {!STATUS_LABELS[col.id] && (
          <button onClick={onDeleteCol} className="text-[#484f58] hover:text-red-400 text-sm leading-none transition-colors px-1">×</button>
        )}
      </div>

      {/* cards */}
      <div className="flex-1 min-h-16">
        {col.cards.map((card, idx) => (
          <TaskCard key={card.id} card={card} index={idx}
            onEdit={() => onEditCard(card, col.id)}
            onDelete={() => onDeleteCard(card)}
            onDragStart={() => onDragStart(col.id, card.id)}
            onDrop={i => onDrop(col.id, i)} />
        ))}
      </div>

      {/* add more */}
      <button onClick={() => onAddCard(col.id)}
        className="w-full py-2.5 mt-1 rounded-xl border border-dashed border-[#30363d] text-[#7d8590] text-xs font-semibold flex items-center justify-center gap-1.5 hover:border-emerald-500/50 hover:text-emerald-400 hover:bg-emerald-500/5 transition-all">
        <span className="text-base leading-none">+</span> Add More
      </button>
    </div>
  );
}

function CalendarFocus({ tasks }) {
  const counts = tasks.reduce((acc, task) => {
    const label = dueMeta(task.date).label;
    if (label === "Overdue") acc.overdue += 1;
    else if (label === "Today") acc.today += 1;
    else if (label === "No calendar date") acc.noDate += 1;
    else acc.upcoming += 1;
    return acc;
  }, { overdue: 0, today: 0, upcoming: 0, noDate: 0 });

  const nextTasks = [...tasks]
    .filter(task => task.date && !["COMPLETED", "CANCELLED"].includes(task.status))
    .sort((a, b) => new Date(a.dueAt || a.date) - new Date(b.dueAt || b.date))
    .slice(0, 3);

  return (
    <div className="border-b border-[#30363d] bg-white px-6 py-4 text-gray-900">
      <div className="grid gap-3 lg:grid-cols-[1fr_1.5fr]">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <CalendarStat label="Overdue" value={counts.overdue} tone="red" />
          <CalendarStat label="Today" value={counts.today} tone="blue" />
          <CalendarStat label="Upcoming" value={counts.upcoming} tone="emerald" />
          <CalendarStat label="No Date" value={counts.noDate} tone="gray" />
        </div>
        <div className="rounded-xl border border-gray-200 bg-gray-50 p-3">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-xs font-extrabold uppercase tracking-widest text-gray-500">Calendar Focus</h3>
            <span className="text-xs font-semibold text-gray-400">Task due dates feed this view</span>
          </div>
          {nextTasks.length === 0 ? (
            <p className="text-sm text-gray-500">No dated open tasks in this view.</p>
          ) : (
            <div className="grid gap-2 md:grid-cols-3">
              {nextTasks.map(task => (
                <div key={task.id} className="rounded-lg border border-gray-200 bg-white p-2">
                  <p className="truncate text-xs font-bold text-gray-900">{task.title}</p>
                  <p className="mt-1 truncate text-[11px] text-gray-500">{task.contactName || `Contact #${task.contactId}`} · {task.assignedUserEmail || "Unassigned"}</p>
                  <p className="mt-1 text-[11px] font-semibold text-teal-700">{displayDateTime(task.dueAt || task.date)}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function CalendarStat({ label, value, tone }) {
  const tones = {
    red: "border-red-200 bg-red-50 text-red-700",
    blue: "border-blue-200 bg-blue-50 text-blue-700",
    emerald: "border-emerald-200 bg-emerald-50 text-emerald-700",
    gray: "border-gray-200 bg-gray-50 text-gray-700",
  };
  return (
    <div className={`rounded-xl border p-3 ${tones[tone] || tones.gray}`}>
      <p className="text-[11px] font-bold uppercase tracking-widest opacity-70">{label}</p>
      <p className="mt-1 text-xl font-extrabold">{value}</p>
    </div>
  );
}

/* ─── Drag hook ──────────────────────────────────────────────────── */
function useDragDrop(columns, setColumns, contactId, showToast) {
  const dragging = useRef(null);
  const onDragStart = (colId, cardId) => { dragging.current = { colId, cardId }; };
  const onDrop = (destColId, destIdx) => {
    if (!dragging.current) return;
    const { colId: srcColId, cardId } = dragging.current;
    dragging.current = null;
    let movedCard = null, destColName = null;
    columns.forEach(c => {
      if (c.id === srcColId) movedCard = c.cards.find(x => x.id === cardId);
      if (c.id === destColId) destColName = c.name;
    });
    setColumns(prev => {
      const cols = prev.map(c => ({ ...c, cards: [...c.cards] }));
      const src = cols.find(c => c.id === srcColId);
      const dst = cols.find(c => c.id === destColId);
      if (!src || !dst) return prev;
      const idx = src.cards.findIndex(c => c.id === cardId);
      if (idx === -1) return prev;
      const [card] = src.cards.splice(idx, 1);
      dst.cards.splice(destIdx, 0, card);
      return cols;
    });
    const effectiveContactId = movedCard?.contactId || contactId;
    if (srcColId !== destColId && movedCard && effectiveContactId && destColName) {
      taskApi.updateStatus(effectiveContactId, cardId, destColId)
        .catch(err => showToast(`Status update failed: ${err.message}`, "error"));
    }
  };
  return { onDragStart, onDrop };
}

/* ─── Main ───────────────────────────────────────────────────────── */
export default function TaskKanban() {
  const [columns, setColumns]         = useState(EMPTY_COLS);
  const [search, setSearch]           = useState("");
  const [contactId, setContactId]     = useState(null);
  const [contactName, setContactName] = useState(null);
  const [users, setUsers]             = useState([]);
  const [apiLoading, setApiLoading]   = useState(false);
  const [taskSaving, setTaskSaving]   = useState(false);
  const [delSaving, setDelSaving]     = useState(false);
  const [activeFilter, setActiveFilter] = useState(null);
  const [filterLoading, setFilterLoading] = useState(false);
  const [taskFiltersOpen, setTaskFiltersOpen] = useState(false);
  const [toast, setToast]             = useState(null);

  const [boardModal,    setBoardModal]    = useState(false);
  const [contactModal,  setContactModal]  = useState(false);
  const [taskFormModal, setTaskFormModal] = useState(false);
  const [editCard,      setEditCard]      = useState(null);
  const [activeColId,   setActiveColId]   = useState(null);
  const [deleteModal,   setDeleteModal]   = useState(false);
  const [deleteTarget,  setDeleteTarget]  = useState(null);

  const showToast = useCallback((msg, type = "success") => setToast({ message: msg, type }), []);
  const { onDragStart, onDrop } = useDragDrop(columns, setColumns, contactId, showToast);

  useEffect(() => {
    apiClient.get("/api/users")
      .then(response => setUsers(normalize(response.data)))
      .catch(() => setUsers([]));
  }, []);

  const loadTasks = useCallback((cid, label) => {
    setApiLoading(true);
    taskApi.getTasks(cid)
      .then(raw => {
        const tasks = normalize(raw);
        if (!tasks.length) { setColumns(EMPTY_COLS); showToast(`No tasks for ${label}`, "info"); return; }
        setColumns(toColumns(tasks));
        showToast(`Loaded ${tasks.length} task${tasks.length !== 1 ? "s" : ""} for ${label}`, "success");
      })
      .catch(err => { showToast(`Failed: ${err.message}`, "error"); setColumns(EMPTY_COLS); })
      .finally(() => setApiLoading(false));
  }, [showToast]);

  useEffect(() => { if (contactId) loadTasks(contactId, contactName); }, [contactId]);

  const handleSelectContact = c => {
    const id = String(c.id || c._id);
    setContactId(id); setContactName(c.name || `Contact ${id}`); setActiveFilter(null);
  };

  const fetchFilter = async (filter) => {
    if (activeFilter === filter) { setActiveFilter(null); if (contactId) loadTasks(contactId, contactName); return; }
    setActiveFilter(filter); setFilterLoading(true);
    try {
      const raw = filter === "today"
        ? await taskApi.getToday()
        : filter === "overdue"
          ? await taskApi.getOverdue()
          : filter === "team"
            ? await taskApi.getTeamTasks()
            : await taskApi.getMyTasks();
      const tasks = normalize(raw);
      if (!tasks.length) { showToast(`No tasks for "${filter}"`, "info"); setColumns(EMPTY_COLS); return; }
      setColumns(toColumns(tasks));
      showToast(`Loaded ${tasks.length} task${tasks.length !== 1 ? "s" : ""}`, "success");
    } catch (err) { showToast(`Filter failed: ${err.message}`, "error"); }
    finally { setFilterLoading(false); }
  };

  useEffect(() => {
    fetchFilter(canViewTenantTasks() ? "team" : "my-tasks");
    // Initial board scope only. Filters/contact selection control subsequent loads.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const addBoard = () => showToast("CRM task workflow columns are fixed", "info");
  const deleteBoard = colId => {
    if (STATUS_LABELS[colId]) {
      showToast("CRM task workflow columns cannot be deleted", "info");
      return;
    }
    setColumns(c => c.filter(x => x.id !== colId));
  };
  const openAdd  = colId => {
    if (!contactId) {
      showToast("Select a contact before creating a task", "info");
      setContactModal(true);
      return;
    }
    setEditCard(null); setActiveColId(colId); setTaskFormModal(true);
  };
  const openEdit = (card, colId) => { setEditCard(card); setActiveColId(colId); setTaskFormModal(true); };

  const saveCard = async (data) => {
    const targetCol = columns.find(c => c.id === (data.colId || activeColId));
    const status = targetCol?.id || "OPEN";
    const effectiveContactId = editCard?.contactId || contactId;
    if (!effectiveContactId) {
      showToast("Select a contact before saving a task", "error");
      return;
    }
    const payload = {
      title: data.title,
      description: data.text,
      assignedUserId: data.assignedUserId ? Number(data.assignedUserId) : null,
      dueAt: toDueAt(data.date),
      priority: String(data.priority || "medium").toUpperCase(),
    };
    setTaskSaving(true);
    try {
      if (editCard) {
        const updated = await taskApi.updateTask(effectiveContactId, data.id, payload);
        if (status !== normalizeStatus(editCard.status)) {
          await taskApi.updateStatus(effectiveContactId, data.id, status);
        }
        const merged = {
          ...data,
          ...(updated || {}),
          id: data.id,
          contactId: effectiveContactId,
          status,
          priority: String(updated?.priority || data.priority || "medium").toLowerCase(),
        };
        setColumns(prev => prev.map(col => {
          const without = col.cards.filter(c => c.id !== data.id);
          if (col.id === (data.colId || activeColId)) return { ...col, cards: [merged, ...without] };
          return { ...col, cards: without };
        }));
        showToast("Task updated");
      } else {
        const created = await taskApi.createTask(effectiveContactId, payload);
        const createdId = String(created?.id || created?._id || data.id);
        if (status !== "OPEN") {
          await taskApi.updateStatus(effectiveContactId, createdId, status);
        }
        const newCard = {
          ...data,
          id: createdId,
          ...(created || {}),
          contactId: effectiveContactId,
          status,
          priority: String(created?.priority || data.priority || "medium").toLowerCase(),
        };
        setColumns(prev => prev.map(col => col.id === (data.colId || activeColId) ? { ...col, cards: [newCard, ...col.cards] } : col));
        showToast("Task created");
      }
    } catch (err) { showToast(`Save failed: ${err.message}`, "error"); }
    finally { setTaskSaving(false); }
  };

  const openDelete = card => { setDeleteTarget(card); setDeleteModal(true); };
  const confirmDelete = async () => {
    setDelSaving(true);
    try {
      await taskApi.deleteTask(deleteTarget.contactId || contactId, deleteTarget.id);
      setColumns(prev => prev.map(col => ({ ...col, cards: col.cards.filter(c => c.id !== deleteTarget.id) })));
      showToast("Task deleted");
    } catch (err) {
      showToast(`Delete failed: ${err.message}`, "error");
      setColumns(prev => prev.map(col => ({ ...col, cards: col.cards.filter(c => c.id !== deleteTarget.id) })));
    } finally { setDelSaving(false); setDeleteModal(false); }
  };

  const filteredCols = columns.map(col => ({
    ...col,
    cards: search ? col.cards.filter(c => {
      const q = search.toLowerCase();
      return c.title.toLowerCase().includes(q)
        || c.text?.toLowerCase().includes(q)
        || c.contactName?.toLowerCase().includes(q)
        || c.contactPhone?.toLowerCase().includes(q)
        || c.assignedUserEmail?.toLowerCase().includes(q)
        || c.createdByUserEmail?.toLowerCase().includes(q);
    }) : col.cards,
  }));

  const total = columns.reduce((a, c) => a + c.cards.length, 0);
  const visibleTasks = filteredCols.flatMap(col => col.cards);

  return (
    <div className="min-h-screen bg-white text-[#e6edf3]">
      <link href="https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=DM+Mono:wght@400;500&family=Lora&display=swap" rel="stylesheet" />

      {/* ── Topbar ── */}
      <div className="sticky top-14 z-10 flex min-h-14 flex-col gap-3 border-b border-[#30363d] bg-[#0d1117]/95 px-3 py-3 backdrop-blur-md sm:flex-row sm:items-center sm:justify-between sm:px-6 sm:py-0 lg:top-0 lg:z-40">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 to-emerald-700 flex items-center justify-center flex-shrink-0">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5"><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
          </div>
          <span className="font-extrabold text-2xl tracking-tight" >TaskBoard</span>
          <span className="hidden sm:inline text-[10px]    text-[#7d8590] bg-white/[0.04] border border-[#30363d] px-2.5 py-0.5 rounded-full">
            {apiLoading ? "Loading…" : `${total} tasks · ${columns.length} boards`}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* contact picker */}
          <button onClick={() => setContactModal(true)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-semibold    transition-all ${contactId ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-400" : "border-[#30363d] text-white hover:border-white hover:text-gray-200"}`}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
            {contactName || "Select Contact"}
          </button>

          {/* search */}
          <div className="relative hidden sm:block">
            <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#484f58]" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search…"
              className="pl-8 pr-3 py-1.5 bg-white/[0.04] border border-[#30363d] rounded-lg text-xs text-[#e6edf3] outline-none focus:border-emerald-500/60 placeholder:text-[#484f58] w-40 transition-all focus:w-52" />
          </div>
          <button
            type="button"
            onClick={() => setTaskFiltersOpen((current) => !current)}
            className="rounded-lg border border-[#30363d] px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:border-emerald-500/50 hover:text-emerald-300 sm:hidden"
          >
            {taskFiltersOpen ? "Hide filters" : "Filters"}
          </button>

        </div>
      </div>

      {/* loading bar */}
      {apiLoading && (
        <div className="h-0.5 bg-[#30363d] relative overflow-hidden">
          <div className="absolute h-full w-2/5 bg-gradient-to-r from-transparent via-emerald-500 to-transparent animate-[scan_1.2s_linear_infinite]" />
          <style>{`@keyframes scan{from{left:-40%}to{left:100%}}`}</style>
        </div>
      )}

      {/* ── Filter bar ── */}
      <div className={`${taskFiltersOpen ? "flex" : "hidden"} flex-wrap items-center gap-2 border-b border-[#30363d] bg-[#0d1117]/80 px-3 py-3 backdrop-blur-sm sm:flex sm:px-6`}>
        <div className="relative w-full sm:hidden">
          <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#484f58]" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search tasks..."
            className="w-full rounded-lg border border-[#30363d] bg-white/[0.04] py-2 pl-8 pr-3 text-xs text-[#e6edf3] outline-none placeholder:text-[#484f58] focus:border-emerald-500/60" />
        </div>
        <span className="text-[10px]    text-white uppercase tracking-widest mr-1">Filter</span>
        {[
          ...(canViewTenantTasks() ? [
            { key:"team",     label:"Team Tasks", icon:"👥", active:"border-emerald-500/60 bg-emerald-500/10 text-emerald-400", hover:"hover:border-emerald-500/40 hover:text-emerald-400" },
            { key:"today",    label:"Today",    icon:"🗓", active:"border-blue-500/60 bg-blue-500/10 text-blue-400",    hover:"hover:border-blue-500/40 hover:text-blue-400" },
            { key:"overdue",  label:"Overdue",  icon:"⚠️",  active:"border-red-500/60 bg-red-500/10 text-red-400",       hover:"hover:border-red-500/40 hover:text-red-400" },
          ] : []),
          { key:"my-tasks", label:"My Tasks", icon:"👤", active:"border-purple-500/60 bg-purple-500/10 text-purple-400", hover:"hover:border-purple-500/40 hover:text-purple-400" },
        ].map(({ key, label, icon, active, hover }) => {
          const isActive = activeFilter === key;
          return (
            <button key={key} onClick={() => fetchFilter(key)} disabled={filterLoading}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-full border text-[11px] font-semibold    transition-all ${isActive ? active : `border-[#30363d] text-white ${hover}`}`}>
              <span>{filterLoading && isActive ? "⟳" : icon}</span>
              {label}
              {isActive && <span className="ml-0.5 opacity-60">×</span>}
            </button>
          );
        })}
      </div>

      {(contactId || activeFilter) && <CalendarFocus tasks={visibleTasks} />}
 
      {/* ── Board ── */}
      {!contactId && !activeFilter && !apiLoading ? (
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-5">
          <div className="w-20 h-20 rounded-2xl border-2 border-dashed border-emerald-500/40 bg-emerald-500/5 flex items-center justify-center text-4xl">👤</div>
          <div className="text-center">
            <h2 className="text-3xl font-extrabold text-black mb-2" >Select a Contact</h2>
            <p className="text-sm text-[#7d8590]">Pick a contact to view and manage their assigned tasks</p>
          </div>
          <button onClick={() => setContactModal(true)}
            className="px-6 py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 text-white font-bold text-sm hover:shadow-xl hover:shadow-emerald-500/20 transition-all" style={{ fontFamily:"'Syne',sans-serif" }}>
            Choose Contact →
          </button>
        </div>
      ) : (
        <div className="flex min-h-[calc(100vh-9rem)] max-w-full snap-x snap-mandatory items-start gap-3 overflow-x-auto bg-white p-3 pb-12 sm:gap-5 sm:p-6 lg:min-h-[calc(100vh-88px)]">
          {filteredCols.map((col, colIdx) => (
            <Column key={col.id} col={col} colIdx={colIdx}
              onAddCard={openAdd}
              onEditCard={openEdit}
              onDeleteCard={openDelete}
              onDragStart={onDragStart}
              onDrop={onDrop}
              onDropOnCol={(cId, idx) => onDrop(cId, idx)}
              onDeleteCol={() => deleteBoard(col.id)} />
          ))}
        </div>
      )}

      {/* Modals */}
      <ContactPicker  open={contactModal}  onClose={() => setContactModal(false)}  onSelect={handleSelectContact} />
      <AddBoardModal  open={boardModal}    onClose={() => setBoardModal(false)}    onAdd={addBoard} />
      <TaskFormModal  open={taskFormModal} onClose={() => setTaskFormModal(false)} onSave={saveCard} initial={editCard} colId={activeColId} columns={columns} users={users} loading={taskSaving} />
      <DeleteModal    open={deleteModal}   onClose={() => setDeleteModal(false)}   onConfirm={confirmDelete} cardTitle={deleteTarget?.title} loading={delSaving} />
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}
