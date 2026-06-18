import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  ArrowUpRight,
  Clock3,
  Mail,
  Reply,
  Send,
  UserRound,
} from "lucide-react";
import api from "../api/axios";
import {
  emailHtmlDocument,
  formatDate,
  initials,
  looksLikeHtml,
  normalizeList,
  textPreview,
} from "../components/email/emailUtils";

export default function MailDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [emails, setEmails] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [opportunities, setOpportunities] = useState([]);
  const [replyBody, setReplyBody] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const email = useMemo(
    () => emails.find((item) => String(item.id) === String(id)) || null,
    [emails, id]
  );

  const contact = useMemo(
    () => contacts.find((item) => String(item.id || item._id) === String(email?.contactId)) || null,
    [contacts, email]
  );

  const opportunity = useMemo(
    () => opportunities.find((item) => String(item.id) === String(email?.opportunityId)) || null,
    [opportunities, email]
  );

  const relatedEmails = useMemo(() => {
    if (!email) return [];
    return emails
      .filter((item) => {
        if (email.contactId && item.contactId === email.contactId) return true;
        if (email.opportunityId && item.opportunityId === email.opportunityId) return true;
        return false;
      })
      .filter((item) => String(item.id) !== String(email.id))
      .slice(0, 6);
  }, [emails, email]);

  const loadData = useCallback(async () => {
    setLoading(true);
    setMessage("");
    try {
      const [emailResponse, contactResponse, opportunityResponse] = await Promise.all([
        api.get("/api/email/logs"),
        api.get("/api/contacts/page?page=0&size=500"),
        api.get("/api/opportunities"),
      ]);
      setEmails(normalizeList(emailResponse.data));
      setContacts(normalizeList(contactResponse.data));
      setOpportunities(normalizeList(opportunityResponse.data));
    } catch (error) {
      setMessage(error?.response?.data?.message || error.message || "Failed to load email");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    if (!email || email.direction !== "INBOUND" || email.readAt) return;
    api.post(`/api/email/${email.id}/read`)
      .then((response) => {
        setEmails((current) => current.map((item) => item.id === email.id ? response.data : item));
      })
      .catch(() => undefined);
  }, [email]);

  const reply = async () => {
    if (!email || !replyBody.trim()) return;
    setSaving(true);
    setMessage("");
    try {
      const response = await api.post(`/api/email/${email.id}/reply`, {
        bodyText: replyBody.trim(),
      });
      setReplyBody("");
      setMessage("Reply sent.");
      await loadData();
      if (response.data?.id) navigate(`/dashboard/mail/${response.data.id}`);
    } catch (error) {
      setMessage(error?.response?.data?.message || error.message || "Reply failed");
    } finally {
      setSaving(false);
    }
  };

  if (loading && !email) {
    return (
      <div className="min-h-screen bg-[#f6f8fc] p-6 text-sm text-gray-500">
        Loading email...
      </div>
    );
  }

  if (!email) {
    return (
      <div className="min-h-screen bg-[#f6f8fc] p-6">
        <button onClick={() => navigate("/dashboard/mail")} className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700">
          <ArrowLeft size={16} />
          Back to Mail
        </button>
        <p className="mt-4 text-sm text-red-600">{message || "Email not found."}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f6f8fc] p-4 text-gray-900 md:p-6">
      <div className="mx-auto max-w-[1400px]">
        <header className="mb-4 flex flex-col gap-3 rounded-2xl border border-gray-200 bg-white px-5 py-4 shadow-sm lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <Link to="/dashboard/mail" className="inline-flex items-center gap-2 text-sm font-bold text-teal-700">
              <ArrowLeft size={16} />
              Mail
            </Link>
            <h1 className="mt-3 break-words text-2xl font-extrabold text-gray-950">{email.subject || "(No subject)"}</h1>
            <p className="mt-2 text-sm text-gray-500">{email.direction === "INBOUND" ? "Received" : "Sent"} - {formatDate(email.createdAt)}</p>
          </div>
          <span className={`w-fit rounded-full px-3 py-1 text-xs font-bold ${
            email.status === "FAILED" ? "bg-red-50 text-red-700" : "bg-gray-100 text-gray-700"
          }`}>
            {email.status || email.direction}
          </span>
        </header>

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
          <main className="rounded-2xl border border-gray-200 bg-white shadow-sm">
            <section className="border-b border-gray-100 p-5">
              <div className="flex gap-3">
                <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-sm font-extrabold ${
                  email.direction === "INBOUND" ? "bg-blue-50 text-blue-700" : "bg-emerald-50 text-emerald-700"
                }`}>
                  {initials(email.direction === "INBOUND" ? email.fromEmail : email.toEmail)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="break-words text-sm font-extrabold text-gray-950">
                      {email.direction === "INBOUND" ? email.fromEmail || "Unknown sender" : email.toEmail || "Unknown recipient"}
                    </p>
                    <p className="text-xs font-semibold text-gray-400">{formatDate(email.createdAt)}</p>
                  </div>
                  <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
                    <span><strong className="text-gray-700">From:</strong> {email.fromEmail || "-"}</span>
                    <span><strong className="text-gray-700">To:</strong> {email.toEmail || "-"}</span>
                  </div>
                </div>
              </div>
            </section>

            <section className="p-5">
              {looksLikeHtml(email.body) ? (
                <iframe
                  title={`Email body ${email.id}`}
                  sandbox="allow-popups allow-popups-to-escape-sandbox"
                  srcDoc={emailHtmlDocument(email.body)}
                  referrerPolicy="no-referrer"
                  className="min-h-[36rem] w-full rounded-xl border border-gray-200 bg-white"
                />
              ) : (
                <article className="min-h-[24rem] whitespace-pre-wrap break-words text-sm leading-7 text-gray-800">
                  {email.body || "No email body available."}
                </article>
              )}

              {email.errorMessage && (
                <div className="mt-5 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                  {email.errorMessage}
                </div>
              )}

              <div className="mt-8 rounded-2xl border border-gray-200 bg-gray-50 p-4">
                <label className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-gray-500">
                  <Reply size={14} />
                  Reply
                </label>
                <textarea
                  rows={7}
                  value={replyBody}
                  onChange={(event) => setReplyBody(event.target.value)}
                  placeholder="Write your reply..."
                  className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-teal-500"
                />
                <button
                  onClick={reply}
                  disabled={saving || !replyBody.trim()}
                  className="mt-3 inline-flex items-center gap-2 rounded-xl bg-teal-700 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <Send size={15} />
                  {saving ? "Sending..." : "Send Reply"}
                </button>
              </div>
            </section>
          </main>

          <aside className="space-y-4">
            <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
              <h2 className="flex items-center gap-2 text-sm font-extrabold text-gray-950">
                <UserRound size={16} className="text-teal-700" />
                CRM Context
              </h2>
              <div className="mt-4 space-y-4 text-sm">
                <div>
                  <div className="text-xs font-bold uppercase tracking-wide text-gray-500">Contact</div>
                  <div className="mt-1 font-semibold text-gray-900">
                    {contact?.name || email.fromEmail || email.toEmail || "No linked contact"}
                  </div>
                  {(contact?.phone || contact?.email) && (
                    <div className="mt-1 text-xs text-gray-500">{contact?.phone || contact?.email}</div>
                  )}
                </div>
                <div>
                  <div className="text-xs font-bold uppercase tracking-wide text-gray-500">Opportunity</div>
                  <div className="mt-1 font-semibold text-gray-900">{opportunity?.title || "No linked opportunity"}</div>
                  {opportunity?.stage && (
                    <div className="mt-1 text-xs text-gray-500">{String(opportunity.stage).replaceAll("_", " ")}</div>
                  )}
                </div>
              </div>
              {opportunity?.id && (
                <Link to={`/dashboard/opportunities/${opportunity.id}`} className="mt-4 inline-flex items-center gap-2 text-sm font-bold text-teal-700">
                  Open Opportunity
                  <ArrowUpRight size={14} />
                </Link>
              )}
            </section>

            <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
              <h2 className="flex items-center gap-2 text-sm font-extrabold text-gray-950">
                <Mail size={16} className="text-teal-700" />
                Related Mail
              </h2>
              <div className="mt-4 space-y-2">
                {relatedEmails.map((item) => (
                  <Link key={item.id} to={`/dashboard/mail/${item.id}`} className="block rounded-xl border border-gray-100 p-3 hover:bg-gray-50">
                    <p className="line-clamp-1 text-sm font-semibold text-gray-900">{item.subject || "(No subject)"}</p>
                    <p className="mt-1 line-clamp-2 text-xs leading-5 text-gray-500">{textPreview(item.body) || "No preview available"}</p>
                  </Link>
                ))}
                {relatedEmails.length === 0 && (
                  <p className="rounded-xl border border-dashed border-gray-200 p-4 text-center text-sm text-gray-500">No related emails yet.</p>
                )}
              </div>
            </section>
          </aside>
        </div>

        {message && <p className="mt-4 rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-600 shadow-sm">{message}</p>}
      </div>
    </div>
  );
}
