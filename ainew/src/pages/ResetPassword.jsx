import { useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import api from "../api/axios";
import vistaarLogo from "../assets/vistaar-flow-logo.png";

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = useMemo(() => searchParams.get("token") || "", [searchParams]);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    setError("");
    setMessage("");
    if (!token) {
      setError("Reset token is missing. Please request a new reset link.");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      const response = await api.post("/auth/reset-password", {
        token,
        newPassword: password,
      });
      const nextMessage = response.data?.message || "Password updated successfully.";
      setMessage(nextMessage);
      setTimeout(() => {
        navigate("/login", { state: { successMessage: nextMessage } });
      }, 900);
    } catch (err) {
      const data = err?.response?.data;
      setError(data?.message || data?.error || "Unable to reset password. Please request a new reset link.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="grid min-h-dvh grid-cols-1 bg-slate-50 lg:grid-cols-2">
      <div className="flex flex-col items-center justify-center bg-blue-700 px-5 py-5 text-white sm:px-8 sm:py-8 lg:p-10">
        <h1 className="text-center text-2xl font-bold lg:text-4xl">Vistaar Flow</h1>
        <p className="mt-2 max-w-md text-center text-sm leading-6 text-blue-50 sm:text-base lg:mt-5 lg:text-xl">
          Create a new password and continue your CRM work securely.
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
            <h2 className="text-center text-2xl font-bold text-blue-700 sm:text-3xl">Reset password</h2>
            <p className="mt-2 text-center text-sm font-medium leading-6 text-gray-500">
              Use a strong password with at least 8 characters.
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
            <label className="block text-sm font-medium text-gray-700">New password</label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                placeholder="New password"
                value={password}
                onChange={(event) => {
                  setPassword(event.target.value);
                  setError("");
                  setMessage("");
                }}
                className="mt-1.5 block min-h-11 w-full rounded-lg border border-gray-300 px-3 py-2 pr-16 text-base font-medium outline-none focus:ring-2 focus:ring-blue-400"
              />
              <button
                type="button"
                onClick={() => setShowPassword((value) => !value)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 hover:text-gray-600"
              >
                {showPassword ? "Hide" : "Show"}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Confirm password</label>
            <input
              type={showPassword ? "text" : "password"}
              placeholder="Confirm password"
              value={confirmPassword}
              onChange={(event) => {
                setConfirmPassword(event.target.value);
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
            {loading ? "Updating password..." : "Update password"}
          </button>

          <p className="text-center text-sm text-gray-600">
            Need a new link?
            <Link to="/forgot-password" className="ml-1 font-medium text-blue-600 hover:underline">
              Request reset
            </Link>
          </p>
        </div>
      </div>
    </section>
  );
}
