import { useEffect, useRef, useState } from "react";
import CustomFieldInputs from "./CustomFieldInputs";
import { LEAD_SOURCE_OPTIONS } from "../config/leadSources";

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
  });
  const [fieldValues, setFieldValues] = useState({});

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
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSave = () => {
    if (!form.name.trim()) return;
    // Spread original contact first so id / _id are preserved
    onSave({
      ...contact,
      ...form,
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
