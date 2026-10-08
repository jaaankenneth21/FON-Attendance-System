import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import AdminSidebar from "./AdminSidebar";
import SessionControl from "./SessionControl";
import ExcelJS from "exceljs";
import "./admin-dashboard.css";

/* =========================================================
   DATE / TIME HELPERS
   ========================================================= */

function getManilaDate() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function formatTime(timestamp) {
  if (!timestamp) return "—";

  return new Date(timestamp).toLocaleTimeString("en-PH", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: "Asia/Manila",
  });
}

function formatDisplayDate(dateString) {
  if (!dateString) return "";

  const date = new Date(`${dateString}T00:00:00`);

  return date.toLocaleDateString("en-PH", {
    month: "long",
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

/* Session 1 = "Session 1", Session 2 = "Session 2", etc. */
function sessionLabel(sessionNumber) {
  return `Session ${sessionNumber}`;
}

/* =========================================================
   ADMIN DASHBOARD
   ========================================================= */

function AdminDashboard() {
  const [user, setUser] = useState(null);

  const [records, setRecords] = useState([]);
  const [totalStudents, setTotalStudents] = useState(0);

  const [selectedDate, setSelectedDate] = useState(getManilaDate());
  const [searchTerm, setSearchTerm] = useState("");

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [exporting, setExporting] = useState(false);

  const [error, setError] = useState("");
  const [toast, setToast] = useState("");

  const [photoModal, setPhotoModal] = useState({
    open: false,
    url: "",
    title: "",
  });

  const [currentSession, setCurrentSession] = useState(1);
  const [activeSessionTab, setActiveSessionTab] = useState("all");

  /* =======================================================
     EFFECTS
     ======================================================= */

  useEffect(() => {
    loadUser();
  }, []);

  useEffect(() => {
    loadDashboard();
    setActiveSessionTab("all");
  }, [selectedDate]);

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

  /* =======================================================
     LOAD DASHBOARD DATA
     ======================================================= */

  async function loadDashboard() {
    try {
      setError("");

      if (!loading) {
        setRefreshing(true);
      }

      // Students
      const { data: studentsData, error: studentsError } = await supabase
        .from("students")
        .select(
          `
            id,
            student_id,
            full_name,
            year_level,
            section
          `
        )
        .order("full_name", { ascending: true });

      if (studentsError) throw studentsError;

      const students = studentsData || [];

      setTotalStudents(students.length);

      // Attendance
      const { data: attendanceData, error: attendanceError } = await supabase
        .from("attendance")
        .select(
          `
            id,
            student_id,
            attendance_date,
            session_number,
            time_in,
            time_out,
            time_in_photo_path,
            time_out_photo_path,
            status
          `
        )
        .eq("attendance_date", selectedDate)
        .order("session_number", { ascending: true })
        .order("time_in", { ascending: true });

      if (attendanceError) throw attendanceError;

      // Current session
      const { data: sessionRow, error: sessionError } = await supabase
        .from("attendance_day_sessions")
        .select("current_session")
        .eq("attendance_date", selectedDate)
        .maybeSingle();

      if (sessionError) throw sessionError;

      setCurrentSession(sessionRow?.current_session || 1);

      // Connect students + attendance
      const studentMap = new Map();

      students.forEach((student) => {
        studentMap.set(student.id, student);
      });

      const combinedRecords = (attendanceData || []).map((attendance) => ({
        ...attendance,
        session_number: attendance.session_number || 1,
        student: studentMap.get(attendance.student_id) || null,
      }));

      setRecords(combinedRecords);
    } catch (err) {
      console.error("Dashboard error:", err);

      setError(err?.message || "Unable to load attendance dashboard.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  /* =======================================================
     SESSIONS / FILTERS / STATISTICS
     ======================================================= */

  const availableSessions = useMemo(() => {
    const sessionSet = new Set(
      records.map((record) => record.session_number || 1)
    );

    sessionSet.add(currentSession);

    return Array.from(sessionSet).sort((a, b) => a - b);
  }, [records, currentSession]);

  const sessionRecords = useMemo(() => {
    if (activeSessionTab === "all") return records;

    return records.filter(
      (record) => (record.session_number || 1) === activeSessionTab
    );
  }, [records, activeSessionTab]);

  const filteredRecords = useMemo(() => {
    const search = searchTerm.trim().toLowerCase();

    if (!search) return sessionRecords;

    return sessionRecords.filter((record) => {
      const student = record.student;

      const name = student?.full_name?.toLowerCase() || "";
      const id = student?.student_id?.toLowerCase() || "";
      const section = student?.section?.toLowerCase() || "";

      return (
        name.includes(search) || id.includes(search) || section.includes(search)
      );
    });
  }, [sessionRecords, searchTerm]);

  const presentCount = sessionRecords.length;

  const timeInCount = sessionRecords.filter((record) => record.time_in).length;

  const timeOutCount = sessionRecords.filter(
    (record) => record.time_out
  ).length;

  const attendanceRate =
    totalStudents > 0 ? Math.round((presentCount / totalStudents) * 100) : 0;

  /* =======================================================
     VIEW PHOTO
     ======================================================= */

  async function viewPhoto(path, title) {
    if (!path) return;

    try {
      const { data, error: storageError } = await supabase.storage
        .from("attendance-photos")
        .createSignedUrl(path, 60 * 10);

      if (storageError) throw storageError;

      setPhotoModal({
        open: true,
        url: data.signedUrl,
        title,
      });
    } catch (err) {
      console.error("Photo error:", err);

      setError("Unable to open this attendance photo.");
    }
  }

  function closePhoto() {
    setPhotoModal({
      open: false,
      url: "",
      title: "",
    });
  }

  /* =======================================================
     GET PHOTO FOR EXCEL
     ======================================================= */

  async function getPhotoArrayBuffer(photoPath) {
    if (!photoPath) return null;

    try {
      const { data, error: storageError } = await supabase.storage
        .from("attendance-photos")
        .createSignedUrl(photoPath, 60 * 10);

      if (storageError) throw storageError;

      if (!data?.signedUrl) return null;

      const response = await fetch(data.signedUrl);

      if (!response.ok) {
        throw new Error(`Unable to download photo (${response.status}).`);
      }

      const blob = await response.blob();

      return await blob.arrayBuffer();
    } catch (err) {
      console.error("Export photo error:", err);

      return null;
    }
  }

  /* =======================================================
     EXCEL EXPORT (selfies are embedded in the cells)
     ======================================================= */

  async function exportExcel() {
    if (filteredRecords.length === 0 || exporting) return;

    setExporting(true);
    setError("");

    try {
      const workbook = new ExcelJS.Workbook();

      workbook.creator = "FON Attendance System";
      workbook.lastModifiedBy = "FON Attendance System";
      workbook.created = new Date();
      workbook.modified = new Date();

      const worksheet = workbook.addWorksheet("Attendance Records");

      worksheet.columns = [
        { header: "Student", key: "student", width: 28 },
        { header: "Student ID", key: "studentId", width: 18 },
        { header: "Year", key: "year", width: 15 },
        { header: "Section", key: "section", width: 20 },
        { header: "Attendance Date", key: "date", width: 20 },
        { header: "Session", key: "session", width: 15 },
        { header: "Time In", key: "timeIn", width: 15 },
        { header: "Time Out", key: "timeOut", width: 15 },
        { header: "Status", key: "status", width: 15 },
        { header: "Time In Photo", key: "timeInPhoto", width: 20 },
        { header: "Time Out Photo", key: "timeOutPhoto", width: 20 },
      ];

      const headerRow = worksheet.getRow(1);

      headerRow.font = { bold: true };

      headerRow.alignment = {
        vertical: "middle",
        horizontal: "center",
        wrapText: true,
      };

      headerRow.height = 28;

      // Photo columns: [record field, column index, label]
      const photoColumns = [
        ["time_in_photo_path", 9, "Time In"],
        ["time_out_photo_path", 10, "Time Out"],
      ];

      for (let index = 0; index < filteredRecords.length; index++) {
        const record = filteredRecords[index];
        const student = record.student;

        const row = worksheet.addRow({
          student: student?.full_name || "Unknown Student",
          studentId: student?.student_id || "",
          year: student?.year_level || "",
          section: student?.section || "",
          date: record.attendance_date || "",
          session: sessionLabel(record.session_number || 1),
          timeIn: record.time_in ? formatTime(record.time_in) : "",
          timeOut: record.time_out ? formatTime(record.time_out) : "",
          status: record.time_out
            ? "Complete"
            : record.time_in
            ? "Timed In"
            : "Absent",
          timeInPhoto: record.time_in_photo_path ? "" : "No photo",
          timeOutPhoto: record.time_out_photo_path ? "" : "No photo",
        });

        row.height = 100;

        row.alignment = {
          vertical: "middle",
          wrapText: true,
        };

        for (const [field, col, label] of photoColumns) {
          if (!record[field]) continue;

          const imageBuffer = await getPhotoArrayBuffer(record[field]);

          if (!imageBuffer) continue;

          try {
            const imageId = workbook.addImage({
              buffer: imageBuffer,
              extension: "jpeg",
            });

            worksheet.addImage(imageId, {
              tl: { col, row: index + 1 },
              ext: { width: 85, height: 85 },
              editAs: "oneCell",
            });
          } catch (imageError) {
            console.error(`Unable to embed ${label} photo:`, imageError);
          }
        }
      }

      worksheet.views = [{ state: "frozen", ySplit: 1 }];

      worksheet.autoFilter = {
        from: "A1",
        to: "K1",
      };

      worksheet.pageSetup = {
        orientation: "landscape",
        fitToPage: true,
        fitToWidth: 1,
        fitToHeight: 0,
      };

      const buffer = await workbook.xlsx.writeBuffer();

      const blob = new Blob([buffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });

      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");

      const sessionSuffix =
        activeSessionTab === "all"
          ? "all-sessions"
          : `session-${activeSessionTab}`;

      link.href = url;
      link.download = `attendance-${selectedDate}-${sessionSuffix}.xlsx`;

      document.body.appendChild(link);
      link.click();
      link.remove();

      URL.revokeObjectURL(url);

      setToast(
        `Excel export completed with ${filteredRecords.length} attendance ${
          filteredRecords.length === 1 ? "record" : "records"
        }.`
      );
    } catch (err) {
      console.error("Excel export error:", err);

      setError(err?.message || "Unable to export attendance to Excel.");
    } finally {
      setExporting(false);
    }
  }

  /* =======================================================
     RENDER
     ======================================================= */

  const columnCount = activeSessionTab === "all" ? 8 : 7;

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
                <span>Attendance</span>
              </div>

              <h1>Good day, Admin! </h1>

              <p>Here's your attendance overview for today.</p>
            </div>

            <div className="today-box">
              <span>TODAY</span>

              <strong>{formatDisplayDate(selectedDate)}</strong>
            </div>
          </div>

          {/* TOAST */}
          {toast && (
            <div className="dashboard-toast">
              <span>✓</span>

              <span>{toast}</span>

              <button type="button" onClick={() => setToast("")}>
                ×
              </button>
            </div>
          )}

          {/* ERROR */}
          {error && (
            <div className="dashboard-error">
              <strong>Something went wrong</strong>

              <span>{error}</span>

              <button type="button" onClick={loadDashboard}>
                Try Again
              </button>
            </div>
          )}

          {/* START / END ATTENDANCE SESSION */}
          <SessionControl onChange={loadDashboard} />

          {/* STATISTICS */}
          <section className="stats-grid">
            <div className="stat-card">
              <div className="stat-icon green">✓</div>

              <div className="stat-content">
                <span className="stat-label">
                  PRESENT
                  {activeSessionTab !== "all" &&
                    ` — ${sessionLabel(activeSessionTab)}`}
                </span>

                <strong>{loading ? "—" : presentCount}</strong>

                <small>of {totalStudents} students</small>
              </div>
            </div>

            <div className="stat-card">
              <div className="stat-icon orange">↗</div>

              <div className="stat-content">
                <span className="stat-label">TIME IN</span>

                <strong>{loading ? "—" : timeInCount}</strong>

                <small>students timed in</small>
              </div>
            </div>

            <div className="stat-card">
              <div className="stat-icon purple">↘</div>

              <div className="stat-content">
                <span className="stat-label">TIME OUT</span>

                <strong>{loading ? "—" : timeOutCount}</strong>

                <small>completed today</small>
              </div>
            </div>

            <div className="stat-card">
              <div className="stat-icon yellow">%</div>

              <div className="stat-content">
                <span className="stat-label">ATTENDANCE RATE</span>

                <strong>{loading ? "—" : `${attendanceRate}%`}</strong>

                <small>for selected date</small>
              </div>
            </div>
          </section>

          {/* ATTENDANCE CARD */}
          <section className="attendance-card">
            <div className="attendance-card-header">
              <div>
                <h2>Attendance Records</h2>

                <p>View and manage student attendance.</p>
              </div>

              <div className="attendance-card-actions">
                <button
                  className="export-button"
                  type="button"
                  onClick={exportExcel}
                  disabled={
                    filteredRecords.length === 0 || exporting || refreshing
                  }
                >
                  {exporting ? "Exporting Excel..." : "↓ Export Excel"}
                </button>
              </div>
            </div>

            {/* SESSION TABS */}
            {availableSessions.length > 1 && (
              <div className="session-tabs">
                <button
                  type="button"
                  className={`session-tab ${
                    activeSessionTab === "all" ? "active" : ""
                  }`}
                  onClick={() => setActiveSessionTab("all")}
                >
                  All Sessions
                </button>

                {availableSessions.map((sessionNumber) => (
                  <button
                    key={sessionNumber}
                    type="button"
                    className={`session-tab ${
                      activeSessionTab === sessionNumber ? "active" : ""
                    }`}
                    onClick={() => setActiveSessionTab(sessionNumber)}
                  >
                    {sessionLabel(sessionNumber)}

                    {sessionNumber === currentSession && (
                      <span className="session-tab-live"> • active</span>
                    )}
                  </button>
                ))}
              </div>
            )}

            {/* FILTERS */}
            <div className="attendance-filters">
              <div className="search-box">
                <span>⌕</span>

                <input
                  type="text"
                  placeholder="Search student name, ID or section..."
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                />
              </div>

              <div className="date-box">
                <span>◷</span>

                <input
                  type="date"
                  value={selectedDate}
                  onChange={(event) => setSelectedDate(event.target.value)}
                />
              </div>

              <button
                className="refresh-button"
                type="button"
                onClick={loadDashboard}
                disabled={refreshing || exporting}
                title="Refresh"
              >
                ↻
              </button>
            </div>

            {/* TABLE */}
            <div className="attendance-table-wrapper">
              <table className="attendance-table">
                <colgroup>
                  <col className="col-student" />
                  <col className="col-id" />
                  <col className="col-section" />

                  {activeSessionTab === "all" && (
                    <col className="col-session" />
                  )}

                  <col className="col-time-in" />
                  <col className="col-time-out" />
                  <col className="col-selfies" />
                  <col className="col-status" />
                </colgroup>

                <thead>
                  <tr>
                    <th className="student-heading">STUDENT</th>
                    <th>USERNAME</th>
                    <th>COURSE AND LEVEL</th>

                    {activeSessionTab === "all" && <th>SESSION</th>}

                    <th>TIME IN</th>
                    <th>TIME OUT</th>
                    <th>SELFIES</th>
                    <th>STATUS</th>
                  </tr>
                </thead>

                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={columnCount} className="table-empty">
                        <div className="loading-spinner">
                          <span />
                        </div>

                        <strong>Loading attendance...</strong>
                      </td>
                    </tr>
                  ) : filteredRecords.length === 0 ? (
                    <tr>
                      <td colSpan={columnCount} className="table-empty">
                        <div className="empty-icon">✓</div>

                        <strong>No attendance records</strong>

                        <span>
                          No students have attendance records for this date
                          {activeSessionTab !== "all" &&
                            ` in ${sessionLabel(activeSessionTab)}`}
                          .
                        </span>
                      </td>
                    </tr>
                  ) : (
                    filteredRecords.map((record) => {
                      const student = record.student;

                      const fullName = student?.full_name || "Unknown Student";

                      const initials = getInitials(fullName);

                      const status = record.time_out
                        ? "complete"
                        : record.time_in
                        ? "timed-in"
                        : "absent";

                      return (
                        <tr key={record.id}>
                          {/* STUDENT */}
                          <td className="student-column">
                            <div className="student-cell">
                              <div className="student-avatar">{initials}</div>

                              <div className="student-details">
                                <span className="student-name" title={fullName}>
                                  {fullName}
                                </span>

                                <span
                                  className="student-year"
                                  title={student?.year_level || ""}
                                >
                                  {student?.year_level || "—"}
                                </span>
                              </div>
                            </div>
                          </td>

                          {/* ID */}
                          <td>
                            <span
                              className="student-id"
                              title={student?.student_id || ""}
                            >
                              {student?.student_id || "—"}
                            </span>
                          </td>

                          {/* SECTION */}
                          <td>
                            <span
                              className="section-badge"
                              title={student?.section || ""}
                            >
                              {student?.section || "—"}
                            </span>
                          </td>

                          {/* SESSION */}
                          {activeSessionTab === "all" && (
                            <td>
                              <span
                                className="session-badge"
                                title={sessionLabel(record.session_number || 1)}
                              >
                                {sessionLabel(record.session_number || 1)}
                              </span>
                            </td>
                          )}

                          {/* TIME IN */}
                          <td>
                            <span
                              className="attendance-time"
                              title={
                                record.time_in
                                  ? formatTime(record.time_in)
                                  : "No Time In"
                              }
                            >
                              {record.time_in ? formatTime(record.time_in) : "—"}
                            </span>
                          </td>

                          {/* TIME OUT */}
                          <td>
                            <span
                              className="attendance-time"
                              title={
                                record.time_out
                                  ? formatTime(record.time_out)
                                  : "No Time Out"
                              }
                            >
                              {record.time_out
                                ? formatTime(record.time_out)
                                : "—"}
                            </span>
                          </td>

                          {/* SELFIES */}
                          <td>
                            <div className="selfie-actions">
                              {record.time_in_photo_path ? (
                                <button
                                  className="selfie-button"
                                  type="button"
                                  onClick={() =>
                                    viewPhoto(
                                      record.time_in_photo_path,
                                      `${fullName} — Time In`
                                    )
                                  }
                                  title="View Time In selfie"
                                >
                                  📷 In
                                </button>
                              ) : (
                                <button
                                  className="selfie-button disabled"
                                  type="button"
                                  disabled
                                  title="No Time In selfie"
                                >
                                  — In
                                </button>
                              )}

                              {record.time_out_photo_path ? (
                                <button
                                  className="selfie-button"
                                  type="button"
                                  onClick={() =>
                                    viewPhoto(
                                      record.time_out_photo_path,
                                      `${fullName} — Time Out`
                                    )
                                  }
                                  title="View Time Out selfie"
                                >
                                  📷 Out
                                </button>
                              ) : (
                                <button
                                  className="selfie-button disabled"
                                  type="button"
                                  disabled
                                  title="No Time Out selfie"
                                >
                                  — Out
                                </button>
                              )}
                            </div>
                          </td>

                          {/* STATUS */}
                          <td>
                            <span className={`status-badge ${status}`}>
                              {status === "complete"
                                ? "Complete"
                                : status === "timed-in"
                                ? "Timed In"
                                : "Absent"}
                            </span>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* TABLE FOOTER */}
            <div className="attendance-table-footer">
              <span>
                Showing <strong>{filteredRecords.length}</strong>{" "}
                {filteredRecords.length === 1 ? "record" : "records"}
              </span>

              <span>
                Attendance date:{" "}
                <strong>{formatDisplayDate(selectedDate)}</strong>
              </span>
            </div>
          </section>

          <footer className="admin-footer">FON Supreme Student Council</footer>
        </div>
      </main>

      {/* PHOTO MODAL */}
      {photoModal.open && (
        <div className="photo-modal-overlay" onClick={closePhoto}>
          <div
            className="photo-modal"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="photo-modal-header">
              <div>
                <span>ATTENDANCE PHOTO</span>

                <h3>{photoModal.title}</h3>
              </div>

              <button type="button" className="photo-close" onClick={closePhoto}>
                ×
              </button>
            </div>

            <div className="photo-modal-body">
              {photoModal.url && (
                <img src={photoModal.url} alt={photoModal.title} />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default AdminDashboard;