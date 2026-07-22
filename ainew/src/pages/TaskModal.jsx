import { useState, useEffect } from "react";
import api from "../api/axios";

export default function TaskModal({
  show,
  contact,
  onClose,
  onCreated,
  defaultAssignedUserId = "",
}) {
  const [loading, setLoading] = useState(false);
  const [users, setUsers] = useState([]);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    title: "",
    description: "",
    assignedUserId: "",
    dueAt: "",
    priority: "MEDIUM",
  });

  useEffect(() => {
    if (show) {
      setError("");
      setForm({
        title: "",
        description: "",
        assignedUserId: defaultAssignedUserId ? String(defaultAssignedUserId) : "",
        dueAt: "",
        priority: "MEDIUM",
      });
    }
  }, [show, defaultAssignedUserId]);

  useEffect(() => {
    if (!show) return;

    api
      .get("/api/users")
      .then((response) => {
        const rows = Array.isArray(response.data)
          ? response.data
          : response.data?.data ?? response.data?.users ?? [];
        setUsers(rows);
      })
      .catch(() => {
        setUsers([]);
      });
  }, [show]);

  if (!show || !contact) return null;

  const initials = (contact.name || "?")
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");

  const handleCreate = async () => {
    if (!form.title.trim()) {
      setError("Task title is required.");
      return;
    }
    if (!form.dueAt) {
      setError("Due date and time is required.");
      return;
    }

    setError("");
    const payload = {
      title: form.title,
      description: form.description,
      assignedUserId: form.assignedUserId ? Number(form.assignedUserId) : null,
      dueAt: form.dueAt ? new Date(form.dueAt).toISOString() : null,
      priority: form.priority || "MEDIUM",
    };

    try {
      setLoading(true);
      const contactId = contact.id || contact._id;
      const res = await api.post(`/api/contacts/${contactId}/tasks`, payload);

      if (onCreated) onCreated(res.data);

      setForm({
        title: "",
        description: "",
        assignedUserId: defaultAssignedUserId ? String(defaultAssignedUserId) : "",
        dueAt: "",
        priority: "MEDIUM",
      });
      onClose();
    } catch (err) {
      console.error(err);
      if (err.response?.status === 403) {
        setError("You do not have permission to create a task for this contact.");
      } else {
        setError(err.response?.data?.message || "Failed to create task.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">

        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-teal-500 flex items-center justify-center text-white text-sm font-bold">
              {initials}
            </div>
            <div>
              <p className="font-semibold text-gray-800">Create Task</p>
              <p className="text-xs text-gray-400">{contact.name}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-2xl text-gray-400 hover:text-gray-700">
            &times;
          </button>
        </div>

        {/* Form */}
        <div className="space-y-4">
          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          )}

          <div>
            <label className="block text-xs text-gray-500 mb-1">Task Title *</label>
            <input
              type="text"
              placeholder="Enter task title"
              value={form.title}
              onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-teal-500"
            />
          </div>

          <div>
            <label className="block text-xs text-gray-500 mb-1">Description <span className="text-gray-400">(optional)</span></label>
            <textarea
              rows={3}
              placeholder="Task description"
              value={form.description}
              onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-teal-500 resize-none"
            />
          </div>

          <div>
            <label className="block text-xs text-gray-500 mb-1">Assign To</label>
            {users.length > 0 ? (
              <select
                value={form.assignedUserId}
                onChange={(e) => setForm((prev) => ({ ...prev, assignedUserId: e.target.value }))}
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-teal-500 bg-white"
              >
                <option value="">Use contact owner / leave unassigned</option>
                {users.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.email} ({user.role})
                  </option>
                ))}
              </select>
            ) : (
              <input
                type="number"
                placeholder="Optional user ID"
                value={form.assignedUserId}
                onChange={(e) => setForm((prev) => ({ ...prev, assignedUserId: e.target.value }))}
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-teal-500"
              />
            )}
            <p className="mt-1 text-xs text-gray-400">
              Leave blank to let the backend fall back to the contact owner.
            </p>
          </div>

          <div>
            <label className="block text-xs text-gray-500 mb-1">Due Date & Time *</label>
            <input
              type="datetime-local"
              value={form.dueAt}
              onChange={(e) => setForm((prev) => ({ ...prev, dueAt: e.target.value }))}
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-teal-500"
            />
          </div>

          <div>
            <label className="block text-xs text-gray-500 mb-1">Priority</label>
            <select
              value={form.priority}
              onChange={(e) => setForm((prev) => ({ ...prev, priority: e.target.value }))}
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-teal-500 bg-white"
            >
              <option value="LOW">Low</option>
              <option value="MEDIUM">Medium</option>
              <option value="HIGH">High</option>
            </select>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 mt-6">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl border border-gray-300 text-sm hover:bg-gray-100"
          >
            Cancel
          </button>
          <button
            onClick={handleCreate}
            disabled={loading}
            className="px-4 py-2 rounded-xl bg-teal-600 text-white text-sm hover:bg-teal-700 disabled:opacity-50"
          >
            {loading ? "Creating..." : "Create Task"}
          </button>
        </div>
      </div>
    </div>
  );
}
