import { Navigate } from "react-router-dom";
import useAuth from "../hooks/useAuth";

/**
 * Wraps a route so only users with an allowed role can access it.
 * Everyone else gets redirected to /dashboard.
 *
 * Usage in App.jsx:
 *   <Route path="dashboard/campaigns/create" element={
 *     <RequireRole allowed={["ADMIN", "OWNER"]}>
 *       <CreateCampaign />
 *     </RequireRole>
 *   } />
 */
export default function RequireRole({ allowed, children }) {
  const { role } = useAuth();

  if (!role) return <Navigate to="/login" replace />;
  if (!allowed.includes(role)) return <Navigate to="/dashboard" replace />;

  return children;
}