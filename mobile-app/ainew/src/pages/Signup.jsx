import { useState } from "react";
import api from "../api/axios";
import { useNavigate } from "react-router-dom";
import { useContext } from "react";
import { messageContext } from "../store/messageContext";
import vistaarLogo from "../assets/vistaar-flow-logo.png";
import { emailValidationMessage, normalizeEmail } from "../utils/emailValidation";

export default function Signup() {
  const [form, setForm] = useState({
    businessName: "",
    email: "",
    password: "",
    country: "",
    industry: "",
  });

  const [loading, setLoading] = useState(false);

  const [error, setError] = useState("");

  const { message, setmessage } = useContext(messageContext);

  const navigate = useNavigate();

  const submit = async () => {
    setError("");

    if (!form.businessName.trim()) {
      return setError("Business name is required.");
    }

    if (!form.email.trim()) {
      return setError("Email is required.");
    }
    const normalizedEmail = normalizeEmail(form.email);
    const emailError = emailValidationMessage(normalizedEmail);
    if (emailError) {
      return setError(emailError);
    }

    if (!form.password.trim()) {
      return setError("Password is required.");
    }

    if (!form.country.trim()) {
      return setError("Country is required.");
    }

    if (!form.industry.trim()) {
      return setError("Industry is required.");
    }

    try {
      setLoading(true);

      await api.post("/public/tenants/signup", {
        businessName: form.businessName.trim(),
        email: normalizedEmail,
        password: form.password,
        country: form.country.trim(),
        industry: form.industry.trim(),
      });

      const successMessage = "Tenant created successfully. Please log in.";
      setmessage(successMessage);

      navigate("/login", {
        state: { successMessage },
      });
    } catch (err) {
      const responseData = err?.response?.data;

      setError(
        responseData?.message ||
        responseData?.error ||
        (typeof responseData === "string" ? responseData : null) ||
        "Signup failed. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <section className="grid min-h-dvh grid-cols-1 bg-slate-50 lg:grid-cols-2">

        {/* LEFT SIDE */}

        <div
          className="flex flex-col items-center justify-center bg-blue-700 px-5 py-5 text-white sm:px-8 sm:py-8 lg:p-10"
        >

          <h1 className="text-center text-2xl font-bold lg:text-4xl">
            Vistaar Flow
          </h1>

          <p
            className="mt-2 max-w-md text-center text-sm leading-6 text-blue-50 sm:text-base lg:mt-5 lg:text-xl"
          >
            AI-Powered CRM & Growth Platform for Modern Businesses.
            Expand. Automate. Grow. Where Every Lead Moves Forward.
          </p>

          <img
            src={vistaarLogo}
            alt="Vistaar Flow"
            className="mt-3 w-20 rounded-xl bg-white p-1.5 sm:w-24 lg:mt-6 lg:w-28"
          />
        </div>

        {/* RIGHT SIDE */}

        <div
          className="flex items-center justify-center bg-gray-50 p-4 sm:p-7"
        >

          <div
            className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl transition-all duration-500 sm:p-8"
          >

            <h2 className="mb-5 text-center text-2xl font-bold text-blue-700 sm:text-3xl">
              Tenant Signup
            </h2>

            {message && (
              <p
                style={{
                  color: "green",
                  textAlign: "center",
                  marginBottom: "10px",
                }}
              >
                {message}
              </p>
            )}

            {error && (
              <p
                style={{
                  color: "red",
                  textAlign: "center",
                  marginBottom: "10px",
                }}
              >
                {error}
              </p>
            )}

            {/* BUSINESS NAME */}

            <input
              placeholder="Business Name"
              value={form.businessName}
              onChange={(e) =>
                setForm({
                  ...form,
                  businessName: e.target.value,
                })
              }
              onKeyDown={(e) => e.key === "Enter" && submit()}
              className="my-2 min-h-11 w-full rounded-lg border border-gray-300 px-3 py-2 text-base outline-none focus:ring-2 focus:ring-blue-600"
            />

            {/* EMAIL */}

            <input
              type="email"
              placeholder="Email"
              value={form.email}
              onChange={(e) =>
                setForm({
                  ...form,
                  email: e.target.value,
                })
              }
              onKeyDown={(e) => e.key === "Enter" && submit()}
              className="my-2 min-h-11 w-full rounded-lg border border-gray-300 px-3 py-2 text-base outline-none focus:ring-2 focus:ring-blue-600"
            />

            {/* PASSWORD */}

            <input
              type="password"
              placeholder="Password"
              value={form.password}
              onChange={(e) =>
                setForm({
                  ...form,
                  password: e.target.value,
                })
              }
              onKeyDown={(e) => e.key === "Enter" && submit()}
              className="my-2 min-h-11 w-full rounded-lg border border-gray-300 px-3 py-2 text-base outline-none focus:ring-2 focus:ring-blue-600"
            />

            {/* COUNTRY */}

            <select
              placeholder="Country"
              value={form.country}
              onChange={(e) =>
                setForm({
                  ...form,
                  country: e.target.value,
                })
              }
              onKeyDown={(e) => e.key === "Enter" && submit()}
              className="my-2 min-h-11 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-base outline-none focus:ring-2 focus:ring-blue-600"
            >
              <option value="">
                Select Country
              </option>
              <option value="INDIA">
                INDIA
              </option>

              <option value="CANADA">
                CANADA
              </option>
              </select>
            

            {/* INDUSTRY */}

            <input
              placeholder="Industry"
              value={form.industry}
              onChange={(e) =>
                setForm({
                  ...form,
                  industry: e.target.value,
                })
              }
              onKeyDown={(e) => e.key === "Enter" && submit()}
              className="my-2 min-h-11 w-full rounded-lg border border-gray-300 px-3 py-2 text-base outline-none focus:ring-2 focus:ring-blue-600"
            />

            {/* BUTTON */}

            <button
              onClick={submit}
              disabled={loading}
              className="my-3 min-h-11 w-full rounded-lg bg-blue-800 px-4 py-2 text-base font-semibold text-white transition hover:bg-blue-700 disabled:opacity-60"
            >
              {loading ? "Creating..." : "Signup"}
            </button>

            {/* LOGIN */}

            <p className="mt-4 text-center text-sm text-gray-600">
              Already signed up?
              <button
                onClick={() => navigate("/login")}
                className="text-blue-600 font-medium hover:underline ml-1"
              >
                Login
              </button>
            </p>

          </div>
        </div>
      </section>
    </>
  );
}
