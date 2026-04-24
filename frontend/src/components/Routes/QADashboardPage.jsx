// src/components/Routes/QADashboardPage.jsx
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import AppHeader from "../common/AppHeader";
import axios from "axios";
import { SERVER_URL } from "../lib/constants";
import UserService from "../../service/UserService";
import DatePicker from "react-datepicker";
import AuditViewModal from "../Routes/AuditViewModal";
import "react-datepicker/dist/react-datepicker.css";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";

const QADashboardPage = ({ user }) => {
  const navigate = useNavigate();
  const [audits, setAudits] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [loading, setLoading] = useState(true);
  const [userName, setUserName] = useState([]);
  const [userId, setUserId] = useState([]);
  const [empId, setEmpId] = useState([]);
  const [search, setSearch] = useState("");
  const [showOnlyMine, setShowOnlyMine] = useState(false);
  const [startDate, setStartDate] = useState(null);
  const [endDate, setEndDate] = useState(null);
  const [sortField, setSortField] = useState("");
  const [sortOrder, setSortOrder] = useState("asc"); // or "desc"
  const [showModal, setShowModal] = useState(false);
  const [selectedAudit, setSelectedAudit] = useState(null);
  const isQA = ["QA", "Team Lead", "Manager"].includes(user?.userLevel);
  const isAdmin = ["QA Admin", "Dev", "Super Admin"].includes(user?.userLevel);
  // const isQA = UserService.getQARole();
  // const isAdmin = UserService.getQAAdminRole();

  // useEffect(() => {
  //   const firstName = localStorage.getItem("userFirstname") || "";
  //   const lastName = localStorage.getItem("userLastname") || "";
  //   const storedempId = localStorage.getItem("empId");
  //   const storedUserId = localStorage.getItem("userId");
  //   const storedUserName = `${firstName} ${lastName}`.trim();

  //   setUserId(storedUserId);
  //   setUserName(storedUserName);
  //   setEmpId(storedempId);
  //   fetchAudits();
  // }, []);

  useEffect(() => {
    if (!user) return;

    setUserId(user.userid);
    setUserName(user.fullName);
    setEmpId(user.empId);
    console.log("user", user);
    fetchAudits();
  }, [user]);

  const fetchAudits = async () => {
    try {
      const res = await axios.get(`${SERVER_URL}/api/qaAuditData`, {
        withCredentials: true, // 🔥 REQUIRED for session
      });

      const data = res.data?.data || [];
      console.log("AUDITS DATA:", data); // debug
      setAudits(data);
    } catch (err) {
      console.error("Error fetching audits", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    filterAudits();
  }, [audits, search, startDate, endDate, showOnlyMine, sortField, sortOrder]);

  const filterAudits = () => {
    let result = Array.isArray(audits) ? [...audits] : [];

    if (search) {
      result = result.filter((r) =>
        Object.values(r).some((val) =>
          String(val).toLowerCase().includes(search.toLowerCase()),
        ),
      );
    }

    if (startDate && endDate) {
      // Normalize times
      const normalizedStart = new Date(startDate);
      normalizedStart.setHours(0, 0, 0, 0); // 00:00:00.000

      const normalizedEnd = new Date(endDate);
      normalizedEnd.setHours(23, 59, 59, 999); // 23:59:59.999

      result = result.filter((r) => {
        const evalDate = new Date(r.EVALUATION_DATE);
        return evalDate >= normalizedStart && evalDate <= normalizedEnd;
      });
    }

    // if (isQA || isAdmin) {
    //   if (showOnlyMine) {
    //     result = result.filter((r) => r.EVALUATOR_NAME === userName);
    //   }
    // } else {
    //   result = result.filter((r) => r.AGENT_ID === empId);
    // }

    if (isQA || isAdmin) {
      if (showOnlyMine) {
        result = result.filter(
          (r) =>
            r.EVALUATOR_NAME?.toLowerCase().trim() ===
            userName?.toLowerCase().trim(),
        );
      }
    } else {
      result = result.filter((r) => String(r.AGENT_ID) === String(empId));
    }

    // Apply sorting
    if (sortField) {
      result.sort((a, b) => {
        const valA = a[sortField];
        const valB = b[sortField];

        if (valA === null || valA === undefined) return 1;
        if (valB === null || valB === undefined) return -1;

        if (sortField === "EVALUATION_DATE") {
          return sortOrder === "asc"
            ? new Date(valA) - new Date(valB)
            : new Date(valB) - new Date(valA);
        }

        if (sortField === "QA_SCORE") {
          return sortOrder === "asc"
            ? parseFloat(valA) - parseFloat(valB)
            : parseFloat(valB) - parseFloat(valA);
        }

        return sortOrder === "asc"
          ? String(valA).localeCompare(String(valB))
          : String(valB).localeCompare(String(valA));
      });
    }

    setFiltered(result);
  };

  const handleSort = (field) => {
    if (sortField === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortOrder("asc");
    }
  };

  const totalAudits = audits.length;
  const pendingCount = audits.filter((a) =>
    a.STATUS?.toLowerCase().includes("pending"),
  ).length;
  const acknowledgedCount = audits.filter((a) =>
    a.STATUS?.toLowerCase().includes("acknowledged"),
  ).length;
  const disputeCount = audits.filter((a) =>
    a.STATUS?.toLowerCase().includes("dispute"),
  ).length;

  const renderStatusBadge = (status = "") => {
    const clean = status.toLowerCase();
    let colorClass = "bg-gray-100 text-gray-800";
    if (clean.includes("pending")) colorClass = "bg-yellow-100 text-yellow-800";
    else if (clean.includes("ack")) colorClass = "bg-green-100 text-green-800";
    else if (clean.includes("dispute")) colorClass = "bg-red-100 text-red-800";

    return (
      <span
        className={`px-2 py-1 rounded-full text-xs font-semibold ${colorClass}`}
      >
        {status}
      </span>
    );
  };

  const exportToExcel = () => {
    if (filtered.length === 0) return;

    const worksheet = XLSX.utils.json_to_sheet(filtered);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Audits");

    const excelBuffer = XLSX.write(workbook, {
      bookType: "xlsx",
      type: "array",
    });

    const fileData = new Blob([excelBuffer], {
      type: "application/octet-stream",
    });
    saveAs(fileData, "QA_Audits.xlsx");
  };

  return (
    <div className="h-screen overflow-hidden bg-[#f5f7fa] flex flex-col">
      <AppHeader user={user} />

      <main className="flex-1 flex overflow-hidden">
        {/* Sidebar Filter Panel */}
        <aside className="w-64 border-r border-gray-200 bg-white/80 p-4 space-y-4">
          <div className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={showOnlyMine}
              onChange={(e) => setShowOnlyMine(e.target.checked)}
            />
            <label>Show only my audits</label>
          </div>

          <div>
            <input
              type="text"
              placeholder="Advanced Search..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="text-xs text-gray-600 mb-1 block">
              Evaluation Date
            </label>

            <div className="flex gap-2 mb-2">
              <DatePicker
                popperPlacement="right-start"
                selected={startDate}
                onChange={(date) => setStartDate(date)}
                selectsStart
                startDate={startDate}
                endDate={endDate}
                placeholderText="Start date"
                className="w-full mb-2 px-3 py-2 text-sm border border-gray-300 rounded"
              />
              <DatePicker
                popperPlacement="right-start"
                selected={endDate}
                onChange={(date) => setEndDate(date)}
                selectsEnd
                startDate={startDate}
                endDate={endDate}
                minDate={startDate}
                placeholderText="End date"
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded"
              />
            </div>

            <button
              onClick={() => {
                setSearch("");
                setStartDate(null);
                setEndDate(null);
                setShowOnlyMine(false);
              }}
              className="w-full mt-2 bg-gray-200 hover:bg-gray-300 text-sm py-2 rounded text-gray-700"
            >
              Clear Filters
            </button>
          </div>
        </aside>

        {/* Main Content */}
        <section className="flex-1 flex flex-col px-5 py-4 space-y-4 overflow-hidden">
          {/* KPI Tiles */}
          <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
            {[
              ["Total Audits", totalAudits],
              ["Pending Acknowledgement", pendingCount],
              ["Acknowledged", acknowledgedCount],
              ["Active Disputes", disputeCount],
            ].map(([label, count]) => (
              <div
                key={label}
                className="bg-white rounded shadow p-4 border border-gray-200"
              >
                <div className="text-[11px] text-gray-500 font-medium">
                  {label}
                </div>
                <div className="text-lg font-semibold text-[#003b5c]">
                  {count}
                </div>
              </div>
            ))}
          </div>

          <div className="flex justify-end">
            <div className="space-x-4">
              <button
                onClick={() => navigate("/QAForms")}
                className="w-28 bg-[#f58220] text-white text-sm py-2 rounded hover:bg-orange-600"
              >
                + Add Audit
              </button>

              {isAdmin === true && (
                <button
                  onClick={exportToExcel}
                  className="w-28 bg-[#00a1c9] text-white text-sm py-2 rounded hover:bg-[#008bb1]"
                >
                  Export to Excel
                </button>
              )}
            </div>
          </div>
          {/* Audit Table */}
          <div className="flex-1 overflow-y-auto rounded border bg-white">
            <table className="w-full text-sm">
              <thead className="bg-gray-200 sticky top-0">
                <tr>
                  <th
                    className="text-left p-2 cursor-pointer select-none"
                    onClick={() => handleSort("QA_FORM_NAME")}
                    title="Click to Sort"
                  >
                    QA Form{" "}
                    {sortField === "QA_FORM_NAME" &&
                      (sortOrder === "asc" ? "▲" : "▼")}
                  </th>
                  <th
                    className="text-left p-2 cursor-pointer select-none"
                    onClick={() => handleSort("EVALUATION_DATE")}
                    title="Click to Sort"
                  >
                    Evaluation Date{" "}
                    {sortField === "EVALUATION_DATE" &&
                      (sortOrder === "asc" ? "▲" : "▼")}
                  </th>
                  <th
                    className="text-left p-2 cursor-pointer select-none"
                    onClick={() => handleSort("EVALUATION_TYPE")}
                    title="Click to Sort"
                  >
                    Evaluation Type{" "}
                    {sortField === "EVALUATION_TYPE" &&
                      (sortOrder === "asc" ? "▲" : "▼")}
                  </th>
                  <th
                    className="text-left p-2 cursor-pointer select-none"
                    onClick={() => handleSort("EVALUATOR_NAME")}
                    title="Click to Sort"
                  >
                    Auditor{" "}
                    {sortField === "EVALUATOR_NAME" &&
                      (sortOrder === "asc" ? "▲" : "▼")}
                  </th>
                  <th
                    className="text-left p-2 cursor-pointer select-none"
                    onClick={() => handleSort("SUPERVISOR_NAME")}
                    title="Click to Sort"
                  >
                    Supervisor{" "}
                    {sortField === "SUPERVISOR_NAME" &&
                      (sortOrder === "asc" ? "▲" : "▼")}
                  </th>
                  <th
                    className="text-left p-2 cursor-pointer select-none"
                    onClick={() => handleSort("AGENT_NAME")}
                    title="Click to Sort"
                  >
                    Agent{" "}
                    {sortField === "AGENT_NAME" &&
                      (sortOrder === "asc" ? "▲" : "▼")}
                  </th>
                  <th
                    className="text-left p-2 cursor-pointer select-none"
                    onClick={() => handleSort("QA_SCORE")}
                    title="Click to Sort"
                  >
                    Score{" "}
                    {sortField === "QA_SCORE" &&
                      (sortOrder === "asc" ? "▲" : "▼")}
                  </th>
                  <th
                    className="text-left p-2 cursor-pointer select-none"
                    onClick={() => handleSort("STATUS")}
                    title="Click to Sort"
                  >
                    Status{" "}
                    {sortField === "STATUS" &&
                      (sortOrder === "asc" ? "▲" : "▼")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan="8" className="text-center text-gray-400 py-4">
                      No records found.
                    </td>
                  </tr>
                ) : (
                  filtered.map((audit, i) => (
                    <tr
                      key={i}
                      className="border-b hover:bg-blue-50 cursor-pointer"
                      onClick={() => {
                        setSelectedAudit(audit);
                        setShowModal(true);
                      }}
                    >
                      <td className="p-2">{audit.QA_FORM_NAME}</td>
                      <td className="p-2">
                        {audit.EVALUATION_DATE
                          ? new Date(audit.EVALUATION_DATE).toLocaleDateString(
                              "en-US",
                              {
                                month: "2-digit",
                                day: "2-digit",
                                year: "numeric",
                              },
                            )
                          : "—"}
                      </td>
                      <td className="p-2">{audit.EVALUATION_TYPE}</td>
                      <td className="p-2">{audit.EVALUATOR_NAME}</td>
                      <td className="p-2">{audit.SUPERVISOR_NAME}</td>
                      <td className="p-2">{audit.AGENT_NAME}</td>
                      <td className="p-2 text-green-600 font-medium">
                        {audit.QA_SCORE !== null && audit.QA_SCORE !== undefined
                          ? `${parseFloat(audit.QA_SCORE).toFixed(2)}%`
                          : "—"}
                      </td>
                      <td className="p-2">{renderStatusBadge(audit.STATUS)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

        {showModal && selectedAudit?.ID && selectedAudit?.QA_FORM_NAME && (
          <AuditViewModal
            audit={selectedAudit}
            onClose={() => {
              fetchAudits(); // or fetchData() if that’s your fetch fn name
              setShowModal(false);
            }}
          />
        )}
      </main>
    </div>
  );
};

export default QADashboardPage;
