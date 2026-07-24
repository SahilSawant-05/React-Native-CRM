import { useState, useContext } from "react";
import api from "../api/axios";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { messageContext } from "../store/messageContext";
import vistaarLogo from "../assets/vistaar-flow-logo.png";
import { emailValidationMessage, normalizeEmail } from "../utils/emailValidation";
import { markActivity } from "../auth/session";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const navigate = useNavigate();
  const location = useLocation();
  const { message, setmessage } = useContext(messageContext);
  const logoutMessage = sessionStorage.getItem("logoutMessage") || "";
  const successMessage = location.state?.successMessage || message || logoutMessage;

  const login = async () => {
    setError("");
    const normalizedEmail = normalizeEmail(email);
    const emailError = emailValidationMessage(normalizedEmail);
    if (emailError) return setError(emailError);
    if (!password.trim()) return setError("Please enter your password.");

    setLoading(true);
     try {
    const res = await api.post("/auth/login", {
      email: normalizedEmail,
      password,
    });

    sessionStorage.setItem("token", res.data.token);
    sessionStorage.setItem("role", res.data.role);
    sessionStorage.setItem("tenantId", String(res.data.tenantId || ""));
    sessionStorage.setItem(
      "user",
      JSON.stringify({
        email: normalizedEmail,
        role: res.data.role,
        tenantId: res.data.tenantId,
        id: res.data.userId,
      })
    );
    sessionStorage.removeItem("logoutMessage");
    markActivity();

    console.log("ROLE:", res.data.role);

    // Redirect based on role
    if (res.data.role === "SUPER_ADMIN") {
      navigate("/dashboard/platform-billing");
    } else if (res.data.role === "OWNER") {
      navigate("/dashboard");
    } else if (res.data.role === "ADMIN") {
      navigate("/dashboard");
    } else {
      navigate("/dashboard");
    }

  } catch (err) {
    const responseData = err?.response?.data;
    const msg =
      responseData?.message ||
      responseData?.error ||
      (typeof responseData === "string" ? responseData : null) ||
      "Invalid email or password.";

    setError(msg);

  } finally {
    setLoading(false);
  }
  };

  return (
    <>
      <section className="grid min-h-dvh grid-cols-1 bg-slate-50 lg:grid-cols-2">
        <div className="flex flex-col items-center justify-center bg-blue-700 px-5 py-5 text-white sm:px-8 sm:py-8 lg:p-10">
          <h1 className="text-center text-2xl font-bold lg:text-4xl">
            Vistaar Flow
          </h1>
          <p className="mt-2 max-w-md text-center text-sm leading-6 text-blue-50 sm:text-base lg:mt-5 lg:text-xl">
            AI-Powered CRM & Growth Platform for Modern Businesses.
            Expand. Automate. Grow. Where Every Lead Moves Forward.
          </p>
          <img
            src={vistaarLogo}
            alt="Vistaar Flow"
            className="mt-3 w-20 rounded-xl bg-white p-1.5 sm:w-24 lg:mt-6 lg:w-28"
          />
        </div>

        <div className="flex items-center justify-center bg-gray-50 p-4 sm:p-7">
          <div className="w-full max-w-md space-y-4 rounded-2xl bg-white p-5 shadow-xl sm:p-8">

            {successMessage && (
              <p style={{ color: "green", textAlign: "center", marginBottom: "8px" }}>
                {successMessage}
              </p>
            )}

            {/* Inline error */}
            {error && (
              <p style={{ color: "red", textAlign: "center", marginBottom: "8px" }}>
                {error}
              </p>
            )}

            <h2 className="text-center text-2xl font-bold text-blue-700 sm:text-3xl">
              Login
            </h2>

            <div>
              <label className="block text-sm font-medium text-gray-700">
                Email
              </label>
              <input
                placeholder="Email"
                type="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setError("");
                  sessionStorage.removeItem("logoutMessage");
                  if (successMessage) setmessage("");
                }}
                onKeyDown={(e) => e.key === "Enter" && login()}
                className="mt-1.5 block min-h-11 w-full rounded-lg border border-gray-300 px-3 py-2 text-base font-medium outline-none focus:ring-2 focus:ring-blue-400"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  placeholder="Password"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setError("");
                    sessionStorage.removeItem("logoutMessage");
                    if (successMessage) setmessage("");
                  }}
                  onKeyDown={(e) => e.key === "Enter" && login()}
                  className="mt-1.5 block min-h-11 w-full rounded-lg border border-gray-300 px-3 py-2 pr-16 text-base font-medium outline-none focus:ring-2 focus:ring-blue-400"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? "Hide" : "Show"}
                </button>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3">
              <label className="flex items-center text-sm font-medium text-gray-600">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="mr-2 accent-blue-600"
                />
                Remember me
              </label>
              <Link to="/forgot-password" className="text-sm text-blue-600 hover:underline">
                Forgot password?
              </Link>
            </div>

            <button
              onClick={login}
              disabled={loading}
              className="block min-h-11 w-full rounded-lg bg-blue-800 px-4 py-2 text-base font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? "Signing in…" : "Login"}
            </button>

            <p className="text-center text-sm text-gray-600">
              Don't have an account?
              <button
                onClick={() => navigate("/signup")}
                className="ml-1 font-medium text-blue-600 hover:underline"
              >
                Sign up
              </button>
            </p>
          </div>
        </div>
      </section>
    </>
  );
}
