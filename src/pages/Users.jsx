import { useEffect, useMemo, useState } from "react";
import api from "../api/axios";

const ROLE_OPTIONS = ["ADMIN", "AGENT"];

function formatDateTime(value) {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return value;
  }
}

function RoleBadge({ role }) {
  const colors = {
    OWNER: { bg: "#ede9fe", color: "#6d28d9" },
    ADMIN: { bg: "#dbeafe", color: "#1d4ed8" },
    AGENT: { bg: "#dcfce7", color: "#15803d" },
  };
  const cfg = colors[role] || { bg: "#e5e7eb", color: "#334155" };
  return (
    <span
      style={{
        padding: "6px 10px",
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 700,
        background: cfg.bg,
        color: cfg.color,
      }}
    >
      {role}
    </span>
  );
}

function getSessionUserId() {
  try {
    const user = JSON.parse(sessionStorage.getItem("user") || "{}");
    if (user.id || user.userId) return user.id || user.userId;
  } catch {
    // Continue with JWT fallback below for older sessions.
  }

  try {
    const token = sessionStorage.getItem("token");
    const payload = token ? JSON.parse(atob(token.split(".")[1] || "")) : {};
    return payload.userId || null;
  } catch {
    return null;
  }
}

export default function Users() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [search, setSearch] = useState("");
  const [roleUpdates, setRoleUpdates] = useState({});
  const [form, setForm] = useState({
    email: "",
    password: "",
    role: "AGENT",
  });
  const sessionRole = String(sessionStorage.getItem("role") || "").toUpperCase();
  const sessionUserId = getSessionUserId();
  const canDeleteUsers = sessionRole === "OWNER" || sessionRole === "ADMIN";

  const loadUsers = async () => {
    setLoading(true);
    setError("");
    try {
      const response = await api.get("/api/users");
      const rows = Array.isArray(response.data) ? response.data : [];
      setUsers(rows);
      setRoleUpdates(
        Object.fromEntries(rows.map((user) => [user.id, user.role]))
      );
    } catch (err) {
      setError(err.response?.data?.error || err.message || "Failed to load users");
      setUsers([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  useEffect(() => {
    if (!success) return;
    const timer = setTimeout(() => setSuccess(""), 3000);
    return () => clearTimeout(timer);
  }, [success]);

  const filteredUsers = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return users;
    return users.filter((user) =>
      [user.email, user.role].filter(Boolean).some((value) =>
        String(value).toLowerCase().includes(q)
      )
    );
  }, [users, search]);

  const createUser = async (e) => {
    e.preventDefault();
    if (!form.email.trim() || !form.password.trim()) {
      setError("Email and password are required");
      return;
    }

    setSaving(true);
    setError("");
    try {
      await api.post("/api/users", {
        email: form.email.trim(),
        password: form.password,
        role: form.role,
      });
      setForm({ email: "", password: "", role: "AGENT" });
      setSuccess("User created successfully");
      await loadUsers();
    } catch (err) {
      setError(err.response?.data?.error || err.message || "Failed to create user");
    } finally {
      setSaving(false);
    }
  };

  const updateRole = async (userId) => {
    const nextRole = roleUpdates[userId];
    if (!nextRole) return;
    setError("");
    try {
      await api.put(`/api/users/${userId}/role`, { role: nextRole });
      setSuccess("User role updated");
      await loadUsers();
    } catch (err) {
      setError(err.response?.data?.error || err.message || "Failed to update role");
    }
  };

  const deleteUser = async (user) => {
    if (!canDeleteUsers) {
      setError("Only admins and owners can delete users");
      return;
    }

    if (user.role === "OWNER") {
      setError("Owner user cannot be deleted");
      return;
    }

    if (sessionUserId && String(user.id) === String(sessionUserId)) {
      setError("You cannot delete your own user");
      return;
    }

    const confirmed = window.confirm(`Delete user "${user.email}"? This cannot be undone.`);
    if (!confirmed) return;

    setDeletingId(user.id);
    setError("");
    try {
      await api.delete(`/api/users/${user.id}`);
      setSuccess("User deleted");
      await loadUsers();
    } catch (err) {
      setError(err.response?.data?.error || err.message || "Failed to delete user");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div style={{ minHeight: "100vh", background: "#f8fafc", padding: 24, fontFamily: "'DM Sans', sans-serif" }}>
      <div style={{ maxWidth: 1280, margin: "0 auto", display: "grid", gap: 24 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 32, fontWeight: 800, color: "#0f172a" }}>User Management</h1>
          <p style={{ margin: "8px 0 0", color: "#475569" }}>
            Create tenant users and manage admin or agent access from one place.
          </p>
        </div>

        {error && (
          <div style={{ padding: "12px 14px", borderRadius: 12, background: "#fef2f2", border: "1px solid #fecaca", color: "#b91c1c" }}>
            {error}
          </div>
        )}
        {success && (
          <div style={{ padding: "12px 14px", borderRadius: 12, background: "#ecfdf5", border: "1px solid #86efac", color: "#166534" }}>
            {success}
          </div>
        )}

        <div style={{ display: "grid", gridTemplateColumns: "minmax(320px, 420px) minmax(0, 1fr)", gap: 24, alignItems: "start" }}>
          <form
            onSubmit={createUser}
            style={{ background: "#fff", borderRadius: 20, padding: 20, border: "1px solid #e2e8f0", boxShadow: "0 18px 50px rgba(15, 23, 42, 0.05)" }}
          >
            <h2 style={{ margin: 0, fontSize: 20, color: "#0f172a" }}>Create User</h2>
            <p style={{ margin: "6px 0 16px", color: "#64748b", fontSize: 14 }}>
              Add a new admin or agent to this tenant.
            </p>

            <div style={{ display: "grid", gap: 14 }}>
              <label style={{ display: "grid", gap: 6 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: "#334155" }}>Email</span>
                <input
                  value={form.email}
                  onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
                  placeholder="agent1@example.com"
                  style={inputStyle}
                />
              </label>

              <label style={{ display: "grid", gap: 6 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: "#334155" }}>Password</span>
                <input
                  type="password"
                  value={form.password}
                  onChange={(e) => setForm((prev) => ({ ...prev, password: e.target.value }))}
                  placeholder="Set a temporary password"
                  style={inputStyle}
                />
              </label>

              <label style={{ display: "grid", gap: 6 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: "#334155" }}>Role</span>
                <select
                  value={form.role}
                  onChange={(e) => setForm((prev) => ({ ...prev, role: e.target.value }))}
                  style={inputStyle}
                >
                  {ROLE_OPTIONS.map((role) => (
                    <option key={role} value={role}>
                      {role}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <button
              type="submit"
              disabled={saving}
              style={{
                marginTop: 18,
                border: "none",
                borderRadius: 12,
                background: "linear-gradient(135deg, #0f766e, #14b8a6)",
                color: "#fff",
                padding: "12px 16px",
                fontWeight: 700,
                cursor: saving ? "default" : "pointer",
                opacity: saving ? 0.7 : 1,
              }}
            >
              {saving ? "Creating..." : "Create User"}
            </button>
          </form>

          <div style={{ display: "grid", gap: 16 }}>
            <div style={{ background: "#fff", borderRadius: 20, padding: 18, border: "1px solid #e2e8f0", boxShadow: "0 18px 50px rgba(15, 23, 42, 0.05)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                <div>
                  <h2 style={{ margin: 0, fontSize: 20, color: "#0f172a" }}>Tenant Users</h2>
                  <p style={{ margin: "6px 0 0", color: "#64748b", fontSize: 14 }}>
                    {users.length} user{users.length !== 1 ? "s" : ""} in this tenant
                  </p>
                </div>
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search users..."
                  style={{ ...inputStyle, width: 260 }}
                />
              </div>
            </div>

            {loading ? (
              <div style={emptyCardStyle}>Loading users...</div>
            ) : filteredUsers.length === 0 ? (
              <div style={emptyCardStyle}>No users found.</div>
            ) : (
              filteredUsers.map((user) => {
                const roleLocked = user.role === "OWNER";
                const isCurrentUser = sessionUserId && String(user.id) === String(sessionUserId);
                const canDeleteThisUser = canDeleteUsers && !roleLocked && !isCurrentUser;
                return (
                  <div
                    key={user.id}
                    style={{
                      background: "#fff",
                      borderRadius: 20,
                      padding: 18,
                      border: "1px solid #e2e8f0",
                      boxShadow: "0 18px 50px rgba(15, 23, 42, 0.05)",
                      display: "grid",
                      gap: 14,
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
                      <div>
                        <div style={{ fontWeight: 800, color: "#0f172a", fontSize: 17 }}>{user.email}</div>
                        <div style={{ color: "#64748b", fontSize: 13, marginTop: 6 }}>
                          Created {formatDateTime(user.createdAt)}
                        </div>
                      </div>
                      <RoleBadge role={user.role} />
                    </div>

                    <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                      <select
                        value={roleUpdates[user.id] || user.role}
                        onChange={(e) => setRoleUpdates((prev) => ({ ...prev, [user.id]: e.target.value }))}
                        style={{ ...inputStyle, width: 180, opacity: roleLocked ? 0.7 : 1 }}
                        disabled={roleLocked}
                      >
                        {roleLocked ? (
                          <option value="OWNER">OWNER</option>
                        ) : (
                          ROLE_OPTIONS.map((role) => (
                            <option key={role} value={role}>
                              {role}
                            </option>
                          ))
                        )}
                      </select>

                      {!roleLocked ? (
                        <button
                          type="button"
                          onClick={() => updateRole(user.id)}
                          style={{
                            border: "none",
                            background: "#0f172a",
                            color: "#fff",
                            borderRadius: 12,
                            padding: "11px 14px",
                            fontWeight: 700,
                            cursor: "pointer",
                          }}
                        >
                          Update Role
                        </button>
                      ) : (
                        <span style={{ fontSize: 13, color: "#64748b", fontWeight: 600 }}>
                          Owner role is fixed at tenant signup
                        </span>
                      )}

                      {canDeleteUsers && !roleLocked && (
                        <button
                          type="button"
                          onClick={() => deleteUser(user)}
                          disabled={!canDeleteThisUser || deletingId === user.id}
                          title={isCurrentUser ? "You cannot delete your own user" : "Delete user"}
                          style={{
                            border: "1px solid #fecaca",
                            background: "#fef2f2",
                            color: "#b91c1c",
                            borderRadius: 12,
                            padding: "11px 14px",
                            fontWeight: 700,
                            cursor: canDeleteThisUser && deletingId !== user.id ? "pointer" : "not-allowed",
                            opacity: canDeleteThisUser ? 1 : 0.55,
                          }}
                        >
                          {deletingId === user.id ? "Deleting..." : "Delete"}
                        </button>
                      )}

                      {isCurrentUser && (
                        <span style={{ fontSize: 13, color: "#64748b", fontWeight: 600 }}>
                          You cannot delete your own user
                        </span>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

const inputStyle = {
  width: "100%",
  borderRadius: 12,
  border: "1px solid #cbd5e1",
  padding: "11px 13px",
  fontSize: 14,
  outline: "none",
  background: "#fff",
  color: "#0f172a",
  boxSizing: "border-box",
};

const emptyCardStyle = {
  background: "#fff",
  borderRadius: 20,
  padding: 22,
  border: "1px dashed #cbd5e1",
  color: "#64748b",
  textAlign: "center",
};
