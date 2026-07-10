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
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../auth/AuthContext";
import BottomTabBar from "./BottomTabBar";

// Screens
import DashboardScreen from "../screens/dashboard/DashboardScreen";
import ChatInboxScreen from "../screens/chat/ChatInboxScreen";
import ChatConversationScreen from "../screens/chat/ChatConversationScreen";
import MailScreen from "../screens/mail/MailScreen";
import MailDetailScreen from "../screens/mail/Maildetailscreen";
import TasksScreen from "../screens/tasks/TasksScreen";
import NotificationsScreen from "../screens/notifications/NotificationsScreen";
import CalendarScreen from "../screens/calendar/CalendarScreen";
import ContactsScreen from "../screens/contacts/ContactsScreen";
import ContactDetailScreen from "../screens/contacts/ContactDetailScreen";
import OpportunitiesScreen from "../screens/opportunities/OpportunitiesScreen";
import PipelineScreen from "../screens/pipeline/PipelineScreen";
import DomainCatalogScreen from "../screens/catalog/DomainCatalogScreen";
import MediaLibraryScreen from "../screens/media/MediaLibraryScreen";
import ReportsScreen from "../screens/reports/ReportsScreen";
import ProfileScreen from "../screens/profile/ProfileScreen";
import TelephonyScreen from "../screens/telephony/TelephonyScreen";

// ─── Stacks ───────────────────────────────────────────────────────────────────

const ChatStack = createNativeStackNavigator();
const ContactsStack = createNativeStackNavigator();
const MailStack = createNativeStackNavigator();
const FlatStack = createNativeStackNavigator();

const DRAWER_WIDTH = Math.min(Dimensions.get("window").width * 0.82, 310);

const HEADER_OPTS = {
  headerStyle: { backgroundColor: "#fff" },
  headerTintColor: "#0f766e",
  headerTitleStyle: {
    fontWeight: "600" as const,
    fontSize: 17,
    fontFamily: Platform.OS === "android" ? "sans-serif-medium" : undefined,
  },
  headerShadowVisible: false,
};

interface NavItem { name: string; label: string; icon: string }
interface NavSection { title: string; items: NavItem[] }

const NAV_SECTIONS: NavSection[] = [
  {
    title: "Workspace",
    items: [
      { name: "Dashboard",     label: "Dashboard",      icon: "grid-outline" },
      { name: "Chat",          label: "Messages",       icon: "chatbubbles-outline" },
      { name: "Mail",          label: "Mail",           icon: "mail-outline" },
      { name: "Telephony",     label: "Calls",          icon: "call-outline" },
      { name: "Tasks",         label: "Tasks",          icon: "checkbox-outline" },
      { name: "Notifications", label: "Notifications",  icon: "notifications-outline" },
      { name: "Calendar",      label: "Calendar",       icon: "calendar-outline" },
    ],
  },
  {
    title: "CRM",
    items: [
      { name: "Contacts",      label: "Contacts",       icon: "people-outline" },
      { name: "Pipeline",      label: "Pipeline",       icon: "git-branch-outline" },
      { name: "DomainCatalog", label: "Domain Catalog", icon: "albums-outline" },
      { name: "MediaLibrary",  label: "Media Library",  icon: "images-outline" },
    ],
  },
  {
    title: "Insights",
    items: [
      { name: "Reports",       label: "Reports",        icon: "stats-chart-outline" },
    ],
  },
  {
    title: "Account",
    items: [
      { name: "Profile",       label: "Profile",        icon: "person-circle-outline" },
    ],
  },
];

export interface PendingChat { contactId: string | number; contactName: string; contactPhone?: string }

/* Context so child screens can open the drawer or navigate to a tab */
export const AgentDrawerCtx = React.createContext<{
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
  const { open } = React.useContext(AgentDrawerCtx);
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
            <Text style={styles.roleText}>{user?.role ?? "AGENT"}</Text>
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
                    <Ionicons name={item.icon as any} size={21} color={focused ? "#0f766e" : "#6b7280"} style={styles.navIcon} />
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
          <Ionicons name="log-out-outline" size={20} color="#ef4444" />
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
  Chat:          ChatNavigator,
  Mail:          MailNavigator,
  Telephony:     withHeader(TelephonyScreen,     "Calls"),
  Tasks:         withHeader(TasksScreen,         "My Tasks"),
  Notifications: withHeader(NotificationsScreen, "Notifications"),
  Calendar:      withHeader(CalendarScreen,      "Calendar"),
  Contacts:      ContactsNavigator,
  Pipeline:      withHeader(PipelineScreen,      "Pipeline"),
  DomainCatalog: withHeader(DomainCatalogScreen, "Domain Catalog"),
  MediaLibrary:  withHeader(MediaLibraryScreen,  "Media Library"),
  Reports:       withHeader(ReportsScreen,       "Reports"),
  Profile:       withHeader(ProfileScreen,       "Profile"),
};

// ─── Main export ──────────────────────────────────────────────────────────────

export default function AgentDrawer() {
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
    <AgentDrawerCtx.Provider value={{ open: () => setDrawerOpen(true), navigateTo: navigate, openChat, pendingChatRef }}>
      <View style={{ flex: 1 }}>
        <View style={{ flex: 1 }}>
          <ActiveScreen />
        </View>
        <BottomTabBar activeTab={activeTab} onNavigate={navigate} />
        <DrawerPanel
          visible={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          activeTab={activeTab}
          onNavigate={navigate}
        />
      </View>
    </AgentDrawerCtx.Provider>
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
    fontSize: 11, fontWeight: "600", color: "#9ca3af",
    letterSpacing: 1.2, paddingHorizontal: 20, paddingTop: 16, paddingBottom: 5,
    fontFamily: Platform.OS === "android" ? "sans-serif-medium" : undefined,
  },
  navItem: {
    flexDirection: "row", alignItems: "center", gap: 12,
    marginHorizontal: 10, marginVertical: 1,
    paddingHorizontal: 12, paddingVertical: 11, borderRadius: 10,
  },
  navItemActive: { backgroundColor: "#f0fdfa" },
  navIcon: { width: 24, textAlign: "center" },
  navLabel: { flex: 1, fontSize: 15, fontWeight: "600", color: "#374151", letterSpacing: Platform.OS === "ios" ? -0.24 : 0, fontFamily: Platform.OS === "android" ? "sans-serif-medium" : undefined },
  navLabelActive: { color: "#0f766e", fontWeight: "700" },
  activeDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "#0f766e" },
  signOutRow: {
    flexDirection: "row", alignItems: "center", gap: 12,
    paddingHorizontal: 22, paddingVertical: 14,
  },
  signOutText: { fontSize: 14, fontWeight: "600", color: "#ef4444" },
  hamburger: { marginLeft: Platform.OS === "ios" ? 16 : 14, gap: 5, paddingVertical: 4,marginRight:8 },
  line: { width: 22, height: 2.5, borderRadius: 2, backgroundColor: "#0f766e" },
});
