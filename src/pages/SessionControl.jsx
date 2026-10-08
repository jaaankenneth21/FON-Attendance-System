import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { supabase } from "../lib/supabase";
import "./session-control.css";

const YEAR_LEVELS = ["1st Year", "2nd Year", "3rd Year", "4th Year"];

/* ---------- tiny inline icons ---------- */

const ICONS = {
  users: (
    <>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
    </>
  ),
  calendar: (
    <>
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path d="M16 2v4M8 2v4M3 10h18" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="10" />
      <path d="M12 6v6l4 2" />
    </>
  ),
  play: <path d="M6 4l14 8-14 8V4z" />,
  stop: <rect x="5" y="5" width="14" height="14" rx="2" />,
  check: <path d="M20 6L9 17l-5-5" />,
  arrow: <path d="M5 12h14M13 5l7 7-7 7" />,
};

function Icon({ name, size = 16 }) {
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
      {ICONS[name]}
    </svg>
  );
}

/* ---------- helpers ---------- */

function getManilaDate() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function formatDate(value) {
  return new Date(`${value}T00:00:00`).toLocaleDateString("en-PH", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function formatDateTime(value) {
  return new Date(value).toLocaleString("en-PH", {
    timeZone: "Asia/Manila",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

/* ---------- component ---------- */

function SessionControl({ onChange }) {
  const [program, setProgram] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [confirm, setConfirm] = useState(null); // "start" | "end" | null

  // Form
  const [name, setName] = useState("");
  const [date, setDate] = useState("");
  const [deadline, setDeadline] = useState("");
  const [levels, setLevels] = useState([]); // empty = all year levels

  useEffect(() => {
    loadProgram();
  }, []);

  async function loadProgram() {
    const { data, error: loadError } = await supabase
      .from("attendance_programs")
      .select("*")
      .eq("status", "open")
      .maybeSingle();

    if (loadError) {
      setError(loadError.message);
    } else {
      setProgram(data);
    }

    setLoading(false);
  }

  const expired =
    program?.deadline && new Date(program.deadline) < new Date();
  const isOpen = Boolean(program) && !expired;

  function toggleLevel(level) {
    setLevels((current) =>
      current.includes(level)
        ? current.filter((item) => item !== level)
        : [...current, level]
    );
  }

  function askStart() {
    setError("");

    if (!name.trim()) {
      setError("Please enter a session name.");
      return;
    }

    if (deadline && new Date(`${deadline}:00+08:00`) <= new Date()) {
      setError("The deadline must be in the future.");
      return;
    }

    setConfirm("start");
  }

  async function startSession() {
    setBusy(true);
    setError("");

    try {
      const { error: rpcError } = await supabase.rpc(
        "start_attendance_program",
        {
          p_name: name.trim(),
          p_program_date: date || null,
          p_deadline: deadline ? `${deadline}:00+08:00` : null,
          p_year_levels: levels,
        }
      );

      if (rpcError) throw rpcError;

      setName("");
      setDate("");
      setDeadline("");
      setLevels([]);

      await loadProgram();
      onChange?.();
    } catch (err) {
      setError(err.message || "Unable to start the session.");
    } finally {
      setConfirm(null);
      setBusy(false);
    }
  }

  async function endSession() {
    setBusy(true);
    setError("");

    try {
      const { error: rpcError } = await supabase.rpc(
        "end_attendance_program"
      );

      if (rpcError) throw rpcError;

      await loadProgram();
      onChange?.();
    } catch (err) {
      setError(err.message || "Unable to end the session.");
    } finally {
      setConfirm(null);
      setBusy(false);
    }
  }

  if (loading) return null;

  const levelText = program?.allowed_year_levels?.length
    ? program.allowed_year_levels.join(", ")
    : "All year levels";

  const notToday =
    program?.program_date && program.program_date !== getManilaDate();

  return (
    <section className={`sc-card ${isOpen ? "is-open" : "is-closed"}`}>
      <div className="sc-body">
        {error && <div className="sc-error">{error}</div>}

        {isOpen ? (
          <div className="sc-open">
            <div className="sc-open-main">
              <span className="sc-status open">
                <i />
                Session open
              </span>

              <h3>{program.name}</h3>

              <div className="sc-pills">
                <span className="sc-pill">
                  <Icon name="users" />
                  {levelText}
                </span>

                {program.program_date && (
                  <span className="sc-pill">
                    <Icon name="calendar" />
                    {formatDate(program.program_date)}
                  </span>
                )}

                {program.deadline && (
                  <span className="sc-pill">
                    <Icon name="clock" />
                    Closes {formatDateTime(program.deadline)}
                  </span>
                )}
              </div>

              {notToday && (
                <p className="sc-note">
                  Students can join starting on the session date.
                </p>
              )}
            </div>

            <button
              type="button"
              className="sc-end"
              onClick={() => setConfirm("end")}
              disabled={busy}
            >
              <Icon name="stop" size={14} />
              End Session
            </button>
          </div>
        ) : (
          <>
            <div className="sc-header">
              <div className="sc-icon">
                <Icon name="play" size={22} />
              </div>

              <div>
                <span className="sc-status closed">
                  <i />
                  No session open
                </span>

                <h3>Start Attendance Session</h3>

                <p>
                  Students cannot log in until you start a session.
                  {expired &&
                    ` The session "${program.name}" ended (deadline passed).`}
                </p>
              </div>
            </div>

            <div className="sc-fields">
              <label className="sc-field sc-span">
                <span>Session name</span>
                <input
                  type="text"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Example: Intramurals Opening Program"
                />
              </label>

              <label className="sc-field">
                <span>
                  Date <em>optional</em>
                </span>
                <input
                  type="date"
                  value={date}
                  onChange={(event) => setDate(event.target.value)}
                />
              </label>

              <label className="sc-field">
                <span>
                  Deadline <em>optional</em>
                </span>
                <input
                  type="datetime-local"
                  value={deadline}
                  onChange={(event) => setDeadline(event.target.value)}
                />
              </label>
            </div>

            <div className="sc-levels">
              <span className="sc-label">Who can attend</span>

              <div className="sc-chips">
                <button
                  type="button"
                  className={`sc-chip ${levels.length === 0 ? "active" : ""}`}
                  onClick={() => setLevels([])}
                >
                  {levels.length === 0 && <Icon name="check" size={14} />}
                  All year levels
                </button>

                {YEAR_LEVELS.map((level) => (
                  <button
                    key={level}
                    type="button"
                    className={`sc-chip ${
                      levels.includes(level) ? "active" : ""
                    }`}
                    onClick={() => toggleLevel(level)}
                  >
                    {levels.includes(level) && (
                      <Icon name="check" size={14} />
                    )}
                    {level}
                  </button>
                ))}
              </div>
            </div>

            <div className="sc-actions">
              <button
                type="button"
                className="sc-start"
                onClick={askStart}
                disabled={busy}
              >
                Start Session
                <Icon name="arrow" size={16} />
              </button>
            </div>
          </>
        )}
      </div>

      {confirm &&
        createPortal(
        <div
          className="sc-overlay"
          onClick={() => !busy && setConfirm(null)}
        >
          <div
            className="sc-modal"
            onClick={(event) => event.stopPropagation()}
          >
            <div className={`sc-modal-icon ${confirm}`}>
              <Icon name={confirm === "start" ? "play" : "stop"} size={22} />
            </div>

            {confirm === "start" ? (
              <>
                <h3>Start attendance session for "{name.trim()}"?</h3>
                <p>
                  Open to{" "}
                  {levels.length ? levels.join(", ") : "all year levels"}.
                  Students will be able to log in right away.
                </p>
              </>
            ) : (
              <>
                <h3>End attendance session for "{program?.name}"?</h3>
                <p>
                  Students will no longer be able to time in or time out.
                  Existing records are kept.
                </p>
              </>
            )}

            <div className="sc-modal-actions">
              <button
                type="button"
                className="sc-cancel"
                onClick={() => setConfirm(null)}
                disabled={busy}
              >
                Cancel
              </button>

              <button
                type="button"
                className={confirm === "start" ? "sc-start" : "sc-end solid"}
                onClick={confirm === "start" ? startSession : endSession}
                disabled={busy}
              >
                {busy
                  ? "Please wait..."
                  : confirm === "start"
                  ? "Yes, start session"
                  : "Yes, end session"}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </section>
  );
}

export default SessionControl;