// import { useEffect, useState, useCallback, useRef, useMemo } from "react";
// import api from "../api/axios";
// import "../index.css";

// // ── Constants ─────────────────────────────────────────────────────────────────
// const RATE_GOOD = 80;
// const RATE_OK   = 50;

// const STATUS_CFG = {
//   SCHEDULED: { label: "Scheduled", color: "#0ea5e9", bg: "#f0f9ff", border: "#bae6fd", dot: "#0ea5e9" },
//   SENDING:   { label: "Sending",   color: "#f59e0b", bg: "#fffbeb", border: "#fde68a", dot: "#f59e0b" },
//   PAUSED:    { label: "Paused",    color: "#8b5cf6", bg: "#f5f3ff", border: "#ddd6fe", dot: "#8b5cf6" },
//   SENT:      { label: "Sent",      color: "#10b981", bg: "#ecfdf5", border: "#6ee7b7", dot: "#10b981" },
//   FAILED:    { label: "Failed",    color: "#ef4444", bg: "#fef2f2", border: "#fecaca", dot: "#ef4444" },
//   CANCELLED: { label: "Cancelled", color: "#9ca3af", bg: "#f9fafb", border: "#e5e7eb", dot: "#9ca3af" },
// };

// // ── API Response Normalizer ───────────────────────────────────────────────────
// const normalizeCampaign = (c) => {
//   const recipientCount = c.totalMessages     ?? c.recipientCount    ?? (Array.isArray(c.contactIds) ? c.contactIds.length : 0);
//   const sentCount      = c.sentMessages      ?? c.sentCount         ?? 0;
//   const deliveredCount = c.deliveredMessages ?? c.deliveredCount    ?? 0;
//   const failedCount    = c.failedMessages    ?? c.failedCount       ?? 0;
//   const readCount      = c.readMessages      ?? c.readCount         ?? 0;

//   if (process.env.NODE_ENV === "development") {
//     console.debug("[normalizeCampaign]", {
//       id: c.campaignId ?? c.id ?? c._id,
//       recipientCount, sentCount, deliveredCount, failedCount,
//       rawKeys: Object.keys(c),
//     });
//   }

//   return {
//     ...c,
//     id:               c.campaignId ?? c.id ?? c._id,
//     recipientCount,
//     sentCount,
//     deliveredCount,
//     failedCount,
//     readCount,
//     status:           c.status === "COMPLETED" ? "SENT" : (c.status ?? "SCHEDULED"),
//     metaTemplateName: c.metaTemplateName ?? c.templateName ?? c.name ?? "—",
//   };
// };

// // ── Shared helpers ────────────────────────────────────────────────────────────
// const getCampaignId = (c) => c.campaignId ?? c.id ?? c._id;

// function rateStyle(rate) {
//   if (rate >= RATE_GOOD) return { color: "#065f46", background: "#d1fae5", border: "1px solid #6ee7b7" };
//   if (rate >= RATE_OK)   return { color: "#92400e", background: "#fef3c7", border: "1px solid #fde68a" };
//   return                        { color: "#991b1b", background: "#fee2e2", border: "1px solid #fecaca" };
// }

// function rateColor(rate) {
//   if (rate >= RATE_GOOD) return "#10b981";
//   if (rate >= RATE_OK)   return "#f59e0b";
//   return "#ef4444";
// }

// function formatDateTime(iso) {
//   if (!iso) return "—";
//   return new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
// }

// function formatDate(iso) {
//   if (!iso) return "—";
//   return new Date(iso).toLocaleDateString(undefined, { dateStyle: "medium" });
// }

// // ── useCountdown ──────────────────────────────────────────────────────────────
// function useCountdown(scheduledAt, status) {
//   const [display, setDisplay] = useState("");
//   useEffect(() => {
//     if (status !== "SCHEDULED" || !scheduledAt) { setDisplay(""); return; }
//     const tick = () => {
//       const diff = new Date(scheduledAt) - Date.now();
//       if (diff <= 0) { setDisplay("Imminent"); return; }
//       const d = Math.floor(diff / 86400000);
//       const h = Math.floor((diff % 86400000) / 3600000);
//       const m = Math.floor((diff % 3600000) / 60000);
//       const s = Math.floor((diff % 60000) / 1000);
//       setDisplay(d > 0 ? `${d}d ${h}h ${m}m` : h > 0 ? `${h}h ${m}m ${s}s` : `${m}m ${s}s`);
//     };
//     tick();
//     const id = setInterval(tick, 1000);
//     return () => clearInterval(id);
//   }, [scheduledAt, status]);
//   return display;
// }

// // ── calcTemplateStats ─────────────────────────────────────────────────────────
// function calcTemplateStats(history) {
//   const map = {};
//   history
//     .filter(c => !["CANCELLED", "SCHEDULED"].includes(c.status))
//     .forEach(c => {
//       const key = c.metaTemplateName || c.templateName || "Unknown";
//       if (!map[key]) {
//         map[key] = { name: key, metaTemplateName: c.metaTemplateName || c.templateName || null, campaigns: 0, total: 0, delivered: 0, failed: 0, lastUsed: null };
//       }
//       const e = map[key];
//       e.campaigns  += 1;
//       e.total      += c.recipientCount ?? 0;
//       e.delivered  += c.deliveredCount ?? 0;
//       e.failed     += c.failedCount    ?? 0;
//       const ts = c.scheduledAt || c.createdAt;
//       if (ts && (!e.lastUsed || new Date(ts) > new Date(e.lastUsed))) e.lastUsed = ts;
//     });
//   return Object.values(map).sort((a, b) => b.total - a.total);
// }

// // ── Delivery Stats Bar ────────────────────────────────────────────────────────
// function DeliveryStats({ campaign }) {
//   const total     = campaign.recipientCount ?? 0;
//   const delivered = campaign.deliveredCount ?? 0;
//   const failed    = campaign.failedCount    ?? 0;
//   const pending   = Math.max(0, total - delivered - failed);

//   if (!["SENT", "SENDING", "FAILED", "PAUSED"].includes(campaign.status)) return null;
//   if (total === 0) return null;

//   const deliveredPct = (delivered / total) * 100;
//   const failedPct    = (failed    / total) * 100;
//   const pendingPct   = (pending   / total) * 100;
//   const successRate  = Math.round((delivered / total) * 100);
//   const rs           = rateStyle(successRate);

//   return (
//     <div className="delivery-stats">
//       <div className="delivery-bar">
//         {deliveredPct > 0 && <div className="delivery-bar-seg delivered" style={{ width: `${deliveredPct}%` }} title={`Delivered: ${delivered}`} />}
//         {pendingPct   > 0 && <div className="delivery-bar-seg pending"   style={{ width: `${pendingPct}%`   }} title={`Pending: ${pending}`}     />}
//         {failedPct    > 0 && <div className="delivery-bar-seg failed"    style={{ width: `${failedPct}%`    }} title={`Failed: ${failed}`}        />}
//       </div>
//       <div className="delivery-chips">
//         <div className="delivery-chip total">
//           <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
//             <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
//             <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
//           </svg>
//           <span className="chip-value">{total}</span>
//           <span className="chip-label">Total</span>
//         </div>
//         <div className="delivery-divider" />
//         <div className="delivery-chip delivered">
//           <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
//             <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>
//           </svg>
//           <span className="chip-value">{delivered}</span>
//           <span className="chip-label">Delivered</span>
//         </div>
//         <div className="delivery-chip failed">
//           <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
//             <circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>
//           </svg>
//           <span className="chip-value">{failed}</span>
//           <span className="chip-label">Failed</span>
//         </div>
//         {pending > 0 && (
//           <div className="delivery-chip pending">
//             <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
//               <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
//             </svg>
//             <span className="chip-value">{pending}</span>
//             <span className="chip-label">Pending</span>
//           </div>
//         )}
//         {(campaign.readCount ?? 0) > 0 && (
//           <div className="delivery-chip read">
//             <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
//               <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
//             </svg>
//             <span className="chip-value">{campaign.readCount}</span>
//             <span className="chip-label">Read</span>
//           </div>
//         )}
//         <div className="delivery-divider" />
//         <div className="delivery-rate" style={{ color: rs.color, background: rs.background, border: rs.border }}>
//           {successRate}% success
//         </div>
//       </div>
//     </div>
//   );
// }

// // ── Stats Drawer ──────────────────────────────────────────────────────────────
// function StatsDrawer({ campaignId, onClose }) {
//   const [stats,   setStats]   = useState(null);
//   const [loading, setLoading] = useState(true);
//   const [error,   setError]   = useState(null);

//   useEffect(() => {
//     api.get(`/api/campaigns/${campaignId}/stats`)
//       .then(r => setStats(r.data))
//       .catch(() => setError("Could not load stats"))
//       .finally(() => setLoading(false));
//   }, [campaignId]);

//   return (
//     <div className="drawer">
//       <div className="drawer-header">
//         <span className="drawer-title">
//           <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
//             <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
//           </svg>
//           Campaign Stats
//         </span>
//         <button className="drawer-close" onClick={onClose}>
//           <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
//             <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
//           </svg>
//         </button>
//       </div>

//       {loading && (
//         <div className="drawer-loading">
//           <div className="sch-spinner" style={{ width: 20, height: 20, borderWidth: 2 }} />
//           <span>Loading stats…</span>
//         </div>
//       )}

//       {error && <div className="drawer-error">{error}</div>}

//       {stats && !loading && (
//         <div className="stats-grid">
//           {Object.entries(stats).map(([key, val]) => {
//             const label   = key.replace(/([A-Z])/g, " $1").replace(/^./, s => s.toUpperCase());
//             const isRate  = key.toLowerCase().includes("rate") || key.toLowerCase().includes("percent");
//             const display = isRate
//               ? `${typeof val === "number" ? val.toFixed(1) : val}%`
//               : typeof val === "number"
//                 ? val.toLocaleString()
//                 : (val ?? "—");

//             let color = "#374151";
//             if (key.toLowerCase().includes("delivered") || key.toLowerCase().includes("success")) color = "#10b981";
//             if (key.toLowerCase().includes("fail"))    color = "#ef4444";
//             if (key.toLowerCase().includes("read"))    color = "#8b5cf6";
//             if (key.toLowerCase().includes("pending")) color = "#f59e0b";

//             return (
//               <div key={key} className="stat-tile">
//                 <div className="stat-tile-val" style={{ color }}>{display}</div>
//                 <div className="stat-tile-lbl">{label}</div>
//               </div>
//             );
//           })}
//         </div>
//       )}
//     </div>
//   );
// }

// // ── Messages Drawer ───────────────────────────────────────────────────────────
// const MSG_STATUS_CFG = {
//   DELIVERED: { color: "#10b981", bg: "#ecfdf5", border: "#6ee7b7" },
//   FAILED:    { color: "#ef4444", bg: "#fef2f2", border: "#fecaca" },
//   PENDING:   { color: "#f59e0b", bg: "#fffbeb", border: "#fde68a" },
//   READ:      { color: "#8b5cf6", bg: "#f5f3ff", border: "#ddd6fe" },
//   SENT:      { color: "#0ea5e9", bg: "#f0f9ff", border: "#bae6fd" },
// };

// function MessagesDrawer({ campaignId, onClose }) {
//   const [messages, setMessages] = useState([]);
//   const [loading,  setLoading]  = useState(true);
//   const [error,    setError]    = useState(null);
//   const [search,   setSearch]   = useState("");
//   const [filter,   setFilter]   = useState("ALL");

//   useEffect(() => {
//     api.get(`/api/campaigns/${campaignId}/messages`)
//       .then(r => setMessages(Array.isArray(r.data) ? r.data : r.data?.messages ?? []))
//       .catch(() => setError("Could not load messages"))
//       .finally(() => setLoading(false));
//   }, [campaignId]);

//   const statuses = ["ALL", ...Object.keys(
//     messages.reduce((a, m) => { if (m.status) a[m.status] = 1; return a; }, {})
//   )];

//   const visible = messages.filter(m => {
//     const matchFilter = filter === "ALL" || m.status === filter;
//     const matchSearch = !search ||
//       m.recipientPhone?.includes(search) ||
//       m.recipientName?.toLowerCase().includes(search.toLowerCase());
//     return matchFilter && matchSearch;
//   });

//   return (
//     <div className="drawer">
//       <div className="drawer-header">
//         <span className="drawer-title">
//           <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
//             <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
//           </svg>
//           Messages ({messages.length})
//         </span>
//         <button className="drawer-close" onClick={onClose}>
//           <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
//             <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
//           </svg>
//         </button>
//       </div>

//       {!loading && !error && messages.length > 0 && (
//         <div className="msgs-toolbar">
//           <div className="msgs-search">
//             <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
//               <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
//             </svg>
//             <input
//               placeholder="Search name or phone…"
//               value={search}
//               onChange={e => setSearch(e.target.value)}
//             />
//           </div>
//           <div className="msgs-filters">
//             {statuses.map(s => (
//               <button
//                 key={s}
//                 className={`msgs-filter-btn ${filter === s ? "active" : ""}`}
//                 style={filter === s && MSG_STATUS_CFG[s] ? {
//                   color: MSG_STATUS_CFG[s].color,
//                   background: MSG_STATUS_CFG[s].bg,
//                   borderColor: MSG_STATUS_CFG[s].border,
//                 } : {}}
//                 onClick={() => setFilter(s)}
//               >
//                 {s}
//                 <span className="msgs-filter-count">
//                   {s === "ALL" ? messages.length : messages.filter(m => m.status === s).length}
//                 </span>
//               </button>
//             ))}
//           </div>
//         </div>
//       )}

//       {loading && (
//         <div className="drawer-loading">
//           <div className="sch-spinner" style={{ width: 20, height: 20, borderWidth: 2 }} />
//           <span>Loading messages…</span>
//         </div>
//       )}

//       {error && <div className="drawer-error">{error}</div>}

//       {!loading && !error && messages.length === 0 && (
//         <div className="drawer-loading" style={{ color: "#9ca3af" }}>No messages found</div>
//       )}

//       {!loading && !error && messages.length > 0 && (
//         <div className="msgs-list">
//           {visible.length === 0
//             ? <div className="drawer-loading" style={{ color: "#9ca3af" }}>No results</div>
//             : visible.map((m, i) => {
//                 const cfg = MSG_STATUS_CFG[m.status] || { color: "#6b7280", bg: "#f9fafb", border: "#e5e7eb" };
//                 return (
//                   <div key={m.id ?? i} className="msg-row">
//                     <div className="msg-row-left">
//                       <div className="msg-avatar">
//                         {(m.recipientName ?? m.phone ?? "?")[0].toUpperCase()}
//                       </div>
//                       <div className="msg-info">
//                         <div className="msg-name">{m.recipientName ?? "Unknown"}</div>
//                         <div className="msg-phone">{m.recipientPhone ?? m.phone ?? "—"}</div>
//                       </div>
//                     </div>
//                     <div className="msg-row-right">
//                       {m.sentAt && <div className="msg-time">{formatDateTime(m.sentAt)}</div>}
//                       <span className="msg-status-badge" style={{ color: cfg.color, background: cfg.bg, border: `1px solid ${cfg.border}` }}>
//                         {m.status}
//                       </span>
//                       {m.errorMessage && (
//                         <div className="msg-error" title={m.errorMessage}>
//                           <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
//                             <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
//                           </svg>
//                           {m.errorMessage.length > 40 ? m.errorMessage.slice(0, 40) + "…" : m.errorMessage}
//                         </div>
//                       )}
//                     </div>
//                   </div>
//                 );
//               })
//           }
//         </div>
//       )}
//     </div>
//   );
// }

// // ── Action Button ─────────────────────────────────────────────────────────────
// function ActionBtn({ onClick, disabled, loading, variant = "default", children }) {
//   const variants = {
//     default: { border: "#e5e7eb",  color: "#374151",  hoverBorder: "#10b981", hoverColor: "#065f46", hoverBg: "#f0fdf4" },
//     danger:  { border: "#fecaca",  color: "#ef4444",  hoverBorder: "#ef4444", hoverColor: "#991b1b", hoverBg: "#fef2f2" },
//     warning: { border: "#fde68a",  color: "#92400e",  hoverBorder: "#f59e0b", hoverColor: "#78350f", hoverBg: "#fffbeb" },
//     purple:  { border: "#ddd6fe",  color: "#7c3aed",  hoverBorder: "#8b5cf6", hoverColor: "#5b21b6", hoverBg: "#f5f3ff" },
//     sky:     { border: "#bae6fd",  color: "#0369a1",  hoverBorder: "#0ea5e9", hoverColor: "#075985", hoverBg: "#f0f9ff" },
//   };
//   const v = variants[variant] || variants.default;
//   return (
//     <button
//       onClick={onClick}
//       disabled={disabled || loading}
//       className="action-btn"
//       style={{
//         "--ab-border":       v.border,
//         "--ab-color":        v.color,
//         "--ab-hover-border": v.hoverBorder,
//         "--ab-hover-color":  v.hoverColor,
//         "--ab-hover-bg":     v.hoverBg,
//       }}
//     >
//       {loading
//         ? <div className="sch-spinner" style={{ width: 10, height: 10, borderWidth: 1.5, borderTopColor: v.color }} />
//         : children}
//     </button>
//   );
// }

// // ── Campaign History Row ──────────────────────────────────────────────────────
// function CampaignHistoryRow({ campaign: initialCampaign, onRefresh }) {
//   const [campaign,      setCampaign]      = useState(initialCampaign);
//   const [actionLoading, setActionLoading] = useState(null);
//   const [openDrawer,    setOpenDrawer]    = useState(null);

//   const [confirmOpen, setConfirmOpen] = useState(false);
// const [confirmData, setConfirmData] = useState(null);
//   const countdown = useCountdown(campaign.scheduledAt, campaign.status);
//   const cfg = STATUS_CFG[campaign.status] || STATUS_CFG.SCHEDULED;

//   // ── Refresh single campaign ───────────────────────────────────────────────
//   const refreshSingle = useCallback(async () => {
//     setActionLoading("refresh");
//     try {
//       const r = await api.get(`/api/campaigns/${campaign.id}`);
//       const raw = r.data;
//       if (raw.status === "COMPLETED") raw.status = "SENT";
//       setCampaign(prev => ({ ...prev, ...normalizeCampaign(raw) }));
//     } catch { /* silent */ }
//     finally { setActionLoading(null); }
//   }, [campaign.id]);

//   // ── Generic action helper ─────────────────────────────────────────────────
//   const doAction = useCallback((key, endpoint, confirmMsg) => {
//   setConfirmData({ key, endpoint, confirmMsg });
//   setConfirmOpen(true);
// }, []);

// const handleConfirm = async () => {
//   if (!confirmData) return;

//   const { key, endpoint } = confirmData;

//   setActionLoading(key);

//   try {
//     await api.post(endpoint);
//     await refreshSingle();
//     onRefresh?.();
//   } catch {
//     alert(`Failed to ${key} campaign.`);
//   } finally {
//     setActionLoading(null);
//     setConfirmOpen(false);
//   }
// };

//   const handleCancel = () =>
//     doAction("cancel", `/api/campaigns/${campaign.id}/cancel`,
//       `Cancel "${campaign.metaTemplateName || campaign.name}"?`);

//   const handlePause = () =>
//     doAction("pause", `/api/campaigns/${campaign.id}/pause`,
//       `Pause "${campaign.metaTemplateName || campaign.name}"?`);

//   const handleResume = () =>
//     doAction("resume", `/api/campaigns/${campaign.id}/resume`,
//       `resume "${campaign.metaTemplateName || campaign.name}"?`
//     );

//   const handleRetry = () =>
//     doAction("retry", `/api/campaigns/${campaign.id}/retry-failures`,
//       `Retry all failed messages in "${campaign.metaTemplateName || campaign.name}"?`);

//   const total  = campaign.recipientCount ?? 0;
//   const failed = campaign.failedCount    ?? 0;

//   const showPause  = campaign.status === "SENDING";
//   const showResume = campaign.status === "PAUSED";
//   const showRetry  = ["SENT", "FAILED"].includes(campaign.status) && failed > 0;
//   const showCancel = ["SCHEDULED", "PAUSED"].includes(campaign.status);

//   return (
//     <>
//       <div className="sch-row" style={{ flexDirection: "column" }}>
//         {/* Accent + body */}
//         <div style={{ display: "flex" }}>
//           <div className="sch-row-accent" style={{ background: cfg.dot }} />
//           <div className="sch-row-body">

//             {/* Top: title + badge */}
//             <div className="sch-row-top">
//               <div className="sch-title-block">
//                 <span className="sch-name">
//                   <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, color: "#9ca3af" }}>
//                     <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
//                   </svg>
//                   {campaign.metaTemplateName || "—"}
//                 </span>
//                 {campaign.name && <span className="sch-campaign-sub">{campaign.name}</span>}
//               </div>
//               <span className="sch-badge" style={{ color: cfg.color, background: cfg.bg, border: `1px solid ${cfg.border}` }}>
//                 <span className="sch-dot" style={{ background: cfg.dot, animation: campaign.status === "SENDING" ? "schPulse 1.2s infinite" : "none" }} />
//                 {cfg.label}
//               </span>
//             </div>

//             {/* Meta row */}
//             <div className="sch-meta">
//               <div className="sch-meta-item">
//                 <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
//                   <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/>
//                   <line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
//                 </svg>
//                 <span>{formatDateTime(campaign.scheduledAt)}</span>
//               </div>
//               <div className="sch-meta-item">
//                 <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
//                   <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
//                 </svg>
//                 <span>{total} recipients</span>
//               </div>
//             </div>

//             {/* Delivery stats bar */}
//             <DeliveryStats campaign={campaign} />

//             {/* Footer: countdown + actions */}
//             <div className="sch-row-foot">
//               <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
//                 {countdown && (
//                   <span className="sch-countdown">
//                     <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
//                       <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
//                     </svg>
//                     Sends in {countdown}
//                   </span>
//                 )}

//                 <ActionBtn onClick={() => setOpenDrawer(d => d === "stats" ? null : "stats")} variant="sky">
//                   <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
//                     <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
//                   </svg>
//                   Stats
//                 </ActionBtn>

//                 <ActionBtn onClick={() => setOpenDrawer(d => d === "messages" ? null : "messages")} variant="purple">
//                   <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
//                     <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
//                   </svg>
//                   Messages
//                 </ActionBtn>

//                 <ActionBtn onClick={refreshSingle} loading={actionLoading === "refresh"}>
//                   <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
//                     <polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
//                   </svg>
//                   Refresh
//                 </ActionBtn>
//               </div>

//               {/* Mutating actions */}
//               <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
//                 {showRetry && (
//                   <ActionBtn onClick={handleRetry} loading={actionLoading === "retry"} variant="warning">
//                     <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
//                       <polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-4.95"/>
//                     </svg>
//                     Retry {failed} failed
//                   </ActionBtn>
//                 )}
//                 {showPause && (
//                   <ActionBtn onClick={handlePause} loading={actionLoading === "pause"} variant="purple">
//                     <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
//                       <rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/>
//                     </svg>
//                     Pause
//                   </ActionBtn>
//                 )}
//                 {showResume && (
//                   <ActionBtn onClick={handleResume} loading={actionLoading === "resume"}>
//                     <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
//                       <polygon points="5 3 19 12 5 21 5 3"/>
//                     </svg>
//                     Resume
//                   </ActionBtn>
//                 )}
//                 {showCancel && (
//                   <ActionBtn onClick={handleCancel} loading={actionLoading === "cancel"} variant="danger">
//                     <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
//                       <circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>
//                     </svg>
//                     Cancel
//                   </ActionBtn>
//                 )}
//               </div>
//             </div>
//           </div>
//         </div>

//         {/* ── Inline drawers ── */}
//         {openDrawer === "stats" && (
//           <StatsDrawer campaignId={campaign.id} onClose={() => setOpenDrawer(null)} />
//         )}
//         {openDrawer === "messages" && (
//           <MessagesDrawer campaignId={campaign.id} onClose={() => setOpenDrawer(null)} />
//         )}
//       </div>
//           {confirmOpen && (
//   <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
//     <div className="bg-white rounded-xl p-6 w-[350px] shadow-xl">
//       <h2 className="text-lg font-semibold mb-4">
//         Confirm Action
//       </h2>

//       <p className="text-gray-600 mb-6">
//         {confirmData?.confirmMsg}
//       </p>

//       <div className="flex justify-end gap-3">
//         <button
//           onClick={() => setConfirmOpen(false)}
//           className="px-4 py-2 rounded-lg border"
//         >
//           Cancel
//         </button>

//         <button
//           onClick={handleConfirm}
//           className="px-4 py-2 rounded-lg bg-teal-500 text-white"
//         >
//           Confirm
//         </button>
//       </div>
//     </div>
//   </div>
// )}
//       <style>{`
//         /* ── Action button ── */
//         .action-btn {
//           display: inline-flex; align-items: center; gap: 5px;
//           padding: 5px 11px; border-radius: 6px;
//           border: 1.5px solid var(--ab-border);
//           background: #fff; color: var(--ab-color);
//           font-size: 12px; font-weight: 500;
//           cursor: pointer; transition: all 0.15s; font-family: inherit;
//           white-space: nowrap;
//         }
//         .action-btn:hover:not(:disabled) {
//           border-color: var(--ab-hover-border);
//           color: var(--ab-hover-color);
//           background: var(--ab-hover-bg);
//         }
//         .action-btn:disabled { opacity: 0.5; cursor: not-allowed; }

//         /* ── Drawers ── */
//         .drawer {
//           border-top: 1px solid #f3f4f6;
//           background: #fafafa;
//           padding: 14px 16px 16px;
//           display: flex; flex-direction: column; gap: 12px;
//           animation: drawerIn 0.18s ease;
//         }
//         @keyframes drawerIn { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: translateY(0); } }
//         .drawer-header { display: flex; align-items: center; justify-content: space-between; }
//         .drawer-title  { display: flex; align-items: center; gap: 6px; font-size: 13px; font-weight: 600; color: #374151; }
//         .drawer-close  {
//           width: 24px; height: 24px; border-radius: 6px;
//           border: 1px solid #e5e7eb; background: #fff;
//           display: flex; align-items: center; justify-content: center;
//           cursor: pointer; color: #9ca3af; transition: all 0.15s;
//         }
//         .drawer-close:hover { border-color: #ef4444; color: #ef4444; }
//         .drawer-loading { display: flex; align-items: center; gap: 8px; padding: 12px 0; color: #6b7280; font-size: 13px; }
//         .drawer-error   { padding: 10px 12px; border-radius: 8px; background: #fef2f2; border: 1px solid #fecaca; color: #ef4444; font-size: 13px; }

//         /* ── Stats grid ── */
//         .stats-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(110px, 1fr)); gap: 8px; }
//         .stat-tile  { background: #fff; border: 1px solid #e5e7eb; border-radius: 10px; padding: 10px 12px; display: flex; flex-direction: column; gap: 3px; }
//         .stat-tile-val { font-size: 18px; font-weight: 700; line-height: 1; }
//         .stat-tile-lbl { font-size: 11px; color: #9ca3af; font-weight: 500; }

//         /* ── Messages drawer ── */
//         .msgs-toolbar { display: flex; flex-direction: column; gap: 8px; }
//         .msgs-search  {
//           display: flex; align-items: center; gap: 7px;
//           padding: 7px 10px; border-radius: 8px;
//           border: 1.5px solid #e5e7eb; background: #fff; color: #9ca3af;
//         }
//         .msgs-search input { border: none; outline: none; font-size: 12.5px; color: #374151; background: transparent; width: 100%; font-family: inherit; }
//         .msgs-filters { display: flex; gap: 5px; flex-wrap: wrap; }
//         .msgs-filter-btn {
//           display: inline-flex; align-items: center; gap: 4px;
//           padding: 4px 10px; border-radius: 20px;
//           border: 1.5px solid #e5e7eb; background: #fff;
//           color: #6b7280; font-size: 11.5px; font-weight: 500;
//           cursor: pointer; transition: all 0.15s; font-family: inherit;
//         }
//         .msgs-filter-btn.active { font-weight: 600; }
//         .msgs-filter-count {
//           display: inline-flex; align-items: center; justify-content: center;
//           min-width: 16px; height: 16px; padding: 0 4px;
//           border-radius: 8px; background: #e5e7eb; color: #6b7280;
//           font-size: 10px; font-weight: 700;
//         }
//         .msgs-list { display: flex; flex-direction: column; gap: 6px; max-height: 320px; overflow-y: auto; }
//         .msg-row {
//           display: flex; align-items: center; justify-content: space-between; gap: 10px;
//           padding: 9px 12px; background: #fff; border-radius: 8px;
//           border: 1px solid #f3f4f6; transition: background 0.12s;
//         }
//         .msg-row:hover { background: #f9fafb; }
//         .msg-row-left  { display: flex; align-items: center; gap: 8px; min-width: 0; }
//         .msg-avatar    {
//           width: 28px; height: 28px; border-radius: 8px;
//           background: #f0fdf4; color: #10b981;
//           display: flex; align-items: center; justify-content: center;
//           font-size: 12px; font-weight: 700; flex-shrink: 0;
//         }
//         .msg-info  { min-width: 0; }
//         .msg-name  { font-size: 12.5px; font-weight: 600; color: #111827; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
//         .msg-phone { font-size: 11.5px; color: #9ca3af; }
//         .msg-row-right { display: flex; flex-direction: column; align-items: flex-end; gap: 3px; flex-shrink: 0; }
//         .msg-time  { font-size: 11px; color: #d1d5db; }
//         .msg-status-badge { display: inline-flex; align-items: center; padding: 2px 8px; border-radius: 10px; font-size: 11px; font-weight: 600; }
//         .msg-error {
//           display: flex; align-items: center; gap: 3px;
//           font-size: 10.5px; color: #ef4444; max-width: 200px; text-align: right;
//         }
//       `}</style>
//     </>
//   );
// }

// // ── Pagination Component ──────────────────────────────────────────────────────
// function Pagination({ currentPage, totalPages, onPageChange }) {
//   if (totalPages <= 1) return null;

//   const getPages = () => {
//     if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);
//     const pages = [];
//     if (currentPage <= 4) {
//       pages.push(1, 2, 3, 4, 5, "…", totalPages);
//     } else if (currentPage >= totalPages - 3) {
//       pages.push(1, "…", totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages);
//     } else {
//       pages.push(1, "…", currentPage - 1, currentPage, currentPage + 1, "…", totalPages);
//     }
//     return pages;
//   };

//   return (
//     <div className="pagination-bar">
//       <button className="pg-btn pg-arrow" onClick={() => onPageChange(currentPage - 1)} disabled={currentPage === 1}>
//         <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
//           <polyline points="15 18 9 12 15 6"/>
//         </svg>
//         Prev
//       </button>
//       <div className="pg-numbers">
//         {getPages().map((p, i) =>
//           p === "…"
//             ? <span key={`ellipsis-${i}`} className="pg-ellipsis">…</span>
//             : <button key={p} className={`pg-btn pg-num ${currentPage === p ? "active" : ""}`} onClick={() => onPageChange(p)}>{p}</button>
//         )}
//       </div>
//       <button className="pg-btn pg-arrow" onClick={() => onPageChange(currentPage + 1)} disabled={currentPage === totalPages}>
//         Next
//         <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
//           <polyline points="9 18 15 12 9 6"/>
//         </svg>
//       </button>
//     </div>
//   );
// }

// // ── Template History Tab ──────────────────────────────────────────────────────
// function MiniBar({ delivered, failed, total }) {
//   if (total === 0) return <span style={{ color: "#d1d5db", fontSize: 12 }}>—</span>;
//   const dPct = (delivered / total) * 100;
//   const fPct = (failed    / total) * 100;
//   const pPct = Math.max(0, 100 - dPct - fPct);
//   return (
//     <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
//       <div style={{ width: 80, height: 6, borderRadius: 99, background: "#f3f4f6", display: "flex", overflow: "hidden", gap: 1, flexShrink: 0 }}>
//         {dPct > 0 && <div style={{ width: `${dPct}%`, background: "#10b981", borderRadius: 99 }} />}
//         {pPct > 0 && <div style={{ width: `${pPct}%`, background: "#fbbf24", borderRadius: 99 }} />}
//         {fPct > 0 && <div style={{ width: `${fPct}%`, background: "#ef4444", borderRadius: 99 }} />}
//       </div>
//     </div>
//   );
// }

// function ExpandedDetail({ row }) {
//   const rate    = row.total > 0 ? Math.round((row.delivered / row.total) * 100) : 0;
//   const pending = Math.max(0, row.total - row.delivered - row.failed);
//   const rs      = rateStyle(rate);
//   return (
//     <tr>
//       <td colSpan={8} style={{ padding: "0 12px 14px 44px", background: "#fafafa" }}>
//         <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
//           {[
//             { label: "Delivered", value: row.delivered.toLocaleString(), color: "#10b981", bg: "#ecfdf5" },
//             { label: "Failed",    value: row.failed.toLocaleString(),    color: "#ef4444", bg: "#fef2f2" },
//             { label: "Pending",   value: pending.toLocaleString(),       color: "#f59e0b", bg: "#fffbeb" },
//           ].map(s => (
//             <div key={s.label} style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "8px 16px", borderRadius: 10, background: s.bg, minWidth: 90 }}>
//               <span style={{ fontSize: 18, fontWeight: 700, color: s.color }}>{s.value}</span>
//               <span style={{ fontSize: 11, color: "#6b7280", marginTop: 2 }}>{s.label}</span>
//             </div>
//           ))}
//           <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "8px 16px", borderRadius: 10, minWidth: 90, ...rs }}>
//             <span style={{ fontSize: 18, fontWeight: 700 }}>{rate}%</span>
//             <span style={{ fontSize: 11, marginTop: 2, opacity: 0.75 }}>Success rate</span>
//           </div>
//           <div style={{ width: "100%", marginTop: 4 }}>
//             <div style={{ height: 8, borderRadius: 99, background: "#f3f4f6", display: "flex", overflow: "hidden", gap: 1 }}>
//               {row.total > 0 && <>
//                 {row.delivered > 0 && <div style={{ width: `${(row.delivered / row.total) * 100}%`, background: "#10b981", borderRadius: 99, transition: "width 0.5s ease" }} />}
//                 {pending > 0       && <div style={{ width: `${(pending       / row.total) * 100}%`, background: "#fbbf24", borderRadius: 99 }} />}
//                 {row.failed > 0    && <div style={{ width: `${(row.failed    / row.total) * 100}%`, background: "#ef4444", borderRadius: 99 }} />}
//               </>}
//             </div>
//           </div>
//         </div>
//       </td>
//     </tr>
//   );
// }

// function SortIcon({ col, sortCol, sortDesc }) {
//   const active = sortCol === col;
//   return (
//     <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke={active ? "#10b981" : "#d1d5db"}
//       strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginLeft: 4, flexShrink: 0 }}>
//       {active && !sortDesc
//         ? <><line x1="12" y1="20" x2="12" y2="4"/><polyline points="18 10 12 4 6 10"/></>
//         : <><line x1="12" y1="4"  x2="12" y2="20"/><polyline points="6 14 12 20 18 14"/></>
//       }
//     </svg>
//   );
// }

// function TemplateHistoryTab({ history, histLoading, onRefresh }) {
//   const [search,   setSearch]   = useState("");
//   const [sortCol,  setSortCol]  = useState("total");
//   const [sortDesc, setSortDesc] = useState(true);
//   const [expanded, setExpanded] = useState(null);
//   const [currentPage, setCurrentPage] = useState(1);
//   const ROWS_PER_PAGE = 10;

//   const rows = useMemo(() => {
//     let data = calcTemplateStats(history);
//     if (search.trim()) {
//       const q = search.toLowerCase();
//       data = data.filter(r => r.name.toLowerCase().includes(q));
//     }
//     return [...data].sort((a, b) => {
//       if (sortCol === "name") return sortDesc ? b.name.localeCompare(a.name) : a.name.localeCompare(b.name);
//       let av, bv;
//       if      (sortCol === "campaigns") { av = a.campaigns; bv = b.campaigns; }
//       else if (sortCol === "total")     { av = a.total;     bv = b.total;     }
//       else if (sortCol === "delivered") { av = a.delivered; bv = b.delivered; }
//       else if (sortCol === "failed")    { av = a.failed;    bv = b.failed;    }
//       else if (sortCol === "rate")      { av = a.total > 0 ? a.delivered / a.total : 0; bv = b.total > 0 ? b.delivered / b.total : 0; }
//       else if (sortCol === "lastUsed")  { av = a.lastUsed ? new Date(a.lastUsed).getTime() : 0; bv = b.lastUsed ? new Date(b.lastUsed).getTime() : 0; }
//       return sortDesc ? bv - av : av - bv;
//     });
//   }, [history, search, sortCol, sortDesc]);

//   useEffect(() => { setCurrentPage(1); }, [search, sortCol, sortDesc]);

//   const totalPages    = Math.max(1, Math.ceil(rows.length / ROWS_PER_PAGE));
//   const paginatedRows = rows.slice((currentPage - 1) * ROWS_PER_PAGE, currentPage * ROWS_PER_PAGE);

//   const agg = useMemo(() => rows.reduce((acc, r) => {
//     acc.campaigns += r.campaigns;
//     acc.total     += r.total;
//     acc.delivered += r.delivered;
//     acc.failed    += r.failed;
//     return acc;
//   }, { campaigns: 0, total: 0, delivered: 0, failed: 0 }), [rows]);

//   const aggRate = agg.total > 0 ? Math.round((agg.delivered / agg.total) * 100) : 0;

//   const handleSort = (col) => {
//     if (sortCol === col) setSortDesc(p => !p);
//     else { setSortCol(col); setSortDesc(true); }
//   };

//   const TH = ({ col, label, align = "right" }) => (
//     <th onClick={() => handleSort(col)} style={{
//       padding: "10px 12px", fontSize: 11.5, fontWeight: 600,
//       color: sortCol === col ? "#10b981" : "#9ca3af",
//       textAlign: align, cursor: "pointer", whiteSpace: "nowrap", userSelect: "none",
//     }}>
//       <span style={{ display: "inline-flex", alignItems: "center", gap: 2 }}>
//         {label}<SortIcon col={col} sortCol={sortCol} sortDesc={sortDesc} />
//       </span>
//     </th>
//   );

//   if (histLoading) {
//     return (
//       <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "60px 24px", gap: 12 }}>
//         <div className="sch-spinner" />
//         <p style={{ margin: 0, color: "#9ca3af", fontSize: 14 }}>Loading template stats…</p>
//       </div>
//     );
//   }

//   if (rows.length === 0 && !search) {
//     return (
//       <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "60px 24px", gap: 10, color: "#9ca3af" }}>
//         <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="#d1d5db" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
//           <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
//         </svg>
//         <p style={{ margin: 0, fontSize: 15, fontWeight: 500, color: "#6b7280" }}>No template data yet</p>
//         <span style={{ fontSize: 13 }}>Send some campaigns first to see stats here</span>
//       </div>
//     );
//   }

//   return (
//     <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
//       {rows.length > 0 && (
//         <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", background: "#fff", borderRadius: 12, border: "1px solid #e5e7eb", padding: "16px 24px" }}>
//           {[
//             { label: "Templates",  value: rows.length,                       color: "#374151"          },
//             { label: "Campaigns",  value: agg.campaigns,                     color: "#374151"          },
//             { label: "Recipients", value: agg.total.toLocaleString(),        color: "#374151"          },
//             { label: "Delivered",  value: agg.delivered.toLocaleString(),    color: "#10b981"          },
//             { label: "Failed",     value: agg.failed.toLocaleString(),       color: "#ef4444"          },
//             { label: "Avg. Rate",  value: `${aggRate}%`,                     color: rateColor(aggRate) },
//           ].map((s, i, arr) => (
//             <div key={s.label} style={{ display: "flex", alignItems: "center", flex: 1, minWidth: 100 }}>
//               <div style={{ display: "flex", flexDirection: "column" }}>
//                 <span style={{ fontSize: 20, fontWeight: 700, color: s.color, lineHeight: 1 }}>{s.value}</span>
//                 <span style={{ fontSize: 11.5, color: "#9ca3af", marginTop: 3 }}>{s.label}</span>
//               </div>
//               {i < arr.length - 1 && <div style={{ width: 1, height: 36, background: "#f3f4f6", margin: "0 20px", flexShrink: 0 }} />}
//             </div>
//           ))}
//         </div>
//       )}

//       <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
//         <div style={{ display: "flex", alignItems: "center", gap: 7, padding: "7px 12px", borderRadius: 8, border: "1.5px solid #e5e7eb", background: "#fff", color: "#9ca3af" }}>
//           <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
//             <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
//           </svg>
//           <input
//             placeholder="Search templates…"
//             value={search}
//             onChange={e => setSearch(e.target.value)}
//             style={{ border: "none", outline: "none", fontSize: 13, color: "#374151", background: "transparent", width: 200, fontFamily: "inherit" }}
//           />
//         </div>
//         <button onClick={onRefresh} disabled={histLoading} className="sch-refresh-btn">
//           <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
//             style={{ animation: histLoading ? "schSpin 0.8s linear infinite" : "none" }}>
//             <polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
//           </svg>
//           Refresh
//         </button>
//       </div>

//       <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #e5e7eb", overflow: "hidden" }}>
//         {rows.length === 0 ? (
//           <div style={{ padding: "40px 24px", textAlign: "center", color: "#9ca3af", fontSize: 13 }}>
//             No templates match your search.
//           </div>
//         ) : (
//           <div style={{ overflowX: "auto" }}>
//             <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
//               <thead>
//                 <tr style={{ borderBottom: "1.5px solid #f3f4f6" }}>
//                   <th style={{ width: 32, padding: "10px 0 10px 12px" }} />
//                   <TH col="name"      label="Template"     align="left" />
//                   <TH col="campaigns" label="Campaigns"                 />
//                   <TH col="total"     label="Recipients"                />
//                   <TH col="delivered" label="Delivered"                 />
//                   <TH col="failed"    label="Failed"                    />
//                   <TH col="rate"      label="Success Rate"              />
//                   <TH col="lastUsed"  label="Last Used"                 />
//                 </tr>
//               </thead>
//               <tbody>
//                 {paginatedRows.map(r => {
//                   const rate   = r.total > 0 ? Math.round((r.delivered / r.total) * 100) : 0;
//                   const isOpen = expanded === r.name;
//                   const rs     = rateStyle(rate);
//                   return [
//                     <tr
//                       key={r.name}
//                       onClick={() => setExpanded(p => p === r.name ? null : r.name)}
//                       style={{ borderBottom: "1px solid #f9fafb", cursor: "pointer", background: isOpen ? "#fafff9" : "transparent", transition: "background 0.12s" }}
//                       onMouseEnter={e => { if (!isOpen) e.currentTarget.style.background = "#f9fafb"; }}
//                       onMouseLeave={e => { if (!isOpen) e.currentTarget.style.background = "transparent"; }}
//                     >
//                       <td style={{ padding: "12px 0 12px 14px", color: "#9ca3af" }}>
//                         <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor"
//                           strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
//                           style={{ transition: "transform 0.2s", transform: isOpen ? "rotate(90deg)" : "none" }}>
//                           <polyline points="9 18 15 12 9 6"/>
//                         </svg>
//                       </td>
//                       <td style={{ padding: "12px", textAlign: "left" }}>
//                         <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
//                           <div style={{ width: 28, height: 28, borderRadius: 8, background: "#f0fdfa", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
//                             <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
//                               <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
//                             </svg>
//                           </div>
//                           <div>
//                             <div style={{ fontWeight: 600, color: "#111827", fontSize: 13.5 }}>{r.name}</div>
//                             {r.metaTemplateName && (
//                               <div style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 3 }}>
//                                 <span style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "1px 7px", borderRadius: 6, background: "#f0fdf4", border: "1px solid #bbf7d0", color: "#065f46", fontSize: 11, fontWeight: 600 }}>
//                                   <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
//                                     <rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/>
//                                   </svg>
//                                   {r.metaTemplateName}
//                                 </span>
//                               </div>
//                             )}
//                             <MiniBar delivered={r.delivered} failed={r.failed} total={r.total} />
//                           </div>
//                         </div>
//                       </td>
//                       <td style={{ padding: "12px", textAlign: "right", fontWeight: 600, color: "#374151" }}>{r.campaigns}</td>
//                       <td style={{ padding: "12px", textAlign: "right", fontWeight: 600, color: "#374151" }}>{r.total.toLocaleString()}</td>
//                       <td style={{ padding: "12px", textAlign: "right", fontWeight: 700, color: "#10b981" }}>{r.delivered.toLocaleString()}</td>
//                       <td style={{ padding: "12px", textAlign: "right", fontWeight: 700, color: r.failed > 0 ? "#ef4444" : "#9ca3af" }}>{r.failed.toLocaleString()}</td>
//                       <td style={{ padding: "12px", textAlign: "right" }}>
//                         <span style={{ padding: "3px 10px", borderRadius: 10, fontSize: 12, fontWeight: 700, ...rs }}>{rate}%</span>
//                       </td>
//                       <td style={{ padding: "12px", textAlign: "right", color: "#9ca3af", fontSize: 12, whiteSpace: "nowrap" }}>{formatDate(r.lastUsed)}</td>
//                     </tr>,
//                     isOpen && <ExpandedDetail key={`${r.name}-detail`} row={r} />,
//                   ];
//                 })}
//               </tbody>

//               {rows.length > 1 && (
//                 <tfoot>
//                   <tr style={{ borderTop: "2px solid #f3f4f6", background: "#fafafa" }}>
//                     <td />
//                     <td style={{ padding: "10px 12px", fontWeight: 700, color: "#374151", fontSize: 12.5 }}>
//                       Totals ({rows.length} templates)
//                     </td>
//                     <td style={{ padding: "10px 12px", textAlign: "right", fontWeight: 700, color: "#374151" }}>{agg.campaigns}</td>
//                     <td style={{ padding: "10px 12px", textAlign: "right", fontWeight: 700, color: "#374151" }}>{agg.total.toLocaleString()}</td>
//                     <td style={{ padding: "10px 12px", textAlign: "right", fontWeight: 700, color: "#10b981" }}>{agg.delivered.toLocaleString()}</td>
//                     <td style={{ padding: "10px 12px", textAlign: "right", fontWeight: 700, color: "#ef4444" }}>{agg.failed.toLocaleString()}</td>
//                     <td style={{ padding: "10px 12px", textAlign: "right" }}>
//                       <span style={{ padding: "3px 10px", borderRadius: 10, fontSize: 12, fontWeight: 700, ...rateStyle(aggRate) }}>{aggRate}%</span>
//                     </td>
//                     <td />
//                   </tr>
//                 </tfoot>
//               )}
//             </table>

//             <div style={{ padding: "12px 16px", borderTop: "1px solid #f3f4f6", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
//               <span style={{ fontSize: 12, color: "#9ca3af" }}>
//                 {rows.length === 0 ? "No results" : `Showing ${(currentPage - 1) * ROWS_PER_PAGE + 1}–${Math.min(currentPage * ROWS_PER_PAGE, rows.length)} of ${rows.length}`}
//               </span>
//               <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} />
//             </div>
//           </div>
//         )}
//       </div>
//     </div>
//   );
// }

// // ── Main Component ────────────────────────────────────────────────────────────
// export default function CreateCampaign() {
//   const [templates,        setTemplates]        = useState([]);
//   const [contacts,         setContacts]         = useState([]);
//   const [selectedContacts, setSelectedContacts] = useState([]);
//   const [templateId,       setTemplateId]       = useState("");
//   const [name,             setName]             = useState("");
//   const [searchQuery,      setSearchQuery]      = useState("");
//   const [sending,          setSending]          = useState(false);
//   const [sent,             setSent]             = useState(false);

//   const [sendNow,     setSendNow]     = useState(true);
//   const [scheduledAt, setScheduledAt] = useState("");

//   const [activeTab,    setActiveTab]    = useState("create");
//   const [history,      setHistory]      = useState([]);
//   const [histLoading,  setHistLoading]  = useState(false);
//   const [histFilter,   setHistFilter]   = useState("ALL");
//   const [histSearch,   setHistSearch]   = useState("");
//   const [histSortDesc, setHistSortDesc] = useState(true);

//   const [histPage, setHistPage] = useState(1);
//   const HIST_PER_PAGE = 10;

//   const historyFetched = useRef(false);

//   const loadHistory = useCallback(async () => {
//     setHistLoading(true);
//     try {
//       const r = await api.get("/api/campaigns/history");
//       const raw = Array.isArray(r.data) ? r.data : [];
//       setHistory(raw.map(normalizeCampaign));
//     } catch (err) {
//       console.error(err);
//       setHistory([]);
//     } finally {
//       setHistLoading(false);
//     }
//   }, []);

//   useEffect(() => {
//     api.get("/api/templates").then(r => setTemplates(r.data));
//     api.get("/api/contacts").then(r => setContacts(r.data));
//   }, []);

//   useEffect(() => {
//     if (activeTab !== "history" && activeTab !== "templates") return;
//     loadHistory();
//     const interval = setInterval(loadHistory, 60000);
//     return () => clearInterval(interval);
//   }, [activeTab, loadHistory]);

//   useEffect(() => { setHistPage(1); }, [histFilter, histSearch, histSortDesc]);

//   const minDateTime = (() => {
//     const d = new Date();
//     d.setSeconds(0, 0);
//     d.setMinutes(d.getMinutes() + 1);
//     return d.toISOString().slice(0, 16);
//   })();

//   const filteredContacts = contacts.filter(c =>
//     c.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
//     c.phone?.includes(searchQuery)
//   );

//   const toggleContact = (id) =>
//     setSelectedContacts(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

//   const selectAll = () => {
//     const visibleIds = filteredContacts.map(c => getCampaignId(c));
//     const allVisibleSelected = visibleIds.every(id => selectedContacts.includes(id));
//     if (allVisibleSelected) {
//       setSelectedContacts(prev => prev.filter(id => !visibleIds.includes(id)));
//     } else {
//       setSelectedContacts(prev => [...new Set([...prev, ...visibleIds])]);
//     }
//   };

//   const submit = async () => {
//     if (!name || !templateId || selectedContacts.length === 0) {
//       alert("Please fill all fields and select at least one contact.");
//       return;
//     }
//     if (!sendNow && !scheduledAt) {
//       alert("Please select a scheduled date and time.");
//       return;
//     }
//     if (!sendNow && new Date(scheduledAt) <= new Date()) {
//       alert("Scheduled time must be in the future.");
//       return;
//     }
//     setSending(true);
//     try {
//       await api.post("/api/campaigns", {
//         name,
//         templateId,
//         contactIds: selectedContacts,
//         sendNow,
//         scheduledAt: sendNow ? null : new Date(scheduledAt).toISOString(),
//       });
//       setSent(true);
//       setTimeout(() => setSent(false), 3000);
//       setName(""); setTemplateId(""); setSelectedContacts([]);
//       setSendNow(true); setScheduledAt("");
//       historyFetched.current = true;
//       loadHistory();
//     } catch { alert("Failed to send campaign."); }
//     finally { setSending(false); }
//   };

//   const selectedTemplate = templates.find(t => String(t.id) === String(templateId));

//   const scheduleLabel = sendNow
//     ? "Send immediately"
//     : scheduledAt
//       ? new Date(scheduledAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })
//       : "Not set";

//   const histCounts = history.reduce((a, c) => { a[c.status] = (a[c.status] || 0) + 1; return a; }, {});

//   const histFiltered = history
//     .filter(c => histFilter === "ALL" || c.status === histFilter)
//     .filter(c => !histSearch ||
//       c.templateName?.toLowerCase().includes(histSearch.toLowerCase()) ||
//       c.metaTemplateName?.toLowerCase().includes(histSearch.toLowerCase()) ||
//       c.name?.toLowerCase().includes(histSearch.toLowerCase()))
//     .sort((a, b) => {
//       const da = new Date(a.scheduledAt || a.createdAt);
//       const db = new Date(b.scheduledAt || b.createdAt);
//       return histSortDesc ? db - da : da - db;
//     });

//   const histTotalPages     = Math.max(1, Math.ceil(histFiltered.length / HIST_PER_PAGE));
//   const histPageClamped    = Math.min(histPage, histTotalPages);
//   const histPagedCampaigns = histFiltered.slice(
//     (histPageClamped - 1) * HIST_PER_PAGE,
//     histPageClamped * HIST_PER_PAGE
//   );

//   const histTabs = [
//     { key: "ALL",       label: "All",       color: "#6b7280" },
//     { key: "QUEUED",    label: "Scheduled", color: "#0ea5e9" },
//     { key: "SENDING",   label: "Sending",   color: "#f59e0b" },
//     { key: "PAUSED",    label: "Paused",    color: "#8b5cf6" },
//     { key: "SENT",      label: "Sent",      color: "#10b981" },
//     { key: "FAILED",    label: "Failed",    color: "#ef4444" },
//     { key: "CANCELLED", label: "Cancelled", color: "#9ca3af" },
//   ];

//   const aggStats = history
//     .filter(c => !["CANCELLED", "QUEUED"].includes(c.status))
//     .reduce((acc, c) => {
//       acc.total     += Number(c.recipientCount ?? 0);
//       acc.delivered += Number(c.deliveredCount ?? c.sentCount ?? 0);
//       acc.failed    += Number(c.failedCount ?? 0);
//       return acc;
//     }, { total: 0, delivered: 0, failed: 0 });

//   return (
//     <div style={{ fontFamily: "'DM Sans', sans-serif", background: "#f0fdfa" }}>
//       <div className="campaign-container">
//         <div className="page-header">
//           <h1>Campaigns</h1>
//           <p>Create and manage your SMS campaigns</p>
//         </div>

//         {/* ── Tab nav ── */}
//         <div className="page-tabs">
//           <button className={`page-tab ${activeTab === "create" ? "active" : ""}`} onClick={() => setActiveTab("create")}>
//             <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
//               <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
//             </svg>
//             Create Campaign
//           </button>
//           <button className={`page-tab ${activeTab === "history" ? "active" : ""}`} onClick={() => setActiveTab("history")}>
//             <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
//               <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
//             </svg>
//             Scheduled History
//             {history.length > 0 && <span className="page-tab-badge">{history.length}</span>}
//           </button>
//           <button className={`page-tab ${activeTab === "templates" ? "active" : ""}`} onClick={() => setActiveTab("templates")}>
//             <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
//               <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
//             </svg>
//             Template Status
//             {history.length > 0 && (
//               <span className="page-tab-badge" style={{ background: "#0ea5e9" }}>
//                 {calcTemplateStats(history).length}
//               </span>
//             )}
//           </button>
//         </div>

//         {/* ══ CREATE TAB ══ */}
//         {activeTab === "create" && (
//           <div className="layout">
//             <div className="left-panel">
//               <div className="card">
//                 <p className="card-title">Campaign Details</p>
//                 <div className="field-group">
//                   <label className="field-label">Campaign Name</label>
//                   <input className="field-input" placeholder="e.g. Summer Promo 2025" value={name} onChange={e => setName(e.target.value)} />
//                 </div>
//                 <div className="field-group" style={{ marginBottom: 0 }}>
//                   <label className="field-label">Message Template</label>
//                   <select className="field-input" value={templateId} onChange={e => setTemplateId(e.target.value)}>
//                     <option value="">Select a template...</option>
//                     {templates.map(t => <option key={t.id} value={t.id}>{t.metaTemplateName}</option>)}
//                   </select>
//                 </div>
//               </div>

//               <div className="card">
//                 <p className="card-title">Schedule</p>
//                 <div className="schedule-toggle">
//                   <button type="button" className={`schedule-toggle-btn ${sendNow ? "active" : ""}`} onClick={() => setSendNow(true)}>
//                     <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
//                       <path d="M22 2L11 13M22 2L15 22l-4-9-9-4 20-7z"/>
//                     </svg>
//                     Send Now
//                   </button>
//                   <button type="button" className={`schedule-toggle-btn ${!sendNow ? "active" : ""}`} onClick={() => setSendNow(false)}>
//                     <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
//                       <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
//                     </svg>
//                     Schedule for Later
//                   </button>
//                 </div>
//                 {!sendNow && (
//                   <div className="field-group" style={{ marginTop: 14, marginBottom: 0 }}>
//                     <label className="field-label">Scheduled Date &amp; Time</label>
//                     <input type="datetime-local" className="field-input" min={minDateTime} value={scheduledAt} onChange={e => setScheduledAt(e.target.value)} />
//                     <p className="field-hint">Time is interpreted in your local timezone and sent to the server as UTC.</p>
//                   </div>
//                 )}
//               </div>

//               <div className="card">
//                 <p className="card-title">Select Recipients</p>
//                 <div className="contact-search">
//                   <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
//                   <input placeholder="Search contacts..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
//                 </div>
//                 <div className="contact-list-header">
//                   <span className="contact-count">{filteredContacts.length} contact{filteredContacts.length !== 1 ? "s" : ""}</span>
//                   <button className="select-all-btn" onClick={selectAll}>
//                     {filteredContacts.length > 0 && filteredContacts.every(c => selectedContacts.includes(getCampaignId(c)))
//                       ? "Deselect all" : "Select all"}
//                   </button>
//                 </div>
//                 <div className="contact-list">
//                   {filteredContacts.length === 0 ? (
//                     <div className="empty-contacts">No contacts found</div>
//                   ) : (
//                     filteredContacts.map(c => {
//                       const id = getCampaignId(c);
//                       const isSelected = selectedContacts.includes(id);
//                       return (
//                         <div key={id} className={`contact-item ${isSelected ? "selected" : ""}`} onClick={() => toggleContact(id)}>
//                           <div className="contact-checkbox">
//                             {isSelected && (
//                               <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
//                                 <path d="M2 5l2.5 2.5L8 3" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
//                               </svg>
//                             )}
//                           </div>
//                           <div className="contact-info">
//                             <div className="contact-name">{c.name}</div>
//                             <div className="contact-phone">{c.phone}</div>
//                           </div>
//                           {c.tags && <span className="contact-tag">{c.tags}</span>}
//                         </div>
//                       );
//                     })
//                   )}
//                 </div>
//               </div>
//             </div>

//             <div className="summary-card" style={{ alignSelf: "flex-start", position: "sticky", top: 20 }}>
//               <p className="summary-title">Campaign Summary</p>
//               <div className="summary-row">
//                 <span className="summary-label">Name</span>
//                 <span className={`summary-value ${!name ? "empty" : ""}`}>{name || "Not set"}</span>
//               </div>
//               <div className="summary-row">
//                 <span className="summary-label">Template</span>
//                 <span className={`summary-value ${!selectedTemplate?.metaTemplateName ? "empty" : ""}`}>{selectedTemplate?.metaTemplateName || "Not selected"}</span>
//               </div>
//               <div className="summary-row">
//                 <span className="summary-label">Schedule</span>
//                 <span className={`summary-value ${!sendNow && !scheduledAt ? "empty" : ""}`}>{scheduleLabel}</span>
//               </div>
//               <div className="summary-row">
//                 <span className="summary-label">Recipients</span>
//                 {selectedContacts.length === 0 ? (
//                   <span className="summary-value empty">None selected</span>
//                 ) : (
//                   <div className="recipient-pills">
//                     {contacts.filter(c => selectedContacts.includes(getCampaignId(c))).slice(0, 3).map(c => (
//                       <span key={getCampaignId(c)} className="recipient-pill">{c.name}</span>
//                     ))}
//                     {selectedContacts.length > 3 && <span className="recipient-more">+{selectedContacts.length - 3} more</span>}
//                   </div>
//                 )}
//               </div>
//               <div className="stats-row">
//                 <div className="stat-box">
//                   <div className="stat-number">{selectedContacts.length}</div>
//                   <div className="stat-label">Recipients</div>
//                 </div>
//                 <div className="stat-box">
//                   <div className="stat-number">{contacts.length}</div>
//                   <div className="stat-label">Total</div>
//                 </div>
//               </div>
//               <button className={`send-btn ${sent ? "sent" : ""}`} onClick={submit} disabled={sending}>
//                 {sent ? (
//                   <><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M20 6L9 17l-5-5"/></svg>{sendNow ? "Campaign Sent!" : "Campaign Scheduled!"}</>
//                 ) : sending ? (
//                   sendNow ? "Sending..." : "Scheduling..."
//                 ) : (
//                   <><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">{sendNow ? <path d="M22 2L11 13M22 2L15 22l-4-9-9-4 20-7z"/> : <><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></>}</svg>{sendNow ? "Send Campaign" : "Schedule Campaign"}</>
//                 )}
//               </button>
//             </div>
//           </div>
//         )}

//         {/* ══ HISTORY TAB ══ */}
//         {activeTab === "history" && (
//           <div className="sch-panel">
//             {history.length > 0 && (
//               <div className="hist-summary-banner">
//                 <div className="hist-banner-stat">
//                   <div className="hist-banner-icon total-icon">
//                     <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
//                       <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
//                       <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
//                     </svg>
//                   </div>
//                   <div>
//                     <div className="hist-banner-val">{aggStats.total}</div>
//                     <div className="hist-banner-lbl">Total Sent</div>
//                   </div>
//                 </div>
//                 <div className="hist-banner-divider" />
//                 <div className="hist-banner-stat">
//                   <div className="hist-banner-icon delivered-icon">
//                     <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
//                       <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>
//                     </svg>
//                   </div>
//                   <div>
//                     <div className="hist-banner-val" style={{ color: "#10b981" }}>{aggStats.delivered}</div>
//                     <div className="hist-banner-lbl">Delivered</div>
//                   </div>
//                 </div>
//                 <div className="hist-banner-divider" />
//                 <div className="hist-banner-stat">
//                   <div className="hist-banner-icon failed-icon">
//                     <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
//                       <circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>
//                     </svg>
//                   </div>
//                   <div>
//                     <div className="hist-banner-val" style={{ color: "#ef4444" }}>{aggStats.failed}</div>
//                     <div className="hist-banner-lbl">Failed</div>
//                   </div>
//                 </div>
//                 <div className="hist-banner-divider" />
//                 <div className="hist-banner-stat">
//                   <div className="hist-banner-icon rate-icon">
//                     <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
//                       <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
//                     </svg>
//                   </div>
//                   <div>
//                     <div className="hist-banner-val" style={{ color: "#0ea5e9" }}>
//                       {aggStats.total > 0 ? Math.round((aggStats.delivered / aggStats.total) * 100) : 0}%
//                     </div>
//                     <div className="hist-banner-lbl">Success Rate</div>
//                   </div>
//                 </div>
//               </div>
//             )}

//             {/* Toolbar */}
//             <div className="sch-toolbar">
//               <div className="sch-filters">
//                 {histTabs.map(t => (
//                   <button
//                     key={t.key}
//                     className={`sch-filter-tab ${histFilter === t.key ? "active" : ""}`}
//                     style={histFilter === t.key ? { borderColor: t.color, color: t.color } : {}}
//                     onClick={() => setHistFilter(t.key)}
//                   >
//                     {t.label}
//                     <span className="sch-filter-count" style={histFilter === t.key ? { background: t.color } : {}}>
//                       {t.key === "ALL" ? history.length : (histCounts[t.key] || 0)}
//                     </span>
//                   </button>
//                 ))}
//               </div>
//               <div className="sch-toolbar-right">
//                 <div className="sch-search">
//                   <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
//                   <input placeholder="Search by template or campaign…" value={histSearch} onChange={e => setHistSearch(e.target.value)} />
//                 </div>
//                 <button className="sch-sort-btn" onClick={() => setHistSortDesc(p => !p)}>
//                   <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
//                     {histSortDesc ? <><line x1="12" y1="20" x2="12" y2="4"/><polyline points="18 10 12 4 6 10"/></> : <><line x1="12" y1="4" x2="12" y2="20"/><polyline points="6 14 12 20 18 14"/></>}
//                   </svg>
//                   {histSortDesc ? "Newest first" : "Oldest first"}
//                 </button>
//                 <button className="sch-refresh-btn" onClick={loadHistory} disabled={histLoading}>
//                   <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
//                     style={{ animation: histLoading ? "schSpin 0.8s linear infinite" : "none" }}>
//                     <polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
//                   </svg>
//                   Refresh
//                 </button>
//               </div>
//             </div>

//             {/* Campaign list */}
//             <div className="sch-list">
//               {histLoading ? (
//                 <div className="sch-empty"><div className="sch-spinner"/><p>Loading campaigns…</p></div>
//               ) : histFiltered.length === 0 ? (
//                 <div className="sch-empty">
//                   <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#d1d5db" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
//                     <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/>
//                     <line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
//                   </svg>
//                   <p>No campaigns found</p>
//                   <span>Try adjusting your filters or search</span>
//                 </div>
//               ) : (
//                 <>
//                   {histPagedCampaigns.map((c, index) => (
//                     <CampaignHistoryRow
//                       key={getCampaignId(c) || index}
//                       campaign={{ ...c, id: getCampaignId(c) || index }}
//                       onRefresh={loadHistory}
//                     />
//                   ))}
//                   <div className="hist-pagination-footer">
//                     <span className="hist-page-info">
//                       Showing {(histPageClamped - 1) * HIST_PER_PAGE + 1}–{Math.min(histPageClamped * HIST_PER_PAGE, histFiltered.length)} of {histFiltered.length} campaign{histFiltered.length !== 1 ? "s" : ""}
//                     </span>
//                     <Pagination
//                       currentPage={histPageClamped}
//                       totalPages={histTotalPages}
//                       onPageChange={setHistPage}
//                     />
//                   </div>
//                 </>
//               )}
//             </div>
//           </div>
//         )}

//         {/* ══ TEMPLATE STATS TAB ══ */}
//         {activeTab === "templates" && (
//           <TemplateHistoryTab
//             history={history}
//             histLoading={histLoading}
//             onRefresh={loadHistory}
//           />
//         )}
//       </div>
//     </div>
//   );
// }
import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import api from "../api/axios";
import DateRangeFilter, { dateRangeParams, presetDateRange } from "../components/common/DateRangeFilter";
import MediaLibraryDialog from "../components/media/MediaLibraryDialog";
import "../index.css";

// ── Constants ─────────────────────────────────────────────────────────────────
const RATE_GOOD = 80;
const RATE_OK   = 50;

const STATUS_CFG = {
  SCHEDULED: { label: "Scheduled", color: "#0ea5e9", bg: "#f0f9ff", border: "#bae6fd", dot: "#0ea5e9" },
  SENDING:   { label: "Sending",   color: "#f59e0b", bg: "#fffbeb", border: "#fde68a", dot: "#f59e0b" },
  PAUSED:    { label: "Paused",    color: "#8b5cf6", bg: "#f5f3ff", border: "#ddd6fe", dot: "#8b5cf6" },
  SENT:      { label: "Sent",      color: "#10b981", bg: "#ecfdf5", border: "#6ee7b7", dot: "#10b981" },
  FAILED:    { label: "Failed",    color: "#ef4444", bg: "#fef2f2", border: "#fecaca", dot: "#ef4444" },
  CANCELLED: { label: "Cancelled", color: "#9ca3af", bg: "#f9fafb", border: "#e5e7eb", dot: "#9ca3af" },
};

// ── Pending status variants to filter out ─────────────────────────────────────
const PENDING_STATUSES = new Set([
  "PENDING",
  "OUTBOUND_PENDING",
  "QUEUED",
  "OUTBOUND_QUEUED",
]);

const isPending = (status) => PENDING_STATUSES.has(status?.toUpperCase?.() ?? "");
const hasNoBody = (msg) =>
  !msg.body || msg.body === "(No text body stored)" || msg.body?.trim() === "";

function parseTemplateComponents(template) {
  try {
    const parsed = JSON.parse(template?.componentsJson || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function templateHeaderMediaFormat(template) {
  const header = parseTemplateComponents(template).find((component) => String(component?.type || "").toUpperCase() === "HEADER");
  const format = String(header?.format || "").toUpperCase();
  return ["IMAGE", "VIDEO", "DOCUMENT"].includes(format) ? format : "";
}

function templateComponent(template, type) {
  return parseTemplateComponents(template).find((component) => String(component?.type || "").toUpperCase() === type);
}

function templateBodyText(template) {
  if (template?.body) return template.body;
  return templateComponent(template, "BODY")?.text || "";
}

function templateFooterText(template) {
  if (template?.footer) return template.footer;
  return templateComponent(template, "FOOTER")?.text || "";
}

function templateButtons(template) {
  const buttons = templateComponent(template, "BUTTONS")?.buttons;
  return Array.isArray(buttons) ? buttons : [];
}

function templateVariableCount(text) {
  let max = 0;
  for (const match of String(text || "").matchAll(/\{\{\s*(\d+)\s*}}/g)) {
    max = Math.max(max, Number(match[1]));
  }
  return max;
}

function templateExampleValues(component, exampleKey) {
  const raw = component?.example?.[exampleKey];
  const values = Array.isArray(raw?.[0]) ? raw[0] : raw;
  return Array.isArray(values) ? values.map((value) => String(value ?? "")) : [];
}

function templatePreviewBodyParameters(template) {
  const body = templateComponent(template, "BODY");
  const examples = templateExampleValues(body, "body_text");
  if (examples.length) return examples;
  return Array.from({ length: templateVariableCount(templateBodyText(template)) }, (_, index) => `Sample ${index + 1}`);
}

function renderTemplatePreview(text, params = []) {
  return String(text || "[WhatsApp template]").replace(/\{\{\s*(\d+)\s*}}/g, (_, index) => {
    const value = params[Number(index) - 1];
    return value?.trim() || `{{${index}}}`;
  });
}

function WhatsAppTemplatePreview({ template, headerMediaUrl }) {
  if (!template) return null;

  const header = templateComponent(template, "HEADER");
  const headerFormat = String(header?.format || template.headerType || "").toUpperCase();
  const bodyParams = templatePreviewBodyParameters(template);
  const headerParams = templateExampleValues(header, "header_text");
  const headerText = headerFormat === "TEXT"
    ? renderTemplatePreview(header?.text || template.headerText || "", headerParams.length ? headerParams : bodyParams)
    : "";
  const body = renderTemplatePreview(templateBodyText(template), bodyParams);
  const footer = templateFooterText(template);
  const buttons = templateButtons(template);
  const mediaUrl = headerMediaUrl?.trim();
  const templateMeta = [template.languageCode, template.category].filter(Boolean).join(" · ");

  return (
    <div style={{ marginTop: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", marginBottom: 8 }}>
        <div>
          <p className="field-label" style={{ marginBottom: 2 }}>WhatsApp Preview</p>
          <p className="field-hint" style={{ margin: 0 }}>This is how the campaign template will feel before sending.</p>
        </div>
        {templateMeta && (
          <span style={{
            border: "1px solid #d1fae5",
            borderRadius: 999,
            color: "#047857",
            background: "#ecfdf5",
            fontSize: 11,
            fontWeight: 800,
            padding: "5px 9px",
            whiteSpace: "nowrap",
          }}>
            {templateMeta}
          </span>
        )}
      </div>
      <div style={{
        background: "#e5ddd5",
        border: "1px solid #dbeafe",
        borderRadius: 16,
        padding: 14,
        boxShadow: "inset 0 1px 0 rgba(255,255,255,0.45)",
      }}>
        <div style={{
          maxWidth: 360,
          margin: "0 auto",
          background: "#fff",
          borderRadius: "4px 16px 16px 16px",
          boxShadow: "0 8px 24px rgba(15,23,42,0.10)",
          padding: 10,
          color: "#111827",
        }}>
          {headerFormat === "IMAGE" && mediaUrl && (
            <img src={mediaUrl} alt="Template header" style={{ width: "100%", maxHeight: 220, objectFit: "cover", borderRadius: 12, marginBottom: 10 }} />
          )}
          {headerFormat === "VIDEO" && mediaUrl && (
            <video controls style={{ width: "100%", maxHeight: 220, background: "#111827", borderRadius: 12, marginBottom: 10 }}>
              <source src={mediaUrl} />
            </video>
          )}
          {headerFormat === "DOCUMENT" && mediaUrl && (
            <a href={mediaUrl} target="_blank" rel="noreferrer" style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              border: "1px solid #e5e7eb",
              borderRadius: 12,
              background: "#f9fafb",
              color: "#111827",
              textDecoration: "none",
              padding: 12,
              marginBottom: 10,
              fontSize: 13,
              fontWeight: 800,
            }}>
              <span aria-hidden="true">DOC</span>
              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>Document header</span>
            </a>
          )}
          {headerFormat && headerFormat !== "TEXT" && !mediaUrl && (
            <div style={{
              height: 130,
              border: "1px dashed #cbd5e1",
              borderRadius: 12,
              background: "#f8fafc",
              color: "#64748b",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 12,
              fontWeight: 900,
              letterSpacing: 0.4,
              marginBottom: 10,
              textTransform: "uppercase",
            }}>
              {headerFormat} header required
            </div>
          )}
          {headerText && (
            <p style={{ margin: "0 0 8px", whiteSpace: "pre-wrap", overflowWrap: "anywhere", fontSize: 14, lineHeight: 1.45, fontWeight: 900 }}>
              {headerText}
            </p>
          )}
          <p style={{ margin: 0, whiteSpace: "pre-wrap", overflowWrap: "anywhere", fontSize: 14, lineHeight: 1.55 }}>
            {body}
          </p>
          {footer && (
            <p style={{ margin: "8px 0 0", whiteSpace: "pre-wrap", overflowWrap: "anywhere", color: "#6b7280", fontSize: 12, lineHeight: 1.4 }}>
              {footer}
            </p>
          )}
          {buttons.length > 0 && (
            <div style={{ marginTop: 10, borderTop: "1px solid #f1f5f9" }}>
              {buttons.map((button, index) => (
                <div
                  key={`${button.type || "button"}-${index}`}
                  style={{
                    display: "flex",
                    justifyContent: "center",
                    alignItems: "center",
                    gap: 8,
                    padding: "10px 6px",
                    borderBottom: index < buttons.length - 1 ? "1px solid #f1f5f9" : "none",
                    color: "#0284c7",
                    fontSize: 13,
                    fontWeight: 900,
                    textAlign: "center",
                  }}
                >
                  <span aria-hidden="true">↗</span>
                  <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {button.text || button.url || button.phone_number || "Button"}
                  </span>
                </div>
              ))}
            </div>
          )}
          <div style={{ marginTop: 6, textAlign: "right", fontSize: 10, color: "#94a3b8" }}>Template preview</div>
        </div>
      </div>
    </div>
  );
}

function isMetaSampleMediaUrl(value) {
  try {
    const hostname = new URL(value).hostname.toLowerCase();
    return hostname.includes("scontent.whatsapp.net") || hostname.includes("lookaside.fbsbx.com");
  } catch {
    return false;
  }
}

function isPublicHttpsUrl(value) {
  try {
    const parsed = new URL(value);
    const hostname = parsed.hostname.toLowerCase();
    return parsed.protocol === "https:" &&
      hostname !== "localhost" &&
      hostname !== "127.0.0.1" &&
      hostname !== "::1" &&
      !hostname.endsWith(".local");
  } catch {
    return false;
  }
}

const calcPendingCount = ({ total = 0, pending, sent = 0, delivered = 0, read = 0, failed = 0, cancelled = 0 }) => {
  if (pending !== undefined && pending !== null) return Math.max(0, Number(pending) || 0);
  return Math.max(
    0,
    Number(total || 0)
      - Number(sent || 0)
      - Number(delivered || 0)
      - Number(read || 0)
      - Number(failed || 0)
      - Number(cancelled || 0)
  );
};

// ── API Response Normalizer ───────────────────────────────────────────────────
const normalizeCampaign = (c) => {
  const recipientCount =
    c.totalMessages     ??
    c.recipientCount    ??
    c.totalRecipients   ??
    (Array.isArray(c.contactIds) ? c.contactIds.length : 0);

  const sentCount =
    c.sentMessages  ??
    c.sentCount     ??
    c.sent          ??
    0;

  const deliveredCount =
    c.deliveredMessages ??
    c.deliveredCount    ??
    c.delivered         ??
    0;

  const failedCount =
    c.failedMessages ??
    c.failedCount    ??
    c.failed         ??
    0;

  const cancelledCount =
    c.cancelledMessages ??
    c.cancelledCount    ??
    c.cancelled         ??
    0;

  const readCount =
    c.readMessages ??
    c.readCount    ??
    c.read         ??
    0;

  const pendingCount = calcPendingCount({
    total: recipientCount,
    pending: c.pendingMessages ?? c.pendingCount ?? c.pending,
    sent: sentCount,
    delivered: deliveredCount,
    read: readCount,
    failed: failedCount,
    cancelled: cancelledCount,
  });

  // ── FIX: comprehensive status normalization covering all queue variants ──
  let status = (c.status ?? "SCHEDULED").toUpperCase();

  if (status === "COMPLETED")        status = "SENT";
  if (status === "QUEUED")           status = "SCHEDULED";
  if (status === "PENDING")          status = "SCHEDULED";
  if (status === "OUTBOUND_QUEUED")  status = "SCHEDULED";
  if (status === "OUTBOUND_PENDING") status = "SCHEDULED";
  if (status === "IN_PROGRESS")      status = "SENDING";
  if (status === "PROCESSING")       status = "SENDING";
  if (status === "RUNNING")          status = "SENDING";
  if (status === "DRAFT")            status = "SCHEDULED";
  if (status === "CANCELED")         status = "CANCELLED";

  // Fallback: if still not a known status, default to SCHEDULED
  if (!STATUS_CFG[status]) status = "SCHEDULED";

  return {
    ...c,
    id:               c.campaignId ?? c.id ?? c._id,
    recipientCount,
    sentCount,
    deliveredCount,
    failedCount,
    cancelledCount,
    readCount,
    pendingCount,
    status,
    metaTemplateName: c.metaTemplateName ?? c.templateName ?? c.name ?? "—",
  };
};

// ── Shared helpers ────────────────────────────────────────────────────────────
const getCampaignId = (c) => c.campaignId ?? c.id ?? c._id;
const labelFor = (value) => String(value || "").replaceAll("_", " ");

function apiErrorMessage(error, fallback = "Request failed") {
  const data = error?.response?.data;
  if (typeof data === "string") return data;
  const metaDetails = data?.error_data?.details || data?.error?.error_data?.details;
  const metaMessage = data?.error?.message;
  return data?.message || data?.error || metaDetails || metaMessage || error?.message || fallback;
}

function rateStyle(rate) {
  if (rate >= RATE_GOOD) return { color: "#065f46", background: "#d1fae5", border: "1px solid #6ee7b7" };
  if (rate >= RATE_OK)   return { color: "#92400e", background: "#fef3c7", border: "1px solid #fde68a" };
  return                        { color: "#991b1b", background: "#fee2e2", border: "1px solid #fecaca" };
}

function rateColor(rate) {
  if (rate >= RATE_GOOD) return "#10b981";
  if (rate >= RATE_OK)   return "#f59e0b";
  return "#ef4444";
}

function formatDateTime(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

function formatDate(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(undefined, { dateStyle: "medium" });
}

// ── useCountdown ──────────────────────────────────────────────────────────────
function useCountdown(scheduledAt, status) {
  const [display, setDisplay] = useState("");
  useEffect(() => {
    if (status !== "SCHEDULED" || !scheduledAt) { setDisplay(""); return; }
    const tick = () => {
      const diff = new Date(scheduledAt) - Date.now();
      if (diff <= 0) { setDisplay("Imminent"); return; }
      const d = Math.floor(diff / 86400000);
      const h = Math.floor((diff % 86400000) / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setDisplay(d > 0 ? `${d}d ${h}h ${m}m` : h > 0 ? `${h}h ${m}m ${s}s` : `${m}m ${s}s`);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [scheduledAt, status]);
  return display;
}

// ── calcTemplateStats ─────────────────────────────────────────────────────────
function calcTemplateStats(history) {
  const map = {};
  history
    .filter(c => !["CANCELLED", "SCHEDULED"].includes(c.status))
    .forEach(c => {
      const key = c.metaTemplateName || c.templateName || "Unknown";
      if (!map[key]) {
        map[key] = {
          name: key,
          metaTemplateName: c.metaTemplateName || c.templateName || null,
          campaigns: 0,
          total: 0,
          delivered: 0,
          read: 0,
          sent: 0,
          pending: 0,
          failed: 0,
          cancelled: 0,
          lastUsed: null,
        };
      }
      const e = map[key];
      e.campaigns  += 1;
      e.total      += c.recipientCount ?? 0;
      e.delivered  += c.deliveredCount ?? 0;
      e.read       += c.readCount ?? 0;
      e.sent       += c.sentCount ?? 0;
      e.pending    += c.pendingCount ?? 0;
      e.failed     += c.failedCount    ?? 0;
      e.cancelled  += c.cancelledCount ?? 0;
      const ts = c.scheduledAt || c.createdAt;
      if (ts && (!e.lastUsed || new Date(ts) > new Date(e.lastUsed))) e.lastUsed = ts;
    });
  return Object.values(map).sort((a, b) => b.total - a.total);
}

// ── Delivery Stats Bar ────────────────────────────────────────────────────────
function DeliveryStats({ campaign }) {
  const total     = campaign.recipientCount ?? 0;
  const delivered = campaign.deliveredCount ?? 0;
  const read      = campaign.readCount      ?? 0;
  const sent      = campaign.sentCount      ?? 0;
  const failed    = campaign.failedCount    ?? 0;
  const cancelled = campaign.cancelledCount ?? 0;
  const pending   = calcPendingCount({ total, pending: campaign.pendingCount, sent, delivered, read, failed, cancelled });

  if (!["SENT", "SENDING", "FAILED", "PAUSED"].includes(campaign.status)) return null;
  if (total === 0) return null;

  const deliveredPct = (delivered / total) * 100;
  const failedPct    = (failed    / total) * 100;
  const pendingPct   = (pending   / total) * 100;
  const successRate  = Math.round((delivered / total) * 100);
  const rs           = rateStyle(successRate);

  return (
    <div className="delivery-stats">
      <div className="delivery-bar">
        {deliveredPct > 0 && <div className="delivery-bar-seg delivered" style={{ width: `${deliveredPct}%` }} title={`Delivered: ${delivered}`} />}
        {pendingPct   > 0 && <div className="delivery-bar-seg pending"   style={{ width: `${pendingPct}%`   }} title={`Pending: ${pending}`}     />}
        {failedPct    > 0 && <div className="delivery-bar-seg failed"    style={{ width: `${failedPct}%`    }} title={`Failed: ${failed}`}        />}
      </div>
      <div className="delivery-chips">
        <div className="delivery-chip total">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
            <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
          </svg>
          <span className="chip-value">{total}</span>
          <span className="chip-label">Total</span>
        </div>
        <div className="delivery-divider" />
        <div className="delivery-chip delivered">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>
          </svg>
          <span className="chip-value">{delivered}</span>
          <span className="chip-label">Delivered</span>
        </div>
        <div className="delivery-chip failed">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>
          </svg>
          <span className="chip-value">{failed}</span>
          <span className="chip-label">Failed</span>
        </div>
        {pending > 0 && (
          <div className="delivery-chip pending">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
            </svg>
            <span className="chip-value">{pending}</span>
            <span className="chip-label">Pending</span>
          </div>
        )}
        {(campaign.readCount ?? 0) > 0 && (
          <div className="delivery-chip read">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
            </svg>
            <span className="chip-value">{campaign.readCount}</span>
            <span className="chip-label">Read</span>
          </div>
        )}
        <div className="delivery-divider" />
        <div className="delivery-rate" style={{ color: rs.color, background: rs.background, border: rs.border }}>
          {successRate}% success
        </div>
      </div>
    </div>
  );
}

// ── Stats Drawer ──────────────────────────────────────────────────────────────
function StatsDrawer({ campaign, onClose }) {
  const [apiStats, setApiStats] = useState(null);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState(null);

  useEffect(() => {
    api.get(`/api/campaigns/${campaign.id}/stats`)
      .then(r => setApiStats(r.data))
      .catch(() => setError("Could not load stats"))
      .finally(() => setLoading(false));
  }, [campaign.id]);

  const statTiles = useMemo(() => {
    const total = Number(apiStats?.totalMessages ?? campaign.recipientCount ?? 0);
    const sent = Number(apiStats?.sentMessages ?? campaign.sentCount ?? 0);
    const delivered = Number(apiStats?.deliveredMessages ?? campaign.deliveredCount ?? 0);
    const read = Number(apiStats?.readMessages ?? campaign.readCount ?? 0);
    const failed = Number(apiStats?.failedMessages ?? campaign.failedCount ?? 0);
    const cancelled = Number(apiStats?.cancelledMessages ?? campaign.cancelledCount ?? 0);
    const pending = Number(
      apiStats?.pendingMessages ??
        calcPendingCount({
          total,
          pending: campaign.pendingCount,
          sent,
          delivered,
          read,
          failed,
          cancelled,
        })
    );
    const successRate = total > 0 ? parseFloat(((delivered / total) * 100).toFixed(1)) : 0;

    return [
      { key: "total", label: "Total Recipients", value: total, color: "#374151" },
      { key: "pending", label: "Pending", value: pending, color: "#f59e0b" },
      { key: "sent", label: "Sent", value: sent, color: "#0ea5e9" },
      { key: "delivered", label: "Delivered", value: delivered, color: "#10b981" },
      { key: "read", label: "Read", value: read, color: "#8b5cf6" },
      { key: "failed", label: "Failed", value: failed, color: "#ef4444" },
      { key: "cancelled", label: "Cancelled", value: cancelled, color: "#6b7280" },
      { key: "successRate", label: "Success Rate", value: successRate, color: rateColor(successRate), isRate: true },
    ];
  }, [apiStats, campaign]);

  return (
    <div className="drawer">
      <div className="drawer-header">
        <span className="drawer-title">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
          </svg>
          Campaign Stats
        </span>
        <button className="drawer-close" onClick={onClose}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>

      {loading && (
        <div className="drawer-loading">
          <div className="sch-spinner" style={{ width: 20, height: 20, borderWidth: 2 }} />
          <span>Loading stats…</span>
        </div>
      )}

      {error && <div className="drawer-error">{error} — showing live counts below.</div>}

      {!loading && (
        <div className="stats-grid">
          {statTiles.map((stat) => {
            const display = stat.isRate ? `${stat.value.toFixed(1)}%` : stat.value.toLocaleString();
            return (
              <div key={stat.key} className="stat-tile">
                <div className="stat-tile-val" style={{ color: stat.color }}>{display}</div>
                <div className="stat-tile-lbl">{stat.label}</div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Messages Drawer ───────────────────────────────────────────────────────────
const MSG_STATUS_CFG = {
  DELIVERED: { color: "#10b981", bg: "#ecfdf5", border: "#6ee7b7" },
  FAILED:    { color: "#ef4444", bg: "#fef2f2", border: "#fecaca" },
  READ:      { color: "#8b5cf6", bg: "#f5f3ff", border: "#ddd6fe" },
  SENT:      { color: "#0ea5e9", bg: "#f0f9ff", border: "#bae6fd" },
  PENDING:   { color: "#f59e0b", bg: "#fffbeb", border: "#fde68a" },
  QUEUED:    { color: "#f59e0b", bg: "#fffbeb", border: "#fde68a" },
  CANCELLED: { color: "#6b7280", bg: "#f9fafb", border: "#e5e7eb" },
};

const shouldHideMessage = () => false;

const normalizeRecipientMessage = (message) => ({
  ...message,
  id: message.id ?? message.messageId,
  recipientName: message.recipientName ?? message.contactName,
  recipientPhone: message.recipientPhone ?? message.phone,
  sentAt: message.sentAt ?? message.createdAt,
  status: message.status?.toUpperCase?.() ?? message.status,
});

function MessagesDrawer({ campaignId, totalMessages, onClose }) {
  const [messages,    setMessages]    = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState(null);
  const [search,      setSearch]      = useState("");
  const [filter,      setFilter]      = useState("ALL");
  const [page,        setPage]        = useState(1);
  const [totalPages,  setTotalPages]  = useState(1);
  const [totalCount,  setTotalCount]  = useState(totalMessages ?? 0);
  const PAGE_SIZE = 50;

  const fetchPage = useCallback(async (pg, statusFilter) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ page: pg, size: PAGE_SIZE });
      if (statusFilter && statusFilter !== "ALL") params.set("status", statusFilter);
      let data;
      try {
        const r = await api.get(`/api/campaigns/${campaignId}/messages/page?${params}`);
        data = r.data;
      } catch (err) {
        const r2 = await api.get(`/api/campaigns/${campaignId}/messages`);
        const all = Array.isArray(r2.data) ? r2.data : (r2.data?.messages ?? []);
        data = { content: all, totalElements: all.length, totalPages: 1 };
      }

      const rawList = Array.isArray(data)
        ? data
        : (data.content ?? data.messages ?? data.items ?? []);

      const list = rawList.map(normalizeRecipientMessage).filter(m => !shouldHideMessage(m));

      const total = data.totalElements ?? data.totalCount ?? data.total ?? rawList.length;
      const pages = data.totalPages   ?? Math.ceil(total / PAGE_SIZE) ?? 1;

      setMessages(list);
      setTotalCount(list.length);
      setTotalPages(Math.max(1, pages));
    } catch (err) {
      setError(apiErrorMessage(err, "Could not load campaign recipient messages."));
    } finally {
      setLoading(false);
    }
  }, [campaignId]);

  useEffect(() => { fetchPage(1, "ALL"); }, [fetchPage]);

  const handleFilterChange = (f) => {
    setFilter(f);
    setPage(1);
    fetchPage(1, f);
  };

  const handlePageChange = (pg) => {
    setPage(pg);
    fetchPage(pg, filter);
  };

  const visible = messages.filter(m => {
    if (!search) return true;
    return (
      m.recipientPhone?.includes(search) ||
      m.recipientName?.toLowerCase().includes(search.toLowerCase())
    );
  });

  const statusCounts = messages.reduce((a, m) => {
    if (m.status) a[m.status] = (a[m.status] || 0) + 1;
    return a;
  }, {});
  const statuses = ["ALL", ...Object.keys(statusCounts)];

  return (
    <div className="drawer">
      <div className="drawer-header">
        <span className="drawer-title">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
          </svg>
          Messages ({totalCount})
        </span>
        <button className="drawer-close" onClick={onClose}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>

      {!loading && !error && (
        <div className="msgs-toolbar">
          <div className="msgs-search">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
            </svg>
            <input
              placeholder="Search name or phone…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <div className="msgs-filters">
            {statuses.map(s => (
              <button
                key={s}
                className={`msgs-filter-btn ${filter === s ? "active" : ""}`}
                style={filter === s && MSG_STATUS_CFG[s] ? {
                  color: MSG_STATUS_CFG[s].color,
                  background: MSG_STATUS_CFG[s].bg,
                  borderColor: MSG_STATUS_CFG[s].border,
                } : {}}
                onClick={() => handleFilterChange(s)}
              >
                {s}
                <span className="msgs-filter-count">
                  {s === "ALL" ? totalCount : (statusCounts[s] || 0)}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {loading && (
        <div className="drawer-loading">
          <div className="sch-spinner" style={{ width: 20, height: 20, borderWidth: 2 }} />
          <span>Loading messages…</span>
        </div>
      )}

      {error && <div className="drawer-error">{error}</div>}

      {!loading && !error && messages.length === 0 && (
        <div className="drawer-loading" style={{ color: "#9ca3af" }}>No messages found</div>
      )}

      {!loading && !error && messages.length > 0 && (
        <>
          <div className="msgs-list">
            {visible.length === 0
              ? <div className="drawer-loading" style={{ color: "#9ca3af" }}>No results</div>
              : visible.map((m, i) => {
                  const cfg = MSG_STATUS_CFG[m.status] || { color: "#6b7280", bg: "#f9fafb", border: "#e5e7eb" };
                  return (
                    <div key={m.id ?? i} className="msg-row">
                      <div className="msg-row-left">
                        <div className="msg-avatar">
                          {(m.recipientName ?? m.phone ?? "?")[0].toUpperCase()}
                        </div>
                        <div className="msg-info">
                          <div className="msg-name">{m.recipientName ?? "Unknown"}</div>
                          <div className="msg-phone">{m.recipientPhone ?? m.phone ?? "—"}</div>
                        </div>
                      </div>
                      <div className="msg-row-right">
                        {m.sentAt && <div className="msg-time">{formatDateTime(m.sentAt)}</div>}
                        <span className="msg-status-badge" style={{ color: cfg.color, background: cfg.bg, border: `1px solid ${cfg.border}` }}>
                          {m.status}
                        </span>
                        {m.errorMessage && (
                          <div className="msg-error" title={m.errorMessage}>
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                              <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                            </svg>
                            <span>{m.errorMessage}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })
            }
          </div>

          {totalPages > 1 && (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingTop: 8, borderTop: "1px solid #f3f4f6" }}>
              <span style={{ fontSize: 11, color: "#9ca3af" }}>
                Page {page} of {totalPages} · {totalCount} total
              </span>
              <div style={{ display: "flex", gap: 4 }}>
                <button
                  onClick={() => handlePageChange(page - 1)}
                  disabled={page === 1}
                  style={{ padding: "3px 8px", borderRadius: 6, border: "1px solid #e5e7eb", background: "#fff", cursor: page === 1 ? "not-allowed" : "pointer", opacity: page === 1 ? 0.4 : 1, fontSize: 12 }}
                >‹ Prev</button>
                <button
                  onClick={() => handlePageChange(page + 1)}
                  disabled={page === totalPages}
                  style={{ padding: "3px 8px", borderRadius: 6, border: "1px solid #e5e7eb", background: "#fff", cursor: page === totalPages ? "not-allowed" : "pointer", opacity: page === totalPages ? 0.4 : 1, fontSize: 12 }}
                >Next ›</button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ── Action Button ─────────────────────────────────────────────────────────────
function ActionBtn({ onClick, disabled, loading, variant = "default", children }) {
  const variants = {
    default: { border: "#e5e7eb",  color: "#374151",  hoverBorder: "#10b981", hoverColor: "#065f46", hoverBg: "#f0fdf4" },
    danger:  { border: "#fecaca",  color: "#ef4444",  hoverBorder: "#ef4444", hoverColor: "#991b1b", hoverBg: "#fef2f2" },
    warning: { border: "#fde68a",  color: "#92400e",  hoverBorder: "#f59e0b", hoverColor: "#78350f", hoverBg: "#fffbeb" },
    purple:  { border: "#ddd6fe",  color: "#7c3aed",  hoverBorder: "#8b5cf6", hoverColor: "#5b21b6", hoverBg: "#f5f3ff" },
    sky:     { border: "#bae6fd",  color: "#0369a1",  hoverBorder: "#0ea5e9", hoverColor: "#075985", hoverBg: "#f0f9ff" },
  };
  const v = variants[variant] || variants.default;
  return (
    <button
      onClick={onClick}
      disabled={disabled || loading}
      className="action-btn"
      style={{
        "--ab-border":       v.border,
        "--ab-color":        v.color,
        "--ab-hover-border": v.hoverBorder,
        "--ab-hover-color":  v.hoverColor,
        "--ab-hover-bg":     v.hoverBg,
      }}
    >
      {loading
        ? <div className="sch-spinner" style={{ width: 10, height: 10, borderWidth: 1.5, borderTopColor: v.color }} />
        : children}
    </button>
  );
}

// ── Campaign History Row ──────────────────────────────────────────────────────
function CampaignHistoryRow({ campaign: initialCampaign, onRefresh }) {
  const [campaign,      setCampaign]      = useState(initialCampaign);
  const [actionLoading, setActionLoading] = useState(null);
  const [openDrawer,    setOpenDrawer]    = useState(null);
  const [confirmOpen,   setConfirmOpen]   = useState(false);
  const [confirmData,   setConfirmData]   = useState(null);
  const [actionError,   setActionError]   = useState("");

  useEffect(() => {
    setCampaign(normalizeCampaign(initialCampaign));
  }, [initialCampaign]);

  const countdown = useCountdown(campaign.scheduledAt, campaign.status);
  const cfg = STATUS_CFG[campaign.status] || STATUS_CFG.SCHEDULED;

  const refreshSingle = useCallback(async () => {
    setActionLoading("refresh");
    try {
      const r = await api.get(`/api/campaigns/${campaign.id}`);
      setCampaign(normalizeCampaign(r.data));
    } catch { /* silent */ }
    finally { setActionLoading(null); }
  }, [campaign.id]);

  const doAction = useCallback((key, endpoint, confirmMsg) => {
    setConfirmData({ key, endpoint, confirmMsg });
    setConfirmOpen(true);
  }, []);

  const handleConfirm = async () => {
    if (!confirmData) return;
    const { key, endpoint } = confirmData;
    setActionLoading(key);
    setActionError("");
    try {
      await api.post(endpoint);
      await new Promise(r => setTimeout(r, 600));
      await refreshSingle();
      onRefresh?.();
    } catch (err) {
      setActionError(apiErrorMessage(err, `Failed to ${key} campaign.`));
    } finally {
      setActionLoading(null);
      setConfirmOpen(false);
      setConfirmData(null);
    }
  };

  const handleCancel = () =>
    doAction("cancel", `/api/campaigns/${campaign.id}/cancel`,
      `Cancel "${campaign.metaTemplateName || campaign.name}"? This cannot be undone.`);

  const handlePause = () =>
    doAction("pause", `/api/campaigns/${campaign.id}/pause`,
      `Pause "${campaign.metaTemplateName || campaign.name}"?`);

  const handleResume = () =>
    doAction("resume", `/api/campaigns/${campaign.id}/resume`,
      `Resume "${campaign.metaTemplateName || campaign.name}"?`);

  const handleRetry = () =>
    doAction("retry", `/api/campaigns/${campaign.id}/retry-failures`,
      `Retry all failed messages in "${campaign.metaTemplateName || campaign.name}"?`);

  const total  = campaign.recipientCount ?? 0;
  const failed = campaign.failedCount    ?? 0;

  const showPause  = campaign.status === "SENDING";
  const showResume = campaign.status === "PAUSED";
  const showRetry  = ["SENT", "FAILED"].includes(campaign.status) && failed > 0;
  const showCancel = ["SCHEDULED", "PAUSED"].includes(campaign.status);

  return (
    <>
      <div className="sch-row" style={{ flexDirection: "column" }}>
        {actionError && (
          <div className="drawer-error" style={{ marginBottom: 10 }}>
            {actionError}
          </div>
        )}
        <div style={{ display: "flex" }}>
          <div className="sch-row-accent" style={{ background: cfg.dot }} />
          <div className="sch-row-body">

            <div className="sch-row-top">
              <div className="sch-title-block">
                <span className="sch-name">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, color: "#9ca3af" }}>
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                  </svg>
                  {campaign.metaTemplateName || "—"}
                </span>
                {campaign.name && <span className="sch-campaign-sub">{campaign.name}</span>}
              </div>
              <span className="sch-badge" style={{ color: cfg.color, background: cfg.bg, border: `1px solid ${cfg.border}` }}>
                <span className="sch-dot" style={{ background: cfg.dot, animation: campaign.status === "SENDING" ? "schPulse 1.2s infinite" : "none" }} />
                {cfg.label}
              </span>
            </div>

            <div className="sch-meta">
              <div className="sch-meta-item">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/>
                  <line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
                </svg>
                <span>{formatDateTime(campaign.scheduledAt)}</span>
              </div>
              <div className="sch-meta-item">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
                </svg>
                <span>{total} recipients</span>
              </div>
            </div>

            <DeliveryStats campaign={campaign} />

            <div className="sch-row-foot">
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                {countdown && (
                  <span className="sch-countdown">
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
                    </svg>
                    Sends in {countdown}
                  </span>
                )}

                <ActionBtn onClick={() => setOpenDrawer(d => d === "stats" ? null : "stats")} variant="sky">
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
                  </svg>
                  Stats
                </ActionBtn>

                <ActionBtn onClick={() => setOpenDrawer(d => d === "messages" ? null : "messages")} variant="purple">
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                  </svg>
                  Messages
                </ActionBtn>

                <ActionBtn onClick={refreshSingle} loading={actionLoading === "refresh"}>
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
                  </svg>
                  Refresh
                </ActionBtn>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                {showRetry && (
                  <ActionBtn onClick={handleRetry} loading={actionLoading === "retry"} variant="warning">
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-4.95"/>
                    </svg>
                    Retry {failed} failed
                  </ActionBtn>
                )}
                {showPause && (
                  <ActionBtn onClick={handlePause} loading={actionLoading === "pause"} variant="purple">
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/>
                    </svg>
                    Pause
                  </ActionBtn>
                )}
                {showResume && (
                  <ActionBtn onClick={handleResume} loading={actionLoading === "resume"}>
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polygon points="5 3 19 12 5 21 5 3"/>
                    </svg>
                    Resume
                  </ActionBtn>
                )}
                {showCancel && (
                  <ActionBtn onClick={handleCancel} loading={actionLoading === "cancel"} variant="danger">
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>
                    </svg>
                    Cancel
                  </ActionBtn>
                )}
              </div>
            </div>
          </div>
        </div>

        {openDrawer === "stats" && (
          <StatsDrawer campaign={campaign} onClose={() => setOpenDrawer(null)} />
        )}
        {openDrawer === "messages" && (
          <MessagesDrawer
            campaignId={campaign.id}
            totalMessages={campaign.recipientCount}
            onClose={() => setOpenDrawer(null)}
          />
        )}
      </div>

      {confirmOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-[350px] shadow-xl">
            <h2 className="text-lg font-semibold mb-4">Confirm Action</h2>
            <p className="text-gray-600 mb-6">{confirmData?.confirmMsg}</p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => { setConfirmOpen(false); setConfirmData(null); }}
                className="px-4 py-2 rounded-lg border"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirm}
                disabled={!!actionLoading}
                className="px-4 py-2 rounded-lg bg-teal-500 text-white flex items-center gap-2"
              >
                {actionLoading
                  ? <><div className="sch-spinner" style={{ width: 14, height: 14, borderWidth: 2, borderTopColor: "#fff" }} /> Working…</>
                  : "Confirm"
                }
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .action-btn {
          display: inline-flex; align-items: center; gap: 5px;
          padding: 5px 11px; border-radius: 6px;
          border: 1.5px solid var(--ab-border);
          background: #fff; color: var(--ab-color);
          font-size: 12px; font-weight: 500;
          cursor: pointer; transition: all 0.15s; font-family: inherit;
          white-space: nowrap;
        }
        .action-btn:hover:not(:disabled) {
          border-color: var(--ab-hover-border);
          color: var(--ab-hover-color);
          background: var(--ab-hover-bg);
        }
        .action-btn:disabled { opacity: 0.5; cursor: not-allowed; }
        .drawer {
          border-top: 1px solid #f3f4f6; background: #fafafa;
          padding: 14px 16px 16px; display: flex; flex-direction: column; gap: 12px;
          animation: drawerIn 0.18s ease;
        }
        @keyframes drawerIn { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: translateY(0); } }
        .drawer-header { display: flex; align-items: center; justify-content: space-between; }
        .drawer-title  { display: flex; align-items: center; gap: 6px; font-size: 13px; font-weight: 600; color: #374151; }
        .drawer-close  {
          width: 24px; height: 24px; border-radius: 6px;
          border: 1px solid #e5e7eb; background: #fff;
          display: flex; align-items: center; justify-content: center;
          cursor: pointer; color: #9ca3af; transition: all 0.15s;
        }
        .drawer-close:hover { border-color: #ef4444; color: #ef4444; }
        .drawer-loading { display: flex; align-items: center; gap: 8px; padding: 12px 0; color: #6b7280; font-size: 13px; }
        .drawer-error   { padding: 10px 12px; border-radius: 8px; background: #fef2f2; border: 1px solid #fecaca; color: #ef4444; font-size: 13px; }
        .stats-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(110px, 1fr)); gap: 8px; }
        .stat-tile  { background: #fff; border: 1px solid #e5e7eb; border-radius: 10px; padding: 10px 12px; display: flex; flex-direction: column; gap: 3px; }
        .stat-tile-val { font-size: 18px; font-weight: 700; line-height: 1; }
        .stat-tile-lbl { font-size: 11px; color: #9ca3af; font-weight: 500; }
        .msgs-toolbar { display: flex; flex-direction: column; gap: 8px; }
        .msgs-search  {
          display: flex; align-items: center; gap: 7px;
          padding: 7px 10px; border-radius: 8px;
          border: 1.5px solid #e5e7eb; background: #fff; color: #9ca3af;
        }
        .msgs-search input { border: none; outline: none; font-size: 12.5px; color: #374151; background: transparent; width: 100%; font-family: inherit; }
        .msgs-filters { display: flex; gap: 5px; flex-wrap: wrap; }
        .msgs-filter-btn {
          display: inline-flex; align-items: center; gap: 4px;
          padding: 4px 10px; border-radius: 20px;
          border: 1.5px solid #e5e7eb; background: #fff;
          color: #6b7280; font-size: 11.5px; font-weight: 500;
          cursor: pointer; transition: all 0.15s; font-family: inherit;
        }
        .msgs-filter-btn.active { font-weight: 600; }
        .msgs-filter-count {
          display: inline-flex; align-items: center; justify-content: center;
          min-width: 16px; height: 16px; padding: 0 4px;
          border-radius: 8px; background: #e5e7eb; color: #6b7280;
          font-size: 10px; font-weight: 700;
        }
        .msgs-list { display: flex; flex-direction: column; gap: 6px; max-height: 320px; overflow-y: auto; }
        .msg-row {
          display: flex; align-items: center; justify-content: space-between; gap: 10px;
          padding: 9px 12px; background: #fff; border-radius: 8px;
          border: 1px solid #f3f4f6; transition: background 0.12s;
        }
        .msg-row:hover { background: #f9fafb; }
        .msg-row-left  { display: flex; align-items: center; gap: 8px; min-width: 0; }
        .msg-avatar    {
          width: 28px; height: 28px; border-radius: 8px;
          background: #f0fdf4; color: #10b981;
          display: flex; align-items: center; justify-content: center;
          font-size: 12px; font-weight: 700; flex-shrink: 0;
        }
        .msg-info  { min-width: 0; }
        .msg-name  { font-size: 12.5px; font-weight: 600; color: #111827; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .msg-phone { font-size: 11.5px; color: #9ca3af; }
        .msg-row-right { display: flex; flex-direction: column; align-items: flex-end; gap: 3px; flex-shrink: 0; }
        .msg-time  { font-size: 11px; color: #d1d5db; }
        .msg-status-badge { display: inline-flex; align-items: center; padding: 2px 8px; border-radius: 10px; font-size: 11px; font-weight: 600; }
        .msg-error {
          display: flex; align-items: flex-start; gap: 4px;
          font-size: 10.5px; color: #b91c1c; max-width: 320px; text-align: left;
          white-space: normal; overflow-wrap: anywhere; line-height: 1.35;
          border: 1px solid #fecaca; background: #fef2f2; border-radius: 8px;
          padding: 6px 8px;
        }
        .msg-error svg { flex-shrink: 0; margin-top: 2px; }
      `}</style>
    </>
  );
}

// ── Pagination Component ──────────────────────────────────────────────────────
function Pagination({ currentPage, totalPages, onPageChange }) {
  if (totalPages <= 1) return null;

  const getPages = () => {
    if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);
    const pages = [];
    if (currentPage <= 4) {
      pages.push(1, 2, 3, 4, 5, "…", totalPages);
    } else if (currentPage >= totalPages - 3) {
      pages.push(1, "…", totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages);
    } else {
      pages.push(1, "…", currentPage - 1, currentPage, currentPage + 1, "…", totalPages);
    }
    return pages;
  };

  return (
    <div className="pagination-bar">
      <button className="pg-btn pg-arrow" onClick={() => onPageChange(currentPage - 1)} disabled={currentPage === 1}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="15 18 9 12 15 6"/>
        </svg>
        Prev
      </button>
      <div className="pg-numbers">
        {getPages().map((p, i) =>
          p === "…"
            ? <span key={`ellipsis-${i}`} className="pg-ellipsis">…</span>
            : <button key={p} className={`pg-btn pg-num ${currentPage === p ? "active" : ""}`} onClick={() => onPageChange(p)}>{p}</button>
        )}
      </div>
      <button className="pg-btn pg-arrow" onClick={() => onPageChange(currentPage + 1)} disabled={currentPage === totalPages}>
        Next
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="9 18 15 12 9 6"/>
        </svg>
      </button>
    </div>
  );
}

// ── Template History Tab ──────────────────────────────────────────────────────
function MiniBar({ delivered, failed, pending, total }) {
  if (total === 0) return <span style={{ color: "#d1d5db", fontSize: 12 }}>—</span>;
  const dPct = (delivered / total) * 100;
  const fPct = (failed    / total) * 100;
  const pPct = ((pending ?? 0) / total) * 100;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <div style={{ width: 80, height: 6, borderRadius: 99, background: "#f3f4f6", display: "flex", overflow: "hidden", gap: 1, flexShrink: 0 }}>
        {dPct > 0 && <div style={{ width: `${dPct}%`, background: "#10b981", borderRadius: 99 }} />}
        {pPct > 0 && <div style={{ width: `${pPct}%`, background: "#fbbf24", borderRadius: 99 }} />}
        {fPct > 0 && <div style={{ width: `${fPct}%`, background: "#ef4444", borderRadius: 99 }} />}
      </div>
    </div>
  );
}

function ExpandedDetail({ row }) {
  const rate    = row.total > 0 ? Math.round((row.delivered / row.total) * 100) : 0;
  const pending = row.pending ?? calcPendingCount(row);
  const rs      = rateStyle(rate);
  return (
    <tr>
      <td colSpan={9} style={{ padding: "0 12px 14px 44px", background: "#fafafa" }}>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          {[
            { label: "Delivered", value: row.delivered.toLocaleString(), color: "#10b981", bg: "#ecfdf5" },
            { label: "Read",      value: (row.read ?? 0).toLocaleString(), color: "#8b5cf6", bg: "#f5f3ff" },
            { label: "Sent",      value: (row.sent ?? 0).toLocaleString(), color: "#0ea5e9", bg: "#f0f9ff" },
            { label: "Failed",    value: row.failed.toLocaleString(),    color: "#ef4444", bg: "#fef2f2" },
            { label: "Pending",   value: pending.toLocaleString(),       color: "#f59e0b", bg: "#fffbeb" },
          ].map(s => (
            <div key={s.label} style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "8px 16px", borderRadius: 10, background: s.bg, minWidth: 90 }}>
              <span style={{ fontSize: 18, fontWeight: 700, color: s.color }}>{s.value}</span>
              <span style={{ fontSize: 11, color: "#6b7280", marginTop: 2 }}>{s.label}</span>
            </div>
          ))}
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "8px 16px", borderRadius: 10, minWidth: 90, ...rs }}>
            <span style={{ fontSize: 18, fontWeight: 700 }}>{rate}%</span>
            <span style={{ fontSize: 11, marginTop: 2, opacity: 0.75 }}>Success rate</span>
          </div>
          <div style={{ width: "100%", marginTop: 4 }}>
            <div style={{ height: 8, borderRadius: 99, background: "#f3f4f6", display: "flex", overflow: "hidden", gap: 1 }}>
              {row.total > 0 && <>
                {row.delivered > 0 && <div style={{ width: `${(row.delivered / row.total) * 100}%`, background: "#10b981", borderRadius: 99, transition: "width 0.5s ease" }} />}
                {pending > 0       && <div style={{ width: `${(pending       / row.total) * 100}%`, background: "#fbbf24", borderRadius: 99 }} />}
                {row.failed > 0    && <div style={{ width: `${(row.failed    / row.total) * 100}%`, background: "#ef4444", borderRadius: 99 }} />}
              </>}
            </div>
          </div>
        </div>
      </td>
    </tr>
  );
}

function SortIcon({ col, sortCol, sortDesc }) {
  const active = sortCol === col;
  return (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke={active ? "#10b981" : "#d1d5db"}
      strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginLeft: 4, flexShrink: 0 }}>
      {active && !sortDesc
        ? <><line x1="12" y1="20" x2="12" y2="4"/><polyline points="18 10 12 4 6 10"/></>
        : <><line x1="12" y1="4"  x2="12" y2="20"/><polyline points="6 14 12 20 18 14"/></>
      }
    </svg>
  );
}

function TemplateHistoryTab({ history, histLoading, onRefresh }) {
  const [search,   setSearch]   = useState("");
  const [sortCol,  setSortCol]  = useState("total");
  const [sortDesc, setSortDesc] = useState(true);
  const [expanded, setExpanded] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const ROWS_PER_PAGE = 10;

  const rows = useMemo(() => {
    let data = calcTemplateStats(history);
    if (search.trim()) {
      const q = search.toLowerCase();
      data = data.filter(r => r.name.toLowerCase().includes(q));
    }
    return [...data].sort((a, b) => {
      if (sortCol === "name") return sortDesc ? b.name.localeCompare(a.name) : a.name.localeCompare(b.name);
      let av, bv;
      if      (sortCol === "campaigns") { av = a.campaigns; bv = b.campaigns; }
      else if (sortCol === "total")     { av = a.total;     bv = b.total;     }
      else if (sortCol === "delivered") { av = a.delivered; bv = b.delivered; }
      else if (sortCol === "read")      { av = a.read;      bv = b.read;      }
      else if (sortCol === "failed")    { av = a.failed;    bv = b.failed;    }
      else if (sortCol === "rate")      { av = a.total > 0 ? a.delivered / a.total : 0; bv = b.total > 0 ? b.delivered / b.total : 0; }
      else if (sortCol === "lastUsed")  { av = a.lastUsed ? new Date(a.lastUsed).getTime() : 0; bv = b.lastUsed ? new Date(b.lastUsed).getTime() : 0; }
      return sortDesc ? bv - av : av - bv;
    });
  }, [history, search, sortCol, sortDesc]);

  useEffect(() => { setCurrentPage(1); }, [search, sortCol, sortDesc]);

  const totalPages    = Math.max(1, Math.ceil(rows.length / ROWS_PER_PAGE));
  const paginatedRows = rows.slice((currentPage - 1) * ROWS_PER_PAGE, currentPage * ROWS_PER_PAGE);

  const agg = useMemo(() => rows.reduce((acc, r) => {
    acc.campaigns += r.campaigns;
    acc.total     += r.total;
    acc.delivered += r.delivered;
    acc.read      += r.read ?? 0;
    acc.pending   += r.pending ?? 0;
    acc.failed    += r.failed;
    return acc;
  }, { campaigns: 0, total: 0, delivered: 0, read: 0, pending: 0, failed: 0 }), [rows]);

  const aggRate = agg.total > 0 ? Math.round((agg.delivered / agg.total) * 100) : 0;

  const handleSort = (col) => {
    if (sortCol === col) setSortDesc(p => !p);
    else { setSortCol(col); setSortDesc(true); }
  };

  const TH = ({ col, label, align = "right" }) => (
    <th onClick={() => handleSort(col)} style={{
      padding: "10px 12px", fontSize: 11.5, fontWeight: 600,
      color: sortCol === col ? "#10b981" : "#9ca3af",
      textAlign: align, cursor: "pointer", whiteSpace: "nowrap", userSelect: "none",
    }}>
      <span style={{ display: "inline-flex", alignItems: "center", gap: 2 }}>
        {label}<SortIcon col={col} sortCol={sortCol} sortDesc={sortDesc} />
      </span>
    </th>
  );

  if (histLoading) {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "60px 24px", gap: 12 }}>
        <div className="sch-spinner" />
        <p style={{ margin: 0, color: "#9ca3af", fontSize: 14 }}>Loading template stats…</p>
      </div>
    );
  }

  if (rows.length === 0 && !search) {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "60px 24px", gap: 10, color: "#9ca3af" }}>
        <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="#d1d5db" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
        </svg>
        <p style={{ margin: 0, fontSize: 15, fontWeight: 500, color: "#6b7280" }}>No template data yet</p>
        <span style={{ fontSize: 13 }}>Send some campaigns first to see stats here</span>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {rows.length > 0 && (
        <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", background: "#fff", borderRadius: 12, border: "1px solid #e5e7eb", padding: "16px 24px" }}>
          {[
            { label: "Templates",  value: rows.length,                       color: "#374151"          },
            { label: "Campaigns",  value: agg.campaigns,                     color: "#374151"          },
            { label: "Recipients", value: agg.total.toLocaleString(),        color: "#374151"          },
            { label: "Delivered",  value: agg.delivered.toLocaleString(),    color: "#10b981"          },
            { label: "Read",       value: agg.read.toLocaleString(),         color: "#8b5cf6"          },
            { label: "Failed",     value: agg.failed.toLocaleString(),       color: "#ef4444"          },
            { label: "Avg. Rate",  value: `${aggRate}%`,                     color: rateColor(aggRate) },
          ].map((s, i, arr) => (
            <div key={s.label} style={{ display: "flex", alignItems: "center", flex: 1, minWidth: 100 }}>
              <div style={{ display: "flex", flexDirection: "column" }}>
                <span style={{ fontSize: 20, fontWeight: 700, color: s.color, lineHeight: 1 }}>{s.value}</span>
                <span style={{ fontSize: 11.5, color: "#9ca3af", marginTop: 3 }}>{s.label}</span>
              </div>
              {i < arr.length - 1 && <div style={{ width: 1, height: 36, background: "#f3f4f6", margin: "0 20px", flexShrink: 0 }} />}
            </div>
          ))}
        </div>
      )}

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 7, padding: "7px 12px", borderRadius: 8, border: "1.5px solid #e5e7eb", background: "#fff", color: "#9ca3af" }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
          </svg>
          <input
            placeholder="Search templates…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ border: "none", outline: "none", fontSize: 13, color: "#374151", background: "transparent", width: 200, fontFamily: "inherit" }}
          />
        </div>
        <button onClick={onRefresh} disabled={histLoading} className="sch-refresh-btn">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
            style={{ animation: histLoading ? "schSpin 0.8s linear infinite" : "none" }}>
            <polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
          </svg>
          Refresh
        </button>
      </div>

      <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #e5e7eb", overflow: "hidden" }}>
        {rows.length === 0 ? (
          <div style={{ padding: "40px 24px", textAlign: "center", color: "#9ca3af", fontSize: 13 }}>
            No templates match your search.
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: "1.5px solid #f3f4f6" }}>
                  <th style={{ width: 32, padding: "10px 0 10px 12px" }} />
                  <TH col="name"      label="Template"     align="left" />
                  <TH col="campaigns" label="Campaigns"                 />
                  <TH col="total"     label="Recipients"                />
                  <TH col="delivered" label="Delivered"                 />
                  <TH col="read"      label="Read"                      />
                  <TH col="failed"    label="Failed"                    />
                  <TH col="rate"      label="Success Rate"              />
                  <TH col="lastUsed"  label="Last Used"                 />
                </tr>
              </thead>
              <tbody>
                {paginatedRows.map(r => {
                  const rate   = r.total > 0 ? Math.round((r.delivered / r.total) * 100) : 0;
                  const isOpen = expanded === r.name;
                  const rs     = rateStyle(rate);
                  return [
                    <tr
                      key={r.name}
                      onClick={() => setExpanded(p => p === r.name ? null : r.name)}
                      style={{ borderBottom: "1px solid #f9fafb", cursor: "pointer", background: isOpen ? "#fafff9" : "transparent", transition: "background 0.12s" }}
                      onMouseEnter={e => { if (!isOpen) e.currentTarget.style.background = "#f9fafb"; }}
                      onMouseLeave={e => { if (!isOpen) e.currentTarget.style.background = "transparent"; }}
                    >
                      <td style={{ padding: "12px 0 12px 14px", color: "#9ca3af" }}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                          strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                          style={{ transition: "transform 0.2s", transform: isOpen ? "rotate(90deg)" : "none" }}>
                          <polyline points="9 18 15 12 9 6"/>
                        </svg>
                      </td>
                      <td style={{ padding: "12px", textAlign: "left" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                          <div style={{ width: 28, height: 28, borderRadius: 8, background: "#f0fdfa", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                            </svg>
                          </div>
                          <div>
                            <div style={{ fontWeight: 600, color: "#111827", fontSize: 13.5 }}>{r.name}</div>
                            {r.metaTemplateName && (
                              <div style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 3 }}>
                                <span style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "1px 7px", borderRadius: 6, background: "#f0fdf4", border: "1px solid #bbf7d0", color: "#065f46", fontSize: 11, fontWeight: 600 }}>
                                  <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                    <rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/>
                                  </svg>
                                  {r.metaTemplateName}
                                </span>
                              </div>
                            )}
                            <MiniBar delivered={r.delivered} failed={r.failed} pending={r.pending} total={r.total} />
                          </div>
                        </div>
                      </td>
                      <td style={{ padding: "12px", textAlign: "right", fontWeight: 600, color: "#374151" }}>{r.campaigns}</td>
                      <td style={{ padding: "12px", textAlign: "right", fontWeight: 600, color: "#374151" }}>{r.total.toLocaleString()}</td>
                      <td style={{ padding: "12px", textAlign: "right", fontWeight: 700, color: "#10b981" }}>{r.delivered.toLocaleString()}</td>
                      <td style={{ padding: "12px", textAlign: "right", fontWeight: 700, color: "#8b5cf6" }}>{(r.read ?? 0).toLocaleString()}</td>
                      <td style={{ padding: "12px", textAlign: "right", fontWeight: 700, color: r.failed > 0 ? "#ef4444" : "#9ca3af" }}>{r.failed.toLocaleString()}</td>
                      <td style={{ padding: "12px", textAlign: "right" }}>
                        <span style={{ padding: "3px 10px", borderRadius: 10, fontSize: 12, fontWeight: 700, ...rs }}>{rate}%</span>
                      </td>
                      <td style={{ padding: "12px", textAlign: "right", color: "#9ca3af", fontSize: 12, whiteSpace: "nowrap" }}>{formatDate(r.lastUsed)}</td>
                    </tr>,
                    isOpen && <ExpandedDetail key={`${r.name}-detail`} row={r} />,
                  ];
                })}
              </tbody>

              {rows.length > 1 && (
                <tfoot>
                  <tr style={{ borderTop: "2px solid #f3f4f6", background: "#fafafa" }}>
                    <td />
                    <td style={{ padding: "10px 12px", fontWeight: 700, color: "#374151", fontSize: 12.5 }}>
                      Totals ({rows.length} templates)
                    </td>
                    <td style={{ padding: "10px 12px", textAlign: "right", fontWeight: 700, color: "#374151" }}>{agg.campaigns}</td>
                    <td style={{ padding: "10px 12px", textAlign: "right", fontWeight: 700, color: "#374151" }}>{agg.total.toLocaleString()}</td>
                    <td style={{ padding: "10px 12px", textAlign: "right", fontWeight: 700, color: "#10b981" }}>{agg.delivered.toLocaleString()}</td>
                    <td style={{ padding: "10px 12px", textAlign: "right", fontWeight: 700, color: "#8b5cf6" }}>{agg.read.toLocaleString()}</td>
                    <td style={{ padding: "10px 12px", textAlign: "right", fontWeight: 700, color: "#ef4444" }}>{agg.failed.toLocaleString()}</td>
                    <td style={{ padding: "10px 12px", textAlign: "right" }}>
                      <span style={{ padding: "3px 10px", borderRadius: 10, fontSize: 12, fontWeight: 700, ...rateStyle(aggRate) }}>{aggRate}%</span>
                    </td>
                    <td />
                  </tr>
                </tfoot>
              )}
            </table>

            <div style={{ padding: "12px 16px", borderTop: "1px solid #f3f4f6", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontSize: 12, color: "#9ca3af" }}>
                {rows.length === 0 ? "No results" : `Showing ${(currentPage - 1) * ROWS_PER_PAGE + 1}–${Math.min(currentPage * ROWS_PER_PAGE, rows.length)} of ${rows.length}`}
              </span>
              <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function CreateCampaign() {
  const location = useLocation();
  const navigate = useNavigate();
  const [templates,        setTemplates]        = useState([]);
  const [contacts,         setContacts]         = useState([]);
  const [segments,         setSegments]         = useState([]);
  const [selectedContacts, setSelectedContacts] = useState([]);
  const [selectedContactMap, setSelectedContactMap] = useState({});
  const [selectedSegmentId, setSelectedSegmentId] = useState("");
  const [templateId,       setTemplateId]       = useState("");
  const [headerMediaUrl, setHeaderMediaUrl] = useState("");
  const [headerMediaDialogOpen, setHeaderMediaDialogOpen] = useState(false);
  const [name,             setName]             = useState("");
  const [searchQuery,      setSearchQuery]      = useState("");
  const [contactSearchLoading, setContactSearchLoading] = useState(false);
  const [contactSearchError, setContactSearchError] = useState("");
  const [directContactsExpanded, setDirectContactsExpanded] = useState(false);
  const [contactPage, setContactPage] = useState(0);
  const [contactPageMeta, setContactPageMeta] = useState({
    totalElements: 0,
    totalPages: 1,
    size: 20,
  });
  const [sending,          setSending]          = useState(false);
  const [sent,             setSent]             = useState(false);
  const [segmentError,     setSegmentError]     = useState("");
  const [submitError,      setSubmitError]      = useState("");
  const [submitSuccess,    setSubmitSuccess]    = useState("");
  const [audienceGuideOpen, setAudienceGuideOpen] = useState(false);
  const [aiCopyLoading, setAiCopyLoading] = useState(false);
  const [aiCopyResult, setAiCopyResult] = useState("");

  const [sendNow,     setSendNow]     = useState(true);
  const [scheduledAt, setScheduledAt] = useState("");

  const [activeTab,    setActiveTab]    = useState("create");
  const [history,      setHistory]      = useState([]);
  const [histLoading,  setHistLoading]  = useState(false);
  const [histFilter,   setHistFilter]   = useState("ALL");
  const [histSearch,   setHistSearch]   = useState("");
  const [histSortDesc, setHistSortDesc] = useState(true);
  const [histDatePreset, setHistDatePreset] = useState("30D");
  const [histDateRange, setHistDateRange] = useState(() => presetDateRange("30D"));

  const [histPage, setHistPage] = useState(1);
  const HIST_PER_PAGE = 10;
  const [histPageInfo, setHistPageInfo] = useState({
    page: 0,
    size: HIST_PER_PAGE,
    totalElements: 0,
    totalPages: 1,
    hasNext: false,
    hasPrevious: false,
  });

  const historyFetched = useRef(false);

  const loadHistory = useCallback(async () => {
    setHistLoading(true);
    try {
      const r = await api.get("/api/campaigns/history/page", {
        params: {
          status: histFilter === "ALL" ? undefined : histFilter,
          query: histSearch.trim() || undefined,
          ...dateRangeParams(histDateRange),
          page: Math.max(0, histPage - 1),
          size: HIST_PER_PAGE,
        },
      });
      const payload = r.data || {};
      const raw = Array.isArray(payload.items) ? payload.items : Array.isArray(payload.content) ? payload.content : [];

      const normalized = raw.map(normalizeCampaign);
      setHistory(normalized);
      setHistPageInfo({
        page: payload.page ?? Math.max(0, histPage - 1),
        size: payload.size ?? HIST_PER_PAGE,
        totalElements: payload.totalElements ?? raw.length,
        totalPages: Math.max(1, payload.totalPages ?? 1),
        hasNext: Boolean(payload.hasNext),
        hasPrevious: Boolean(payload.hasPrevious),
      });
    } catch (err) {
      console.error("loadHistory error:", err);
      setSubmitError(apiErrorMessage(err, "Could not load campaign history."));
      setHistory([]);
      setHistPageInfo({
        page: 0,
        size: HIST_PER_PAGE,
        totalElements: 0,
        totalPages: 1,
        hasNext: false,
        hasPrevious: false,
      });
    } finally {
      setHistLoading(false);
    }
  }, [histDateRange, histFilter, histPage, histSearch]);

  useEffect(() => {
    api.get("/api/templates").then(r => setTemplates(r.data));
    api
      .get("/api/segments")
      .then(r => setSegments(Array.isArray(r.data) ? r.data : []))
      .catch(() => setSegments([]));
  }, []);

  useEffect(() => {
    if (!directContactsExpanded) return;

    let cancelled = false;

    const loadContacts = async () => {
      setContactSearchLoading(true);
      setContactSearchError("");
      try {
        const params = new URLSearchParams({
          page: String(contactPage),
          size: "20",
        });

        const trimmedQuery = searchQuery.trim();
        const endpoint = trimmedQuery ? "/api/contacts/search/page" : "/api/contacts/page";
        if (trimmedQuery) {
          params.set("query", trimmedQuery);
        }

        const response = await api.get(`${endpoint}?${params.toString()}`);
        const data = response.data || {};
        const items = Array.isArray(data.content)
          ? data.content
          : Array.isArray(data.data)
            ? data.data
            : Array.isArray(data.items)
              ? data.items
              : [];

        if (cancelled) return;

        setContacts(items);
        setContactPageMeta({
          totalElements: Number(data.totalElements ?? items.length ?? 0),
          totalPages: Math.max(1, Number(data.totalPages ?? 1)),
          size: Number(data.size ?? 20),
        });
      } catch (err) {
        if (cancelled) return;
        setContacts([]);
        setContactPageMeta({ totalElements: 0, totalPages: 1, size: 20 });
        setContactSearchError(
          err?.response?.data?.message ||
            err?.response?.data?.error ||
            "Could not load contacts for direct selection."
        );
      } finally {
        if (!cancelled) setContactSearchLoading(false);
      }
    };

    loadContacts();

    return () => {
      cancelled = true;
    };
  }, [contactPage, directContactsExpanded, searchQuery]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const segmentId = params.get("segmentId");
    if (!segmentId) {
      setSelectedSegmentId("");
      setSegmentError("");
      return;
    }
    setSegmentError("");
    setSelectedSegmentId(segmentId);
    setActiveTab("create");
  }, [location.search]);

  useEffect(() => {
    if (activeTab !== "history" && activeTab !== "templates") return;
    loadHistory();
    const interval = setInterval(loadHistory, 60000);
    return () => clearInterval(interval);
  }, [activeTab, loadHistory]);

  useEffect(() => { setHistPage(1); }, [histDateRange, histFilter, histSearch, histSortDesc]);

  const minDateTime = (() => {
    const d = new Date();
    d.setSeconds(0, 0);
    d.setMinutes(d.getMinutes() + 1);
    return d.toISOString().slice(0, 16);
  })();

  const filteredContacts = contacts;

  const toggleContact = (contact) => {
    const id = getCampaignId(contact);
    setSelectedContacts(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
    setSelectedContactMap((prev) => {
      if (prev[id]) return prev;
      return {
        ...prev,
        [id]: {
          id,
          name: contact.name || contact.phone || `Contact ${id}`,
          phone: contact.phone || "",
          tags: contact.tags || "",
        },
      };
    });
  };

  const selectedSegment = segments.find((segment) => String(segment.id) === String(selectedSegmentId));

  useEffect(() => {
    if (!selectedSegmentId) {
      setSegmentError("");
      return;
    }
    if (segments.length === 0) {
      return;
    }
    if (!selectedSegment) {
      setSegmentError("The selected segment was not found or is no longer available.");
    } else {
      setSegmentError("");
    }
  }, [selectedSegmentId, selectedSegment, segments]);

  const selectAll = () => {
    const visibleIds = filteredContacts.map(c => getCampaignId(c));
    const allVisibleSelected = visibleIds.every(id => selectedContacts.includes(id));
    if (allVisibleSelected) {
      setSelectedContacts(prev => prev.filter(id => !visibleIds.includes(id)));
    } else {
      setSelectedContactMap((prev) => {
        const next = { ...prev };
        filteredContacts.forEach((contact) => {
          const id = getCampaignId(contact);
          next[id] = next[id] || {
            id,
            name: contact.name || contact.phone || `Contact ${id}`,
            phone: contact.phone || "",
            tags: contact.tags || "",
          };
        });
        return next;
      });
      setSelectedContacts(prev => [...new Set([...prev, ...visibleIds])]);
    }
  };

  // Raw queue statuses the backend emits before its processor runs
  const BACKEND_QUEUE_STATUSES = new Set([
    "QUEUED", "PENDING", "OUTBOUND_QUEUED", "OUTBOUND_PENDING",
    "DRAFT", "PROCESSING",
  ]);

  // Poll history every 1.5 s until the newest campaign leaves a queue state
  // or until maxWaitMs elapses — whichever comes first.
  const pollUntilProcessed = useCallback(async (maxWaitMs = 15000, intervalMs = 1500) => {
    const deadline = Date.now() + maxWaitMs;
    while (Date.now() < deadline) {
      await new Promise(r => setTimeout(r, intervalMs));
      try {
        const r = await api.get("/api/campaigns/history/page", {
          params: {
            status: histFilter === "ALL" ? undefined : histFilter,
            query: histSearch.trim() || undefined,
            ...dateRangeParams(histDateRange),
            page: 0,
            size: HIST_PER_PAGE,
          },
        });
        const payload = r.data || {};
        const raw = Array.isArray(payload.items) ? payload.items : Array.isArray(payload.content) ? payload.content : [];
        if (raw.length === 0) { setHistory([]); return; }

        // Find the newest campaign by createdAt / scheduledAt
        const newest = [...raw].sort((a, b) =>
          new Date(b.createdAt || b.scheduledAt || 0) -
          new Date(a.createdAt || a.scheduledAt || 0)
        )[0];

        const rawStatus = (newest?.status ?? "").toUpperCase();
        if (!BACKEND_QUEUE_STATUSES.has(rawStatus)) {
          // Campaign has been processed — commit to state and exit
          setHistory(raw.map(normalizeCampaign));
          setHistPage(1);
          setHistPageInfo({
            page: payload.page ?? 0,
            size: payload.size ?? HIST_PER_PAGE,
            totalElements: payload.totalElements ?? raw.length,
            totalPages: Math.max(1, payload.totalPages ?? 1),
            hasNext: Boolean(payload.hasNext),
            hasPrevious: Boolean(payload.hasPrevious),
          });
          return;
        }
      } catch (e) {
        console.warn("[Poll] history fetch failed:", e);
        break;
      }
    }
    // Timed out — load whatever is available
    console.warn("[Poll] Timed out waiting for campaign to leave queue state");
    await loadHistory();
  }, [histDateRange, histFilter, histSearch, loadHistory]);

  const submit = async () => {
    setSubmitError("");
    setSubmitSuccess("");
    if (!name || !templateId || (!selectedSegmentId && selectedContacts.length === 0)) {
      setSubmitError("Please fill all fields and choose a segment, contacts, or both.");
      return;
    }
    if (selectedSegmentId && !selectedSegment) {
      setSubmitError("The selected segment is invalid. Please choose a valid saved segment or clear it.");
      return;
    }
    if (selectedTemplate && !templateReadyForSend) {
      setSubmitError(
        `Template "${selectedTemplate.metaTemplateName}" is not ready to send. Current status: ${selectedTemplateStatus || "UNKNOWN"}.`
      );
      return;
    }
    if (selectedTemplateHeaderFormat && !headerMediaUrl.trim()) {
      setSubmitError(`This template requires a ${selectedTemplateHeaderFormat.toLowerCase()} header media. Choose/upload it from Media Library before creating the campaign.`);
      return;
    }
    if (selectedTemplateHeaderFormat && !isPublicHttpsUrl(headerMediaUrl.trim())) {
      setSubmitError("Campaign header media must be a public HTTPS URL.");
      return;
    }
    if (selectedTemplateHeaderFormat && isMetaSampleMediaUrl(headerMediaUrl.trim())) {
      setSubmitError("Meta sample template media cannot be used for campaigns. Choose/upload the actual campaign image from Media Library.");
      return;
    }
    if (!sendNow && !scheduledAt) {
      setSubmitError("Please select a scheduled date and time.");
      return;
    }
    if (!sendNow && new Date(scheduledAt) <= new Date()) {
      setSubmitError("Scheduled time must be in the future.");
      return;
    }
    setSending(true);
    try {
      const res = await api.post("/api/campaigns", {
        name,
        templateId,
        segmentId: selectedSegmentId ? Number(selectedSegmentId) : null,
        headerMediaUrl: selectedTemplateHeaderFormat ? headerMediaUrl.trim() : null,
        contactIds: selectedContacts,
        sendNow,
        scheduledAt: sendNow ? null : new Date(scheduledAt).toISOString(),
      });

      const msg = res?.data?.message ?? "";
      const ok  = (res?.status >= 200 && res?.status < 300) ||
                  msg.toLowerCase().includes("success") ||
                  msg.toLowerCase().includes("queued");
      if (!ok) throw new Error(msg || "Unexpected response");

      setSent(true);
      setSubmitSuccess(sendNow ? "Campaign queued successfully." : "Campaign scheduled successfully.");
      setName(""); setTemplateId(""); setSelectedContacts([]); setSelectedContactMap({}); setSelectedSegmentId("");
      setHeaderMediaUrl("");
      setSendNow(true); setScheduledAt("");

      // Switch to history immediately, then poll until backend processes the campaign
      setActiveTab("history");
      await pollUntilProcessed(15000, 1500);

      setTimeout(() => setSent(false), 3000);
    } catch (e) {
      console.error("Campaign submit error:", e);
      setSubmitError(apiErrorMessage(e, "Failed to send campaign."));
    } finally {
      setSending(false);
    }
  };

  const selectedTemplate = templates.find(t => String(t.id) === String(templateId));
  const selectedTemplateHeaderFormat = templateHeaderMediaFormat(selectedTemplate);
  const selectedTemplateStatus = (selectedTemplate?.status || "").toUpperCase();
  const templateReadyForSend =
    !selectedTemplate ||
    !selectedTemplateStatus ||
    ["APPROVED", "ACTIVE"].includes(selectedTemplateStatus);
  const sendReadiness = [
    {
      label: "Template selected",
      ok: Boolean(selectedTemplate),
      helper: selectedTemplate
        ? selectedTemplate.metaTemplateName
        : "Choose a stored WhatsApp template first.",
    },
    {
      label: "Template approved",
      ok: Boolean(selectedTemplate) && templateReadyForSend,
      helper: selectedTemplate
        ? selectedTemplateStatus || "Status not yet synced from Meta"
        : "Template status is checked after selection.",
    },
    ...(selectedTemplateHeaderFormat ? [{
      label: "Header media selected",
      ok: Boolean(headerMediaUrl.trim()) && isPublicHttpsUrl(headerMediaUrl.trim()) && !isMetaSampleMediaUrl(headerMediaUrl.trim()),
      helper: headerMediaUrl.trim()
        ? "Real campaign header media is ready."
        : `This template requires ${selectedTemplateHeaderFormat.toLowerCase()} header media.`,
    }] : []),
    {
      label: "Audience selected",
      ok: Boolean(selectedSegmentId || selectedContacts.length > 0),
      helper:
        selectedSegmentId || selectedContacts.length > 0
          ? `${selectedSegmentId ? "Segment selected" : "No segment"}${selectedSegmentId && selectedContacts.length ? " + " : ""}${selectedContacts.length ? `${selectedContacts.length} direct contact${selectedContacts.length !== 1 ? "s" : ""}` : ""}`
          : "Pick a saved segment, direct contacts, or both.",
    },
    {
      label: "Schedule valid",
      ok: sendNow || (!!scheduledAt && new Date(scheduledAt) > new Date()),
      helper: sendNow
        ? "Campaign will send immediately."
        : scheduledAt
          ? new Date(scheduledAt) > new Date()
            ? `Scheduled for ${new Date(scheduledAt).toLocaleString()}`
            : "Scheduled time must be in the future."
          : "Choose a future date and time.",
    },
  ];

  const scheduleLabel = sendNow
    ? "Send immediately"
    : scheduledAt
      ? new Date(scheduledAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })
      : "Not set";
  const selectedDirectContacts = selectedContacts
    .map((id) => selectedContactMap[id])
    .filter(Boolean);
  const manualAudienceSummary = selectedContacts.length
    ? `${selectedContacts.length} direct contact${selectedContacts.length !== 1 ? "s" : ""}`
    : "No direct contacts";
  const totalContactLibrary = contactPageMeta.totalElements;

  const generateCampaignCopy = async () => {
    setAiCopyLoading(true);
    setSubmitError("");
    try {
      const response = await api.post("/api/ai/campaign-copy", {
        campaignName: name,
        selectedTemplate: selectedTemplate?.metaTemplateName || selectedTemplate?.name || "",
        templateStatus: selectedTemplateStatus || "",
        audience: selectedSegmentId
          ? `Segment #${selectedSegmentId}${selectedContacts.length ? ` plus ${selectedContacts.length} direct contacts` : ""}`
          : `${selectedContacts.length} direct contacts`,
        schedule: scheduleLabel,
        headerMediaRequired: selectedTemplateHeaderFormat || "",
      });
      setAiCopyResult(response.data?.text || "No AI campaign copy returned.");
    } catch (error) {
      setSubmitError(apiErrorMessage(error, "AI campaign copy failed."));
    } finally {
      setAiCopyLoading(false);
    }
  };

  const histCounts = history.reduce((a, c) => { a[c.status] = (a[c.status] || 0) + 1; return a; }, {});

  const histFiltered = [...history].sort((a, b) => {
      const da = new Date(a.scheduledAt || a.createdAt);
      const db = new Date(b.scheduledAt || b.createdAt);
      return histSortDesc ? db - da : da - db;
    });

  const histTotalPages     = Math.max(1, histPageInfo.totalPages || 1);
  const histPageClamped    = Math.min(histPage, histTotalPages);
  const histPagedCampaigns = histFiltered;

  const histTabs = [
    { key: "ALL",       label: "All",       color: "#6b7280" },
    { key: "SCHEDULED", label: "Scheduled", color: "#0ea5e9" },
    { key: "SENDING",   label: "Sending",   color: "#f59e0b" },
    { key: "PAUSED",    label: "Paused",    color: "#8b5cf6" },
    { key: "SENT",      label: "Sent",      color: "#10b981" },
    { key: "FAILED",    label: "Failed",    color: "#ef4444" },
    { key: "CANCELLED", label: "Cancelled", color: "#9ca3af" },
  ];

  // ── FIX: include SENDING + PAUSED in banner stats, not just SENT/FAILED
  const aggStats = history
    .filter(c => !["CANCELLED", "SCHEDULED"].includes(c.status))
    .reduce((acc, c) => {
      acc.total     += Number(c.recipientCount  ?? 0);
      acc.delivered += Number(c.deliveredCount  ?? 0);
      acc.read      += Number(c.readCount       ?? 0);
      acc.failed    += Number(c.failedCount     ?? 0);
      return acc;
    }, { total: 0, delivered: 0, read: 0, failed: 0 });

  return (
    <div style={{ fontFamily: "'DM Sans', sans-serif", background: "#f0fdfa" }}>
      <div className="campaign-container">
        <div className="page-header">
          <h1>Campaigns</h1>
          <p>Create and manage your WhatsApp campaigns</p>
        </div>

        <div className="page-tabs">
          <button className={`page-tab ${activeTab === "create" ? "active" : ""}`} onClick={() => setActiveTab("create")}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            Create Campaign
          </button>
          <button className={`page-tab ${activeTab === "history" ? "active" : ""}`} onClick={() => setActiveTab("history")}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
            </svg>
            Scheduled History
            {histPageInfo.totalElements > 0 && <span className="page-tab-badge">{histPageInfo.totalElements}</span>}
          </button>
          <button className={`page-tab ${activeTab === "templates" ? "active" : ""}`} onClick={() => setActiveTab("templates")}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
            </svg>
            Template Status
            {history.length > 0 && (
              <span className="page-tab-badge" style={{ background: "#0ea5e9" }}>
                {calcTemplateStats(history).length}
              </span>
            )}
          </button>
        </div>

        {/* ══ CREATE TAB ══ */}
        {activeTab === "create" && (
          <div className="layout">
            <div className="left-panel">
              <div className={`audience-guide ${audienceGuideOpen ? "open" : ""}`}>
                <button
                  type="button"
                  className="audience-guide-toggle"
                  onClick={() => setAudienceGuideOpen((value) => !value)}
                  aria-expanded={audienceGuideOpen}
                >
                  <span className="audience-guide-icon">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M3 11l18-8-8 18-2-8-8-2z"/>
                    </svg>
                  </span>
                  <span className="audience-guide-copy">
                    <span className="audience-guide-title">Campaign audience guide</span>
                    <span className="audience-guide-subtitle">Use a saved segment for large sends. Add direct contacts only for one-off overrides.</span>
                  </span>
                  <span className="audience-guide-action">
                    {audienceGuideOpen ? "Hide" : "Show"}
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="6 9 12 15 18 9"/>
                    </svg>
                  </span>
                </button>
                {audienceGuideOpen && (
                  <div className="audience-guide-body">
                    {[
                      {
                        step: "1",
                        title: "Choose a segment",
                        text: "Target all contacts that match saved filters like source, pipeline stage, city, tag, or conversation status.",
                      },
                      {
                        step: "2",
                        title: "Add direct contacts only if needed",
                        text: "Manual contacts are merged with the segment audience, useful for a few extra recipients or exceptions.",
                      },
                      {
                        step: "3",
                        title: "Send or schedule",
                        text: "Confirm template readiness, choose immediate send or future schedule, then submit the campaign.",
                      },
                    ].map((item) => (
                      <div key={item.step} className="audience-guide-step">
                        <span className="audience-guide-step-no">{item.step}</span>
                        <span>
                          <span className="audience-guide-step-title">{item.title}</span>
                          <span className="audience-guide-step-text">{item.text}</span>
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {(submitError || submitSuccess) && (
                <div
                  className="card"
                  style={{
                    background: submitError ? "#fef2f2" : "#ecfdf5",
                    border: `1px solid ${submitError ? "#fecaca" : "#86efac"}`,
                    color: submitError ? "#b91c1c" : "#166534",
                  }}
                >
                  <p style={{ margin: 0, fontSize: 14, fontWeight: 700 }}>
                    {submitError || submitSuccess}
                  </p>
                </div>
              )}

              <div className="card">
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
                  <div style={{ minWidth: 220, flex: "1 1 280px" }}>
                    <p className="card-title" style={{ marginBottom: 4 }}>AI Campaign Copy</p>
                    <p style={{ margin: 0, fontSize: 13, color: "#64748b", lineHeight: 1.5 }}>
                      Generate WhatsApp and email copy ideas from your selected template, audience, and schedule.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={generateCampaignCopy}
                    disabled={aiCopyLoading}
                    className="inline-flex w-full items-center justify-center rounded-xl bg-teal-700 px-4 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
                    style={{ whiteSpace: "nowrap", maxWidth: "100%" }}
                  >
                    {aiCopyLoading ? "Generating..." : "Generate AI Copy"}
                  </button>
                </div>
                {aiCopyResult && (
                  <div style={{ marginTop: 14, border: "1px solid #dbeafe", background: "#eff6ff", color: "#1e3a8a", borderRadius: 14, padding: 14 }}>
                    <pre style={{ margin: 0, maxHeight: 280, overflowY: "auto", overflowX: "hidden", whiteSpace: "pre-wrap", wordBreak: "break-word", fontFamily: "inherit", fontSize: 13, lineHeight: 1.6 }}>{aiCopyResult}</pre>
                  </div>
                )}
              </div>

              <div className="card">
                <p className="card-title">Send Readiness</p>
                <div style={{ display: "grid", gap: 10 }}>
                  {sendReadiness.map((item) => (
                    <div
                      key={item.label}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        gap: 12,
                        padding: "12px 14px",
                        borderRadius: 14,
                        border: `1px solid ${item.ok ? "#bbf7d0" : "#fed7aa"}`,
                        background: item.ok ? "#f0fdf4" : "#fff7ed",
                      }}
                    >
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 800, color: "#0f172a" }}>{item.label}</div>
                        <div style={{ marginTop: 4, fontSize: 12.5, color: "#475569", lineHeight: 1.5 }}>
                          {item.helper}
                        </div>
                      </div>
                      <span
                        style={{
                          alignSelf: "flex-start",
                          padding: "6px 10px",
                          borderRadius: 999,
                          fontSize: 11,
                          fontWeight: 800,
                          background: item.ok ? "#dcfce7" : "#ffedd5",
                          color: item.ok ? "#166534" : "#9a3412",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {item.ok ? "Ready" : "Needs attention"}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="card">
                <p className="card-title">Campaign Details</p>
                <div className="field-group">
                  <label className="field-label">Campaign Name</label>
                  <input className="field-input" placeholder="e.g. Summer Promo 2025" value={name} onChange={e => setName(e.target.value)} />
                </div>
                <div className="field-group" style={{ marginBottom: 0 }}>
                  <label className="field-label">Message Template</label>
                  <select
                    className="field-input"
                    value={templateId}
                    onChange={e => {
                      setTemplateId(e.target.value);
                      setHeaderMediaUrl("");
                    }}
                  >
                    <option value="">Select a template...</option>
                    {templates.map(t => <option key={t.id} value={t.id}>{t.metaTemplateName}</option>)}
                  </select>
                </div>
                {selectedTemplateHeaderFormat && (
                  <div className="field-group" style={{ marginTop: 14, marginBottom: 0 }}>
                    <label className="field-label">Campaign Header {selectedTemplateHeaderFormat.toLowerCase()}</label>
                    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      <input
                        className="field-input"
                        value={headerMediaUrl}
                        onChange={e => setHeaderMediaUrl(e.target.value)}
                        placeholder={`https://example.com/header.${selectedTemplateHeaderFormat === "IMAGE" ? "jpg" : selectedTemplateHeaderFormat === "VIDEO" ? "mp4" : "pdf"}`}
                      />
                      <button
                        type="button"
                        className="btn-secondary"
                        onClick={() => setHeaderMediaDialogOpen(true)}
                      >
                        Choose
                      </button>
                    </div>
                    <MediaLibraryDialog
                      open={headerMediaDialogOpen}
                      title={`Choose ${selectedTemplateHeaderFormat.toLowerCase()} header media`}
                      helper="Campaigns need a real public media asset for header templates. Meta sample media cannot be reused."
                      allowedTypes={[selectedTemplateHeaderFormat]}
                      onSelect={(asset) => {
                        setHeaderMediaUrl(asset.publicUrl || "");
                        setHeaderMediaDialogOpen(false);
                        setSubmitError("");
                      }}
                      onClose={() => setHeaderMediaDialogOpen(false)}
                    />
                    {headerMediaUrl.trim() && !isPublicHttpsUrl(headerMediaUrl.trim()) && (
                      <p className="field-hint" style={{ color: "#b45309" }}>Header media must be a public HTTPS URL.</p>
                    )}
                    {headerMediaUrl.trim() && isMetaSampleMediaUrl(headerMediaUrl.trim()) && (
                      <p className="field-hint" style={{ color: "#dc2626" }}>Meta sample media cannot be used for campaign sending.</p>
                    )}
                    <p className="field-hint">This image/document/video is sent with every campaign message for this template.</p>
                  </div>
                )}
                {selectedTemplate && (
                  <WhatsAppTemplatePreview
                    template={selectedTemplate}
                    headerMediaUrl={selectedTemplateHeaderFormat ? headerMediaUrl : ""}
                  />
                )}
              </div>

              <div className="card">
                <p className="card-title">Schedule</p>
                <div className="schedule-toggle">
                  <button type="button" className={`schedule-toggle-btn ${sendNow ? "active" : ""}`} onClick={() => setSendNow(true)}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M22 2L11 13M22 2L15 22l-4-9-9-4 20-7z"/>
                    </svg>
                    Send Now
                  </button>
                  <button type="button" className={`schedule-toggle-btn ${!sendNow ? "active" : ""}`} onClick={() => setSendNow(false)}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
                    </svg>
                    Schedule for Later
                  </button>
                </div>
                {!sendNow && (
                  <div className="field-group" style={{ marginTop: 14, marginBottom: 0 }}>
                    <label className="field-label">Scheduled Date &amp; Time</label>
                    <input type="datetime-local" className="field-input" min={minDateTime} value={scheduledAt} onChange={e => setScheduledAt(e.target.value)} />
                    <p className="field-hint">Time is interpreted in your local timezone and sent to the server as UTC.</p>
                  </div>
                )}
              </div>

              <div className="card">
                <p className="card-title">Select Recipients</p>
                <div className="field-group">
                  <label className="field-label">Saved Segment (Dynamic Audience)</label>
                  <select className="field-input" value={selectedSegmentId} onChange={e => setSelectedSegmentId(e.target.value)}>
                    <option value="">No saved segment</option>
                    {segments.map(segment => (
                      <option key={segment.id} value={segment.id}>
                        {segment.name}
                      </option>
                    ))}
                  </select>
                  <p className="field-hint">
                    Use a saved segment to target all contacts that match its filters. You can still add direct contacts below as one-off overrides.
                  </p>
                  {segmentError && (
                    <div
                      style={{
                        marginTop: 10,
                        padding: "10px 12px",
                        borderRadius: 12,
                        background: "#fef2f2",
                        border: "1px solid #fecaca",
                        color: "#b91c1c",
                        fontSize: 12.5,
                        fontWeight: 600,
                      }}
                    >
                      {segmentError}
                    </div>
                  )}
                  {selectedSegment && (
                    <div
                      style={{
                        marginTop: 12,
                        padding: "12px 14px",
                        borderRadius: 14,
                        background: "#f0fdfa",
                        border: "1px solid #99f6e4",
                        display: "flex",
                        justifyContent: "space-between",
                        gap: 12,
                        flexWrap: "wrap",
                        alignItems: "center",
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 700, color: "#115e59" }}>{selectedSegment.name}</div>
                        <div style={{ fontSize: 12, color: "#0f766e", marginTop: 4 }}>
                          {selectedSegment.stage ? `Pipeline ${labelFor(selectedSegment.stage)}` : "Any pipeline stage"}
                          {selectedSegment.leadSource ? ` • Source ${labelFor(selectedSegment.leadSource)}` : ""}
                          {selectedSegment.industryKey ? ` • Industry ${labelFor(selectedSegment.industryKey)}` : ""}
                          {selectedSegment.city ? ` • City ${selectedSegment.city}` : ""}
                          {selectedSegment.tag ? ` • Tag ${selectedSegment.tag}` : ""}
                          {selectedSegment.conversationStatus ? ` • ${selectedSegment.conversationStatus}` : ""}
                        </div>
                      </div>
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        <button
                          type="button"
                          onClick={() => navigate("/dashboard/segments")}
                          style={{ border: "1px solid #14b8a6", background: "#fff", color: "#0f766e", borderRadius: 10, padding: "8px 12px", fontWeight: 700, cursor: "pointer" }}
                        >
                          Manage Segments
                        </button>
                        <button
                          type="button"
                          onClick={() => setSelectedSegmentId("")}
                          style={{ border: "1px solid #cbd5e1", background: "#fff", color: "#475569", borderRadius: 10, padding: "8px 12px", fontWeight: 700, cursor: "pointer" }}
                        >
                          Clear Segment
                        </button>
                      </div>
                    </div>
                  )}
                </div>
                <div
                  style={{
                    marginTop: 8,
                    padding: "14px 16px",
                    borderRadius: 16,
                    border: "1px solid #e5e7eb",
                    background: "#fafafa",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 800, color: "#0f172a" }}>
                        Optional direct contacts
                      </div>
                      <div style={{ marginTop: 4, fontSize: 12.5, color: "#64748b", lineHeight: 1.5 }}>
                        Best for a few manual additions or overrides. For large sends, use a saved segment instead of browsing your full contact list.
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setDirectContactsExpanded((prev) => !prev);
                        setContactPage(0);
                      }}
                      style={{
                        border: "1px solid #cbd5e1",
                        background: "#fff",
                        color: "#0f172a",
                        borderRadius: 10,
                        padding: "9px 12px",
                        fontWeight: 700,
                        cursor: "pointer",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {directContactsExpanded ? "Hide direct contacts" : "Add direct contacts"}
                    </button>
                  </div>

                  <div
                    style={{
                      marginTop: 12,
                      display: "flex",
                      flexWrap: "wrap",
                      gap: 8,
                      alignItems: "center",
                    }}
                  >
                    <span
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 6,
                        padding: "7px 10px",
                        borderRadius: 999,
                        background: "#eff6ff",
                        color: "#1d4ed8",
                        fontSize: 12,
                        fontWeight: 700,
                      }}
                    >
                      {manualAudienceSummary}
                    </span>
                    {selectedDirectContacts.slice(0, 3).map((contact) => (
                      <span key={contact.id} className="recipient-pill">
                        {contact.name}
                      </span>
                    ))}
                    {selectedContacts.length > 3 && (
                      <span className="recipient-more">+{selectedContacts.length - 3} more</span>
                    )}
                  </div>

                  {directContactsExpanded && (
                    <>
                      <div className="contact-search" style={{ marginTop: 14 }}>
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
                        <input
                          placeholder="Search contacts by name or phone..."
                          value={searchQuery}
                          onChange={e => {
                            setSearchQuery(e.target.value);
                            setContactPage(0);
                          }}
                        />
                      </div>
                      <p className="field-hint" style={{ marginTop: 10 }}>
                        Search and add only the few direct contacts you need. Large audiences should come from saved segments.
                      </p>
                      <div className="contact-list-header">
                        <span className="contact-count">
                          {contactSearchLoading
                            ? "Loading contacts..."
                            : `${contactPageMeta.totalElements} contact${contactPageMeta.totalElements !== 1 ? "s" : ""} in your library`}
                        </span>
                        <button className="select-all-btn" onClick={selectAll}>
                          {filteredContacts.length > 0 && filteredContacts.every(c => selectedContacts.includes(getCampaignId(c)))
                            ? "Deselect page"
                            : "Select page"}
                        </button>
                      </div>
                      {contactSearchError && (
                        <div
                          style={{
                            marginBottom: 10,
                            padding: "10px 12px",
                            borderRadius: 12,
                            background: "#fef2f2",
                            border: "1px solid #fecaca",
                            color: "#b91c1c",
                            fontSize: 12.5,
                            fontWeight: 600,
                          }}
                        >
                          {contactSearchError}
                        </div>
                      )}
                      <div className="contact-list">
                        {contactSearchLoading ? (
                          <div className="empty-contacts">Loading contacts…</div>
                        ) : filteredContacts.length === 0 ? (
                          <div className="empty-contacts">No contacts found</div>
                        ) : (
                          filteredContacts.map(c => {
                            const id = getCampaignId(c);
                            const isSelected = selectedContacts.includes(id);
                            return (
                              <div key={id} className={`contact-item ${isSelected ? "selected" : ""}`} onClick={() => toggleContact(c)}>
                                <div className="contact-checkbox">
                                  {isSelected && (
                                    <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                                      <path d="M2 5l2.5 2.5L8 3" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                                    </svg>
                                  )}
                                </div>
                                <div className="contact-info">
                                  <div className="contact-name">{c.name}</div>
                                  <div className="contact-phone">{c.phone}</div>
                                </div>
                                {c.tags && <span className="contact-tag">{c.tags}</span>}
                              </div>
                            );
                          })
                        )}
                      </div>
                      <div
                        style={{
                          marginTop: 12,
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          gap: 12,
                          flexWrap: "wrap",
                        }}
                      >
                        <span style={{ fontSize: 12, color: "#94a3b8" }}>
                          Page {contactPage + 1} of {contactPageMeta.totalPages}
                        </span>
                        <div style={{ display: "flex", gap: 8 }}>
                          <button
                            type="button"
                            disabled={contactPage === 0}
                            onClick={() => setContactPage((prev) => Math.max(0, prev - 1))}
                            style={{
                              border: "1px solid #cbd5e1",
                              background: "#fff",
                              color: contactPage === 0 ? "#94a3b8" : "#334155",
                              borderRadius: 10,
                              padding: "8px 12px",
                              fontWeight: 700,
                              cursor: contactPage === 0 ? "not-allowed" : "pointer",
                            }}
                          >
                            Prev
                          </button>
                          <button
                            type="button"
                            disabled={contactPage + 1 >= contactPageMeta.totalPages}
                            onClick={() => setContactPage((prev) => Math.min(contactPageMeta.totalPages - 1, prev + 1))}
                            style={{
                              border: "1px solid #cbd5e1",
                              background: "#fff",
                              color: contactPage + 1 >= contactPageMeta.totalPages ? "#94a3b8" : "#334155",
                              borderRadius: 10,
                              padding: "8px 12px",
                              fontWeight: 700,
                              cursor: contactPage + 1 >= contactPageMeta.totalPages ? "not-allowed" : "pointer",
                            }}
                          >
                            Next
                          </button>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>

            <div className="summary-card" style={{ alignSelf: "flex-start", position: "sticky", top: 20 }}>
              <p className="summary-title">Campaign Summary</p>
              <div className="summary-row">
                <span className="summary-label">Name</span>
                <span className={`summary-value ${!name ? "empty" : ""}`}>{name || "Not set"}</span>
              </div>
              <div className="summary-row">
                <span className="summary-label">Template</span>
                <span className={`summary-value ${!selectedTemplate?.metaTemplateName ? "empty" : ""}`}>{selectedTemplate?.metaTemplateName || "Not selected"}</span>
              </div>
              <div className="summary-row">
                <span className="summary-label">Template Status</span>
                <span className={`summary-value ${!selectedTemplate ? "empty" : ""}`}>
                  {selectedTemplate ? (selectedTemplate.status || "Unknown") : "Select template"}
                </span>
              </div>
              <div className="summary-row">
                <span className="summary-label">Schedule</span>
                <span className={`summary-value ${!sendNow && !scheduledAt ? "empty" : ""}`}>{scheduleLabel}</span>
              </div>
              <div className="summary-row">
                <span className="summary-label">Recipients</span>
                {!selectedSegment && selectedContacts.length === 0 ? (
                  <span className="summary-value empty">None selected</span>
                ) : (
                  <div className="recipient-pills">
                    {selectedSegment && <span className="recipient-pill" style={{ background: "#ccfbf1", color: "#115e59" }}>Dynamic Segment: {selectedSegment.name}</span>}
                    {selectedDirectContacts.slice(0, 3).map(c => (
                      <span key={c.id} className="recipient-pill">{c.name}</span>
                    ))}
                    {selectedContacts.length > 3 && <span className="recipient-more">+{selectedContacts.length - 3} more</span>}
                  </div>
                )}
              </div>
              <div className="stats-row">
                <div className="stat-box">
                  <div className="stat-number">{selectedContacts.length}</div>
                  <div className="stat-label">Manual Contacts</div>
                </div>
                <div className="stat-box">
                  <div className="stat-number">{selectedSegment ? 1 : 0}</div>
                  <div className="stat-label">Dynamic Segments</div>
                </div>
                <div className="stat-box">
                  <div className="stat-number">{totalContactLibrary}</div>
                  <div className="stat-label">Contact Library</div>
                </div>
              </div>
              <button className={`send-btn ${sent ? "sent" : ""}`} onClick={submit} disabled={sending}>
                {sent ? (
                  <><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M20 6L9 17l-5-5"/></svg>{sendNow ? "Campaign Sent!" : "Campaign Scheduled!"}</>
                ) : sending ? (
                  sendNow ? "Sending..." : "Scheduling..."
                ) : (
                  <><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">{sendNow ? <path d="M22 2L11 13M22 2L15 22l-4-9-9-4 20-7z"/> : <><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></>}</svg>{sendNow ? "Send Campaign" : "Schedule Campaign"}</>
                )}
              </button>
            </div>
          </div>
        )}

        {/* ══ HISTORY TAB ══ */}
        {activeTab === "history" && (
          <div className="sch-panel">
            {history.length > 0 && (
              <div className="hist-summary-banner">
                <div className="hist-banner-stat">
                  <div className="hist-banner-icon total-icon">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
                      <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                    </svg>
                  </div>
                  <div>
                    <div className="hist-banner-val">{aggStats.total}</div>
                    <div className="hist-banner-lbl">Total Sent</div>
                  </div>
                </div>
                <div className="hist-banner-divider" />
                <div className="hist-banner-stat">
                  <div className="hist-banner-icon delivered-icon">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>
                    </svg>
                  </div>
                  <div>
                    <div className="hist-banner-val" style={{ color: "#10b981" }}>{aggStats.delivered}</div>
                    <div className="hist-banner-lbl">Delivered</div>
                  </div>
                </div>
                <div className="hist-banner-divider" />
                <div className="hist-banner-stat">
                  <div className="hist-banner-icon rate-icon">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
                    </svg>
                  </div>
                  <div>
                    <div className="hist-banner-val" style={{ color: "#8b5cf6" }}>{aggStats.read}</div>
                    <div className="hist-banner-lbl">Read</div>
                  </div>
                </div>
                <div className="hist-banner-divider" />
                <div className="hist-banner-stat">
                  <div className="hist-banner-icon failed-icon">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>
                    </svg>
                  </div>
                  <div>
                    <div className="hist-banner-val" style={{ color: "#ef4444" }}>{aggStats.failed}</div>
                    <div className="hist-banner-lbl">Failed</div>
                  </div>
                </div>
                <div className="hist-banner-divider" />
                <div className="hist-banner-stat">
                  <div className="hist-banner-icon rate-icon">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
                    </svg>
                  </div>
                  <div>
                    <div className="hist-banner-val" style={{ color: "#0ea5e9" }}>
                      {aggStats.total > 0 ? Math.round((aggStats.delivered / aggStats.total) * 100) : 0}%
                    </div>
                    <div className="hist-banner-lbl">Success Rate</div>
                  </div>
                </div>
              </div>
            )}

            <div className="sch-toolbar">
              <div className="sch-filters">
                {histTabs.map(t => (
                  <button
                    key={t.key}
                    className={`sch-filter-tab ${histFilter === t.key ? "active" : ""}`}
                    style={histFilter === t.key ? { borderColor: t.color, color: t.color } : {}}
                    onClick={() => setHistFilter(t.key)}
                  >
                    {t.label}
                    <span className="sch-filter-count" style={histFilter === t.key ? { background: t.color } : {}}>
                      {t.key === histFilter ? histPageInfo.totalElements : (histCounts[t.key] || 0)}
                    </span>
                  </button>
                ))}
              </div>
              <div className="sch-toolbar-right">
                <div className="sch-search">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
                  <input placeholder="Search by template or campaign…" value={histSearch} onChange={e => setHistSearch(e.target.value)} />
                </div>
                <button className="sch-sort-btn" onClick={() => setHistSortDesc(p => !p)}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    {histSortDesc ? <><line x1="12" y1="20" x2="12" y2="4"/><polyline points="18 10 12 4 6 10"/></> : <><line x1="12" y1="4" x2="12" y2="20"/><polyline points="6 14 12 20 18 14"/></>}
                  </svg>
                  {histSortDesc ? "Newest first" : "Oldest first"}
                </button>
                <button className="sch-refresh-btn" onClick={loadHistory} disabled={histLoading}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                    style={{ animation: histLoading ? "schSpin 0.8s linear infinite" : "none" }}>
                    <polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
                  </svg>
                  Refresh
                </button>
              </div>
            </div>

            <div style={{ margin: "12px 0" }}>
              <DateRangeFilter
                value={histDateRange}
                preset={histDatePreset}
                onChange={setHistDateRange}
                onPresetChange={setHistDatePreset}
                compact
              />
            </div>

            <div className="sch-list">
              {histLoading ? (
                <div className="sch-empty"><div className="sch-spinner"/><p>Loading campaigns…</p></div>
              ) : histPageInfo.totalElements === 0 ? (
                <div className="sch-empty">
                  <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#d1d5db" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/>
                    <line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
                  </svg>
                  <p>No campaigns found</p>
                  <span>Try adjusting your filters or search</span>
                </div>
              ) : (
                <>
                  {histPagedCampaigns.map((c, index) => (
                    <CampaignHistoryRow
                      key={getCampaignId(c) || index}
                      campaign={{ ...c, id: getCampaignId(c) || index }}
                      onRefresh={loadHistory}
                    />
                  ))}
                  <div className="hist-pagination-footer">
                    <span className="hist-page-info">
                      Showing {histPageInfo.totalElements === 0 ? 0 : (histPageInfo.page * histPageInfo.size) + 1}–{Math.min(histPageInfo.totalElements, (histPageInfo.page * histPageInfo.size) + histPagedCampaigns.length)} of {histPageInfo.totalElements} campaign{histPageInfo.totalElements !== 1 ? "s" : ""}
                    </span>
                    <Pagination
                      currentPage={histPageClamped}
                      totalPages={histTotalPages}
                      onPageChange={setHistPage}
                    />
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* ══ TEMPLATE STATS TAB ══ */}
        {activeTab === "templates" && (
          <TemplateHistoryTab
            history={history}
            histLoading={histLoading}
            onRefresh={loadHistory}
          />
        )}
      </div>
    </div>
  );
}
