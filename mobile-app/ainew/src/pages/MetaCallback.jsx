import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import api from "../api/axios";

export default function MetaCallback() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState("Connecting your WhatsApp account…");
  const [error, setError] = useState("");

  useEffect(() => {
    const code = params.get("code");

    if (!code) {
      setStatus("Meta onboarding could not continue.");
      setError("Missing authorization code from Meta.");
      return;
    }

    api
      .post("/api/meta/callback", { code })
      .then(() => {
        setError("");
        setStatus("WhatsApp connected successfully. Redirecting…");
        window.setTimeout(() => navigate("/dashboard"), 1200);
      })
      .catch((callbackError) => {
        setStatus("Meta onboarding could not be completed.");
        setError(
          callbackError.response?.data?.message ||
            callbackError.response?.data?.error ||
            "Meta onboarding failed. Please try connecting again."
        );
      });
  }, [navigate, params]);

  return (
    <div className="min-h-[40vh] grid place-items-center px-6">
      <div className="w-full max-w-md rounded-2xl border border-gray-100 bg-white p-6 shadow-sm text-center">
        <p className="text-lg font-semibold text-gray-800">{status}</p>
        {error ? (
          <p className="mt-3 text-sm text-rose-500">{error}</p>
        ) : (
          <p className="mt-3 text-sm text-gray-500">
            Please keep this tab open while we finish the connection.
          </p>
        )}
      </div>
    </div>
  );
}
