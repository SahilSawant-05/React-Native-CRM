import React from "react";
import { Platform, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const TABS = [
  { name: "Contacts", label: "Contacts", active: "people",       inactive: "people-outline" },
  { name: "Chat",     label: "Messages", active: "chatbubbles",  inactive: "chatbubbles-outline" },
  { name: "Mail",     label: "Mail",     active: "mail",         inactive: "mail-outline" },
  { name: "Pipeline", label: "Pipeline", active: "git-branch",   inactive: "git-branch-outline" },
] as const;

export default function BottomTabBar({
  activeTab,
  onNavigate,
}: {
  activeTab: string;
  onNavigate: (name: string) => void;
}) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.bar, { paddingBottom: Math.max(insets.bottom, 8) }]}>
      {TABS.map((tab) => {
        const focused = activeTab === tab.name;
        return (
          <TouchableOpacity
            key={tab.name}
            style={styles.item}
            onPress={() => onNavigate(tab.name)}
            activeOpacity={0.7}
          >
            <Ionicons
              name={(focused ? tab.active : tab.inactive) as any}
              size={23}
              color={focused ? "#0f766e" : "#8e8e93"}
            />
            <Text style={[styles.label, focused && styles.labelActive]}>{tab.label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: "row",
    backgroundColor: "#fff",
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(60,60,67,0.2)",
    paddingTop: 7,
  },
  item: {
    flex: 1,
    alignItems: "center",
    gap: 2,
    minHeight: 44,
  },
  label: {
    fontSize: 10.5,
    fontWeight: "500",
    color: "#8e8e93",
    fontFamily: Platform.OS === "android" ? "sans-serif-medium" : undefined,
  },
  labelActive: { color: "#0f766e", fontWeight: "600" },
});
