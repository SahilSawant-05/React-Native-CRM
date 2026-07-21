import { useEffect, useRef, useState } from "react";
import CustomFieldInputs from "./CustomFieldInputs";
import { LEAD_SOURCE_OPTIONS } from "../config/leadSources";
import { isInternalPhonePlaceholder, sanitizeLocalPhone, validateContactMethods } from "../utils/contactValidation";

const COUNTRY_OPTIONS = [
  { value: "91", label: "🇮🇳 +91" },
  { value: "1", label: "🇨🇦/🇺🇸 +1" },
  { value: "44", label: "🇬🇧 +44" },
  { value: "61", label: "🇦🇺 +61" },
  { value: "971", label: "🇦🇪 +971" },
  { value: "65", label: "🇸🇬 +65" },
];

function splitStoredPhone(value) {
  if (isInternalPhonePlaceholder(value)) return { countryCode: "91", phone: "" };
  const digits = String(value || "").replace(/\D/g, "");
  const code = COUNTRY_OPTIONS.find((option) => digits.startsWith(option.value) && digits.length > option.value.length + 6)?.value || "91";
  const localPhone = digits.startsWith(code) ? digits.slice(code.length) : digits;
  return { countryCode: code, phone: sanitizeLocalPhone(localPhone, code) };
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
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    company: "",
    designation: "",
    tags: "",
    leadSource: "",
    leadSourceDetail: "",
    city: "",
    lead_score: "",
    countryCode: "91",
  });
  const [fieldValues, setFieldValues] = useState({});
  const [formError, setFormError] = useState("");

  // Pre-fill form whenever the contact changes
  useEffect(() => {
    if (contact) {
      const phoneParts = splitStoredPhone(contact.phone);
      setForm({
        name:        contact.name        || "",
        email:       contact.email       || "",
        phone:       phoneParts.phone,
        countryCode: phoneParts.countryCode,
        company:     contact.company     || "",
        designation: contact.designation || "",
        tags: Array.isArray(contact.tags)
          ? contact.tags.join(", ")
          : contact.tags || "",
        leadSource: contact.leadSource || "",
        leadSourceDetail: contact.leadSourceDetail || "",
        city: contact.city || "",
        lead_score: contact.lead_score || "",
      });
    }
  }, [contact]);

  useEffect(() => {
    setFieldValues(customFieldValues || {});
  }, [customFieldValues, contact]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    show ? dialog.showModal() : dialog.close();
  }, [show]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormError("");
    setForm((prev) => {
      if (name === "phone") {
        return { ...prev, phone: sanitizeLocalPhone(value, prev.countryCode) };
      }
      if (name === "countryCode") {
        return { ...prev, countryCode: value, phone: sanitizeLocalPhone(prev.phone, value) };
      }
      return { ...prev, [name]: value };
    });
  };

  const handleSave = () => {
    if (!form.name.trim()) {
      setFormError("Please enter contact name.");
      return;
    }
    const validation = validateContactMethods(form);
    if (!validation.ok) {
      setFormError(validation.message);
      return;
    }
    // Spread original contact first so id / _id are preserved
    onSave({
      ...contact,
      ...form,
      email: validation.email,
      phone: validation.phone || contact.phone,
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
        <div className="grid gap-3 sm:grid-cols-2">
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
            <div className="flex gap-2">
              <select
                name="countryCode"
                value={form.countryCode}
                onChange={handleChange}
                className="w-28 rounded-xl border border-gray-200 bg-white p-2.5 text-sm focus:border-teal-400 focus:outline-none"
              >
                {COUNTRY_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
              <input
                name="phone"
                value={form.phone}
                onChange={handleChange}
                inputMode="numeric"
                maxLength={10}
                placeholder="10 digit number"
                className="min-w-0 flex-1 rounded-xl border border-gray-200 p-2.5 text-sm focus:border-teal-400 focus:outline-none"
              />
            </div>
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

        <div>
          <label className="text-xs font-medium text-gray-500 mb-1 block">City</label>
          <input
            name="city"
            value={form.city}
            onChange={handleChange}
            placeholder="City"
            className="border border-gray-200 rounded-xl p-2.5 w-full text-sm focus:outline-none focus:border-teal-400"
          />
        </div>

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
              <option value="">Select source</option>
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

        {formError && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
            {formError}
          </div>
        )}

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
