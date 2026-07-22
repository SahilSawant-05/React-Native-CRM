export const normalizeList = (payload) => {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.items)) return payload.items;
  if (Array.isArray(payload?.content)) return payload.content;
  return [];
};

export const formatDate = (value) => {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleString("en-IN");
};

export const shortDate = (value) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en-IN", { month: "short", day: "numeric" });
};

export const initials = (value) => {
  const clean = String(value || "Mail").trim();
  const base = clean.includes("@") ? clean.split("@")[0] : clean;
  return base
    .split(/[\s._-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("") || "M";
};

export const looksLikeHtml = (value) => /<\/?[a-z][\s\S]*>/i.test(String(value || ""));

export const escapeHtml = (value) =>
  String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

export const plainTextToEmailHtml = (value) =>
  String(value || "")
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
    .map((paragraph) => `<p>${escapeHtml(paragraph).replace(/\n/g, "<br />")}</p>`)
    .join("");

export const textPreview = (value) =>
  String(value || "")
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();

export const emailHtmlDocument = (body) => `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <base target="_blank" />
    <style>
      html, body {
        margin: 0;
        padding: 0;
        background: #ffffff;
        color: #1f2937;
        font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        font-size: 14px;
        line-height: 1.7;
        overflow-wrap: anywhere;
      }
      body { padding: 8px; }
      img, video, table, pre, code {
        max-width: 100% !important;
      }
      img, video {
        height: auto !important;
      }
      table {
        border-collapse: collapse;
        display: block;
        overflow-x: auto;
      }
      a {
        color: #0f766e;
        text-decoration: underline;
        word-break: break-word;
      }
      pre {
        white-space: pre-wrap;
        word-break: break-word;
      }
    </style>
  </head>
  <body>${body || ""}</body>
</html>`;

export const SYNC_STAGES = [
  { key: "CONNECTING", label: "Connecting" },
  { key: "READING", label: "Reading inbox" },
  { key: "IMPORTING", label: "Importing emails" },
  { key: "DONE", label: "Done" },
];
