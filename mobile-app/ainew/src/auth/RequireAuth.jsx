import { Navigate, useLocation } from "react-router-dom";
import { clearAuthSession, isIdleExpired, isTokenExpired } from "./session";

export default function RequireAuth({ children }) {
  const token = sessionStorage.getItem("token");
  const location = useLocation();

  if (!token || isTokenExpired(token) || isIdleExpired()) {
    if (token) {
      clearAuthSession("Your session expired. Please log in again.");
    }
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return children;
}
