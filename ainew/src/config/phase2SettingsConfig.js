export const EMPTY_FIELD_FORM = {
  fieldKey: "",
  label: "",
  type: "TEXT",
  optionsJson: "",
  required: false,
  displayOrder: 100,
  active: true,
};

export const EMPTY_STAGE_FORM = {
  stageKey: "",
  label: "",
  displayOrder: 100,
  active: true,
};

export const EMPTY_EMAIL_CONFIG = {
  provider: "SMTP",
  fromEmail: "",
  fromName: "",
  smtpHost: "",
  smtpPort: 587,
  smtpUsername: "",
  smtpPassword: "",
  imapHost: "",
  imapPort: 993,
  imapUsername: "",
  imapPassword: "",
  imapSsl: true,
  imapFolder: "INBOX",
  gmailOauthEmail: "",
  gmailOAuthConnected: false,
  outlookOauthEmail: "",
  outlookOAuthConnected: false,
  useTls: true,
  active: true,
};

export const EMPTY_EMAIL_TEMPLATE = {
  id: null,
  name: "",
  industryKey: "",
  subject: "",
  bodyHtml: "",
  bodyText: "",
  designJson: "",
  mjml: "",
  active: true,
};

export const EMPTY_TEST_EMAIL = {
  toEmail: "",
  subject: "CRM email test",
  bodyText: "Hello {{contactName}}, this is a test email from your CRM.",
};

export const FIELD_TYPES = ["TEXT", "NUMBER", "DATE", "DROPDOWN", "BOOLEAN"];

export function normalizeIndustryLabel(value) {
  if (!value) return "Generic";
  return value
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function normalizeOptionsForSubmit(form) {
  if (form.type !== "DROPDOWN") return "";
  const raw = form.optionsJson.trim();
  if (!raw) return "";
  try {
    const parsed = JSON.parse(raw);
    return JSON.stringify(Array.isArray(parsed) ? parsed : [raw]);
  } catch {
    return JSON.stringify(
      raw
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean)
    );
  }
}
