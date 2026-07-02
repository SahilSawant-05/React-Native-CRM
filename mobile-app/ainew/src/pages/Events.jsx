import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import api from "../api/axios";

const CATEGORIES = [
  { id: 1, key: "PLANNING", name: "Planning", color: "#22c55e", bg: "#f0fdf4" },
  { id: 2, key: "MEETING", name: "Meeting", color: "#3b82f6", bg: "#eff6ff" },
  { id: 3, key: "REPORTING", name: "Reporting", color: "#f59e0b", bg: "#fffbeb" },
  { id: 4, key: "DESIGN", name: "Design", color: "#ef4444", bg: "#fef2f2" },
];

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const DAYS_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const DAYS_FULL = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const HOURS = Array.from({ length: 24 }, (_, i) => i === 0 ? "12 AM" : i < 12 ? `${i} AM` : i === 12 ? "12 PM" : `${i - 12} PM`);

function toDateStr(year, month, day) {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function getDaysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDay(year, month) {
  return new Date(year, month, 1).getDay();
}

function isToday(year, month, day) {
  const now = new Date();
  return now.getFullYear() === year && now.getMonth() === month && now.getDate() === day;
}

function startOfWeek(date) {
  const next = new Date(date);
  next.setDate(next.getDate() - next.getDay());
  next.setHours(0, 0, 0, 0);
  return next;
}

function addDays(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function fmtDateStr(date) {
  return toDateStr(date.getFullYear(), date.getMonth(), date.getDate());
}

function toInputTime(raw) {
  if (!raw) return "";
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function formatDisplayTime(raw) {
  if (!raw) return "";
  const [hourText = "0", minuteText = "00"] = raw.split(":");
  const hour = Number(hourText);
  const minute = Number(minuteText);
  if (Number.isNaN(hour) || Number.isNaN(minute)) return raw;
  const period = hour >= 12 ? "PM" : "AM";
  const twelveHour = hour % 12 === 0 ? 12 : hour % 12;
  return `${twelveHour}:${String(minute).padStart(2, "0")} ${period}`;
}

function buildIso(date, time, allDay) {
  if (!date) return null;
  const localDateTime = allDay ? `${date}T00:00` : `${date}T${time || "09:00"}`;
  const parsed = new Date(localDateTime);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function getCategoryById(id) {
  return CATEGORIES.find((item) => item.id === id) || CATEGORIES[0];
}

function getCategoryByKey(key) {
  return CATEGORIES.find((item) => item.key === key) || CATEGORIES[0];
}

function normalizeEvent(raw) {
  const category = getCategoryByKey((raw.category || "PLANNING").toUpperCase());
  const startDate = raw.startAt ? new Date(raw.startAt) : null;
  const endDate = raw.endAt ? new Date(raw.endAt) : null;

  return {
    id: raw.id,
    title: raw.title || "Untitled Event",
    date: startDate && !Number.isNaN(startDate.getTime()) ? fmtDateStr(startDate) : "",
    start: toInputTime(raw.startAt),
    end: toInputTime(raw.endAt),
    displayStart: raw.allDay ? "All day" : formatDisplayTime(toInputTime(raw.startAt)),
    displayEnd: raw.endAt ? formatDisplayTime(toInputTime(raw.endAt)) : "",
    categoryId: category.id,
    categoryKey: category.key,
    description: raw.description || "",
    location: raw.location || "",
    contactId: raw.contactId || null,
    contactName: raw.contactName || "",
    assignedUserId: raw.assignedUserId || null,
    assignedUserEmail: raw.assignedUserEmail || "",
    createdByUserEmail: raw.createdByUserEmail || "",
    status: raw.status || "SCHEDULED",
    allDay: Boolean(raw.allDay),
    startAt: raw.startAt,
    endAt: raw.endAt,
  };
}

function getRangeForView(viewMode, year, month, baseDate) {
  if (viewMode === "Year") {
    const from = new Date(year, 0, 1, 0, 0, 0, 0);
    const to = new Date(year, 11, 31, 23, 59, 59, 999);
    return { from, to };
  }

  if (viewMode === "Month") {
    const from = new Date(year, month, 1, 0, 0, 0, 0);
    const to = new Date(year, month + 1, 0, 23, 59, 59, 999);
    return { from, to };
  }

  if (viewMode === "Week") {
    const from = startOfWeek(baseDate);
    const to = addDays(from, 6);
    to.setHours(23, 59, 59, 999);
    return { from, to };
  }

  if (viewMode === "Day") {
    const from = new Date(baseDate);
    from.setHours(0, 0, 0, 0);
    const to = new Date(baseDate);
    to.setHours(23, 59, 59, 999);
    return { from, to };
  }

  const from = new Date();
  from.setHours(0, 0, 0, 0);
  const to = addDays(from, 180);
  to.setHours(23, 59, 59, 999);
  return { from, to };
}

function Modal({ onClose, onSave, onDelete, initial, saving, error, users = [] }) {
  const isEditing = Boolean(initial?.id);
  const [title, setTitle] = useState(initial?.title || "");
  const [date, setDate] = useState(initial?.date || "");
  const [start, setStart] = useState(initial?.start || "09:00");
  const [end, setEnd] = useState(initial?.end || "10:00");
  const [categoryId, setCategoryId] = useState(initial?.categoryId || 1);
  const [assignedUserId, setAssignedUserId] = useState(initial?.assignedUserId ? String(initial.assignedUserId) : "");
  const [location, setLocation] = useState(initial?.location || "");
  const [description, setDescription] = useState(initial?.description || "");
  const [allDay, setAllDay] = useState(Boolean(initial?.allDay));
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [localError, setLocalError] = useState("");
  const activeError = localError || error;
  const conflictError = activeError?.startsWith("Calendar conflict:");

  const submit = () => {
    setLocalError("");
    if (!title.trim()) {
      setLocalError("Event title is required.");
      return;
    }
    if (!date) {
      setLocalError("Date is required.");
      return;
    }
    if (!allDay && !start) {
      setLocalError("Start time is required.");
      return;
    }
    if (!allDay && start && end && end <= start) {
      setLocalError("End time must be after start time.");
      return;
    }

    onSave({
      title: title.trim(),
      date,
      start,
      end,
      categoryId,
      assignedUserId,
      location: location.trim(),
      description: description.trim(),
      allDay,
    });
  };

  return (
    <div className="calendar-modal-overlay" style={S.overlay} onClick={onClose}>
      <div className="calendar-modal" style={S.modal} onClick={(event) => event.stopPropagation()}>
        <div style={S.modalHeader}>
          <span style={S.modalTitle}>{isEditing ? "Edit Event" : "Create New Event"}</span>
          <button style={S.iconBtn} onClick={onClose}>✕</button>
        </div>

        {confirmDelete && (
          <div style={S.confirmBanner}>
            <span style={{ fontWeight: 700, color: "#b91c1c", fontSize: 13 }}>
              Permanently delete this event?
            </span>
            <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
              <button style={S.confirmYes} disabled={saving} onClick={() => onDelete(initial.id)}>
                Yes, Delete
              </button>
              <button style={S.confirmNo} onClick={() => setConfirmDelete(false)}>Keep It</button>
            </div>
          </div>
        )}

        <div className="calendar-modal-body" style={S.modalBody}>
          {activeError && (
            <div style={conflictError ? S.conflictBanner : S.errorBanner}>{activeError}</div>
          )}

          <label style={S.label}>Event Title</label>
          <input style={S.input} placeholder="Enter event title" value={title} onChange={(e) => setTitle(e.target.value)} />

          <label style={S.label}>Date</label>
          <input style={S.input} type="date" value={date} onChange={(e) => setDate(e.target.value)} />

          <label style={S.label}>Time</label>
          <div style={{ display: "flex", gap: 10 }}>
            <div style={{ flex: 1 }}>
              <input
                style={S.input}
                type="time"
                value={start}
                disabled={allDay}
                onChange={(e) => setStart(e.target.value)}
              />
            </div>
            <div style={{ flex: 1 }}>
              <input
                style={S.input}
                type="time"
                value={end}
                disabled={allDay}
                onChange={(e) => setEnd(e.target.value)}
              />
            </div>
          </div>

          <label style={{ ...S.checkboxRow, marginTop: 4 }}>
            <input type="checkbox" checked={allDay} onChange={(e) => setAllDay(e.target.checked)} />
            <span>All day event</span>
          </label>

          <label style={S.label}>Category</label>
          <div style={S.catGrid}>
            {CATEGORIES.map((category) => (
              <div
                key={category.id}
                style={{
                  ...S.catOption,
                  background: category.bg,
                  border: `2px solid ${categoryId === category.id ? category.color : "transparent"}`,
                  color: category.color,
                }}
                onClick={() => setCategoryId(category.id)}
              >
                <span style={{ background: category.color, width: 8, height: 8, borderRadius: "50%", display: "inline-block", flexShrink: 0 }} />
                {category.name}
              </div>
            ))}
          </div>

          <label style={S.label}>Assignee</label>
          <select style={S.input} value={assignedUserId} onChange={(e) => setAssignedUserId(e.target.value)}>
            <option value="">No assignee</option>
            {users.map((user) => (
              <option key={user.id} value={user.id}>
                {user.email}{user.role ? ` (${user.role})` : ""}
              </option>
            ))}
          </select>
          <div style={S.infoBanner}>
            Assigned scheduled events are checked for calendar conflicts. Reminders are sent 30 minutes before the start time.
          </div>

          <label style={S.label}>Location</label>
          <input style={S.input} placeholder="Optional location" value={location} onChange={(e) => setLocation(e.target.value)} />

          <label style={S.label}>Description</label>
          <textarea
            style={{ ...S.input, minHeight: 90, resize: "vertical" }}
            placeholder="Optional event notes"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>

        <div className="calendar-modal-footer" style={S.modalFooter}>
          {isEditing && !confirmDelete && (
            <button style={S.deleteBtn} disabled={saving} onClick={() => setConfirmDelete(true)}>
              Delete Event
            </button>
          )}
          <div style={{ display: "flex", gap: 8, marginLeft: "auto" }}>
            <button style={S.closeBtn} disabled={saving} onClick={onClose}>Close</button>
            <button style={S.saveBtn} disabled={saving} onClick={submit}>
              {saving ? "Saving..." : isEditing ? "Save Changes" : "Create Event"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function YearView({ year, events, onDayClick, onEventClick, selectedDay, currentMonthRef }) {
  const now = new Date();
  const monthPairs = [];
  for (let month = 0; month < 12; month += 2) monthPairs.push([month, month + 1]);

  function MiniMonth({ month }) {
    const daysInMonth = getDaysInMonth(year, month);
    const firstDay = getFirstDay(year, month);
    const cells = [...Array(firstDay).fill(null), ...Array.from({ length: daysInMonth }, (_, index) => index + 1)];
    while (cells.length % 7) cells.push(null);
    const weeks = [];
    for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));

    return (
      <div style={S.miniMonth} ref={month === now.getMonth() && year === now.getFullYear() ? currentMonthRef : null}>
        <div style={S.miniMonthTitle}>{MONTHS[month]}</div>
        <div style={S.miniGrid}>
          {DAYS_SHORT.map((day) => <div key={day} style={S.miniDayHdr}>{day}</div>)}
          {weeks.map((week, weekIndex) => week.map((day, dayIndex) => {
            if (!day) return <div key={`empty-${weekIndex}-${dayIndex}`} style={S.miniCell} />;
            const dateString = toDateStr(year, month, day);
            const dayEvents = events.filter((event) => event.date === dateString);
            const today = isToday(year, month, day);
            const selected = selectedDay === dateString;
            return (
              <div
                key={`${weekIndex}-${dayIndex}`}
                style={{ ...S.miniCell, ...(today ? S.todayCell : {}), ...(selected && !today ? S.selCell : {}), cursor: "pointer" }}
                onClick={() => onDayClick(dateString)}
              >
                <span style={{ ...S.dayNum, ...(today ? S.todayNum : {}) }}>{day}</span>
                {dayEvents.slice(0, 2).map((event) => {
                  const category = getCategoryById(event.categoryId);
                  return (
                    <div
                      key={event.id}
                      style={{ ...S.chip, background: category.bg, color: category.color, borderLeft: `3px solid ${category.color}` }}
                      onClick={(e) => {
                        e.stopPropagation();
                        onEventClick(event);
                      }}
                    >
                      {event.title.length > 10 ? `${event.title.slice(0, 10)}…` : event.title}
                    </div>
                  );
                })}
                {dayEvents.length > 2 && <div style={S.moreBadge}>+{dayEvents.length - 2} more</div>}
              </div>
            );
          }))}
        </div>
      </div>
    );
  }

  return (
    <div className="calendar-scroll" style={S.calScroll}>
      {monthPairs.map(([leftMonth, rightMonth]) => (
        <div className="calendar-year-row" key={leftMonth} style={S.monthRow}>
          <MiniMonth month={leftMonth} />
          {rightMonth < 12 && <MiniMonth month={rightMonth} />}
        </div>
      ))}
    </div>
  );
}

function MonthView({ year, month, events, onDayClick, onEventClick }) {
  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = getFirstDay(year, month);
  const cells = [...Array(firstDay).fill(null), ...Array.from({ length: daysInMonth }, (_, index) => index + 1)];
  while (cells.length % 7) cells.push(null);
  const weeks = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));

  return (
    <div className="calendar-scroll calendar-month-view" style={{ ...S.calScroll, padding: "0 24px 24px" }}>
      <div style={S.monthGridHeader}>
        {DAYS_SHORT.map((day) => <div key={day} style={S.monthDayHdr}>{day}</div>)}
      </div>
      {weeks.map((week, weekIndex) => (
        <div key={weekIndex} style={S.monthWeekRow}>
          {week.map((day, dayIndex) => {
            if (!day) return <div key={dayIndex} style={{ ...S.monthDayCell, background: "#f8f9fc" }} />;
            const dateString = toDateStr(year, month, day);
            const dayEvents = events.filter((event) => event.date === dateString);
            const today = isToday(year, month, day);

            return (
              <div key={dayIndex} style={{ ...S.monthDayCell, ...(today ? { background: "#f0edff" } : {}) }} onClick={() => onDayClick(dateString)}>
                <span style={{ ...S.monthDayNum, ...(today ? S.todayNum : {}) }}>{day}</span>
                {dayEvents.slice(0, 3).map((event) => {
                  const category = getCategoryById(event.categoryId);
                  return (
                    <div
                      key={event.id}
                      style={{ ...S.chip, background: category.bg, color: category.color, borderLeft: `3px solid ${category.color}`, marginBottom: 2 }}
                      onClick={(e) => {
                        e.stopPropagation();
                        onEventClick(event);
                      }}
                    >
                      {event.title}
                    </div>
                  );
                })}
                {dayEvents.length > 3 && <div style={S.moreBadge}>+{dayEvents.length - 3} more</div>}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

function WeekView({ baseDate, events, onEventClick, onDayClick }) {
  const sunday = startOfWeek(baseDate);
  const days = Array.from({ length: 7 }, (_, index) => addDays(sunday, index));

  return (
    <div className="calendar-scroll calendar-week-view" style={{ ...S.calScroll, flexDirection: "column" }}>
      <div style={{ display: "grid", gridTemplateColumns: "60px repeat(7,1fr)", borderBottom: "1px solid #e8eaf0", background: "#fff", position: "sticky", top: 0, zIndex: 2 }}>
        <div />
        {days.map((day, index) => {
          const today = isToday(day.getFullYear(), day.getMonth(), day.getDate());
          return (
            <div key={index} style={{ padding: "10px 0", textAlign: "center", cursor: "pointer" }} onClick={() => onDayClick(fmtDateStr(day))}>
              <div style={{ fontSize: 11, color: "#9aa0b2", fontWeight: 700 }}>{DAYS_SHORT[day.getDay()]}</div>
              <div style={{
                width: 28,
                height: 28,
                borderRadius: "50%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                margin: "2px auto 0",
                background: today ? "#6d5aff" : "none",
                color: today ? "#fff" : "#1a1a2e",
                fontWeight: 700,
                fontSize: 14,
              }}>
                {day.getDate()}
              </div>
            </div>
          );
        })}
      </div>

      <div style={{ overflowY: "auto", flex: 1 }}>
        {HOURS.map((label, hourIndex) => (
          <div key={hourIndex} style={{ display: "grid", gridTemplateColumns: "60px repeat(7,1fr)", minHeight: 56, borderBottom: "1px solid #f0f0f6" }}>
            <div style={{ fontSize: 10, color: "#9aa0b2", padding: "5px 8px 0 0", textAlign: "right", fontWeight: 600 }}>{label}</div>
            {days.map((day, dayIndex) => {
              const dateString = fmtDateStr(day);
              const dayEvents = events.filter((event) => event.date === dateString);
              return (
                <div key={dayIndex} style={{ borderLeft: "1px solid #f0f0f6", padding: "2px 3px" }}>
                  {dayEvents
                    .filter((event) => {
                      const hourText = event.start?.split(":")[0];
                      return hourText ? Number(hourText) === hourIndex : hourIndex === 9;
                    })
                    .map((event) => {
                      const category = getCategoryById(event.categoryId);
                      return (
                        <div
                          key={event.id}
                          style={{ ...S.chip, background: category.bg, color: category.color, borderLeft: `3px solid ${category.color}`, marginBottom: 3 }}
                          onClick={() => onEventClick(event)}
                        >
                          {event.title}
                        </div>
                      );
                    })}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

function DayView({ baseDate, events, onEventClick }) {
  const dateString = fmtDateStr(baseDate);
  const dayEvents = events.filter((event) => event.date === dateString);

  return (
    <div className="calendar-scroll" style={{ ...S.calScroll, flexDirection: "column" }}>
      <div style={{ padding: "14px 24px 12px", borderBottom: "1px solid #e8eaf0", background: "#fff", position: "sticky", top: 0, zIndex: 2 }}>
        <div style={{ fontWeight: 800, fontSize: 20, color: "#1a1a2e" }}>
          {DAYS_FULL[baseDate.getDay()]}, {MONTHS[baseDate.getMonth()]} {baseDate.getDate()}, {baseDate.getFullYear()}
        </div>
        <div style={{ fontSize: 12, color: "#9aa0b2", marginTop: 2 }}>
          {dayEvents.length} event{dayEvents.length !== 1 ? "s" : ""} scheduled
        </div>
      </div>
      <div style={{ overflowY: "auto", flex: 1, padding: "0 24px" }}>
        {HOURS.map((label, hourIndex) => {
          const slotEvents = dayEvents.filter((event) => {
            if (event.allDay) return hourIndex === 9;
            const hourText = event.start?.split(":")[0];
            return hourText ? Number(hourText) === hourIndex : hourIndex === 9;
          });

          return (
            <div key={hourIndex} style={{ display: "flex", borderBottom: "1px solid #f0f0f6", minHeight: 56 }}>
              <div style={{ width: 64, flexShrink: 0, fontSize: 11, color: "#9aa0b2", padding: "7px 10px 0 0", textAlign: "right", fontWeight: 600 }}>
                {label}
              </div>
              <div style={{ flex: 1, padding: "4px 0 4px 12px", borderLeft: "1px solid #e8eaf0" }}>
                {slotEvents.map((event) => {
                  const category = getCategoryById(event.categoryId);
                  return (
                    <div
                      key={event.id}
                      style={{
                        background: category.bg,
                        color: category.color,
                        borderLeft: `4px solid ${category.color}`,
                        borderRadius: 8,
                        padding: "8px 12px",
                        marginBottom: 6,
                        cursor: "pointer",
                        fontWeight: 600,
                        fontSize: 13,
                      }}
                      onClick={() => onEventClick(event)}
                    >
                      <div>{event.title}</div>
                      <div style={{ fontSize: 11, opacity: 0.75, marginTop: 2 }}>
                        {event.displayStart}{event.displayEnd ? ` – ${event.displayEnd}` : ""}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ListView({ events, onEventClick }) {
  const sorted = [...events].sort((a, b) => a.date.localeCompare(b.date));
  const grouped = {};
  sorted.forEach((event) => {
    if (!grouped[event.date]) grouped[event.date] = [];
    grouped[event.date].push(event);
  });
  const todayString = fmtDateStr(new Date());

  if (sorted.length === 0) {
    return (
      <div style={{ ...S.calScroll, alignItems: "center", justifyContent: "center" }}>
        <div style={{ color: "#9aa0b2", fontSize: 15, textAlign: "center", marginTop: 80 }}>
          No events found in this range.
        </div>
      </div>
    );
  }

  return (
    <div className="calendar-scroll calendar-list-view" style={{ ...S.calScroll, padding: "20px 24px", flexDirection: "column", gap: 0 }}>
      {Object.entries(grouped).map(([date, dayEvents]) => {
        const labelDate = new Date(`${date}T00:00:00`);
        const label = labelDate.toLocaleDateString("en-US", {
          weekday: "long",
          month: "long",
          day: "numeric",
          year: "numeric",
        });
        const today = date === todayString;

        return (
          <div key={date} style={{ marginBottom: 22 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
              <div style={{ fontSize: 12, fontWeight: 800, color: today ? "#6d5aff" : "#1a1a2e", letterSpacing: 0.4 }}>
                {label}
              </div>
              {today && <span style={{ background: "#6d5aff", color: "#fff", fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 20 }}>TODAY</span>}
              <div style={{ flex: 1, height: 1, background: "#e8eaf0" }} />
            </div>
            {dayEvents.map((event) => {
              const category = getCategoryById(event.categoryId);
              return (
                <div
                  key={event.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 14,
                    padding: "12px 16px",
                    background: "#fff",
                    borderRadius: 10,
                    marginBottom: 8,
                    cursor: "pointer",
                    border: "1px solid #e8eaf0",
                    boxShadow: "0 1px 4px #0000000a",
                  }}
                  onClick={() => onEventClick(event)}
                >
                  <div style={{ width: 4, alignSelf: "stretch", borderRadius: 4, background: category.color, flexShrink: 0 }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: 14, color: "#1a1a2e" }}>{event.title}</div>
                    <div style={{ fontSize: 12, color: "#9aa0b2", marginTop: 2 }}>
                      {event.displayStart}{event.displayEnd ? ` – ${event.displayEnd}` : ""}
                    </div>
                    {(event.location || event.contactName) && (
                      <div style={{ fontSize: 11, color: "#64748b", marginTop: 4 }}>
                        {[event.location, event.contactName].filter(Boolean).join(" • ")}
                      </div>
                    )}
                  </div>
                  <div style={{ background: category.bg, color: category.color, fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 20 }}>
                    {category.name}
                  </div>
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}

export default function CalendarApp() {
  const now = new Date();
  const navigate = useNavigate();
  const currentMonthRef = useRef(null);

  const [viewMode, setViewMode] = useState(() =>
    typeof window !== "undefined" && window.matchMedia("(max-width: 767px)").matches ? "List" : "Year"
  );
  const [viewYear, setViewYear] = useState(now.getFullYear());
  const [viewMonth, setViewMonth] = useState(now.getMonth());
  const [viewDate, setViewDate] = useState(new Date());
  const [events, setEvents] = useState([]);
  const [assignableUsers, setAssignableUsers] = useState([]);
  const [selectedDay, setSelectedDay] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [editEvent, setEditEvent] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [modalError, setModalError] = useState("");

  const visibleRange = useMemo(
    () => getRangeForView(viewMode, viewYear, viewMonth, viewDate),
    [viewMode, viewYear, viewMonth, viewDate]
  );

  useEffect(() => {
    let cancelled = false;

    async function loadEvents() {
      setLoading(true);
      setError("");
      try {
        const response = await api.get("/api/events", {
          params: {
            fromAt: visibleRange.from.toISOString(),
            toAt: visibleRange.to.toISOString(),
          },
        });
        if (cancelled) return;
        const items = Array.isArray(response.data) ? response.data : [];
        setEvents(items.map(normalizeEvent));
      } catch (loadError) {
        if (cancelled) return;
        setEvents([]);
        setError(
          loadError.response?.data?.message ||
            loadError.response?.data?.error ||
            "Could not load calendar events."
        );
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadEvents();

    return () => {
      cancelled = true;
    };
  }, [visibleRange]);

  useEffect(() => {
    let cancelled = false;
    api
      .get("/api/users")
      .then((response) => {
        if (!cancelled) {
          setAssignableUsers(Array.isArray(response.data) ? response.data : []);
        }
      })
      .catch(() => {
        if (!cancelled) setAssignableUsers([]);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (viewMode === "Year" && viewYear === now.getFullYear() && currentMonthRef.current) {
      window.setTimeout(() => {
        currentMonthRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 100);
    }
  }, [viewMode, viewYear, now]);

  const upcoming = useMemo(
    () => [...events]
      .filter((event) => event.date >= fmtDateStr(now))
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(0, 6),
    [events, now]
  );

  const reloadVisibleEvents = async () => {
    const response = await api.get("/api/events", {
      params: {
        fromAt: visibleRange.from.toISOString(),
        toAt: visibleRange.to.toISOString(),
      },
    });
    const items = Array.isArray(response.data) ? response.data : [];
    setEvents(items.map(normalizeEvent));
  };

  const handleSave = async (payload) => {
    setSaving(true);
    setModalError("");
    try {
      const category = getCategoryById(payload.categoryId);
      const requestBody = {
        title: payload.title,
        description: payload.description || null,
        location: payload.location || null,
        category: category.key,
        status: "SCHEDULED",
        assignedUserId: payload.assignedUserId ? Number(payload.assignedUserId) : null,
        startAt: buildIso(payload.date, payload.start, payload.allDay),
        endAt: payload.allDay ? null : buildIso(payload.date, payload.end, false),
        allDay: payload.allDay,
      };

      if (!requestBody.startAt) {
        throw new Error("Could not build a valid event start time.");
      }

      if (editEvent?.id) {
        await api.put(`/api/events/${editEvent.id}`, requestBody);
      } else {
        await api.post("/api/events", requestBody);
      }

      await reloadVisibleEvents();
      setShowModal(false);
      setEditEvent(null);
    } catch (saveError) {
      setModalError(
        saveError.response?.data?.message ||
          saveError.response?.data?.error ||
          saveError.message ||
          "Could not save the event."
      );
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (eventId) => {
    setSaving(true);
    setModalError("");
    try {
      await api.delete(`/api/events/${eventId}`);
      await reloadVisibleEvents();
      setShowModal(false);
      setEditEvent(null);
    } catch (deleteError) {
      setModalError(
        deleteError.response?.data?.message ||
          deleteError.response?.data?.error ||
          "Could not delete the event."
      );
    } finally {
      setSaving(false);
    }
  };

  const handleEventClick = (event) => {
    setEditEvent(event);
    setModalError("");
    setShowModal(true);
  };

  const handleDayClick = (dateString) => {
    setSelectedDay(dateString);
    const date = new Date(`${dateString}T00:00:00`);
    setViewDate(date);
    setViewYear(date.getFullYear());
    setViewMonth(date.getMonth());
  };

  const navLabel = () => {
    if (viewMode === "Year") return `${viewYear}`;
    if (viewMode === "Month") return `${MONTHS[viewMonth]} ${viewYear}`;
    if (viewMode === "Week") {
      const sunday = startOfWeek(viewDate);
      const saturday = addDays(sunday, 6);
      return `${MONTHS[sunday.getMonth()]} ${sunday.getDate()} – ${MONTHS[saturday.getMonth()]} ${saturday.getDate()}, ${saturday.getFullYear()}`;
    }
    if (viewMode === "Day") return `${MONTHS[viewDate.getMonth()]} ${viewDate.getDate()}, ${viewDate.getFullYear()}`;
    return "All Events";
  };

  const goBack = () => {
    if (viewMode === "Year") setViewYear((value) => value - 1);
    if (viewMode === "Month") {
      if (viewMonth === 0) {
        setViewMonth(11);
        setViewYear((value) => value - 1);
      } else {
        setViewMonth((value) => value - 1);
      }
    }
    if (viewMode === "Week") setViewDate((value) => addDays(value, -7));
    if (viewMode === "Day") setViewDate((value) => addDays(value, -1));
  };

  const goFwd = () => {
    if (viewMode === "Year") setViewYear((value) => value + 1);
    if (viewMode === "Month") {
      if (viewMonth === 11) {
        setViewMonth(0);
        setViewYear((value) => value + 1);
      } else {
        setViewMonth((value) => value + 1);
      }
    }
    if (viewMode === "Week") setViewDate((value) => addDays(value, 7));
    if (viewMode === "Day") setViewDate((value) => addDays(value, 1));
  };

  const goToday = () => {
    setViewYear(now.getFullYear());
    setViewMonth(now.getMonth());
    setViewDate(new Date());
  };

  return (
    <div className="calendar-app-shell" style={S.app}>
      <aside className="calendar-sidebar" style={S.sidebar}>
        <button onClick={() => navigate(-1)} className="calendar-back-button bg-teal text-white">
          <ArrowLeft />
        </button>
        <button
          className="bg-teal-400"
          style={S.createBtn}
          onClick={() => {
            setEditEvent(null);
            setModalError("");
            setShowModal(true);
          }}
        >
          <span style={{ fontSize: 18, marginRight: 6 }}>+</span> Create New Event
        </button>
        <p className="calendar-sidebar-detail font-bold" style={S.hint}>
          Plan meetings, visits, and follow-ups in one shared calendar.
        </p>

        <div className="calendar-sidebar-detail" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {CATEGORIES.map((category) => (
            <div
              key={category.id}
              style={{
                ...S.catRow,
                background: category.bg,
                borderLeft: `4px solid ${category.color}`,
              }}
            >
              <span style={{ background: category.color, width: 8, height: 8, borderRadius: "50%", display: "inline-block" }} />
              <span style={{ color: category.color, fontWeight: 600, fontSize: 13 }}>{category.name}</span>
            </div>
          ))}
        </div>

        <div className="calendar-sidebar-detail" style={{ marginTop: 16 }}>
          <div style={{ fontWeight: 800, fontSize: 14, color: "white" }}>Upcoming Events</div>
          <div style={{ fontSize: 11, color: "white", marginBottom: 10 }}>Shared tenant schedule</div>
          {upcoming.length === 0 && <div style={{ color: "white", fontSize: 13 }}>No upcoming events</div>}
          {upcoming.map((event) => {
            const category = getCategoryById(event.categoryId);
            const labelDate = new Date(`${event.date}T00:00:00`);
            const label = labelDate.toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" });
            return (
              <div key={event.id} style={S.upCard} onClick={() => handleEventClick(event)}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 3 }}>
                  <span style={{ display: "flex", alignItems: "center", gap: 5, color: category.color, fontSize: 11, fontWeight: 700 }}>
                    <span style={{ background: category.color, width: 7, height: 7, borderRadius: "50%", display: "inline-block" }} />
                    {label}
                  </span>
                  <span style={{ fontSize: 10, color: "#9aa0b2" }}>
                    {event.displayStart}{event.displayEnd ? ` – ${event.displayEnd}` : ""}
                  </span>
                </div>
                <div style={{ fontWeight: 700, fontSize: 13, color: "#1a1a2e" }}>{event.title}</div>
              </div>
            );
          })}
        </div>
      </aside>

      <main className="calendar-main" style={S.main}>
        <div className="calendar-topbar bg-teal-700" style={S.topBar}>
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <button style={S.arrowBtn} onClick={goBack}>&#8249;</button>
            <button style={S.arrowBtn} onClick={goFwd}>&#8250;</button>
            <button style={S.todayBtn} onClick={goToday}>Today</button>
          </div>
          <div className="calendar-nav-label" style={{ fontWeight: 800, fontSize: 17, color: "white", minWidth: 260, textAlign: "center" }}>{navLabel()}</div>
          <div className="calendar-view-tabs" style={S.viewTabs}>
            {["Year", "Month", "Week", "Day", "List"].map((mode) => (
              <button
                key={mode}
                style={{ ...S.viewTab, ...(viewMode === mode ? S.viewTabActive : {}) }}
                onClick={() => setViewMode(mode)}
              >
                {mode}
              </button>
            ))}
          </div>
        </div>

        {error && <div style={S.pageErrorBanner}>{error}</div>}
        {loading ? (
          <div style={S.loadingState}>Loading calendar events…</div>
        ) : (
          <>
            {viewMode === "Year" && (
              <YearView
                year={viewYear}
                events={events}
                onDayClick={handleDayClick}
                onEventClick={handleEventClick}
                selectedDay={selectedDay}
                currentMonthRef={currentMonthRef}
              />
            )}
            {viewMode === "Month" && (
              <MonthView
                year={viewYear}
                month={viewMonth}
                events={events}
                onDayClick={handleDayClick}
                onEventClick={handleEventClick}
              />
            )}
            {viewMode === "Week" && (
              <WeekView
                baseDate={viewDate}
                events={events}
                onEventClick={handleEventClick}
                onDayClick={handleDayClick}
              />
            )}
            {viewMode === "Day" && (
              <DayView
                baseDate={viewDate}
                events={events}
                onEventClick={handleEventClick}
              />
            )}
            {viewMode === "List" && (
              <ListView events={events} onEventClick={handleEventClick} />
            )}
          </>
        )}
      </main>

      {showModal && (
        <Modal
          onClose={() => {
            if (saving) return;
            setShowModal(false);
            setEditEvent(null);
            setModalError("");
          }}
          onSave={handleSave}
          onDelete={handleDelete}
          initial={editEvent}
          saving={saving}
          error={modalError}
          users={assignableUsers}
        />
      )}
    </div>
  );
}

const S = {
  app: { display: "flex", height: "100vh", fontFamily: "'DM Sans','Segoe UI',sans-serif", background: "#f8f9fc", color: "#1a1a2e", overflow: "hidden" },
  sidebar: { width: 330, minWidth: 220, background: "teal", borderRight: "1px solid #e8eaf0", padding: "20px 14px", display: "flex", flexDirection: "column", gap: 10, overflowY: "auto" },
  createBtn: { color: "#fff", border: "none", borderRadius: 10, padding: "11px 0", fontSize: 14, fontWeight: 700, cursor: "pointer", width: "100%", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 4px 16px #6d5aff44" },
  hint: { fontSize: 14, color: "white", margin: "0 0 4px 0", lineHeight: 1.5 },
  catRow: { display: "flex", alignItems: "center", gap: 8, borderRadius: 8, padding: "8px 12px", userSelect: "none" },
  upCard: { background: "#f8f9fc", borderRadius: 10, padding: "10px 12px", marginBottom: 8, cursor: "pointer", border: "1px solid #e8eaf0" },
  main: { flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" },
  topBar: { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 24px", flexShrink: 0 },
  arrowBtn: { background: "white", border: "1px solid #e8eaf0", borderRadius: 6, width: 30, height: 30, fontSize: 18, cursor: "pointer", color: "gray", display: "flex", alignItems: "center", justifyContent: "center" },
  todayBtn: { background: "white", border: "1px solid white", borderRadius: 6, padding: "5px 14px", fontSize: 13, color: "gray", cursor: "pointer", fontWeight: 600, marginLeft: 4 },
  viewTabs: { display: "flex", gap: 2, background: "#f0f0f6", borderRadius: 8, padding: 3 },
  viewTab: { border: "none", background: "none", borderRadius: 6, padding: "5px 13px", fontSize: 13, color: "#888", cursor: "pointer", fontWeight: 500, transition: "background 0.15s,color 0.15s" },
  viewTabActive: { background: "teal", color: "#fff", fontWeight: 700, boxShadow: "0 2px 8px #6d5aff44" },
  calScroll: { flex: 1, overflowY: "auto", display: "flex", flexDirection: "column" },
  loadingState: { flex: 1, display: "grid", placeItems: "center", color: "#64748b", fontWeight: 600 },
  pageErrorBanner: { margin: "12px 24px 0", padding: "12px 14px", borderRadius: 12, background: "#fef2f2", border: "1px solid #fecaca", color: "#b91c1c", fontSize: 13, fontWeight: 700 },
  monthRow: { display: "grid", gridTemplateColumns: "1fr 1fr", borderBottom: "1px solid #e8eaf0" },
  miniMonth: { padding: "16px 12px 20px", borderRight: "1px solid #e8eaf0" },
  miniMonthTitle: { fontWeight: 800, fontSize: 15, marginBottom: 10, color: "#1a1a2e" },
  miniGrid: { display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: "2px 0" },
  miniDayHdr: { fontSize: 11, color: "#9aa0b2", fontWeight: 700, textAlign: "center", paddingBottom: 6 },
  miniCell: { minHeight: 52, padding: "2px", borderRadius: 6, transition: "background 0.1s" },
  todayCell: { background: "#f0edff" },
  selCell: { background: "#e8f4ff" },
  dayNum: { display: "flex", alignItems: "center", justifyContent: "center", width: 22, height: 22, borderRadius: "50%", fontSize: 11, fontWeight: 600, color: "#444", margin: "0 auto 2px" },
  todayNum: { background: "#6d5aff", color: "#fff", fontWeight: 800 },
  chip: { fontSize: 10, fontWeight: 600, borderRadius: 3, padding: "1px 4px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", cursor: "pointer" },
  moreBadge: { fontSize: 9, color: "#6d5aff", fontWeight: 700, paddingLeft: 4, cursor: "pointer" },
  monthGridHeader: { display: "grid", gridTemplateColumns: "repeat(7,1fr)", background: "#fff", borderBottom: "1px solid #e8eaf0", position: "sticky", top: 0, zIndex: 2, paddingTop: 12 },
  monthDayHdr: { textAlign: "center", fontSize: 12, fontWeight: 700, color: "#9aa0b2", paddingBottom: 8 },
  monthWeekRow: { display: "grid", gridTemplateColumns: "repeat(7,1fr)", borderBottom: "1px solid #e8eaf0" },
  monthDayCell: { borderRight: "1px solid #e8eaf0", padding: "6px 4px", minHeight: 100, cursor: "pointer" },
  monthDayNum: { display: "flex", alignItems: "center", justifyContent: "center", width: 24, height: 24, borderRadius: "50%", fontSize: 12, fontWeight: 700, color: "#444", marginBottom: 4 },
  overlay: { position: "fixed", inset: 0, background: "rgba(26,26,46,0.45)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 },
  modal: { background: "#fff", borderRadius: 16, width: 520, maxWidth: "95vw", maxHeight: "92vh", boxShadow: "0 20px 60px rgba(109,90,255,0.2)", overflowY: "auto" },
  modalHeader: { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "18px 22px 14px", borderBottom: "1px solid #e8eaf0" },
  modalTitle: { fontWeight: 800, fontSize: 17, color: "#1a1a2e" },
  iconBtn: { background: "none", border: "none", fontSize: 18, color: "#888", cursor: "pointer" },
  confirmBanner: { background: "#fef2f2", borderLeft: "4px solid #ef4444", margin: "12px 22px 0", borderRadius: 8, padding: "12px 14px" },
  confirmYes: { background: "#ef4444", color: "#fff", border: "none", borderRadius: 7, padding: "7px 14px", fontSize: 12, fontWeight: 700, cursor: "pointer" },
  confirmNo: { background: "#fff", color: "#555", border: "1px solid #e0e3ef", borderRadius: 7, padding: "7px 14px", fontSize: 12, fontWeight: 600, cursor: "pointer" },
  errorBanner: { background: "#fef2f2", border: "1px solid #fecaca", color: "#b91c1c", padding: "10px 12px", borderRadius: 10, fontSize: 12.5, fontWeight: 700 },
  conflictBanner: { background: "#fff7ed", border: "1px solid #fed7aa", color: "#9a3412", padding: "10px 12px", borderRadius: 10, fontSize: 12.5, fontWeight: 700 },
  infoBanner: { background: "#eff6ff", border: "1px solid #bfdbfe", color: "#1d4ed8", padding: "9px 11px", borderRadius: 10, fontSize: 12, lineHeight: 1.45 },
  modalBody: { padding: "18px 22px", display: "flex", flexDirection: "column", gap: 12 },
  label: { fontSize: 12, fontWeight: 700, color: "#555", marginBottom: 2, letterSpacing: 0.4, display: "block" },
  checkboxRow: { display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, color: "#475569", fontWeight: 600, cursor: "pointer" },
  input: { border: "1.5px solid #e0e3ef", borderRadius: 8, padding: "9px 12px", fontSize: 14, outline: "none", width: "100%", boxSizing: "border-box", background: "#fafbff", color: "#1a1a2e" },
  catGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 },
  catOption: { borderRadius: 8, padding: "8px 10px", fontSize: 12, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 },
  modalFooter: { display: "flex", alignItems: "center", padding: "14px 22px 18px", borderTop: "1px solid #e8eaf0" },
  deleteBtn: { background: "#fef2f2", color: "#ef4444", border: "1.5px solid #fca5a5", borderRadius: 8, padding: "8px 14px", fontSize: 13, fontWeight: 700, cursor: "pointer" },
  closeBtn: { border: "1.5px solid #e0e3ef", background: "#fff", borderRadius: 8, padding: "9px 18px", fontSize: 13, fontWeight: 600, cursor: "pointer", color: "#555" },
  saveBtn: { background: "linear-gradient(135deg,#6d5aff 0%,#a084ee 100%)", border: "none", borderRadius: 8, padding: "9px 20px", fontSize: 13, fontWeight: 700, cursor: "pointer", color: "#fff", boxShadow: "0 3px 12px #6d5aff44" },
};
