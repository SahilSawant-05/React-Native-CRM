import { useEffect, useMemo, useState } from "react";
import api from "../api/axios";
import MediaLibraryDialog from "../components/media/MediaLibraryDialog";

const BLANK_BUTTON = {
  type: "QUICK_REPLY",
  text: "",
  url: "",
  phoneNumber: "",
  example: "",
};

const BLANK_FORM = {
  name: "",
  languageCode: "en",
  category: "MARKETING",
  allowCategoryChange: false,
  headerEnabled: false,
  headerFormat: "TEXT",
  headerText: "",
  headerExample: "",
  headerMediaExample: "",
  body: "",
  bodyExampleOne: "",
  bodyExampleTwo: "",
  footer: "",
  buttonsEnabled: false,
  buttons: [],
};

function parseComponentsJson(value) {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function normalizeTemplate(template) {
  return {
    ...template,
    parsedComponents: parseComponentsJson(template.componentsJson),
  };
}

function buildRequestPayload(form) {
  const payload = {
    name: form.name.trim(),
    languageCode: form.languageCode.trim(),
    category: form.category,
    allowCategoryChange: form.allowCategoryChange,
    components: [],
  };

  if (form.headerEnabled) {
    const header = {
      type: "HEADER",
      format: form.headerFormat,
    };

    if (form.headerFormat === "TEXT") {
      header.text = form.headerText.trim();
      if (form.headerExample.trim()) {
        header.headerTextExamples = [form.headerExample.trim()];
      }
    } else if (form.headerMediaExample.trim()) {
      header.headerMediaExamples = [form.headerMediaExample.trim()];
    }

    payload.components.push(header);
  }

  const body = {
    type: "BODY",
    text: form.body.trim(),
  };

  const bodyExamples = [form.bodyExampleOne.trim(), form.bodyExampleTwo.trim()].filter(Boolean);
  if (bodyExamples.length > 0) {
    body.bodyTextExamples = [bodyExamples];
  }

  payload.components.push(body);

  if (form.footer.trim()) {
    payload.components.push({
      type: "FOOTER",
      text: form.footer.trim(),
    });
  }

  if (form.buttonsEnabled && form.buttons.length > 0) {
    payload.components.push({
      type: "BUTTONS",
      buttons: form.buttons.map((button) => {
        const normalized = {
          type: button.type,
          text: button.text.trim(),
        };

        if (button.type === "URL") {
          normalized.url = button.url.trim();
          const examples = button.example
            .split(",")
            .map((item) => item.trim())
            .filter(Boolean);
          if (examples.length > 0) {
            normalized.example = examples;
          }
        }

        if (button.type === "PHONE_NUMBER") {
          normalized.phoneNumber = button.phoneNumber.trim();
        }

        return normalized;
      }),
    });
  }

  return payload;
}

function componentSummary(components) {
  if (!components.length) return "No component data stored";
  return components.map((component) => {
    if (component.type === "HEADER") {
      return component.format === "TEXT"
        ? `HEADER: ${component.text || "Text header"}`
        : `HEADER: ${component.format}`;
    }
    if (component.type === "BODY") {
      return `BODY: ${component.text || ""}`;
    }
    if (component.type === "FOOTER") {
      return `FOOTER: ${component.text || ""}`;
    }
    if (component.type === "BUTTONS") {
      return `BUTTONS: ${(component.buttons || []).map((button) => `${button.type} - ${button.text}`).join(", ")}`;
    }
    return component.type;
  }).join(" | ");
}

function accountLabel(account) {
  if (!account) return "Unknown WABA";
  if (account.wabaId) return `WABA ${account.wabaId}`;
  if (account.accountId) return `Account #${account.accountId}`;
  return "Unknown WABA";
}

function errorMessageFromResponse(err) {
  const data = err?.response?.data;
  if (typeof data === "string") return data;
  const metaDetails = data?.error_data?.details || data?.error?.error_data?.details;
  const metaMessage = data?.error?.message;
  if (data?.message) return data.message;
  if (data?.error) return data.error;
  if (metaDetails) return metaDetails;
  if (metaMessage) return metaMessage;
  return err.message || "WhatsApp template request failed";
}

function exampleValues(form) {
  return [form.bodyExampleOne, form.bodyExampleTwo].map((value) => value.trim()).filter(Boolean);
}

function renderPreviewText(text, values) {
  return String(text || "").replace(/\{\{\s*(\d+)\s*}}/g, (_, index) => {
    const value = values[Number(index) - 1];
    return value || `{{${index}}}`;
  });
}

function findComponent(components, type) {
  return components.find((component) => String(component?.type || "").toUpperCase() === type);
}

function storedBodyExamples(bodyComponent) {
  const raw = bodyComponent?.example?.body_text || bodyComponent?.bodyTextExamples;
  const values = Array.isArray(raw?.[0]) ? raw[0] : raw;
  return Array.isArray(values) ? values.map((value) => String(value ?? "")) : [];
}

function storedHeaderExamples(headerComponent) {
  const raw = headerComponent?.example?.header_text || headerComponent?.headerTextExamples;
  const values = Array.isArray(raw?.[0]) ? raw[0] : raw;
  return Array.isArray(values) ? values.map((value) => String(value ?? "")) : [];
}

function storedHeaderMediaExample(headerComponent) {
  const raw =
    headerComponent?.example?.header_handle ||
    headerComponent?.headerMediaExamples ||
    headerComponent?.example?.header_url;
  const values = Array.isArray(raw) ? raw : [];
  return values[0] || "";
}

function StoredTemplatePreview({ template }) {
  const components = template.parsedComponents || [];
  const header = findComponent(components, "HEADER");
  const body = findComponent(components, "BODY");
  const footer = findComponent(components, "FOOTER");
  const buttonsComponent = findComponent(components, "BUTTONS");
  const buttons = Array.isArray(buttonsComponent?.buttons) ? buttonsComponent.buttons : [];
  const headerFormat = String(header?.format || template.headerType || "").toUpperCase();
  const bodyText = body?.text || template.body || "";
  const bodyExamples = storedBodyExamples(body);
  const headerExamples = storedHeaderExamples(header);
  const headerText = headerFormat === "TEXT"
    ? renderPreviewText(header?.text || template.headerText || "", headerExamples.length ? headerExamples : bodyExamples)
    : "";
  const mediaExample = storedHeaderMediaExample(header);
  const footerText = footer?.text || template.footer || "";
  const renderedBody = renderPreviewText(bodyText || "No body text stored", bodyExamples);

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(320px,420px)]">
      <section className="rounded-2xl border border-gray-200 bg-slate-950 p-4">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3 text-white">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-teal-200">Customer Preview</p>
            <p className="mt-1 text-sm text-slate-300">WhatsApp template message</p>
          </div>
          <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-semibold">
            {template.status || "Stored"}
          </span>
        </div>

        <div className="rounded-[1.75rem] bg-[#e5ddd5] p-3 sm:p-4">
          <div className="mb-3 flex items-center gap-2 rounded-t-[1.35rem] bg-[#075e54] px-4 py-3 text-white">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white/20 text-xs font-black">
              VF
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">Business</p>
              <p className="text-[11px] text-white/75">WhatsApp Business</p>
            </div>
          </div>

          <div className="ml-auto max-w-[94%] rounded-xl rounded-tr-sm bg-white p-3 shadow">
            {headerFormat && (
              <div className="mb-3 overflow-hidden rounded-lg border border-gray-100 bg-gray-50">
                {headerFormat === "TEXT" ? (
                  <div className="px-3 py-2 text-sm font-bold leading-5 text-gray-900">
                    {headerText || "Header text"}
                  </div>
                ) : mediaExample && /^https?:\/\//i.test(mediaExample) && headerFormat === "IMAGE" ? (
                  <img src={mediaExample} alt="Template header" className="max-h-56 w-full object-cover" />
                ) : (
                  <div className="flex aspect-[1.9/1] flex-col items-center justify-center gap-2 bg-gray-100 px-3 text-center text-xs font-semibold uppercase tracking-wide text-gray-500">
                    <span>{headerFormat} header</span>
                    {mediaExample && <span className="max-w-full truncate normal-case tracking-normal text-gray-400">Sample/handle stored</span>}
                  </div>
                )}
              </div>
            )}

            <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-gray-900">{renderedBody}</p>

            {footerText && (
              <p className="mt-3 whitespace-pre-wrap break-words text-xs leading-5 text-gray-400">{footerText}</p>
            )}

            {buttons.length > 0 && (
              <div className="mt-3 divide-y divide-gray-100 border-t border-gray-100">
                {buttons.map((button, index) => (
                  <div key={`${button.type || "button"}-${index}`} className="flex items-center justify-center gap-2 py-2 text-center text-sm font-semibold text-sky-600">
                    <span className="text-[10px] uppercase tracking-wide">
                      {button.type === "URL" ? "Link" : button.type === "PHONE_NUMBER" ? "Call" : "Reply"}
                    </span>
                    <span className="min-w-0 truncate">{button.text || button.url || button.phone_number || "Button"}</span>
                  </div>
                ))}
              </div>
            )}

            <p className="mt-2 text-right text-[10px] text-gray-400">Template preview</p>
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Template Details</p>
          <dl className="mt-3 grid gap-3 text-sm">
            <div>
              <dt className="text-xs font-bold uppercase tracking-wide text-gray-400">Name</dt>
              <dd className="mt-1 break-words font-semibold text-gray-900">{template.metaTemplateName || "—"}</dd>
            </div>
            <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
              <div>
                <dt className="text-xs font-bold uppercase tracking-wide text-gray-400">Category</dt>
                <dd className="mt-1 font-semibold text-gray-900">{template.category || "—"}</dd>
              </div>
              <div>
                <dt className="text-xs font-bold uppercase tracking-wide text-gray-400">Language</dt>
                <dd className="mt-1 font-semibold text-gray-900">{template.languageCode || "—"}</dd>
              </div>
              <div>
                <dt className="text-xs font-bold uppercase tracking-wide text-gray-400">Status</dt>
                <dd className="mt-1 font-semibold text-gray-900">{template.status || "—"}</dd>
              </div>
            </div>
          </dl>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">What will send</p>
          <div className="mt-3 space-y-3 text-sm">
            <div>
              <p className="font-bold text-gray-900">Header</p>
              <p className="mt-1 whitespace-pre-wrap break-words text-gray-600">
                {header ? (headerFormat === "TEXT" ? headerText || "Text header" : `${headerFormat || "Media"} header`) : "No header"}
              </p>
            </div>
            <div>
              <p className="font-bold text-gray-900">Body</p>
              <p className="mt-1 whitespace-pre-wrap break-words text-gray-600">{renderedBody}</p>
            </div>
            <div>
              <p className="font-bold text-gray-900">Footer</p>
              <p className="mt-1 whitespace-pre-wrap break-words text-gray-600">{footerText || "No footer"}</p>
            </div>
            <div>
              <p className="font-bold text-gray-900">Buttons</p>
              {buttons.length ? (
                <div className="mt-2 flex flex-wrap gap-2">
                  {buttons.map((button, index) => (
                    <span key={`${button.type || "button"}-${index}`} className="rounded-full bg-sky-50 px-3 py-1 text-xs font-bold text-sky-700">
                      {button.text || button.type}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="mt-1 text-gray-600">No buttons</p>
              )}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

function TemplateLivePreview({ form }) {
  const examples = exampleValues(form);
  const body = renderPreviewText(form.body || "Write your template body...", examples);
  const buttons = form.buttonsEnabled ? form.buttons.filter((button) => button.text.trim()) : [];

  return (
    <aside className="xl:sticky xl:top-6">
      <div className="rounded-2xl border border-gray-200 bg-slate-950 p-4 shadow-sm">
        <div className="mb-4 flex items-center justify-between text-white">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-teal-200">Live Preview</p>
            <p className="text-sm text-slate-300">WhatsApp message</p>
          </div>
          <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-semibold">{form.category}</span>
        </div>

        <div className="rounded-[2rem] bg-[#e5ddd5] p-4">
          <div className="mb-3 flex items-center gap-2 rounded-t-[1.5rem] bg-[#075e54] px-4 py-3 text-white">
            <div className="h-8 w-8 rounded-full bg-white/20" />
            <div>
              <p className="text-sm font-semibold">Business</p>
              <p className="text-[11px] text-white/75">online</p>
            </div>
          </div>

          <div className="ml-auto max-w-[92%] rounded-xl rounded-tr-sm bg-white p-3 shadow">
            {form.headerEnabled && (
              <div className="mb-3 overflow-hidden rounded-lg border border-gray-100 bg-gray-50">
                {form.headerFormat === "TEXT" ? (
                  <div className="px-3 py-2 text-sm font-bold text-gray-900">
                    {form.headerText || "Header text"}
                  </div>
                ) : (
                  <div className="flex aspect-[1.9/1] items-center justify-center bg-gray-100 text-center text-xs font-semibold uppercase tracking-wide text-gray-500">
                    {form.headerFormat} header media
                  </div>
                )}
              </div>
            )}

            <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-gray-900">{body}</p>

            {form.footer.trim() && (
              <p className="mt-3 text-xs text-gray-400">{form.footer}</p>
            )}

            {buttons.length > 0 && (
              <div className="mt-3 divide-y divide-gray-100 border-t border-gray-100">
                {buttons.map((button, index) => (
                  <div key={`${button.type}-${index}`} className="flex items-center justify-center gap-2 py-2 text-sm font-semibold text-sky-600">
                    <span className="text-[10px] uppercase tracking-wide">{button.type === "URL" ? "Link" : button.type === "PHONE_NUMBER" ? "Call" : "Reply"}</span>
                    <span>{button.text}</span>
                  </div>
                ))}
              </div>
            )}

            <p className="mt-2 text-right text-[10px] text-gray-400">now</p>
          </div>
        </div>

        <div className="mt-4 rounded-xl border border-white/10 bg-white/5 p-3 text-xs text-slate-300">
          <p><span className="font-semibold text-white">Name:</span> {form.name || "template_name"}</p>
          <p className="mt-1"><span className="font-semibold text-white">Language:</span> {form.languageCode || "en"}</p>
        </div>
      </div>
    </aside>
  );
}

export default function Templates() {
  const [templates, setTemplates] = useState([]);
  const [form, setForm] = useState(BLANK_FORM);
  const [viewingTemplate, setViewingTemplate] = useState(null);
  const [syncDiagnostics, setSyncDiagnostics] = useState(null);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [uploadingHeaderHandle, setUploadingHeaderHandle] = useState(false);
  const [headerMediaDialogOpen, setHeaderMediaDialogOpen] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const loadTemplates = async () => {
    const response = await api.get("/api/templates");
    setTemplates((response.data || []).map(normalizeTemplate));
  };

  useEffect(() => {
    loadTemplates().catch((err) => {
      setError(errorMessageFromResponse(err));
    });
  }, []);

  const visibleButtons = useMemo(
    () => (form.buttonsEnabled ? form.buttons : []),
    [form.buttonsEnabled, form.buttons]
  );

  const setField = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const addButton = () => {
    setForm((current) => ({
      ...current,
      buttonsEnabled: true,
      buttons: [...current.buttons, { ...BLANK_BUTTON }],
    }));
  };

  const updateButton = (index, field, value) => {
    setForm((current) => ({
      ...current,
      buttons: current.buttons.map((button, buttonIndex) =>
        buttonIndex === index ? { ...button, [field]: value } : button
      ),
    }));
  };

  const removeButton = (index) => {
    setForm((current) => {
      const buttons = current.buttons.filter((_, buttonIndex) => buttonIndex !== index);
      return {
        ...current,
        buttons,
        buttonsEnabled: buttons.length > 0,
      };
    });
  };

  const resetForm = () => {
    setForm(BLANK_FORM);
    setError("");
    setSuccess("");
    setSyncDiagnostics(null);
  };

  const applyHeaderMediaAsset = async (asset) => {
    const nextHeaderFormat =
      asset.mediaType === "VIDEO"
        ? "VIDEO"
        : asset.mediaType === "DOCUMENT"
          ? "DOCUMENT"
          : "IMAGE";

    setForm((current) => ({
      ...current,
      headerEnabled: true,
      headerFormat: nextHeaderFormat,
      headerMediaExample: "",
    }));

    if (!asset.id) {
      setError("Media asset id is missing. Upload or choose the media again.");
      return;
    }

    setUploadingHeaderHandle(true);
    setError("");
    setSuccess("");
    try {
      const response = await api.post(`/api/media-assets/${asset.id}/meta-template-handle`);
      const handle = response?.data?.handle;
      if (!handle) {
        throw new Error("Meta did not return a media handle");
      }
      setForm((current) => ({
        ...current,
        headerMediaExample: handle,
      }));
      setSuccess(`Meta media handle generated for ${asset.name || asset.originalFileName}`);
    } catch (err) {
      setForm((current) => ({
        ...current,
        headerMediaExample: asset.publicUrl || "",
      }));
      setError(errorMessageFromResponse(err) || "Failed to generate Meta media handle. You can paste the handle manually.");
    } finally {
      setUploadingHeaderHandle(false);
    }
  };

  const saveTemplate = async () => {
    setError("");
    setSuccess("");

    if (!form.name.trim()) {
      setError("Template name is required");
      return;
    }
    if (!form.body.trim()) {
      setError("Template body is required");
      return;
    }
    if (form.headerEnabled && form.headerFormat === "TEXT" && !form.headerText.trim()) {
      setError("Header text is required for text headers");
      return;
    }
    if (form.headerEnabled && form.headerFormat !== "TEXT" && !form.headerMediaExample.trim()) {
      setError("Header media example is required for media headers");
      return;
    }
    if (form.buttonsEnabled) {
      const invalidButton = form.buttons.find((button) => {
        if (!button.text.trim()) return true;
        if (button.type === "URL" && !button.url.trim()) return true;
        if (button.type === "PHONE_NUMBER" && !button.phoneNumber.trim()) return true;
        return false;
      });
      if (invalidButton) {
        setError("Every button must have the required fields filled");
        return;
      }
    }

    setSaving(true);
    try {
      const payload = buildRequestPayload(form);
      const response = await api.post("/api/templates", payload);
      setTemplates((current) => [normalizeTemplate(response.data), ...current]);
      setSuccess("Template created in Meta and stored locally");
      setForm(BLANK_FORM);
    } catch (err) {
      setError(errorMessageFromResponse(err));
    } finally {
      setSaving(false);
    }
  };

  const syncTemplates = async () => {
    setError("");
    setSuccess("");
    setSyncDiagnostics(null);
    setSyncing(true);
    try {
      const response = await api.post("/api/templates/sync");
      await loadTemplates();
      const synced = response?.data?.synced;
      setSyncDiagnostics(response.data || null);
      setSuccess(synced == null ? "Templates synced from WhatsApp" : `${synced} templates synced from WhatsApp`);
    } catch (err) {
      setSyncDiagnostics(err?.response?.data || null);
      setError(errorMessageFromResponse(err));
    } finally {
      setSyncing(false);
    }
  };

  const deleteTemplate = async (template) => {
    if (!template?.id) return;
    const label = template.metaTemplateName || "this template";
    if (!window.confirm(`Delete ${label} from CRM stored templates? This will not delete it from Meta.`)) {
      return;
    }

    setError("");
    setSuccess("");
    setDeletingId(template.id);
    try {
      await api.delete(`/api/templates/${template.id}`);
      setTemplates((current) => current.filter((item) => item.id !== template.id));
      if (viewingTemplate?.id === template.id) {
        setViewingTemplate(null);
      }
      setSuccess("Template deleted from CRM");
    } catch (err) {
      setError(errorMessageFromResponse(err));
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="min-h-screen min-w-0 max-w-full overflow-x-hidden bg-gray-50 p-3 sm:p-6 lg:p-8">
      <div className="mb-6 flex flex-col items-start justify-between gap-4 sm:flex-row">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 sm:text-3xl">WhatsApp Templates</h2>
          <p className="mt-1 text-sm text-gray-500">
            Create Meta-style marketing and utility templates from your CRM backend.
          </p>
        </div>
        <button
          onClick={syncTemplates}
          disabled={syncing}
          className="rounded-lg bg-teal-700 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {syncing ? "Syncing..." : "Sync from WhatsApp"}
        </button>
      </div>

      {(error || success) && (
        <div className={`mb-6 rounded-xl border px-4 py-3 text-sm ${
          error
            ? "border-red-200 bg-red-50 text-red-700"
            : "border-emerald-200 bg-emerald-50 text-emerald-700"
        }`}>
          {error || success}
        </div>
      )}

      {syncDiagnostics?.accounts?.length > 0 && (
        <div className="mb-6 rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
          <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="text-lg font-bold text-gray-900">Meta Sync Diagnostics</h3>
              <p className="text-sm text-gray-500">{syncDiagnostics.message}</p>
            </div>
            <span className={`w-fit rounded-full px-3 py-1 text-xs font-bold ${
              syncDiagnostics.success ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"
            }`}>
              {syncDiagnostics.synced || 0} synced
            </span>
          </div>
          <div className="grid gap-3 lg:grid-cols-2">
            {syncDiagnostics.accounts.map((account, index) => (
              <article
                key={`${account.wabaId || account.accountId || index}-${index}`}
                className={`rounded-lg border p-4 ${
                  account.success
                    ? "border-emerald-200 bg-emerald-50"
                    : "border-red-200 bg-red-50"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h4 className="font-bold text-gray-950">{accountLabel(account)}</h4>
                    <p className="mt-1 text-xs text-gray-600">
                      {account.displayPhone || "No display phone"} · {account.status || "Unknown status"}
                    </p>
                  </div>
                  <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${
                    account.success ? "bg-white text-emerald-700" : "bg-white text-red-700"
                  }`}>
                    {account.success ? `${account.synced} synced` : "Failed"}
                  </span>
                </div>
                <div className="mt-3 grid gap-2 text-xs text-gray-600 sm:grid-cols-2">
                  <div>Business: <span className="font-semibold">{account.businessId || "—"}</span></div>
                  <div>Phone ID: <span className="font-semibold">{account.phoneNumberId || "—"}</span></div>
                </div>
                {account.error && (
                  <div className="mt-3 rounded-lg bg-white/80 p-3 text-sm text-red-700">
                    {account.error}
                  </div>
                )}
              </article>
            ))}
          </div>
        </div>
      )}

      <div className="mb-6 rounded-xl border border-gray-100 bg-white p-4 shadow-sm sm:p-6">
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-lg font-bold text-gray-900">Create Template</h3>
            <p className="text-sm text-gray-500">
              This screen sends the same structured payload your backend now expects.
            </p>
          </div>
          <button
            onClick={resetForm}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
          >
            Reset
          </button>
        </div>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
          <div className="grid gap-6 lg:grid-cols-2">
          <div className="space-y-4 rounded-2xl border border-gray-100 bg-gray-50/70 p-4">
            <div>
              <p className="text-sm font-bold text-gray-900">Template setup</p>
              <p className="text-xs text-gray-500">Name, language, category, and optional header.</p>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Template name</label>
              <input
                value={form.name}
                onChange={(e) => setField("name", e.target.value)}
                placeholder="festival_offer_template"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Language code</label>
                <input
                  value={form.languageCode}
                  onChange={(e) => setField("languageCode", e.target.value)}
                  placeholder="en"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Category</label>
                <select
                  value={form.category}
                  onChange={(e) => setField("category", e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                >
                  <option value="MARKETING">MARKETING</option>
                  <option value="UTILITY">UTILITY</option>
                </select>
              </div>
            </div>

            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={form.allowCategoryChange}
                onChange={(e) => setField("allowCategoryChange", e.target.checked)}
              />
              Allow category change
            </label>

            <div className="rounded-xl border border-gray-200 p-4">
              <label className="mb-3 flex items-center gap-2 text-sm font-medium text-gray-700">
                <input
                  type="checkbox"
                  checked={form.headerEnabled}
                  onChange={(e) => setField("headerEnabled", e.target.checked)}
                />
                Add header component
              </label>

              {form.headerEnabled && (
                <div className="space-y-3">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">Header format</label>
                    <select
                      value={form.headerFormat}
                      onChange={(e) => setField("headerFormat", e.target.value)}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                    >
                      <option value="TEXT">TEXT</option>
                      <option value="IMAGE">IMAGE</option>
                      <option value="VIDEO">VIDEO</option>
                      <option value="DOCUMENT">DOCUMENT</option>
                    </select>
                  </div>

                  {form.headerFormat === "TEXT" && (
                    <>
                      <div>
                        <label className="mb-1 block text-sm font-medium text-gray-700">Header text</label>
                        <input
                          value={form.headerText}
                          onChange={(e) => setField("headerText", e.target.value)}
                          placeholder="Special Festival Offer"
                          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-sm font-medium text-gray-700">Header example</label>
                        <input
                          value={form.headerExample}
                          onChange={(e) => setField("headerExample", e.target.value)}
                          placeholder="Special Festival Offer"
                          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                        />
                      </div>
                    </>
                  )}

                  {form.headerFormat !== "TEXT" && (
                    <div className="space-y-3">
                      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
                        <button
                          type="button"
                          onClick={() => setHeaderMediaDialogOpen(true)}
                          className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-100"
                        >
                          Choose header media
                        </button>
                        <span className="text-xs font-medium text-gray-500">
                          CRM uploads the selected file to Meta and fills the handle below.
                        </span>
                      </div>
                      <MediaLibraryDialog
                        open={headerMediaDialogOpen}
                        title="Choose template header media"
                        helper="Select image, document, or video media. CRM will generate the Meta template handle automatically."
                        allowedTypes={["IMAGE", "DOCUMENT", "VIDEO"]}
                        onSelect={applyHeaderMediaAsset}
                        onClose={() => setHeaderMediaDialogOpen(false)}
                      />
                      {uploadingHeaderHandle && (
                        <p className="rounded-lg bg-teal-50 px-3 py-2 text-xs font-semibold text-teal-700">
                          Uploading media to Meta and generating template handle...
                        </p>
                      )}
                      <div>
                        <label className="mb-1 block text-sm font-medium text-gray-700">
                          Meta media handle
                        </label>
                        <input
                          value={form.headerMediaExample}
                          onChange={(e) => setField("headerMediaExample", e.target.value)}
                          placeholder="Meta upload handle"
                          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                        />
                        <p className="mt-1 text-xs text-gray-500">
                          CRM fills this after upload. If Meta upload fails, paste a handle manually.
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="space-y-4 rounded-2xl border border-gray-100 bg-gray-50/70 p-4">
            <div>
              <p className="text-sm font-bold text-gray-900">Message content</p>
              <p className="text-xs text-gray-500">Body, examples, footer, and buttons.</p>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Body</label>
              <textarea
                value={form.body}
                onChange={(e) => setField("body", e.target.value)}
                rows={4}
                placeholder="Hello {{1}}, your order {{2}} is confirmed."
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Body example 1</label>
                <input
                  value={form.bodyExampleOne}
                  onChange={(e) => setField("bodyExampleOne", e.target.value)}
                  placeholder="Ravi"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Body example 2</label>
                <input
                  value={form.bodyExampleTwo}
                  onChange={(e) => setField("bodyExampleTwo", e.target.value)}
                  placeholder="ORD-1001"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Footer</label>
              <input
                value={form.footer}
                onChange={(e) => setField("footer", e.target.value)}
                placeholder="Thank you for shopping with us"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>

            <div className="rounded-xl border border-gray-200 p-4">
              <div className="mb-3 flex items-center justify-between">
                <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
                  <input
                    type="checkbox"
                    checked={form.buttonsEnabled}
                    onChange={(e) => setField("buttonsEnabled", e.target.checked)}
                  />
                  Add buttons component
                </label>
                <button
                  onClick={addButton}
                  disabled={!form.buttonsEnabled}
                  className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Add button
                </button>
              </div>

              {!form.buttonsEnabled && (
                <p className="text-xs text-gray-500">Enable buttons to add quick reply, URL, or phone number actions.</p>
              )}

              <div className="space-y-3">
                {visibleButtons.map((button, index) => (
                  <div key={`${button.type}-${index}`} className="rounded-lg border border-gray-200 p-3">
                    <div className="mb-3 flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-800">Button {index + 1}</span>
                      <button
                        onClick={() => removeButton(index)}
                        className="text-xs font-medium text-red-600 hover:text-red-700"
                      >
                        Remove
                      </button>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                      <div>
                        <label className="mb-1 block text-sm font-medium text-gray-700">Button type</label>
                        <select
                          value={button.type}
                          onChange={(e) => updateButton(index, "type", e.target.value)}
                          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                        >
                          <option value="QUICK_REPLY">QUICK_REPLY</option>
                          <option value="URL">URL</option>
                          <option value="PHONE_NUMBER">PHONE_NUMBER</option>
                        </select>
                      </div>
                      <div>
                        <label className="mb-1 block text-sm font-medium text-gray-700">Button text</label>
                        <input
                          value={button.text}
                          onChange={(e) => updateButton(index, "text", e.target.value)}
                          placeholder="Track order"
                          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                        />
                      </div>
                    </div>

                    {button.type === "URL" && (
                      <div className="mt-3 grid gap-3 sm:grid-cols-2">
                        <div>
                          <label className="mb-1 block text-sm font-medium text-gray-700">URL</label>
                          <input
                            value={button.url}
                            onChange={(e) => updateButton(index, "url", e.target.value)}
                            placeholder="https://techoceanhub.com/orders/{{1}}"
                            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                          />
                        </div>
                        <div>
                          <label className="mb-1 block text-sm font-medium text-gray-700">URL examples</label>
                          <input
                            value={button.example}
                            onChange={(e) => updateButton(index, "example", e.target.value)}
                            placeholder="ORD-1001"
                            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                          />
                        </div>
                      </div>
                    )}

                    {button.type === "PHONE_NUMBER" && (
                      <div className="mt-3">
                        <label className="mb-1 block text-sm font-medium text-gray-700">Phone number</label>
                        <input
                          value={button.phoneNumber}
                          onChange={(e) => updateButton(index, "phoneNumber", e.target.value)}
                          placeholder="+919999999999"
                          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                        />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
          </div>
          <TemplateLivePreview form={form} />
        </div>

        <div className="mt-6 flex justify-end">
          <button
            onClick={saveTemplate}
            disabled={saving}
            className="rounded-lg bg-teal-700 px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? "Creating..." : "Create Template"}
          </button>
        </div>
      </div>

      <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm sm:p-6">
        <div className="mb-4">
          <h3 className="text-lg font-bold text-gray-900">Stored Templates</h3>
          <p className="text-sm text-gray-500">
            Synced and locally stored templates from your connected WhatsApp account.
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[920px] text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="px-4 py-3 text-left font-semibold text-gray-700">Name</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-700">Category</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-700">Language</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-700">Status</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-700">Summary</th>
                <th className="px-4 py-3 text-right font-semibold text-gray-700">Action</th>
              </tr>
            </thead>
            <tbody>
              {templates.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-gray-400">
                    No templates found
                  </td>
                </tr>
              )}

              {templates.map((template) => (
                <tr key={template.id} className="border-b border-gray-100 last:border-0">
                  <td className="px-4 py-3 font-medium text-gray-900">{template.metaTemplateName}</td>
                  <td className="px-4 py-3 text-gray-700">{template.category || "—"}</td>
                  <td className="px-4 py-3 text-gray-700">{template.languageCode || "—"}</td>
                  <td className="px-4 py-3">
                    <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-700">
                      {template.status || "—"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{componentSummary(template.parsedComponents)}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-3">
                      <button
                        onClick={() => setViewingTemplate(template)}
                        className="text-sm font-medium text-teal-700 hover:text-teal-800"
                      >
                        View
                      </button>
                      <button
                        onClick={() => deleteTemplate(template)}
                        disabled={deletingId === template.id}
                        className="text-sm font-medium text-rose-600 hover:text-rose-700 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {deletingId === template.id ? "Deleting..." : "Delete"}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {viewingTemplate && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setViewingTemplate(null)}
        >
          <div
            className="max-h-[92dvh] w-full max-w-6xl overflow-y-auto rounded-2xl bg-white p-4 shadow-2xl sm:p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <h3 className="text-lg font-bold text-gray-900">{viewingTemplate.metaTemplateName}</h3>
                <p className="text-sm text-gray-500">
                  {viewingTemplate.category} • {viewingTemplate.languageCode} • {viewingTemplate.status || "—"}
                </p>
              </div>
              <button
                onClick={() => setViewingTemplate(null)}
                className="text-sm font-medium text-gray-500 hover:text-gray-700"
              >
                Close
              </button>
            </div>

            <StoredTemplatePreview template={viewingTemplate} />

            <div className="mt-5 rounded-2xl border border-gray-200 bg-gray-50 p-4">
              <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Raw JSON Components</p>
                  <p className="mt-1 text-xs text-gray-500">Kept for diagnostics and Meta payload checking.</p>
                </div>
                <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-gray-500">
                  {viewingTemplate.parsedComponents?.length || 0} components
                </span>
              </div>
              <pre className="mt-3 max-h-80 overflow-auto rounded-xl bg-slate-950 p-4 text-xs leading-5 text-slate-100">
                {JSON.stringify(viewingTemplate.parsedComponents, null, 2)}
              </pre>
            </div>

            <div className="mt-5 flex justify-end">
              <button
                onClick={() => deleteTemplate(viewingTemplate)}
                disabled={deletingId === viewingTemplate.id}
                className="rounded-lg border border-rose-200 bg-white px-4 py-2 text-sm font-semibold text-rose-600 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {deletingId === viewingTemplate.id ? "Deleting..." : "Delete Template"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
