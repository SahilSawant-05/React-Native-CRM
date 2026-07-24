import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { clearAuthSession } from "../auth/session";

export default function Logout() {
  const nav = useNavigate();

  useEffect(() => {
    clearAuthSession("You have been logged out.");
    nav("/login", { replace: true });
  }, [nav]);

  return null;
}
