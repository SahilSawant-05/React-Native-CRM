import React from "react";
import { Platform, StyleSheet, Text, View } from "react-native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";

import WorkQueueScreen from "../screens/workqueue/WorkQueueScreen";
import ChatInboxScreen from "../screens/chat/ChatInboxScreen";
import ChatConversationScreen from "../screens/chat/ChatConversationScreen";
import ContactsScreen from "../screens/contacts/ContactsScreen";
import ContactDetailScreen from "../screens/contacts/ContactDetailScreen";
import TasksScreen from "../screens/tasks/TasksScreen";
import OpportunitiesScreen from "../screens/opportunities/OpportunitiesScreen";
import ProfileScreen from "../screens/profile/ProfileScreen";

const Tab = createBottomTabNavigator();
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
      <ChatStack.Screen
        name="ChatInbox"
        component={ChatInboxScreen}
        options={{ title: "Messages" }}
      />
      <ChatStack.Screen
        name="ChatConversation"
        component={ChatConversationScreen as any}
        options={({ route }: any) => ({
          title: route.params?.inbox?.contactName || "Chat",
        })}
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
        options={{ title: "Contacts" }}
      />
      <ContactsStack.Screen
        name="ContactDetail"
        component={ContactDetailScreen as any}
        options={({ route }: any) => ({
          title: route.params?.contact?.name || "Contact",
        })}
      />
      <ContactsStack.Screen
        name="Opportunities"
        component={OpportunitiesScreen}
        options={{ title: "Deals" }}
      />
    </ContactsStack.Navigator>
  );
}

/* ── Custom tab icon ─────────────────────────────────── */
function TabIcon({
  emoji,
  label,
  focused,
}: {
  emoji: string;
  label: string;
  focused: boolean;
}) {
  return (
    <View style={tabStyles.wrap}>
      <Text style={[tabStyles.emoji, focused && tabStyles.emojiFocused]}>{emoji}</Text>
      <Text style={[tabStyles.label, focused && tabStyles.labelFocused]}>{label}</Text>
    </View>
  );
}

export default function AppTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: false,
        tabBarStyle: tabStyles.bar,
      }}
    >
      {/* 1 — Work Queue */}
      <Tab.Screen
        name="Queue"
        component={WorkQueueScreen}
        options={{
          headerShown: true,
          ...HEADER_OPTS,
          title: "Work Queue",
          tabBarIcon: ({ focused }) => (
            <TabIcon emoji="📋" label="Queue" focused={focused} />
          ),
        }}
      />

      {/* 2 — Chat */}
      <Tab.Screen
        name="Chat"
        component={ChatNavigator}
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon emoji="💬" label="Chat" focused={focused} />
          ),
        }}
      />

      {/* 3 — Contacts */}
      <Tab.Screen
        name="Contacts"
        component={ContactsNavigator}
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon emoji="👥" label="Contacts" focused={focused} />
          ),
        }}
      />

      {/* 4 — Tasks */}
      <Tab.Screen
        name="Tasks"
        component={TasksScreen}
        options={{
          headerShown: true,
          ...HEADER_OPTS,
          title: "My Tasks",
          tabBarIcon: ({ focused }) => (
            <TabIcon emoji="✅" label="Tasks" focused={focused} />
          ),
        }}
      />

      {/* 5 — Profile */}
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{
          headerShown: true,
          ...HEADER_OPTS,
          title: "Profile",
          tabBarIcon: ({ focused }) => (
            <TabIcon emoji="👤" label="Profile" focused={focused} />
          ),
        }}
      />
    </Tab.Navigator>
  );
}

const tabStyles = StyleSheet.create({
  bar: {
    height: Platform.OS === "ios" ? 84 : 66,
    backgroundColor: "#fff",
    borderTopWidth: 1,
    borderTopColor: "#e2e8f0",
    paddingTop: 8,
    paddingBottom: Platform.OS === "ios" ? 26 : 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 14,
  },
  wrap: {
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
  },
  emoji: {
    fontSize: 22,
    opacity: 0.4,
  },
  emojiFocused: {
    opacity: 1,
  },
  label: {
    fontSize: 10,
    fontWeight: "600",
    color: "#94a3b8",
    letterSpacing: 0.2,
  },
  labelFocused: {
    color: "#0f766e",
  },
});
