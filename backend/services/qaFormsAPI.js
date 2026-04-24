const express = require("express");
const router = express.Router();
const db = require("../config/dbconfig");

router.get("/qa_form_list", async (req, res) => {
  try {
    const sqlQuery = `
      SELECT 
        fl.QA_FORM_NAME,
        fl.ACCOUNT,
        fl.LOB,
        fl.TASK,
        fl.CREATED_DATE,
        fl.CREATED_BY,
        fl.STATUS,
        ft.*
      FROM 1003_cmx_appdata_qaportal_database_ph.db_qa_forms_list AS fl
      LEFT JOIN 1003_cmx_appdata_qaportal_database_ph.db_qa_forms_table AS ft ON ft.QA_FORM_NAME = fl.QA_FORM_NAME
      WHERE fl.SITE = "PH" and fl.STATUS = "Active"
    `;

    const [rows] = await db.query(sqlQuery);
    res.status(200).json(rows);
  } catch (error) {
    console.error("❌ Error fetching QA form list:", error);
    res.status(500).json({ message: "Database error", error });
  }
});

// Catalog
router.get("/qa_form_list_catalog", async (req, res) => {
  try {
    const sqlQuery = `
      SELECT 
        fl.QA_FORM_NAME,
        fl.ACCOUNT,
        fl.LOB,
        fl.TASK,
        fl.CREATED_DATE,
        fl.CREATED_BY,
        fl.STATUS,
        ft.*
      FROM 1003_cmx_appdata_qaportal_database_ph.db_qa_forms_list AS fl
      LEFT JOIN 1003_cmx_appdata_qaportal_database_ph.db_qa_forms_table AS ft ON ft.QA_FORM_NAME = fl.QA_FORM_NAME
      WHERE fl.SITE = "PH"
    `;

    const [rows] = await db.query(sqlQuery);
    res.status(200).json(rows);
  } catch (error) {
    console.error("❌ Error fetching QA form list:", error);
    res.status(500).json({ message: "Database error", error });
  }
});

// get QA Form by Name
router.get("/qa_form_by_name/:qaFormName", async (req, res) => {
  const formName = decodeURIComponent(req.params.qaFormName);

  try {
    const sqlQuery = `
        SELECT 
          fl.QA_FORM_NAME,
          fl.ACCOUNT,
          fl.LOB,
          fl.TASK,
          fl.CREATED_DATE,
          fl.CREATED_BY,
          fl.STATUS,
          ft.*
        FROM 1003_cmx_appdata_qaportal_database_ph.db_qa_forms_list AS fl
        LEFT JOIN 1003_cmx_appdata_qaportal_database_ph.db_qa_forms_table AS ft 
          ON ft.QA_FORM_NAME = fl.QA_FORM_NAME
        WHERE fl.QA_FORM_NAME = ?
      `;

    const [rows] = await db.query(sqlQuery, [formName]);

    if (rows.length === 0) {
      return res.status(404).json({ message: "Form not found" });
    }

    const formHeader = {
      QA_FORM_NAME: rows[0].QA_FORM_NAME,
      ACCOUNT: rows[0].ACCOUNT,
      LOB: rows[0].LOB,
      TASK: rows[0].TASK,
      CREATED_DATE: rows[0].CREATED_DATE,
      CREATED_BY: rows[0].CREATED_BY,
      STATUS: rows[0].STATUS,
    };

    const formDetails = {};
    rows.forEach((row) => {
      Object.keys(row).forEach((key) => {
        if (!(key in formHeader)) {
          formDetails[key] = row[key];
        }
      });
    });

    res.status(200).json({ header: formHeader, details: formDetails });
  } catch (error) {
    console.error("❌ Error fetching form by name:", error);
    res.status(500).json({ message: "Database error", error });
  }
});

//QA Form Designer
//Designer
router.post("/qa_forms_list", async (req, res) => {
  try {
    const {
      QA_FORM_NAME,
      ACCOUNT,
      LOB,
      TASK,
      CREATED_DATE,
      CREATED_BY,
      STATUS,
    } = req.body;

    const sql = `
      INSERT INTO 1003_cmx_appdata_qaportal_database_ph.db_qa_forms_list
      (QA_FORM_NAME, ACCOUNT, LOB, TASK, CREATED_DATE, CREATED_BY, STATUS)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `;

    await db.execute(sql, [
      QA_FORM_NAME,
      ACCOUNT,
      LOB,
      TASK,
      CREATED_DATE,
      CREATED_BY,
      STATUS,
    ]);

    res.status(200).send({ message: "Form list inserted." });
  } catch (err) {
    console.error("Insert failed:", err);
    res.status(500).send({ error: "Insert failed" });
  }
});

router.post("/qa_forms_table", async (req, res) => {
  try {
    const data = req.body;

    if (!data.QA_FORM_NAME) {
      return res.status(400).json({ error: "Missing QA_FORM_NAME." });
    }

    const columns = Object.keys(data)
      .map((col) => `\`${col}\``)
      .join(", ");
    const placeholders = Object.keys(data)
      .map(() => "?")
      .join(", ");
    const values = Object.values(data);

    const sql = `
      INSERT INTO 1003_cmx_appdata_qaportal_database_ph.db_qa_forms_table
      (${columns})
      VALUES (${placeholders})
    `;

    await db.execute(sql, values);

    res.status(200).json({ message: "QA Form saved to db_qa_forms_table." });
  } catch (err) {
    console.error("❌ Error saving QA form:", err);
    res.status(500).json({ error: "Insert failed", details: err.message });
  }
});

router.put("qa_form_list/:qaFormName/status", async (req, res) => {
  const { qaFormName } = req.params;
  const { status } = req.body;

  if (!["Active", "Disabled"].includes(status)) {
    return res.status(400).json({ message: "Invalid status value" });
  }

  try {
    const [result] = await db.query(
      `UPDATE 1003_cmx_appdata_qaportal_database_ph.db_qa_forms_list SET STATUS = ? WHERE QA_FORM_NAME = ?`,
      [status, qaFormName],
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Form not found" });
    }

    // console.log(`✅ QA Form "${qaFormName}" updated to STATUS: ${status}`);
    res.status(200).json({ message: "Form status updated" });
  } catch (error) {
    console.error("❌ Error updating status:", error);
    res.status(500).json({ message: "Server error", error });
  }
});

module.exports = router;
