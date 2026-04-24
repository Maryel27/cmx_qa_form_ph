const express = require("express");
const router = express.Router();
const db = require("../config/dbconfig");

router.get("/getAppUsers", async (req, res) => {
  const [rows] = await db.execute(`
    SELECT * FROM 0000_cmx_appdata_appusers.db_cmx_appusers_qaportal_ph
  `);

  res.json({ success: true, data: rows });
});

router.post("/addAppUser", async (req, res) => {
  const {
    empId,
    user_email,
    user_first_name,
    user_last_name,
    user_access_level,
  } = req.body;

  const sql = `
    INSERT INTO 0000_cmx_appdata_appusers.db_cmx_appusers_qaportal_ph
    (empId, user_email, user_last_name, user_first_name, user_full_name, user_access_level, user_status, user_registration_date)
    VALUES (?, ?, ?, ?, ?, ?, 'Active', CURDATE())
  `;

  await db.execute(sql, [
    empId,
    user_email,
    user_last_name,
    user_first_name,
    `${user_first_name} ${user_last_name}`,
    user_access_level,
  ]);

  res.json({ success: true });
});

module.exports = router;
