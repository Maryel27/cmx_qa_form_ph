// src/components/Routes/QADashboardPage.jsx
import React, { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import AppHeader from "../common/AppHeader";
import axios from "axios";
import { SERVER_URL } from "../lib/constants";
//import UserService from "../../service/UserService";
//import DatePicker from "react-datepicker";
import CreateQAFormModal from "./CreateQAFormModal";
//import AuditViewModal from "./AuditViewModal"
import ViewQAFormModal from "./ViewQAFormModal";
import UserService from "../../service/UserService";
import "react-datepicker/dist/react-datepicker.css";
import { apiFetch } from "../lib/apiFetch";

const FormsCatalog = ({ user }) => {
  const navigate = useNavigate();
  const isSuperAdmin = UserService.getSuperAdminRole();
  const [userid, setUserId] = useState("");
  const [empId, setEmpId] = useState([]);
  const [userName, setUserName] = useState("");
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [rows, setRows] = useState([]);
  const [filteredRows, setFilteredRows] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [selectedFormHeader, setSelectedFormHeader] = useState(null);
  const [selectedFormDetails, setSelectedFormDetails] = useState(null);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [hideDisabled, setHideDisabled] = useState(true);
  const [sortConfig, setSortConfig] = useState({
    key: null,
    direction: "asc",
  });

  const tableRef = useRef(null);

  const fetchData = async () => {
    try {
      const res = await apiFetch(`${SERVER_URL}/api/qa_form_list_catalog`);

      if (!res) return; // 🔥 session expired

      const data = await res.json();

      const rawData = data.data || data;

      if (!Array.isArray(rawData) || rawData.length === 0) {
        setRows([]);
        setFilteredRows([]);
        return;
      }

      setRows(rawData);
      setFilteredRows(rawData);
    } catch (err) {
      console.error("❌ Error fetching QA forms:", err);
    }
  };

  const applyFilters = (allRows, query, hideDisabledFlag) => {
    const q = query.toLowerCase();
    return allRows.filter((row) => {
      // 🔒 Hide Disabled Forms
      if (hideDisabledFlag && row.STATUS === "Disabled") {
        return false;
      }

      // 🔍 Search filter
      if (!q) return true;

      return (
        (row.QA_FORM_NAME || "").toLowerCase().includes(q) ||
        (row.ACCOUNT || "").toLowerCase().includes(q) ||
        (row.LOB || "").toLowerCase().includes(q) ||
        (row.TASK || "").toLowerCase().includes(q) ||
        (row.CREATED_BY || "").toLowerCase().includes(q) ||
        (row.STATUS || "").toLowerCase().includes(q)
      );
    });
  };

  const handleSearchQueryChange = (e) => {
    const query = e.target.value;
    setSearchQuery(query);

    const filtered = applyFilters(rows, query, hideDisabled);
    setFilteredRows(filtered);
  };

  // useEffect(() => {
  //   fetchData();

  //   const storedUserId = localStorage.getItem("userid");
  //   const storedUserName = localStorage.getItem("name");
  //   setUserId(storedUserId);
  //   setUserName(storedUserName);
  // }, []);

  useEffect(() => {
    if (!user) return;

    setUserId(user.userid);
    setUserName(user.fullName);
    setEmpId(user.empId);

    fetchData(); // 🔥 ADD THIS
  }, [user]);

  const handleRowDoubleClick = (qaFormName) => {
    const fullForm = rows.find((row) => row.QA_FORM_NAME === qaFormName); // ✅ matches alias

    if (fullForm) {
      const {
        QA_FORM_NAME,
        ACCOUNT,
        LOB,
        TASK,
        CREATED_DATE,
        CREATED_BY,
        STATUS,
        ...components
      } = fullForm;

      setSelectedFormHeader({
        QA_FORM_NAME: QA_FORM_NAME,
        ACCOUNT: ACCOUNT,
        LOB: LOB,
        TASK: TASK,
        CREATED_DATE: CREATED_DATE,
        CREATED_BY: CREATED_BY,
        STATUS: STATUS,
      });

      setSelectedFormDetails(components);
      setIsViewModalOpen(true);
    } else {
      console.warn("⚠️ No matching row found for QA_FORM_NAME:", qaFormName);
    }
  };

  const headerMap = {
    "QA Form Name": "QA_FORM_NAME",
    Account: "ACCOUNT",
    LOB: "LOB",
    Task: "TASK",
    "Created Date": "CREATED_DATE",
    "Created By": "CREATED_BY",
    Status: "STATUS",
  };

  const handleSort = (columnKey) => {
    setSortConfig((prev) => {
      if (prev.key === columnKey) {
        return {
          key: columnKey,
          direction: prev.direction === "asc" ? "desc" : "asc",
        };
      }
      return { key: columnKey, direction: "asc" };
    });
  };

  const sortedRows = React.useMemo(() => {
    if (!Array.isArray(filteredRows)) return [];

    if (!sortConfig.key) return filteredRows;

    return [...filteredRows].sort((a, b) => {
      const valA = a[sortConfig.key] ?? "";
      const valB = b[sortConfig.key] ?? "";

      // Date column
      if (sortConfig.key === "CREATED_DATE") {
        return sortConfig.direction === "asc"
          ? new Date(valA) - new Date(valB)
          : new Date(valB) - new Date(valA);
      }

      // Default string sort
      return sortConfig.direction === "asc"
        ? valA.toString().localeCompare(valB.toString(), undefined, {
            numeric: true,
            sensitivity: "base",
          })
        : valB.toString().localeCompare(valA.toString(), undefined, {
            numeric: true,
            sensitivity: "base",
          });
    });
  }, [filteredRows, sortConfig]);

  const SortIcon = ({ column }) => {
    if (sortConfig.key !== column) return null;
    return sortConfig.direction === "asc" ? " ▲" : " ▼";
  };

  return (
    <div className="h-screen overflow-hidden bg-[#f5f7fa] flex flex-col">
      <AppHeader user={user} />

      <main className="flex-1 flex overflow-hidden">
        {/* Sidebar Filter Panel */}
        <aside className="w-64 border-r border-gray-200 bg-white/80 p-4 space-y-4">
          <input
            type="text"
            placeholder="Search QA Forms..."
            value={searchQuery}
            onChange={handleSearchQueryChange}
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500"
          />

          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={hideDisabled}
              onChange={(e) => {
                const checked = e.target.checked;
                setHideDisabled(checked);

                const filtered = applyFilters(rows, searchQuery, checked);
                setFilteredRows(filtered);
              }}
              className="accent-blue-600"
            />
            Hide Disabled Forms
          </label>

          <button
            onClick={() => {
              setSearchQuery("");
              setFilteredRows(applyFilters(rows, "", hideDisabled)); // reset to all
            }}
            className="w-full bg-gray-200 hover:bg-gray-300 text-sm py-2 rounded text-gray-700"
          >
            Clear Search
          </button>

          <button
            className="w-full mt-2 bg-blue-300 hover:bg-blue-400 text-sm py-2 rounded text-gray-700"
            onClick={() => setShowModal(true)}
          >
            Create New QA Form
          </button>
        </aside>

        {/* Main Content */}
        <section className="flex-1 flex flex-col px-5 py-4 space-y-4 overflow-hidden">
          {/* QA Forms Table */}
          <div className="overflow-auto bg-white shadow-md rounded-lg">
            <table className="min-w-full border-collapse">
              <thead>
                <tr className="bg-gray-200 sticky top-0 z-10">
                  {[
                    "QA Form Name",
                    "Account",
                    "LOB",
                    "Task",
                    "Created Date",
                    "Created By",
                    "Status",
                  ].map((header, index) => {
                    const columnKey = headerMap[header];

                    return (
                      <th
                        key={index}
                        onClick={() => handleSort(columnKey)}
                        className="px-4 py-3 text-center text-sm border-b border-gray-200 cursor-pointer hover:bg-gray-300"
                      >
                        {header}
                        <SortIcon column={columnKey} />
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {filteredRows.length > 0 ? (
                  sortedRows.map((row, index) => (
                    <tr
                      key={index}
                      className=" hover:bg-blue-50 transition cursor-pointer"
                      onDoubleClick={() =>
                        handleRowDoubleClick(row.QA_FORM_NAME)
                      }
                    >
                      <td className="px-4 py-3 border-b border-gray-200 text-sm">
                        {row.QA_FORM_NAME || "—"}
                      </td>
                      <td className="px-4 py-3 border-b border-gray-200 text-sm">
                        {row.ACCOUNT || "—"}
                      </td>
                      <td className="px-4 py-3 border-b border-gray-200 text-sm">
                        {row.LOB || "—"}
                      </td>
                      <td className="px-4 py-3 border-b border-gray-200 text-sm">
                        {row.TASK || "—"}
                      </td>
                      <td className="px-4 py-3 border-b border-gray-200 text-sm">
                        {row.CREATED_DATE
                          ? new Date(row.CREATED_DATE).toLocaleDateString(
                              "en-US",
                              {
                                year: "numeric",
                                month: "2-digit",
                                day: "2-digit",
                              },
                            )
                          : "—"}
                      </td>
                      <td className="px-4 py-3 border-b border-gray-200 text-sm">
                        {row.CREATED_BY || "—"}
                      </td>
                      <td className="px-4 py-3 border-b border-gray-200 text-sm">
                        {row.STATUS || "—"}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td
                      colSpan="6"
                      className="text-center py-3 text-gray-500 text-sm"
                    >
                      No QA form data available
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* View Modal */}
        <ViewQAFormModal
          isOpen={isViewModalOpen}
          onClose={() => {
            setIsViewModalOpen(false);
            setSelectedFormHeader(null);
            setSelectedFormDetails([]);
            fetchData(); // 🔄 Refresh the list
          }}
          formHeader={selectedFormHeader}
          formDetails={selectedFormDetails}
        />

        {/*Create QA Form Modal*/}
        <CreateQAFormModal
          isOpen={showModal}
          onClose={() => setShowModal(false)}
          onSuccess={() => {
            setShowModal(false); // close modal
            fetchData(); // refresh form list
          }}
        />
      </main>
    </div>
  );
};

export default FormsCatalog;
