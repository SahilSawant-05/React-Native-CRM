import { useState } from "react";
import api from "../api/axios";
import { useNavigate } from "react-router-dom";
import { useContext } from "react";
import { messageContext } from "../store/messageContext";
import whatsappLogo from "../assets/whatsapp.png";
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
      <section className="min-h-screen grid grid-cols-1 lg:grid-cols-2">

        {/* LEFT SIDE */}

        <div
          className="flex flex-col items-center justify-center bg-blue-600 text-white sm:p-10 lg:p-10 md:p-15 sm:space-y-9 lg:space-y-6"
        >

          <h1 className="text-2xl sm:text-6xl lg:text-4xl font-bold my-3 text-center">
            WhatsApp CRM
          </h1>

          <p
            className="text-center text-base sm:text-5xl lg:text-2xl max-w-xs sm:max-w-full"
          >
            Manage your leads, clients, and conversations in one place with ease.
          </p>

          <img
            src={whatsappLogo}
            alt="WhatsApp"
            className="w-20 sm:w-24 lg:w-28 my-4"
          />
        </div>

        {/* RIGHT SIDE */}

        <div
          className="bg-gray-50 flex flex-col items-start sm:items-center justify-center sm:p-15 lg:pl-5 md:p-15"
          style={{ padding: "15px" }}
        >

          <div
            className="bg-white rounded-xl shadow-2xl lg:p-5 lg:w-3/5 sm:w-full md:w-full md:p-4 transition-all duration-500 sm:p-10"
            style={{ padding: "12px" }}
          >

            <h2 className="lg:text-3xl sm:text-5xl font-semibold text-center text-blue-700 mb-6">
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
              className="w-full border border-gray-300 rounded-md px-3 py-2 my-3 hover:bg-gray-200 focus:ring-2 focus:ring-blue-600 focus:outline-none sm:text-4xl lg:text-lg"
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
              className="w-full border border-gray-300 rounded-md px-3 py-2 my-3 hover:bg-gray-200 focus:ring-2 focus:ring-blue-600 focus:outline-none sm:text-4xl lg:text-lg"
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
              className="w-full border border-gray-300 rounded-md px-3 py-2 my-3 hover:bg-gray-200 focus:ring-2 focus:ring-blue-600 focus:outline-none sm:text-4xl lg:text-lg"
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
              className="w-full border border-gray-300 rounded-md px-3 py-2 my-3 hover:bg-gray-200 focus:ring-2 focus:ring-blue-600 focus:outline-none sm:text-4xl lg:text-lg"
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
              className="w-full border border-gray-300 rounded-md px-3 py-2 my-3 hover:bg-gray-200 focus:ring-2 focus:ring-blue-600 focus:outline-none sm:text-4xl lg:text-lg"
            />

            {/* BUTTON */}

            <button
              onClick={submit}
              disabled={loading}
              className="w-full bg-blue-800 text-white py-2 my-3 rounded-md hover:bg-blue-700 transition sm:text-4xl lg:text-lg disabled:opacity-60"
            >
              {loading ? "Creating..." : "Signup"}
            </button>

            {/* LOGIN */}

            <p className="text-sm text-center text-gray-600 mt-6 sm:text-4xl lg:text-lg">
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
