import React, { useState } from "react";
import api from "./api/axios";

const WhatsAppConnectButton = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const connectWhatsApp = async () => {
    try {
      setLoading(true);
      setError("");

      const response = await api.get("/api/meta/login-url");

      const loginUrl = response.data.url;

      if (loginUrl) {
        window.location.href = loginUrl;
      } else {
        setError("Login URL was not received from the server.");
      }
    } catch (error) {
      console.error("WhatsApp Connect Error:", error);
      setError(
        error.response?.data?.message ||
          error.response?.data?.error ||
          "Failed to connect WhatsApp. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: "grid", gap: "8px" }}>
      <button
        onClick={connectWhatsApp}
        disabled={loading}
        style={{
          backgroundColor: "#25D366",
          color: "#fff",
          padding: "12px 24px",
          border: "none",
          borderRadius: "6px",
          fontSize: "16px",
          cursor: loading ? "not-allowed" : "pointer",
          opacity: loading ? 0.8 : 1,
        }}
      >
        {loading ? "Connecting..." : "Connect WhatsApp"}
      </button>
      {error && <p style={{ color: "#e11d48", fontSize: "14px", margin: 0 }}>{error}</p>}
    </div>
  );
};

export default WhatsAppConnectButton;
