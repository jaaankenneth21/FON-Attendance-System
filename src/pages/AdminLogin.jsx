import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import pinklogo from "../assets/pinklogo.png";
import "../admin.css";

function AdminLogin() {
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  async function handleLogin(event) {
    event.preventDefault();

    setMessage("");

    if (!email.trim()) {
      setMessage("Please enter your email.");
      return;
    }

    if (!password) {
      setMessage("Please enter your password.");
      return;
    }

    setLoading(true);

    try {
      const { data, error } =
        await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });

      if (error) {
        throw error;
      }

      if (!data.session) {
        throw new Error(
          "Login succeeded, but no session was created."
        );
      }

      localStorage.setItem(
        "adminSession",
        "true"
      );

      navigate("/admin/dashboard", {
        replace: true,
      });

    } catch (error) {
      console.error("Admin login error:", error);

      setMessage(
        error.message ||
          "Unable to sign in. Please check your email and password."
      );

    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="admin-login-page">

      <div className="admin-login-card">

        {/* Logo */}
        <div className="admin-login-logo">
          <img
            src={pinklogo}
            alt="Student Attendance System logo"
          />
        </div>

        {/* Heading */}
        <div className="admin-login-heading">

          <h1>
            Admin Login
          </h1>

          <p>
            Student Attendance System
          </p>

        </div>


        {/* Login Form */}
        <form
          className="admin-login-form"
          onSubmit={handleLogin}
        >

          <div className="admin-form-group">

            <label htmlFor="admin-email">
              Email
            </label>

            <input
              id="admin-email"
              type="email"
              value={email}
              onChange={(event) =>
                setEmail(event.target.value)
              }
              placeholder="admin@example.com"
              autoComplete="email"
              disabled={loading}
            />

          </div>


          <div className="admin-form-group">

            <label htmlFor="admin-password">
              Password
            </label>

            <input
              id="admin-password"
              type="password"
              value={password}
              onChange={(event) =>
                setPassword(event.target.value)
              }
              placeholder="Enter your password"
              autoComplete="current-password"
              disabled={loading}
            />

          </div>


          {message && (
            <div className="admin-login-error">
              {message}
            </div>
          )}


          <button
            type="submit"
            className="admin-sign-in-button"
            disabled={loading}
          >
            {loading
              ? "Signing in..."
              : "Sign In"}
          </button>

        </form>


        {/* Back */}
        <button
          type="button"
          className="admin-back-button"
          onClick={() => navigate("/")}
          disabled={loading}
        >
          ← Back to Attendance
        </button>

      </div>

    </div>
  );
}

export default AdminLogin;