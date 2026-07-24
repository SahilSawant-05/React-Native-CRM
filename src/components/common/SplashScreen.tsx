import React, { useEffect, useRef } from "react";
import { Animated, Easing, Image, Platform, StyleSheet, Text, View } from "react-native";

/**
 * Premium branded startup screen shown while the session is being restored.
 * Pure React Native Animated (no extra deps): a soft glowing backdrop, the
 * logo fading + scaling in, the wordmark rising into place, and an
 * indeterminate progress bar with a sliding sheen for a polished feel.
 */
export default function SplashScreen({ message = "Loading your workspace" }: { message?: string }) {
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const logoScale = useRef(new Animated.Value(0.82)).current;
  const titleY = useRef(new Animated.Value(14)).current;
  const titleOpacity = useRef(new Animated.Value(0)).current;
  const glow = useRef(new Animated.Value(0)).current;
  const slide = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Entrance: logo fades + springs, then the wordmark rises in.
    Animated.sequence([
      Animated.parallel([
        Animated.timing(logoOpacity, { toValue: 1, duration: 520, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        Animated.spring(logoScale, { toValue: 1, friction: 6, tension: 60, useNativeDriver: true }),
      ]),
      Animated.parallel([
        Animated.timing(titleOpacity, { toValue: 1, duration: 420, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        Animated.timing(titleY, { toValue: 0, duration: 420, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      ]),
    ]).start();

    // Ambient breathing glow behind the logo.
    Animated.loop(
      Animated.sequence([
        Animated.timing(glow, { toValue: 1, duration: 1600, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(glow, { toValue: 0, duration: 1600, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ])
    ).start();

    // Indeterminate progress sheen sliding across the bar.
    Animated.loop(
      Animated.timing(slide, { toValue: 1, duration: 1150, easing: Easing.inOut(Easing.ease), useNativeDriver: true })
    ).start();
  }, [glow, logoOpacity, logoScale, slide, titleOpacity, titleY]);

  const glowScale = glow.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1.15] });
  const glowOpacity = glow.interpolate({ inputRange: [0, 1], outputRange: [0.35, 0.6] });
  const sheenX = slide.interpolate({ inputRange: [0, 1], outputRange: [-BAR_WIDTH, BAR_WIDTH] });

  return (
    <View style={styles.root}>
      {/* Decorative corner glows for depth */}
      <View style={[styles.cornerGlow, styles.glowTop]} />
      <View style={[styles.cornerGlow, styles.glowBottom]} />

      <View style={styles.center}>
        <View style={styles.logoWrap}>
          <Animated.View
            style={[styles.logoGlow, { opacity: glowOpacity, transform: [{ scale: glowScale }] }]}
          />
          <Animated.View style={[styles.logoCard, { opacity: logoOpacity, transform: [{ scale: logoScale }] }]}>
            <Image source={require("../../../assets/logo.png")} style={styles.logo} resizeMode="contain" />
          </Animated.View>
        </View>

        <Animated.View style={{ opacity: titleOpacity, transform: [{ translateY: titleY }] }}>
          <Text style={styles.title}>
            Vistaar <Text style={styles.titleAccent}>Flow</Text>
          </Text>
          <Text style={styles.tagline}>Customer Relationship Management</Text>
        </Animated.View>
      </View>

      <View style={styles.footer}>
        <View style={styles.barTrack}>
          <Animated.View style={[styles.barSheen, { transform: [{ translateX: sheenX }] }]} />
        </View>
        <Text style={styles.message}>{message}</Text>
      </View>
    </View>
  );
}

const BAR_WIDTH = 200;
const FONT_MEDIUM = Platform.OS === "android" ? "sans-serif-medium" : undefined;

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#062a29", // deep brand teal
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  cornerGlow: {
    position: "absolute",
    width: 380,
    height: 380,
    borderRadius: 190,
  },
  glowTop: { top: -140, right: -120, backgroundColor: "rgba(20,184,166,0.16)" },
  glowBottom: { bottom: -160, left: -120, backgroundColor: "rgba(15,118,110,0.20)" },
  center: { alignItems: "center", gap: 22 },
  logoWrap: { alignItems: "center", justifyContent: "center" },
  logoGlow: {
    position: "absolute",
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: "rgba(45,212,191,0.35)",
  },
  logoCard: {
    width: 108,
    height: 108,
    borderRadius: 28,
    backgroundColor: "#ffffff",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.35,
    shadowRadius: 24,
    elevation: 14,
  },
  logo: { width: 72, height: 72 },
  title: {
    fontSize: 28,
    fontWeight: "800",
    color: "#f0fdfa",
    textAlign: "center",
    letterSpacing: 0.4,
    fontFamily: FONT_MEDIUM,
  },
  titleAccent: { color: "#2dd4bf" },
  tagline: {
    marginTop: 6,
    fontSize: 12,
    color: "rgba(204,251,241,0.65)",
    textAlign: "center",
    letterSpacing: 1.6,
    textTransform: "uppercase",
    fontWeight: "600",
  },
  footer: {
    position: "absolute",
    bottom: 64,
    alignItems: "center",
    gap: 14,
  },
  barTrack: {
    width: BAR_WIDTH,
    height: 4,
    borderRadius: 4,
    backgroundColor: "rgba(255,255,255,0.12)",
    overflow: "hidden",
  },
  barSheen: {
    width: BAR_WIDTH * 0.45,
    height: "100%",
    borderRadius: 4,
    backgroundColor: "#2dd4bf",
    shadowColor: "#2dd4bf",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 8,
  },
  message: {
    fontSize: 12.5,
    color: "rgba(204,251,241,0.6)",
    letterSpacing: 0.4,
    fontWeight: "500",
  },
});
