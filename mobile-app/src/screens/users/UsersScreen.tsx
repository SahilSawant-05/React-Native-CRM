import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import api from "../../api/client";
import { useAuth } from "../../auth/AuthContext";
import { LoadingSpinner } from "../../components/common/LoadingSpinner";
import { ErrorBanner } from "../../components/common/ErrorBanner";

// Web parity: Users.jsx — GET/POST/DELETE /api/users, PUT /api/users/{id}/role.
// This screen is only reachable from AdminDrawer, which itself only mounts
// for role ADMIN/OWNER (see RootNavigator), so it's already gated to owner
// and admin logins.

interface UserRow {
  id: string | number;
  email: string;
  role: "OWNER" | "ADMIN" | "AGENT" | string;
  createdAt?: string;
}

const ROLE_OPTIONS = ["ADMIN", "AGENT"];

function formatDateTime(value?: string): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

function errMsg(err: any, fallback: string): string {
  const data = err?.response?.data;
  if (typeof data === "string") return data;
  return data?.error || data?.message || err?.message || fallback;
}

function roleColors(role: string): { bg: string; color: string } {
  if (role === "OWNER") return { bg: "#ede9fe", color: "#6d28d9" };
  if (role === "ADMIN") return { bg: "#dbeafe", color: "#1d4ed8" };
  if (role === "AGENT") return { bg: "#dcfce7", color: "#15803d" };
  return { bg: "#e5e7eb", color: "#334155" };
}

function RoleBadge({ role }: { role: string }) {
  const c = roleColors(role);
  return (
    <View style={[s.roleBadge, { backgroundColor: c.bg }]}>
      <Text style={[s.roleBadgeText, { color: c.color }]}>{role}</Text>
    </View>
  );
}

export default function UsersScreen() {
  const { user: sessionUser } = useAuth();
  const sessionRole = String(sessionUser?.role || "").toUpperCase();
  const sessionUserId = sessionUser?.id;
  const canDeleteUsers = sessionRole === "OWNER" || sessionRole === "ADMIN";

  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [roleUpdates, setRoleUpdates] = useState<Record<string, string>>({});
  const [savingRoleId, setSavingRoleId] = useState<string | number | null>(null);
  const [deletingId, setDeletingId] = useState<string | number | null>(null);

  const load = useCallback(async () => {
    setError("");
    try {
      const res = await api.get("/api/users");
      const rows: UserRow[] = Array.isArray(res.data) ? res.data : res.data?.items || [];
      setUsers(rows);
      setRoleUpdates(Object.fromEntries(rows.map((u) => [String(u.id), u.role])));
    } catch (err: any) {
      setError(errMsg(err, "Failed to load users"));
      setUsers([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      load();
    }, [load])
  );

  const onRefresh = () => { setRefreshing(true); load(); };

  const filtered = users.filter((u) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return String(u.email || "").toLowerCase().includes(q) || String(u.role || "").toLowerCase().includes(q);
  });

  async function updateRole(u: UserRow) {
    const nextRole = roleUpdates[String(u.id)];
    if (!nextRole || nextRole === u.role) return;
    setSavingRoleId(u.id);
    try {
      await api.put(`/api/users/${u.id}/role`, { role: nextRole });
      await load();
    } catch (err: any) {
      Alert.alert("Update failed", errMsg(err, "Failed to update role."));
      setRoleUpdates((r) => ({ ...r, [String(u.id)]: u.role }));
    } finally {
      setSavingRoleId(null);
    }
  }

  function confirmDelete(u: UserRow) {
    if (u.role === "OWNER") { Alert.alert("Not allowed", "Owner user cannot be deleted."); return; }
    if (sessionUserId && String(u.id) === String(sessionUserId)) {
      Alert.alert("Not allowed", "You cannot delete your own user.");
      return;
    }
    Alert.alert("Delete user", `Delete "${u.email}"? This cannot be undone.`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete", style: "destructive",
        onPress: async () => {
          setDeletingId(u.id);
          try {
            await api.delete(`/api/users/${u.id}`);
            setUsers((cur) => cur.filter((x) => x.id !== u.id));
          } catch (err: any) {
            Alert.alert("Delete failed", errMsg(err, "Failed to delete user."));
          } finally {
            setDeletingId(null);
          }
        },
      },
    ]);
  }

  if (loading) return <LoadingSpinner message="Loading users…" />;

  return (
    <SafeAreaView style={s.root} edges={[]}>
      <ScrollView
        contentContainerStyle={s.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#0f766e" />}
      >
        <View style={s.headerRow}>
          <View style={{ flex: 1 }}>
            <Text style={s.heading}>Tenant Users</Text>
            <Text style={s.sub}>{users.length} user{users.length === 1 ? "" : "s"} in this tenant</Text>
          </View>
          <TouchableOpacity style={s.addBtn} onPress={() => setCreateOpen(true)} activeOpacity={0.85}>
            <Ionicons name="person-add-outline" size={16} color="#fff" />
            <Text style={s.addBtnText}>Create</Text>
          </TouchableOpacity>
        </View>

        {!!error && <ErrorBanner message={error} onRetry={load} />}

        {users.length > 0 && (
          <TextInput
            style={s.search}
            value={search}
            onChangeText={setSearch}
            placeholder="Search by email or role"
            placeholderTextColor="#94a3b8"
            autoCapitalize="none"
          />
        )}

        {filtered.length === 0 ? (
          <Text style={s.empty}>No users found.</Text>
        ) : (
          filtered.map((u) => {
            const roleLocked = u.role === "OWNER";
            const isCurrentUser = sessionUserId != null && String(u.id) === String(sessionUserId);
            const canDeleteThisUser = canDeleteUsers && !roleLocked && !isCurrentUser;
            const pendingRole = roleUpdates[String(u.id)] ?? u.role;
            return (
              <View key={String(u.id)} style={s.card}>
                <View style={s.rowBetween}>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={s.email} numberOfLines={1}>{u.email}</Text>
                    <Text style={s.meta}>Created {formatDateTime(u.createdAt)}</Text>
                  </View>
                  <RoleBadge role={u.role} />
                </View>

                {roleLocked ? (
                  <Text style={s.lockedNote}>Owner role is fixed at tenant signup</Text>
                ) : (
                  <View style={s.roleRow}>
                    <View style={s.roleChips}>
                      {ROLE_OPTIONS.map((r) => {
                        const active = pendingRole === r;
                        return (
                          <TouchableOpacity
                            key={r}
                            style={[s.roleChip, active && s.roleChipActive]}
                            onPress={() => setRoleUpdates((cur) => ({ ...cur, [String(u.id)]: r }))}
                          >
                            <Text style={[s.roleChipText, active && s.roleChipTextActive]}>{r}</Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                    {pendingRole !== u.role && (
                      <TouchableOpacity
                        style={[s.updateBtn, savingRoleId === u.id && { opacity: 0.6 }]}
                        onPress={() => updateRole(u)}
                        disabled={savingRoleId === u.id}
                      >
                        {savingRoleId === u.id
                          ? <ActivityIndicator size="small" color="#fff" />
                          : <Text style={s.updateBtnText}>Update Role</Text>}
                      </TouchableOpacity>
                    )}
                  </View>
                )}

                {isCurrentUser ? (
                  <Text style={s.lockedNote}>You cannot delete your own user</Text>
                ) : canDeleteUsers && !roleLocked ? (
                  <TouchableOpacity
                    style={[s.deleteBtn, (!canDeleteThisUser || deletingId === u.id) && { opacity: 0.5 }]}
                    onPress={() => confirmDelete(u)}
                    disabled={!canDeleteThisUser || deletingId === u.id}
                  >
                    {deletingId === u.id
                      ? <ActivityIndicator size="small" color="#b91c1c" />
                      : (
                        <>
                          <Ionicons name="trash-outline" size={14} color="#b91c1c" />
                          <Text style={s.deleteBtnText}>Delete</Text>
                        </>
                      )}
                  </TouchableOpacity>
                ) : null}
              </View>
            );
          })
        )}

        <View style={{ height: 32 }} />
      </ScrollView>

      <CreateUserModal
        visible={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={() => { setCreateOpen(false); load(); }}
      />
    </SafeAreaView>
  );
}

function CreateUserModal({
  visible, onClose, onCreated,
}: { visible: boolean; onClose: () => void; onCreated: () => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("AGENT");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (visible) { setEmail(""); setPassword(""); setRole("AGENT"); setError(""); }
  }, [visible]);

  async function submit() {
    if (!email.trim() || !password.trim()) { setError("Email and password are required."); return; }
    setSaving(true); setError("");
    try {
      await api.post("/api/users", { email: email.trim(), password, role });
      onCreated();
    } catch (err: any) {
      setError(errMsg(err, "Failed to create user."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      {/* KeyboardAvoidingView wraps the whole bottom sheet so it rides up
          above the keyboard instead of the Email/Password fields hiding
          under it — this is a bottom-anchored sheet (not a full-screen
          pageSheet), so the avoidance has to move the sheet, not just the
          inner ScrollView. */}
      <KeyboardAvoidingView
        style={s.overlay}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <View style={s.modalCard}>
          <View style={s.modalHeader}>
            <Text style={s.modalTitle}>Create User</Text>
            <TouchableOpacity onPress={onClose} style={s.closeBtn}>
              <Ionicons name="close" size={20} color="#475569" />
            </TouchableOpacity>
          </View>
          <ScrollView
            contentContainerStyle={{ padding: 16, gap: 12 }}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="interactive"
          >
            <Text style={s.modalSub}>Add a new admin or agent to this tenant.</Text>
            {!!error && <Text style={s.modalError}>{error}</Text>}
            <View>
              <Text style={s.label}>Email</Text>
              <TextInput
                style={s.input}
                value={email}
                onChangeText={setEmail}
                placeholder="agent1@example.com"
                placeholderTextColor="#94a3b8"
                autoCapitalize="none"
                keyboardType="email-address"
              />
            </View>
            <View>
              <Text style={s.label}>Password</Text>
              <TextInput
                style={s.input}
                value={password}
                onChangeText={setPassword}
                placeholder="Set a temporary password"
                placeholderTextColor="#94a3b8"
                secureTextEntry
              />
            </View>
            <View>
              <Text style={s.label}>Role</Text>
              <View style={s.roleChips}>
                {ROLE_OPTIONS.map((r) => {
                  const active = role === r;
                  return (
                    <TouchableOpacity
                      key={r}
                      style={[s.roleChip, active && s.roleChipActive]}
                      onPress={() => setRole(r)}
                    >
                      <Text style={[s.roleChipText, active && s.roleChipTextActive]}>{r}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
            <TouchableOpacity style={[s.saveBtn, saving && { opacity: 0.6 }]} onPress={submit} disabled={saving}>
              {saving ? <ActivityIndicator color="#fff" /> : <Text style={s.saveBtnText}>Create User</Text>}
            </TouchableOpacity>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const mediumFont = Platform.OS === "android" ? "sans-serif-medium" : undefined;
const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#f1f5f9" },
  scroll: { padding: 16, gap: 12 },
  headerRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  heading: { fontSize: 20, fontWeight: "700", color: "#0f172a", fontFamily: mediumFont },
  sub: { fontSize: 13, color: "#64748b", marginTop: 2 },
  addBtn: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "#0f766e", borderRadius: 8, paddingHorizontal: 14, paddingVertical: 9 },
  addBtnText: { color: "#fff", fontWeight: "700", fontSize: 13.5, fontFamily: mediumFont },
  search: { borderWidth: 1, borderColor: "#e2e8f0", borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: "#0f172a", backgroundColor: "#fff" },
  empty: { fontSize: 13, color: "#94a3b8", textAlign: "center", paddingVertical: 24 },
  card: { backgroundColor: "#fff", borderRadius: 14, padding: 16, gap: 10, shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 1 },
  rowBetween: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  email: { fontSize: 15, fontWeight: "700", color: "#0f172a" },
  meta: { fontSize: 12, color: "#94a3b8", marginTop: 3 },
  roleBadge: { alignSelf: "flex-start", borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  roleBadgeText: { fontSize: 11.5, fontWeight: "800", letterSpacing: 0.4 },
  roleRow: { flexDirection: "row", alignItems: "center", gap: 10, flexWrap: "wrap" },
  roleChips: { flexDirection: "row", gap: 8 },
  roleChip: { borderWidth: 1, borderColor: "#cbd5e1", borderRadius: 20, paddingHorizontal: 14, paddingVertical: 6 },
  roleChipActive: { backgroundColor: "#0f766e", borderColor: "#0f766e" },
  roleChipText: { fontSize: 12.5, fontWeight: "700", color: "#475569" },
  roleChipTextActive: { color: "#fff" },
  updateBtn: { backgroundColor: "#0f172a", borderRadius: 8, paddingHorizontal: 14, paddingVertical: 8, alignItems: "center", justifyContent: "center", minWidth: 96 },
  updateBtnText: { color: "#fff", fontWeight: "700", fontSize: 12.5 },
  lockedNote: { fontSize: 12.5, color: "#64748b", fontWeight: "600" },
  deleteBtn: { flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start", borderWidth: 1, borderColor: "#fecaca", backgroundColor: "#fef2f2", borderRadius: 8, paddingHorizontal: 12, paddingVertical: 7 },
  deleteBtnText: { fontSize: 12.5, fontWeight: "700", color: "#b91c1c" },
  overlay: { flex: 1, backgroundColor: "rgba(15,23,42,0.5)", justifyContent: "flex-end" },
  modalCard: { backgroundColor: "#fff", borderTopLeftRadius: 18, borderTopRightRadius: 18, maxHeight: "88%" },
  modalHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingTop: 16, paddingBottom: 4, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: "#e2e8f0" },
  modalTitle: { fontSize: 17, fontWeight: "700", color: "#0f172a" },
  modalSub: { fontSize: 13, color: "#64748b", marginTop: -6 },
  closeBtn: { padding: 6, borderRadius: 8, backgroundColor: "#f1f5f9" },
  modalError: { fontSize: 13, fontWeight: "600", color: "#dc2626", backgroundColor: "#fef2f2", borderRadius: 8, padding: 10 },
  label: { fontSize: 12, fontWeight: "700", color: "#475569", textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 6 },
  input: { borderWidth: 1, borderColor: "#e2e8f0", borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: "#0f172a", backgroundColor: "#f8fafc" },
  saveBtn: { backgroundColor: "#0f766e", borderRadius: 10, paddingVertical: 14, alignItems: "center", marginTop: 6 },
  saveBtnText: { color: "#fff", fontWeight: "700", fontSize: 15, fontFamily: mediumFont },
});
