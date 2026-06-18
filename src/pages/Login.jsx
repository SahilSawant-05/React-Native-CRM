import { useState, useContext } from "react";
import api from "../api/axios";
import { useLocation, useNavigate } from "react-router-dom";
import { messageContext } from "../store/messageContext";
import whatsappLogo from "../assets/whatsapp.png";
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
    if (res.data.role === "OWNER") {
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
      <section className="min-h-screen grid grid-cols-1 lg:grid-cols-2">
        <div className="flex flex-col items-center justify-center bg-blue-600 text-white sm:p-10 lg:p-10 md:p-15 sm:space-y-9 lg:space-y-6">
          <h1 className="text-2xl sm:text-5xl lg:text-4xl font-bold my-3 text-center">
            WhatsApp CRM
          </h1>
          <p className="text-center text-base sm:text-5xl lg:text-2xl max-w-xs sm:max-w-full">
            Manage your leads, clients, and conversations in one place with ease.
          </p>
          <img
            src={whatsappLogo}
            alt="WhatsApp"
            className="w-20 sm:w-24 lg:w-28 my-4"
          />
        </div>

        <div className="bg-gray-50 flex flex-col items-center sm:items-center justify-center sm:p-5 lg:pl-5 md:p-7">
          <div className="bg-white rounded-3xl shadow-2xl sm:w-full px-5 lg:w-2/3 md:w-full lg:px-4 sm:p-20 sm:h-3/5 md:h-4/5 flex flex-col justify-center p-10">

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

            <h2 className="text-4xl sm:text-4xl font-medium block text-center text-blue-700">
              Login
            </h2>

            <div>
              <label className="text-gray-700 lg:text-xl sm:text-4xl font-medium block">
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
                className="w-full mt-2 p-2 sm:p-2 text-base border border-gray-300 rounded focus:ring-2 focus:ring-blue-400 outline-none lg:text-lg sm:text-2xl font-medium block"
              />
            </div>

            <div>
              <label className="text-gray-700 lg:text-lg sm:text-4xl font-medium block">
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
                  className="w-full mt-2 p-2 sm:p-2 text-base border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-400 outline-none lg:text-lg sm:text-4xl font-medium block"
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

            <div className="flex items-center justify-between">
              <label className="items-center text-sm text-gray-600 lg:text-lg sm:text-3xl font-medium block">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="mr-2 accent-blue-600"
                />
                Remember me
              </label>
              <a href="#" className="text-sm text-blue-600 hover:underline sm:text-3xl lg:text-sm">
                Forgot password?
              </a>
            </div>

            <button
              onClick={login}
              disabled={loading}
              className="w-full bg-blue-800 text-white p-2 sm:p-2 rounded-xl hover:bg-blue-700 transition lg:text-2xl sm:text-4xl block disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {loading ? "Signing in…" : "Login"}
            </button>

            <p className="text-sm text-center text-gray-600 mt-6 sm:text-4xl lg:text-lg">
              Don't have an account?
              <button
                onClick={() => navigate("/signup")}
                className="text-blue-600 font-medium hover:underline"
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
