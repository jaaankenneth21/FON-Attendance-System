import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import AdminSidebar from "./AdminSidebar";
import "./admin-dashboard.css";
import "./admin-students.css";
import "./AdminSessionHistory.css";

/* =========================================================
   ADMIN SESSION HISTORY

   Reads from:
     attendance_programs  -> sessions the admin started/ended
     attendance           -> linked by attendance.program_id
     students             -> student_id, full_name, year_level, section

   Attendance recorded BEFORE the Start/End Session feature has
   program_id = null, so it doesn't belong to any session and
   won't appear here.
   ========================================================= */

const TZ = "Asia/Manila";

/* Shades used for the year-level breakdown bar */
const BAR_SHADES = ["#e8946a", "#f2b18a", "#ffc99e", "#d9b8a0", "#c9a58b"];

/* =========================================================
   ICONS (inline SVG, inherits currentColor)
   ========================================================= */

function Icon({ children, size = 14 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

const IconClock = () => (
  <Icon>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3 2" />
  </Icon>
);

const IconCap = () => (
  <Icon>
    <path d="M22 10 12 5 2 10l10 5 10-5Z" />
    <path d="M6 12v5c3 2 9 2 12 0v-5" />
  </Icon>
);

const IconBell = () => (
  <Icon>
    <path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
    <path d="M13.7 21a2 2 0 0 1-3.4 0" />
  </Icon>
);

const IconTrash = () => (
  <Icon>
    <path d="M3 6h18" />
    <path d="M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2" />
    <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
    <path d="M10 11v6M14 11v6" />
  </Icon>
);

const IconChevron = () => (
  <Icon>
    <path d="m6 9 6 6 6-6" />
  </Icon>
);

const IconDownload = () => (
  <Icon>
    <path d="M12 3v12" />
    <path d="m7 10 5 5 5-5" />
    <path d="M5 21h14" />
  </Icon>
);

/* =========================================================
   HELPERS
   ========================================================= */

function getInitials(name) {
  if (!name) return "?";
  return name
    .trim()
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

const isDateOnly = (v) => /^\d{4}-\d{2}-\d{2}$/.test(v || "");

function formatDateTime(value) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-PH", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: TZ,
  });
}

function formatTime(value) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleTimeString("en-PH", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: TZ,
  });
}

/* Month + day for the date tile, plus a readable weekday line */
function dateParts(p) {
  const source = p.program_date || p.started_at;
  const dateOnly = isDateOnly(source);
  const d = dateOnly ? new Date(`${source}T00:00:00`) : new Date(source);
  const tz = dateOnly ? undefined : TZ;

  if (Number.isNaN(d.getTime())) {
    return { month: "", day: "—", full: "" };
  }

  return {
    month: d.toLocaleDateString("en-PH", { month: "short", timeZone: tz }),
    day: d.toLocaleDateString("en-PH", { day: "numeric", timeZone: tz }),
    full: d.toLocaleDateString("en-PH", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
      timeZone: tz,
    }),
  };
}

function formatDuration(start, end) {
  if (!start || !end) return "";
  const minutes = Math.max(
    0,
    Math.round((new Date(end) - new Date(start)) / 60000)
  );
  if (minutes < 1) return "under 1 min";
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h} h ${m} min` : `${h} h`;
}

function csvEscape(v) {
  const s = String(v ?? "");
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/* "open" in the DB but past its deadline is effectively over */
function effectiveStatus(p) {
  if (p.status === "open" && p.deadline && new Date(p.deadline) < new Date()) {
    return "expired";
  }
  return p.status;
}

const STATUS_LABEL = {
  open: "Open now",
  expired: "Deadline passed",
  closed: "Ended",
};

/* =========================================================
   COMPONENT
   ========================================================= */

function AdminSessionHistory() {
  const [user, setUser] = useState(null);
  const [programs, setPrograms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const [searchTerm, setSearchTerm] = useState("");
  const [yearFilter, setYearFilter] = useState("all");
  const [expanded, setExpanded] = useState(() => new Set());

  const [toast, setToast] = useState("");
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    loadUser();
    loadPrograms();
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(""), 5000);
    return () => clearTimeout(timer);
  }, [toast]);

  async function loadUser() {
    const {
      data: { user: currentUser },
    } = await supabase.auth.getUser();
    setUser(currentUser);
  }

  async function loadPrograms() {
    try {
      setError("");
      if (!loading) setRefreshing(true);

      const { data, error: programsError } = await supabase
        .from("attendance_programs")
        .select(
          `id, name, program_date, deadline, allowed_year_levels,
           status, started_at, closed_at,
           attendance (
             id, session_number, time_in, time_out, status,
             students ( id, student_id, full_name, year_level, section )
           )`
        )
        .order("started_at", { ascending: false });

      if (programsError) throw programsError;

      setPrograms(data || []);
    } catch (err) {
      console.error("Session history load error:", err);
      setError(err?.message || "Unable to load session history.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  /* Year levels actually present in the data (free text column) */
  const yearOptions = useMemo(() => {
    const set = new Set();
    programs.forEach((p) =>
      (p.attendance || []).forEach((a) => {
        if (a.students?.year_level) set.add(a.students.year_level);
      })
    );
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [programs]);

  /* Search + year filter. Picking a year level keeps only that
     year level's attendees inside each session. */
  const visible = useMemo(() => {
    const search = searchTerm.trim().toLowerCase();

    return programs
      .map((p) => {
        const attendees = (p.attendance || [])
          .filter(
            (a) => yearFilter === "all" || a.students?.year_level === yearFilter
          )
          .sort((x, y) => new Date(x.time_in) - new Date(y.time_in));
        return { ...p, _attendees: attendees };
      })
      .filter((p) => {
        const matchesSearch =
          !search ||
          p.name.toLowerCase().includes(search) ||
          p._attendees.some(
            (a) =>
              (a.students?.full_name || "").toLowerCase().includes(search) ||
              (a.students?.student_id || "").toLowerCase().includes(search)
          );
        const matchesYear = yearFilter === "all" || p._attendees.length > 0;
        return matchesSearch && matchesYear;
      });
  }, [programs, searchTerm, yearFilter]);

  const totalAttendances = visible.reduce((n, p) => n + p._attendees.length, 0);

  function toggle(id) {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function yearBreakdown(attendees) {
    const counts = {};
    attendees.forEach((a) => {
      const y = a.students?.year_level || "Unspecified";
      counts[y] = (counts[y] || 0) + 1;
    });
    return Object.entries(counts).sort(([a], [b]) => a.localeCompare(b));
  }

  async function handleDeleteSession() {
    if (!deleteTarget) return;

    setDeleting(true);

    try {
      const { error: deleteError } = await supabase.rpc(
        "delete_attendance_program",
        { p_program_id: deleteTarget.id }
      );

      if (deleteError) throw deleteError;

      setPrograms((prev) => prev.filter((p) => p.id !== deleteTarget.id));
      setToast(`"${deleteTarget.name}" was deleted.`);
      setDeleteTarget(null);
    } catch (err) {
      console.error("Delete session error:", err);
      setError(err?.message || "Unable to delete this session.");
      setDeleteTarget(null);
    } finally {
      setDeleting(false);
    }
  }

  function exportCsv() {
    const rows = [
      [
        "Session",
        "Session Date",
        "Started",
        "Ended",
        "Allowed Year Levels",
        "Username",
        "Student",
        "Year Level",
        "Course and Level",
        "Time In",
        "Time Out",
        "Status",
      ],
    ];

    visible.forEach((p) => {
      const base = [
        p.name,
        p.program_date || "",
        formatDateTime(p.started_at),
        p.closed_at ? formatDateTime(p.closed_at) : "",
        p.allowed_year_levels?.length ? p.allowed_year_levels.join("; ") : "All",
      ];

      if (p._attendees.length === 0) {
        rows.push([...base, "", "", "", "", "", "", ""]);
        return;
      }

      p._attendees.forEach((a) => {
        rows.push([
          ...base,
          a.students?.student_id || "",
          a.students?.full_name || "",
          a.students?.year_level || "",
          a.students?.section || "",
          formatDateTime(a.time_in),
          a.time_out ? formatDateTime(a.time_out) : "",
          a.status === "present" ? "Present" : "Timed in",
        ]);
      });
    });

    const csv = rows.map((r) => r.map(csvEscape).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "session-history.csv";
    link.click();
    URL.revokeObjectURL(url);
  }

  /* =======================================================
     RENDER
     ======================================================= */

  return (
    <div className="admin-page">
      <AdminSidebar user={user} />

      <main className="admin-main">
        <div className="admin-content">
          {/* HEADER */}
          <div className="dashboard-header">
            <div>
              <div className="breadcrumb">
                <span>Dashboard</span>
                <span>/</span>
                <span>Session History</span>
              </div>

              <h1>Session History</h1>
              <p>Every session you've started, with the students who attended.</p>
            </div>

            <button
              className="primary-button"
              type="button"
              onClick={exportCsv}
              disabled={visible.length === 0}
            >
              <IconDownload />
              Export CSV
            </button>
          </div>

          {toast && (
            <div className="dashboard-toast">
              <span>✓</span>
              <span>{toast}</span>
              <button type="button" onClick={() => setToast("")}>
                ×
              </button>
            </div>
          )}

          {error && (
            <div className="dashboard-error">
              <strong>Something went wrong</strong>
              <span>{error}</span>
              <button type="button" onClick={loadPrograms}>
                Try Again
              </button>
            </div>
          )}

          {/* STATS */}
          <section className="stats-grid">
            <div className="stat-card">
              <div className="stat-icon green">◷</div>
              <div className="stat-content">
                <span className="stat-label">SESSIONS</span>
                <strong>{loading ? "—" : visible.length}</strong>
                <small>shown below</small>
              </div>
            </div>

            <div className="stat-card">
              <div className="stat-icon orange">♙</div>
              <div className="stat-content">
                <span className="stat-label">TOTAL ATTENDANCES</span>
                <strong>{loading ? "—" : totalAttendances}</strong>
                <small>across these sessions</small>
              </div>
            </div>

            <div className="stat-card">
              <div className="stat-icon purple">▤</div>
              <div className="stat-content">
                <span className="stat-label">YEAR LEVELS</span>
                <strong>{loading ? "—" : yearOptions.length}</strong>
                <small>represented</small>
              </div>
            </div>
          </section>

          {/* SESSION LOG */}
          <section className="attendance-card">
            <div className="attendance-card-header">
              <div>
                <h2>Session Log</h2>
                <p>Select a session to see who attended.</p>
              </div>

              <div className="attendance-card-actions">
                <button
                  className="refresh-button"
                  type="button"
                  onClick={loadPrograms}
                  disabled={refreshing}
                  title="Refresh"
                >
                  ↻
                </button>
              </div>
            </div>

            <div className="attendance-filters">
              <div className="search-box">
                <span>⌕</span>
                <input
                  type="text"
                  placeholder="Search session, name, or username..."
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                />
              </div>

              <select
                className="filter-select"
                value={yearFilter}
                onChange={(event) => setYearFilter(event.target.value)}
              >
                <option value="all">All Year Levels</option>
                {yearOptions.map((year) => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ))}
              </select>
            </div>

            <div className="history-sessions">
              {loading ? (
                <div className="history-empty">
                  <div className="loading-spinner">
                    <span />
                  </div>
                  <strong>Loading sessions...</strong>
                </div>
              ) : visible.length === 0 ? (
                <div className="history-empty">
                  <div className="empty-icon">◷</div>
                  <strong>No sessions found</strong>
                  <span>
                    {programs.length === 0
                      ? "Sessions will appear here after you start one."
                      : "Try a different search or filter."}
                  </span>
                </div>
              ) : (
                visible.map((p) => {
                  const isOpen = expanded.has(p.id);
                  const attendees = p._attendees;
                  const status = effectiveStatus(p);
                  const date = dateParts(p);
                  const duration = formatDuration(p.started_at, p.closed_at);
                  const breakdown = yearBreakdown(attendees);
                  const allowed = p.allowed_year_levels?.length
                    ? p.allowed_year_levels.join(", ")
                    : "All year levels";
                  const canDelete = status !== "open";

                  return (
                    <article
                      className={`hs hs-${status}${isOpen ? " is-open" : ""}`}
                      key={p.id}
                    >
                      <div className="hs-top">
                        <div className="hs-date" title={date.full}>
                          <span>{date.month}</span>
                          <strong>{date.day}</strong>
                        </div>

                        <button
                          type="button"
                          className="hs-main"
                          onClick={() => toggle(p.id)}
                          aria-expanded={isOpen}
                        >
                          <span className="hs-title-row">
                            <span className="hs-title">{p.name}</span>
                            <span className="hs-status">
                              <i />
                              {STATUS_LABEL[status] || status}
                            </span>
                          </span>

                          <span className="hs-meta">
                            <span className="hs-pill">
                              <IconClock />
                              {formatTime(p.started_at)}
                              {p.closed_at
                                ? ` to ${formatTime(p.closed_at)}`
                                : ""}
                              {duration ? `, ${duration}` : ""}
                            </span>

                            <span className="hs-pill">
                              <IconCap />
                              {allowed}
                            </span>

                            {p.deadline && (
                              <span className="hs-pill">
                                <IconBell />
                                Deadline {formatDateTime(p.deadline)}
                              </span>
                            )}
                          </span>
                        </button>

                        <div className="hs-side">
                          <div className="hs-count">
                            <strong>{attendees.length}</strong>
                            <span>
                              {attendees.length === 1 ? "student" : "students"}
                            </span>
                          </div>

                          <div className="hs-actions">
                            <button
                              type="button"
                              className="hs-icon-btn danger"
                              onClick={() => setDeleteTarget(p)}
                              disabled={!canDelete}
                              title={
                                canDelete
                                  ? "Delete session"
                                  : "End this session before deleting it"
                              }
                              aria-label={`Delete ${p.name}`}
                            >
                              <IconTrash />
                            </button>

                            <button
                              type="button"
                              className="hs-icon-btn hs-chevron"
                              onClick={() => toggle(p.id)}
                              title={isOpen ? "Hide students" : "Show students"}
                              aria-label={
                                isOpen ? "Hide students" : "Show students"
                              }
                              aria-expanded={isOpen}
                            >
                              <IconChevron />
                            </button>
                          </div>
                        </div>
                      </div>

                      {attendees.length > 0 && (
                        <div className="hs-breakdown">
                          <div className="hs-avatars">
                            {attendees.slice(0, 4).map((a, i) => (
                              <span
                                className={`hs-avatar tone-${i % 3}`}
                                key={a.id}
                                title={a.students?.full_name}
                              >
                                {getInitials(a.students?.full_name)}
                              </span>
                            ))}
                            {attendees.length > 4 && (
                              <span className="hs-avatar more">
                                +{attendees.length - 4}
                              </span>
                            )}
                          </div>

                          <div className="hs-years">
                            <div className="hs-bar">
                              {breakdown.map(([year, count], i) => (
                                <span
                                  key={year}
                                  title={`${year}: ${count}`}
                                  style={{
                                    flexGrow: count,
                                    background:
                                      BAR_SHADES[i % BAR_SHADES.length],
                                  }}
                                />
                              ))}
                            </div>

                            <div className="hs-legend">
                              {breakdown.map(([year, count], i) => (
                                <span key={year}>
                                  <i
                                    style={{
                                      background:
                                        BAR_SHADES[i % BAR_SHADES.length],
                                    }}
                                  />
                                  {year}
                                  <b>{count}</b>
                                </span>
                              ))}
                            </div>
                          </div>
                        </div>
                      )}

                      <div className="hs-panel">
                        <div className="hs-panel-inner">
                          {attendees.length === 0 ? (
                            <div className="history-empty small">
                              No students attended this session.
                            </div>
                          ) : (
                            <div className="attendance-table-wrapper history-table-wrapper">
                              <table className="attendance-table">
                                <thead>
                                  <tr>
                                    <th className="student-heading">STUDENT</th>
                                    <th>USERNAME</th>
                                    <th>YEAR</th>
                                    <th>COURSE AND LEVEL</th>
                                    <th>TIME IN</th>
                                    <th>TIME OUT</th>
                                    <th>STATUS</th>
                                  </tr>
                                </thead>

                                <tbody>
                                  {attendees.map((a) => (
                                    <tr key={a.id}>
                                      <td className="student-column">
                                        <div className="student-cell">
                                          <div className="student-avatar">
                                            {getInitials(a.students?.full_name)}
                                          </div>
                                          <div className="student-details">
                                            <span className="student-name">
                                              {a.students?.full_name ||
                                                "Unknown"}
                                            </span>
                                          </div>
                                        </div>
                                      </td>

                                      <td>
                                        <span className="student-id">
                                          {a.students?.student_id || "—"}
                                        </span>
                                      </td>

                                      <td>{a.students?.year_level || "—"}</td>

                                      <td>
                                        <span className="section-badge">
                                          {a.students?.section || "—"}
                                        </span>
                                      </td>

                                      <td>{formatTime(a.time_in)}</td>
                                      <td>{formatTime(a.time_out)}</td>

                                      <td>
                                        <span
                                          className={`history-badge ${
                                            a.status === "present"
                                              ? "status-open"
                                              : "status-expired"
                                          }`}
                                        >
                                          {a.status === "present"
                                            ? "Present"
                                            : "Timed in"}
                                        </span>
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          )}
                        </div>
                      </div>
                    </article>
                  );
                })
              )}
            </div>

            <div className="attendance-table-footer">
              <span>
                Showing <strong>{visible.length}</strong>{" "}
                {visible.length === 1 ? "session" : "sessions"}
              </span>
            </div>
          </section>

          <footer className="admin-footer">FON Supreme Student Council</footer>
        </div>
      </main>

      {/* DELETE CONFIRM MODAL */}
      {deleteTarget && (
        <div
          className="reset-modal-overlay"
          onClick={() => !deleting && setDeleteTarget(null)}
        >
          <div
            className="reset-modal"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="reset-modal-icon danger">✕</div>

            <h3>Delete "{deleteTarget.name}"?</h3>

            <p>
              This permanently deletes the session and all{" "}
              {(deleteTarget.attendance || []).length} attendance record
              {(deleteTarget.attendance || []).length === 1 ? "" : "s"} linked
              to it from the database. This can't be undone.
            </p>

            <div className="reset-modal-actions">
              <button
                type="button"
                className="reset-modal-cancel"
                onClick={() => setDeleteTarget(null)}
                disabled={deleting}
              >
                Cancel
              </button>

              <button
                type="button"
                className="reset-modal-confirm danger"
                onClick={handleDeleteSession}
                disabled={deleting}
              >
                {deleting ? "Deleting..." : "Yes, delete session"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default AdminSessionHistory;