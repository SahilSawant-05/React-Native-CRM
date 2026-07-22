// import axios from "axios";

// const api = axios.create({
//   baseURL: "http://localhost:8081",
// });

// api.interceptors.request.use((config) => {
//   const token = localStorage.getItem("token");
//   if (token) {
//     config.headers.Authorization = `Bearer ${token}`;
//     config.headers["Content-Type"]=`application/json`;
//   }
//   return config;
// });

// export default api;


// import axios from "axios";

// const api = axios.create({
//   baseURL: "http://localhost:8081",
//   headers: {
//     "Content-Type": "application/json",  // ✅ always set, not inside if(token)
//   },
// });

// api.interceptors.request.use((config) => {
//   // ✅ check all common token key names
//   const token =
//     localStorage.getItem("token") ||
//     localStorage.getItem("accessToken") ||
//     localStorage.getItem("authToken") ||
//     localStorage.getItem("access_token");

//   if (token) {
//     config.headers.Authorization = `Bearer ${token}`;
//   }

//   // Debug — remove after fixing
//   // console.log("→", config.method?.toUpperCase(), config.url, "| Auth:", config.headers.Authorization);

//   return config;
// });

// export default api;

import axios from "axios";
import { API_BASE_URL } from "../config/env";
import { clearAuthSession, isIdleExpired, isTokenExpired, markActivity, redirectToLogin } from "../auth/session";

const api = axios.create({
  baseURL: API_BASE_URL,
});

/* ── Attach JWT + Content-Type to every request ─────────────────── */
api.interceptors.request.use((config) => {
  const token = sessionStorage.getItem("token");
  if (token && (isTokenExpired(token) || isIdleExpired())) {
    redirectToLogin("Your session expired. Please log in again.");
    return Promise.reject(new axios.Cancel("Session expired"));
  }
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
    markActivity();
  }

  // Let the browser set multipart boundaries for FormData uploads.
  if (config.data instanceof FormData) {
    delete config.headers["Content-Type"];
  } else {
    config.headers["Content-Type"] = "application/json";
  }
  return config;
});

/* ── Global response error handler ──────────────────────────────── */
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const requestUrl = error.config?.url || "";
    const isLoginRequest = requestUrl.includes("/auth/login");

    if (error.response?.status === 401 && !isLoginRequest) {
      clearAuthSession("Your session expired. Please log in again.");
      window.location.href = "/login";
    }
    return Promise.reject(error);
  }
);

/* ── Users API (ADMIN / OWNER only) ─────────────────────────────── *
 * GET    /api/users              → list all tenant users            *
 * POST   /api/users              → create a new user (not OWNER)    *
 * PUT    /api/users/:userId/role → update a user's role (not OWNER) *
 * ─────────────────────────────────────────────────────────────────*/
export const usersApi = {
  /** List all users in the tenant */
  list: () =>
    api.get("/api/users").then((r) => r.data),

  /** Create a new AGENT or ADMIN user
   *  @param {{ email: string, password: string, role: "AGENT"|"ADMIN" }} data
   */
  create: (data) =>
    api.post("/api/users", data).then((r) => r.data),

  /** Update a user's role (cannot set OWNER, cannot change your own role)
   *  @param {number|string} userId
   *  @param {"AGENT"|"ADMIN"} role
   */
  updateRole: (userId, role) =>
    api.put(`/api/users/${userId}/role`, { role }).then((r) => r.data),
};

export default api;
