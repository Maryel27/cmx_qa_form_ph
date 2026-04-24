const express = require("express");
const router = express.Router();
const db = require("../config/dbconfig");
const bcrypt = require("bcrypt");
const nodemailer = require("nodemailer");
const crypto = require("crypto");

require("dotenv").config();

/*
========================================
⚙️ CONFIG
========================================
*/
const OTP_EXPIRY_MINUTES = 3;
const MAX_VERIFY_ATTEMPTS = 5;
const RESEND_COOLDOWN_SECONDS = 60;

/*
========================================
📧 EMAIL CONFIG
========================================
*/
const transporter = nodemailer.createTransport({
  host: "email-smtp.us-east-1.amazonaws.com",
  port: 587,
  secure: false,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
  tls: {
    rejectUnauthorized: false,
  },
});

/*
========================================
🧠 HELPERS
========================================
*/
function getClientIp(req) {
  const forwarded = req.headers["x-forwarded-for"];
  return forwarded ? forwarded.split(",")[0].trim() : req.ip;
}

function getUserAgent(req) {
  return req.headers["user-agent"] || null;
}

function generateFingerprint(req) {
  const ip = getClientIp(req) || "";
  const ua = getUserAgent(req) || "";
  const deviceId = req.headers["x-device-id"] || "unknown";
  const raw = `${ip}|${ua}|${deviceId}`;
  return crypto.createHash("sha256").update(raw).digest("hex");
}

function buildUser(user) {
  return {
    empId: user.empId,
    userid: user.user_email,
    userEmail: user.user_email,
    firstName: user.user_first_name,
    lastName: user.user_last_name,
    fullName: user.user_full_name,
    userLevel: user.user_access_level,
    userStatus: user.user_status,
  };
}

/*
========================================
📝 AUDIT LOG
⚠️ Adjust table name if needed
========================================
*/
async function writeAuditLog({
  email = null,
  eventType = null,
  status = null,
  ipAddress = null,
  userAgent = null,
  details = null,
}) {
  try {
    await db.execute(
      `INSERT INTO 0005_cmx_auth_handler_qaportal_ph.auth_audit_log_qaportal_ph
       (email, event_type, status, ip_address, user_agent, details)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        email ?? null,
        eventType ?? null,
        status ?? null,
        ipAddress ?? null,
        userAgent ?? null,
        details ?? null,
      ],
    );
  } catch (err) {
    console.error("Audit log error:", err.message);
  }
}

/*
========================================
📧 NEW DEVICE EMAIL
========================================
*/
async function sendNewDeviceAlert({ toEmail, name, ip, userAgent }) {
  const now = new Date().toLocaleString();

  const html = `
    <p>Hi ${name || "User"},</p>

    <p>We detected a login to your <strong>QA Portal</strong> account from a <strong>new device</strong>.</p>

    <p><strong>Details:</strong></p>
    <ul>
      <li><strong>IP Address:</strong> ${ip}</li>
      <li><strong>Device/Browser:</strong> ${userAgent}</li>
      <li><strong>Time:</strong> ${now}</li>
    </ul>

    <p>If this was <strong>not you</strong>, please report it to dream-devops@callmaxsolutions.com.</p>

    <br/>
    <p>— Callmax DREAM-DEVOPS Team</p>
  `;

  await transporter.sendMail({
    to: toEmail,
    from: "Callmax Solutions - Security Alert <noreply@callmaxsolutions.com>",
    subject: "⚠️ New QA Portal Login Detected",
    html,
  });
}

/*
========================================
✅ CHECK EMAIL
========================================
*/
router.post("/check-email", async (req, res) => {
  const { email } = req.body;
  const ip = getClientIp(req);
  const ua = getUserAgent(req);

  if (!email) {
    return res.status(400).json({
      success: false,
      error: "Email is required",
    });
  }

  try {
    const [rows] = await db.execute(
      `SELECT empId, user_email, user_last_name, user_first_name, user_full_name, user_access_level, user_status
       FROM 0000_cmx_appdata_appusers.db_cmx_appusers_qaportal_ph
       WHERE user_email = ?`,
      [email],
    );

    if (!rows.length || rows[0].user_status !== "Active") {
      await writeAuditLog({
        email,
        eventType: "CHECK_EMAIL",
        status: "DENIED",
        ipAddress: ip,
        userAgent: ua,
        details: "Invalid user or inactive user",
      });

      return res.status(403).json({
        success: false,
        error: "User not allowed",
      });
    }

    await writeAuditLog({
      email,
      eventType: "CHECK_EMAIL",
      status: "SUCCESS",
      ipAddress: ip,
      userAgent: ua,
    });

    return res.json({
      success: true,
      user: buildUser(rows[0]),
    });
  } catch (err) {
    console.error("Email check DB error:", err);
    await writeAuditLog({
      email,
      eventType: "CHECK_EMAIL",
      status: "ERROR",
      ipAddress: ip,
      userAgent: ua,
      details: err.message,
    });

    return res.status(500).json({
      success: false,
      error: "Server error",
    });
  }
});
/*
========================================
🔐 SEND OTP (QA PORTAL - UPDATED EMAIL TEMPLATE)
========================================
*/
router.post("/sendOTP", async (req, res) => {
  const { emailAddress } = req.body;
  const ip = getClientIp(req);
  const ua = getUserAgent(req);

  if (!emailAddress) {
    return res.status(400).json({
      success: false,
      message: "Email is required.",
    });
  }

  try {
    const [userRows] = await db.execute(
      `SELECT user_email, user_first_name, user_status
       FROM 0000_cmx_appdata_appusers.db_cmx_appusers_qaportal_ph
       WHERE user_email = ?`,
      [emailAddress],
    );

    if (!userRows.length || userRows[0].user_status !== "Active") {
      await writeAuditLog({
        email: emailAddress,
        eventType: "SEND_OTP",
        status: "DENIED",
        ipAddress: ip,
        userAgent: ua,
        details: "User not found or inactive",
      });

      return res.status(400).json({
        success: false,
        message: "User not allowed.",
      });
    }

    const user = userRows[0];
    const firstName = user.user_first_name || "User";

    /*
    ========================================
    ⏱ COOLDOWN CHECK
    ========================================
    */
    const [recentRows] = await db.execute(
      `SELECT created_at
       FROM 0005_cmx_auth_handler_qaportal_ph.auth_otp_challenges_qaportal_ph
       WHERE email = ?
         AND status = 'pending'
       ORDER BY created_at DESC
       LIMIT 1`,
      [emailAddress],
    );

    if (recentRows.length) {
      const lastCreated = new Date(recentRows[0].created_at).getTime();
      const diffSeconds = Math.floor((Date.now() - lastCreated) / 1000);

      if (diffSeconds < RESEND_COOLDOWN_SECONDS) {
        return res.status(429).json({
          success: false,
          message: `Please wait ${
            RESEND_COOLDOWN_SECONDS - diffSeconds
          } seconds before requesting a new OTP.`,
        });
      }
    }

    /*
    ========================================
    ♻️ EXPIRE OLD OTPs
    ========================================
    */
    await db.execute(
      `UPDATE 0005_cmx_auth_handler_qaportal_ph.auth_otp_challenges_qaportal_ph
       SET status = 'expired'
       WHERE email = ? AND status = 'pending'`,
      [emailAddress],
    );

    /*
    ========================================
    🔐 GENERATE OTP
    ========================================
    */
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpHash = await bcrypt.hash(otp, 10);
    const challengeId = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60000);

    /*
    ========================================
    💾 SAVE OTP
    ========================================
    */
    await db.execute(
      `INSERT INTO 0005_cmx_auth_handler_qaportal_ph.auth_otp_challenges_qaportal_ph
       (
         challenge_id,
         email,
         otp_hash,
         status,
         attempt_count,
         max_attempts,
         requested_ip,
         requested_user_agent,
         expires_at
       )
       VALUES (?, ?, ?, 'pending', 0, ?, ?, ?, ?)`,
      [
        challengeId,
        emailAddress,
        otpHash,
        MAX_VERIFY_ATTEMPTS,
        ip,
        ua,
        expiresAt,
      ],
    );

    /*
    ========================================
    📧 SEND EMAIL (CMS STYLE TEMPLATE)
    ========================================
    */
    await transporter.sendMail({
      to: emailAddress,
      from: "Callmax Solutions <noreply@callmaxsolutions.com>",
      subject: "Your One-Time Password (OTP)",
      html: `
      <div style="font-family: Arial, sans-serif; background:#f4f6f8; padding:20px;">
        
        <div style="max-width:520px; margin:auto; background:#ffffff; border-radius:8px; overflow:hidden;">
          
          <!-- HEADER -->
          <div style="background:#0f4c5c; color:#ffffff; padding:14px; text-align:center; font-weight:bold;">
            Callmax QA Portal PH
          </div>

          <!-- BODY -->
          <div style="padding:25px; text-align:center; color:#333;">
            
            <p style="text-align:left;">Hi ${firstName},</p>

            <p>Use the code below to complete your sign-in:</p>

            <div style="font-size:32px; letter-spacing:6px; font-weight:bold; margin:20px 0; color:#000;">
              ${otp}
            </div>

            <p style="font-size:14px; color:#555;">
              This code will expire in <strong>${OTP_EXPIRY_MINUTES} minutes</strong>.
            </p>

            <p style="font-size:13px; color:#777; margin-top:15px;">
              If you did not request this code and suspect invalid use, report instance to:
            </p>

            <p style="font-size:13px; margin-top:5px;">
              <a href="mailto:dream-devops@callmaxsolutions.com" style="color:#0f4c5c; text-decoration:none;">
                dream-devops@callmaxsolutions.com
              </a>
            </p>

          </div>

          <!-- FOOTER -->
          <div style="padding:18px; background:#fafafa; font-size:12px; color:#555; text-align:center;">
            
            <p style="margin-bottom:8px;">
              Unauthorized use of this system is subject to applicable cybersecurity laws.
            </p>

            <hr style="border:none; border-top:1px solid #ddd; margin:12px 0;" />

            <p style="margin:4px 0;">
              <strong>Powered by Callmax DREAM-DevOps</strong>
            </p>
            <p style="margin:4px 0;">
              Callmax Solutions International Inc
            </p>
            <p style="margin:4px 0;">
              <a href="https://www.callmaxsolutions.com" target="_blank" style="color:#0f4c5c;">
                www.callmaxsolutions.com
              </a>
            </p>

          </div>

        </div>

      </div>
      `,
    });

    /*
    ========================================
    📝 AUDIT LOG
    ========================================
    */
    await writeAuditLog({
      email: emailAddress,
      eventType: "SEND_OTP",
      status: "SUCCESS",
      ipAddress: ip,
      userAgent: ua,
    });

    /*
    ========================================
    ✅ RESPONSE
    ========================================
    */
    return res.json({
      success: true,
      challengeId,
      expiresAt,
    });
  } catch (err) {
    console.error("SEND OTP error:", err);

    await writeAuditLog({
      email: emailAddress,
      eventType: "SEND_OTP",
      status: "ERROR",
      ipAddress: ip,
      userAgent: ua,
      details: err.message,
    });

    return res.status(500).json({
      success: false,
      message: "Failed to send OTP.",
    });
  }
});
/*
========================================
🔓 VERIFY OTP (QA PORTAL - FINAL)
========================================
*/
router.post("/verifyOTP", async (req, res) => {
  console.log("🚀 VERIFY OTP HIT (QA)");

  const { challengeId, otp } = req.body;
  const ip = getClientIp(req);
  const ua = getUserAgent(req);

  if (!challengeId || !otp) {
    return res.status(400).json({
      success: false,
      message: "Missing OTP or session.",
    });
  }

  try {
    /*
    ========================================
    🔍 GET OTP CHALLENGE
    ========================================
    */
    const [rows] = await db.execute(
      `SELECT *
       FROM 0005_cmx_auth_handler_qaportal_ph.auth_otp_challenges_qaportal_ph
       WHERE challenge_id = ?`,
      [challengeId],
    );

    if (!rows.length) {
      return res.status(400).json({
        success: false,
        message: "Invalid OTP session.",
      });
    }

    const c = rows[0];

    /*
    ========================================
    ❌ INVALID STATUS
    ========================================
    */
    if (c.status !== "pending") {
      return res.status(400).json({
        success: false,
        message: "OTP session is no longer valid.",
      });
    }

    /*
    ========================================
    ⏱ EXPIRED
    ========================================
    */
    if (new Date() > new Date(c.expires_at)) {
      await db.execute(
        `UPDATE 0005_cmx_auth_handler_qaportal_ph.auth_otp_challenges_qaportal_ph
         SET status='expired'
         WHERE challenge_id=?`,
        [challengeId],
      );

      await writeAuditLog({
        email: c.email,
        eventType: "VERIFY_OTP",
        status: "EXPIRED",
        ipAddress: ip,
        userAgent: ua,
        details: "OTP expired",
      });

      return res.status(400).json({
        success: false,
        message: "OTP expired.",
      });
    }

    /*
    ========================================
    🔒 MAX ATTEMPTS
    ========================================
    */
    if (c.attempt_count >= c.max_attempts) {
      await writeAuditLog({
        email: c.email,
        eventType: "VERIFY_OTP",
        status: "LOCKED",
        ipAddress: ip,
        userAgent: ua,
        details: "Maximum attempts reached",
      });

      return res.status(429).json({
        success: false,
        message: "Too many invalid attempts. Please request a new OTP.",
      });
    }

    /*
    ========================================
    🔐 COMPARE OTP
    ========================================
    */
    const match = await bcrypt.compare(String(otp).trim(), c.otp_hash);

    if (!match) {
      const newCount = c.attempt_count + 1;

      await db.execute(
        `UPDATE 0005_cmx_auth_handler_qaportal_ph.auth_otp_challenges_qaportal_ph
         SET attempt_count=?, status=?
         WHERE challenge_id=?`,
        [
          newCount,
          newCount >= c.max_attempts ? "locked" : "pending",
          challengeId,
        ],
      );

      await writeAuditLog({
        email: c.email,
        eventType: "VERIFY_OTP",
        status: "FAILED",
        ipAddress: ip,
        userAgent: ua,
        details: `Invalid OTP attempt ${newCount}`,
      });

      return res.status(newCount >= c.max_attempts ? 429 : 401).json({
        success: false,
        message:
          newCount >= c.max_attempts
            ? "Too many invalid attempts. Please request a new OTP."
            : "Invalid OTP.",
      });
    }

    /*
    ========================================
    ✅ MARK VERIFIED
    ========================================
    */
    await db.execute(
      `UPDATE 0005_cmx_auth_handler_qaportal_ph.auth_otp_challenges_qaportal_ph
       SET status='verified',
           verified_ip=?,
           verified_user_agent=?,
           verified_at=NOW()
       WHERE challenge_id=?`,
      [ip, ua, challengeId],
    );

    /*
    ========================================
    👤 FETCH USER
    ========================================
    */
    const [userRows] = await db.execute(
      `SELECT *
       FROM 0000_cmx_appdata_appusers.db_cmx_appusers_qaportal_ph
       WHERE user_email=?`,
      [c.email],
    );

    if (!userRows.length || userRows[0].user_status !== "Active") {
      await writeAuditLog({
        email: c.email,
        eventType: "VERIFY_OTP",
        status: "DENIED",
        ipAddress: ip,
        userAgent: ua,
        details: "User not found or inactive",
      });

      return res.status(403).json({
        success: false,
        message: "User not allowed.",
      });
    }

    const sessionUser = buildUser(userRows[0]);

    /*
    ========================================
    🔐 DEVICE CHECK
    ========================================
    */
    const fingerprint = generateFingerprint(req);

    const [devices] = await db.execute(
      `SELECT id
       FROM 0005_cmx_auth_handler_qaportal_ph.auth_user_devices
       WHERE user_email=? AND fingerprint=?`,
      [c.email, fingerprint],
    );

    if (!devices.length) {
      await db.execute(
        `INSERT INTO 0005_cmx_auth_handler_qaportal_ph.auth_user_devices
        (user_email, fingerprint, ip_address, user_agent, is_trusted)
        VALUES (?, ?, ?, ?, ?)`,
        [c.email, fingerprint, ip, ua, 0],
      );

      await writeAuditLog({
        email: c.email,
        eventType: "NEW_DEVICE",
        status: "WARNING",
        ipAddress: ip,
        userAgent: ua,
        details: "New device detected",
      });

      await sendNewDeviceAlert({
        toEmail: c.email,
        name: userRows[0].user_first_name,
        ip,
        userAgent: ua,
      });
    } else {
      await db.execute(
        `UPDATE 0005_cmx_auth_handler_qaportal_ph.auth_user_devices
         SET last_used=NOW(),
             ip_address=?,
             user_agent=?
         WHERE id=?`,
        [ip, ua, devices[0].id],
      );
    }

    /*
    ========================================
    🔐 CREATE SESSION (CRITICAL)
    ========================================
    */
    return req.session.regenerate((err) => {
      if (err) {
        console.error("Session regenerate error:", err);
        return res.status(500).json({
          success: false,
          message: "Session error",
        });
      }

      req.session.user = sessionUser;
      req.session.authenticated = true;

      req.session.save(async (err) => {
        if (err) {
          console.error("Session save error:", err);

          await writeAuditLog({
            email: c.email,
            eventType: "VERIFY_OTP",
            status: "ERROR",
            ipAddress: ip,
            userAgent: ua,
            details: "Session save failed",
          });

          return res.status(500).json({
            success: false,
            message: "Session could not be saved",
          });
        }

        await writeAuditLog({
          email: c.email,
          eventType: "VERIFY_OTP",
          status: "SUCCESS",
          ipAddress: ip,
          userAgent: ua,
          details: "OTP verified and session created",
        });

        return res.json({
          success: true,
          user: sessionUser,
        });
      });
    });
  } catch (err) {
    console.error("VERIFY OTP error:", err);

    await writeAuditLog({
      email: null,
      eventType: "VERIFY_OTP",
      status: "ERROR",
      ipAddress: ip,
      userAgent: ua,
      details: err.message,
    });

    return res.status(500).json({
      success: false,
      message: "OTP verification failed.",
    });
  }
});

/*
========================================
➕ ADD USERS
========================================
*/
router.post("/addAppUser", async (req, res) => {
  const {
    empId,
    user_email,
    user_first_name,
    user_last_name,
    user_access_level,
  } = req.body;

  const user_full_name = `${user_first_name} ${user_last_name}`;
  const user_status = "Active";

  try {
    const sql = `
      INSERT INTO 0000_cmx_appdata_appusers.db_cmx_appusers_qaportal_ph
      (
        empId,
        user_email,
        user_last_name,
        user_first_name,
        user_full_name,
        user_access_level,
        user_status,
        user_registration_date
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, CURDATE())
    `;

    await db.execute(sql, [
      empId,
      user_email,
      user_last_name,
      user_first_name,
      user_full_name,
      user_access_level,
      user_status,
    ]);

    return res.json({ success: true });
  } catch (err) {
    console.error("Add user error:", err);
    return res.status(500).json({
      success: false,
      error: err.message,
    });
  }
});

/*
========================================
✏️ UPDATE USER
========================================
*/
router.post("/updateAppUser", async (req, res) => {
  const { empId, user_access_level, user_status } = req.body;

  if (!empId || !user_access_level || !user_status) {
    return res.status(400).json({
      success: false,
      error: "Missing required fields",
    });
  }

  try {
    const sql = `
      UPDATE 0000_cmx_appdata_appusers.db_cmx_appusers_qaportal_ph
      SET
        user_access_level = ?,
        user_status = ?
      WHERE empId = ?
    `;

    const [result] = await db.execute(sql, [
      user_access_level,
      user_status,
      empId,
    ]);

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        error: "User not found",
      });
    }

    return res.json({
      success: true,
      message: "User updated successfully",
    });
  } catch (err) {
    console.error("Update user error:", err);
    return res.status(500).json({
      success: false,
      error: err.message,
    });
  }
});
/*
========================================
📦 SESSION (QA PORTAL)
========================================
*/
router.get("/session", (req, res) => {
  // 🔥 Explicit check (more reliable)
  if (!req.session || !req.session.user || !req.session.authenticated) {
    return res.status(401).json({
      success: false,
      message: "No active session",
    });
  }

  return res.json({
    success: true,
    user: req.session.user,
  });
});

/*
========================================
🔓 LOGOUT (QA PORTAL)
========================================
*/
router.post("/logout", async (req, res) => {
  const email = req.session?.user?.userEmail || null;
  const ip = getClientIp(req);
  const ua = getUserAgent(req);

  try {
    req.session.destroy(async (err) => {
      if (err) {
        console.error("Logout error:", err);

        return res.status(500).json({
          success: false,
          message: "Logout failed",
        });
      }

      // 🔥 IMPORTANT: match EXACT session name
      res.clearCookie(process.env.SESSION_NAME || "cmx_qa_session", {
        httpOnly: true,
        sameSite: "lax",
      });

      await writeAuditLog({
        email,
        eventType: "LOGOUT",
        status: "SUCCESS",
        ipAddress: ip,
        userAgent: ua,
        details: "User logged out",
      });

      return res.json({
        success: true,
        message: "Logged out successfully",
      });
    });
  } catch (err) {
    console.error("Logout catch error:", err);

    return res.status(500).json({
      success: false,
      message: "Unexpected logout error",
    });
  }
});

module.exports = router;
