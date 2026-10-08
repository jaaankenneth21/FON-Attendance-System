import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import AdminSidebar from "./AdminSidebar";
import "./admin-dashboard.css";
import "./admin-reports.css";

/* =========================================================
   HELPERS
   ========================================================= */

function getManilaDate() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function daysAgo(days) {
  const date = new Date();
  date.setDate(date.getDate() - days);

  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Manila",
  }).format(date);
}

function formatDisplayDate(dateString) {
  if (!dateString) return "";

  const date = new Date(`${dateString}T00:00:00`);

  return date.toLocaleDateString("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

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

/* =========================================================
   DATE RANGE PRESETS
   ========================================================= */

const RANGE_PRESETS = [
  {
    label: "Last 7 Days",
    days: 7,
  },
  {
    label: "Last 30 Days",
    days: 30,
  },
  {
    label: "This Semester",
    startDate: "2026-08-10",
  },
];

/* =========================================================
   ADMIN REPORTS
   ========================================================= */

function AdminReports() {
  const [user, setUser] = useState(null);

  const [students, setStudents] = useState([]);
  const [attendance, setAttendance] = useState([]);

  const [startDate, setStartDate] = useState(daysAgo(30));
  const [endDate, setEndDate] = useState(getManilaDate());

  const [sectionFilter, setSectionFilter] = useState("all");

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  /* =======================================================
     LOAD USER
     ======================================================= */

  useEffect(() => {
    loadUser();
  }, []);

  /* =======================================================
     LOAD REPORT WHEN DATE CHANGES
     ======================================================= */

  useEffect(() => {
    loadReport();

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startDate, endDate]);

  /* =======================================================
     LOAD USER
     ======================================================= */

  async function loadUser() {
    const {
      data: { user: currentUser },
    } = await supabase.auth.getUser();

    setUser(currentUser);
  }

  /* =======================================================
     LOAD REPORT
     ======================================================= */

  async function loadReport() {
    try {
      setError("");

      if (!loading) {
        setRefreshing(true);
      }

      const [
        {
          data: studentsData,
          error: studentsError,
        },
        {
          data: attendanceData,
          error: attendanceError,
        },
      ] = await Promise.all([
        supabase
          .from("students")
          .select(
            "id, student_id, full_name, year_level, section"
          )
          .order("full_name", {
            ascending: true,
          }),

        supabase
          .from("attendance")
          .select(
            "id, student_id, attendance_date, session_number, time_in, time_out, status"
          )
          .gte("attendance_date", startDate)
          .lte("attendance_date", endDate),
      ]);

      if (studentsError) {
        throw studentsError;
      }

      if (attendanceError) {
        throw attendanceError;
      }

      setStudents(studentsData || []);
      setAttendance(attendanceData || []);
    } catch (err) {
      console.error("Report load error:", err);

      setError(
        err?.message ||
          "Unable to load report data."
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  /* =======================================================
     APPLY DATE PRESET
     ======================================================= */

  function applyPreset(preset) {
    if (preset.startDate) {
      setStartDate(preset.startDate);
    } else {
      setStartDate(daysAgo(preset.days));
    }

    setEndDate(getManilaDate());
  }

  /* =======================================================
     SECTION OPTIONS
     ======================================================= */

  const sectionOptions = useMemo(() => {
    const set = new Set(
      students
        .map((student) => student.section)
        .filter(Boolean)
    );

    return Array.from(set).sort();
  }, [students]);

  /* =======================================================
     FILTER STUDENTS
     ======================================================= */

  const scopedStudents = useMemo(() => {
    if (sectionFilter === "all") {
      return students;
    }

    return students.filter(
      (student) =>
        student.section === sectionFilter
    );
  }, [students, sectionFilter]);

  /* =======================================================
     DISTINCT ATTENDANCE DATES
     ======================================================= */

  const distinctDatesInRange = useMemo(() => {
    const set = new Set(
      attendance.map(
        (record) => record.attendance_date
      )
    );

    return set.size;
  }, [attendance]);

  /* =======================================================
     PER-STUDENT SUMMARY
     ======================================================= */

  const studentSummaries = useMemo(() => {
    const scopedIds = new Set(
      scopedStudents.map(
        (student) => student.id
      )
    );

    const byStudent = new Map();

    attendance.forEach((record) => {
      if (!scopedIds.has(record.student_id)) {
        return;
      }

      if (!record.time_in) {
        return;
      }

      if (!byStudent.has(record.student_id)) {
        byStudent.set(
          record.student_id,
          new Set()
        );
      }

      byStudent
        .get(record.student_id)
        .add(record.attendance_date);
    });

    return scopedStudents
      .map((student) => {
        const presentDates =
          byStudent.get(student.id)?.size || 0;

        const rate =
          distinctDatesInRange > 0
            ? Math.round(
                (presentDates /
                  distinctDatesInRange) *
                  100
              )
            : 0;

        return {
          ...student,
          presentDates,
          rate,
        };
      })
      .sort(
        (a, b) => b.rate - a.rate
      );
  }, [
    scopedStudents,
    attendance,
    distinctDatesInRange,
  ]);

  /* =======================================================
     SECTION BREAKDOWN
     ======================================================= */

  const sectionBreakdown = useMemo(() => {
    const groups = new Map();

    studentSummaries.forEach((student) => {
      const key =
        student.section || "Unassigned";

      if (!groups.has(key)) {
        groups.set(key, []);
      }

      groups.get(key).push(student);
    });

    return Array.from(
      groups.entries()
    )
      .map(([section, list]) => {
        const avgRate =
          list.length > 0
            ? Math.round(
                list.reduce(
                  (sum, student) =>
                    sum + student.rate,
                  0
                ) / list.length
              )
            : 0;

        return {
          section,
          count: list.length,
          avgRate,
        };
      })
      .sort(
        (a, b) =>
          b.avgRate - a.avgRate
      );
  }, [studentSummaries]);

  /* =======================================================
     OVERALL ATTENDANCE RATE
     ======================================================= */

  const overallRate = useMemo(() => {
    if (studentSummaries.length === 0) {
      return 0;
    }

    return Math.round(
      studentSummaries.reduce(
        (sum, student) =>
          sum + student.rate,
        0
      ) / studentSummaries.length
    );
  }, [studentSummaries]);

  /* =======================================================
     PERFECT ATTENDANCE
     ======================================================= */

  const perfectAttendanceCount =
    useMemo(
      () =>
        studentSummaries.filter(
          (student) =>
            student.rate === 100
        ).length,
      [studentSummaries]
    );

  /* =======================================================
     AT RISK
     ======================================================= */

  const atRiskCount = useMemo(
    () =>
      studentSummaries.filter(
        (student) =>
          student.rate < 50
      ).length,
    [studentSummaries]
  );

  /* =======================================================
     CSV EXPORT
     ======================================================= */

  function exportCSV() {
    if (
      studentSummaries.length === 0
    ) {
      return;
    }

    const header = [
      "Student",
      "Student ID",
      "Year",
      "Course and Level",
      "Days Present",
      "Days In Range",
      "Attendance Rate",
    ];

    const rows =
      studentSummaries.map(
        (student) => [
          student.full_name || "",
          student.student_id || "",
          student.year_level || "",
          student.section || "",
          student.presentDates,
          distinctDatesInRange,
          `${student.rate}%`,
        ]
      );

    const csv = [
      header,
      ...rows,
    ]
      .map((row) =>
        row
          .map(
            (value) =>
              `"${String(
                value ?? ""
              ).replaceAll(
                '"',
                '""'
              )}"`
          )
          .join(",")
      )
      .join("\n");

    const blob = new Blob(
      [csv],
      {
        type: "text/csv;charset=utf-8;",
      }
    );

    const url =
      URL.createObjectURL(blob);

    const link =
      document.createElement("a");

    link.href = url;

    link.download =
      `attendance-report-${startDate}-to-${endDate}.csv`;

    document.body.appendChild(link);

    link.click();

    link.remove();

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

          {/* =================================================
              HEADER
              ================================================= */}

          <div className="dashboard-header">

            <div>

              <div className="breadcrumb">

                <span>
                  Dashboard
                </span>

                <span>
                  /
                </span>

                <span>
                  Reports
                </span>

              </div>

              <h1>
                Reports
              </h1>

              <p>
                Attendance trends across a
                date range.
              </p>

            </div>

            <button
              className="export-button"
              type="button"
              onClick={exportCSV}
              disabled={
                studentSummaries.length === 0
              }
            >
              ↓ Export CSV
            </button>

          </div>

          {/* =================================================
              ERROR
              ================================================= */}

          {error && (
            <div className="dashboard-error">

              <strong>
                Something went wrong
              </strong>

              <span>
                {error}
              </span>

              <button
                type="button"
                onClick={loadReport}
              >
                Try Again
              </button>

            </div>
          )}

          {/* =================================================
              RANGE CONTROLS
              ================================================= */}

          <section className="report-controls">

            <div className="report-presets">

              {RANGE_PRESETS.map(
                (preset) => (
                  <button
                    key={
                      preset.label
                    }
                    type="button"
                    className="preset-chip"
                    onClick={() =>
                      applyPreset(
                        preset
                      )
                    }
                  >
                    {preset.label}
                  </button>
                )
              )}

            </div>

            <div className="report-date-range">

              <div className="date-box">

                <span>
                  ◷
                </span>

                <input
                  type="date"
                  value={
                    startDate
                  }
                  max={
                    endDate
                  }
                  onChange={(
                    event
                  ) =>
                    setStartDate(
                      event.target.value
                    )
                  }
                />

              </div>

              <span className="date-range-sep">
                to
              </span>

              <div className="date-box">

                <span>
                  ◷
                </span>

                <input
                  type="date"
                  value={
                    endDate
                  }
                  min={
                    startDate
                  }
                  max={
                    getManilaDate()
                  }
                  onChange={(
                    event
                  ) =>
                    setEndDate(
                      event.target.value
                    )
                  }
                />

              </div>

              <select
                className="filter-select"
                value={
                  sectionFilter
                }
                onChange={(
                  event
                ) =>
                  setSectionFilter(
                    event.target.value
                  )
                }
              >

                <option value="all">
                  All Levels
                </option>

                {sectionOptions.map(
                  (section) => (
                    <option
                      key={section}
                      value={section}
                    >
                      {section}
                    </option>
                  )
                )}

              </select>

              <button
                className="refresh-button"
                type="button"
                onClick={
                  loadReport
                }
                disabled={
                  refreshing
                }
                title="Refresh"
              >
                ↻
              </button>

            </div>

          </section>

          {/* =================================================
              STATS
              ================================================= */}

          <section className="stats-grid">

            <div className="stat-card">

              <div className="stat-icon yellow">
                %
              </div>

              <div className="stat-content">

                <span className="stat-label">
                  AVG ATTENDANCE
                </span>

                <strong>
                  {loading
                    ? "—"
                    : `${overallRate}%`}
                </strong>

                <small>
                  {formatDisplayDate(
                    startDate
                  )}{" "}
                  –{" "}
                  {formatDisplayDate(
                    endDate
                  )}
                </small>

              </div>

            </div>

            <div className="stat-card">

              <div className="stat-icon green">
                ✓
              </div>

              <div className="stat-content">

                <span className="stat-label">
                  PERFECT ATTENDANCE
                </span>

                <strong>
                  {loading
                    ? "—"
                    : perfectAttendanceCount}
                </strong>

                <small>
                  students at 100%
                </small>

              </div>

            </div>

            <div className="stat-card">

              <div className="stat-icon orange">
                !
              </div>

              <div className="stat-content">

                <span className="stat-label">
                  AT RISK
                </span>

                <strong>
                  {loading
                    ? "—"
                    : atRiskCount}
                </strong>

                <small>
                  students below 50%
                </small>

              </div>

            </div>

            <div className="stat-card">

              <div className="stat-icon purple">
                ◷
              </div>

              <div className="stat-content">

                <span className="stat-label">
                  DAYS IN RANGE
                </span>

                <strong>
                  {loading
                    ? "—"
                    : distinctDatesInRange}
                </strong>

                <small>
                  with attendance recorded
                </small>

              </div>

            </div>

          </section>

          {/* =================================================
              SECTION BREAKDOWN
              ================================================= */}

          <section className="attendance-card">

            <div className="attendance-card-header">

              <div>

                <h2>
                  By Course and Level
                </h2>

                <p>
                  Average attendance rate per
                  section for this range.
                </p>

              </div>

            </div>

            <div className="section-breakdown">

              {loading ? (

                <div className="table-empty">

                  <div className="loading-spinner">
                    <span />
                  </div>

                  <strong>
                    Loading report...
                  </strong>

                </div>

              ) : sectionBreakdown.length ===
                0 ? (

                <div className="table-empty">

                  <div className="empty-icon">
                    ▤
                  </div>

                  <strong>
                    No data for this range
                  </strong>

                  <span>
                    Try widening the date
                    range.
                  </span>

                </div>

              ) : (

                sectionBreakdown.map(
                  (row) => (

                    <div
                      className="section-bar-row"
                      key={
                        row.section
                      }
                    >

                      <div className="section-bar-label">

                        <span className="section-badge">
                          {row.section}
                        </span>

                        <small>
                          {row.count} students
                        </small>

                      </div>

                      <div className="section-bar-track">

                        <div
                          className="section-bar-fill"
                          style={{
                            width: `${row.avgRate}%`,
                          }}
                        />

                      </div>

                      <strong className="section-bar-value">
                        {row.avgRate}%
                      </strong>

                    </div>

                  )
                )

              )}

            </div>

          </section>

          {/* =================================================
              PER-STUDENT TABLE
              ================================================= */}

          <section className="attendance-card">

            <div className="attendance-card-header">

              <div>

                <h2>
                  Student Summary
                </h2>

                <p>
                  Sorted by attendance rate,
                  highest first.
                </p>

              </div>

            </div>

            <div className="attendance-table-wrapper">

              <table className="attendance-table">

                <thead>

                  <tr>

                    <th className="student-heading">
                      STUDENT
                    </th>

                    <th>
                      Course and Level
                    </th>

                    <th>
                      DAYS PRESENT
                    </th>

                    <th>
                      RATE
                    </th>

                  </tr>

                </thead>

                <tbody>

                  {loading ? (

                    <tr>

                      <td
                        colSpan={4}
                        className="table-empty"
                      >

                        <div className="loading-spinner">
                          <span />
                        </div>

                        <strong>
                          Loading report...
                        </strong>

                      </td>

                    </tr>

                  ) : studentSummaries.length ===
                    0 ? (

                    <tr>

                      <td
                        colSpan={4}
                        className="table-empty"
                      >

                        <div className="empty-icon">
                          ▤
                        </div>

                        <strong>
                          No data for this range
                        </strong>

                        <span>
                          Try widening the date
                          range or filter.
                        </span>

                      </td>

                    </tr>

                  ) : (

                    studentSummaries.map(
                      (student) => (

                        <tr
                          key={
                            student.id
                          }
                        >

                          <td className="student-column">

                            <div className="student-cell">

                              <div className="student-avatar">
                                {getInitials(
                                  student.full_name
                                )}
                              </div>

                              <div className="student-details">

                                <span className="student-name">
                                  {
                                    student.full_name
                                  }
                                </span>

                                <span className="student-year">
                                  {
                                    student.student_id
                                  }
                                </span>

                              </div>

                            </div>

                          </td>

                          <td>

                            <span className="section-badge">
                              {
                                student.section ||
                                "—"
                              }
                            </span>

                          </td>

                          <td>
                            {
                              student.presentDates
                            }
                          </td>

                          <td>

                            <span
                              className={`status-badge ${
                                student.rate >=
                                80
                                  ? "complete"
                                  : student.rate >=
                                    50
                                  ? "timed-in"
                                  : "absent"
                              }`}
                            >
                              {
                                student.rate
                              }%
                            </span>

                          </td>

                        </tr>

                      )
                    )

                  )}

                </tbody>

              </table>

            </div>

            <div className="attendance-table-footer">

              <span>

                Showing{" "}

                <strong>
                  {
                    studentSummaries.length
                  }
                </strong>{" "}

                {
                  studentSummaries.length ===
                  1
                    ? "student"
                    : "students"
                }

              </span>

            </div>

          </section>

          {/* =================================================
              FOOTER
              ================================================= */}

          <footer className="admin-footer">
            FON Supreme Student Council
          </footer>

        </div>

      </main>

    </div>
  );
}

export default AdminReports;