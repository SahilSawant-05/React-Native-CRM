import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

const mediumFont = Platform.OS === "android" ? "sans-serif-medium" : undefined;

// iOS-style pastel avatar palette, hashed by name
const AVATAR_PALETTE = [
  { bg: "#fee2e2", fg: "#b91c1c" },
  { bg: "#ffedd5", fg: "#c2410c" },
  { bg: "#fef3c7", fg: "#a16207" },
  { bg: "#dcfce7", fg: "#15803d" },
  { bg: "#ccfbf1", fg: "#0f766e" },
  { bg: "#dbeafe", fg: "#1d4ed8" },
  { bg: "#ede9fe", fg: "#6d28d9" },
  { bg: "#fce7f3", fg: "#be185d" },
];

function avatarColors(name: string) {
  let hash = 0;
  const s = name || "?";
  for (let i = 0; i < s.length; i++) hash = (hash * 31 + s.charCodeAt(i)) | 0;
  return AVATAR_PALETTE[Math.abs(hash) % AVATAR_PALETTE.length];
}
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useFocusEffect } from "@react-navigation/native";
import { fetchContacts, ContactFilters } from "../../api/contacts";
import { emailValidationMessage, phoneValidationMessage } from "../../utils/validation";
import api from "../../api/client";
import { Contact } from "../../types";
import { LoadingSpinner } from "../../components/common/LoadingSpinner";
import { ErrorBanner } from "../../components/common/ErrorBanner";

const LEAD_SOURCES = [
  { value: "", label: "Select source" },
  { value: "WHATSAPP", label: "WhatsApp" },
  { value: "WEBSITE", label: "Website" },
  { value: "FACEBOOK", label: "Facebook" },
  { value: "INSTAGRAM", label: "Instagram" },
  { value: "GOOGLE_ADS", label: "Google Ads" },
  { value: "REFERRAL", label: "Referral" },
  { value: "WALK_IN", label: "Walk-in" },
  { value: "PORTAL", label: "Portal" },
  { value: "CAMPAIGN", label: "Campaign" },
  { value: "OTHER", label: "Other" },
];

const COUNTRY_CODES = [
  { code: "+91", flag: "🇮🇳", label: "India" },
  { code: "+1", flag: "🇺🇸", label: "USA" },
];

function AddContactModal({ visible, onClose, onSaved }: {
  visible: boolean; onClose: () => void; onSaved: () => void;
}) {
  const [form, setForm] = useState({
    name: "", email: "", phone: "", company: "", tags: "", leadSource: "", countryCode: "+91",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [showCountryDropdown, setShowCountryDropdown] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  function set(key: string, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setError("");
  }

  function selectCountryCode(code: string) {
    set("countryCode", code);
    setShowCountryDropdown(false);
  }

  async function handleSave() {
    if (!form.name.trim()) { setError("Name is required."); return; }
    // Format validation (web parity): only enforced when a value is entered,
    // since email and phone are optional.
    const emailErr = emailValidationMessage(form.email);
    if (emailErr) { setError(emailErr); return; }
    const phoneErr = phoneValidationMessage(form.phone);
    if (phoneErr) { setError(phoneErr); return; }
    setSaving(true);
    setError("");
    try {
      const phoneTrimmed = form.phone.trim();
      await api.post("/api/contacts", {
        name: form.name.trim(),
        email: form.email.trim() || null,
        phone: phoneTrimmed ? `${form.countryCode} ${phoneTrimmed}` : null,
        company: form.company.trim() || null,
        tags: form.tags.trim() || null,
        leadSource: form.leadSource || null,
      });
      setForm({ name: "", email: "", phone: "", company: "", tags: "", leadSource: "", countryCode: "+91" });
      onSaved();
      onClose();
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || "Failed to save contact.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={{ flex: 1, backgroundColor: "#f8fafc" }}>
        <View style={addStyles.header}>
          <Text style={addStyles.title}>New Contact</Text>
          <TouchableOpacity onPress={onClose} style={addStyles.cancelBtn}>
            <Text style={addStyles.cancelText}>Cancel</Text>
          </TouchableOpacity>
        </View>

        {/* KeyboardAvoidingView wraps both the scrollable form AND the footer,
            so the Save button rides above the keyboard instead of hiding behind it. */}
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 0}
        >
          <ScrollView
            ref={scrollRef}
            contentContainerStyle={addStyles.body}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="interactive"
            showsVerticalScrollIndicator={false}
          >
            {!!error && <View style={addStyles.errorBox}><Text style={addStyles.errorText}>{error}</Text></View>}

            <View style={addStyles.field}>
              <Text style={addStyles.label}>Full Name *</Text>
              <TextInput
                style={addStyles.input}
                placeholder="John Doe"
                placeholderTextColor="#94a3b8"
                value={form.name}
                onChangeText={(v) => set("name", v)}
                autoCapitalize="words"
                autoCorrect={false}
              />
            </View>

            <View style={addStyles.field}>
              <Text style={addStyles.label}>Email</Text>
              <TextInput
                style={addStyles.input}
                placeholder="john@example.com"
                placeholderTextColor="#94a3b8"
                value={form.email}
                onChangeText={(v) => set("email", v)}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>

            {/* Phone with country code dropdown */}
            <View style={[addStyles.field, { zIndex: 20 }]}>
              <Text style={addStyles.label}>Phone</Text>
              <View style={addStyles.phoneRow}>
                <View style={{ zIndex: 20 }}>
                  <TouchableOpacity
                    style={addStyles.countryBtn}
                    onPress={() => setShowCountryDropdown((v) => !v)}
                    activeOpacity={0.7}
                  >
                    <Text style={addStyles.countryBtnText}>
                      {COUNTRY_CODES.find((c) => c.code === form.countryCode)?.flag} {form.countryCode}
                    </Text>
                    <Ionicons name="chevron-down" size={14} color="#6b7280" style={{ marginLeft: "auto" }} />
                  </TouchableOpacity>

                  {showCountryDropdown && (
                    <View style={addStyles.dropdown}>
                      {COUNTRY_CODES.map((c) => (
                        <TouchableOpacity
                          key={c.code}
                          style={[
                            addStyles.dropdownItem,
                            form.countryCode === c.code && addStyles.dropdownItemActive,
                          ]}
                          onPress={() => selectCountryCode(c.code)}
                        >
                          <Text style={addStyles.dropdownItemText}>
                            {c.flag} {c.code} · {c.label}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}
                </View>

                <TextInput
                  style={[addStyles.input, addStyles.phoneInput]}
                  placeholder="9876543210"
                  placeholderTextColor="#94a3b8"
                  value={form.phone}
                  // Digits only, capped at 10 — the country code (+91) is shown
                  // in the dropdown to the left and prepended on save, so the
                  // field holds only the 10-digit national number (web parity).
                  onChangeText={(v) => set("phone", v.replace(/\D/g, "").slice(0, 10))}
                  keyboardType="phone-pad"
                  maxLength={10}
                  autoCorrect={false}
                  onFocus={() => {
                    // Nudge the scroll so the phone row clears the keyboard on smaller screens
                    setTimeout(() => scrollRef.current?.scrollTo({ y: 140, animated: true }), 150);
                  }}
                />
              </View>
            </View>

            <View style={addStyles.field}>
              <Text style={addStyles.label}>Company</Text>
              <TextInput
                style={addStyles.input}
                placeholder="Acme Corp"
                placeholderTextColor="#94a3b8"
                value={form.company}
                onChangeText={(v) => set("company", v)}
                autoCapitalize="words"
                autoCorrect={false}
                onFocus={() => {
                  setTimeout(() => scrollRef.current?.scrollTo({ y: 220, animated: true }), 150);
                }}
              />
            </View>

            <View style={addStyles.field}>
              <Text style={addStyles.label}>Tags (comma separated)</Text>
              <TextInput
                style={addStyles.input}
                placeholder="hot-lead, vip"
                placeholderTextColor="#94a3b8"
                value={form.tags}
                onChangeText={(v) => set("tags", v)}
                autoCapitalize="words"
                autoCorrect={false}
                onFocus={() => {
                  setTimeout(() => scrollRef.current?.scrollTo({ y: 300, animated: true }), 150);
                }}
              />
            </View>

            {/* Lead Source picker */}
            <View style={addStyles.field}>
              <Text style={addStyles.label}>Lead Source</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 4 }}>
                <View style={{ flexDirection: "row", gap: 8 }}>
                  {LEAD_SOURCES.filter(s => s.value).map((src) => (
                    <TouchableOpacity
                      key={src.value}
                      onPress={() => set("leadSource", form.leadSource === src.value ? "" : src.value)}
                      style={[addStyles.srcChip, form.leadSource === src.value && addStyles.srcChipActive]}
                    >
                      <Text style={[addStyles.srcChipText, form.leadSource === src.value && addStyles.srcChipTextActive]}>
                        {src.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>
            </View>

            {/* Extra bottom padding so the last field never sits flush against
                the footer / keyboard edge */}
            <View style={{ height: 24 }} />
          </ScrollView>

          <View style={addStyles.footer}>
            <TouchableOpacity style={addStyles.saveBtn} onPress={handleSave} disabled={saving} activeOpacity={0.8}>
              {saving ? <ActivityIndicator color="#fff" /> : <Text style={addStyles.saveBtnText}>Add Contact</Text>}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

const addStyles = StyleSheet.create({
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    padding: 20, borderBottomWidth: 1, borderBottomColor: "#e2e8f0", backgroundColor: "#fff",
  },
  title: { fontSize: 17, fontWeight: "700", color: "#0f172a" },
  cancelBtn: { backgroundColor: "#f1f5f9", borderRadius: 8, paddingHorizontal: 14, paddingVertical: 8 },
  cancelText: { color: "#475569", fontWeight: "600" },
  body: { padding: 16, gap: 14, flexGrow: 1 },
  errorBox: { backgroundColor: "#fef2f2", borderRadius: 10, borderWidth: 1, borderColor: "#fecaca", padding: 12 },
  errorText: { color: "#dc2626", fontSize: 13 },
  field: { gap: 6 },
  label: { fontSize: 13, fontWeight: "600", color: "#374151" },
  input: {
    borderWidth: 1, borderColor: "#d1d5db", borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: "#0f172a", backgroundColor: "#fff",
  },
  phoneRow: { flexDirection: "row", gap: 8, alignItems: "flex-start" },
  phoneInput: { flex: 1 },
  countryBtn: {
    flexDirection: "row", alignItems: "center", gap: 4,
    borderWidth: 1, borderColor: "#d1d5db", borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 10, backgroundColor: "#fff",
    minWidth: 88,
  },
  countryBtnText: { fontSize: 14, fontWeight: "600", color: "#0f172a" },
  countryBtnCaret: { fontSize: 11, color: "#64748b", marginLeft: "auto" },
  dropdown: {
    position: "absolute",
    top: 46,
    left: 0,
    minWidth: 160,
    backgroundColor: "#fff",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 10,
    zIndex: 30,
    overflow: "hidden",
  },
  dropdownItem: { paddingHorizontal: 12, paddingVertical: 10 },
  dropdownItemActive: { backgroundColor: "#f0fdfa" },
  dropdownItemText: { fontSize: 13, fontWeight: "600", color: "#0f172a" },
  srcChip: {
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20,
    backgroundColor: "#f1f5f9", borderWidth: 1, borderColor: "#e2e8f0",
  },
  srcChipActive: { backgroundColor: "#0f766e", borderColor: "#0f766e" },
  srcChipText: { fontSize: 12, fontWeight: "600", color: "#475569" },
  srcChipTextActive: { color: "#fff" },
  footer: { padding: 16, borderTopWidth: 1, borderTopColor: "#e2e8f0", backgroundColor: "#fff" },
  saveBtn: { backgroundColor: "#0f766e", borderRadius: 12, paddingVertical: 15, alignItems: "center" },
  saveBtnText: { color: "#fff", fontSize: 16, fontWeight: "700" },
});

type Props = {
  navigation: NativeStackNavigationProp<any>;
};

function normalizeTags(tags: any): string[] {
  if (Array.isArray(tags)) return tags.filter(Boolean);
  if (typeof tags === "string" && tags) return tags.split(",").map(t => t.trim()).filter(Boolean);
  return [];
}

function ContactRow({ contact, onPress }: { contact: Contact; onPress: () => void }) {
  const initials = (contact.name || "?")
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
  const tags = normalizeTags(contact.tags);
  const colors = avatarColors(contact.name || "?");

  return (
    <TouchableOpacity style={styles.row} onPress={onPress} activeOpacity={0.7}>
      <View style={[styles.avatar, { backgroundColor: colors.bg }]}>
        <Text style={[styles.avatarText, { color: colors.fg }]}>{initials}</Text>
      </View>
      <View style={styles.rowInfo}>
        <Text style={styles.name}>{contact.name}</Text>
        {!!contact.phone && <Text style={styles.sub}>{contact.phone}</Text>}
        {!!contact.email && <Text style={styles.sub}>{contact.email}</Text>}
      </View>
      {tags.length > 0 && (
        <View style={styles.tagBadge}>
          <Text style={styles.tagText}>{tags[0]}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

// ─── Filter options (web parity: Contacts.jsx DEFAULT_FILTERS) ────────────────
const FILTER_LEAD_SOURCES = [
  "WHATSAPP", "EMAIL", "WEBSITE_FORM", "WEBSITE", "FACEBOOK", "INSTAGRAM",
  "GOOGLE_ADS", "REFERRAL", "WALK_IN", "PORTAL", "CAMPAIGN", "CSV_IMPORT", "MANUAL", "OTHER",
];
const FILTER_STAGES = ["NEW", "QUALIFIED", "FOLLOW_UP", "WON", "LOST"];
const FILTER_CONVERSATION = ["OPEN", "CLOSED"];

function labelize(v: string) {
  return v.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function ContactFilterModal({
  visible, initial, onClose, onApply,
}: {
  visible: boolean;
  initial: ContactFilters;
  onClose: () => void;
  onApply: (f: ContactFilters) => void;
}) {
  const [draft, setDraft] = useState<ContactFilters>(initial);

  useEffect(() => { if (visible) setDraft(initial); }, [visible, initial]);

  const set = (key: keyof ContactFilters, value: string) =>
    setDraft((d) => ({ ...d, [key]: d[key] === value ? "" : value }));

  const Chips = ({ label, field, options }: { label: string; field: keyof ContactFilters; options: string[] }) => (
    <View style={fm.group}>
      <Text style={fm.groupLabel}>{label}</Text>
      <View style={fm.chipWrap}>
        {options.map((opt) => {
          const active = draft[field] === opt;
          return (
            <TouchableOpacity key={opt} style={[fm.chip, active && fm.chipActive]} onPress={() => set(field, opt)}>
              <Text style={[fm.chipText, active && fm.chipTextActive]}>{labelize(opt)}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={{ flex: 1, backgroundColor: "#f8fafc" }}>
        <View style={fm.header}>
          <Text style={fm.title}>Filter Contacts</Text>
          <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Ionicons name="close" size={22} color="#6b7280" />
          </TouchableOpacity>
        </View>
        <ScrollView contentContainerStyle={fm.body} keyboardShouldPersistTaps="handled">
          <Chips label="Lead Source" field="leadSource" options={FILTER_LEAD_SOURCES} />
          <Chips label="Stage" field="stage" options={FILTER_STAGES} />
          <Chips label="Conversation" field="conversationStatus" options={FILTER_CONVERSATION} />

          <View style={fm.group}>
            <Text style={fm.groupLabel}>City</Text>
            <TextInput
              style={fm.input}
              value={draft.city ?? ""}
              onChangeText={(v) => setDraft((d) => ({ ...d, city: v }))}
              placeholder="e.g. Mumbai"
              placeholderTextColor="#94a3b8"
            />
          </View>
          <View style={fm.group}>
            <Text style={fm.groupLabel}>Tag</Text>
            <TextInput
              style={fm.input}
              value={draft.tag ?? ""}
              onChangeText={(v) => setDraft((d) => ({ ...d, tag: v }))}
              placeholder="e.g. hot-lead"
              placeholderTextColor="#94a3b8"
              autoCapitalize="none"
            />
          </View>
        </ScrollView>
        <View style={fm.footer}>
          <TouchableOpacity style={fm.clearBtn} onPress={() => onApply({})} activeOpacity={0.85}>
            <Text style={fm.clearBtnText}>Clear all</Text>
          </TouchableOpacity>
          <TouchableOpacity style={fm.applyBtn} onPress={() => onApply(draft)} activeOpacity={0.85}>
            <Text style={fm.applyBtnText}>Apply filters</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

export default function ContactsScreen({ navigation }: Props) {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");
  const [errorDetail, setErrorDetail] = useState("");
  const [allContacts, setAllContacts] = useState<Contact[]>([]);
  const [addOpen, setAddOpen] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [filters, setFilters] = useState<ContactFilters>({});

  const searchRef = useRef(search);
  const filtersRef = useRef<ContactFilters>({});
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const activeFilterCount = Object.values(filters).filter((v) => v != null && String(v).trim() !== "").length;

  const applyFilter = (data: Contact[], q: string) => {
    const query = q.toLowerCase().trim();
    if (!query) return data;
    return data.filter(c =>
      (c.name || "").toLowerCase().includes(query) ||
      (c.phone || "").toLowerCase().includes(query) ||
      (c.email || "").toLowerCase().includes(query)
    );
  };

  // The search query that the currently-loaded pages correspond to, so
  // loadMore always paginates the SAME query the list is showing.
  const activeQueryRef = useRef("");

  const load = useCallback(async (p = 0, q = "", silent = false) => {
    if (p === 0 && !silent) setLoading(true);
    else if (p > 0) setLoadingMore(true);
    setError("");
    setErrorDetail("");
    try {
      // Server-side search + pagination (web parity). The server returns the
      // matching page, so with a huge address book search still finds contacts
      // that were never loaded on screen — a client-side filter can't.
      const data = await fetchContacts({ page: p, size: 50, search: q, filters: filtersRef.current });
      const items = data.content ?? [];

      // Drop a stale response: if the user has since changed the query, this
      // page belongs to an old search and must not overwrite the new results.
      if (q !== searchRef.current) return;

      setAllContacts((prev) => {
        const merged = p === 0 ? items : [...prev, ...items];
        setContacts(merged);
        return merged;
      });

      activeQueryRef.current = q;
      setTotalPages(data.totalPages ?? 1);
      setPage(p);
    } catch (err: any) {
      const status = err?.response?.status;
      const msg = err?.response?.data?.message || err?.response?.data?.error || err.message || "Failed to load contacts";
      setError(msg);
      setErrorDetail(status ? `HTTP ${status} — ${err.config?.url ?? ""}` : err.message ?? "");
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, []);

  useEffect(() => { load(0, ""); }, []);

  // Silently refresh when returning to the list (e.g. after editing or
  // deleting a contact in the detail screen) so the list never shows stale
  // rows. Skip the very first focus, which the mount effect already handled.
  const didInitialFocus = useRef(false);
  useFocusEffect(
    useCallback(() => {
      if (!didInitialFocus.current) {
        didInitialFocus.current = true;
        return;
      }
      // Silently reload the active query so edits/deletes are reflected.
      load(0, searchRef.current || "", true);
    }, [load])
  );

  function handleSearch(text: string) {
    setSearch(text);
    searchRef.current = text;

    // Instant preview: filter the rows already on screen so typing feels
    // responsive. The debounced server search below then replaces this with
    // the authoritative, fully-paginated result set.
    setAllContacts((all) => {
      setContacts(applyFilter(all, text));
      return all;
    });

    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (text.trim()) {
      // Debounced server-side search (finds matches across the whole address
      // book, not just the pages already loaded).
      debounceRef.current = setTimeout(() => load(0, text, true), 400);
    } else {
      // Search cleared — reload the full first page from the server so the
      // complete list comes back (not the leftover search results).
      load(0, "", true);
    }
  }

  function loadMore() {
    // Paginate whichever query the loaded list currently reflects.
    if (!loadingMore && !loading && page + 1 < totalPages) {
      load(page + 1, activeQueryRef.current);
    }
  }

  function applyFilters(next: ContactFilters) {
    setFilters(next);
    filtersRef.current = next;
    setFilterOpen(false);
    setLoading(true);
    load(0, searchRef.current || "");
  }

  if (loading) return <LoadingSpinner message="Loading contacts…" />;

  return (
    <SafeAreaView style={styles.root} edges={[]}>
      <AddContactModal
        visible={addOpen}
        onClose={() => setAddOpen(false)}
        onSaved={() => load(0, search)}
      />

      <View style={styles.searchBar}>
        <View style={styles.searchField}>
          <Ionicons name="search" size={17} color="#9ca3af" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search contacts…"
            placeholderTextColor="#9ca3af"
            value={search}
            onChangeText={handleSearch}
            clearButtonMode="while-editing"
            returnKeyType="search"
            autoCorrect={false}
            autoCapitalize="none"
          />
        </View>
        <TouchableOpacity
          style={[styles.filterBtn, activeFilterCount > 0 && styles.filterBtnActive]}
          onPress={() => setFilterOpen(true)}
          activeOpacity={0.7}
        >
          <Ionicons name="options-outline" size={20} color={activeFilterCount > 0 ? "#0f766e" : "#6b7280"} />
          {activeFilterCount > 0 && (
            <View style={styles.filterCountBadge}>
              <Text style={styles.filterCountText}>{activeFilterCount}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      <ContactFilterModal
        visible={filterOpen}
        initial={filters}
        onClose={() => setFilterOpen(false)}
        onApply={applyFilters}
      />

      {!!error && <ErrorBanner message={error} detail={errorDetail} onRetry={() => load(0, search)} />}

      <FlatList
        data={contacts}
        keyExtractor={(item, index) => String(item.id ?? item._id ?? item.phone ?? item.email ?? index)}
        renderItem={({ item }) => (
          <ContactRow
            contact={item}
            onPress={() => navigation.navigate("ContactDetail", { contact: item })}
          />
        )}
        onEndReached={loadMore}
        onEndReachedThreshold={0.4}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>No contacts found.</Text>
          </View>
        }
        contentContainerStyle={contacts.length === 0 ? { flex: 1 } : { paddingBottom: 80 }}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListFooterComponent={
          loadingMore ? (
            <View style={{ paddingVertical: 18 }}>
              <ActivityIndicator color="#0f766e" />
            </View>
          ) : null
        }
        // removeClippedSubviews left OFF: on Android it can blank out rows in
        // long lists, which looked like "contacts not loading properly".
        removeClippedSubviews={false}
        maxToRenderPerBatch={20}
        windowSize={11}
        initialNumToRender={20}
      />

      {/* Add Contact FAB */}
      <TouchableOpacity style={styles.fab} onPress={() => setAddOpen(true)} activeOpacity={0.85}>
        <Ionicons name="person-add" size={24} color="#fff" />
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#fff" },
  searchBar: {
    backgroundColor: "#fff",
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  filterBtn: {
    width: 42, height: 40, borderRadius: 12,
    alignItems: "center", justifyContent: "center",
    backgroundColor: "rgba(118,118,128,0.08)",
  },
  filterBtnActive: { backgroundColor: "#ccfbf1" },
  filterCountBadge: {
    position: "absolute", top: -3, right: -3,
    minWidth: 16, height: 16, borderRadius: 8, backgroundColor: "#0f766e",
    alignItems: "center", justifyContent: "center", paddingHorizontal: 4,
    borderWidth: 1.5, borderColor: "#fff",
  },
  filterCountText: { color: "#fff", fontSize: 9.5, fontWeight: "700" },
  searchField: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(118,118,128,0.08)",
    borderRadius: 12,
    paddingHorizontal: 12,
    minHeight: 40,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 9,
    fontSize: 15,
    color: "#111827",
    letterSpacing: Platform.OS === "ios" ? -0.32 : undefined,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    paddingHorizontal: 16,
    paddingVertical: 11,
    minHeight: 64,
    gap: 12,
  },
  avatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    fontSize: 17,
    fontWeight: "600",
    fontFamily: mediumFont,
    letterSpacing: Platform.OS === "ios" ? -0.15 : undefined,
  },
  rowInfo: { flex: 1 },
  name: {
    fontSize: 16,
    fontWeight: "500",
    color: "#111827",
    fontFamily: mediumFont,
    letterSpacing: Platform.OS === "ios" ? -0.32 : undefined,
  },
  sub: {
    fontSize: 13,
    color: "#6b7280",
    marginTop: 2,
    letterSpacing: Platform.OS === "ios" ? -0.15 : undefined,
  },
  tagBadge: {
    backgroundColor: "rgba(15,118,110,0.08)",
    borderRadius: 99,
    paddingHorizontal: 9,
    paddingVertical: 3,
  },
  tagText: { fontSize: 11.5, color: "#0f766e", fontWeight: "600", fontFamily: mediumFont },
  separator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: "rgba(60,60,67,0.12)",
    marginLeft: 74,
  },
  empty: { flex: 1, alignItems: "center", justifyContent: "center" },
  emptyText: { color: "#9ca3af", fontSize: 15 },
  fab: {
    position: "absolute", bottom: 16, right: 16,
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: "#0f766e", alignItems: "center", justifyContent: "center",
    shadowColor: "#000", shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2, shadowRadius: 8, elevation: 6,
  },
});
const fm = StyleSheet.create({
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 20, paddingVertical: 16, backgroundColor: "#fff",
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: "rgba(60,60,67,0.12)",
  },
  title: { fontSize: 17, fontWeight: "700", color: "#0f172a" },
  body: { padding: 16, gap: 18, paddingBottom: 32 },
  group: { gap: 8 },
  groupLabel: { fontSize: 12, fontWeight: "700", color: "#64748b", textTransform: "uppercase", letterSpacing: 0.6 },
  chipWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999,
    borderWidth: 1, borderColor: "#e2e8f0", backgroundColor: "#fff",
  },
  chipActive: { backgroundColor: "#0f766e", borderColor: "#0f766e" },
  chipText: { fontSize: 13, fontWeight: "600", color: "#475569" },
  chipTextActive: { color: "#fff" },
  input: {
    borderWidth: 1, borderColor: "#e2e8f0", borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 11, fontSize: 15, color: "#0f172a", backgroundColor: "#fff",
  },
  footer: {
    flexDirection: "row", gap: 10, padding: 16,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: "rgba(60,60,67,0.12)", backgroundColor: "#fff",
  },
  clearBtn: {
    flex: 1, alignItems: "center", justifyContent: "center", minHeight: 48,
    borderRadius: 12, borderWidth: 1, borderColor: "#e2e8f0", backgroundColor: "#fff",
  },
  clearBtnText: { fontSize: 15, fontWeight: "700", color: "#475569" },
  applyBtn: {
    flex: 2, alignItems: "center", justifyContent: "center", minHeight: 48,
    borderRadius: 12, backgroundColor: "#0f766e",
  },
  applyBtnText: { fontSize: 15, fontWeight: "700", color: "#fff" },
});
