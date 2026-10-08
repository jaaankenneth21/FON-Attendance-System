import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import AdminSidebar from "./AdminSidebar";
import "./admin-dashboard.css";
import "./admin-students.css";

/* =========================================================
   HELPERS
   ========================================================= */

const EMPTY_FORM = {
  id: null,
  student_id: "",
  full_name: "",
  year_level: "",
  section: "",
};

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
   ADMIN STUDENTS
   ========================================================= */

function AdminStudents() {
  const [user, setUser] = useState(null);

  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");

  const [searchTerm, setSearchTerm] = useState("");
  const [yearFilter, setYearFilter] = useState("all");
  const [sectionFilter, setSectionFilter] = useState("all");

  const [formModalOpen, setFormModalOpen] = useState(false);
  const [formMode, setFormMode] = useState("add"); // "add" | "edit"
  const [form, setForm] = useState(EMPTY_FORM);
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    loadUser();
    loadStudents();
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

  async function loadStudents() {
    try {
      setError("");
      if (!loading) setRefreshing(true);

      const { data, error: studentsError } = await supabase
        .from("students")
        .select("id, student_id, full_name, year_level, section")
        .order("full_name", { ascending: true });

      if (studentsError) throw studentsError;

      setStudents(data || []);
    } catch (err) {
      console.error("Students load error:", err);
      setError(err?.message || "Unable to load students.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  /* =======================================================
     FILTER OPTIONS (derived from actual data, so they never
     go stale relative to what's really in the table)
     ======================================================= */

  const yearOptions = useMemo(() => {
    const set = new Set(students.map((s) => s.year_level).filter(Boolean));
    return Array.from(set).sort();
  }, [students]);

  const sectionOptions = useMemo(() => {
    const set = new Set(students.map((s) => s.section).filter(Boolean));
    return Array.from(set).sort();
  }, [students]);

  const filteredStudents = useMemo(() => {
    const search = searchTerm.trim().toLowerCase();

    return students.filter((student) => {
      const matchesSearch =
        !search ||
        student.full_name?.toLowerCase().includes(search) ||
        student.student_id?.toLowerCase().includes(search);

      const matchesYear =
        yearFilter === "all" || student.year_level === yearFilter;

      const matchesSection =
        sectionFilter === "all" || student.section === sectionFilter;

      return matchesSearch && matchesYear && matchesSection;
    });
  }, [students, searchTerm, yearFilter, sectionFilter]);

  /* =======================================================
     ADD / EDIT FORM
     ======================================================= */

  function openAddModal() {
    setFormMode("add");
    setForm(EMPTY_FORM);
    setFormError("");
    setFormModalOpen(true);
  }

  function openEditModal(student) {
    setFormMode("edit");
    setForm({
      id: student.id,
      student_id: student.student_id || "",
      full_name: student.full_name || "",
      year_level: student.year_level || "",
      section: student.section || "",
    });
    setFormError("");
    setFormModalOpen(true);
  }

  function closeFormModal() {
    if (saving) return;
    setFormModalOpen(false);
  }

  function updateField(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSaveStudent(event) {
    event.preventDefault();
    setFormError("");

    if (!form.student_id.trim() || !form.full_name.trim()) {
      setFormError("Student ID and full name are required.");
      return;
    }

    setSaving(true);

    try {
      const payload = {
        student_id: form.student_id.trim(),
        full_name: form.full_name.trim(),
        year_level: form.year_level.trim(),
        section: form.section.trim(),
      };

      if (formMode === "add") {
        const { error: insertError } = await supabase
          .from("students")
          .insert(payload);

        if (insertError) throw insertError;

        setToast(`${payload.full_name} was added.`);
      } else {
        const { error: updateError } = await supabase
          .from("students")
          .update(payload)
          .eq("id", form.id);

        if (updateError) throw updateError;

        setToast(`${payload.full_name} was updated.`);
      }

      setFormModalOpen(false);
      await loadStudents();
    } catch (err) {
      console.error("Save student error:", err);

      // Common case: student_id has a unique constraint
      const message = err?.message?.includes("duplicate")
        ? "That Student ID is already in use."
        : err?.message || "Unable to save this student.";

      setFormError(message);
    } finally {
      setSaving(false);
    }
  }

  /* =======================================================
     DELETE
     ======================================================= */

  async function handleDeleteStudent() {
    if (!deleteTarget) return;

    setDeleting(true);

    try {
      const { error: deleteError } = await supabase
        .from("students")
        .delete()
        .eq("id", deleteTarget.id);

      if (deleteError) throw deleteError;

      setToast(`${deleteTarget.full_name} was removed.`);
      setDeleteTarget(null);
      await loadStudents();
    } catch (err) {
      console.error("Delete student error:", err);
      setError(err?.message || "Unable to delete this student.");
      setDeleteTarget(null);
    } finally {
      setDeleting(false);
    }
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
                <span>Students</span>
              </div>

              <h1>Students</h1>
              <p>Add, edit, and manage the student roster.</p>
            </div>

            <button
              className="primary-button"
              type="button"
              onClick={openAddModal}
            >
              + Add Student
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
              <button type="button" onClick={loadStudents}>
                Try Again
              </button>
            </div>
          )}

          {/* STATS */}
          <section className="stats-grid">
            <div className="stat-card">
              <div className="stat-icon green">♙</div>
              <div className="stat-content">
                <span className="stat-label">TOTAL STUDENTS</span>
                <strong>{loading ? "—" : students.length}</strong>
                <small>enrolled in the system</small>
              </div>
            </div>

            <div className="stat-card">
              <div className="stat-icon orange">▤</div>
              <div className="stat-content">
                <span className="stat-label">COURSE AND LEVEL</span>
                <strong>{loading ? "—" : sectionOptions.length}</strong>
                <small>distinct BSN levels</small>
              </div>
            </div>

            <div className="stat-card">
              <div className="stat-icon purple">◷</div>
              <div className="stat-content">
                <span className="stat-label">YEAR LEVELS</span>
                <strong>{loading ? "—" : yearOptions.length}</strong>
                <small>represented</small>
              </div>
            </div>
          </section>

          {/* TABLE CARD */}
          <section className="attendance-card">
            <div className="attendance-card-header">
              <div>
                <h2>Student Roster</h2>
                <p>Search or filter, then edit / remove as needed.</p>
              </div>

              <div className="attendance-card-actions">
                <button
                  className="refresh-button"
                  type="button"
                  onClick={loadStudents}
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
                  placeholder="Search name or student ID..."
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

              <select
                className="filter-select"
                value={sectionFilter}
                onChange={(event) => setSectionFilter(event.target.value)}
              >
                <option value="all">All Course and Level</option>
                {sectionOptions.map((section) => (
                  <option key={section} value={section}>
                    {section}
                  </option>
                ))}
              </select>
            </div>

            <div className="attendance-table-wrapper">
              <table className="attendance-table">
                <thead>
                  <tr>
                    <th className="student-heading">STUDENT</th>
                    <th>USERNAME</th>
                    <th>YEAR</th>
                    <th>COURSE AND LEVEL</th>
                    <th className="col-actions">ACTIONS</th>
                  </tr>
                </thead>

                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={5} className="table-empty">
                        <div className="loading-spinner">
                          <span />
                        </div>
                        <strong>Loading students...</strong>
                      </td>
                    </tr>
                  ) : filteredStudents.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="table-empty">
                        <div className="empty-icon">♙</div>
                        <strong>No students found</strong>
                        <span>
                          {students.length === 0
                            ? "Add your first student to get started."
                            : "Try a different search or filter."}
                        </span>
                      </td>
                    </tr>
                  ) : (
                    filteredStudents.map((student) => (
                      <tr key={student.id}>
                        <td className="student-column">
                          <div className="student-cell">
                            <div className="student-avatar">
                              {getInitials(student.full_name)}
                            </div>
                            <div className="student-details">
                              <span className="student-name">
                                {student.full_name}
                              </span>
                            </div>
                          </div>
                        </td>

                        <td>
                          <span className="student-id">
                            {student.student_id || "—"}
                          </span>
                        </td>

                        <td>{student.year_level || "—"}</td>

                        <td>
                          <span className="section-badge">
                            {student.section || "—"}
                          </span>
                        </td>

                        <td>
                          <div className="row-actions">
                            <button
                              className="row-action-button"
                              type="button"
                              onClick={() => openEditModal(student)}
                            >
                              Edit
                            </button>
                            <button
                              className="row-action-button danger"
                              type="button"
                              onClick={() => setDeleteTarget(student)}
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className="attendance-table-footer">
              <span>
                Showing <strong>{filteredStudents.length}</strong>{" "}
                {filteredStudents.length === 1 ? "student" : "students"}
              </span>
            </div>
          </section>

          <footer className="admin-footer">FON Supreme Student Council</footer>
        </div>
      </main>

      {/* ADD / EDIT MODAL */}
      {formModalOpen && (
        <div className="reset-modal-overlay" onClick={closeFormModal}>
          <div
            className="reset-modal form-modal"
            onClick={(event) => event.stopPropagation()}
          >
            <h3>{formMode === "add" ? "Add Student" : "Edit Student"}</h3>

            <form onSubmit={handleSaveStudent}>
              <div className="form-field">
                <label htmlFor="student_id">Username</label>
                <input
                  id="student_id"
                  type="text"
                  value={form.student_id}
                  onChange={(event) =>
                    updateField("student_id", event.target.value)
                  }
                  placeholder="e.g. ABCD1234"
                  disabled={saving}
                />
              </div>

              <div className="form-field">
                <label htmlFor="full_name">Full Name</label>
                <input
                  id="full_name"
                  type="text"
                  value={form.full_name}
                  onChange={(event) =>
                    updateField("full_name", event.target.value)
                  }
                  placeholder="e.g. Dela Cruz, Juan"
                  disabled={saving}
                />
              </div>

              <div className="form-row">
                <div className="form-field">
                  <label htmlFor="year_level">Year Level</label>
                  <input
                    id="year_level"
                    type="text"
                    value={form.year_level}
                    onChange={(event) =>
                      updateField("year_level", event.target.value)
                    }
                    placeholder="e.g. 1st Year"
                    disabled={saving}
                  />
                </div>

                <div className="form-field">
                  <label htmlFor="section">Course and Level</label>
                  <input
                    id="section"
                    type="text"
                    value={form.section}
                    onChange={(event) =>
                      updateField("section", event.target.value)
                    }
                    placeholder="e.g. BSN Level 1"
                    disabled={saving}
                  />
                </div>
              </div>

              {formError && <div className="form-error">{formError}</div>}

              <div className="reset-modal-actions">
                <button
                  type="button"
                  className="reset-modal-cancel"
                  onClick={closeFormModal}
                  disabled={saving}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="reset-modal-confirm"
                  disabled={saving}
                >
                  {saving
                    ? "Saving..."
                    : formMode === "add"
                    ? "Add Student"
                    : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

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

            <h3>Remove {deleteTarget.full_name}?</h3>

            <p>
              This deletes the student record. Their past attendance history
              stays in the system, but they'll no longer appear on the
              roster.
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
                onClick={handleDeleteStudent}
                disabled={deleting}
              >
                {deleting ? "Removing..." : "Yes, remove student"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default AdminStudents;