import { useEffect, useRef, useState } from "react";
import api from "../api/axios";
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

function AddContact({ show, onClose, onSave, customFields = [] }) {
  const dialogRef = useRef(null);
  const { activeIndustryKey } = useCrmSettings();
  const [contactForm, setContactForm] = useState({
    name: "",
    email: "",
    phone: "",
    company: "",
    designation: "",
    tags: "",
    leadSource: "",
    leadSourceDetail: "",
    industryKey: activeIndustryKey || "GENERIC",
    city: "",
    lead_score: "",
    countryCode: "91",
  });
  const [customFieldValues, setCustomFieldValues] = useState({});
  const [duplicateMatches, setDuplicateMatches] = useState([]);
  const [checkingDuplicates, setCheckingDuplicates] = useState(false);
  const [confirmedDuplicate, setConfirmedDuplicate] = useState(false);
  const [showAdvancedIndustry, setShowAdvancedIndustry] = useState(false);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    show ? dialog.showModal() : dialog.close();
  }, [show]);

  useEffect(() => {
    if (!activeIndustryKey) return;
    setContactForm((current) => (
      showAdvancedIndustry ? current : { ...current, industryKey: activeIndustryKey }
    ));
  }, [activeIndustryKey, showAdvancedIndustry]);

  const handleContactChange = (e) => {
    setConfirmedDuplicate(false);
    setDuplicateMatches([]);
    setContactForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
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
      industryKey: activeIndustryKey || "GENERIC",
      city: "",
      lead_score: "",
      countryCode: "91",
    });

  const handleClose = () => {
    resetContactForm();
    setCustomFieldValues({});
    setDuplicateMatches([]);
    setConfirmedDuplicate(false);
    setShowAdvancedIndustry(false);
    onClose();
  };

  const saveContact = () => {
    if (!contactForm.name.trim()) return;
    onSave({
      ...contactForm,
      industryKey: contactForm.industryKey || activeIndustryKey || "GENERIC",
      phone: contactForm.phone ? `${contactForm.countryCode}${contactForm.phone}` : "",
      customFieldValues,
    });
    resetContactForm();
    setCustomFieldValues({});
    setDuplicateMatches([]);
    setConfirmedDuplicate(false);
    setShowAdvancedIndustry(false);
  };

  const handleContactSave = async () => {
    if (!contactForm.name.trim() || checkingDuplicates) return;

    if (!confirmedDuplicate) {
      const phone = contactForm.phone ? `${contactForm.countryCode}${contactForm.phone}` : "";
      const email = contactForm.email.trim();
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
              <option value="1">🇺🇸 +1</option>
              <option value="44">🇬🇧 +44</option>
              <option value="61">🇦🇺 +61</option>
              <option value="971">🇦🇪 +971</option>
              <option value="65">🇸🇬 +65</option>
            </select>
            <input
              name="phone"
              value={contactForm.phone}
              onChange={handleContactChange}
              placeholder="Phone number"
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
        <div className="flex gap-3">
          <div className="flex-1">
            <label className="text-xs font-medium text-gray-500 mb-1 block">City</label>
            <input
              name="city"
              value={contactForm.city}
              onChange={handleContactChange}
              placeholder="City"
              className="border border-gray-200 rounded-xl p-2.5 w-full text-sm focus:outline-none focus:border-teal-400"
            />
          </div>
          <div className="flex-1">
            <label className="text-xs font-medium text-gray-500 mb-1 block">Workspace Industry</label>
            <div className="flex min-h-[42px] items-center justify-between gap-2 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2">
              <span className="truncate text-sm font-medium text-gray-700">
                {industryLabel(contactForm.industryKey || activeIndustryKey)}
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
              value={contactForm.industryKey}
              onChange={handleContactChange}
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
