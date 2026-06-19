import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { API_BASE_URL } from "../../config/env";

interface Props {
  message: string;
  detail?: string;
  onRetry?: () => void;
}

export function ErrorBanner({ message, detail, onRetry }: Props) {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>{message}</Text>
      {!!detail && <Text style={styles.detail}>{detail}</Text>}
      <Text style={styles.url}>API: {API_BASE_URL}</Text>
      {onRetry && (
        <TouchableOpacity onPress={onRetry} style={styles.btn}>
          <Text style={styles.btnText}>Retry</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    margin: 16,
    padding: 14,
    backgroundColor: "#fef2f2",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#fecaca",
    gap: 6,
  },
  text: { color: "#b91c1c", fontSize: 14, fontWeight: "600" },
  detail: { color: "#dc2626", fontSize: 12, fontFamily: "monospace" },
  url: { color: "#94a3b8", fontSize: 11 },
  btn: {
    alignSelf: "flex-start",
    paddingHorizontal: 14,
    paddingVertical: 6,
    backgroundColor: "#dc2626",
    borderRadius: 8,
    marginTop: 4,
  },
  btnText: { color: "#fff", fontSize: 13, fontWeight: "600" },
});
