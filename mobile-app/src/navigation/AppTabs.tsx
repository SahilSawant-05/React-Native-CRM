import React from "react";
import { Text } from "react-native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";

import WorkQueueScreen from "../screens/workqueue/WorkQueueScreen";
import ContactsScreen from "../screens/contacts/ContactsScreen";
import ContactDetailScreen from "../screens/contacts/ContactDetailScreen";
import OpportunitiesScreen from "../screens/opportunities/OpportunitiesScreen";
import TasksScreen from "../screens/tasks/TasksScreen";
import ProfileScreen from "../screens/profile/ProfileScreen";

const Tab = createBottomTabNavigator();
const ContactsStack = createNativeStackNavigator();

function ContactsNavigator() {
  return (
    <ContactsStack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: "#fff" },
        headerTintColor: "#0f766e",
        headerTitleStyle: { fontWeight: "700" },
      }}
    >
      <ContactsStack.Screen
        name="ContactsList"
        component={ContactsScreen}
        options={{ title: "Contacts" }}
      />
      <ContactsStack.Screen
        name="ContactDetail"
        component={ContactDetailScreen}
        options={({ route }: any) => ({ title: route.params?.contact?.name || "Contact" })}
      />
    </ContactsStack.Navigator>
  );
}

const TAB_ICONS: Record<string, string> = {
  Queue: "📋",
  Contacts: "👥",
  Opportunities: "🎯",
  Tasks: "✅",
  Profile: "👤",
};

export default function AppTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused }) => (
          <Text style={{ fontSize: focused ? 22 : 20, opacity: focused ? 1 : 0.6 }}>
            {TAB_ICONS[route.name] ?? "📌"}
          </Text>
        ),
        tabBarActiveTintColor: "#0f766e",
        tabBarInactiveTintColor: "#94a3b8",
        tabBarStyle: {
          borderTopWidth: 1,
          borderTopColor: "#e2e8f0",
          backgroundColor: "#fff",
          paddingBottom: 4,
          height: 60,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: "600" },
        headerStyle: { backgroundColor: "#fff" },
        headerTintColor: "#0f766e",
        headerTitleStyle: { fontWeight: "800", fontSize: 17 },
      })}
    >
      <Tab.Screen
        name="Queue"
        component={WorkQueueScreen}
        options={{ title: "Work Queue", tabBarLabel: "Queue" }}
      />
      <Tab.Screen
        name="Contacts"
        component={ContactsNavigator}
        options={{ headerShown: false, tabBarLabel: "Contacts" }}
      />
      <Tab.Screen
        name="Opportunities"
        component={OpportunitiesScreen}
        options={{ title: "Opportunities", tabBarLabel: "Deals" }}
      />
      <Tab.Screen
        name="Tasks"
        component={TasksScreen}
        options={{ title: "My Tasks", tabBarLabel: "Tasks" }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{ title: "Profile", tabBarLabel: "Profile" }}
      />
    </Tab.Navigator>
  );
}
