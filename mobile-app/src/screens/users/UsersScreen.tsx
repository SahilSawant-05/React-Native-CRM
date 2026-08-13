import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator, Alert, Modal, Platform, ScrollView, StyleSheet,
  Text, TextInput, TouchableOpacity, View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import api from "../../api/client";
import { useAuth } from "../../auth/AuthContext";

interface UserRow {
  id: string | number;
  email?: string;
  role?: string;
  createdAt?: string;
}

const ROLE_OPTIONS = ["ADMIN", "AGENT"];

function errMsg(err: any, fallback: string): string {
  const d = err?.response?.data;
  if (typeof d === "string") return d;
  return d?.message || d?.error || err?.message || fallback;
}

export default function UsersScreen() {
  const { user } = useAuth();
  const role = String(user?.role || "").toUpperCase();
  const isPrivileged = ["ADMIN", "OWNER"].includes(role);
  const sessionUserId = String(user?.id ?? "");

  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);

  const load = useCallback(async () => {
    setError("");
    try {
      const res = await api.get("/api/users");
      setUsers(Array.isArray(res.data) ? res.data : res.data?.items || []);
    } catch (err: any) {
      setError(errMsg(err, "Unable to load users. This screen is available to admins and owners only."));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return users;
    return users.filter((u) =>
      String(u.email || "").toLowerCase().includes(q) || String(u.role || "").toLowerCase().includes(q)
    );
  }, [users, search]);

  const changeRole = async (u: UserRow, nextRole: string) => {
    if (String(u.role).toUpperCase() === nextRole) return;
    try {
      await api.put(`/api/users/${u.id}/role`, { role: nextRole });
      setUsers((cur) => cur.map((x) => (x.id === u.id ? { ...x, role: nextRole } : x)));
    } catch (err: any) {
      Alert.alert("Update failed", errMsg(err, "Could not update role."));
    }
  };

  const removeUser = (u: UserRow) => {
    Alert.alert("Delete user", `Remove ${u.email}? This cannot be undone.`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete", style: "destructive",
        onPress: async () => {
          try {
            await api.delete(`/api/users/${u.id}`);
            setUsers((cur) => cur.filter((x) => x.id !== u.id));
          } catch (err: any) {
            Alert.alert("Delete failed", errMsg(err, "Could not delete user."));
          }
        },
      },
    ]);
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.root, styles.center]} edges={[]}>
        <ActivityIndicator color="#0f766e" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.root} edges={[]}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={undefined}
        onScrollEndDrag={() => {}}
      >
        <View style={styles.headerRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.heading}>Team</Text>
            <Text style={styles.sub}>{users.length} member{users.length === 1 ? "" : "s"}</Text>
          </View>
          {isPrivileged && (
            <TouchableOpacity style={styles.addBtn} onPress={() => setCreateOpen(true)}>
              <Ionicons name="person-add-outline" size={16} color="#fff" />
              <Text style={styles.addBtnText}>Add</Text>
            </TouchableOpacity>
          )}
        </View>

        {!!error && (
          <View style={styles.errorBanner}>
            <Ionicons name="alert-circle-outline" size={18} color="#dc2626" style={{ marginTop: 1 }} />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {users.length > 0 && (
          <TextInput
            style={styles.search}
            value={search}
            onChangeText={setSearch}
            placeholder="Search by email or role"
            placeholderTextColor="#94a3b8"
            autoCapitalize="none"
          />
        )}

        {filtered.map((u) => {
          const uRole = String(u.role || "AGENT").toUpperCase();
          const isOwner = uRole === "OWNER";
          const isSelf = sessionUserId && String(u.id) === sessionUserId;
          const canDelete = isPrivileged && !isOwner && !isSelf;
          return (
            <View key={String(u.id)} style={styles.card}>
              <View style={styles.rowBetween}>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.email} numberOfLines={1}>{u.email || "Unknown"}</Text>
                  {!!u.createdAt && (
                    <Text style={styles.meta}>Joined {new Date(u.createdAt).toLocaleDateString()}</Text>
                  )}
                </View>
                {canDelete && (
                  <TouchableOpacity onPress={() => removeUser(u)} style={styles.iconBtn}>
                    <Ionicons name="trash-outline" size={18} color="#dc2626" />
                  </TouchableOpacity>
                )}
              </View>
              {/* Role chips */}
              {isOwner || !isPrivileged || isSelf ? (
                <View style={[styles.roleBadge, isOwner && styles.roleBadgeOwner]}>
                  <Text style={[styles.roleBadgeText, isOwner && styles.roleBadgeTextOwner]}>{uRole}</Text>
                </View>
              ) : (
                <View style={styles.roleChips}>
                  {ROLE_OPTIONS.map((r) => {
                    const active = uRole === r;
                    return (
                      <TouchableOpacity
                        key={r}
                        style={[styles.roleChip, active && styles.roleChipActive]}
                        onPress={() => changeRole(u, r)}
                      >
                        <Text style={[styles.roleChipText, active && styles.roleChipTextActive]}>{r}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}
            </View>
          );
        })}

        {filtered.length === 0 && !error && (
          <Text style={styles.empty}>No users match your search.</Text>
        )}

        <View style={{ height: 32 }} />
      </ScrollView>

      <CreateUserModal
        visible={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={(created) => { setUsers((cur) => [created, ...cur]); setCreateOpen(false); }}
      />
    </SafeAreaView>
  );
}

function CreateUserModal({
  visible, onClose, onCreated,
}: { visible: boolean; onClose: () => void; onCreated: (u: UserRow) => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("AGENT");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (visible) { setEmail(""); setPassword(""); setRole("AGENT"); setError(""); }
  }, [visible]);

  const submit = async () => {
    if (!email.trim() || !password) { setError("Email and password are required."); return; }
    setSaving(true); setError("");
    try {
      const res = await api.post("/api/users", { email: email.trim(), password, role });
      onCreated(res.data || { id: Date.now(), email: email.trim(), role });
    } catch (err: any) {
      setError(errMsg(err, "Could not create user."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.modalCard}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Add team member</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={20} color="#475569" />
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }} keyboardShouldPersistTaps="handled">
            {!!error && <Text style={styles.modalError}>{error}</Text>}
            <View>
              <Text style={styles.label}>Email</Text>
              <TextInput
                style={styles.input}
                value={email}
                onChangeText={setEmail}
                placeholder="name@company.com"
                placeholderTextColor="#94a3b8"
                autoCapitalize="none"
                keyboardType="email-address"
              />
            </View>
            <View>
              <Text style={styles.label}>Temporary password</Text>
              <TextInput
                style={styles.input}
                value={password}
                onChangeText={setPassword}
                placeholder="Set a password"
                placeholderTextColor="#94a3b8"
                secureTextEntry
              />
            </View>
            <View>
              <Text style={styles.label}>Role</Text>
              <View style={styles.roleChips}>
                {ROLE_OPTIONS.map((r) => {
                  const active = role === r;
                  return (
                    <TouchableOpacity
                      key={r}
                      style={[styles.roleChip, active && styles.roleChipActive]}
                      onPress={() => setRole(r)}
                    >
                      <Text style={[styles.roleChipText, active && styles.roleChipTextActive]}>{r}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
            <TouchableOpacity
              style={[styles.saveBtn, saving && { opacity: 0.6 }]}
              onPress={submit}
              disabled={saving}
            >
              {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>Create user</Text>}
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const mediumFont = Platform.OS === "android" ? "sans-serif-medium" : undefined;
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#f1f5f9" },
  center: { justifyContent: "center", alignItems: "center" },
  scroll: { padding: 16, gap: 12 },
  headerRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  heading: { fontSize: 20, fontWeight: "700", color: "#0f172a", fontFamily: mediumFont },
  sub: { fontSize: 13, color: "#64748b", marginTop: 2 },
  addBtn: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "#0f766e", borderRadius: 8, paddingHorizontal: 14, paddingVertical: 9 },
  addBtnText: { color: "#fff", fontWeight: "700", fontSize: 13.5, fontFamily: mediumFont },
  errorBanner: { flexDirection: "row", alignItems: "flex-start", gap: 8, backgroundColor: "#fef2f2", borderRadius: 10, borderWidth: 1, borderColor: "#fecaca", padding: 12 },
  errorText: { flex: 1, fontSize: 13, fontWeight: "600", color: "#dc2626" },
  search: { borderWidth: 1, borderColor: "#e2e8f0", borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: "#0f172a", backgroundColor: "#fff" },
  card: { backgroundColor: "#fff", borderRadius: 14, padding: 16, gap: 10, shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 1 },
  rowBetween: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  email: { fontSize: 15, fontWeight: "700", color: "#0f172a" },
  meta: { fontSize: 12, color: "#94a3b8", marginTop: 3 },
  iconBtn: { padding: 6, borderRadius: 8, backgroundColor: "#fef2f2" },
  roleBadge: { alignSelf: "flex-start", backgroundColor: "#eef2ff", borderRadius: 20, paddingHorizontal: 12, paddingVertical: 5 },
  roleBadgeOwner: { backgroundColor: "#fef3c7" },
  roleBadgeText: { fontSize: 12, fontWeight: "800", color: "#4338ca", letterSpacing: 0.4 },
  roleBadgeTextOwner: { color: "#b45309" },
  roleChips: { flexDirection: "row", gap: 8 },
  roleChip: { borderWidth: 1, borderColor: "#cbd5e1", borderRadius: 20, paddingHorizontal: 14, paddingVertical: 6 },
  roleChipActive: { backgroundColor: "#0f766e", borderColor: "#0f766e" },
  roleChipText: { fontSize: 12.5, fontWeight: "700", color: "#475569" },
  roleChipTextActive: { color: "#fff" },
  empty: { fontSize: 13, color: "#94a3b8", textAlign: "center", paddingVertical: 20 },
  overlay: { flex: 1, backgroundColor: "rgba(15,23,42,0.5)", justifyContent: "flex-end" },
  modalCard: { backgroundColor: "#fff", borderTopLeftRadius: 18, borderTopRightRadius: 18, maxHeight: "88%" },
  modalHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingTop: 16, paddingBottom: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: "#e2e8f0" },
  modalTitle: { fontSize: 17, fontWeight: "700", color: "#0f172a" },
  closeBtn: { padding: 6, borderRadius: 8, backgroundColor: "#f1f5f9" },
  modalError: { fontSize: 13, fontWeight: "600", color: "#dc2626", backgroundColor: "#fef2f2", borderRadius: 8, padding: 10 },
  label: { fontSize: 12, fontWeight: "700", color: "#475569", textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 6 },
  input: { borderWidth: 1, borderColor: "#e2e8f0", borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: "#0f172a", backgroundColor: "#f8fafc" },
  saveBtn: { backgroundColor: "#0f766e", borderRadius: 10, paddingVertical: 14, alignItems: "center", marginTop: 6 },
  saveBtnText: { color: "#fff", fontWeight: "700", fontSize: 15, fontFamily: mediumFont },
});
