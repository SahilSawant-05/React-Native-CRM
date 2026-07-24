import { clearAuthSession, decodeToken, isIdleExpired, isTokenExpired } from "../auth/session";

// /**
//  * Returns the current logged-in user and helpers.
//  * Reads from localStorage where your login stores the JWT payload.
//  *
//  * Usage:
//  *   const { user, role, isAdmin, isAgent, isOwner } = useAuth();
//  */
// export default function useAuth() {
//   const user = useMemo(() => {
//     try {
//       // Try "user" key first (object stored at login)
//       const stored = localStorage.getItem("user");
//       if (stored) return JSON.parse(stored);

//       // Fallback: decode JWT directly
//       const token = localStorage.getItem("token");
//       if (!token) return null;
//       const payload = JSON.parse(atob(token.split(".")[1]));
//       return payload;
//     } catch {
//       return null;
//     }
//   }, []);

//   const role = user?.role ?? null; // "OWNER" | "ADMIN" | "AGENT"

//   return {
//     user,
//     role,
//     isOwner: role === "OWNER",
//     isAdmin: role === "ADMIN" || role === "OWNER", // OWNER has all admin rights
//     isAgent: role === "AGENT",
//   };
// }
export default function useAuth() {
  const token = sessionStorage.getItem("token");

  if (!token || isTokenExpired(token) || isIdleExpired()) {
    if (token) {
      clearAuthSession("Your session expired. Please log in again.");
    }
    return {
      isAdmin: false,
      isSuperAdmin: false,
      role: null,
      user: null,
    };
  }

  try {
    const payload = decodeToken(token);
    if (!payload) throw new Error("Invalid token");

    const role = payload.role || payload.Role;

    return {
      role,
      isAdmin: role === "ADMIN" || role === "OWNER" || role === "SUPER_ADMIN",
      isSuperAdmin: role === "SUPER_ADMIN",
      user: {
        name: payload.name,
        email: payload.sub || payload.email,
      },
    };
  } catch {
    return {
      isAdmin: false,
      isSuperAdmin: false,
      role: null,
      user: null,
    };
  }
}
