// src/service/UserService.js
import { SERVER_URL } from "../components/lib/constants";

class UserService {
  static BASE_URL = SERVER_URL;

  /*
  ========================================
  🔐 AUTH CHECK (WITH 12-HOUR EXPIRY)
  ========================================
  */
  static isAuthenticated() {
    const userId = localStorage.getItem("userId");
    const sessionVerified = localStorage.getItem("sessionVerified");
    const loginTime = localStorage.getItem("loginTime");

    if (!userId || sessionVerified !== "1" || !loginTime) {
      return false;
    }

    const now = new Date().getTime();
    const twelveHours = 12 * 60 * 60 * 1000;

    // ⛔ Expired session
    if (now - Number(loginTime) > twelveHours) {
      this.logout();
      return false;
    }

    return true;
  }

  /*
  ========================================
  🟡 PENDING USER (OTP FLOW)
  ========================================
  */
  static setPendingUser(user) {
    if (user) {
      localStorage.setItem("pendingUser", JSON.stringify(user));
    }
  }

  static getPendingUser() {
    const raw = localStorage.getItem("pendingUser");
    try {
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  static clearPendingUser() {
    localStorage.removeItem("pendingUser");
    localStorage.removeItem("pendingChallengeId");
    localStorage.removeItem("pendingEmail");
    localStorage.removeItem("pendingExpiryAt");
  }

  /*
  ========================================
  🔓 LOGIN (SAVE USER)
  ========================================
  */
  static loginUser({
    empId,
    userId,
    email,
    firstname = "",
    lastname = "",
    userLevel = "",
    userStatus = "",
  }) {
    const finalId = userId || (email ? `manual_${email}` : undefined);

    if (!finalId) {
      console.warn("loginUser called without a valid userId/email");
    }

    localStorage.setItem("empId", empId || "");
    localStorage.setItem("userId", finalId || "");
    localStorage.setItem("userEmail", email || "");
    localStorage.setItem("userFirstname", firstname || "");
    localStorage.setItem("userLastname", lastname || "");

    // ✅ Access + status
    localStorage.setItem("user_access_level", userLevel || "");
    localStorage.setItem("user_status", userStatus || "");

    // ✅ Session flag
    localStorage.setItem("sessionVerified", "1");

    // ✅ Login timestamp (for expiry)
    localStorage.setItem("loginTime", new Date().getTime());

    this.clearPendingUser();

    return finalId;
  }

  /*
  ========================================
  👤 GET CURRENT USER
  ========================================
  */
  static getCurrentUser() {
    const empId = localStorage.getItem("empId");
    const userId = localStorage.getItem("userId");
    const email = localStorage.getItem("userEmail");
    const firstname = localStorage.getItem("userFirstname");
    const lastname = localStorage.getItem("userLastname");
    const user_access_level = localStorage.getItem("user_access_level") || "";
    const user_status = localStorage.getItem("user_status") || "";

    return {
      empId,
      userId,
      email,
      firstname,
      lastname,
      user_access_level,
      user_status,
    };
  }

  /*
  ========================================
  🚪 LOGOUT
  ========================================
  */
  static logout() {
    localStorage.removeItem("empId");
    localStorage.removeItem("userId");
    localStorage.removeItem("sessionVerified");
    localStorage.removeItem("loginTime");

    localStorage.removeItem("userEmail");
    localStorage.removeItem("userFirstname");
    localStorage.removeItem("userLastname");

    localStorage.removeItem("user_access_level");
    localStorage.removeItem("user_status");

    this.clearPendingUser();
  }

  /*
  ========================================
  🔐 ROLE HELPERS
  ========================================
  */
  static user_access_level() {
    return localStorage.getItem("user_access_level") || "";
  }

  static getQARole() {
    const role = this.user_access_level();
    return ["QA", "Team Lead", "Manager"].includes(role);
  }

  static getQAAdminRole() {
    const role = this.user_access_level();
    return ["QA Admin", "Dev", "Super Admin"].includes(role);
  }

  static getSuperAdminRole() {
    const role = this.user_access_level();
    return ["Super Admin"].includes(role);
  }
}

export default UserService;
