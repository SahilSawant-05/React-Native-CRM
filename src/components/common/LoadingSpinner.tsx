import React from "react";
import { ActivityIndicator, StyleSheet, View, Text } from "react-native";

export function LoadingSpinner({ message = "Loading..." }: { message?: string }) {
  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color="#0f766e" />
      <Text style={styles.text}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#f8fafc",
    gap: 12,
  },
  text: {
    color: "#64748b",
    fontSize: 14,
  },
});
