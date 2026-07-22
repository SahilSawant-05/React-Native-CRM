import { useState } from "react";
import { Link } from "react-router-dom";
import api from "../api/axios";
import vistaarLogo from "../assets/vistaar-flow-logo.png";
import { emailValidationMessage, normalizeEmail } from "../utils/emailValidation";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    setError("");
    setMessage("");
    const normalizedEmail = normalizeEmail(email);
    const emailError = emailValidationMessage(normalizedEmail);
    if (emailError) {
      setError(emailError);
      return;
    }

    setLoading(true);
    try {
      const response = await api.post("/auth/forgot-password", { email: normalizedEmail });
      setMessage(response.data?.message || "If this email exists, a password reset link has been sent.");
    } catch (err) {
      const data = err?.response?.data;
      setError(data?.message || data?.error || "Unable to request password reset. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="grid min-h-dvh grid-cols-1 bg-slate-50 lg:grid-cols-2">
      <div className="flex flex-col items-center justify-center bg-blue-700 px-5 py-5 text-white sm:px-8 sm:py-8 lg:p-10">
        <h1 className="text-center text-2xl font-bold lg:text-4xl">Vistaar Flow</h1>
        <p className="mt-2 max-w-md text-center text-sm leading-6 text-blue-50 sm:text-base lg:mt-5 lg:text-xl">
          Reset your access and get back to moving every lead forward.
        </p>
        <img
          src={vistaarLogo}
          alt="Vistaar Flow"
          className="mt-3 w-20 rounded-xl bg-white p-1.5 sm:w-24 lg:mt-6 lg:w-28"
        />
      </div>

      <div className="flex items-center justify-center bg-gray-50 p-4 sm:p-7">
        <div className="w-full max-w-md space-y-4 rounded-2xl bg-white p-5 shadow-xl sm:p-8">
          <div>
            <h2 className="text-center text-2xl font-bold text-blue-700 sm:text-3xl">Forgot password</h2>
            <p className="mt-2 text-center text-sm font-medium leading-6 text-gray-500">
              Enter your account email. We will send a secure reset link if the email exists.
            </p>
          </div>

          {message && (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-center text-sm font-semibold text-emerald-700">
              {message}
            </div>
          )}

          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-center text-sm font-semibold text-red-700">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700">Email</label>
            <input
              placeholder="Email"
              type="email"
              value={email}
              onChange={(event) => {
                setEmail(event.target.value);
                setError("");
                setMessage("");
              }}
              onKeyDown={(event) => event.key === "Enter" && submit()}
              className="mt-1.5 block min-h-11 w-full rounded-lg border border-gray-300 px-3 py-2 text-base font-medium outline-none focus:ring-2 focus:ring-blue-400"
            />
          </div>

          <button
            type="button"
            onClick={submit}
            disabled={loading}
            className="block min-h-11 w-full rounded-lg bg-blue-800 px-4 py-2 text-base font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? "Sending reset link..." : "Send reset link"}
          </button>

          <p className="text-center text-sm text-gray-600">
            Remembered your password?
            <Link to="/login" className="ml-1 font-medium text-blue-600 hover:underline">
              Login
            </Link>
          </p>
        </div>
      </div>
    </section>
  );
}
