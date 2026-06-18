import { useEffect, useRef, useState } from "react";
import CustomFieldInputs from "./CustomFieldInputs";
import useCrmSettings from "../hooks/useCrmSettings";

const LEAD_SOURCE_OPTIONS = [
  { value: "", label: "Select source" },
  { value: "WHATSAPP", label: "WhatsApp" },
  { value: "WEBSITE", label: "Website" },
  { value: "FACEBOOK", label: "Facebook" },
  { value: "INSTAGRAM", label: "Instagram" },
  { value: "GOOGLE_ADS", label: "Google Ads" },
  { value: "REFERRAL", label: "Referral" },
  { value: "WALK_IN", label: "Walk-in" },
  { value: "PORTAL", label: "Portal" },
  { value: "CAMPAIGN", label: "Campaign" },
  { value: "OTHER", label: "Other" },
];

const INDUSTRY_OPTIONS = [
  { value: "", label: "Select industry" },
  { value: "REAL_ESTATE", label: "Real Estate" },
  { value: "EDUCATION", label: "Education" },
  { value: "BIKE_SALES", label: "Bike Sales" },
  { value: "GENERIC", label: "Generic" },
];

function industryLabel(value) {
  return INDUSTRY_OPTIONS.find((option) => option.value === value)?.label || "Generic";
}

function EditContact({
  show,
  onClose,
  onSave,
  contact,
  customFields = [],
  customFieldValues = {},
}) {
  const dialogRef = useRef(null);
  const { activeIndustryKey } = useCrmSettings();
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    company: "",
    designation: "",
    tags: "",
    leadSource: "",
    leadSourceDetail: "",
    industryKey: "",
    city: "",
    lead_score: "",
  });
  const [fieldValues, setFieldValues] = useState({});
  const [showAdvancedIndustry, setShowAdvancedIndustry] = useState(false);

  // Pre-fill form whenever the contact changes
  useEffect(() => {
    if (contact) {
      setForm({
        name:        contact.name        || "",
        email:       contact.email       || "",
        phone:       contact.phone       || "",
        company:     contact.company     || "",
        designation: contact.designation || "",
        tags: Array.isArray(contact.tags)
          ? contact.tags.join(", ")
          : contact.tags || "",
        leadSource: contact.leadSource || "",
        leadSourceDetail: contact.leadSourceDetail || "",
        industryKey: contact.industryKey || activeIndustryKey || "GENERIC",
        city: contact.city || "",
        lead_score: contact.lead_score || "",
      });
      setShowAdvancedIndustry(false);
    }
  }, [contact, activeIndustryKey]);

  useEffect(() => {
    setFieldValues(customFieldValues || {});
  }, [customFieldValues, contact]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    show ? dialog.showModal() : dialog.close();
  }, [show]);

  const handleChange = (e) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSave = () => {
    if (!form.name.trim()) return;
    // Spread original contact first so id / _id are preserved
    onSave({
      ...contact,
      ...form,
      industryKey: form.industryKey || activeIndustryKey || "GENERIC",
      customFieldValues: fieldValues,
    });
  };

  const handleClose = () => onClose();

  return (
    <dialog
      ref={dialogRef}
      onClose={handleClose}
      className="rounded-2xl shadow-2xl p-0 w-[440px] max-w-full backdrop:bg-black/40 overflow-hidden"
    >
      {/* Header */}
      <div className="bg-gradient-to-r from-teal-500 to-teal-600 px-6 py-4 flex items-center justify-between">
        <h3 className="text-white font-semibold text-base">Edit Contact</h3>
        <button
          onClick={handleClose}
          className="text-teal-200 hover:text-white text-xl leading-none"
        >
          ×
        </button>
      </div>

      {/* Body */}
      <div className="px-6 py-5 flex max-h-[70vh] flex-col gap-3 overflow-y-auto bg-white">
        {/* Name */}
        <div>
          <label className="text-xs font-medium text-gray-500 mb-1 block">Name *</label>
          <input
            name="name"
            value={form.name}
            onChange={handleChange}
            placeholder="Full name"
            autoFocus
            className="border border-gray-200 rounded-xl p-2.5 w-full text-sm focus:outline-none focus:border-teal-400"
          />
        </div>

        {/* Email + Phone */}
        <div className="flex gap-3">
          <div className="flex-1">
            <label className="text-xs font-medium text-gray-500 mb-1 block">Email</label>
            <input
              name="email"
              value={form.email}
              onChange={handleChange}
              placeholder="Email address"
              className="border border-gray-200 rounded-xl p-2.5 w-full text-sm focus:outline-none focus:border-teal-400"
            />
          </div>
          <div className="flex-1">
            <label className="text-xs font-medium text-gray-500 mb-1 block">Phone</label>
            <input
              name="phone"
              value={form.phone}
              onChange={handleChange}
              placeholder="Phone number"
              className="border border-gray-200 rounded-xl p-2.5 w-full text-sm focus:outline-none focus:border-teal-400"
            />
          </div>
        </div>

        {/* Company + Designation */}
        <div className="flex gap-3">
          <div className="flex-1">
            <label className="text-xs font-medium text-gray-500 mb-1 block">Company</label>
            <input
              name="company"
              value={form.company}
              onChange={handleChange}
              placeholder="Company name"
              className="border border-gray-200 rounded-xl p-2.5 w-full text-sm focus:outline-none focus:border-teal-400"
            />
          </div>
          <div className="flex-1">
            <label className="text-xs font-medium text-gray-500 mb-1 block">Designation</label>
            <input
              name="designation"
              value={form.designation}
              onChange={handleChange}
              placeholder="Job title"
              className="border border-gray-200 rounded-xl p-2.5 w-full text-sm focus:outline-none focus:border-teal-400"
            />
          </div>
        </div>

        <div className="flex gap-3">
          <div className="flex-1">
            <label className="text-xs font-medium text-gray-500 mb-1 block">City</label>
            <input
              name="city"
              value={form.city}
              onChange={handleChange}
              placeholder="City"
              className="border border-gray-200 rounded-xl p-2.5 w-full text-sm focus:outline-none focus:border-teal-400"
            />
          </div>
          <div className="flex-1">
            <label className="text-xs font-medium text-gray-500 mb-1 block">Contact Industry</label>
            <div className="flex min-h-[42px] items-center justify-between gap-2 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2">
              <span className="truncate text-sm font-medium text-gray-700">
                {industryLabel(form.industryKey || activeIndustryKey)}
              </span>
              <button
                type="button"
                onClick={() => setShowAdvancedIndustry((current) => !current)}
                className="shrink-0 text-xs font-semibold text-teal-700 hover:text-teal-800"
              >
                {showAdvancedIndustry ? "Hide" : "Change"}
              </button>
            </div>
          </div>
        </div>
        {showAdvancedIndustry && (
          <div className="rounded-xl border border-amber-100 bg-amber-50 p-3">
            <label className="text-xs font-medium text-amber-800 mb-1 block">Advanced Industry Override</label>
            <select
              name="industryKey"
              value={form.industryKey}
              onChange={handleChange}
              className="border border-amber-200 rounded-xl p-2.5 w-full text-sm focus:outline-none focus:border-teal-400 bg-white"
            >
              {INDUSTRY_OPTIONS.map((option) => (
                <option key={option.value || "blank"} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Lead Score */}
        <div className="flex gap-3">
          <div className="flex-1">
            <label className="text-xs font-medium text-gray-500 mb-1 block">Lead Source</label>
            <select
              name="leadSource"
              value={form.leadSource}
              onChange={handleChange}
              className="border border-gray-200 rounded-xl p-2.5 w-full text-sm focus:outline-none focus:border-teal-400 bg-white"
            >
              {LEAD_SOURCE_OPTIONS.map((option) => (
                <option key={option.value || "blank"} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <div className="flex-1">
            <label className="text-xs font-medium text-gray-500 mb-1 block">Source Detail</label>
            <input
              name="leadSourceDetail"
              value={form.leadSourceDetail}
              onChange={handleChange}
              placeholder="Campaign, portal, referral"
              className="border border-gray-200 rounded-xl p-2.5 w-full text-sm focus:outline-none focus:border-teal-400"
            />
          </div>
        </div>

        {/* Lead Score */}
        <div>
          <label className="text-xs font-medium text-gray-500 mb-1 block">Lead Score (0–100)</label>
          <input
            name="lead_score"
            type="number"
            min={0}
            max={100}
            value={form.lead_score}
            onChange={handleChange}
            placeholder="e.g. 75"
            className="border border-gray-200 rounded-xl p-2.5 w-full text-sm focus:outline-none focus:border-teal-400"
          />
        </div>

        {/* Tags */}
        <div>
          <label className="text-xs font-medium text-gray-500 mb-1 block">Tags</label>
          <input
            name="tags"
            value={form.tags}
            onChange={handleChange}
            placeholder="Lead, Partner, Existing…"
            onKeyDown={(e) => e.key === "Enter" && handleSave()}
            className="border border-gray-200 rounded-xl p-2.5 w-full text-sm focus:outline-none focus:border-teal-400"
          />
          <p className="text-xs text-gray-400 mt-1">Comma-separated values</p>
        </div>

        <CustomFieldInputs
          fields={customFields}
          values={fieldValues}
          onChange={setFieldValues}
        />

      </div>

      {/* Footer */}
      <div className="flex justify-end gap-2 px-6 py-4 bg-gray-50 border-t border-gray-100">
        <button
          onClick={handleClose}
          className="px-4 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-sm cursor-pointer font-medium"
        >
          Cancel
        </button>
        <button
          onClick={handleSave}
          className="px-5 py-2 rounded-xl bg-teal-500 hover:bg-teal-600 text-white text-sm cursor-pointer font-medium"
        >
          Update Contact
        </button>
      </div>
    </dialog>
  );
}

export default EditContact;
