const express = require("express");
const router = express.Router();
const db = require("../config/dbconfig");

//------------ Employee Lookup --------------
router.get("/employees", async (req, res) => {
  try {
    const [employees] = await db.query(
      `SELECT EMPLOYEEID AS employeeId, CONCAT(FIRSTNAME, " ", LASTNAME) AS employee_name, L1_MANAGER_ID as supervisorId, L1_MANAGER_NAME as supervisorName, ACCOUNT as account
       FROM 0001_cmx_appdata_employeeroster.db_cmxph_employee_roster
       WHERE FULLNAME IS NOT NULL
       AND EMPLOYEESTATUS NOT IN ('Terminated', 'Resigned', 'End of Contract')
       ORDER BY FULLNAME ASC`,
    );

    if (employees.length === 0) {
      return res.status(404).json({ message: "No active employees found" });
    }

    // console.log("✅ Active Employees Fetched:", employees.length);
    res.status(200).json(employees);
  } catch (error) {
    console.error("❌ Error fetching employees:", error);
    res.status(500).json({ message: "Database error", error });
  }
});

//--------------Account / LOB / TASK -------------------
//Accoount List
router.get("/accountList", async (req, res) => {
  const query = `
    SELECT ACCOUNTCODE, ACCOUNT, LOB, TASK
    FROM 1000_cmx_appdata_client_database.db_cmx_client_roster
     WHERE ID IN (
      SELECT MAX(ID) 
      FROM 1000_cmx_appdata_client_database.db_cmx_client_roster
      WHERE STATUS = 'Active' 
      GROUP BY ACCOUNTCODE
    )
    ORDER BY ID DESC;`;

  try {
    const [result] = await db.query(query);

    res.json(result);
  } catch (error) {
    console.error("Error fetching account list:", error);
    res.status(500).json({ error: "Database error" });
  }
});

//LOB List
router.get("/lobList", async (req, res) => {
  const { account } = req.query; // Get the selected ACCOUNT from query params

  const query = `
    SELECT DISTINCT LOB
    FROM 1000_cmx_appdata_client_database.db_cmx_client_roster
    WHERE ACCOUNT = ?
      AND ID IN (
        SELECT MAX(ID)
        FROM 1000_cmx_appdata_client_database.db_cmx_client_roster
        GROUP BY ACCOUNTCODE
      )
    ORDER BY LOB;`;

  try {
    const [result] = await db.query(query, [account]);
    res.json(result);
  } catch (error) {
    console.error("Error fetching LOB list:", error);
    res.status(500).json({ error: "Database error" });
  }
});

//Task List
router.get("/taskList", async (req, res) => {
  const { account, lob } = req.query;

  const query = `
    SELECT DISTINCT TASK
    FROM 1000_cmx_appdata_client_database.db_cmx_client_roster
    WHERE ACCOUNT = ? AND LOB = ?
      AND ID IN (
        SELECT MAX(ID)
        FROM 1000_cmx_appdata_client_database.db_cmx_client_roster
        GROUP BY ACCOUNTCODE
      )
    ORDER BY TASK;`;

  try {
    const [result] = await db.query(query, [account, lob]);
    res.json(result);
  } catch (error) {
    console.error("Error fetching Task list:", error);
    res.status(500).json({ error: "Database error" });
  }
});

router.get("/accountCode", async (req, res) => {
  const { account, lob, task } = req.query;

  const query = `
    SELECT ACCOUNTCODE
    FROM 1000_cmx_appdata_client_database.db_cmx_client_roster
    WHERE ACCOUNT = ? AND LOB = ? AND TASK = ?
      AND ID IN (
        SELECT MAX(ID)
        FROM 1000_cmx_appdata_client_database.db_cmx_client_roster
        GROUP BY ACCOUNTCODE
      );`;

  try {
    const [result] = await db.query(query, [account, lob, task]);

    if (result.length > 0) {
      res.json(result[0]); // Return the first matching record
    } else {
      res.status(404).json({ error: "ACCOUNTCODE not found" });
    }
  } catch (error) {
    console.error("Error fetching ACCOUNTCODE:", error);
    res.status(500).json({ error: "Database error" });
  }
});

module.exports = router;
