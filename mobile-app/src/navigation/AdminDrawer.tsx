import React, { useRef, useState } from "react";
import {
  Animated,
  Dimensions,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "../auth/AuthContext";

// Existing screens
import WorkQueueScreen from "../screens/workqueue/WorkQueueScreen";
import ChatInboxScreen from "../screens/chat/ChatInboxScreen";
import ChatConversationScreen from "../screens/chat/ChatConversationScreen";
import ContactsScreen from "../screens/contacts/ContactsScreen";
import ContactDetailScreen from "../screens/contacts/ContactDetailScreen";
import OpportunitiesScreen from "../screens/opportunities/OpportunitiesScreen";
import TasksScreen from "../screens/tasks/TasksScreen";
import ProfileScreen from "../screens/profile/ProfileScreen";

// New admin screens
import MailScreen from "../screens/mail/MailScreen";
import MailDetailScreen from "../screens/mail/Maildetailscreen";
import NotificationsScreen from "../screens/notifications/NotificationsScreen";
import PipelineScreen from "../screens/pipeline/PipelineScreen";
import MediaLibraryScreen from "../screens/media/MediaLibraryScreen";
import DomainCatalogScreen from "../screens/catalog/DomainCatalogScreen";
import CrmSettingsScreen from "../screens/settings/CrmSettingsScreen";
import WhatsAppSetupScreen from "../screens/whatsapp/WhatsAppSetupScreen";
import BillingStatusScreen from "../screens/billing/BillingStatusScreen";
import CalendarScreen from "../screens/calendar/CalendarScreen";
import DashboardScreen from "../screens/dashboard/DashboardScreen";
import AutomationRulesScreen from "../screens/automation/AutomationRulesScreen";
import LeadAssignmentScreen from "../screens/leadassignment/LeadAssignmentScreen";


// ─── Stacks ───────────────────────────────────────────────────────────────────

const ChatStack = createNativeStackNavigator();
const ContactsStack = createNativeStackNavigator();
const MailStack = createNativeStackNavigator(); // ← added
const FlatStack = createNativeStackNavigator();

const DRAWER_WIDTH = Math.min(Dimensions.get("window").width * 0.82, 310);

const HEADER_OPTS = {
  headerStyle: { backgroundColor: "#fff" },
  headerTintColor: "#0f766e",
  headerTitleStyle: { fontWeight: "700" as const, fontSize: 17 },
  headerShadowVisible: false,
};

interface NavItem { name: string; label: string; emoji: string }
interface NavSection { title: string; items: NavItem[] }

const NAV_SECTIONS: NavSection[] = [
  {
    title: "Workspace",
    items: [
      { name: "Dashboard",     label: "Dashboard",        emoji: "📊" },
      { name: "Queue",         label: "Work Queue",      emoji: "📋" },
      { name: "Chat",          label: "Messages",         emoji: "💬" },
      { name: "Mail",          label: "Mail",             emoji: "✉️" },
      { name: "Tasks",         label: "Tasks",            emoji: "✅" },
      { name: "Calendar",      label: "Calendar",         emoji: "📅" },
      { name: "Notifications", label: "Notifications",    emoji: "🔔" },
    ],
  },
  {
    title: "CRM",
    items: [
      { name: "Contacts",      label: "Contacts",         emoji: "👥" },
      { name: "Pipeline",      label: "Pipeline",         emoji: "🔀" },
      { name: "DomainCatalog", label: "Domain Catalog",   emoji: "🗂️" },
      { name: "MediaLibrary",  label: "Media Library",    emoji: "🖼️" },
    ],
  },
  {
    title: "Admin",
    items: [
      { name: "AutomationRules",  label: "Automation Rules",   emoji: "⚡" },
      { name: "LeadAssignment",   label: "Lead Assignment",    emoji: "🎯" },
      { name: "CrmSettings",      label: "CRM Settings",       emoji: "⚙️" },
      { name: "WhatsAppSetup",    label: "WhatsApp Setup",     emoji: "📱" },
      { name: "Billing",          label: "Billing",            emoji: "💳" },
      { name: "Profile",          label: "Profile",            emoji: "👤" },
    ],
  },
];

export interface PendingChat { contactId: string | number; contactName: string; contactPhone?: string }

/* Context so child screens can open the drawer or navigate to a tab */
export const DrawerCtx = React.createContext<{
  open: () => void;
  navigateTo: (name: string) => void;
  openChat: (contact: PendingChat) => void;
  pendingChatRef: React.MutableRefObject<PendingChat | null>;
}>({
  open: () => {},
  navigateTo: () => {},
  openChat: () => {},
  pendingChatRef: { current: null },
});

/* Hamburger button for screen headers */
export function HamburgerBtn() {
  const { open } = React.useContext(DrawerCtx);
  return (
    <TouchableOpacity
      onPress={open}
      style={styles.hamburger}
      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
    >
      <View style={styles.line} />
      <View style={styles.line} />
      <View style={styles.line} />
    </TouchableOpacity>
  );
}

/* Slide-in drawer panel */
function DrawerPanel({
  visible, onClose, activeTab, onNavigate,
}: {
  visible: boolean; onClose: () => void; activeTab: string; onNavigate: (name: string) => void;
}) {
  const slideX = useRef(new Animated.Value(-DRAWER_WIDTH)).current;
  const bgOpacity = useRef(new Animated.Value(0)).current;
  const [mounted, setMounted] = useState(false);
  const insets = useSafeAreaInsets();
  const { logout, user } = useAuth();

  React.useEffect(() => {
    if (visible) {
      setMounted(true);
      Animated.parallel([
        Animated.timing(slideX, { toValue: 0, duration: 260, useNativeDriver: true }),
        Animated.timing(bgOpacity, { toValue: 1, duration: 260, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(slideX, { toValue: -DRAWER_WIDTH, duration: 220, useNativeDriver: true }),
        Animated.timing(bgOpacity, { toValue: 0, duration: 220, useNativeDriver: true }),
      ]).start(() => setMounted(false));
    }
  }, [visible]);

  if (!mounted) return null;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      <Animated.View style={[styles.scrim, { opacity: bgOpacity }]} pointerEvents="auto">
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      </Animated.View>

      <Animated.View
        style={[styles.panel, { width: DRAWER_WIDTH, transform: [{ translateX: slideX }] }]}
        pointerEvents="auto"
      >
        {/* User header */}
        <View style={[styles.drawerHeader, { paddingTop: insets.top + 16 }]}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{(user?.email?.[0] ?? "A").toUpperCase()}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.roleText}>{user?.role ?? "ADMIN"}</Text>
            <Text style={styles.emailText} numberOfLines={1}>{user?.email ?? ""}</Text>
          </View>
        </View>

        <View style={styles.divider} />

        <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
          {NAV_SECTIONS.map((section) => (
            <View key={section.title}>
              <Text style={styles.sectionTitle}>{section.title.toUpperCase()}</Text>
              {section.items.map((item) => {
                const focused = activeTab === item.name;
                return (
                  <TouchableOpacity
                    key={item.name}
                    style={[styles.navItem, focused && styles.navItemActive]}
                    onPress={() => { onNavigate(item.name); onClose(); }}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.navEmoji}>{item.emoji}</Text>
                    <Text style={[styles.navLabel, focused && styles.navLabelActive]}>{item.label}</Text>
                    {focused && <View style={styles.activeDot} />}
                  </TouchableOpacity>
                );
              })}
            </View>
          ))}
          <View style={{ height: 16 }} />
        </ScrollView>

        <View style={styles.divider} />
        <TouchableOpacity
          style={[styles.signOutRow, { paddingBottom: insets.bottom + 16 }]}
          onPress={() => { onClose(); logout(); }}
          activeOpacity={0.7}
        >
          <Text style={styles.signOutEmoji}>🚪</Text>
          <Text style={styles.signOutText}>Sign out</Text>
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}

// ─── Sub-navigators ───────────────────────────────────────────────────────────

function ChatNavigator() {
  return (
    <ChatStack.Navigator screenOptions={HEADER_OPTS}>
      <ChatStack.Screen
        name="ChatInbox"
        component={ChatInboxScreen}
        options={{ title: "Messages", headerLeft: () => <HamburgerBtn /> }}
      />
      <ChatStack.Screen
        name="ChatConversation"
        component={ChatConversationScreen as any}
        options={({ route }: any) => ({ title: route.params?.inbox?.contactName || "Chat" })}
      />
    </ChatStack.Navigator>
  );
}

function ContactsNavigator() {
  return (
    <ContactsStack.Navigator screenOptions={HEADER_OPTS}>
      <ContactsStack.Screen
        name="ContactsList"
        component={ContactsScreen}
        options={{ title: "Contacts", headerLeft: () => <HamburgerBtn /> }}
      />
      <ContactsStack.Screen
        name="ContactDetail"
        component={ContactDetailScreen as any}
        options={({ route }: any) => ({ title: route.params?.contact?.name || "Contact" })}
      />
      <ContactsStack.Screen
        name="Opportunities"
        component={OpportunitiesScreen}
        options={{ title: "Deals" }}
      />
    </ContactsStack.Navigator>
  );
}

// ─── MailNavigator (NEW) ──────────────────────────────────────────────────────
// Gives MailScreen its own stack so it can push MailDetail.

function MailNavigator() {
  return (
    <MailStack.Navigator screenOptions={HEADER_OPTS}>
      <MailStack.Screen
        name="MailList"
        component={MailScreen}
        options={{ title: "Mail", headerLeft: () => <HamburgerBtn /> }}
      />
      <MailStack.Screen
        name="MailDetail"
        component={MailDetailScreen}
        options={{ title: "Email", headerShown: false }}
      />
    </MailStack.Navigator>
  );
}

/* Wrap a flat screen in a mini stack so it gets a header + hamburger */
function withHeader(Comp: React.ComponentType<any>, title: string) {
  return function WrappedScreen() {
    return (
      <FlatStack.Navigator screenOptions={HEADER_OPTS}>
        <FlatStack.Screen
          name="__flat"
          component={Comp}
          options={{ title, headerLeft: () => <HamburgerBtn /> }}
        />
      </FlatStack.Navigator>
    );
  };
}

// ─── Screen map ───────────────────────────────────────────────────────────────

const SCREEN_MAP: Record<string, React.ComponentType<any>> = {
  Dashboard:     withHeader(DashboardScreen,    "Dashboard"),
  Queue:         withHeader(WorkQueueScreen,    "Work Queue"),
  Chat:          ChatNavigator,
  Mail:          MailNavigator,           // ← was withHeader(MailScreen, "Mail")
  Tasks:         withHeader(TasksScreen,         "My Tasks"),
  Notifications: withHeader(NotificationsScreen, "Notifications"),
  Contacts:      ContactsNavigator,
  Pipeline:      withHeader(PipelineScreen,      "Pipeline"),
  DomainCatalog: withHeader(DomainCatalogScreen, "Domain Catalog"),
  MediaLibrary:  withHeader(MediaLibraryScreen,  "Media Library"),
  Calendar:      withHeader(CalendarScreen,      "Calendar"),
  AutomationRules: withHeader(AutomationRulesScreen, "Automation Rules"),
  LeadAssignment:  withHeader(LeadAssignmentScreen,  "Lead Assignment"),
  CrmSettings:   withHeader(CrmSettingsScreen,   "CRM Settings"),
  WhatsAppSetup: withHeader(WhatsAppSetupScreen, "WhatsApp Setup"),
  Billing:       withHeader(BillingStatusScreen, "Billing"),
  Profile:       withHeader(ProfileScreen,       "Profile"),
};

// ─── Main export ──────────────────────────────────────────────────────────────

export default function AdminDrawer() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("Dashboard");
  const pendingChatRef = React.useRef<PendingChat | null>(null);

  function navigate(name: string) {
    setActiveTab(name);
    setDrawerOpen(false);
  }

  function openChat(contact: PendingChat) {
    pendingChatRef.current = contact;
    navigate("Chat");
  }

  const ActiveScreen = SCREEN_MAP[activeTab] ?? SCREEN_MAP["Dashboard"];

  return (
    <DrawerCtx.Provider value={{ open: () => setDrawerOpen(true), navigateTo: navigate, openChat, pendingChatRef }}>
      <View style={{ flex: 1 }}>
        <ActiveScreen />
        <DrawerPanel
          visible={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          activeTab={activeTab}
          onNavigate={navigate}
        />
      </View>
    </DrawerCtx.Provider>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  scrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  panel: {
    position: "absolute", top: 0, bottom: 0, left: 0,
    backgroundColor: "#fff",
    shadowColor: "#000", shadowOffset: { width: 4, height: 0 },
    shadowOpacity: 0.18, shadowRadius: 12, elevation: 24,
  },
  drawerHeader: {
    flexDirection: "row", alignItems: "center", gap: 12,
    paddingHorizontal: 20, paddingBottom: 16,
  },
  avatar: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: "#ccfbf1", alignItems: "center", justifyContent: "center",
  },
  avatarText: { fontSize: 18, fontWeight: "800", color: "#0f766e" },
  roleText: {
    fontSize: 11, fontWeight: "700", color: "#0f766e",
    textTransform: "uppercase", letterSpacing: 1.2,
  },
  emailText: { fontSize: 12, color: "#64748b", marginTop: 2 },
  divider: { height: 1, backgroundColor: "#f1f5f9" },
  sectionTitle: {
    fontSize: 10, fontWeight: "700", color: "#94a3b8",
    letterSpacing: 1.5, paddingHorizontal: 20, paddingTop: 14, paddingBottom: 4,
  },
  navItem: {
    flexDirection: "row", alignItems: "center", gap: 12,
    marginHorizontal: 10, marginVertical: 1,
    paddingHorizontal: 12, paddingVertical: 11, borderRadius: 10,
  },
  navItemActive: { backgroundColor: "#f0fdfa" },
  navEmoji: { fontSize: 18, width: 24, textAlign: "center" },
  navLabel: { flex: 1, fontSize: 14, fontWeight: "600", color: "#475569" },
  navLabelActive: { color: "#0f766e", fontWeight: "700" },
  activeDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "#0f766e" },
  signOutRow: {
    flexDirection: "row", alignItems: "center", gap: 12,
    paddingHorizontal: 22, paddingVertical: 14,
  },
  signOutEmoji: { fontSize: 18 },
  signOutText: { fontSize: 14, fontWeight: "600", color: "#ef4444" },
  hamburger: { marginLeft: Platform.OS === "ios" ? 16 : 4, gap: 5, paddingVertical: 4 },
  line: { width: 22, height: 2.5, borderRadius: 2, backgroundColor: "#0f766e" },
});