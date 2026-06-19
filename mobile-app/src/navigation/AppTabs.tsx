import React from "react";
import { Platform, StyleSheet, Text, View } from "react-native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";

import WorkQueueScreen from "../screens/workqueue/WorkQueueScreen";
import ChatInboxScreen from "../screens/chat/ChatInboxScreen";
import ChatConversationScreen from "../screens/chat/ChatConversationScreen";
import ContactsScreen from "../screens/contacts/ContactsScreen";
import ContactDetailScreen from "../screens/contacts/ContactDetailScreen";
import OpportunitiesScreen from "../screens/opportunities/OpportunitiesScreen";
import TasksScreen from "../screens/tasks/TasksScreen";
import ProfileScreen from "../screens/profile/ProfileScreen";

const Tab = createBottomTabNavigator();
const ChatStack = createNativeStackNavigator();
const ContactsStack = createNativeStackNavigator();
const DealsStack = createNativeStackNavigator();

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
    </ContactsStack.Navigator>
  );
}

function DealsNavigator() {
  return (
    <DealsStack.Navigator screenOptions={HEADER_OPTS}>
      <DealsStack.Screen name="OpportunitiesList" component={OpportunitiesScreen} options={{ title: "Deals" }} />
      <DealsStack.Screen name="TasksList" component={TasksScreen} options={{ title: "My Tasks" }} />
    </DealsStack.Navigator>
  );
}

/* ── Tab bar icon ─────────────────────────────────────── */
interface TabIconProps {
  emoji: string;
  label: string;
  focused: boolean;
  badge?: number;
}

function TabIcon({ emoji, label, focused, badge }: TabIconProps) {
  return (
    <View style={tabStyles.iconWrap}>
      <View>
        <Text style={[tabStyles.emoji, focused && tabStyles.emojiFocused]}>{emoji}</Text>
        {!!badge && badge > 0 && (
          <View style={tabStyles.badge}>
            <Text style={tabStyles.badgeText}>{badge > 99 ? "99+" : badge}</Text>
          </View>
        )}
      </View>
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
      <Tab.Screen
        name="Queue"
        component={WorkQueueScreen}
        options={{
          headerShown: true,
          headerStyle: { backgroundColor: "#fff" },
          headerTintColor: "#0f766e",
          headerTitleStyle: { fontWeight: "800" as const, fontSize: 17 },
          headerShadowVisible: false,
          title: "Work Queue",
          tabBarIcon: ({ focused }) => <TabIcon emoji="📋" label="Queue" focused={focused} />,
        }}
      />

      <Tab.Screen
        name="Chat"
        component={ChatNavigator}
        options={{
          tabBarIcon: ({ focused }) => <TabIcon emoji="💬" label="Chat" focused={focused} />,
        }}
      />

      <Tab.Screen
        name="Contacts"
        component={ContactsNavigator}
        options={{
          tabBarIcon: ({ focused }) => <TabIcon emoji="👥" label="Contacts" focused={focused} />,
        }}
      />

      <Tab.Screen
        name="Deals"
        component={DealsNavigator}
        options={{
          tabBarIcon: ({ focused }) => <TabIcon emoji="🎯" label="Deals" focused={focused} />,
        }}
      />

      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{
          headerShown: true,
          headerStyle: { backgroundColor: "#fff" },
          headerTintColor: "#0f766e",
          headerTitleStyle: { fontWeight: "800" as const, fontSize: 17 },
          headerShadowVisible: false,
          title: "Profile",
          tabBarIcon: ({ focused }) => <TabIcon emoji="👤" label="Profile" focused={focused} />,
        }}
      />
    </Tab.Navigator>
  );
}

const tabStyles = StyleSheet.create({
  bar: {
    height: Platform.OS === "ios" ? 82 : 64,
    backgroundColor: "#fff",
    borderTopWidth: 1,
    borderTopColor: "#e2e8f0",
    paddingTop: 6,
    paddingBottom: Platform.OS === "ios" ? 24 : 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 12,
  },
  iconWrap: {
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
  },
  emoji: {
    fontSize: 22,
    opacity: 0.45,
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
  badge: {
    position: "absolute",
    top: -4,
    right: -8,
    backgroundColor: "#ef4444",
    borderRadius: 99,
    minWidth: 16,
    height: 16,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 3,
    borderWidth: 1.5,
    borderColor: "#fff",
  },
  badgeText: {
    color: "#fff",
    fontSize: 9,
    fontWeight: "800",
  },
});
