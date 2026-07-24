import React, { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Image,
} from "react-native";
import { useAuth } from "../../auth/AuthContext";
import { loginRequest } from "../../api/auth";

export default function LoginScreen() {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleLogin() {
    setError("");
    if (!email.trim()) return setError("Please enter your email.");
    if (!password.trim()) return setError("Please enter your password.");

    setLoading(true);
    try {
      const data = await loginRequest(email.trim().toLowerCase(), password);
      await login({
        token: data.token,
        role: data.role,
        tenantId: data.tenantId,
        userId: data.userId,
        email: email.trim().toLowerCase(),
      });
    } catch (err: any) {
      const msg =
        err?.response?.data?.message ||
        err?.response?.data?.error ||
        err?.message ||
        "Invalid email or password.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        {/* Header band */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Vistaar Flow</Text>
          {/* <Text style={styles.headerSub}>Admin / Agent Portal</Text> */}
          {/* <View style={styles.waBadge}>
            <Text style={styles.waBadgeText}>💬</Text>
            
         
          </View> */}
          <Image 
            source={require('../../../assets/logo.png')}
             style={styles.localImage} />
        </View>

        {/* Card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Sign In</Text>
          {/* <Text style={styles.cardSub}>Agent access only</Text> */}

          {!!error && (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          <View style={styles.field}>
            <Text style={styles.label}>Email</Text>
            <TextInput
              style={styles.input}
              placeholder="you@example.com"
              placeholderTextColor="#94a3b8"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              value={email}
              onChangeText={(t) => { setEmail(t); setError(""); }}
              onSubmitEditing={handleLogin}
              returnKeyType="next"
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Password</Text>
            <View style={styles.passwordRow}>
              <TextInput
                style={[styles.input, styles.passwordInput]}
                placeholder="••••••••"
                placeholderTextColor="#94a3b8"
                secureTextEntry={!showPassword}
                value={password}
                onChangeText={(t) => { setPassword(t); setError(""); }}
                onSubmitEditing={handleLogin}
                returnKeyType="done"
              />
              <TouchableOpacity
                onPress={() => setShowPassword((v) => !v)}
                style={styles.eyeBtn}
              >
                <Text style={styles.eyeText}>{showPassword ? "Hide" : "Show"}</Text>
              </TouchableOpacity>
            </View>
          </View>

          <TouchableOpacity
            style={[styles.loginBtn, loading && styles.loginBtnDisabled]}
            onPress={handleLogin}
            disabled={loading}
            activeOpacity={0.8}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.loginBtnText}>Sign In</Text>
            )}
          </TouchableOpacity>

          <Text style={styles.agentNote}>
            Admins and Agents can sign in here, but the web portal offers the best experience.          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
    localImage: { width:50, height: 50 ,borderRadius:10},

  root: { flex: 1, backgroundColor: "#f1f5f9" },
  scroll: { flexGrow: 1 },
  header: {
    backgroundColor: "#0f766e",
    paddingTop: 70,
    paddingBottom: 40,
    paddingHorizontal: 24,
    alignItems: "center",
    gap: 6,
  },
  headerTitle: {
    color: "#fff",
    fontSize: 28,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  headerSub: {
    color: "#99f6e4",
    fontSize: 15,
    fontWeight: "500",
  },
  waBadge: {
    marginTop: 12,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "rgba(255,255,255,0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  waBadgeText: { fontSize: 30 },
  card: {
    margin: 20,
    marginTop: -20,
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 6,
    gap: 16,
  },
  cardTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: "#0f172a",
    textAlign: "center",
  },
  cardSub: {
    fontSize: 13,
    color: "#64748b",
    textAlign: "center",
    marginTop: -8,
  },
  errorBox: {
    backgroundColor: "#fef2f2",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#fecaca",
    padding: 10,
  },
  errorText: { color: "#dc2626", fontSize: 13, textAlign: "center" },
  field: { gap: 6 },
  label: { fontSize: 14, fontWeight: "600", color: "#374151" },
  input: {
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 15,
    color: "#0f172a",
    backgroundColor: "#f8fafc",
  },
  passwordRow: { flexDirection: "row", alignItems: "center" },
  passwordInput: { flex: 1 },
  eyeBtn: {
    position: "absolute",
    right: 12,
    paddingVertical: 10,
  },
  eyeText: { color: "#64748b", fontSize: 13, fontWeight: "500" },
  loginBtn: {
    backgroundColor: "#0f766e",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 4,
  },
  loginBtnDisabled: { opacity: 0.6 },
  loginBtnText: { color: "#fff", fontSize: 16, fontWeight: "700" },
  agentNote: {
    fontSize: 12,
    color: "#94a3b8",
    textAlign: "center",
    lineHeight: 18,
  },
});
