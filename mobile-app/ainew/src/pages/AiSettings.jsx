import { useEffect, useMemo, useState } from "react";
import { Bot, CheckCircle2, KeyRound, Sparkles, Wand2 } from "lucide-react";
import api from "../api/axios";

const PROVIDERS = [
  {
    key: "OPENAI",
    name: "OpenAI",
    defaultModel: "gpt-5.4-mini",
    helper: "Strong all-round CRM assistant for summaries, replies, and campaign writing.",
  },
  {
    key: "GEMINI",
    name: "Google Gemini",
    defaultModel: "gemini-2.5-flash",
    helper: "Good low-cost option for fast text generation and Google-first teams.",
  },
  {
    key: "CLAUDE",
    name: "Anthropic Claude",
    defaultModel: "claude-sonnet-4-5",
    helper: "Useful for careful long-form summaries and polished business communication.",
  },
];

const MODEL_OPTIONS = {
  OPENAI: [
    { value: "gpt-5.4-mini", label: "GPT-5.4 mini", helper: "Recommended: low cost and fast for CRM replies." },
    { value: "gpt-5.4-nano", label: "GPT-5.4 nano", helper: "Lowest cost for simple summaries and short replies." },
    { value: "gpt-5.4", label: "GPT-5.4", helper: "More capable for complex writing and longer context." },
    { value: "gpt-5.5", label: "GPT-5.5", helper: "Best quality if your OpenAI account has access." },
  ],
  GEMINI: [
    { value: "gemini-2.5-flash", label: "Gemini 2.5 Flash", helper: "Recommended fast Google model." },
    { value: "gemini-2.5-pro", label: "Gemini 2.5 Pro", helper: "Higher quality for longer reasoning." },
    { value: "gemini-2.0-flash", label: "Gemini 2.0 Flash", helper: "Broad compatibility fallback." },
  ],
  CLAUDE: [
    { value: "claude-sonnet-4-5", label: "Claude Sonnet 4.5", helper: "Recommended balanced Claude model." },
    { value: "claude-opus-4-1", label: "Claude Opus 4.1", helper: "Higher quality for careful long-form work." },
    { value: "claude-haiku-3-5", label: "Claude Haiku 3.5", helper: "Lower cost for short CRM copy." },
  ],
};

const emptySettings = {
  provider: "OPENAI",
  model: "gpt-5.4-mini",
  active: false,
  hasApiKey: false,
};

export default function AiSettings() {
  const [settings, setSettings] = useState(emptySettings);
  const [apiKey, setApiKey] = useState("");
  const [prompt, setPrompt] = useState("Write a friendly follow-up WhatsApp reply for a new real estate lead who asked for pricing.");
  const [result, setResult] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const selectedProvider = useMemo(
    () => PROVIDERS.find((provider) => provider.key === settings.provider) || PROVIDERS[0],
    [settings.provider]
  );

  const modelOptions = MODEL_OPTIONS[selectedProvider.key] || [];
  const selectedModel = modelOptions.find((model) => model.value === settings.model) || modelOptions[0];

  useEffect(() => {
    let cancelled = false;
    api
      .get("/api/ai/settings")
      .then((response) => {
        if (!cancelled) {
          const nextSettings = { ...emptySettings, ...(response.data || {}) };
          const provider = PROVIDERS.find((item) => item.key === nextSettings.provider) || PROVIDERS[0];
          const availableModels = MODEL_OPTIONS[provider.key] || [];
          const validModel = availableModels.some((model) => model.value === nextSettings.model);
          setSettings({
            ...nextSettings,
            provider: provider.key,
            model: validModel ? nextSettings.model : provider.defaultModel,
          });
        }
      })
      .catch((error) => {
        if (!cancelled) setMessage(error?.response?.data?.message || error.message || "Failed to load AI settings");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const setProvider = (provider) => {
    setSettings((current) => ({
      ...current,
      provider: provider.key,
      model: provider.defaultModel,
    }));
  };

  const save = async () => {
    setLoading(true);
    setMessage("");
    try {
      const response = await api.post("/api/ai/settings", {
        provider: settings.provider,
        model: settings.model,
        active: settings.active,
        apiKey: apiKey.trim() || null,
      });
      setSettings({ ...emptySettings, ...(response.data || {}) });
      setApiKey("");
      setMessage("AI settings saved.");
    } catch (error) {
      setMessage(error?.response?.data?.message || error?.response?.data?.error || error.message || "Save failed");
    } finally {
      setLoading(false);
    }
  };

  const testConnection = async () => {
    setLoading(true);
    setResult("");
    setMessage("");
    try {
      const response = await api.post("/api/ai/test");
      setResult(response.data?.text || "AI connection worked.");
      setMessage(`Connected with ${response.data?.provider || settings.provider}`);
    } catch (error) {
      setMessage(error?.response?.data?.message || error?.response?.data?.error || error.message || "AI test failed");
    } finally {
      setLoading(false);
    }
  };

  const generate = async () => {
    if (!prompt.trim()) return;
    setLoading(true);
    setResult("");
    setMessage("");
    try {
      const response = await api.post("/api/ai/generate", {
        prompt,
        purpose: "manual_test",
      });
      setResult(response.data?.text || "");
      setMessage(`Generated with ${response.data?.provider || settings.provider}`);
    } catch (error) {
      setMessage(error?.response?.data?.message || error?.response?.data?.error || error.message || "AI generation failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 p-4 text-slate-950 sm:p-6">
      <div className="mx-auto max-w-6xl space-y-5">
        <header className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.22em] text-teal-700">AI Settings</p>
              <h1 className="mt-2 text-2xl font-black tracking-tight">Choose your CRM AI provider</h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
                Connect OpenAI, Gemini, or Claude at tenant level. Vistaar Flow will use this provider for lead summaries, reply writing, campaign copy, and future AI actions.
              </p>
            </div>
            <div className={`rounded-xl border px-4 py-3 text-sm font-bold ${settings.active ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-amber-200 bg-amber-50 text-amber-800"}`}>
              {settings.active ? "AI Active" : "AI Disabled"} · {settings.hasApiKey ? "Key saved" : "No key saved"}
            </div>
          </div>
        </header>

        {message && (
          <div className="rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 shadow-sm">
            {message}
          </div>
        )}

        <section className="grid gap-4 lg:grid-cols-3">
          {PROVIDERS.map((provider) => {
            const active = settings.provider === provider.key;
            return (
              <button
                key={provider.key}
                type="button"
                onClick={() => setProvider(provider)}
                className={`rounded-xl border bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${
                  active ? "border-teal-500 ring-2 ring-teal-100" : "border-slate-200"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="rounded-lg bg-teal-50 p-2 text-teal-700">
                    <Bot size={20} />
                  </div>
                  {active && <CheckCircle2 className="text-teal-600" size={20} />}
                </div>
                <h2 className="mt-4 text-lg font-black">{provider.name}</h2>
                <p className="mt-2 text-sm leading-6 text-slate-500">{provider.helper}</p>
                <p className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-xs font-bold text-slate-500">
                  Default model: {provider.defaultModel}
                </p>
              </button>
            );
          })}
        </section>

        <section className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_420px]">
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-5 flex items-center gap-2">
              <KeyRound size={18} className="text-teal-700" />
              <h2 className="text-lg font-black">{selectedProvider.name} configuration</h2>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1 block text-xs font-black uppercase tracking-wide text-slate-500">Model</span>
                <select
                  value={settings.model || ""}
                  onChange={(event) => setSettings((current) => ({ ...current, model: event.target.value }))}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
                >
                  {modelOptions.map((model) => (
                    <option key={model.value} value={model.value}>{model.label}</option>
                  ))}
                </select>
                {selectedModel && (
                  <p className="mt-1 text-xs font-semibold leading-5 text-slate-500">
                    {selectedModel.helper}
                  </p>
                )}
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-black uppercase tracking-wide text-slate-500">API key</span>
                <input
                  value={apiKey}
                  onChange={(event) => setApiKey(event.target.value)}
                  placeholder={settings.hasApiKey ? "Saved. Enter new key to replace" : "Paste provider API key"}
                  type="password"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
                />
              </label>
            </div>
            <label className="mt-4 flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm font-semibold text-slate-700">
              <input
                type="checkbox"
                checked={Boolean(settings.active)}
                onChange={(event) => setSettings((current) => ({ ...current, active: event.target.checked }))}
              />
              Enable this AI provider for CRM features
            </label>
            <div className="mt-5 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={save}
                disabled={loading}
                className="rounded-lg bg-teal-700 px-4 py-2 text-sm font-bold text-white hover:bg-teal-800 disabled:opacity-60"
              >
                {loading ? "Saving..." : "Save AI Settings"}
              </button>
              <button
                type="button"
                onClick={testConnection}
                disabled={loading || !settings.active}
                className="rounded-lg border border-teal-200 bg-teal-50 px-4 py-2 text-sm font-bold text-teal-800 hover:bg-teal-100 disabled:opacity-60"
              >
                Test Connection
              </button>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center gap-2">
              <Wand2 size={18} className="text-teal-700" />
              <h2 className="text-lg font-black">Try a CRM prompt</h2>
            </div>
            <textarea
              rows={8}
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm leading-6 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
            />
            <button
              type="button"
              onClick={generate}
              disabled={loading || !settings.active || !prompt.trim()}
              className="mt-3 inline-flex items-center gap-2 rounded-lg bg-slate-950 px-4 py-2 text-sm font-bold text-white hover:bg-slate-800 disabled:opacity-60"
            >
              <Sparkles size={16} />
              Generate
            </button>
          </div>
        </section>

        {result && (
          <section className="rounded-xl border border-teal-100 bg-white p-5 shadow-sm">
            <p className="text-xs font-black uppercase tracking-[0.22em] text-teal-700">AI Result</p>
            <div className="mt-3 whitespace-pre-wrap rounded-lg bg-slate-50 p-4 text-sm leading-6 text-slate-800">
              {result}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
