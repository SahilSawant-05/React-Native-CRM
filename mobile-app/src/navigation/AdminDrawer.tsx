import React from "react";
import {
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { createDrawerNavigator } from "@react-navigation/drawer";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { DrawerContentComponentProps } from "@react-navigation/drawer";
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

const Drawer = createDrawerNavigator();
const ChatStack = createNativeStackNavigator();
const ContactsStack = createNativeStackNavigator();

const HEADER_OPTS = {
  headerStyle: { backgroundColor: "#fff" },
  headerTintColor: "#0f766e",
  headerTitleStyle: { fontWeight: "700" as const, fontSize: 17 },
  headerShadowVisible: false,
};

function ChatNavigator() {
  return (
    <ChatStack.Navigator screenOptions={HEADER_OPTS}>
      <ChatStack.Screen name="ChatInbox" component={ChatInboxScreen} options={{ title: "Messages" }} />
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
      <ContactsStack.Screen name="ContactsList" component={ContactsScreen} options={{ title: "Contacts" }} />
      <ContactsStack.Screen
        name="ContactDetail"
        component={ContactDetailScreen as any}
        options={({ route }: any) => ({ title: route.params?.contact?.name || "Contact" })}
      />
      <ContactsStack.Screen name="Opportunities" component={OpportunitiesScreen} options={{ title: "Deals" }} />
    </ContactsStack.Navigator>
  );
}

const NAV_ITEMS = [
  { name: "Queue",    label: "Work Queue", emoji: "📋" },
  { name: "Chat",     label: "Messages",   emoji: "💬" },
  { name: "Contacts", label: "Contacts",   emoji: "👥" },
  { name: "Tasks",    label: "Tasks",      emoji: "✅" },
  { name: "Profile",  label: "Profile",    emoji: "👤" },
];

function CustomDrawer({ navigation, state }: DrawerContentComponentProps) {
  const { logout, user } = useAuth();
  const insets = useSafeAreaInsets();
  const activeRouteName = state.routes[state.index]?.name;

  return (
    <View style={[drawerStyles.root, { paddingTop: insets.top }]}>
      {/* User header */}
      <View style={drawerStyles.header}>
        <View style={drawerStyles.avatar}>
          <Text style={drawerStyles.avatarText}>
            {(user?.email?.[0] ?? "A").toUpperCase()}
          </Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={drawerStyles.roleText}>{user?.role ?? "ADMIN"}</Text>
          <Text style={drawerStyles.emailText} numberOfLines={1}>{user?.email ?? ""}</Text>
        </View>
      </View>

      <View style={drawerStyles.divider} />

      {/* Nav items */}
      <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
        {NAV_ITEMS.map((item) => {
          const focused = activeRouteName === item.name;
          return (
            <TouchableOpacity
              key={item.name}
              style={[drawerStyles.navItem, focused && drawerStyles.navItemActive]}
              onPress={() => navigation.navigate(item.name)}
              activeOpacity={0.7}
            >
              <Text style={drawerStyles.navEmoji}>{item.emoji}</Text>
              <Text style={[drawerStyles.navLabel, focused && drawerStyles.navLabelActive]}>
                {item.label}
              </Text>
              {focused && <View style={drawerStyles.activePill} />}
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <View style={drawerStyles.divider} />

      {/* Sign out */}
      <TouchableOpacity
        style={[drawerStyles.signOut, { paddingBottom: insets.bottom + 12 }]}
        onPress={logout}
        activeOpacity={0.7}
      >
        <Text style={drawerStyles.signOutEmoji}>🚪</Text>
        <Text style={drawerStyles.signOutText}>Sign out</Text>
      </TouchableOpacity>
    </View>
  );
}

/* Hamburger icon rendered in the header */
function HamburgerButton({ onPress }: { onPress: () => void }) {
  return (
    <TouchableOpacity onPress={onPress} style={drawerStyles.hamburger} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
      <View style={drawerStyles.line} />
      <View style={drawerStyles.line} />
      <View style={drawerStyles.line} />
    </TouchableOpacity>
  );
}

export default function AdminDrawer() {
  return (
    <Drawer.Navigator
      drawerContent={(props: DrawerContentComponentProps) => <CustomDrawer {...props} />}
      screenOptions={({ navigation }: any) => ({
        ...HEADER_OPTS,
        headerShown: true,
        drawerStyle: { width: 280 },
        headerLeft: () => <HamburgerButton onPress={() => navigation.toggleDrawer()} />,
      })}
    >
      <Drawer.Screen name="Queue"    component={WorkQueueScreen}  options={{ title: "Work Queue" }} />
      <Drawer.Screen name="Chat"     component={ChatNavigator}    options={{ title: "Messages", headerShown: false }} />
      <Drawer.Screen name="Contacts" component={ContactsNavigator} options={{ title: "Contacts", headerShown: false }} />
      <Drawer.Screen name="Tasks"    component={TasksScreen}      options={{ title: "My Tasks" }} />
      <Drawer.Screen name="Profile"  component={ProfileScreen}    options={{ title: "Profile" }} />
    </Drawer.Navigator>
  );
}

const drawerStyles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#fff",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 18,
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
  divider: { height: 1, backgroundColor: "#f1f5f9", marginHorizontal: 0 },
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
  activePill: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#0f766e",
  },
  signOut: {
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
