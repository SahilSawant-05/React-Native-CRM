import { CreditCard, X } from "lucide-react";
import { useNavigate } from "react-router-dom";

export const errorMessage = (error, fallback = "Something went wrong.") =>
  error?.response?.data?.message ||
  error?.response?.data?.error ||
  error?.message ||
  fallback;

export const isPlanLimitError = (errorOrMessage) => {
  const message = String(
    typeof errorOrMessage === "string" ? errorOrMessage : errorMessage(errorOrMessage, "")
  ).toLowerCase();
  return (
    (
      message.includes("current plan") ||
      message.includes("plan is expired") ||
      message.includes("plan has expired") ||
      message.includes("renew your plan")
    ) &&
    (
      message.includes("upgrade") ||
      message.includes("renew") ||
      message.includes("expired") ||
      message.includes("seats") ||
      message.includes("contacts") ||
      message.includes("pipelines")
    )
  );
};

export default function PlanUpgradePrompt({ open, message, onClose }) {
  const navigate = useNavigate();
  if (!open) return null;

  const goToBilling = () => {
    onClose?.();
    navigate("/dashboard/billing");
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/50 p-4">
      <div className="w-full max-w-md overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-teal-50 p-2 text-teal-700">
              <CreditCard size={20} />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-slate-950">Plan limit reached</h2>
              <p className="mt-0.5 text-sm text-slate-500">Upgrade your plan to continue.</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700">
            <X size={18} />
          </button>
        </div>
        <div className="px-5 py-4">
          <p className="text-sm leading-6 text-slate-700">{message}</p>
          <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button type="button" onClick={onClose} className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50">
              Not now
            </button>
            <button type="button" onClick={goToBilling} className="rounded-lg bg-teal-700 px-4 py-2 text-sm font-extrabold text-white hover:bg-teal-800">
              View Plans
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
