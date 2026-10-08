import { NavLink, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";

/* =========================================================
   SHARED ADMIN SIDEBAR

   Used by AdminDashboard, AdminStudents, AdminReports, and
   AdminSessionHistory so the "active" link always matches the
   real current route instead of being hardcoded per page.
   ========================================================= */

const NAV_LINKS = [
  {
    section: "MAIN",
    items: [
      { to: "/admin/dashboard", label: "Dashboard", icon: "▪" },
    ],
  },
  {
    section: "MANAGEMENT",
    items: [
      { to: "/admin/students", label: "Students", icon: "♙" },
      { to: "/admin/sessions", label: "Session History", icon: "◷" },
      { to: "/admin/reports", label: "Reports", icon: "▤" },
    ],
  },
];

function AdminSidebar({ user }) {
  const navigate = useNavigate();

  const adminEmail = user?.email || "Administrator";
  const adminInitial = adminEmail.charAt(0).toUpperCase();

  async function handleSignOut() {
    await supabase.auth.signOut();
    localStorage.removeItem("adminSession");
    navigate("/admin");
  }

  return (
    <aside className="admin-sidebar">
      <div className="sidebar-brand">
        <div className="brand-logo">✓</div>

        <div>
          <strong>FON Attendance</strong>
          <span>Administration</span>
        </div>
      </div>

      {NAV_LINKS.map((group) => (
        <div key={group.section}>
          <div className="sidebar-section-title">{group.section}</div>

          <nav className="sidebar-nav">
            {group.items.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `sidebar-link${isActive ? " active" : ""}`
                }
              >
                <span className="sidebar-icon">{item.icon}</span>
                {item.label}
              </NavLink>
            ))}
          </nav>
        </div>
      ))}

      <div className="sidebar-user">
        <div className="sidebar-user-info">
          <div className="admin-avatar">{adminInitial}</div>

          <div>
            <strong>Administrator</strong>
            <span>{adminEmail}</span>
          </div>
        </div>

        <button
          className="sidebar-signout"
          type="button"
          onClick={handleSignOut}
        >
          ↪ Sign Out
        </button>
      </div>
    </aside>
  );
}

export default AdminSidebar;