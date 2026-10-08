import { useRef, useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { supabase } from "../lib/supabase";

import logoLeft from "../assets/logo-left.png";
import logoRight from "../assets/logo-right.png";
import cardPhoto from "../assets/card-photo.png";
import checkPhoto from "../assets/check.png";

// --------------------------------------------------
// PRIVACY NOTICE (shown once per device)
// Bump the version to ask everyone to accept again.
// --------------------------------------------------

const CONSENT_KEY = "fon_attendance_privacy_consent_v1";

function hasStoredConsent() {
  try {
    return localStorage.getItem(CONSENT_KEY) !== null;
  } catch {
    return false;
  }
}

const noticeStyles = {
  overlay: {
    position: "fixed",
    inset: 0,
    zIndex: 2000,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
    background: "rgba(40, 30, 20, 0.55)",
    backdropFilter: "blur(4px)",
  },
  card: {
    width: "100%",
    maxWidth: 540,
    maxHeight: "92vh",
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
    textAlign: "left",
    background: "#ffffff",
    borderRadius: 18,
    boxShadow: "0 30px 60px -20px rgba(40, 30, 20, 0.45)",
  },
  header: {
    display: "flex",
    alignItems: "center",
    gap: 14,
    padding: "22px 24px 14px",
    borderBottom: "1px solid #f3e4d8",
  },
  lock: {
    flex: "none",
    width: 46,
    height: 46,
    display: "grid",
    placeItems: "center",
    borderRadius: 14,
    background: "#ffe3d1",
    fontSize: 22,
  },
  title: { margin: 0, fontSize: 19, color: "#171a19" },
  subtitle: { margin: "2px 0 0", fontSize: 12.5, color: "#7a817d" },
  body: {
    overflowY: "auto",
    padding: "16px 24px",
    fontSize: 13.5,
    lineHeight: 1.6,
    color: "#515956",
  },
  heading: { margin: "14px 0 4px", fontSize: 13.5, color: "#171a19" },
  paragraph: { margin: 0 },
  list: { margin: "4px 0 0", paddingLeft: 20 },
  footer: {
    padding: "16px 24px 20px",
    borderTop: "1px solid #f3e4d8",
    background: "#fdf8f4",
  },
  check: {
    display: "flex",
    alignItems: "flex-start",
    gap: 10,
    margin: "0 0 14px",
    fontSize: 13,
    lineHeight: 1.5,
    color: "#303734",
    cursor: "pointer",
  },
  checkbox: {
    flex: "none",
    width: 18,
    height: 18,
    marginTop: 2,
    accentColor: "#e8793b",
    cursor: "pointer",
  },
};

function PrivacyNotice({ consentGiven, agreed, onAgreeChange, onAccept, onClose }) {
  return createPortal(
    <div style={noticeStyles.overlay} role="dialog" aria-modal="true">
      <div style={noticeStyles.card}>
        <div style={noticeStyles.header}>
          <div style={noticeStyles.lock}>🔒</div>

          <div>
            <h2 style={noticeStyles.title}>Data Privacy Notice</h2>
            <p style={noticeStyles.subtitle}>
              FON Supreme Student Council Attendance System
            </p>
          </div>
        </div>

        <div style={noticeStyles.body}>
          <p style={noticeStyles.paragraph}>
            The FON Supreme Student Council (FON SSC) values your privacy. This
            notice explains how your information is handled in this system, in
            line with the Data Privacy Act of 2012 (Republic Act No. 10173).
          </p>

          <h4 style={noticeStyles.heading}>What we collect</h4>
          <ul style={noticeStyles.list}>
            <li>Your username, full name, year level and section</li>
            <li>The date and time you time in and time out</li>
            <li>A selfie taken at time in and time out to verify your attendance</li>
          </ul>

          <h4 style={noticeStyles.heading}>Why we collect it</h4>
          <p style={noticeStyles.paragraph}>
            Only to record and verify attendance in FON SSC activities and
            programs. It is not used for any other purpose.
          </p>

          <h4 style={noticeStyles.heading}>Your information is confidential</h4>
          <p style={noticeStyles.paragraph}>
            Your information and photos are not sold, shared or disclosed to
            outside parties, and they are never posted publicly. They can be
            viewed only by authorized FON SSC officers who manage attendance,
            through a password-protected admin account.
          </p>

          <h4 style={noticeStyles.heading}>How we protect it</h4>
          <p style={noticeStyles.paragraph}>
            Your data is stored in a protected online database with restricted
            access and is sent through encrypted (HTTPS) connections. Records
            and photos are kept only as long as needed for attendance purposes.
          </p>

          <h4 style={noticeStyles.heading}>Camera and device storage</h4>
          <p style={noticeStyles.paragraph}>
            The camera is used only when you tap “Take Selfie”. When you accept
            this notice, a small note is saved in your browser so you are not
            asked again on this device. This system does not use cookies for
            advertising or tracking.
          </p>

          <h4 style={noticeStyles.heading}>Your rights</h4>
          <p style={noticeStyles.paragraph}>
            You may ask an FON SSC officer to access, correct or delete your
            information at any time.
          </p>

          <h4 style={noticeStyles.heading}>Stay safe</h4>
          <p style={noticeStyles.paragraph}>
            Your username is your key to this system. Do not share it with
            anyone, and only time in or time out for yourself.
          </p>
        </div>

        <div style={noticeStyles.footer}>
          {consentGiven ? (
            <button className="secondary-button" onClick={onClose}>
              Close
            </button>
          ) : (
            <>
              <label style={noticeStyles.check}>
                <input
                  type="checkbox"
                  style={noticeStyles.checkbox}
                  checked={agreed}
                  onChange={(event) => onAgreeChange(event.target.checked)}
                />

                <span>
                  I have read and understood this notice, and I agree to the
                  collection and use of my information and selfie for
                  attendance purposes.
                </span>
              </label>

              <button
                className="primary-button"
                onClick={onAccept}
                disabled={!agreed}
              >
                Continue
              </button>
            </>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}

const blockedStyles = {
  icon: {
    width: 56,
    height: 56,
    margin: "0 auto 12px",
    display: "grid",
    placeItems: "center",
    borderRadius: "50%",
    background: "#ffe3d1",
    color: "#e8793b",
    fontSize: 30,
    fontWeight: 800,
  },
  box: {
    margin: "16px 0 20px",
    padding: "14px 16px",
    display: "grid",
    gap: 4,
    textAlign: "left",
    background: "#fdf1e8",
    border: "1px solid #f6d9c4",
    borderRadius: 12,
    color: "#8a4b26",
    fontSize: 14,
    lineHeight: 1.5,
  },
};

// "Salleh, John Kenneth" -> "John"
function getFirstName(fullName) {
  const given = (fullName || "").split(",")[1] || "";

  return given.trim().split(/\s+/)[0] || "student";
}

function AttendancePage() {
  const [studentId, setStudentId] = useState("");
  const [student, setStudent] = useState(null);
  const [todayAttendance, setTodayAttendance] = useState(null);

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("");

  // Camera
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraLoading, setCameraLoading] = useState(false);

  // Captured selfie (before confirming)
  const [photo, setPhoto] = useState(null);

  // "time_in" or "time_out"
  const [cameraMode, setCameraMode] = useState(null);

  // NEW: confirmed selfie kept so the student can save a copy to their device
  const [savedPhoto, setSavedPhoto] = useState(null);

  // NEW: open attendance session. undefined = checking, null = not open
  const [program, setProgram] = useState(undefined);

  // NEW: student found, but their year level is not in this session
  const [notAllowed, setNotAllowed] = useState(null);

  // NEW: privacy notice, remembered per device
  const [consentGiven, setConsentGiven] = useState(hasStoredConsent);
  const [showNotice, setShowNotice] = useState(false);
  const [agreed, setAgreed] = useState(false);

  const noticeOpen = !consentGiven || showNotice;

  function acceptNotice() {
    try {
      localStorage.setItem(
        CONSENT_KEY,
        JSON.stringify({ accepted: true, at: new Date().toISOString() })
      );
    } catch {
      // Storage blocked (e.g. private mode): the notice will show next visit
    }

    setConsentGiven(true);
    setShowNotice(false);
  }

  // Lock page scrolling while the notice is open
  useEffect(() => {
    document.body.style.overflow = noticeOpen ? "hidden" : "";

    return () => {
      document.body.style.overflow = "";
    };
  }, [noticeOpen]);

  // --------------------------------------------------
  // MESSAGE
  // --------------------------------------------------

  function showMessage(text, type = "info") {
    setMessage(text);
    setMessageType(type);
  }

  // --------------------------------------------------
  // FIND STUDENT
  // --------------------------------------------------

  async function findStudent() {
    const id = studentId.trim();

    if (!id) {
      showMessage("Please enter your Attendance username.", "error");
      return;
    }

    setLoading(true);
    setNotAllowed(null);
    setStudent(null);
    setTodayAttendance(null);
    setMessage("");
    setMessageType("");

    try {
      const { data: studentData, error: studentError } = await supabase.rpc(
        "find_student",
        { p_student_id: id }
      );

      if (studentError) throw studentError;

      // Year level not included in this session
      if (studentData?.allowed === false) {
        setNotAllowed(studentData);
        return;
      }

      setStudent(studentData);

      const { data: attendanceData, error: attendanceError } =
        await supabase.rpc("get_today_attendance", { p_student_id: id });

      if (attendanceError) throw attendanceError;

      setTodayAttendance(attendanceData);
    } catch (error) {
      console.error("Find student error:", error);
      showMessage(error.message || "Unable to find student.", "error");
    } finally {
      setLoading(false);
    }
  }

  // --------------------------------------------------
  // CLEAR STUDENT
  // --------------------------------------------------

  function clearStudent() {
    stopCamera();

    if (photo?.url) URL.revokeObjectURL(photo.url);
    if (savedPhoto?.url) URL.revokeObjectURL(savedPhoto.url);

    setStudentId("");
    setNotAllowed(null);
    setStudent(null);
    setTodayAttendance(null);

    setMessage("");
    setMessageType("");

    setPhoto(null);
    setSavedPhoto(null);
    setCameraOpen(false);
    setCameraLoading(false);
    setCameraMode(null);
  }

  // --------------------------------------------------
  // CAMERA
  // --------------------------------------------------

  async function openCamera(mode = "time_in") {
    if (!navigator.mediaDevices?.getUserMedia) {
      showMessage("Your browser does not support camera access.", "error");
      return;
    }

    setCameraMode(mode);
    setCameraLoading(true);
    setMessage("");
    setMessageType("");

    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: "user" },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });

      streamRef.current = mediaStream;
      setCameraOpen(true);

      // Attach stream after the video element appears
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream;
          videoRef.current.play().catch(() => {});
        }
      }, 100);
    } catch (error) {
      console.error("Camera error:", error);

      if (error.name === "NotAllowedError") {
        showMessage(
          "Camera permission was denied. Please allow camera access and try again.",
          "error"
        );
      } else if (error.name === "NotFoundError") {
        showMessage("No camera was found on this device.", "error");
      } else if (error.name === "NotReadableError") {
        showMessage(
          "The camera is already being used by another application.",
          "error"
        );
      } else {
        showMessage("Unable to open the camera.", "error");
      }
    } finally {
      setCameraLoading(false);
    }
  }

  function stopCamera() {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    setCameraOpen(false);
  }

  // --------------------------------------------------
  // CAPTURE PHOTO
  // --------------------------------------------------

  function capturePhoto() {
    const video = videoRef.current;

    if (!video) {
      showMessage("Camera is not ready yet.", "error");
      return;
    }

    if (!video.videoWidth || !video.videoHeight) {
      showMessage("Please wait for the camera preview to load.", "error");
      return;
    }

    const canvas = document.createElement("canvas");

    // Compress image to a reasonable size
    const maxWidth = 720;
    const scale = Math.min(1, maxWidth / video.videoWidth);

    canvas.width = Math.round(video.videoWidth * scale);
    canvas.height = Math.round(video.videoHeight * scale);

    const context = canvas.getContext("2d");

    if (!context) {
      showMessage("Unable to process the selfie.", "error");
      return;
    }

    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    canvas.toBlob(
      (blob) => {
        if (!blob) {
          showMessage("Unable to capture the photo.", "error");
          return;
        }

        const photoUrl = URL.createObjectURL(blob);

        if (photo?.url) URL.revokeObjectURL(photo.url);

        setPhoto({ blob, url: photoUrl });
        stopCamera();
      },
      "image/jpeg",
      0.75
    );
  }

  // --------------------------------------------------
  // RETAKE
  // --------------------------------------------------

  function retakePhoto() {
    if (photo?.url) URL.revokeObjectURL(photo.url);

    setPhoto(null);
    setMessage("");
    setMessageType("");

    openCamera(cameraMode || "time_in");
  }

  // --------------------------------------------------
  // CONFIRM + UPLOAD + RECORD TIME IN / TIME OUT
  // --------------------------------------------------

  async function confirmPhoto() {
    if (!photo?.blob) {
      showMessage("Please capture a selfie first.", "error");
      return;
    }

    if (!student?.student_id) {
      showMessage("Student information is missing.", "error");
      return;
    }

    setLoading(true);
    setMessage("");
    setMessageType("");

    let uploadedPhotoPath = null;

    try {
      // Philippine date, used only to organize the Storage path
      const manilaDate = new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Manila",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(new Date());

      const uniqueId = crypto.randomUUID();
      const photoType = cameraMode === "time_out" ? "time-out" : "time-in";

      uploadedPhotoPath = `${student.student_id}/${manilaDate}/${photoType}-${uniqueId}.jpg`;

      // Upload selfie
      const { error: uploadError } = await supabase.storage
        .from("attendance-photos")
        .upload(uploadedPhotoPath, photo.blob, {
          contentType: "image/jpeg",
          cacheControl: "3600",
          upsert: false,
        });

      if (uploadError) throw uploadError;

      // Record attendance
      const rpcName =
        cameraMode === "time_out" ? "record_time_out" : "record_time_in";

      const { data: attendanceData, error: attendanceError } =
        await supabase.rpc(rpcName, {
          p_student_id: student.student_id,
          p_photo_path: uploadedPhotoPath,
        });

      if (attendanceError) throw attendanceError;

      console.log(`${rpcName} response:`, attendanceData);

      // Refresh attendance
      const { data: updatedAttendance, error: refreshError } =
        await supabase.rpc("get_today_attendance", {
          p_student_id: student.student_id,
        });

      if (refreshError) {
        console.error("Attendance refresh error:", refreshError);
      } else {
        setTodayAttendance(updatedAttendance);
      }

      // NEW: keep the confirmed selfie so the student can save a copy.
      // The preview URL is reused, so it is NOT revoked here.
      if (savedPhoto?.url) URL.revokeObjectURL(savedPhoto.url);

      setSavedPhoto({
        blob: photo.blob,
        url: photo.url,
        filename: `attendance_${getLastName(student.full_name)}_${manilaDate}_${photoType}.jpg`,
      });

      setPhoto(null);
      setCameraMode(null);

      showMessage(
        cameraMode === "time_out"
          ? "Time Out recorded successfully!"
          : "Time In recorded successfully!",
        "success"
      );
    } catch (error) {
      console.error("Attendance recording error:", error);

      // Remove the orphaned selfie if the database rejected the record
      if (uploadedPhotoPath) {
        const { error: cleanupError } = await supabase.storage
          .from("attendance-photos")
          .remove([uploadedPhotoPath]);

        if (cleanupError) {
          console.error("Photo cleanup error:", cleanupError);
        }
      }

      showMessage(
        error.message ||
          (cameraMode === "time_out"
            ? "Unable to record Time Out."
            : "Unable to record Time In."),
        "error"
      );
    } finally {
      setLoading(false);
    }
  }

  // --------------------------------------------------
  // NEW: SAVE PHOTO TO GALLERY
  // iPhone/iPad: share sheet ("Save Image" -> Photos)
  // Android/desktop: normal download
  // --------------------------------------------------

  async function savePhotoToGallery() {
    if (!savedPhoto) return;

    const file = new File([savedPhoto.blob], savedPhoto.filename, {
      type: "image/jpeg",
    });

    const isIOS =
      /iPad|iPhone|iPod/.test(navigator.userAgent) ||
      (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

    if (isIOS && navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: "Attendance photo" });
        return;
      } catch (error) {
        // Student closed the share sheet: do nothing
        if (error.name === "AbortError") return;
        // Any other error: fall through to download
      }
    }

    const link = document.createElement("a");
    link.href = savedPhoto.url;
    link.download = savedPhoto.filename;
    document.body.appendChild(link);
    link.click();
    link.remove();

    showMessage("Photo saved to your device.", "success");
  }

  // --------------------------------------------------
  // CLEAN UP CAMERA WHEN PAGE UNMOUNTS
  // --------------------------------------------------

  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }

      if (photo?.url) URL.revokeObjectURL(photo.url);
    };
  }, []);

  // --------------------------------------------------
  // NEW: CHECK IF THE ADMIN HAS OPENED A SESSION
  // Re-checks every 20 seconds so the page opens/closes by itself.
  // --------------------------------------------------

  async function loadProgram() {
    const { data, error } = await supabase.rpc("get_open_program");

    if (error) {
      console.error("Session check error:", error);
      setProgram((previous) => (previous === undefined ? null : previous));
      return;
    }

    setProgram(data?.open ? data : null);
  }

  useEffect(() => {
    loadProgram();

    const timer = setInterval(loadProgram, 20000);

    return () => clearInterval(timer);
  }, []);

  // --------------------------------------------------
  // PAGE
  // --------------------------------------------------

  return (
    <div className="attendance-page">
      {noticeOpen && (
        <PrivacyNotice
          consentGiven={consentGiven}
          agreed={agreed}
          onAgreeChange={setAgreed}
          onAccept={acceptNotice}
          onClose={() => setShowNotice(false)}
        />
      )}

      <header className="attendance-header">
        <div className="school-logo">✔</div>
        <div>
          <h1>FON Attendance System</h1>
          <p>Digital Attendance Tracking</p>
        </div>
      </header>

      <main className="attendance-container">
        <div className="dual-logos">
          <img src={logoLeft} alt="Left logo" />
          <img src={logoRight} alt="Right logo" />
        </div>

        {/* CHECKING SESSION */}
        {!student && program === undefined && (
          <section className="attendance-card">
            <h2>Checking attendance session...</h2>
          </section>
        )}

        {/* NO SESSION OPEN */}
        {!student && program === null && (
          <section className="attendance-card">
            <div className="card-icon">
              <img src={cardPhoto} alt="Attendance" />
            </div>

            <h2>Attendance Session Not Open</h2>

            <p className="instruction">
              The attendance session has not been opened yet. Please wait for
              the admin to start it.
            </p>
          </section>
        )}

        {/* STUDENT ID */}
        {/* YEAR LEVEL NOT INCLUDED */}
        {!student && program && notAllowed && (
          <section className="attendance-card">
            <div style={blockedStyles.icon}>!</div>

            <h2>Oops, sorry {getFirstName(notAllowed.full_name)}!</h2>

            <p className="instruction">
              Your year level is not included in this session.
            </p>

            <div style={blockedStyles.box}>
              <div>
                <strong>Session:</strong> {program.name}
              </div>

              <div>
                <strong>Open to:</strong>{" "}
                {program.allowed_year_levels?.length > 0
                  ? program.allowed_year_levels.join(", ")
                  : "All year levels"}
              </div>

              <div>
                <strong>Your year level:</strong> {notAllowed.year_level}
              </div>
            </div>

            <button className="secondary-button" onClick={clearStudent}>
              Try another username
            </button>
          </section>
        )}

        {/* STUDENT ID */}
        {!student && program && !notAllowed && (
          <section className="attendance-card">
            <div className="card-icon">
              <img src={cardPhoto} alt="Attendance" />
            </div>

            <h2>Welcome FON Students</h2>

            <p className="instruction">
              <strong>{program.name}</strong>
              {program.allowed_year_levels?.length > 0 &&
                ` — open to ${program.allowed_year_levels.join(", ")} only`}
            </p>

            <p className="instruction">Enter your username to continue.</p>

            <label htmlFor="studentId">Username</label>

            <input
              id="studentId"
              type="text"
              value={studentId}
              onChange={(event) => setStudentId(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") findStudent();
              }}
              placeholder="Example: ABCD1234"
              autoComplete="off"
            />

            <button
              className="primary-button"
              onClick={findStudent}
              disabled={loading}
            >
              {loading ? "Searching..." : "Continue"}
            </button>

            {message && (
              <div className={`message ${messageType}`}>{message}</div>
            )}
          </section>
        )}

        {/* STUDENT FOUND */}
        {student && (
          <section className="attendance-card">
            <div className="success-icon">
              <img src={checkPhoto} alt="Success" />
            </div>

            <h2>Student Found</h2>

            <div className="student-information">
              <div className="student-row">
                <span>Username</span>
                <strong>{student.student_id}</strong>
              </div>

              <div className="student-row">
                <span>Full Name</span>
                <strong>{student.full_name}</strong>
              </div>

              <div className="student-row">
                <span>Year</span>
                <strong>{student.year_level}</strong>
              </div>

              <div className="student-row">
                <span>Section</span>
                <strong>{student.section}</strong>
              </div>
            </div>

            {/* TIME IN */}
            {todayAttendance?.has_attendance === false && (
              <div className="attendance-action">
                <h3>Time In</h3>

                <p>Take a selfie to verify your attendance.</p>

                {!cameraOpen && !photo && (
                  <>
                    <div className="camera-placeholder">📷</div>

                    <button
                      className="primary-button"
                      onClick={() => openCamera("time_in")}
                      disabled={cameraLoading || loading}
                    >
                      {cameraLoading ? "Opening Camera..." : "Take Selfie"}
                    </button>
                  </>
                )}

                {cameraOpen && (
                  <div className="camera-container">
                    <video
                      ref={videoRef}
                      autoPlay
                      playsInline
                      muted
                      className="camera-preview"
                    />

                    <div className="camera-controls">
                      <button
                        className="primary-button capture-button"
                        onClick={capturePhoto}
                        disabled={loading}
                      >
                        Capture
                      </button>

                      <button
                        className="secondary-button"
                        onClick={() => {
                          stopCamera();
                          setCameraMode(null);
                        }}
                        disabled={loading}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}

                {photo && (
                  <div className="photo-preview-container">
                    <img
                      src={photo.url}
                      alt={
                        cameraMode === "time_out"
                          ? "Time Out selfie preview"
                          : "Time In selfie preview"
                      }
                      className="photo-preview"
                    />

                    <p>Is this selfie clear and recognizable?</p>

                    <div className="camera-controls">
                      <button
                        className="secondary-button"
                        onClick={retakePhoto}
                        disabled={loading}
                      >
                        Retake
                      </button>

                      <button
                        className="primary-button"
                        onClick={confirmPhoto}
                        disabled={loading}
                      >
                        {loading ? "Recording..." : "Confirm"}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ALREADY TIMED IN -> TIME OUT */}
            {todayAttendance?.has_attendance && !todayAttendance.time_out && (
              <div className="attendance-action">
                <div className="time-display">
                  <img src={checkPhoto} alt="Timed in" />
                </div>

                <h3>You're already timed in</h3>

                <p>
                  Time In: <strong>{formatTime(todayAttendance.time_in)}</strong>
                </p>

                {!cameraOpen && !photo && (
                  <>
                    <div className="camera-placeholder">📷</div>

                    <p>Take a selfie to verify your Time Out.</p>

                    <button
                      className="primary-button"
                      onClick={() => openCamera("time_out")}
                      disabled={cameraLoading || loading}
                    >
                      {cameraLoading
                        ? "Opening Camera..."
                        : "Take Selfie & Time Out"}
                    </button>
                  </>
                )}

                {cameraOpen && cameraMode === "time_out" && (
                  <div className="camera-container">
                    <video
                      ref={videoRef}
                      autoPlay
                      playsInline
                      muted
                      className="camera-preview"
                    />

                    <div className="camera-controls">
                      <button
                        className="primary-button capture-button"
                        onClick={capturePhoto}
                        disabled={loading}
                      >
                        Capture Time Out Selfie
                      </button>

                      <button
                        className="secondary-button"
                        onClick={() => {
                          stopCamera();
                          setCameraMode(null);
                        }}
                        disabled={loading}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}

                {photo && cameraMode === "time_out" && (
                  <div className="photo-preview-container">
                    <img
                      src={photo.url}
                      alt="Time Out selfie preview"
                      className="photo-preview"
                    />

                    <p>Confirm this selfie for your Time Out?</p>

                    <div className="camera-controls">
                      <button
                        className="secondary-button"
                        onClick={retakePhoto}
                        disabled={loading}
                      >
                        Retake
                      </button>

                      <button
                        className="primary-button"
                        onClick={confirmPhoto}
                        disabled={loading}
                      >
                        {loading ? "Recording..." : "Confirm Time Out"}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ATTENDANCE COMPLETE */}
            {todayAttendance?.has_attendance && todayAttendance.time_out && (
              <div className="attendance-action completed">
                <div className="completed-icon">
                  <img src={checkPhoto} alt="Attendance complete" />
                </div>

                <h3>Attendance Complete</h3>

                <p>
                  Time In: <strong>{formatTime(todayAttendance.time_in)}</strong>
                </p>

                <p>
                  Time Out:{" "}
                  <strong>{formatTime(todayAttendance.time_out)}</strong>
                </p>

                <p className="success-text">
                  Your attendance for today is complete.
                </p>
              </div>
            )}

            {/* NEW: SAVE A COPY OF THE CONFIRMED SELFIE */}
            {savedPhoto && !cameraOpen && !photo && (
              <div className="photo-preview-container">
                <img
                  src={savedPhoto.url}
                  alt="Your attendance photo"
                  className="photo-preview"
                />

                <p>
                  Photos are kept for a limited time. Save a copy for your own
                  records.
                </p>

                <button
                  className="secondary-button"
                  onClick={savePhotoToGallery}
                >
                  Save photo to gallery
                </button>
              </div>
            )}

            {/* MESSAGE */}
            {message && (
              <div className={`message ${messageType}`}>{message}</div>
            )}

            {/* CHANGE STUDENT */}
            <button
              className="secondary-button"
              onClick={clearStudent}
              disabled={loading}
            >
              Use Another Student ID
            </button>
          </section>
        )}
      </main>

      <footer>
        FON Supreme Student Council
        {" · "}
        <button
          type="button"
          onClick={() => setShowNotice(true)}
          style={{
            padding: 0,
            border: "none",
            background: "none",
            color: "inherit",
            font: "inherit",
            textDecoration: "underline",
            cursor: "pointer",
          }}
        >
          Privacy Notice
        </button>
      </footer>
    </div>
  );
}

// --------------------------------------------------
// LAST NAME FOR FILENAME
// "Salleh, John Kenneth" -> "salleh"
// "De Guzman, Ana"       -> "de-guzman"
// --------------------------------------------------

function getLastName(fullName) {
  const lastName = (fullName || "").split(",")[0];

  return (
    lastName
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "student"
  );
}

// --------------------------------------------------
// FORMAT TIME
// --------------------------------------------------

function formatTime(timestamp) {
  if (!timestamp) return "";

  return new Date(timestamp).toLocaleTimeString("en-PH", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: "Asia/Manila",
  });
}

export default AttendancePage;