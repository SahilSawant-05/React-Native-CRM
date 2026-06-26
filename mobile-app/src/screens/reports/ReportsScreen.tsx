import React from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";

export default function ReportsScreen() {
  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.card}>
        <Text style={styles.icon}>📈</Text>
        <Text style={styles.title}>Reports</Text>
        <Text style={styles.sub}>Agent performance reports coming soon.</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, justifyContent: "center", alignItems: "center", padding: 24, backgroundColor: "#f8fafc" },
  card: {
    backgroundColor: "#fff", borderRadius: 20, padding: 32,
    alignItems: "center", gap: 12, width: "100%", maxWidth: 340,
    shadowColor: "#000", shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.07, shadowRadius: 12, elevation: 4,
  },
  icon: { fontSize: 48 },
  title: { fontSize: 22, fontWeight: "800", color: "#0f172a" },
  sub: { fontSize: 14, color: "#64748b", textAlign: "center", lineHeight: 20 },
});
