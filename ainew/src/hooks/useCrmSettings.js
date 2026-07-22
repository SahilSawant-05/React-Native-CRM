import { useEffect, useState } from "react";
import api from "../api/axios";

export default function useCrmSettings() {
  const [settings, setSettings] = useState({ activeIndustryKey: "GENERIC" });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    api
      .get("/api/tenant/crm-settings")
      .then((response) => {
        if (!cancelled) {
          setSettings({
            ...response.data,
            activeIndustryKey: response.data?.activeIndustryKey || "GENERIC",
          });
        }
      })
      .catch(() => {
        if (!cancelled) setSettings({ activeIndustryKey: "GENERIC" });
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return { settings, activeIndustryKey: settings.activeIndustryKey || "GENERIC", loading };
}
