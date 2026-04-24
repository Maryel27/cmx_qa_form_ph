import React, { useState, useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { SERVER_URL } from "../lib/constants";
import pkg from "../../../package.json";

const OtpVerification = () => {
  const otpRef = useRef(null);
  const location = useLocation();
  const APP_VERSION = pkg.version;

  const [enteredOtp, setEnteredOtp] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [emailAddress, setEmailAddress] = useState("");

  const [timeLeft, setTimeLeft] = useState(0);
  const [isExpired, setIsExpired] = useState(false);

  const [resendCooldown, setResendCooldown] = useState(0);
  const [isResending, setIsResending] = useState(false);

  /*
  ========================================
  ⏱ FORMAT TIME
  ========================================
  */
  const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  /*
  ========================================
  🔁 INIT TIMER
  ========================================
  */
  useEffect(() => {
    const email =
      location.state?.emailAddress || localStorage.getItem("pendingEmail");

    const expiry = localStorage.getItem("pendingExpiryAt");

    if (!email || !expiry) {
      setError("Session expired. Please request a new OTP.");
      return;
    }

    setEmailAddress(email);
    localStorage.setItem("pendingEmail", email);

    const expiryTime = new Date(expiry).getTime();

    // 🔥 SET INITIAL VALUE IMMEDIATELY
    const initialDiff = Math.floor((expiryTime - Date.now()) / 1000);

    if (initialDiff <= 0) {
      setTimeLeft(0);
      setIsExpired(true);
    } else {
      setTimeLeft(initialDiff);
    }

    // ⏱ START INTERVAL
    const interval = setInterval(() => {
      const diff = Math.floor((expiryTime - Date.now()) / 1000);

      if (diff <= 0) {
        setTimeLeft(0);
        setIsExpired(true);
        clearInterval(interval);
      } else {
        setTimeLeft(diff);
      }
    }, 1000);

    // cooldown restore
    const cooldownStart = localStorage.getItem("otpCooldownStart");
    if (cooldownStart) {
      const start = Number(cooldownStart);

      // ❗ INVALID / CORRUPTED VALUE
      if (!start || isNaN(start)) {
        localStorage.removeItem("otpCooldownStart");
      } else {
        const elapsed = Math.floor((Date.now() - start) / 1000);

        // ❗ TOO OLD → RESET
        if (elapsed >= 60 || elapsed < 0) {
          localStorage.removeItem("otpCooldownStart");
          setResendCooldown(0);
        } else {
          setResendCooldown(60 - elapsed);
        }
      }
    }

    setTimeout(() => otpRef.current?.focus(), 100);

    return () => clearInterval(interval);
  }, [location.state]);

  /*
  ========================================
  🔐 VERIFY OTP
  ========================================
  */
  const handleVerifyOtp = async () => {
    setError("");
    setSuccess("");

    if (isExpired) {
      setError("OTP has expired.");
      return;
    }

    const challengeId = localStorage.getItem("pendingChallengeId");

    if (!challengeId) {
      setError("Session expired.");
      return;
    }

    try {
      const res = await fetch(`${SERVER_URL}/api/verifyOTP`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          challengeId,
          otp: enteredOtp,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        return setError(data.message || "Invalid OTP.");
      }

      setSuccess("OTP verified successfully!");

      // cleanup
      localStorage.removeItem("pendingChallengeId");
      localStorage.removeItem("pendingEmail");
      localStorage.removeItem("pendingExpiryAt");
      localStorage.removeItem("otpCooldownStart");

      setTimeout(() => {
        window.location.href = "/Dashboard";
      }, 400);
    } catch (err) {
      console.error(err);
      setError("Verification failed.");
    }
  };

  /*
  ========================================
  🔁 RESEND OTP
  ========================================
  */
  const handleResendOtp = async () => {
    if (resendCooldown > 0 || isResending) return;

    setIsResending(true);
    setError("");
    setSuccess("");

    const email = localStorage.getItem("pendingEmail");

    try {
      const res = await fetch(`${SERVER_URL}/api/sendOTP`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emailAddress: email }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        return setError(data.message || "Failed to resend OTP.");
      }

      // update new session
      localStorage.setItem("pendingChallengeId", data.challengeId);
      localStorage.setItem("pendingExpiryAt", data.expiresAt);
      localStorage.setItem("otpCooldownStart", Date.now());

      const expiryTime = new Date(data.expiresAt).getTime();
      setTimeLeft(Math.floor((expiryTime - Date.now()) / 1000));
      setIsExpired(false);

      setResendCooldown(60);
      setEnteredOtp("");
      setSuccess("New OTP sent.");
    } catch (err) {
      console.error(err);
      setError("Resend failed.");
    } finally {
      setIsResending(false);
    }
  };

  /*
  ========================================
  ⏳ COOLDOWN TIMER
  ========================================
  */
  useEffect(() => {
    if (resendCooldown <= 0) return;

    const interval = setInterval(() => {
      setResendCooldown((prev) => {
        if (prev <= 1) return 0;
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [resendCooldown]);

  /*
  ========================================
  UI
  ========================================
  */
  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-gradient-to-br from-[#061326] via-[#0b2c5f] to-[#3b63c4]">
      {/* Glow accents */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="w-72 h-72 bg-[#00a1c9]/20 rounded-full blur-3xl absolute -top-20 -left-16" />
        <div className="w-72 h-72 bg-[#00a1c9]/10 rounded-full blur-3xl absolute bottom-0 right-0" />
      </div>

      {/* Glass card */}
      <div className="relative w-full max-w-sm bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl px-8 py-9 shadow-2xl">
        <h2 className="text-2xl font-semibold text-white mb-2 text-center">
          Verify OTP
        </h2>

        <p className="text-sm text-white/80 text-center mb-6">
          Enter the one-time code sent to
          <br />
          <span className="font-medium">{emailAddress}</span>
        </p>

        {/* OTP INPUT (UNCHANGED STYLE) */}
        <input
          type="text"
          maxLength={6}
          value={enteredOtp}
          onChange={(e) => setEnteredOtp(e.target.value.replace(/\D/g, ""))}
          onKeyDown={(e) => e.key === "Enter" && handleVerifyOtp()}
          placeholder="● ● ● ● ● ●" // ✅ PRESERVED
          className="w-full bg-white/15 border border-white/30 rounded-lg px-3 py-3 text-center text-xl tracking-widest text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-[#00a1c9]"
        />

        {/* ERROR / SUCCESS */}
        {error && <p className="text-red-400 text-xs mt-3">{error}</p>}
        {success && <p className="text-green-400 text-xs mt-3">{success}</p>}

        {/* VERIFY BUTTON */}
        <button
          onClick={handleVerifyOtp}
          disabled={isExpired}
          className="w-full mt-6 py-2.5 rounded-lg text-sm font-medium text-white bg-[#00a1c9] hover:bg-[#0084a4] transition disabled:opacity-50"
        >
          Verify OTP
        </button>

        {/* ⏱ TIMER / RESEND (REPLACES STATIC TEXT) */}
        <div className="text-[11px] text-white/60 mt-6 text-center">
          {isExpired ? (
            resendCooldown > 0 ? (
              <span>
                Request new OTP in {Math.floor(resendCooldown / 60)}:
                {(resendCooldown % 60).toString().padStart(2, "0")}
              </span>
            ) : (
              <button
                onClick={handleResendOtp}
                disabled={isResending}
                className="underline hover:text-white"
              >
                {isResending ? "Resending..." : "Request new OTP"}
              </button>
            )
          ) : (
            <span className="text-yellow-300 text-sm font-medium">
              This OTP will expire in {Math.floor(timeLeft / 60)}:
              {(timeLeft % 60).toString().padStart(2, "0")}
            </span>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="absolute bottom-6 text-center text-[10px] text-white/70">
        <p>© 2025 CMX PH QA Portal v{APP_VERSION}</p>
        <p>DREAM Dev Ops || Callmax Solutions International</p>
      </div>
    </div>
  );
};

export default OtpVerification;
