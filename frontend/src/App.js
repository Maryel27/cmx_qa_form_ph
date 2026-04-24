import React, { useEffect, useState, useCallback } from "react";
import { Routes, Route, Navigate, useLocation, Outlet } from "react-router-dom";

import OauthLogin from "./components/Routes/OauthLogin";
import QADashboardPage from "./components/Routes/QADashboardPage";
import FormsCatalog from "./components/Routes/FormsCatalog";
import QAForms from "./components/Routes/QAForms";
import UserManagement from "./components/Routes/UserManagement";
import OtpVerification from "./components/common/OtpVerification";

import SessionExpiredModal from "./components/common/SessionExpiredModal";
import SessionWarningModal from "./components/common/SessionWarningModal";

import useUnifiedSessionTimer from "./components/lib/useUnifiedSessionTimer";
import { SERVER_URL } from "./components/lib/constants";

/*
========================================
🔐 AUTH GUARD
========================================
*/
function RequireAuth({ isAuthed }) {
  const location = useLocation();

  if (isAuthed === false) {
    return (
      <Navigate to="/OauthLogin" replace state={{ from: location.pathname }} />
    );
  }

  return <Outlet />;
}

/*
========================================
🔐 ROLE GUARD
========================================
*/
function RequireAdminOrHigher({ user }) {
  const location = useLocation();

  const role = user?.userLevel || user?.user_access_level;

  if (!role || role === "User") {
    return (
      <Navigate to="/Dashboard" replace state={{ from: location.pathname }} />
    );
  }

  return <Outlet />;
}

/*
========================================
🔐 REDIRECT IF AUTHED
========================================
*/
function RedirectIfAuthenticated({ isAuthed, children }) {
  return isAuthed === true ? <Navigate to="/Dashboard" replace /> : children;
}

/*
========================================
🚀 MAIN APP
========================================
*/
export default function App() {
  const location = useLocation();

  const [isAuthed, setIsAuthed] = useState(null);
  const [user, setUser] = useState(null);
  const [sessionExpired, setSessionExpired] = useState(false);

  /*
  ========================================
  🔁 REDIRECT
  ========================================
  */
  const handleLoginRedirect = useCallback(() => {
    window.location.href = "/OauthLogin";
  }, []);

  /*
  ========================================
  🔒 EXPIRE
  ========================================
  */
  const handleExpire = useCallback(async () => {
    try {
      await fetch(`${SERVER_URL}/api/logout`, {
        method: "POST",
        credentials: "include",
      });
    } catch (e) {}

    setSessionExpired(true);
    setIsAuthed(false);
    setUser(null);

    window.__SESSION_EXPIRED__ = true;
  }, []);

  /*
  ========================================
  🔍 SESSION CHECK
  ========================================
  */
  useEffect(() => {
    const publicPaths = ["/", "/OauthLogin", "/OTP-SECURE"];
    const isPublicPath = publicPaths.includes(location.pathname);

    const checkSession = async () => {
      try {
        const res = await fetch(`${SERVER_URL}/api/session`, {
          method: "GET",
          credentials: "include",
          cache: "no-store",
        });

        if (res.ok) {
          const data = await res.json();

          if (data.success && data.user) {
            setUser(data.user);
            setIsAuthed(true);
            return;
          }
        }

        if (!isPublicPath) {
          handleExpire();
        } else {
          setUser(null);
          setIsAuthed(false);
        }
      } catch (err) {
        console.error("Session check failed:", err);

        if (!isPublicPath) {
          handleExpire();
        } else {
          setUser(null);
          setIsAuthed(false);
        }
      }
    };

    if (window.__SESSION_EXPIRED__) return;

    checkSession();
  }, [location.pathname, handleExpire]);

  /*
  ========================================
  🔔 GLOBAL SESSION EXPIRED
  ========================================
  */
  useEffect(() => {
    const onSessionExpired = () => handleExpire();

    window.addEventListener("session-expired", onSessionExpired);
    return () =>
      window.removeEventListener("session-expired", onSessionExpired);
  }, [handleExpire]);

  /*
  ========================================
  ⏳ TIMER
  ========================================
  */
  const { showWarning, formattedTime, resetSession } = useUnifiedSessionTimer(
    isAuthed ? handleExpire : null,
  );

  /*
  ========================================
  ⏳ LOADING
  ========================================
  */
  if (isAuthed === null) {
    return (
      <div className="flex items-center justify-center h-screen bg-white">
        <p className="text-gray-500">Loading...</p>
      </div>
    );
  }

  /*
  ========================================
  🚀 ROUTES
  ========================================
  */
  return (
    <>
      <Routes>
        {/* PUBLIC */}
        <Route
          path="/"
          element={
            <RedirectIfAuthenticated isAuthed={isAuthed}>
              <OauthLogin />
            </RedirectIfAuthenticated>
          }
        />

        <Route
          path="/OauthLogin"
          element={
            <RedirectIfAuthenticated isAuthed={isAuthed}>
              <OauthLogin />
            </RedirectIfAuthenticated>
          }
        />

        <Route path="/OTP-SECURE" element={<OtpVerification />} />

        {/* PROTECTED */}
        <Route element={<RequireAuth isAuthed={isAuthed} />}>
          <Route element={<RequireAdminOrHigher user={user} />}>
            <Route
              path="/FormsCatalog"
              element={<FormsCatalog user={user} />}
            />
            <Route
              path="/UserManagement"
              element={<UserManagement user={user} />}
            />
          </Route>

          <Route path="/Dashboard" element={<QADashboardPage user={user} />} />
          <Route path="/QAForms" element={<QAForms user={user} />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>

      <SessionExpiredModal
        show={sessionExpired}
        onLogin={handleLoginRedirect}
      />

      <SessionWarningModal
        show={showWarning && !sessionExpired}
        timeLeft={formattedTime}
        onStayActive={resetSession}
      />
    </>
  );
}
