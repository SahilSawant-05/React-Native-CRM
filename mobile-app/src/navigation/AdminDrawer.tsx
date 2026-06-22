import React from "react";
import {
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { createDrawerNavigator, DrawerContentScrollView, DrawerItemList } from "@react-navigation/drawer";
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

const DRAWER_ITEMS = [
  { name: "Queue", label: "Work Queue", emoji: "📋" },
  { name: "Chat", label: "Messages", emoji: "💬" },
  { name: "Contacts", label: "Contacts", emoji: "👥" },
  { name: "Tasks", label: "Tasks", emoji: "✅" },
  { name: "Profile", label: "Profile", emoji: "👤" },
];

function CustomDrawerContent(props: any) {
  const { logout, user } = useAuth();
  const insets = useSafeAreaInsets();

  return (
    <DrawerContentScrollView
      {...props}
      contentContainerStyle={[drawerStyles.container, { paddingTop: insets.top + 8 }]}
    >
      {/* Header */}
      <View style={drawerStyles.header}>
        <View style={drawerStyles.avatar}>
          <Text style={drawerStyles.avatarText}>
            {(user?.email?.[0] ?? "A").toUpperCase()}
          </Text>
        </View>
        <View>
          <Text style={drawerStyles.role}>{user?.role ?? "ADMIN"}</Text>
          <Text style={drawerStyles.email} numberOfLines={1}>{user?.email ?? ""}</Text>
        </View>
      </View>

      <View style={drawerStyles.divider} />

      {/* Nav items */}
      {DRAWER_ITEMS.map((item) => {
        const focused = props.state.routes[props.state.index]?.name === item.name;
        return (
          <TouchableOpacity
            key={item.name}
            style={[drawerStyles.item, focused && drawerStyles.itemFocused]}
            onPress={() => props.navigation.navigate(item.name)}
          >
            <Text style={drawerStyles.itemEmoji}>{item.emoji}</Text>
            <Text style={[drawerStyles.itemLabel, focused && drawerStyles.itemLabelFocused]}>
              {item.label}
            </Text>
          </TouchableOpacity>
        );
      })}

      <View style={{ flex: 1 }} />

      <View style={drawerStyles.divider} />
      <TouchableOpacity style={drawerStyles.logoutBtn} onPress={logout}>
        <Text style={drawerStyles.logoutText}>🚪  Sign out</Text>
      </TouchableOpacity>
    </DrawerContentScrollView>
  );
}

export default function AdminDrawer() {
  return (
    <Drawer.Navigator
      drawerContent={(props: any) => <CustomDrawerContent {...props} />}
      screenOptions={({ navigation }: any) => ({
        ...HEADER_OPTS,
        headerShown: true,
        drawerStyle: drawerStyles.drawer,
        headerLeft: () => (
          <TouchableOpacity
            onPress={() => navigation.toggleDrawer()}
            style={drawerStyles.hamburger}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <View style={drawerStyles.line} />
            <View style={drawerStyles.line} />
            <View style={drawerStyles.line} />
          </TouchableOpacity>
        ),
      })}
    >
      <Drawer.Screen name="Queue" component={WorkQueueScreen} options={{ title: "Work Queue" }} />
      <Drawer.Screen name="Chat" component={ChatNavigator} options={{ title: "Messages", headerShown: false }} />
      <Drawer.Screen name="Contacts" component={ContactsNavigator} options={{ title: "Contacts", headerShown: false }} />
      <Drawer.Screen name="Tasks" component={TasksScreen} options={{ title: "My Tasks" }} />
      <Drawer.Screen name="Profile" component={ProfileScreen} options={{ title: "Profile" }} />
    </Drawer.Navigator>
  );
}

const drawerStyles = StyleSheet.create({
  drawer: {
    width: 280,
    backgroundColor: "#fff",
  },
  container: {
    flex: 1,
    paddingHorizontal: 0,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#ccfbf1",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { fontSize: 18, fontWeight: "800", color: "#0f766e" },
  role: { fontSize: 11, fontWeight: "700", color: "#0f766e", textTransform: "uppercase", letterSpacing: 1 },
  email: { fontSize: 13, color: "#475569", marginTop: 2, maxWidth: 180 },
  divider: { height: 1, backgroundColor: "#f1f5f9", marginVertical: 8 },
  item: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingHorizontal: 20,
    paddingVertical: 14,
    marginHorizontal: 8,
    borderRadius: 12,
  },
  itemFocused: { backgroundColor: "#f0fdfa" },
  itemEmoji: { fontSize: 20 },
  itemLabel: { fontSize: 15, fontWeight: "600", color: "#475569" },
  itemLabelFocused: { color: "#0f766e", fontWeight: "700" },
  logoutBtn: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    marginBottom: 8,
  },
  logoutText: { fontSize: 15, fontWeight: "600", color: "#ef4444" },
  hamburger: {
    marginLeft: Platform.OS === "ios" ? 16 : 14,
    gap: 5,
    justifyContent: "center",
  },
  line: {
    width: 22,
    height: 2,
    borderRadius: 2,
    backgroundColor: "#0f766e",
  },
});
