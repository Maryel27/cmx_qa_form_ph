const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const AWS = require("aws-sdk");
const session = require("express-session");

// 🔴 REDIS
const { createClient } = require("redis");
const { RedisStore: SessionStore } = require("connect-redis");
const { RedisStore: RateLimitRedisStore } = require("rate-limit-redis");

// 🔐 SECURITY
const helmet = require("helmet");
const { rateLimit, ipKeyGenerator } = require("express-rate-limit");

dotenv.config();

/*
========================================
🔥 GLOBAL ERROR HANDLERS
========================================
*/
process.on("uncaughtException", (err) => {
  console.error("🔥 UNCAUGHT EXCEPTION:", err);
});

process.on("unhandledRejection", (err) => {
  console.error("🔥 UNHANDLED REJECTION:", err);
});

/*
========================================
🌐 AWS CONFIG
========================================
*/
AWS.config.update({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION,
});

/*
========================================
🚀 APP INIT
========================================
*/
const app = express();
app.set("trust proxy", 1);
const PORT = process.env.SERVER_PORT || 5010;

/*
========================================
🔐 SECURITY
========================================
*/
app.use(helmet());

/*
========================================
🌐 CORS
========================================
*/
app.use(
  cors({
    origin: ["http://localhost:3001", "https://qaportal.cmxph.com"],
    credentials: true,
  }),
);

/*
========================================
🔥 BODY PARSER
========================================
*/
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

/*
========================================
🔴 REDIS CLIENT
========================================
*/
const redisClient = createClient({
  socket: {
    host: process.env.REDIS_HOST || "127.0.0.1",
    port: Number(process.env.REDIS_PORT) || 6379,
  },
});

redisClient.on("error", (err) => {
  console.error("❌ Redis Error:", err);
});

/*
========================================
🔐 SESSION CHECK MIDDLEWARE
========================================
*/
function requireSession(req, res, next) {
  if (!req.session?.user) {
    return res.status(401).json({
      success: false,
      message: "Session expired",
    });
  }
  next();
}

/*
========================================
🚀 START SERVER
========================================
*/
async function startServer() {
  try {
    await redisClient.connect();
    console.log("✅ Redis connected");

    /*
    ========================================
    🧠 SESSION
    ========================================
    */
    const redisStore = new SessionStore({
      client: redisClient,
      prefix: "cmxqa:",
    });

    app.use(
      session({
        name: process.env.SESSION_NAME || "cmx_qa_session",
        store: redisStore,
        secret: process.env.SESSION_SECRET,
        resave: false,
        saveUninitialized: false,
        cookie: {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: "lax",
          maxAge: 1000 * 60 * 60 * 8,
        },
      }),
    );

    /*
    ========================================
    🔥 RATE LIMITERS
    ========================================
    */

    // OTP limiter
    const otpLimiter = rateLimit({
      store: new RateLimitRedisStore({
        sendCommand: (...args) => redisClient.sendCommand(args),
        prefix: "otp:",
      }),
      windowMs: 10 * 60 * 1000,
      max: 5,
      standardHeaders: true,
      legacyHeaders: false,
      keyGenerator: (req) =>
        `${req.body?.emailAddress || "noemail"}_${ipKeyGenerator(req.ip)}`,
    });

    // General limiter
    const generalLimiter = rateLimit({
      store: new RateLimitRedisStore({
        sendCommand: (...args) => redisClient.sendCommand(args),
        prefix: "general:",
      }),
      windowMs: 5 * 60 * 1000,
      max: 150,
      standardHeaders: true,
      legacyHeaders: false,
      keyGenerator: (req) =>
        req.session?.user?.userid || ipKeyGenerator(req.ip),
    });

    /*
    ========================================
    📦 ROUTES
    ========================================
    */

    const authAPI = require("./services/authAPI");
    const qaUsersAPI = require("./services/qaUsersAPI");
    const qaAuditAPI = require("./services/qaAuditAPI");
    const qaFormsAPI = require("./services/qaFormsAPI");
    const qaLookupAPI = require("./services/qaLookupAPI");

    // OTP limiter only for OTP route
    app.use("/api/sendOTP", otpLimiter);

    // General limiter for everything else
    app.use("/api", generalLimiter);

    // 🔓 PUBLIC ROUTES (NO SESSION)
    app.use("/api", authAPI);

    // 🔒 PROTECTED ROUTES (SESSION REQUIRED)
    app.use("/api", requireSession, qaUsersAPI);
    app.use("/api", requireSession, qaAuditAPI);
    app.use("/api", requireSession, qaFormsAPI);
    app.use("/api", requireSession, qaLookupAPI);

    /*
    ========================================
    ❤️ HEALTH CHECK
    ========================================
    */
    app.get("/", (req, res) => {
      res.send("QA Portal API running 🚀");
    });

    /*
    ========================================
    🚀 START
    ========================================
    */
    app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
    });
  } catch (err) {
    console.error("❌ Failed to start server:", err);
    process.exit(1);
  }
}

startServer();
