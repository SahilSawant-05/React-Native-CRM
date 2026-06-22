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

import WorkQueueScreen from "../screens/workqueue/WorkQueueScreen";
import ChatInboxScreen from "../screens/chat/ChatInboxScreen";
import ChatConversationScreen from "../screens/chat/ChatConversationScreen";
import ContactsScreen from "../screens/contacts/ContactsScreen";
import ContactDetailScreen from "../screens/contacts/ContactDetailScreen";
import OpportunitiesScreen from "../screens/opportunities/OpportunitiesScreen";
import TasksScreen from "../screens/tasks/TasksScreen";
import ProfileScreen from "../screens/profile/ProfileScreen";

const ChatStack = createNativeStackNavigator();
const ContactsStack = createNativeStackNavigator();

const DRAWER_WIDTH = Math.min(Dimensions.get("window").width * 0.78, 300);

const HEADER_OPTS = {
  headerStyle: { backgroundColor: "#fff" },
  headerTintColor: "#0f766e",
  headerTitleStyle: { fontWeight: "700" as const, fontSize: 17 },
  headerShadowVisible: false,
};

const NAV_ITEMS = [
  { name: "Queue",    label: "Work Queue", emoji: "📋" },
  { name: "Chat",     label: "Messages",   emoji: "💬" },
  { name: "Contacts", label: "Contacts",   emoji: "👥" },
  { name: "Tasks",    label: "Tasks",      emoji: "✅" },
  { name: "Profile",  label: "Profile",    emoji: "👤" },
];

/* Context to let child screens open the drawer */
export const DrawerCtx = React.createContext<{ open: () => void }>({ open: () => {} });

/* Hamburger button placed in each screen's header */
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
  visible,
  onClose,
  activeTab,
  onNavigate,
}: {
  visible: boolean;
  onClose: () => void;
  activeTab: string;
  onNavigate: (name: string) => void;
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
      {/* Scrim */}
      <Animated.View style={[styles.scrim, { opacity: bgOpacity }]} pointerEvents="auto">
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      </Animated.View>

      {/* Sliding panel */}
      <Animated.View
        style={[styles.panel, { width: DRAWER_WIDTH, transform: [{ translateX: slideX }] }]}
        pointerEvents="auto"
      >
        {/* User info */}
        <View style={[styles.drawerHeader, { paddingTop: insets.top + 16 }]}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {(user?.email?.[0] ?? "A").toUpperCase()}
            </Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.roleText}>{user?.role ?? "ADMIN"}</Text>
            <Text style={styles.emailText} numberOfLines={1}>{user?.email ?? ""}</Text>
          </View>
        </View>

        <View style={styles.divider} />

        {/* Nav items */}
        <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
          {NAV_ITEMS.map((item) => {
            const focused = activeTab === item.name;
            return (
              <TouchableOpacity
                key={item.name}
                style={[styles.navItem, focused && styles.navItemActive]}
                onPress={() => { onNavigate(item.name); onClose(); }}
                activeOpacity={0.7}
              >
                <Text style={styles.navEmoji}>{item.emoji}</Text>
                <Text style={[styles.navLabel, focused && styles.navLabelActive]}>
                  {item.label}
                </Text>
                {focused && <View style={styles.activeDot} />}
              </TouchableOpacity>
            );
          })}
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

/* Sub-navigators that each show a hamburger in their top header */
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

/* Screens rendered per active tab */
function ScreenForTab({ tab }: { tab: string }) {
  switch (tab) {
    case "Chat":     return <ChatNavigator />;
    case "Contacts": return <ContactsNavigator />;
    case "Tasks":
      return (
        <TasksScreen
          // TasksScreen is a plain component — wrap it with a header via a mini stack
          {...({} as any)}
        />
      );
    case "Profile":
      return <ProfileScreen {...({} as any)} />;
    default:
      return <WorkQueueScreen {...({} as any)} />;
  }
}

/* Mini stack that adds the header+hamburger to flat screens */
const FlatStack = createNativeStackNavigator();

function FlatScreenWithHeader({ component: Comp, title }: { component: React.ComponentType<any>; title: string }) {
  return (
    <FlatStack.Navigator screenOptions={HEADER_OPTS}>
      <FlatStack.Screen
        name="__screen"
        component={Comp}
        options={{ title, headerLeft: () => <HamburgerBtn /> }}
      />
    </FlatStack.Navigator>
  );
}

/* Main export */
export default function AdminDrawer() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("Queue");

  function navigate(name: string) {
    setActiveTab(name);
    setDrawerOpen(false);
  }

  function renderContent() {
    switch (activeTab) {
      case "Chat":
        return <ChatNavigator />;
      case "Contacts":
        return <ContactsNavigator />;
      case "Tasks":
        return <FlatScreenWithHeader component={TasksScreen} title="My Tasks" />;
      case "Profile":
        return <FlatScreenWithHeader component={ProfileScreen} title="Profile" />;
      default:
        return <FlatScreenWithHeader component={WorkQueueScreen} title="Work Queue" />;
    }
  }

  return (
    <DrawerCtx.Provider value={{ open: () => setDrawerOpen(true) }}>
      <View style={{ flex: 1 }}>
        {renderContent()}
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

const styles = StyleSheet.create({
  scrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  panel: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: 0,
    backgroundColor: "#fff",
    shadowColor: "#000",
    shadowOffset: { width: 4, height: 0 },
    shadowOpacity: 0.18,
    shadowRadius: 12,
    elevation: 24,
  },
  drawerHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  avatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: "#ccfbf1",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { fontSize: 20, fontWeight: "800", color: "#0f766e" },
  roleText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#0f766e",
    textTransform: "uppercase",
    letterSpacing: 1.2,
  },
  emailText: { fontSize: 13, color: "#64748b", marginTop: 2 },
  divider: { height: 1, backgroundColor: "#f1f5f9" },
  navItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    marginHorizontal: 12,
    marginVertical: 2,
    paddingHorizontal: 14,
    paddingVertical: 13,
    borderRadius: 12,
  },
  navItemActive: { backgroundColor: "#f0fdfa" },
  navEmoji: { fontSize: 20, width: 26, textAlign: "center" },
  navLabel: { flex: 1, fontSize: 15, fontWeight: "600", color: "#475569" },
  navLabelActive: { color: "#0f766e", fontWeight: "700" },
  activeDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: "#0f766e",
  },
  signOutRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingHorizontal: 26,
    paddingVertical: 16,
  },
  signOutEmoji: { fontSize: 18 },
  signOutText: { fontSize: 15, fontWeight: "600", color: "#ef4444" },
  hamburger: {
    marginLeft: Platform.OS === "ios" ? 16 : 14,
    gap: 5,
    paddingVertical: 4,
  },
  line: {
    width: 22,
    height: 2.5,
    borderRadius: 2,
    backgroundColor: "#0f766e",
  },
});
