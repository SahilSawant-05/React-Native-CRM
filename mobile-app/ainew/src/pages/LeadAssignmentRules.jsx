import { useEffect, useMemo, useState } from "react";
import api from "../api/axios";
import { LEAD_SOURCE_OPTIONS } from "../config/leadSources";

const CRITERIA_TYPES = [
  { value: "LEAD_SOURCE", label: "Lead Source" },
  { value: "WEBSITE_DOMAIN", label: "Website Domain" },
  { value: "INDUSTRY", label: "Industry" },
  { value: "CITY", label: "City" },
  { value: "TAG", label: "Tag" },
  { value: "DEFAULT", label: "Default fallback" },
];

const INDUSTRIES = ["REAL_ESTATE", "EDUCATION", "BIKE_SALES", "GENERIC"];

const blankForm = {
  id: null,
  name: "",
  criteriaType: "LEAD_SOURCE",
  criteriaValue: "",
  assignmentStrategy: "ASSIGN_USER",
  assignedUserId: "",
  assignedUserIds: [],
  priority: 100,
  active: true,
};

const inputClass = "w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:border-teal-400 focus:outline-none";

const labelForUser = (user) => user?.email || `User #${user?.id}`;

export default function LeadAssignmentRules() {
  const [rules, setRules] = useState([]);
  const [users, setUsers] = useState([]);
  const [form, setForm] = useState(blankForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [simulating, setSimulating] = useState(false);
  const [simulationInput, setSimulationInput] = useState({
    leadSource: "WEBSITE_FORM",
    leadSourceDetail: "",
    industryKey: "REAL_ESTATE",
    city: "",
    tags: "",
  });
  const [simulationResult, setSimulationResult] = useState(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [websiteQuickRule, setWebsiteQuickRule] = useState({
    domain: "",
    assignmentStrategy: "ROUND_ROBIN",
    assignedUserId: "",
    assignedUserIds: [],
  });

  const assignableUsers = useMemo(
    () => users.filter((user) => ["OWNER", "ADMIN", "AGENT"].includes(String(user.role || "").toUpperCase())),
    [users]
  );

  const loadData = async () => {
    setLoading(true);
    setError("");
    try {
      const [rulesResponse, usersResponse] = await Promise.all([
        api.get("/api/lead-assignment-rules"),
        api.get("/api/users"),
      ]);
      setRules(Array.isArray(rulesResponse.data) ? rulesResponse.data : []);
      setUsers(Array.isArray(usersResponse.data) ? usersResponse.data : []);
    } catch (loadError) {
      setError(loadError.response?.data?.error || "Could not load lead assignment settings.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const setValue = (key, value) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const saveRule = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    setMessage("");

    const payload = {
      name: form.name,
      criteriaType: form.criteriaType,
      criteriaValue: form.criteriaType === "DEFAULT" ? null : form.criteriaValue,
      assignmentStrategy: form.assignmentStrategy,
      assignedUserId: form.assignmentStrategy === "ASSIGN_USER" ? Number(form.assignedUserId) : null,
      assignedUserIds: form.assignmentStrategy === "ROUND_ROBIN" ? form.assignedUserIds.map(Number) : [],
      priority: Number(form.priority) || 100,
      active: form.active,
    };

    try {
      if (form.id) {
        await api.put(`/api/lead-assignment-rules/${form.id}`, payload);
        setMessage("Rule updated.");
      } else {
        await api.post("/api/lead-assignment-rules", payload);
        setMessage("Rule created.");
      }
      setForm(blankForm);
      await loadData();
    } catch (saveError) {
      setError(saveError.response?.data?.error || "Could not save assignment rule.");
    } finally {
      setSaving(false);
    }
  };

  const editRule = (rule) => {
    setForm({
      id: rule.id,
      name: rule.name || "",
      criteriaType: rule.criteriaType || "LEAD_SOURCE",
      criteriaValue: rule.criteriaValue || "",
      assignmentStrategy: rule.assignmentStrategy || "ASSIGN_USER",
      assignedUserId: rule.assignedUserId || "",
      assignedUserIds: (rule.assignedUserIds || []).map(Number),
      priority: rule.priority ?? 100,
      active: rule.active !== false,
    });
  };

  const deleteRule = async (rule) => {
    if (!window.confirm(`Delete assignment rule "${rule.name}"?`)) return;
    try {
      await api.delete(`/api/lead-assignment-rules/${rule.id}`);
      setMessage("Rule deleted.");
      await loadData();
    } catch (deleteError) {
      setError(deleteError.response?.data?.error || "Could not delete rule.");
    }
  };

  const toggleRoundRobinUser = (userId) => {
    setForm((current) => {
      const normalizedUserId = Number(userId);
      const exists = current.assignedUserIds.map(Number).includes(normalizedUserId);
      return {
        ...current,
        assignedUserIds: exists
          ? current.assignedUserIds.filter((id) => Number(id) !== normalizedUserId)
          : [...current.assignedUserIds, normalizedUserId],
      };
    });
  };

  const simulateAssignment = async () => {
    setSimulating(true);
    setError("");
    setSimulationResult(null);
    try {
      const response = await api.post("/api/lead-assignment-rules/simulate", simulationInput);
      setSimulationResult(response.data);
    } catch (simulationError) {
      setError(simulationError.response?.data?.error || "Could not simulate assignment.");
    } finally {
      setSimulating(false);
    }
  };

  const applyWebsiteQuickRule = () => {
    const domain = websiteQuickRule.domain.trim()
      .replace(/^https?:\/\//i, "")
      .replace(/^www\./i, "")
      .split("/")[0]
      .trim();
    if (!domain) {
      setError("Enter website domain first, for example propvisionexpert.in.");
      return;
    }
    if (websiteQuickRule.assignmentStrategy === "ASSIGN_USER" && !websiteQuickRule.assignedUserId) {
      setError("Select the agent who should receive this website lead.");
      return;
    }
    if (websiteQuickRule.assignmentStrategy === "ROUND_ROBIN" && websiteQuickRule.assignedUserIds.length === 0) {
      setError("Select at least one agent for website round-robin.");
      return;
    }
    const selectedUser = users.find((user) => String(user.id) === String(websiteQuickRule.assignedUserId));
    const selectedUsers = websiteQuickRule.assignedUserIds
      .map((id) => users.find((user) => String(user.id) === String(id)))
      .filter(Boolean);
    const targetLabel = websiteQuickRule.assignmentStrategy === "ROUND_ROBIN"
      ? `${selectedUsers.length} agent round-robin`
      : selectedUser?.email || "agent";
    setError("");
    setMessage("Website assignment rule is ready. Review priority, then click Create Rule.");
    setForm({
      ...blankForm,
      name: `${domain} website leads to ${targetLabel}`,
      criteriaType: "WEBSITE_DOMAIN",
      criteriaValue: domain,
      assignmentStrategy: websiteQuickRule.assignmentStrategy,
      assignedUserId: websiteQuickRule.assignmentStrategy === "ASSIGN_USER" ? websiteQuickRule.assignedUserId : "",
      assignedUserIds: websiteQuickRule.assignmentStrategy === "ROUND_ROBIN" ? websiteQuickRule.assignedUserIds : [],
      priority: 10,
      active: true,
    });
    setSimulationInput({
      leadSource: "WEBSITE_FORM",
      leadSourceDetail: `${domain} | Website Form | https://${domain}`,
      industryKey: "",
      city: "",
      tags: "website-lead",
    });
    setSimulationResult(null);
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-6">
      <div className="mb-5">
        <h1 className="text-2xl font-bold text-gray-900">Lead Assignment Rules</h1>
        <p className="mt-1 text-sm text-gray-500">
          Auto-assign new leads by source, industry, city, tag, or fallback round-robin.
        </p>
      </div>

      {error && <div className="mb-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>}
      {message && <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{message}</div>}

      <div className="grid min-w-0 gap-4 xl:grid-cols-[420px_minmax(0,1fr)]">
        <div className="min-w-0 space-y-4">
        <section className="rounded-lg border border-teal-100 bg-teal-50 p-4 shadow-sm">
          <div className="mb-3">
            <h2 className="text-base font-bold text-teal-950">Quick Setup: Website Leads</h2>
            <p className="mt-1 text-sm text-teal-700">
              Route leads from one website domain to one agent or a round-robin pool.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Website Domain">
              <input
                value={websiteQuickRule.domain}
                onChange={(event) => setWebsiteQuickRule((current) => ({ ...current, domain: event.target.value }))}
                className={inputClass}
                placeholder="propvisionexpert.in"
              />
            </Field>
            <Field label="Strategy">
              <select
                value={websiteQuickRule.assignmentStrategy}
                onChange={(event) => setWebsiteQuickRule((current) => ({ ...current, assignmentStrategy: event.target.value }))}
                className={inputClass}
              >
                <option value="ROUND_ROBIN">Round-robin pool</option>
                <option value="ASSIGN_USER">Single agent</option>
              </select>
            </Field>
          </div>
          {websiteQuickRule.assignmentStrategy === "ASSIGN_USER" ? (
            <Field label="Assign To">
              <select
                value={websiteQuickRule.assignedUserId}
                onChange={(event) => setWebsiteQuickRule((current) => ({ ...current, assignedUserId: event.target.value }))}
                className={inputClass}
              >
                <option value="">Select agent</option>
                {assignableUsers.map((user) => <option key={user.id} value={user.id}>{labelForUser(user)} · {user.role}</option>)}
              </select>
            </Field>
          ) : (
            <Field label="Round-robin Agents">
              <div className="max-h-36 space-y-2 overflow-y-auto rounded-lg border border-teal-200 bg-white p-2">
                {assignableUsers.map((user) => {
                  const checked = websiteQuickRule.assignedUserIds.map(Number).includes(Number(user.id));
                  return (
                    <label key={user.id} className="flex items-center gap-2 text-sm text-teal-950">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => setWebsiteQuickRule((current) => ({
                          ...current,
                          assignedUserIds: checked
                            ? current.assignedUserIds.filter((id) => Number(id) !== Number(user.id))
                            : [...current.assignedUserIds, Number(user.id)],
                        }))}
                        className="rounded border-gray-300 text-teal-500"
                      />
                      <span className="min-w-0 break-all">{labelForUser(user)} · {user.role}</span>
                    </label>
                  );
                })}
              </div>
            </Field>
          )}
          <button
            type="button"
            onClick={applyWebsiteQuickRule}
            className="w-full rounded-lg bg-teal-600 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-700"
          >
            Prepare Website Assignment Rule
          </button>
          <p className="mt-2 text-xs text-teal-700">
            This uses Website Domain matching against source detail saved by the website widget.
          </p>
        </section>

        <form onSubmit={saveRule} className="rounded-lg bg-white p-4 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-base font-bold text-gray-900">{form.id ? "Edit Rule" : "New Rule"}</h2>
            {form.id && (
              <button type="button" onClick={() => setForm(blankForm)} className="text-xs font-semibold text-gray-500 hover:text-gray-800">
                Cancel edit
              </button>
            )}
          </div>

          <Field label="Rule Name">
            <input value={form.name} onChange={(event) => setValue("name", event.target.value)} className={inputClass} placeholder="Website leads to Priya" />
          </Field>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Criteria">
              <select value={form.criteriaType} onChange={(event) => setForm((current) => ({ ...current, criteriaType: event.target.value, criteriaValue: "" }))} className={inputClass}>
                {CRITERIA_TYPES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
              </select>
            </Field>
            <Field label="Priority">
              <input type="number" value={form.priority} onChange={(event) => setValue("priority", event.target.value)} className={inputClass} />
            </Field>
          </div>

          {form.criteriaType !== "DEFAULT" && (
            <Field label="Criteria Value">
              {form.criteriaType === "LEAD_SOURCE" ? (
                <select value={form.criteriaValue} onChange={(event) => setValue("criteriaValue", event.target.value)} className={inputClass}>
                  <option value="">Select source</option>
                  {LEAD_SOURCE_OPTIONS.map((source) => <option key={source.value} value={source.value}>{source.label}</option>)}
                </select>
              ) : form.criteriaType === "INDUSTRY" ? (
                <select value={form.criteriaValue} onChange={(event) => setValue("criteriaValue", event.target.value)} className={inputClass}>
                  <option value="">Select industry</option>
                  {INDUSTRIES.map((industry) => <option key={industry} value={industry}>{industry.replaceAll("_", " ")}</option>)}
                </select>
              ) : (
                <input
                  value={form.criteriaValue}
                  onChange={(event) => setValue("criteriaValue", event.target.value)}
                  className={inputClass}
                  placeholder={form.criteriaType === "CITY" ? "Mumbai" : form.criteriaType === "WEBSITE_DOMAIN" ? "example.com" : "hot-lead"}
                />
              )}
            </Field>
          )}

          <Field label="Assignment Strategy">
            <select value={form.assignmentStrategy} onChange={(event) => setValue("assignmentStrategy", event.target.value)} className={inputClass}>
              <option value="ASSIGN_USER">Assign to one user</option>
              <option value="ROUND_ROBIN">Round-robin pool</option>
            </select>
          </Field>

          {form.assignmentStrategy === "ASSIGN_USER" ? (
            <Field label="Assigned User">
              <select value={form.assignedUserId} onChange={(event) => setValue("assignedUserId", event.target.value)} className={inputClass}>
                <option value="">Select user</option>
                {assignableUsers.map((user) => <option key={user.id} value={user.id}>{labelForUser(user)} · {user.role}</option>)}
              </select>
            </Field>
          ) : (
            <Field label="Round-robin Users">
              <div className="max-h-44 space-y-2 overflow-y-auto rounded-lg border border-gray-200 p-2">
                {assignableUsers.map((user) => {
                  const userId = Number(user.id);
                  return (
                    <label key={user.id} className="flex items-center gap-2 text-sm text-gray-700">
                      <input
                        type="checkbox"
                        checked={form.assignedUserIds.map(Number).includes(userId)}
                        onChange={() => toggleRoundRobinUser(userId)}
                        className="rounded border-gray-300 text-teal-500"
                      />
                      <span className="min-w-0 break-all">{labelForUser(user)} · {user.role}</span>
                    </label>
                  );
                })}
              </div>
            </Field>
          )}

          <label className="mb-4 flex items-center gap-2 text-sm font-semibold text-gray-700">
            <input type="checkbox" checked={form.active} onChange={(event) => setValue("active", event.target.checked)} className="rounded border-gray-300 text-teal-500" />
            Active
          </label>

          <button type="submit" disabled={saving} className="w-full rounded-lg bg-teal-500 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-600 disabled:bg-teal-300">
            {saving ? "Saving..." : form.id ? "Update Rule" : "Create Rule"}
          </button>
        </form>

        <section className="rounded-lg bg-white p-4 shadow-sm">
          <div className="mb-4">
            <h2 className="text-base font-bold text-gray-900">Simulate Assignment</h2>
            <p className="mt-1 text-sm text-gray-500">Test existing active rules before saving or changing priority.</p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Lead Source">
              <select value={simulationInput.leadSource} onChange={(event) => setSimulationInput((current) => ({ ...current, leadSource: event.target.value }))} className={inputClass}>
                <option value="">Any / blank</option>
                {LEAD_SOURCE_OPTIONS.map((source) => <option key={source.value} value={source.value}>{source.label}</option>)}
              </select>
            </Field>
            <Field label="Industry">
              <select value={simulationInput.industryKey} onChange={(event) => setSimulationInput((current) => ({ ...current, industryKey: event.target.value }))} className={inputClass}>
                <option value="">Any / blank</option>
                {INDUSTRIES.map((industry) => <option key={industry} value={industry}>{industry.replaceAll("_", " ")}</option>)}
              </select>
            </Field>
          </div>
          <Field label="Website / Source Detail">
            <input value={simulationInput.leadSourceDetail} onChange={(event) => setSimulationInput((current) => ({ ...current, leadSourceDetail: event.target.value }))} className={inputClass} placeholder="example.com | contact form | https://example.com" />
          </Field>
          <Field label="City">
            <input value={simulationInput.city} onChange={(event) => setSimulationInput((current) => ({ ...current, city: event.target.value }))} className={inputClass} placeholder="Mumbai" />
          </Field>
          <Field label="Tags">
            <input value={simulationInput.tags} onChange={(event) => setSimulationInput((current) => ({ ...current, tags: event.target.value }))} className={inputClass} placeholder="hot-lead, nri" />
          </Field>

          <button type="button" onClick={simulateAssignment} disabled={simulating} className="w-full rounded-lg border border-teal-200 bg-teal-50 px-4 py-2 text-sm font-semibold text-teal-700 hover:bg-teal-100 disabled:opacity-60">
            {simulating ? "Simulating..." : "Simulate Result"}
          </button>

          {simulationResult && (
            <div className={`mt-4 rounded-lg border p-3 text-sm ${simulationResult.matched ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-amber-200 bg-amber-50 text-amber-800"}`}>
              <p className="font-bold">{simulationResult.matched ? "Matched assignment" : "No assignment"}</p>
              <p className="mt-1">{simulationResult.reason}</p>
              {simulationResult.ruleName && (
                <p className="mt-2">
                  Rule: <span className="font-semibold">{simulationResult.ruleName}</span>
                  {simulationResult.criteriaType ? ` (${simulationResult.criteriaType}${simulationResult.criteriaValue ? ` = ${simulationResult.criteriaValue}` : ""})` : ""}
                </p>
              )}
              {simulationResult.assignedUserEmail && (
                <p className="mt-1">Assigned to: <span className="font-semibold">{simulationResult.assignedUserEmail}</span></p>
              )}
            </div>
          )}
        </section>
        </div>

        <div className="min-w-0 rounded-lg bg-white p-4 shadow-sm">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-base font-bold text-gray-900">Rules</h2>
            <button onClick={loadData} className="rounded-lg border border-gray-200 px-3 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-50">
              Refresh
            </button>
          </div>

          {loading ? (
            <div className="py-12 text-center text-sm text-gray-500">Loading rules...</div>
          ) : rules.length === 0 ? (
            <div className="py-12 text-center text-sm text-gray-500">No assignment rules yet. Add a default fallback first.</div>
          ) : (
            <>
            <div className="space-y-3 md:hidden">
              {rules.map((rule) => (
                <article key={rule.id} className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="break-words text-sm font-bold text-gray-900">{rule.name}</p>
                      <p className="mt-1 text-xs font-semibold text-gray-500">Priority {rule.priority}</p>
                    </div>
                    <span className={`shrink-0 rounded-full px-2 py-1 text-xs font-semibold ${rule.active ? "bg-emerald-50 text-emerald-700" : "bg-gray-200 text-gray-600"}`}>
                      {rule.active ? "Active" : "Paused"}
                    </span>
                  </div>
                  <dl className="mt-3 space-y-2 text-xs">
                    <div>
                      <dt className="font-semibold uppercase text-gray-400">Match</dt>
                      <dd className="mt-0.5 break-words text-gray-700">{rule.criteriaType}{rule.criteriaValue ? ` = ${rule.criteriaValue}` : ""}</dd>
                    </div>
                    <div>
                      <dt className="font-semibold uppercase text-gray-400">Assign</dt>
                      <dd className="mt-0.5 break-words text-gray-700">{assignmentLabel(rule, users)}</dd>
                    </div>
                  </dl>
                  <div className="mt-3 grid grid-cols-2 gap-2 border-t border-gray-200 pt-3">
                    <button onClick={() => editRule(rule)} className="rounded-lg border border-teal-200 bg-white px-3 py-2 text-xs font-semibold text-teal-700">Edit</button>
                    <button onClick={() => deleteRule(rule)} className="rounded-lg border border-rose-200 bg-white px-3 py-2 text-xs font-semibold text-rose-600">Delete</button>
                  </div>
                </article>
              ))}
            </div>
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-xs uppercase text-gray-400">
                  <tr>
                    <th className="px-3 py-2 text-left">Priority</th>
                    <th className="px-3 py-2 text-left">Rule</th>
                    <th className="px-3 py-2 text-left">Match</th>
                    <th className="px-3 py-2 text-left">Assign</th>
                    <th className="px-3 py-2 text-left">Status</th>
                    <th className="px-3 py-2 text-left">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {rules.map((rule) => (
                    <tr key={rule.id}>
                      <td className="px-3 py-2 font-semibold text-gray-700">{rule.priority}</td>
                      <td className="px-3 py-2 font-medium text-gray-900">{rule.name}</td>
                      <td className="px-3 py-2 text-gray-600">{rule.criteriaType}{rule.criteriaValue ? ` = ${rule.criteriaValue}` : ""}</td>
                      <td className="px-3 py-2 text-gray-600">{assignmentLabel(rule, users)}</td>
                      <td className="px-3 py-2">
                        <span className={`rounded-full px-2 py-1 text-xs font-semibold ${rule.active ? "bg-emerald-50 text-emerald-700" : "bg-gray-100 text-gray-500"}`}>
                          {rule.active ? "Active" : "Paused"}
                        </span>
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex gap-2">
                          <button onClick={() => editRule(rule)} className="text-xs font-semibold text-teal-600 hover:text-teal-700">Edit</button>
                          <button onClick={() => deleteRule(rule)} className="text-xs font-semibold text-rose-500 hover:text-rose-600">Delete</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <label className="mb-3 block">
      <span className="mb-1 block text-xs font-semibold text-gray-500">{label}</span>
      {children}
    </label>
  );
}

function assignmentLabel(rule, users) {
  if (rule.assignmentStrategy === "ASSIGN_USER") {
    return labelForUser(users.find((user) => user.id === rule.assignedUserId));
  }
  const names = (rule.assignedUserIds || [])
    .map((id) => labelForUser(users.find((user) => user.id === id)))
    .join(", ");
  return `Round-robin: ${names || "No users"}`;
}
