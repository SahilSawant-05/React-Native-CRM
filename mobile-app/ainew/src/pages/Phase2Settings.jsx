import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import {
  Building2,
  ClipboardList,
  Copy,
  FileText,
  Globe2,
  GripVertical,
  Mail,
  MoreVertical,
  Power,
  Plus,
  RefreshCw,
  Save,
  Send,
  SlidersHorizontal,
  Trash2,
} from "lucide-react";
import api from "../api/axios";
import {
  PrimaryButton,
  SecondaryButton,
  SelectInput,
  SettingsTabs,
  StatusBanner,
  FieldLabel,
  TextArea,
  TextInput,
} from "../components/phase2Settings/Phase2SettingsUi";
import { API_BASE_URL } from "../config/env";
import {
  EMPTY_EMAIL_CONFIG,
  EMPTY_EMAIL_TEMPLATE,
  EMPTY_FIELD_FORM,
  EMPTY_TEST_EMAIL,
  FIELD_TYPES,
  normalizeIndustryLabel,
  normalizeOptionsForSubmit,
} from "../config/phase2SettingsConfig";
import PlanUpgradePrompt, { errorMessage, isPlanLimitError } from "../components/billing/PlanUpgradePrompt";

const TAB_ITEMS = [
  { key: "industry", label: "Pipelines", icon: Building2 },
  { key: "fields", label: "Custom Fields", icon: SlidersHorizontal },
  { key: "website-widget", label: "Website Widget", icon: Globe2 },
  { key: "email-config", label: "Email Config", icon: Mail },
  { key: "email-templates", label: "Email Templates", icon: FileText },
];

const EmailDesigner = lazy(() => import("../components/email/EmailDesigner"));

const stageRowId = () => `stage-row-${Date.now()}-${Math.random().toString(36).slice(2)}`;

const pipelineStatusMeta = (pipeline) => {
  if (pipeline?.defaultPipeline) {
    return {
      label: "Default",
      className: "bg-teal-50 text-teal-700",
      help: "Used automatically for new opportunities.",
    };
  }
  if (pipeline?.status === "ACTIVE") {
    return {
      label: "Active",
      className: "bg-emerald-50 text-emerald-700",
      help: "Available for new opportunities.",
    };
  }
  if (pipeline?.status === "ARCHIVED") {
    return {
      label: "Stopped - history kept",
      className: "bg-gray-100 text-gray-700",
      help: "Old opportunities stay safe, but teams should not add new work here.",
    };
  }
  return {
    label: "Paused",
    className: "bg-amber-50 text-amber-700",
    help: "Temporarily hidden from normal use.",
  };
};

export default function Phase2Settings() {
  const [activeTab, setActiveTab] = useState("industry");
  const [industries, setIndustries] = useState([]);
  const [selectedIndustry, setSelectedIndustry] = useState("GENERIC");
  const [pipelineTypeKey, setPipelineTypeKey] = useState("GENERIC");
  const [pipelineDraftMode, setPipelineDraftMode] = useState("template");
  const [showPipelineBuilder, setShowPipelineBuilder] = useState(false);
  const [openPipelineMenuId, setOpenPipelineMenuId] = useState(null);
  const [presetStages, setPresetStages] = useState([]);
  const [pipelines, setPipelines] = useState([]);
  const [pipelineName, setPipelineName] = useState("");
  const [stageEditorPipeline, setStageEditorPipeline] = useState(null);
  const [stageEditorStages, setStageEditorStages] = useState([]);
  const [fields, setFields] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [emailConfig, setEmailConfig] = useState(null);
  const [crmSettings, setCrmSettings] = useState(null);
  const [websiteCaptures, setWebsiteCaptures] = useState([]);
  const [emailConnectionTest, setEmailConnectionTest] = useState(null);
  const [showAdvancedEmail, setShowAdvancedEmail] = useState(false);
  const [fieldForm, setFieldForm] = useState(EMPTY_FIELD_FORM);
  const [emailConfigForm, setEmailConfigForm] = useState(EMPTY_EMAIL_CONFIG);
  const [templateForm, setTemplateForm] = useState(EMPTY_EMAIL_TEMPLATE);
  const [templateEditorMode, setTemplateEditorMode] = useState("rich");
  const [testEmailForm, setTestEmailForm] = useState(EMPTY_TEST_EMAIL);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState("");
  const [draggingStageIndex, setDraggingStageIndex] = useState(null);
  const [draggingEditorStageIndex, setDraggingEditorStageIndex] = useState(null);
  const [draggingFieldIndex, setDraggingFieldIndex] = useState(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [upgradePrompt, setUpgradePrompt] = useState({ open: false, message: "" });

  const emailTemplates = useMemo(
    () => templates.filter((template) => template.channel === "EMAIL"),
    [templates]
  );

  const websiteWidgetScript = useMemo(() => {
    if (!crmSettings?.widgetTenantKey || !crmSettings?.widgetPublicKey) return "";
    const baseUrl = String(API_BASE_URL || window.location.origin).replace(/\/+$/, "");
    return `<script src="${baseUrl}/widget.js" data-tenant="${crmSettings.widgetTenantKey}" data-key="${crmSettings.widgetPublicKey}"></script>`;
  }, [crmSettings]);

  const stageKeyFromLabel = (label, fallback = "STAGE") => {
    const normalized = String(label || "")
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "");
    return normalized || fallback;
  };

  const normalizePipelineTypeKey = (value) =>
    String(value || "GENERIC")
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "") || "GENERIC";

  const activePipelineDraftStages = presetStages.filter((stage) => stage.active !== false);
  const pipelineDraftIssue = !pipelineName.trim()
    ? "Enter a pipeline name to continue."
    : !String(pipelineTypeKey || "").trim()
      ? "Enter a Pipeline / Catalog Type Key."
      : activePipelineDraftStages.length === 0
        ? "Add at least one active stage."
        : activePipelineDraftStages.some((stage) => !stage.label?.trim() || !stage.stageKey?.trim())
          ? "Complete the stage name and key for every active stage."
          : "";

  const loadAll = async () => {
    setLoading(true);
    setError("");
    try {
      const [industryRes, pipelineRes, fieldRes, templateRes, emailConfigRes, settingsRes, websiteCaptureRes] = await Promise.all([
        api.get("/api/industry-presets"),
        api.get("/api/pipelines"),
        api.get("/api/crm-config/custom-fields"),
        api.get("/api/crm-config/communication-templates", { params: { channel: "EMAIL" } }),
        api.get("/api/email/config"),
        api.get("/api/tenant/crm-settings"),
        api.get("/api/website-leads/captures").catch(() => ({ data: [] })),
      ]);

      const loadedIndustries = industryRes.data || [];
      setIndustries(loadedIndustries);
      const activeIndustry = settingsRes.data?.activeIndustryKey || "GENERIC";
      if (loadedIndustries.includes(activeIndustry)) {
        setSelectedIndustry(activeIndustry);
        setPipelineTypeKey(activeIndustry);
      } else if (loadedIndustries.length && !loadedIndustries.includes(selectedIndustry)) {
        setSelectedIndustry(loadedIndustries[0]);
        setPipelineTypeKey(activeIndustry);
      }
      setPipelines(pipelineRes.data || []);
      setFields(fieldRes.data || []);
      setTemplates(templateRes.data || []);
      setCrmSettings(settingsRes.data || null);
      setWebsiteCaptures(websiteCaptureRes.data || []);
      setEmailConfig(emailConfigRes.data || null);
      if (emailConfigRes.data) {
        setEmailConfigForm({
          ...EMPTY_EMAIL_CONFIG,
          ...emailConfigRes.data,
          smtpPassword: "",
          imapPassword: "",
        });
      }
    } catch (err) {
      setError(err?.response?.data?.message || err.message || "Failed to load Phase 2 settings");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
  }, []);

  useEffect(() => {
    if (!selectedIndustry || pipelineDraftMode !== "template") return;
    const loadPresetPreview = async () => {
      try {
        const response = await api.get(`/api/industry-presets/${selectedIndustry}/preview`);
        setPresetStages(
          (response.data?.stages || []).map((stage, index) => ({
            _rowId: stageRowId(),
            stageKey: stage.stageKey || `STAGE_${index + 1}`,
            label: stage.label || "",
            displayOrder: index + 1,
            active: stage.active !== false,
          }))
        );
      } catch (err) {
        setPresetStages([]);
      }
    };
    loadPresetPreview();
  }, [selectedIndustry, pipelineDraftMode]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    if (!code) return;

    const finishEmailOAuth = async () => {
      clearMessages();
      const oauthProvider = window.localStorage.getItem("emailOAuthProvider") || "gmail";
      const savingKey = oauthProvider === "outlook" ? "outlook-oauth" : "gmail-oauth";
      setSaving(savingKey);
      try {
        const redirectUri = window.location.origin + window.location.pathname;
        const callbackUrl = oauthProvider === "outlook" ? "/api/email/outlook-oauth/callback" : "/api/email/gmail-oauth/callback";
        const response = await api.post(callbackUrl, { code, redirectUri });
        setEmailConfig(response.data || null);
        setEmailConfigForm((current) => ({ ...current, ...response.data, smtpPassword: "", imapPassword: "" }));
        setSuccess(oauthProvider === "outlook" ? "Microsoft 365 connected" : "Gmail OAuth connected");
        window.localStorage.removeItem("emailOAuthProvider");
        window.history.replaceState({}, "", window.location.pathname);
      } catch (err) {
        setError(err?.response?.data?.message || err.message || "Failed to finish email OAuth");
      } finally {
        setSaving("");
      }
    };

    finishEmailOAuth();
  }, []);

  const clearMessages = () => {
    setError("");
    setSuccess("");
  };

  const saveField = async () => {
    clearMessages();
    if (!fieldForm.fieldKey.trim() || !fieldForm.label.trim()) {
      setError("Field key and label are required");
      return;
    }

    setSaving("field");
    try {
      const payload = {
        ...fieldForm,
        optionsJson: normalizeOptionsForSubmit(fieldForm),
      };
      await api.post("/api/crm-config/custom-fields", payload);
      const response = await api.get("/api/crm-config/custom-fields");
      setFields(response.data || []);
      setFieldForm(EMPTY_FIELD_FORM);
      setSuccess("Custom field saved");
    } catch (err) {
      setError(err?.response?.data?.message || err.message || "Failed to save custom field");
    } finally {
      setSaving("");
    }
  };

  const deleteField = async (field) => {
    clearMessages();
    if (!window.confirm(`Delete custom field "${field.label || field.fieldKey}"? This will remove saved values for this field from contacts.`)) {
      return;
    }
    setSaving(`field-delete-${field.id}`);
    try {
      await api.delete(`/api/crm-config/custom-fields/${field.id}`);
      const response = await api.get("/api/crm-config/custom-fields");
      setFields(response.data || []);
      setSuccess("Custom field deleted");
    } catch (err) {
      setError(err?.response?.data?.message || err.message || "Failed to delete custom field");
    } finally {
      setSaving("");
    }
  };

  const persistFieldOrder = async (orderedFields) => {
    clearMessages();
    setSaving("field-order");
    try {
      await Promise.all(
        orderedFields.map((field, index) =>
          api.post("/api/crm-config/custom-fields", {
            fieldKey: field.fieldKey,
            label: field.label,
            type: field.type,
            optionsJson: field.optionsJson,
            required: field.required,
            displayOrder: index + 1,
            active: field.active,
          })
        )
      );
      const response = await api.get("/api/crm-config/custom-fields");
      setFields(response.data || []);
      setSuccess("Custom field order updated");
    } catch (err) {
      setError(err?.response?.data?.message || err.message || "Failed to update custom field order");
      const response = await api.get("/api/crm-config/custom-fields");
      setFields(response.data || []);
    } finally {
      setSaving("");
    }
  };

  const reorderField = (fromIndex, toIndex) => {
    if (fromIndex === null || fromIndex === undefined || fromIndex === toIndex) return;
    if (fromIndex < 0 || toIndex < 0 || fromIndex >= fields.length || toIndex >= fields.length) {
      return;
    }
    const next = [...fields];
    const [moved] = next.splice(fromIndex, 1);
    next.splice(toIndex, 0, moved);
    const ordered = next.map((field, index) => ({ ...field, displayOrder: index + 1 }));
    setFields(ordered);
    persistFieldOrder(ordered);
  };

  const saveEmailConfig = async () => {
    clearMessages();
    setEmailConnectionTest(null);
    if (!emailConfigForm.fromEmail.trim()) {
      setError("From email is required");
      return;
    }
    if (emailConfigForm.provider === "SMTP" && !emailConfigForm.smtpHost.trim()) {
      setError("SMTP host is required");
      return;
    }

    setSaving("email-config");
    try {
      const response = await api.post("/api/email/config", emailConfigForm);
      setEmailConfig(response.data || null);
      setEmailConfigForm((current) => ({ ...current, smtpPassword: "", imapPassword: "" }));
      setSuccess("Email configuration saved");
    } catch (err) {
      setError(err?.response?.data?.message || err.message || "Failed to save email configuration");
    } finally {
      setSaving("");
    }
  };

  const testEmailConnection = async () => {
    clearMessages();
    setEmailConnectionTest(null);
    setSaving("email-test-connection");
    try {
      const response = await api.post("/api/email/config/test");
      setEmailConnectionTest(response.data || null);
      const result = response.data || {};
      if (result.smtpOk && result.imapOk) {
        setSuccess("Email send and inbox sync connections are working");
      } else {
        setError("One or more email connections need attention");
      }
    } catch (err) {
      setError(err?.response?.data?.message || err.message || "Failed to test email connection");
    } finally {
      setSaving("");
    }
  };

  const connectGmailOAuth = async () => {
    clearMessages();
    setSaving("gmail-oauth");
    try {
      const redirectUri = window.location.origin + "/dashboard/phase2-settings";
      const response = await api.get("/api/email/gmail-oauth/url", { params: { redirectUri } });
      if (response.data?.authorizationUrl) {
        window.localStorage.setItem("emailOAuthProvider", "gmail");
        window.location.href = response.data.authorizationUrl;
      }
    } catch (err) {
      setError(err?.response?.data?.message || err.message || "Failed to start Gmail OAuth");
    } finally {
      setSaving("");
    }
  };

  const connectOutlookOAuth = async () => {
    clearMessages();
    setSaving("outlook-oauth");
    try {
      const redirectUri = window.location.origin + "/dashboard/phase2-settings";
      const response = await api.get("/api/email/outlook-oauth/url", { params: { redirectUri } });
      if (response.data?.authorizationUrl) {
        window.localStorage.setItem("emailOAuthProvider", "outlook");
        window.location.href = response.data.authorizationUrl;
      }
    } catch (err) {
      setError(err?.response?.data?.message || err.message || "Failed to start Microsoft 365 OAuth");
    } finally {
      setSaving("");
    }
  };

  const disconnectOutlookOAuth = async () => {
    clearMessages();
    setEmailConnectionTest(null);
    if (!window.confirm("Disconnect the current Microsoft 365 account from this CRM? You can connect a new Outlook account after this.")) {
      return;
    }
    setSaving("outlook-oauth-disconnect");
    try {
      const response = await api.post("/api/email/outlook-oauth/disconnect");
      setEmailConfig(response.data || null);
      setEmailConfigForm((current) => ({
        ...current,
        ...response.data,
        provider: response.data?.provider || "SMTP",
        smtpPassword: "",
        imapPassword: "",
      }));
      setSuccess("Microsoft 365 disconnected. Connect Outlook again or save custom SMTP/IMAP settings.");
    } catch (err) {
      setError(err?.response?.data?.message || err.message || "Failed to disconnect Microsoft 365");
    } finally {
      setSaving("");
    }
  };

  const disconnectGmailOAuth = async () => {
    clearMessages();
    setEmailConnectionTest(null);
    if (!window.confirm("Disconnect the current Gmail account from this CRM? You can connect a new Gmail account after this.")) {
      return;
    }
    setSaving("gmail-oauth-disconnect");
    try {
      const response = await api.post("/api/email/gmail-oauth/disconnect");
      setEmailConfig(response.data || null);
      setEmailConfigForm((current) => ({
        ...current,
        ...response.data,
        provider: response.data?.provider || "SMTP",
        smtpPassword: "",
        imapPassword: "",
      }));
      setSuccess("Gmail disconnected. Connect a new Gmail account or save custom SMTP/IMAP settings.");
    } catch (err) {
      setError(err?.response?.data?.message || err.message || "Failed to disconnect Gmail");
    } finally {
      setSaving("");
    }
  };

  const saveEmailTemplate = async () => {
    clearMessages();
    if (!templateForm.name.trim() || !templateForm.subject.trim()) {
      setError("Template name and subject are required");
      return;
    }
    if (!templateForm.bodyHtml.trim() && !templateForm.bodyText.trim()) {
      setError("Template body is required");
      return;
    }

    setSaving("template");
    try {
      await api.post("/api/crm-config/communication-templates", {
        ...templateForm,
        industryKey: null,
        channel: "EMAIL",
      });
      const response = await api.get("/api/crm-config/communication-templates", {
        params: { channel: "EMAIL" },
      });
      setTemplates(response.data || []);
      setTemplateForm(EMPTY_EMAIL_TEMPLATE);
      setTemplateEditorMode("rich");
      setSuccess(templateForm.id ? "Email template updated" : "Email template saved");
    } catch (err) {
      setError(err?.response?.data?.message || err.message || "Failed to save email template");
    } finally {
      setSaving("");
    }
  };

  const editEmailTemplate = (template) => {
    clearMessages();
    setTemplateForm({
      id: template.id || null,
      name: template.name || "",
      industryKey: "",
      subject: template.subject || "",
      bodyHtml: template.bodyHtml || "",
      bodyText: template.bodyText || "",
      designJson: template.designJson || "",
      mjml: template.mjml || "",
      active: template.active !== false,
    });
    setTemplateEditorMode(template.bodyHtml ? "rich" : "text");
  };

  const resetEmailTemplate = () => {
    clearMessages();
    setTemplateForm(EMPTY_EMAIL_TEMPLATE);
    setTemplateEditorMode("rich");
  };

  const deleteEmailTemplate = async (template) => {
    clearMessages();
    if (!window.confirm(`Delete email template "${template.name || template.subject}"?`)) return;
    setSaving(`template-delete-${template.id}`);
    try {
      await api.delete(`/api/crm-config/communication-templates/${template.id}`);
      const response = await api.get("/api/crm-config/communication-templates", {
        params: { channel: "EMAIL" },
      });
      setTemplates(response.data || []);
      if (templateForm.id === template.id) {
        resetEmailTemplate();
      }
      setSuccess("Email template deleted");
    } catch (err) {
      setError(err?.response?.data?.message || err.message || "Failed to delete email template");
    } finally {
      setSaving("");
    }
  };

  const setTemplateDesign = (designerValue) => {
    setTemplateForm((current) => ({
      ...current,
      designJson: designerValue.designJson || current.designJson || "",
      mjml: designerValue.mjml || current.mjml || "",
      bodyHtml: designerValue.bodyHtml || current.bodyHtml || "",
    }));
  };

  const sendTestEmail = async () => {
    clearMessages();
    if (!testEmailForm.toEmail.trim()) {
      setError("Test recipient email is required");
      return;
    }

    setSaving("test-email");
    try {
      const response = await api.post("/api/email/send", {
        ...testEmailForm,
        variables: { contactName: "Demo Lead" },
      });
      if (response.data?.status === "SENT") {
        setSuccess("Test email sent");
      } else {
        setError(response.data?.errorMessage || "Test email failed. Check SMTP host, port, TLS, username, password, and sender address.");
      }
    } catch (err) {
      setError(err?.response?.data?.message || err.message || "Failed to send test email");
    } finally {
      setSaving("");
    }
  };

  const setFieldFormValue = (field, value) => {
    setFieldForm((current) => ({ ...current, [field]: value }));
  };

  const setPresetStageValue = (index, field, value) => {
    setPresetStages((current) =>
      current.map((stage, stageIndex) => {
        if (stageIndex !== index) return stage;
        if (field !== "label") return { ...stage, [field]: value };
        const previousGeneratedKey = stageKeyFromLabel(stage.label, `STAGE_${index + 1}`);
        const shouldSyncKey = !stage.stageKey || stage.stageKey === previousGeneratedKey || /^STAGE_\d+$/.test(stage.stageKey);
        return {
          ...stage,
          label: value,
          stageKey: shouldSyncKey ? stageKeyFromLabel(value, `STAGE_${index + 1}`) : stage.stageKey,
        };
      })
    );
  };

  const addPresetStage = () => {
    setPresetStages((current) => [
      ...current,
      {
        _rowId: stageRowId(),
        stageKey: `STAGE_${current.length + 1}`,
        label: "",
        displayOrder: current.length + 1,
        active: true,
      },
    ]);
  };

  const removePresetStage = (index) => {
    setPresetStages((current) =>
      current
        .filter((_, stageIndex) => stageIndex !== index)
        .map((stage, stageIndex) => ({ ...stage, displayOrder: stageIndex + 1 }))
    );
  };

  const reorderPresetStage = (fromIndex, toIndex) => {
    if (fromIndex === null || fromIndex === undefined || fromIndex === toIndex) return;
    setPresetStages((current) => {
      if (fromIndex < 0 || toIndex < 0 || fromIndex >= current.length || toIndex >= current.length) {
          return current;
      }
      const next = [...current];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      return next.map((stage, stageIndex) => ({ ...stage, displayOrder: stageIndex + 1 }));
    });
  };

  const resetPresetPreview = async (showSuccess = true) => {
    clearMessages();
    try {
      const response = await api.get(`/api/industry-presets/${selectedIndustry}/preview`);
      setPresetStages(
        (response.data?.stages || []).map((stage, index) => ({
          _rowId: stageRowId(),
          stageKey: stage.stageKey || `STAGE_${index + 1}`,
          label: stage.label || "",
          displayOrder: index + 1,
          active: stage.active !== false,
        }))
      );
      if (showSuccess) {
        setSuccess("Preset stage names reset to template defaults");
      }
    } catch (err) {
      setError(err?.response?.data?.message || err.message || "Failed to reset preset preview");
    }
  };

  const buildPresetPayload = () => ({
    stages: presetStages
      .map((stage, index) => ({
        stageKey: stage.stageKey,
        label: stage.label,
        displayOrder: index + 1,
        active: stage.active !== false,
      }))
      .filter((stage) => stage.label?.trim()),
  });

  const useTemplatePipelineDraft = async () => {
    setPipelineDraftMode("template");
    await resetPresetPreview(false);
  };

  const useBlankPipelineDraft = () => {
    clearMessages();
    setPipelineDraftMode("blank");
    setPresetStages([
      {
        _rowId: stageRowId(),
        stageKey: "STAGE_1",
        label: "",
        displayOrder: 1,
        active: true,
      },
    ]);
  };

  const openPipelineBuilder = () => {
    clearMessages();
    setStageEditorPipeline(null);
    setShowPipelineBuilder(true);
    window.setTimeout(() => document.getElementById("pipeline-builder")?.scrollIntoView({ behavior: "smooth", block: "start" }), 0);
  };

  const cancelPipelineBuilder = () => {
    clearMessages();
    setShowPipelineBuilder(false);
    setPipelineName("");
    setPipelineDraftMode("template");
  };

  const refreshPipelines = async () => {
    const response = await api.get("/api/pipelines");
    setPipelines(response.data || []);
  };

  const openStageEditor = async (pipeline) => {
    clearMessages();
    setStageEditorPipeline(pipeline);
    setSaving(`pipeline-${pipeline.id}-stages-load`);
    try {
      const response = await api.get("/api/crm-config/pipeline-stages", { params: { pipelineId: pipeline.id } });
      setStageEditorStages(
        (response.data || []).map((stage, index) => ({
          ...stage,
          _rowId: stageRowId(),
          stageKey: stage.stageKey || stage.key || `STAGE_${index + 1}`,
          label: stage.label || "",
          displayOrder: index + 1,
          active: stage.active !== false,
        }))
      );
    } catch (err) {
      setError(err?.response?.data?.message || err.message || "Failed to load pipeline stages");
      setStageEditorStages([]);
    } finally {
      setSaving("");
    }
  };

  const setEditorStageValue = (index, field, value) => {
    setStageEditorStages((current) =>
      current.map((stage, stageIndex) => {
        if (stageIndex !== index) return stage;
        if (field !== "label" || stage.id) return { ...stage, [field]: value };
        const previousGeneratedKey = stageKeyFromLabel(stage.label, `STAGE_${index + 1}`);
        const shouldSyncKey = !stage.stageKey || stage.stageKey === previousGeneratedKey || /^STAGE_\d+$/.test(stage.stageKey);
        return {
          ...stage,
          label: value,
          stageKey: shouldSyncKey ? stageKeyFromLabel(value, `STAGE_${index + 1}`) : stage.stageKey,
        };
      })
    );
  };

  const addEditorStage = () => {
    setStageEditorStages((current) => [
      ...current,
      {
        _rowId: stageRowId(),
        stageKey: `STAGE_${current.length + 1}`,
        label: "",
        displayOrder: current.length + 1,
        active: true,
      },
    ]);
  };

  const removeEditorStage = (index) => {
    setStageEditorStages((current) =>
      current
        .filter((_, stageIndex) => stageIndex !== index)
        .map((stage, stageIndex) => ({ ...stage, displayOrder: stageIndex + 1 }))
    );
  };

  const reorderEditorStage = (fromIndex, toIndex) => {
    if (fromIndex === null || fromIndex === undefined || fromIndex === toIndex) return;
    setStageEditorStages((current) => {
      if (fromIndex < 0 || toIndex < 0 || fromIndex >= current.length || toIndex >= current.length) {
        return current;
      }
      const next = [...current];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      return next.map((stage, stageIndex) => ({ ...stage, displayOrder: stageIndex + 1 }));
    });
  };

  const saveEditorStages = async () => {
    clearMessages();
    if (!stageEditorPipeline) return;
    if (!stageEditorStages.some((stage) => stage.active !== false)) {
      setError("Keep at least one stage available so opportunities have somewhere to go");
      return;
    }
    const invalidStage = stageEditorStages.find((stage) => stage.active !== false && (!stage.stageKey?.trim() || !stage.label?.trim()));
    if (invalidStage) {
      setError("Active stages need both stage key and stage name");
      return;
    }
    setSaving(`pipeline-${stageEditorPipeline.id}-stages-save`);
    try {
      await Promise.all(
        stageEditorStages.map((stage, index) =>
          api.post("/api/crm-config/pipeline-stages", {
            pipelineId: stageEditorPipeline.id,
            stageKey: stage.stageKey,
            label: stage.label || stage.stageKey,
            displayOrder: index + 1,
            active: stage.active !== false,
          })
        )
      );
      await refreshPipelines();
      await openStageEditor(stageEditorPipeline);
      setSuccess("Pipeline stages saved. Hidden stages still keep their existing opportunity history.");
    } catch (err) {
      setError(err?.response?.data?.message || err.message || "Failed to save pipeline stages");
    } finally {
      setSaving("");
    }
  };

  const createPipeline = async () => {
    clearMessages();
    if (!pipelineName.trim()) {
      setError("Pipeline name is required");
      return;
    }
    const normalizedPipelineTypeKey = normalizePipelineTypeKey(pipelineTypeKey);
    if (!normalizedPipelineTypeKey) {
      setError("Pipeline / Catalog Type Key is required");
      return;
    }
    const stagePayload = buildPresetPayload().stages;
    const invalidStage = presetStages.find((stage) => stage.active !== false && (!stage.stageKey?.trim() || !stage.label?.trim()));
    if (invalidStage) {
      setError("Each active stage needs both stage key and stage name before creating the pipeline");
      return;
    }
    if (stagePayload.length === 0) {
      setError("Add at least one stage before creating the pipeline");
      return;
    }
    const fromTemplate = pipelineDraftMode === "template";
    setSaving(fromTemplate ? "pipeline-template" : "pipeline-blank");
    try {
      await api.post("/api/pipelines", {
        name: pipelineName.trim(),
        industryKey: normalizedPipelineTypeKey,
        status: "ACTIVE",
        defaultPipeline: pipelines.length === 0,
        fromTemplate,
        stages: stagePayload,
      });
      if (pipelines.length === 0) {
        await api.post("/api/tenant/crm-settings", { activeIndustryKey: normalizedPipelineTypeKey });
      }
      setPipelineName("");
      setPipelineTypeKey("GENERIC");
      setShowPipelineBuilder(false);
      await refreshPipelines();
      setSuccess(fromTemplate ? "Pipeline created from template" : "Blank pipeline created");
    } catch (err) {
      const message = errorMessage(err, "Failed to create pipeline");
      if (isPlanLimitError(message)) {
        setUpgradePrompt({ open: true, message });
      } else {
        setError(message);
      }
    } finally {
      setSaving("");
    }
  };

  const updatePipelineStatus = async (pipeline, status) => {
    const nextStatus = String(status || "").toUpperCase();
    if (nextStatus === "ARCHIVED") {
      const confirmed = window.confirm(
        `Stop using "${pipeline.name}"?\n\nExisting opportunities and reports will stay saved. This pipeline should not be used for new opportunities after this. You can restore it later.`
      );
      if (!confirmed) return;
    }
    if (nextStatus === "ACTIVE" && pipeline.status === "ARCHIVED") {
      const confirmed = window.confirm(`Restore "${pipeline.name}" and make it available for new opportunities again?`);
      if (!confirmed) return;
    }
    clearMessages();
    setSaving(`pipeline-${pipeline.id}-${status}`);
    try {
      await api.put(`/api/pipelines/${pipeline.id}`, {
        name: pipeline.name,
        industryKey: pipeline.industryKey || "GENERIC",
        status,
        defaultPipeline: pipeline.defaultPipeline,
      });
      await refreshPipelines();
      setSuccess(nextStatus === "ARCHIVED" ? "Pipeline stopped. History is still saved." : `Pipeline ${status.toLowerCase().replaceAll("_", " ")}`);
    } catch (err) {
      setError(err?.response?.data?.message || err.message || "Failed to update pipeline");
    } finally {
      setSaving("");
    }
  };

  const setDefaultPipeline = async (pipeline) => {
    clearMessages();
    setSaving(`pipeline-${pipeline.id}-default`);
    try {
      await api.post(`/api/pipelines/${pipeline.id}/default`);
      await refreshPipelines();
      setSuccess("Default pipeline updated");
    } catch (err) {
      setError(err?.response?.data?.message || err.message || "Failed to set default pipeline");
    } finally {
      setSaving("");
    }
  };

  const deletePipeline = async (pipeline) => {
    if (pipeline.defaultPipeline) {
      setError("Default pipeline cannot be deleted. Create another active pipeline and set it as default first.");
      return;
    }
    if (!window.confirm(`Delete pipeline "${pipeline.name}"? Only empty pipelines can be deleted.`)) return;
    clearMessages();
    setSaving(`pipeline-${pipeline.id}-delete`);
    try {
      await api.delete(`/api/pipelines/${pipeline.id}`);
      await refreshPipelines();
      setSuccess("Pipeline deleted");
    } catch (err) {
      setError(err?.response?.data?.message || err.message || "Pipeline has records. Disable or archive it instead.");
    } finally {
      setSaving("");
    }
  };

  const setEmailConfigValue = (field, value) => {
    setEmailConfigForm((current) => ({ ...current, [field]: value }));
  };

  const setTemplateValue = (field, value) => {
    setTemplateForm((current) => ({ ...current, [field]: value }));
  };

  const setTestEmailValue = (field, value) => {
    setTestEmailForm((current) => ({ ...current, [field]: value }));
  };

  const copyWebsiteWidgetScript = async () => {
    clearMessages();
    if (!websiteWidgetScript) {
      setError("Website widget key is not ready yet. Refresh settings and try again.");
      return;
    }
    try {
      await navigator.clipboard.writeText(websiteWidgetScript);
      setSuccess("Website widget script copied");
    } catch (err) {
      setError("Could not copy automatically. Select the script and copy it manually.");
    }
  };

  const toggleWebsiteWidget = async () => {
    clearMessages();
    const nextEnabled = !crmSettings?.widgetEnabled;
    setSaving("website-widget");
    try {
      const response = await api.post("/api/tenant/crm-settings", {
        activeIndustryKey: crmSettings?.activeIndustryKey || selectedIndustry || "GENERIC",
        widgetEnabled: nextEnabled,
      });
      setCrmSettings(response.data || null);
      setSuccess(nextEnabled ? "Website lead widget enabled" : "Website lead widget disabled");
    } catch (err) {
      setError(err?.response?.data?.message || err.message || "Failed to update website widget");
    } finally {
      setSaving("");
    }
  };

  return (
    <div className="min-h-screen min-w-0 max-w-full overflow-x-hidden bg-slate-50 p-3 text-left sm:p-6">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-950">Phase 2 Settings</h2>
            <p className="mt-1 text-sm text-gray-500">
              Configure pipelines, CRM fields, and email communication.
            </p>
          </div>
          <SecondaryButton onClick={loadAll} disabled={loading} icon={RefreshCw}>
            Refresh
          </SecondaryButton>
        </div>

        <StatusBanner error={error} success={success} />

        <SettingsTabs
          activeTab={activeTab}
          items={TAB_ITEMS}
          onChange={(key) => {
            setActiveTab(key);
            clearMessages();
          }}
        />

        {loading ? (
          <div className="rounded-lg border border-gray-200 bg-white p-8 text-center text-sm text-gray-500">
            Loading settings...
          </div>
        ) : (
          <>
            {activeTab === "industry" && (
              <div className={`grid gap-6 ${showPipelineBuilder ? "xl:grid-cols-[minmax(0,420px)_1fr]" : ""}`}>
                {showPipelineBuilder && (
                <section id="pipeline-builder" className="scroll-mt-6 rounded-lg border border-teal-200 bg-white p-5 shadow-sm">
                  <div className="mb-5 flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-md bg-teal-50 text-teal-700">
                      <Building2 size={20} />
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-gray-950">Create Pipeline · Step 1 of 2</h3>
                      <p className="text-sm text-gray-500">Set the name and choose how its stages should begin.</p>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <FieldLabel>New pipeline name</FieldLabel>
                      <TextInput
                        value={pipelineName}
                        onChange={(event) => setPipelineName(event.target.value)}
                        placeholder={`${normalizeIndustryLabel(pipelineTypeKey || selectedIndustry)} Pipeline`}
                      />
                    </div>
                    <div>
                      <FieldLabel>Starter Template</FieldLabel>
                      <SelectInput
                        value={selectedIndustry}
                        onChange={(event) => {
                          setSelectedIndustry(event.target.value);
                          setPipelineTypeKey(event.target.value);
                        }}
                      >
                        {industries.map((industry) => (
                          <option key={industry} value={industry}>
                            {normalizeIndustryLabel(industry)}
                          </option>
                        ))}
                      </SelectInput>
                      <p className="mt-1 text-xs text-gray-500">Only controls starter stages. You can still save the pipeline with any catalog type key below.</p>
                    </div>
                    <div>
                      <FieldLabel>Pipeline / Catalog Type Key</FieldLabel>
                      <TextInput
                        value={pipelineTypeKey}
                        onChange={(event) => setPipelineTypeKey(normalizePipelineTypeKey(event.target.value))}
                        placeholder="ECOMMERCE / CAR_SALES / REAL_ESTATE"
                      />
                      <p className="mt-1 rounded-md bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-800">
                        Use the same key in Domain Catalog if you want catalog items to appear while creating opportunities in this pipeline.
                      </p>
                    </div>

                    <div>
                      <FieldLabel>How should stages begin?</FieldLabel>
                      <div className="grid gap-2 sm:grid-cols-2">
                        <SecondaryButton
                          onClick={useTemplatePipelineDraft}
                          disabled={saving === "pipeline-template" || saving === "pipeline-blank"}
                          icon={ClipboardList}
                          className={pipelineDraftMode === "template" ? "border-teal-500 bg-teal-50 text-teal-800" : ""}
                        >
                          Use Template Stages
                        </SecondaryButton>
                        <SecondaryButton
                          onClick={useBlankPipelineDraft}
                          disabled={saving === "pipeline-template" || saving === "pipeline-blank"}
                          icon={SlidersHorizontal}
                          className={pipelineDraftMode === "blank" ? "border-teal-500 bg-teal-50 text-teal-800" : ""}
                        >
                          Use Custom Stages
                        </SecondaryButton>
                      </div>
                    </div>

                    <p className="rounded-lg bg-teal-50 px-3 py-2 text-xs leading-relaxed text-teal-800">
                      {pipelineDraftMode === "template"
                        ? "Template selected. Review and edit its stages in Step 2 before creating."
                        : "Custom stages selected. Define the stage list in Step 2 before creating."}
                    </p>
                  </div>
                </section>
                )}

                <section className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
                  {showPipelineBuilder && (
                  <>
                  <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div>
                      <h3 className="text-base font-bold text-gray-950">
                        Create Pipeline · Step 2 of 2
                      </h3>
                      <p className="text-sm text-gray-500">
                        {pipelineDraftMode === "template"
                          ? "Review the template stages, rename them, or change their order."
                          : "Add and arrange the custom stages for this pipeline."}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {pipelineDraftMode === "template" && (
                        <SecondaryButton onClick={resetPresetPreview} icon={RefreshCw}>
                          Reset Template
                        </SecondaryButton>
                      )}
                      <SecondaryButton onClick={addPresetStage} icon={Plus}>
                        Add Stage
                      </SecondaryButton>
                    </div>
                  </div>

                  <div className="mb-6 space-y-3">
                    {presetStages.map((stage, index) => (
                      <div
                        key={stage._rowId || `preset-stage-${index}`}
                        onDragOver={(event) => event.preventDefault()}
                        onDrop={() => {
                          reorderPresetStage(draggingStageIndex, index);
                          setDraggingStageIndex(null);
                        }}
                        className={`grid gap-3 rounded-lg border p-3 transition md:grid-cols-[44px_70px_1fr_1.2fr_auto] ${
                          draggingStageIndex === index
                            ? "border-teal-300 bg-teal-50"
                            : "border-gray-200 bg-slate-50"
                        }`}
                      >
                        <div className="flex items-end">
                          <button
                            type="button"
                            draggable
                            onDragStart={() => setDraggingStageIndex(index)}
                            onDragEnd={() => setDraggingStageIndex(null)}
                            className="flex min-h-10 w-9 cursor-grab items-center justify-center rounded-md border border-gray-200 bg-white text-gray-400 active:cursor-grabbing hover:border-teal-300 hover:text-teal-700"
                            title="Drag to reorder"
                          >
                            <GripVertical size={16} />
                          </button>
                        </div>
                        <div>
                          <FieldLabel>Order</FieldLabel>
                          <TextInput
                            type="number"
                            value={index + 1}
                            readOnly
                            className="bg-white"
                          />
                        </div>
                        <div>
                          <FieldLabel>Stage name</FieldLabel>
                          <TextInput
                            value={stage.label}
                            onChange={(event) => setPresetStageValue(index, "label", event.target.value)}
                            placeholder="Follow Up"
                          />
                        </div>
                        <div>
                          <FieldLabel>Stage key</FieldLabel>
                          <TextInput
                            value={stage.stageKey}
                            onChange={(event) => setPresetStageValue(index, "stageKey", event.target.value)}
                            placeholder="FOLLOW_UP"
                          />
                        </div>
                        <div className="flex items-end">
                          <SecondaryButton
                            type="button"
                            onClick={() => removePresetStage(index)}
                            disabled={presetStages.length <= 1}
                            icon={Trash2}
                            className="w-full md:w-auto"
                          >
                            Remove
                          </SecondaryButton>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className={`mb-6 rounded-lg border p-4 ${pipelineDraftIssue ? "border-amber-200 bg-amber-50" : "border-emerald-200 bg-emerald-50"}`}>
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className={`text-sm font-bold ${pipelineDraftIssue ? "text-amber-900" : "text-emerald-900"}`}>
                          {pipelineDraftIssue ? "Pipeline is not ready yet" : "Ready to create pipeline"}
                        </p>
                        <p className={`mt-1 text-xs ${pipelineDraftIssue ? "text-amber-800" : "text-emerald-800"}`}>
                          {pipelineDraftIssue || `${activePipelineDraftStages.length} active stages will be created in ${pipelineName.trim()}.`}
                        </p>
                      </div>
                      <div className="flex flex-col-reverse gap-2 sm:flex-row">
                        <SecondaryButton onClick={cancelPipelineBuilder} className="w-full sm:w-auto">
                          Cancel
                        </SecondaryButton>
                        <PrimaryButton
                          onClick={createPipeline}
                          disabled={Boolean(pipelineDraftIssue) || saving === "pipeline-template" || saving === "pipeline-blank"}
                          icon={Plus}
                          className="w-full sm:w-auto"
                        >
                          {saving === "pipeline-template" || saving === "pipeline-blank" ? "Creating Pipeline..." : "Create Pipeline"}
                        </PrimaryButton>
                      </div>
                    </div>
                  </div>
                  </>
                  )}

                  <div className={showPipelineBuilder ? "mb-6 border-t border-gray-200 pt-5" : "mb-6"}>
                    <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                      <div>
                        <h3 className="text-base font-bold text-gray-950">Pipeline Manager</h3>
                        <p className="text-sm text-gray-500">Create pipelines, choose one default, or stop old pipelines while keeping history safe.</p>
                      </div>
                      {!showPipelineBuilder && (
                        <PrimaryButton onClick={openPipelineBuilder} icon={Plus}>
                          Create New Pipeline
                        </PrimaryButton>
                      )}
                    </div>
                    <div className="grid gap-3 lg:grid-cols-2">
                      {pipelines.map((pipeline) => {
                        const statusMeta = pipelineStatusMeta(pipeline);
                        return (
                        <div key={pipeline.id} className="rounded-lg border border-gray-200 bg-white p-4">
                          <div className="mb-3 flex items-start justify-between gap-3">
                            <div>
                              <div className="font-bold text-gray-950">{pipeline.name}</div>
                              <div className="mt-1 text-xs text-gray-500">
                                Catalog type: {pipeline.industryKey || "GENERIC"} • {pipeline.stageCount || 0} stages • {pipeline.opportunityCount || 0} opportunities
                              </div>
                            </div>
                            <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statusMeta.className}`}>
                              {statusMeta.label}
                            </span>
                          </div>
                          <p className="mb-3 rounded-md bg-gray-50 px-3 py-2 text-xs leading-relaxed text-gray-600">
                            {statusMeta.help}
                          </p>
                          {pipeline.defaultPipeline && (
                            <p className="mb-3 rounded-md bg-teal-50 px-3 py-2 text-xs leading-relaxed text-teal-800">
                              This is the default pipeline for new opportunities. Create another active pipeline and set it as default before deleting this one.
                            </p>
                          )}
                          <div className="flex flex-wrap gap-2">
                            <SecondaryButton
                              onClick={() => openStageEditor(pipeline)}
                              disabled={saving === `pipeline-${pipeline.id}-stages-load`}
                              icon={SlidersHorizontal}
                            >
                              Manage Stages
                            </SecondaryButton>
                            {!pipeline.defaultPipeline && pipeline.status === "ACTIVE" && (
                              <SecondaryButton onClick={() => setDefaultPipeline(pipeline)} disabled={saving === `pipeline-${pipeline.id}-default`}>
                                Set Default
                              </SecondaryButton>
                            )}
                            <div className="relative">
                              <button
                                type="button"
                                onClick={() => setOpenPipelineMenuId((current) => (current === pipeline.id ? null : pipeline.id))}
                                className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-gray-200 bg-white text-gray-600 hover:border-teal-300 hover:text-teal-700"
                                title="More pipeline actions"
                              >
                                <MoreVertical size={17} />
                              </button>
                              {openPipelineMenuId === pipeline.id && (
                                <div className="absolute right-0 z-20 mt-2 w-56 overflow-hidden rounded-lg border border-gray-200 bg-white py-1 text-sm shadow-lg">
                                  {pipeline.status !== "ARCHIVED" && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setOpenPipelineMenuId(null);
                                        updatePipelineStatus(pipeline, "ARCHIVED");
                                      }}
                                      disabled={saving === `pipeline-${pipeline.id}-ARCHIVED`}
                                      className="block w-full px-3 py-2 text-left text-gray-700 hover:bg-gray-50 disabled:opacity-60"
                                    >
                                      Stop using pipeline
                                      <span className="mt-0.5 block text-xs font-normal text-gray-400">Keep old opportunities safe</span>
                                    </button>
                                  )}
                                  {pipeline.status !== "ACTIVE" && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setOpenPipelineMenuId(null);
                                        updatePipelineStatus(pipeline, "ACTIVE");
                                      }}
                                      disabled={saving === `pipeline-${pipeline.id}-ACTIVE`}
                                      className="block w-full px-3 py-2 text-left text-gray-700 hover:bg-gray-50 disabled:opacity-60"
                                    >
                                      Restore for new work
                                    </button>
                                  )}
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setOpenPipelineMenuId(null);
                                      deletePipeline(pipeline);
                                    }}
                                    disabled={pipeline.defaultPipeline || saving === `pipeline-${pipeline.id}-delete`}
                                    className="block w-full px-3 py-2 text-left text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:text-gray-400 disabled:hover:bg-white"
                                  >
                                    Delete
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                        );
                      })}
                    </div>
                  </div>

                  {stageEditorPipeline && (
                    <div className="mb-6 rounded-lg border border-teal-200 bg-teal-50/40 p-4">
                      <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                        <div>
                          <h3 className="text-base font-bold text-gray-950">Manage Stages: {stageEditorPipeline.name}</h3>
                          <p className="text-sm text-gray-500">Rename, reorder, add, or hide stages. Hidden stages keep existing opportunities and history safe.</p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <SecondaryButton onClick={addEditorStage} icon={Plus}>
                            Add Stage
                          </SecondaryButton>
                          <PrimaryButton
                            onClick={saveEditorStages}
                            disabled={saving === `pipeline-${stageEditorPipeline.id}-stages-save`}
                            icon={Save}
                          >
                            {saving === `pipeline-${stageEditorPipeline.id}-stages-save` ? "Saving..." : "Save Stages"}
                          </PrimaryButton>
                          <SecondaryButton onClick={() => setStageEditorPipeline(null)}>
                            Close
                          </SecondaryButton>
                        </div>
                      </div>

                      {stageEditorStages.length === 0 ? (
                        <div className="rounded-lg border border-dashed border-teal-300 bg-white p-6 text-center text-sm text-gray-500">
                          No stages yet. Add your first stage to make this pipeline usable.
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {stageEditorStages.map((stage, index) => (
                            <div
                              key={stage._rowId || stage.id || `editor-stage-${index}`}
                              onDragOver={(event) => event.preventDefault()}
                              onDrop={() => {
                                reorderEditorStage(draggingEditorStageIndex, index);
                                setDraggingEditorStageIndex(null);
                              }}
                              className={`grid gap-3 rounded-lg border p-3 transition md:grid-cols-[44px_70px_1fr_1.2fr_120px_auto] ${
                                draggingEditorStageIndex === index
                                  ? "border-teal-300 bg-teal-50"
                                  : "border-gray-200 bg-white"
                              } ${stage.active === false ? "opacity-60" : ""}`}
                            >
                              <div className="flex items-end">
                                <button
                                  type="button"
                                  draggable
                                  onDragStart={() => setDraggingEditorStageIndex(index)}
                                  onDragEnd={() => setDraggingEditorStageIndex(null)}
                                  className="flex min-h-10 w-9 cursor-grab items-center justify-center rounded-md border border-gray-200 bg-white text-gray-400 active:cursor-grabbing hover:border-teal-300 hover:text-teal-700"
                                  title="Drag to reorder"
                                >
                                  <GripVertical size={16} />
                                </button>
                              </div>
                              <div>
                                <FieldLabel>Order</FieldLabel>
                                <TextInput type="number" value={index + 1} readOnly className="bg-white" />
                              </div>
                              <div>
                                <FieldLabel>Stage name</FieldLabel>
                                <TextInput
                                  value={stage.label}
                                  onChange={(event) => setEditorStageValue(index, "label", event.target.value)}
                                  placeholder="Follow Up"
                                />
                              </div>
                              <div>
                                <FieldLabel>Stage key</FieldLabel>
                                <TextInput
                                  value={stage.stageKey}
                                  onChange={(event) => setEditorStageValue(index, "stageKey", event.target.value)}
                                  placeholder="FOLLOW_UP"
                                  readOnly={Boolean(stage.id)}
                                  className={stage.id ? "bg-gray-50" : ""}
                                />
                              </div>
                              <div>
                                <FieldLabel>Availability</FieldLabel>
                                <SelectInput
                                  value={stage.active === false ? "HIDDEN" : "AVAILABLE"}
                                  onChange={(event) => setEditorStageValue(index, "active", event.target.value === "AVAILABLE")}
                                >
                                  <option value="AVAILABLE">Available</option>
                                  <option value="HIDDEN">Hidden</option>
                                </SelectInput>
                              </div>
                              <div className="flex items-end">
                                {stage.id ? (
                                  <span className="flex min-h-10 items-center px-2 text-xs font-medium text-gray-400">
                                    {stage.active === false ? "Can be restored" : "Saved stage"}
                                  </span>
                                ) : (
                                  <SecondaryButton
                                    type="button"
                                    onClick={() => removeEditorStage(index)}
                                    icon={Trash2}
                                    className="w-full md:w-auto"
                                  >
                                    Discard
                                  </SecondaryButton>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                </section>
              </div>
            )}

            {activeTab === "fields" && (
              <div className="grid gap-6 xl:grid-cols-[minmax(0,420px)_1fr]">
                <section className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
                  <div className="mb-5 flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-md bg-cyan-50 text-cyan-700">
                      <SlidersHorizontal size={20} />
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-gray-950">Custom Field</h3>
                      <p className="text-sm text-gray-500">Create reusable contact fields for any industry.</p>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <FieldLabel>Field key</FieldLabel>
                      <TextInput
                        value={fieldForm.fieldKey}
                        onChange={(event) => setFieldFormValue("fieldKey", event.target.value)}
                        placeholder="budget"
                      />
                    </div>
                    <div>
                      <FieldLabel>Label</FieldLabel>
                      <TextInput
                        value={fieldForm.label}
                        onChange={(event) => setFieldFormValue("label", event.target.value)}
                        placeholder="Budget"
                      />
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div>
                        <FieldLabel>Type</FieldLabel>
                        <SelectInput
                          value={fieldForm.type}
                          onChange={(event) => setFieldFormValue("type", event.target.value)}
                        >
                          {FIELD_TYPES.map((type) => (
                            <option key={type} value={type}>
                              {type}
                            </option>
                          ))}
                        </SelectInput>
                      </div>
                      <div>
                        <FieldLabel>Order</FieldLabel>
                        <TextInput
                          type="number"
                          value={fieldForm.displayOrder}
                          onChange={(event) => setFieldFormValue("displayOrder", Number(event.target.value))}
                        />
                      </div>
                    </div>
                    {fieldForm.type === "DROPDOWN" && (
                      <div>
                        <FieldLabel>Options</FieldLabel>
                        <TextInput
                          value={fieldForm.optionsJson}
                          onChange={(event) => setFieldFormValue("optionsJson", event.target.value)}
                          placeholder="Flat, Villa, Plot"
                        />
                      </div>
                    )}
                    <div className="flex flex-wrap gap-4">
                      <label className="flex items-center gap-2 text-sm text-gray-700">
                        <input
                          type="checkbox"
                          checked={fieldForm.required}
                          onChange={(event) => setFieldFormValue("required", event.target.checked)}
                        />
                        Required
                      </label>
                      <label className="flex items-center gap-2 text-sm text-gray-700">
                        <input
                          type="checkbox"
                          checked={fieldForm.active}
                          onChange={(event) => setFieldFormValue("active", event.target.checked)}
                        />
                        Active
                      </label>
                    </div>
                    <PrimaryButton onClick={saveField} disabled={saving === "field"} icon={Save} className="w-full">
                      {saving === "field" ? "Saving..." : "Save Field"}
                    </PrimaryButton>
                  </div>
                </section>

                <section className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
                  <h3 className="mb-1 text-base font-bold text-gray-950">Configured Fields</h3>
                  <p className="mb-5 text-sm text-gray-500">The contact form can render these fields dynamically.</p>
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[760px] text-sm">
                      <thead>
                        <tr className="border-b border-gray-200 bg-gray-50">
                          <th className="px-4 py-3 text-left font-semibold text-gray-700">Order</th>
                          <th className="px-4 py-3 text-left font-semibold text-gray-700">Key</th>
                          <th className="px-4 py-3 text-left font-semibold text-gray-700">Label</th>
                          <th className="px-4 py-3 text-left font-semibold text-gray-700">Type</th>
                          <th className="px-4 py-3 text-left font-semibold text-gray-700">Rules</th>
                          <th className="px-4 py-3 text-left font-semibold text-gray-700">Options</th>
                          <th className="px-4 py-3 text-right font-semibold text-gray-700">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {fields.length === 0 && (
                          <tr>
                            <td colSpan={7} className="px-4 py-8 text-center text-gray-400">
                              No custom fields configured
                            </td>
                          </tr>
                        )}
                        {fields.map((field, index) => (
                          <tr
                            key={field.id}
                            onDragOver={(event) => event.preventDefault()}
                            onDrop={() => {
                              reorderField(draggingFieldIndex, index);
                              setDraggingFieldIndex(null);
                            }}
                            className={`border-b border-gray-100 last:border-0 ${
                              draggingFieldIndex === index ? "bg-teal-50" : "bg-white"
                            }`}
                          >
                            <td className="px-4 py-3 text-gray-700">
                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  draggable
                                  onDragStart={() => setDraggingFieldIndex(index)}
                                  onDragEnd={() => setDraggingFieldIndex(null)}
                                  disabled={saving === "field-order"}
                                  className="inline-flex h-8 w-8 cursor-grab items-center justify-center rounded-md border border-gray-200 bg-white text-gray-400 hover:border-teal-300 hover:text-teal-700 active:cursor-grabbing disabled:cursor-not-allowed disabled:opacity-60"
                                  title="Drag to reorder"
                                >
                                  <GripVertical size={15} />
                                </button>
                                <span>{field.displayOrder}</span>
                              </div>
                            </td>
                            <td className="px-4 py-3 font-medium text-gray-950">{field.fieldKey}</td>
                            <td className="px-4 py-3 text-gray-700">{field.label}</td>
                            <td className="px-4 py-3 text-gray-700">{field.type}</td>
                            <td className="px-4 py-3 text-gray-700">
                              {[field.required ? "Required" : null, field.active ? "Active" : "Inactive"]
                                .filter(Boolean)
                                .join(" • ")}
                            </td>
                            <td className="max-w-xs truncate px-4 py-3 text-gray-600">{field.optionsJson || "—"}</td>
                            <td className="px-4 py-3 text-right">
                              <button
                                type="button"
                                onClick={() => deleteField(field)}
                                disabled={saving === `field-delete-${field.id}` || saving === "field-order"}
                                className="inline-flex items-center gap-2 rounded-md border border-red-200 px-3 py-2 text-xs font-semibold text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                              >
                                <Trash2 size={14} />
                                {saving === `field-delete-${field.id}` ? "Deleting..." : "Delete"}
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              </div>
            )}

            {activeTab === "website-widget" && (
              <div className="grid min-w-0 gap-6 xl:grid-cols-[minmax(0,400px)_minmax(0,1fr)]">
                <section className="min-w-0 rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
                  <div className="mb-5 flex items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-indigo-50 text-indigo-700">
                      <Globe2 size={20} />
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-base font-bold text-gray-950">Website Lead Widget</h3>
                      <p className="text-sm text-gray-500">Capture form submissions from customer websites.</p>
                    </div>
                  </div>

                  <div className={`mb-5 rounded-lg border p-4 ${
                    crmSettings?.widgetEnabled ? "border-emerald-100 bg-emerald-50" : "border-gray-200 bg-gray-50"
                  }`}>
                    <div className="flex flex-col gap-3">
                      <div className="min-w-0">
                        <div className="text-sm font-bold text-gray-950">
                          {crmSettings?.widgetEnabled ? "Widget Active" : "Widget Disabled"}
                        </div>
                        <p className="mt-1 text-xs text-gray-600">
                          When active, valid website submissions create or update contacts in this tenant.
                        </p>
                      </div>
                      <SecondaryButton
                        onClick={toggleWebsiteWidget}
                        disabled={saving === "website-widget"}
                        icon={Power}
                        className={`w-full ${
                          crmSettings?.widgetEnabled
                            ? "border-red-200 text-red-700 hover:bg-red-50"
                            : "border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                        }`}
                      >
                        {saving === "website-widget"
                          ? "Saving..."
                          : crmSettings?.widgetEnabled
                            ? "Disable"
                            : "Enable"}
                      </SecondaryButton>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <FieldLabel>Tenant key</FieldLabel>
                      <TextInput value={crmSettings?.widgetTenantKey || ""} readOnly className="bg-gray-50 font-mono text-xs" />
                    </div>
                    <div>
                      <FieldLabel>Public key</FieldLabel>
                      <TextInput value={crmSettings?.widgetPublicKey || ""} readOnly className="bg-gray-50 font-mono text-xs" />
                    </div>
                    <PrimaryButton onClick={copyWebsiteWidgetScript} icon={Copy} className="w-full">
                      Copy Script
                    </PrimaryButton>
                  </div>
                </section>

                <section className="min-w-0 rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
                  <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div>
                      <h3 className="text-base font-bold text-gray-950">Install Script</h3>
                      <p className="text-sm text-gray-500">Paste this before the closing body tag on the customer website.</p>
                    </div>
                  </div>
                  <pre className="mb-5 max-w-full whitespace-pre-wrap break-all rounded-lg border border-gray-200 bg-gray-950 p-4 text-xs leading-relaxed text-gray-50">
                    {websiteWidgetScript || "Loading widget script..."}
                  </pre>

                  <div className="grid gap-3 md:grid-cols-3">
                    <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                      <div className="text-sm font-bold text-gray-950">1. Detect Form</div>
                      <p className="mt-1 text-xs leading-relaxed text-gray-600">
                        The widget listens to normal website form submissions without changing the website design.
                      </p>
                    </div>
                    <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                      <div className="text-sm font-bold text-gray-950">2. Create Lead</div>
                      <p className="mt-1 text-xs leading-relaxed text-gray-600">
                        Phone or email is matched. Existing contacts update; new contacts are created as website leads.
                      </p>
                    </div>
                    <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                      <div className="text-sm font-bold text-gray-950">3. Trigger CRM</div>
                      <p className="mt-1 text-xs leading-relaxed text-gray-600">
                        New contacts run assignment rules and contact-created automations automatically.
                      </p>
                    </div>
                  </div>

                  <div className="mt-5 rounded-lg border border-amber-100 bg-amber-50 p-4 text-sm leading-relaxed text-amber-900">
                    Required field: at least one phone or email field. Common names like name, phone, mobile, whatsapp, email, city, and location are recognized automatically.
                  </div>

                  <div className="mt-6 border-t border-gray-200 pt-5">
                    <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <h3 className="text-base font-bold text-gray-950">Recent Captures</h3>
                        <p className="text-sm text-gray-500">Latest website form submissions received by this tenant.</p>
                      </div>
                      <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-bold text-gray-600">
                        {websiteCaptures.length} shown
                      </span>
                    </div>
                    <div className="max-w-full overflow-x-auto rounded-lg border border-gray-200">
                      <table className="w-full min-w-[840px] text-sm">
                        <thead>
                          <tr className="border-b border-gray-200 bg-gray-50">
                            <th className="px-4 py-3 text-left font-semibold text-gray-700">When</th>
                            <th className="px-4 py-3 text-left font-semibold text-gray-700">Source</th>
                            <th className="px-4 py-3 text-left font-semibold text-gray-700">Form</th>
                            <th className="px-4 py-3 text-left font-semibold text-gray-700">Status</th>
                            <th className="px-4 py-3 text-left font-semibold text-gray-700">Contact</th>
                            <th className="px-4 py-3 text-left font-semibold text-gray-700">Opportunity</th>
                          </tr>
                        </thead>
                        <tbody>
                          {websiteCaptures.length === 0 && (
                            <tr>
                              <td colSpan={6} className="px-4 py-8 text-center text-gray-400">
                                No website captures yet
                              </td>
                            </tr>
                          )}
                          {websiteCaptures.map((capture) => (
                            <tr key={capture.id} className="border-b border-gray-100 last:border-0">
                              <td className="px-4 py-3 text-gray-600">
                                {capture.createdAt ? new Date(capture.createdAt).toLocaleString() : "—"}
                              </td>
                              <td className="px-4 py-3">
                                <div className="font-semibold text-gray-950">{capture.sourceDomain || "Website"}</div>
                                <div className="max-w-xs truncate text-xs text-gray-500">{capture.pageUrl || capture.pageTitle || "—"}</div>
                              </td>
                              <td className="px-4 py-3 text-gray-700">{capture.formName || capture.formId || "Form"}</td>
                              <td className="px-4 py-3">
                                <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${
                                  capture.status === "FAILED" ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-700"
                                }`}>
                                  {capture.status || "RECEIVED"}
                                </span>
                                {capture.errorMessage && (
                                  <div className="mt-1 max-w-xs truncate text-xs text-red-600">{capture.errorMessage}</div>
                                )}
                              </td>
                              <td className="px-4 py-3 font-semibold text-gray-800">
                                {capture.contactId ? `#${capture.contactId}` : "—"}
                              </td>
                              <td className="px-4 py-3 font-semibold text-gray-800">
                                {capture.opportunityId ? `#${capture.opportunityId}` : "—"}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </section>
              </div>
            )}

            {activeTab === "email-config" && (
              <div className="grid gap-6 xl:grid-cols-[minmax(0,520px)_1fr]">
                <section className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
                  <div className="mb-5 flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-md bg-emerald-50 text-emerald-700">
                      <Mail size={20} />
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-gray-950">Email Setup</h3>
                      <p className="text-sm text-gray-500">Use Gmail OAuth first, or configure custom domain email in advanced setup.</p>
                    </div>
                  </div>

                  <div className={`mb-5 rounded-lg border p-4 ${
                    emailConfig?.gmailOAuthConnected ? "border-emerald-100 bg-emerald-50" : "border-blue-100 bg-blue-50"
                  }`}>
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h4 className={`text-sm font-bold ${emailConfig?.gmailOAuthConnected ? "text-emerald-950" : "text-blue-950"}`}>
                            Recommended: Gmail / Google Workspace
                          </h4>
                          <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${
                            emailConfig?.gmailOAuthConnected ? "bg-emerald-600 text-white" : "bg-blue-100 text-blue-700"
                          }`}>
                            {emailConfig?.gmailOAuthConnected ? "Connected" : "Not connected"}
                          </span>
                        </div>
                        <p className={`mt-1 text-xs ${emailConfig?.gmailOAuthConnected ? "text-emerald-700" : "text-blue-700"}`}>
                          {emailConfig?.gmailOAuthConnected
                            ? `Connected as ${emailConfig.gmailOauthEmail || emailConfig.fromEmail}`
                            : "Connect Gmail for sending, replies, and inbox sync without storing a mailbox password."}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <SecondaryButton
                          onClick={connectGmailOAuth}
                          disabled={saving === "gmail-oauth" || saving === "gmail-oauth-disconnect"}
                        >
                          {saving === "gmail-oauth" ? "Starting..." : emailConfig?.gmailOAuthConnected ? "Switch Gmail Account" : "Connect Gmail"}
                        </SecondaryButton>
                        {emailConfig?.gmailOAuthConnected && (
                          <button
                            type="button"
                            onClick={disconnectGmailOAuth}
                            disabled={saving === "gmail-oauth-disconnect" || saving === "gmail-oauth"}
                            className="inline-flex min-h-10 items-center justify-center rounded-lg border border-red-200 bg-white px-4 py-2 text-sm font-semibold text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {saving === "gmail-oauth-disconnect" ? "Disconnecting..." : "Disconnect Gmail"}
                          </button>
                        )}
                      </div>
                    </div>
                    {emailConfig?.gmailOAuthConnected && (
                      <p className="mt-3 rounded-md border border-emerald-100 bg-white/70 px-3 py-2 text-xs text-emerald-800">
                        To use another mailbox, disconnect this Gmail account first or use Switch Gmail Account to authorize a different Google account.
                      </p>
                    )}
                  </div>

                  <div className={`mb-5 rounded-lg border p-4 ${
                    emailConfig?.outlookOAuthConnected ? "border-emerald-100 bg-emerald-50" : "border-sky-100 bg-sky-50"
                  }`}>
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h4 className={`text-sm font-bold ${emailConfig?.outlookOAuthConnected ? "text-emerald-950" : "text-sky-950"}`}>
                            Recommended: Microsoft 365 / Outlook
                          </h4>
                          <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${
                            emailConfig?.outlookOAuthConnected ? "bg-emerald-600 text-white" : "bg-sky-100 text-sky-700"
                          }`}>
                            {emailConfig?.outlookOAuthConnected ? "Connected" : "Not connected"}
                          </span>
                        </div>
                        <p className={`mt-1 text-xs ${emailConfig?.outlookOAuthConnected ? "text-emerald-700" : "text-sky-700"}`}>
                          {emailConfig?.outlookOAuthConnected
                            ? `Connected as ${emailConfig.outlookOauthEmail || emailConfig.fromEmail}`
                            : "Connect Outlook with Microsoft Graph. This works when SMTP AUTH is blocked by Microsoft security defaults."}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <SecondaryButton
                          onClick={connectOutlookOAuth}
                          disabled={saving === "outlook-oauth" || saving === "outlook-oauth-disconnect"}
                        >
                          {saving === "outlook-oauth" ? "Starting..." : emailConfig?.outlookOAuthConnected ? "Switch Microsoft Account" : "Connect Microsoft 365"}
                        </SecondaryButton>
                        {emailConfig?.outlookOAuthConnected && (
                          <button
                            type="button"
                            onClick={disconnectOutlookOAuth}
                            disabled={saving === "outlook-oauth-disconnect" || saving === "outlook-oauth"}
                            className="inline-flex min-h-10 items-center justify-center rounded-lg border border-red-200 bg-white px-4 py-2 text-sm font-semibold text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {saving === "outlook-oauth-disconnect" ? "Disconnecting..." : "Disconnect Microsoft 365"}
                          </button>
                        )}
                      </div>
                    </div>
                    {emailConfig?.outlookOAuthConnected && (
                      <p className="mt-3 rounded-md border border-emerald-100 bg-white/70 px-3 py-2 text-xs text-emerald-800">
                        Sending and inbox sync will use Microsoft Graph, so SMTP AUTH does not need to be enabled for this mailbox.
                      </p>
                    )}
                  </div>

                  <div className="mb-5 rounded-lg border border-gray-200 bg-gray-50 p-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <h4 className="text-sm font-bold text-gray-950">Custom Domain Email</h4>
                        <p className="mt-1 text-xs text-gray-500">
                          Use this for Zoho, Hostinger, cPanel, Microsoft 365, or any mailbox with SMTP and IMAP credentials.
                        </p>
                      </div>
                      <SecondaryButton onClick={() => setShowAdvancedEmail((current) => !current)}>
                        {showAdvancedEmail ? "Hide Advanced" : "Advanced SMTP/IMAP"}
                      </SecondaryButton>
                    </div>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <FieldLabel>Provider</FieldLabel>
                      <SelectInput
                        value={emailConfigForm.provider}
                        onChange={(event) => setEmailConfigValue("provider", event.target.value)}
                      >
                        <option value="SMTP">SMTP</option>
                        <option value="GMAIL_OAUTH">Gmail OAuth</option>
                        <option value="OUTLOOK_OAUTH">Microsoft 365 OAuth</option>
                      </SelectInput>
                    </div>
                    <div>
                      <FieldLabel>From email</FieldLabel>
                      <TextInput
                        value={emailConfigForm.fromEmail || ""}
                        onChange={(event) => setEmailConfigValue("fromEmail", event.target.value)}
                        placeholder="sales@company.com"
                      />
                    </div>
                    <div>
                      <FieldLabel>From name</FieldLabel>
                      <TextInput
                        value={emailConfigForm.fromName || ""}
                        onChange={(event) => setEmailConfigValue("fromName", event.target.value)}
                        placeholder="Sales Team"
                      />
                    </div>
                  </div>

                  {showAdvancedEmail && (
                    <div className="mt-5 grid gap-4 border-t border-gray-100 pt-5 sm:grid-cols-2">
                    <div>
                      <FieldLabel>SMTP port</FieldLabel>
                      <TextInput
                        type="number"
                        value={emailConfigForm.smtpPort || ""}
                        onChange={(event) => setEmailConfigValue("smtpPort", Number(event.target.value))}
                      />
                    </div>
                    <div>
                      <FieldLabel>SMTP host</FieldLabel>
                      <TextInput
                        value={emailConfigForm.smtpHost || ""}
                        onChange={(event) => setEmailConfigValue("smtpHost", event.target.value)}
                        placeholder="smtp.gmail.com"
                      />
                    </div>
                    <div>
                      <FieldLabel>SMTP username</FieldLabel>
                      <TextInput
                        value={emailConfigForm.smtpUsername || ""}
                        onChange={(event) => setEmailConfigValue("smtpUsername", event.target.value)}
                        placeholder="sales@company.com"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <FieldLabel>SMTP password</FieldLabel>
                      <TextInput
                        type="password"
                        value={emailConfigForm.smtpPassword || ""}
                        onChange={(event) => setEmailConfigValue("smtpPassword", event.target.value)}
                        placeholder={emailConfig?.hasSmtpPassword ? "Password already saved" : "App password"}
                      />
                    </div>
                    <div className="sm:col-span-2 border-t border-gray-100 pt-4">
                      <h4 className="text-sm font-bold text-gray-900">Incoming Email Sync</h4>
                      <p className="mt-1 text-xs text-gray-500">
                        Use IMAP for Gmail or other mailboxes. Gmail usually needs an app password.
                      </p>
                    </div>
                    <div>
                      <FieldLabel>IMAP host</FieldLabel>
                      <TextInput
                        value={emailConfigForm.imapHost || ""}
                        onChange={(event) => setEmailConfigValue("imapHost", event.target.value)}
                        placeholder="imap.gmail.com"
                      />
                    </div>
                    <div>
                      <FieldLabel>IMAP port</FieldLabel>
                      <TextInput
                        type="number"
                        value={emailConfigForm.imapPort || ""}
                        onChange={(event) => setEmailConfigValue("imapPort", Number(event.target.value))}
                      />
                    </div>
                    <div>
                      <FieldLabel>IMAP username</FieldLabel>
                      <TextInput
                        value={emailConfigForm.imapUsername || ""}
                        onChange={(event) => setEmailConfigValue("imapUsername", event.target.value)}
                        placeholder="sales@company.com"
                      />
                    </div>
                    <div>
                      <FieldLabel>IMAP folder</FieldLabel>
                      <TextInput
                        value={emailConfigForm.imapFolder || ""}
                        onChange={(event) => setEmailConfigValue("imapFolder", event.target.value)}
                        placeholder="INBOX"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <FieldLabel>IMAP password</FieldLabel>
                      <TextInput
                        type="password"
                        value={emailConfigForm.imapPassword || ""}
                        onChange={(event) => setEmailConfigValue("imapPassword", event.target.value)}
                        placeholder={emailConfig?.hasImapPassword ? "Password already saved" : "App password"}
                      />
                    </div>
                    </div>
                  )}

                  <div className="mt-4 flex flex-wrap gap-4">
                    <label className="flex items-center gap-2 text-sm text-gray-700">
                      <input
                        type="checkbox"
                        checked={emailConfigForm.imapSsl}
                        onChange={(event) => setEmailConfigValue("imapSsl", event.target.checked)}
                      />
                      IMAP SSL
                    </label>
                    <label className="flex items-center gap-2 text-sm text-gray-700">
                      <input
                        type="checkbox"
                        checked={emailConfigForm.useTls}
                        onChange={(event) => setEmailConfigValue("useTls", event.target.checked)}
                      />
                      Use TLS
                    </label>
                    <label className="flex items-center gap-2 text-sm text-gray-700">
                      <input
                        type="checkbox"
                        checked={emailConfigForm.active}
                        onChange={(event) => setEmailConfigValue("active", event.target.checked)}
                      />
                      Active
                    </label>
                  </div>

                  {emailConnectionTest && (
                    <div className="mt-5 grid gap-3 sm:grid-cols-2">
                      <div className={`rounded-lg border p-3 text-sm ${emailConnectionTest.smtpOk ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-red-200 bg-red-50 text-red-700"}`}>
                        <strong>Sending:</strong> {emailConnectionTest.smtpMessage}
                      </div>
                      <div className={`rounded-lg border p-3 text-sm ${emailConnectionTest.imapOk ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-red-200 bg-red-50 text-red-700"}`}>
                        <strong>Inbox sync:</strong> {emailConnectionTest.imapMessage}
                      </div>
                    </div>
                  )}

                  <div className="mt-5 grid gap-3 sm:grid-cols-2">
                    <PrimaryButton
                      onClick={saveEmailConfig}
                      disabled={saving === "email-config"}
                      icon={Save}
                      className="w-full"
                    >
                      {saving === "email-config" ? "Saving..." : "Save Email Config"}
                    </PrimaryButton>
                    <SecondaryButton
                      onClick={testEmailConnection}
                      disabled={saving === "email-test-connection" || !emailConfig}
                      className="w-full"
                    >
                      {saving === "email-test-connection" ? "Testing..." : "Test Connection"}
                    </SecondaryButton>
                  </div>
                </section>

                <section className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
                  <h3 className="mb-1 text-base font-bold text-gray-950">Test Email</h3>
                  <p className="mb-5 text-sm text-gray-500">Send a simple message using the saved SMTP configuration.</p>
                  <div className="space-y-4">
                    <div>
                      <FieldLabel>Recipient</FieldLabel>
                      <TextInput
                        type="email"
                        value={testEmailForm.toEmail}
                        onChange={(event) => setTestEmailValue("toEmail", event.target.value)}
                        placeholder="lead@example.com"
                      />
                    </div>
                    <div>
                      <FieldLabel>Subject</FieldLabel>
                      <TextInput
                        value={testEmailForm.subject}
                        onChange={(event) => setTestEmailValue("subject", event.target.value)}
                      />
                    </div>
                    <div>
                      <FieldLabel>Body</FieldLabel>
                      <TextArea
                        rows={6}
                        value={testEmailForm.bodyText}
                        onChange={(event) => setTestEmailValue("bodyText", event.target.value)}
                      />
                    </div>
                    <PrimaryButton
                      onClick={sendTestEmail}
                      disabled={saving === "test-email"}
                      icon={Send}
                      className="w-full"
                    >
                      {saving === "test-email" ? "Sending..." : "Send Test Email"}
                    </PrimaryButton>
                  </div>
                </section>
              </div>
            )}

            {activeTab === "email-templates" && (
              <div className="space-y-6">
                <section className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
                  <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-md bg-indigo-50 text-indigo-700">
                        <FileText size={20} />
                      </div>
                      <div>
                        <h3 className="text-base font-bold text-gray-950">{templateForm.id ? "Edit Email Template" : "Create Email Template"}</h3>
                        <p className="text-sm text-gray-500">Design one reusable email template for manual email, automation, and campaigns.</p>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {templateForm.id && (
                        <span className="rounded-full bg-teal-50 px-3 py-1.5 text-xs font-bold text-teal-700">
                          Editing template #{templateForm.id}
                        </span>
                      )}
                      <SecondaryButton onClick={resetEmailTemplate}>
                        New Template
                      </SecondaryButton>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="grid gap-4 lg:grid-cols-[minmax(220px,320px)_1fr]">
                      <div>
                        <FieldLabel>Template Name</FieldLabel>
                        <TextInput
                          value={templateForm.name}
                          onChange={(event) => setTemplateValue("name", event.target.value)}
                          placeholder="Follow-up after enquiry"
                        />
                      </div>
                      <div>
                        <FieldLabel>Email Subject</FieldLabel>
                        <TextInput
                          value={templateForm.subject}
                          onChange={(event) => setTemplateValue("subject", event.target.value)}
                          placeholder="Your site visit is confirmed"
                        />
                      </div>
                    </div>

                    <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                        <div className="flex rounded-lg bg-white p-1 shadow-sm">
                          <button
                            type="button"
                            onClick={() => setTemplateEditorMode("rich")}
                            className={`rounded-md px-3 py-1.5 text-xs font-bold ${templateEditorMode === "rich" ? "bg-teal-700 text-white" : "text-gray-600 hover:bg-gray-50"}`}
                          >
                            Designer HTML
                          </button>
                          <button
                            type="button"
                            onClick={() => setTemplateEditorMode("text")}
                            className={`rounded-md px-3 py-1.5 text-xs font-bold ${templateEditorMode === "text" ? "bg-teal-700 text-white" : "text-gray-600 hover:bg-gray-50"}`}
                          >
                            Plain Text Fallback
                          </button>
                          <button
                            type="button"
                            onClick={() => setTemplateEditorMode("preview")}
                            className={`rounded-md px-3 py-1.5 text-xs font-bold ${templateEditorMode === "preview" ? "bg-teal-700 text-white" : "text-gray-600 hover:bg-gray-50"}`}
                          >
                            Preview
                          </button>
                        </div>
                        <p className="w-full rounded-lg border border-teal-100 bg-teal-50 px-3 py-2 text-xs font-semibold text-teal-800 lg:w-auto">
                          Designer HTML is the main email body used by compose, automation, and test send. Plain text is only a fallback.
                        </p>
                        <div className="flex flex-wrap gap-1">
                          {["{{contactName}}", "{{contactPhone}}", "{{contactEmail}}", "{{leadSource}}"].map((variable) => (
                            <span
                              key={variable}
                              className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-gray-600 hover:bg-teal-50 hover:text-teal-700"
                            >
                              {variable}
                            </span>
                          ))}
                        </div>
                      </div>

                      {templateEditorMode === "rich" && (
                        <Suspense fallback={<div className="rounded-lg border border-gray-200 bg-white p-8 text-center text-sm font-semibold text-gray-500">Loading email designer...</div>}>
                          <div className="email-designer-scroll">
                            <EmailDesigner
                              key={templateForm.id || "new-template"}
                              subject={templateForm.subject}
                              value={templateForm}
                              onChange={setTemplateDesign}
                              height="720px"
                            />
                          </div>
                        </Suspense>
                      )}

                      {templateEditorMode === "text" && (
                        <TextArea
                          rows={12}
                          value={templateForm.bodyText}
                          onChange={(event) => setTemplateValue("bodyText", event.target.value)}
                          placeholder={"Hello {{contactName}},\n\nThanks for your enquiry. We can help with the next step."}
                        />
                      )}

                      {templateEditorMode === "preview" && (
                        <div className="min-h-72 rounded-lg border border-gray-200 bg-white p-5">
                          <div className="mb-4 border-b border-gray-100 pb-3">
                            <p className="text-xs font-bold uppercase tracking-wide text-gray-500">Subject</p>
                            <p className="mt-1 font-semibold text-gray-950">{templateForm.subject || "No subject"}</p>
                          </div>
                          {templateForm.bodyHtml ? (
                            <iframe
                              title="Email template preview"
                              sandbox="allow-popups allow-popups-to-escape-sandbox"
                              srcDoc={`<!doctype html><html><head><base target="_blank" /><style>body{font-family:Inter,system-ui,sans-serif;font-size:14px;line-height:1.7;color:#1f2937;overflow-wrap:anywhere}img,table{max-width:100%}a{color:#0f766e}</style></head><body>${templateForm.bodyHtml}</body></html>`}
                              className="h-80 w-full rounded-lg border border-gray-100 bg-white"
                            />
                          ) : (
                            <pre className="whitespace-pre-wrap break-words text-sm leading-7 text-gray-700">{templateForm.bodyText || "No body yet"}</pre>
                          )}
                        </div>
                      )}
                    </div>

                    <details className="rounded-lg border border-gray-200 bg-gray-50">
                      <summary className="cursor-pointer px-3 py-2 text-xs font-bold uppercase tracking-wide text-gray-500">
                        Plain text fallback
                      </summary>
                      <div className="border-t border-gray-200 p-3">
                        <TextArea
                          rows={4}
                          value={templateForm.bodyText}
                          onChange={(event) => setTemplateValue("bodyText", event.target.value)}
                          placeholder="Optional fallback for mail clients that do not render HTML."
                        />
                      </div>
                    </details>
                    <label className="flex items-center gap-2 text-sm text-gray-700">
                      <input
                        type="checkbox"
                        checked={templateForm.active}
                        onChange={(event) => setTemplateValue("active", event.target.checked)}
                      />
                      Active
                    </label>
                    <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                      <SecondaryButton onClick={resetEmailTemplate} className="sm:w-auto">
                        Clear Form
                      </SecondaryButton>
                      <PrimaryButton
                        onClick={saveEmailTemplate}
                        disabled={saving === "template"}
                        icon={Save}
                        className="sm:w-auto"
                      >
                        {saving === "template" ? "Saving..." : templateForm.id ? "Update Template" : "Save Template"}
                      </PrimaryButton>
                    </div>
                  </div>
                </section>

                <section className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
                  <div className="mb-5 flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
                    <div>
                      <h3 className="text-base font-bold text-gray-950">Created Email Templates</h3>
                      <p className="mt-1 text-sm text-gray-500">Saved templates appear here one by one. Use Edit to load a template into the full-width designer above.</p>
                    </div>
                    <span className="text-xs font-bold uppercase tracking-wide text-gray-400">{emailTemplates.length} templates</span>
                  </div>
                  <div className="space-y-3">
                    {emailTemplates.length === 0 && (
                      <div className="rounded-lg border border-dashed border-gray-300 p-8 text-center text-sm text-gray-400">
                        No email templates available
                      </div>
                    )}
                    {emailTemplates.map((template) => (
                      <article key={template.id} className={`rounded-lg border p-4 ${templateForm.id === template.id ? "border-teal-300 bg-teal-50/50" : "border-gray-200 bg-white"}`}>
                        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <h4 className="font-semibold text-gray-950">{template.name}</h4>
                              <span className="w-fit rounded-full bg-gray-100 px-2.5 py-1 text-xs font-semibold text-gray-700">
                                Generic
                              </span>
                              <span className={`w-fit rounded-full px-2.5 py-1 text-xs font-semibold ${template.active === false ? "bg-gray-100 text-gray-500" : "bg-emerald-50 text-emerald-700"}`}>
                                {template.active === false ? "Inactive" : "Active"}
                              </span>
                              {templateForm.id === template.id && (
                                <span className="w-fit rounded-full bg-teal-100 px-2.5 py-1 text-xs font-semibold text-teal-700">
                                  Currently editing
                                </span>
                              )}
                            </div>
                            <p className="mt-1 break-words text-sm font-medium text-gray-700">{template.subject || "No subject"}</p>
                            <p className="mt-3 line-clamp-2 whitespace-pre-wrap text-sm leading-6 text-gray-500">
                              {(template.bodyText || template.bodyHtml || "No body").replace(/<[^>]+>/g, " ")}
                            </p>
                          </div>
                          <div className="flex flex-wrap justify-start gap-2 lg:justify-end">
                            <button type="button" onClick={() => editEmailTemplate(template)} className="rounded-md border border-gray-300 bg-white px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50">
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => deleteEmailTemplate(template)}
                              disabled={saving === `template-delete-${template.id}`}
                              className="rounded-md border border-red-200 bg-white px-3 py-2 text-xs font-semibold text-red-600 hover:bg-red-50 disabled:opacity-60"
                            >
                              {saving === `template-delete-${template.id}` ? "Deleting..." : "Delete"}
                            </button>
                          </div>
                        </div>
                      </article>
                    ))}
                  </div>
                </section>
              </div>
            )}
          </>
        )}
        <PlanUpgradePrompt
          open={upgradePrompt.open}
          message={upgradePrompt.message}
          onClose={() => setUpgradePrompt({ open: false, message: "" })}
        />
      </div>
    </div>
  );
}
