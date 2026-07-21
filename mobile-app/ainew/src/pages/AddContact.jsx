import { useEffect, useRef, useState } from "react";
import api from "../api/axios";
import CustomFieldInputs from "./CustomFieldInputs";
import { LEAD_SOURCE_OPTIONS } from "../config/leadSources";
import { sanitizeLocalPhone, validateContactMethods } from "../utils/contactValidation";

function AddContact({ show, onClose, onSave, customFields = [] }) {
  const dialogRef = useRef(null);
  const [contactForm, setContactForm] = useState({
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
  const [customFieldValues, setCustomFieldValues] = useState({});
  const [duplicateMatches, setDuplicateMatches] = useState([]);
  const [checkingDuplicates, setCheckingDuplicates] = useState(false);
  const [confirmedDuplicate, setConfirmedDuplicate] = useState(false);
  const [formError, setFormError] = useState("");

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    show ? dialog.showModal() : dialog.close();
  }, [show]);

  const handleContactChange = (e) => {
    const { name, value } = e.target;
    setConfirmedDuplicate(false);
    setDuplicateMatches([]);
    setFormError("");
    setContactForm((prev) => {
      if (name === "phone") {
        return { ...prev, phone: sanitizeLocalPhone(value, prev.countryCode) };
      }
      if (name === "countryCode") {
        return { ...prev, countryCode: value, phone: sanitizeLocalPhone(prev.phone, value) };
      }
      return { ...prev, [name]: value };
    });
  };

  const resetContactForm = () =>
    setContactForm({
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

  const handleClose = () => {
    resetContactForm();
    setCustomFieldValues({});
    setDuplicateMatches([]);
    setConfirmedDuplicate(false);
    setFormError("");
    onClose();
  };

  const saveContact = () => {
    if (!contactForm.name.trim()) {
      setFormError("Please enter contact name.");
      return;
    }
    const validation = validateContactMethods(contactForm);
    if (!validation.ok) {
      setFormError(validation.message);
      return;
    }
    onSave({
      ...contactForm,
      email: validation.email,
      phone: validation.phone,
      customFieldValues,
    });
    resetContactForm();
    setCustomFieldValues({});
    setDuplicateMatches([]);
    setConfirmedDuplicate(false);
    setFormError("");
  };

  const handleContactSave = async () => {
    if (checkingDuplicates) return;
    if (!contactForm.name.trim()) {
      setFormError("Please enter contact name.");
      return;
    }
    const validation = validateContactMethods(contactForm);
    if (!validation.ok) {
      setFormError(validation.message);
      return;
    }

    if (!confirmedDuplicate) {
      const phone = validation.phone;
      const email = validation.email;
      if (phone || email) {
        setCheckingDuplicates(true);
        try {
          const response = await api.get("/api/contacts/duplicates", {
            params: { phone, email },
          });
          const matches = Array.isArray(response.data?.matches) ? response.data.matches : [];
          if (matches.length > 0) {
            setDuplicateMatches(matches);
            setCheckingDuplicates(false);
            return;
          }
        } catch (error) {
          console.error("Duplicate check failed:", error);
        }
        setCheckingDuplicates(false);
      }
    }

    saveContact();
  };

  return (
    <dialog
      ref={dialogRef}
      onClose={handleClose}
      className="rounded-2xl shadow-2xl p-0 w-[460px] max-w-full backdrop:bg-black/40 overflow-hidden"
    >
      <div className="bg-gradient-to-r from-teal-500 to-teal-600 px-6 py-4 flex items-center justify-between">
        <h3 className="text-white font-semibold text-base">Add Contact</h3>
        <button onClick={handleClose} className="text-teal-200 hover:text-white text-xl leading-none">×</button>
      </div>

      <div className="px-6 py-5 flex max-h-[70vh] flex-col gap-3 overflow-y-auto bg-white">
        <div>
          <label className="text-xs font-medium text-gray-500 mb-1 block">Name *</label>
          <input
            name="name"
            value={contactForm.name}
            onChange={handleContactChange}
            placeholder="Full name"
            autoFocus
            className="border border-gray-200 rounded-xl p-2.5 w-full text-sm focus:outline-none focus:border-teal-400"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-gray-500 mb-1 block">Email</label>
          <input
            name="email"
            value={contactForm.email}
            onChange={handleContactChange}
            placeholder="Email address"
            className="border border-gray-200 rounded-xl p-2.5 w-full text-sm focus:outline-none focus:border-teal-400"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-gray-500 mb-1 block">Phone</label>
          <div className="flex gap-2">
            <select
              name="countryCode"
              value={contactForm.countryCode}
              onChange={handleContactChange}
              className="border border-gray-200 rounded-xl p-2.5 text-sm focus:outline-none focus:border-teal-400 bg-white"
            >
              <option value="91">🇮🇳 +91</option>
              <option value="1">🇨🇦/🇺🇸 +1</option>
              <option value="44">🇬🇧 +44</option>
              <option value="61">🇦🇺 +61</option>
              <option value="971">🇦🇪 +971</option>
              <option value="65">🇸🇬 +65</option>
            </select>
            <input
              name="phone"
              value={contactForm.phone}
              onChange={handleContactChange}
              inputMode="numeric"
              maxLength={10}
              placeholder="10 digit number"
              className="border border-gray-200 rounded-xl p-2.5 w-full text-sm focus:outline-none focus:border-teal-400"
            />
          </div>
        </div>
        <div className="flex gap-3">
          <div className="flex-1">
            <label className="text-xs font-medium text-gray-500 mb-1 block">Company</label>
            <input
              name="company"
              value={contactForm.company}
              onChange={handleContactChange}
              placeholder="Company name"
              className="border border-gray-200 rounded-xl p-2.5 w-full text-sm focus:outline-none focus:border-teal-400"
            />
          </div>
          <div className="flex-1">
            <label className="text-xs font-medium text-gray-500 mb-1 block">Designation</label>
            <input
              name="designation"
              value={contactForm.designation}
              onChange={handleContactChange}
              placeholder="Job title"
              className="border border-gray-200 rounded-xl p-2.5 w-full text-sm focus:outline-none focus:border-teal-400"
            />
          </div>
        </div>
        <div>
          <label className="text-xs font-medium text-gray-500 mb-1 block">Lead Score (0–100)</label>
          <input
            name="lead_score"
            type="number"
            min={0}
            max={100}
            value={contactForm.lead_score}
            onChange={handleContactChange}
            placeholder="e.g. 75"
            className="border border-gray-200 rounded-xl p-2.5 w-full text-sm focus:outline-none focus:border-teal-400"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-gray-500 mb-1 block">Lead Source</label>
          <select
            name="leadSource"
            value={contactForm.leadSource}
            onChange={handleContactChange}
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
        <div>
          <label className="text-xs font-medium text-gray-500 mb-1 block">Source Detail</label>
          <input
            name="leadSourceDetail"
            value={contactForm.leadSourceDetail}
            onChange={handleContactChange}
            placeholder="Campaign name, portal, referral person"
            className="border border-gray-200 rounded-xl p-2.5 w-full text-sm focus:outline-none focus:border-teal-400"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-gray-500 mb-1 block">City</label>
          <input
            name="city"
            value={contactForm.city}
            onChange={handleContactChange}
            placeholder="City"
            className="border border-gray-200 rounded-xl p-2.5 w-full text-sm focus:outline-none focus:border-teal-400"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-gray-500 mb-1 block">Tags</label>
          <input
            name="tags"
            value={contactForm.tags}
            onChange={handleContactChange}
            placeholder="Lead, Partner, Existing…"
            className="border border-gray-200 rounded-xl p-2.5 w-full text-sm focus:outline-none focus:border-teal-400"
          />
          <p className="text-xs text-gray-400 mt-1">Comma-separated values</p>
        </div>

        <CustomFieldInputs
          fields={customFields}
          values={customFieldValues}
          onChange={setCustomFieldValues}
        />

        {formError && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
            {formError}
          </div>
        )}

        {duplicateMatches.length > 0 && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
            <p className="text-sm font-semibold text-amber-800">Possible duplicate found</p>
            <div className="mt-2 space-y-2">
              {duplicateMatches.map((contact) => (
                <div key={contact.id} className="rounded-lg bg-white px-3 py-2 text-xs text-gray-600">
                  <div className="font-semibold text-gray-800">{contact.name || "Unnamed contact"}</div>
                  <div>{contact.phone || "No phone"}{contact.email ? ` · ${contact.email}` : ""}</div>
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={() => {
                setConfirmedDuplicate(true);
                saveContact();
              }}
              className="mt-3 rounded-lg bg-amber-500 px-3 py-2 text-xs font-semibold text-white hover:bg-amber-600"
            >
              Create anyway
            </button>
          </div>
        )}
      </div>

      <div className="flex justify-end gap-2 px-6 py-4 bg-gray-50 border-t border-gray-100">
        <button
          onClick={handleClose}
          className="px-4 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-sm cursor-pointer font-medium"
        >
          Cancel
        </button>
        <button
          onClick={handleContactSave}
          disabled={checkingDuplicates}
          className="px-5 py-2 rounded-xl bg-teal-500 hover:bg-teal-600 text-white text-sm cursor-pointer font-medium"
        >
          {checkingDuplicates ? "Checking..." : "Save Contact"}
        </button>
      </div>
    </dialog>
  );
}

export default AddContact;
