import { useState } from "react";
import "../index.css";

// ─── Delete Confirmation Popup ────────────────────────────────────────────────
function DeleteConfirmPopup({ contact, onConfirm, onCancel, isBulk, count }) {
  const [shaking, setShaking] = useState(false);

  const handleOverlayClick = () => {
    setShaking(true);
    setTimeout(() => setShaking(false), 400);
  };

  return (
    <div className="dc-overlay" onClick={handleOverlayClick}>
      <div
        className={`dc-card ${shaking ? "shaking" : ""}`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Icon */}
        <div className="dc-icon-wrap">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="3 6 5 6 21 6" />
            <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
            <path d="M10 11v6M14 11v6" />
            <path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2" />
          </svg>
        </div>

        {/* Text */}
        <p className="dc-title">
          {isBulk ? `Delete ${count} contacts?` : "Delete contact?"}
        </p>
        <p className="dc-body">
          {isBulk
            ? `You're about to permanently remove ${count} contacts from your list.`
            : "You're about to permanently remove this contact from your list."}
        </p>

        {/* Single contact pill */}
        {!isBulk && contact && (
          <div className="dc-contact-pill">
            <div className="dc-avatar">
              {(contact.name || contact.email || "?")[0].toUpperCase()}
            </div>
            <span className="dc-contact-name">
              {contact.name || contact.email || `ID: ${contact.id || contact._id}`}
            </span>
          </div>
        )}

        {/* Warning */}
        <div className="dc-warning">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
          <span className="dc-warning-text">This action cannot be undone.</span>
        </div>

        {/* Buttons */}
        <div className="dc-actions">
          <button className="dc-btn dc-btn-cancel" onClick={onCancel}>
            Cancel
          </button>
          <button className="dc-btn dc-btn-delete" onClick={onConfirm}>
            {isBulk ? `Delete ${count} contacts` : "Delete contact"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main DeleteContact Component ────────────────────────────────────────────
export default function DeleteContact({ selectedId, contacts, setContacts, setSelectedId, api }) {
  const [showPopup, setShowPopup] = useState(false);
  const [error, setError] = useState("");

  // selectedId can be a single id or an array of ids (bulk)
  const isBulk = Array.isArray(selectedId);
  const ids = isBulk ? selectedId : selectedId ? [selectedId] : [];

  const selectedContact = !isBulk
    ? contacts?.find((c) => (c.id || c._id) === selectedId)
    : null;

  const handleClick = () => {
    if (!ids.length) return;
    setError("");
    setShowPopup(true);
  };

  // ── DELETE /api/contacts/{id} for each selected id ────────────────────────
  const handleConfirm = async () => {
    setShowPopup(false);
    try {
      // Delete all selected (bulk or single)
      await Promise.all(
        ids.map((id) => api.delete(`/api/contacts/${id}`))
      );
      setContacts((prev) =>
        prev.filter((c) => !ids.includes(c.id || c._id))
      );
      setSelectedId(null);
    } catch (err) {
      console.error("Delete failed:", err);
      setError(
        err.response?.data?.message ||
          err.response?.data?.error ||
          "Could not delete the selected contact right now."
      );
    }
  };

  const handleCancel = () => setShowPopup(false);

  const hasSelection = ids.length > 0;

  return (
    <div style={{ display: "grid", gap: "8px" }}>
      <button
        onClick={handleClick}
        disabled={!hasSelection}
        style={{
          fontFamily: "'DM Sans', sans-serif",
          display: "inline-flex",
          alignItems: "center",
          gap: "7px",
          padding: "9px 18px",
          background: hasSelection ? "#e05c3a" : "#f0ece6",
          color: hasSelection ? "#fff" : "#b0a89e",
          border: "none",
          borderRadius: "10px",
          fontSize: "14px",
          fontWeight: "500",
          cursor: hasSelection ? "pointer" : "not-allowed",
          transition: "all 0.15s ease",
          letterSpacing: "-0.1px",
        }}
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="3 6 5 6 21 6" />
          <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
          <path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2" />
        </svg>
        {isBulk && ids.length > 1 ? `Delete ${ids.length} Contacts` : "Delete Contact"}
      </button>
      {error && (
        <p style={{ color: "#e11d48", fontSize: "13px", margin: 0 }}>
          {error}
        </p>
      )}

      {showPopup && (
        <DeleteConfirmPopup
          contact={selectedContact}
          isBulk={isBulk && ids.length > 1}
          count={ids.length}
          onConfirm={handleConfirm}
          onCancel={handleCancel}
        />
      )}
    </div>
  );
}
