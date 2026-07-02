import { useEffect, useMemo, useState } from "react";
import api from "../api/axios";

const contactLabel = (contact) =>
  contact?.name || contact?.phone || contact?.email || `Contact #${contact?.id}`;

const formatDate = (value) => {
  if (!value) return "No date";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

export default function DuplicateCleanup() {
  const [groups, setGroups] = useState([]);
  const [targets, setTargets] = useState({});
  const [loading, setLoading] = useState(true);
  const [mergingKey, setMergingKey] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const totalDuplicates = useMemo(
    () => groups.reduce((sum, group) => sum + Math.max((group.contacts?.length || 0) - 1, 0), 0),
    [groups]
  );

  const loadGroups = async () => {
    setLoading(true);
    setError("");
    try {
      const response = await api.get("/api/contacts/duplicates/groups");
      const nextGroups = Array.isArray(response.data) ? response.data : [];
      setGroups(nextGroups);
      setTargets(
        nextGroups.reduce((acc, group) => {
          const key = groupKey(group);
          acc[key] = group.contacts?.[0]?.id || "";
          return acc;
        }, {})
      );
    } catch (scanError) {
      setError(scanError.response?.data?.message || scanError.response?.data?.error || "Could not scan duplicates.");
      setGroups([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadGroups();
  }, []);

  const mergeGroup = async (group) => {
    const key = groupKey(group);
    const targetId = Number(targets[key]);
    const sourceIds = (group.contacts || [])
      .map((contact) => contact.id)
      .filter((id) => id && id !== targetId);

    if (!targetId || sourceIds.length === 0) return;

    const target = group.contacts.find((contact) => contact.id === targetId);
    const confirmed = window.confirm(
      `Merge ${sourceIds.length} duplicate contact${sourceIds.length > 1 ? "s" : ""} into "${contactLabel(target)}"?`
    );
    if (!confirmed) return;

    setMergingKey(key);
    setMessage("");
    setError("");
    try {
      for (const sourceContactId of sourceIds) {
        await api.post(`/api/contacts/${targetId}/merge`, { sourceContactId });
      }
      setMessage(`Merged ${sourceIds.length} duplicate contact${sourceIds.length > 1 ? "s" : ""}.`);
      await loadGroups();
    } catch (mergeError) {
      setError(mergeError.response?.data?.message || mergeError.response?.data?.error || "Could not merge this group.");
    } finally {
      setMergingKey("");
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-6">
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Duplicate Cleanup</h1>
          <p className="mt-1 text-sm text-gray-500">
            Review imported contacts that share the same phone or email, then merge history into one master record.
          </p>
        </div>
        <button
          onClick={loadGroups}
          disabled={loading || Boolean(mergingKey)}
          className="rounded-lg bg-teal-500 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-600 disabled:cursor-not-allowed disabled:bg-teal-300"
        >
          {loading ? "Scanning..." : "Scan Again"}
        </button>
      </div>

      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <SummaryCard label="Duplicate groups" value={groups.length} />
        <SummaryCard label="Contacts to clean" value={totalDuplicates} />
        <SummaryCard label="Match rules" value="Phone + Email" />
      </div>

      {message && <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{message}</div>}
      {error && <div className="mb-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>}

      {loading ? (
        <div className="rounded-lg bg-white p-10 text-center text-sm text-gray-500 shadow-sm">Scanning contacts...</div>
      ) : groups.length === 0 ? (
        <div className="rounded-lg bg-white p-10 text-center shadow-sm">
          <p className="text-base font-semibold text-gray-800">No duplicate groups found</p>
          <p className="mt-1 text-sm text-gray-500">Your contacts are clean by phone and email.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {groups.map((group) => {
            const key = groupKey(group);
            const targetId = Number(targets[key]);
            const sourceCount = (group.contacts || []).filter((contact) => contact.id !== targetId).length;

            return (
              <div key={key} className="rounded-lg bg-white p-4 shadow-sm">
                <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div className="text-xs font-semibold uppercase text-gray-400">{group.duplicateType}</div>
                    <div className="mt-1 text-sm font-semibold text-gray-900">{group.duplicateKey}</div>
                  </div>
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                    <select
                      value={targets[key] || ""}
                      onChange={(event) => setTargets((prev) => ({ ...prev, [key]: event.target.value }))}
                      className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:border-teal-400 focus:outline-none"
                    >
                      {(group.contacts || []).map((contact) => (
                        <option key={contact.id} value={contact.id}>
                          Keep {contactLabel(contact)}
                        </option>
                      ))}
                    </select>
                    <button
                      onClick={() => mergeGroup(group)}
                      disabled={mergingKey === key || sourceCount === 0}
                      className="rounded-lg bg-indigo-500 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-600 disabled:cursor-not-allowed disabled:bg-indigo-300"
                    >
                      {mergingKey === key ? "Merging..." : `Merge ${sourceCount}`}
                    </button>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 text-xs uppercase text-gray-400">
                      <tr>
                        <th className="px-3 py-2 text-left">Role</th>
                        <th className="px-3 py-2 text-left">Name</th>
                        <th className="px-3 py-2 text-left">Phone</th>
                        <th className="px-3 py-2 text-left">Email</th>
                        <th className="px-3 py-2 text-left">Source</th>
                        <th className="px-3 py-2 text-left">Created</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {(group.contacts || []).map((contact) => (
                        <tr key={contact.id}>
                          <td className="px-3 py-2">
                            <span className={`rounded-full px-2 py-1 text-xs font-semibold ${contact.id === targetId ? "bg-teal-50 text-teal-700" : "bg-gray-100 text-gray-500"}`}>
                              {contact.id === targetId ? "Keep" : "Merge"}
                            </span>
                          </td>
                          <td className="px-3 py-2 font-medium text-gray-800">{contact.name || "-"}</td>
                          <td className="px-3 py-2 text-gray-600">{contact.phone || "-"}</td>
                          <td className="px-3 py-2 text-gray-600">{contact.email || "-"}</td>
                          <td className="px-3 py-2 text-gray-600">{contact.leadSource || "-"}</td>
                          <td className="px-3 py-2 text-gray-500">{formatDate(contact.createdAt)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function SummaryCard({ label, value }) {
  return (
    <div className="rounded-lg bg-white p-4 shadow-sm">
      <div className="text-xs font-semibold uppercase text-gray-400">{label}</div>
      <div className="mt-2 text-2xl font-bold text-gray-900">{value}</div>
    </div>
  );
}

function groupKey(group) {
  return `${group.duplicateType}:${group.duplicateKey}`;
}
