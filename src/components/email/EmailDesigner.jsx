import { useEffect, useMemo, useRef } from "react";
import { BasicType, BlockManager, JsonToMjml } from "easy-email-core";
import { AvailableTools, EmailEditor, EmailEditorProvider } from "easy-email-editor";
import { SimpleLayout } from "easy-email-extensions";
import mjml from "mjml-browser";
import api from "../../api/axios";
import "@arco-design/web-react/dist/css/arco.css";
import "easy-email-editor/lib/style.css";
import "easy-email-extensions/lib/style.css";
import "./emailDesigner.css";

const MERGE_TAGS = [
  "{{contactName}}",
  "{{contactPhone}}",
  "{{contactEmail}}",
  "{{leadSource}}",
  "{{opportunityName}}",
  "{{pipelineName}}",
  "{{appointmentDate}}",
  "{{agentName}}",
];

const defaultText = `
  <p>Hello {{contactName}},</p>
  <p>Thanks for your enquiry. We can help with the next step.</p>
`;

function createDefaultContent(bodyHtml = defaultText) {
  const pageBlock = BlockManager.getBlockByType(BasicType.PAGE);
  const sectionBlock = BlockManager.getBlockByType(BasicType.SECTION);
  const columnBlock = BlockManager.getBlockByType(BasicType.COLUMN);
  const textBlock = BlockManager.getBlockByType(BasicType.TEXT);

  if (!pageBlock || !sectionBlock || !columnBlock || !textBlock) {
    throw new Error("Easy Email blocks are not available");
  }

  return pageBlock.create({
    attributes: {
      width: "600px",
      "background-color": "#f6f8fb",
    },
    children: [
      sectionBlock.create({
        attributes: {
          padding: "24px 0px",
        },
        children: [
          columnBlock.create({
            attributes: {
              padding: "0px",
            },
            children: [
              textBlock.create({
                data: {
                  value: {
                    content: bodyHtml,
                  },
                },
                attributes: {
                  color: "#1f2937",
                  "font-size": "15px",
                  "line-height": "24px",
                  padding: "20px",
                },
              }),
            ],
          }),
        ],
      }),
    ],
  });
}

export function parseEmailDesign(designJson, bodyHtml = "") {
  if (designJson) {
    try {
      const parsed = JSON.parse(designJson);
      if (parsed?.content) return parsed;
    } catch {
      // Fall back to a starter design if older templates have invalid JSON.
    }
  }

  return {
    subject: "",
    subTitle: "",
    content: createDefaultContent(bodyHtml || defaultText),
  };
}

export function renderEmailDesign(design) {
  if (!design?.content) {
    return { designJson: "", mjml: "", bodyHtml: "" };
  }

  const mjmlOutput = JsonToMjml({
    data: design.content,
    mode: "production",
    beautify: true,
  });
  const htmlOutput = mjml(mjmlOutput, { validationLevel: "soft" })?.html || "";

  return {
    designJson: JSON.stringify(design),
    mjml: mjmlOutput,
    bodyHtml: htmlOutput,
  };
}

function DesignerContent({ values, onChange }) {
  const lastPayloadRef = useRef("");

  const syncDesign = () => {
    const payload = renderEmailDesign(values);
    if (!payload.bodyHtml && !payload.designJson) return;
    const signature = payload.designJson;
    if (lastPayloadRef.current === signature) return;
    lastPayloadRef.current = signature;
    onChange?.({ ...payload, design: values });
  };

  useEffect(() => {
    const timeout = window.setTimeout(syncDesign, 300);
    return () => window.clearTimeout(timeout);
  });

  return (
    <>
      <SimpleLayout showSourceCode={false} defaultShowLayer={false} jsonReadOnly mjmlReadOnly>
        <div onBlur={syncDesign}>
          <EmailEditor />
        </div>
      </SimpleLayout>
      <div className="flex justify-end border-t border-gray-200 bg-gray-50 px-4 py-3">
        <button
          type="button"
          onClick={syncDesign}
          className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-bold text-gray-700 hover:bg-gray-100"
        >
          Sync Design
        </button>
      </div>
    </>
  );
}

async function uploadDesignerImage(file) {
  if (!file) {
    throw new Error("Choose an image first.");
  }

  const formData = new FormData();
  const fileName = file.name || "email-image.png";
  formData.append("file", file, fileName);
  formData.append("name", fileName);
  formData.append("category", "Email");

  const response = await api.post("/api/media-assets", formData);
  const publicUrl = response?.data?.publicUrl;
  if (!publicUrl) {
    throw new Error("Image uploaded, but no public URL was returned.");
  }
  return publicUrl;
}

export default function EmailDesigner({ value, subject, onChange, height = "720px" }) {
  const initialDesign = useMemo(
    () => ({
      ...parseEmailDesign(value?.designJson, value?.bodyHtml),
      subject: subject || "",
    }),
    [value?.designJson, value?.bodyHtml, subject]
  );

  return (
    <div className="email-designer-shell rounded-lg border border-gray-200 bg-white">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-200 bg-gray-50 px-4 py-3">
        <div>
          <h4 className="text-sm font-extrabold text-gray-950">Easy Email Designer</h4>
          <p className="text-xs text-gray-500">Design the email and use the Configuration tab on the right for spacing, colors, images, and block settings.</p>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <div className="flex flex-wrap gap-1">
            {MERGE_TAGS.map((tag) => (
              <span key={tag} className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-gray-600 shadow-sm">
                {tag}
              </span>
            ))}
          </div>
        </div>
      </div>
      <EmailEditorProvider
        data={initialDesign}
        height={height}
        autoComplete={false}
        dashed={false}
        enabledMergeTagsBadge={false}
        enabledLogic={false}
        mergeTags={{}}
        previewInjectData={{}}
        onUploadImage={uploadDesignerImage}
        toolbar={{
          tools: [
            AvailableTools.FontFamily,
            AvailableTools.FontSize,
            AvailableTools.Bold,
            AvailableTools.Italic,
            AvailableTools.StrikeThrough,
            AvailableTools.Underline,
            AvailableTools.IconFontColor,
            AvailableTools.IconBgColor,
            AvailableTools.Link,
            AvailableTools.Justify,
            AvailableTools.Lists,
            AvailableTools.HorizontalRule,
            AvailableTools.RemoveFormat,
          ],
        }}
        onSubmit={() => undefined}
      >
        {(formState) => <DesignerContent values={formState.values || initialDesign} onChange={onChange} />}
      </EmailEditorProvider>
    </div>
  );
}
