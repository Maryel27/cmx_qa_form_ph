// src/components/Routes/QADashboardPage.jsx
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import AppHeader from "../common/AppHeader";
import axios from "axios";
import { SERVER_URL } from "../lib/constants";
import UserService from "../../service/UserService";

const QAForms = ({ user }) => {
  const navigate = useNavigate();
  const [userid, setUserId] = useState("");
  const [empId, setEmpId] = useState([]);
  const [userName, setUserName] = useState("");
  const [rows, setRows] = useState([]);
  const [qaFormOptions, setQAFormOptions] = useState([]);
  const [selectedForm, setSelectedForm] = useState("");
  const [selectedFormAccount, setSelectedFormAccount] = useState("");
  const [allEmployees, setAllEmployees] = useState([]);
  const [isFormGenerated, setIsFormGenerated] = useState(false);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState(null);
  const [employeeName, setEmployeeName] = useState("");
  const [isManualEntry, setIsManualEntry] = useState(false);
  const [formData, setFormData] = useState({});
  const [isFormLocked, setIsFormLocked] = useState(false);
  const [manualSupervisorName, setManualSupervisorName] = useState("");
  const [manualSupervisorId, setManualSupervisorId] = useState(null);
  const [ptsDeductible, setPtsDeductible] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const [generatedFormFields, setGeneratedFormFields] = useState([]);
  const [filteredRows, setFilteredRows] = useState([]);
  const [observations, setObservations] = useState({});
  const [qaScore, setQaScore] = useState(0);
  const [pointsPossible, setPointsPossible] = useState(0);
  const [pointsAttained, setPointsAttained] = useState(0);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(null); // true | false
  const [userType, setUserType] = useState([]);
  const isFormSelected = Boolean(selectedForm);
  const isAgentSelected = Boolean(selectedEmployeeId) || isManualEntry;

  const groupComponentFields = (flatData) => {
    const grouped = {};

    // Step 1: Handle component titles
    Object.entries(flatData).forEach(([key, value]) => {
      const standardComp = key.match(/^(C\d{3})_COMP$/);
      if (standardComp) {
        const compId = standardComp[1];
        grouped[compId] = { title: value, questions: {} };
      }

      // ✅ Special case: C011_ZTP
      if (key === "C011_ZTP") {
        grouped["C011"] = { title: value, questions: {} };
      }
    });

    // Step 2: Handle questions and deductions
    Object.entries(flatData).forEach(([key, value]) => {
      const qMatch = key.match(/^Q(\d{3})_QUESTION$/);
      const pMatch = key.match(/^Q(\d{3})_PTS_DEDUCTIBLE$/);

      if (qMatch) {
        const qId = `Q${qMatch[1]}`;
        const questionText = value;

        if (typeof questionText === "string") {
          const compPrefixMatch = questionText.match(/^(C\d{3}(?:_ZTP)?) -/); // Matches C011_ZTP
          if (compPrefixMatch) {
            const rawPrefix = compPrefixMatch[1]; // e.g. C011_ZTP
            const compId = rawPrefix.includes("_ZTP") ? "C011" : rawPrefix;

            if (!grouped[compId])
              grouped[compId] = { title: "Untitled Component", questions: {} };
            if (!grouped[compId].questions[qId])
              grouped[compId].questions[qId] = {};

            grouped[compId].questions[qId]["QUESTION"] = questionText.replace(
              `${rawPrefix} - `,
              "",
            );
          }
        }
      }

      if (pMatch) {
        const qId = `Q${pMatch[1]}`;
        Object.entries(grouped).forEach(([compId, compData]) => {
          if (compData.questions[qId]) {
            compData.questions[qId]["PTS_DEDUCTIBLE"] = value;
          }
        });
      }
    });

    return grouped;
  };

  const fetchData = async () => {
    try {
      const response = await axios.get(`${SERVER_URL}/api/qa_form_list`, {
        withCredentials: true, // 🔥 REQUIRED for session
      });
      const rawData = response.data;

      if (!Array.isArray(rawData) || rawData.length === 0) {
        console.warn("No Existing QA Forms");
        setRows([]);
        setFilteredRows([]);
        setQAFormOptions([]);
        return;
      }

      // Group rows by QA_FORM_NAME
      const grouped = {};

      rawData.forEach((row) => {
        const formName = row.QA_FORM_NAME;

        if (!grouped[formName]) {
          grouped[formName] = {
            QA_FORM_NAME: formName,
            ACCOUNT: row.ACCOUNT,
            LOB: row.LOB,
            TASK: row.TASK,
            CREATED_DATE: row.CREATED_DATE,
            CREATED_BY: row.CREATED_BY,
            STATUS: row.STATUS,
            components: {},
          };
        }

        // Extract all component/question keys dynamically
        Object.entries(row).forEach(([key, value]) => {
          if (
            /^(C\d{3}_COMP|Q\d{3}_(QUESTION|PTS_DEDUCTIBLE)|C011_ZTP|ZTP_\d{2}_(QUESTION|PTS_DEDUCTIBLE))$/.test(
              key,
            )
          ) {
            grouped[formName].components[key] = value;
          }
        });
      });

      const finalRows = Object.values(grouped);

      setRows(finalRows);
      setFilteredRows(finalRows);
      setQAFormOptions(finalRows.map((r) => r.QA_FORM_NAME));
    } catch (error) {
      console.error("❌ Error fetching QA form data:", error);
    }
  };

  const fetchEmployees = async () => {
    try {
      const res = await axios.get(`${SERVER_URL}/api/employees`, {
        withCredentials: true, // 🔥 REQUIRED for session
      });
      setAllEmployees(res.data);
    } catch (error) {
      console.error("❌ Error fetching employees:", error);
    }
  };

  // useEffect(() => {
  //   fetchData();
  //   fetchEmployees();

  //   const firstName = localStorage.getItem("userFirstname") || "";
  //   const lastName = localStorage.getItem("userLastname") || "";

  //   const storedUserId = localStorage.getItem("userId");
  //   const storedUserType = localStorage.getItem("user_access_level");
  //   const storedUserName = `${firstName} ${lastName}`.trim();
  //   setUserId(storedUserId);
  //   setUserName(storedUserName);
  //   setUserType(storedUserType);
  // }, []);

  useEffect(() => {
    if (!user) return;

    setUserId(user.userid);
    setUserName(user.fullName);
    setEmpId(user.empId);
    console.log("user", user);
    // fetchAudits();
    fetchData(); // ✅ correct
    fetchEmployees(); // ✅ correct
  }, [user]);

  const handleFormChange = (e) => {
    setIsFormGenerated(false);
    const selectedFormName = e.target.value;
    setSelectedForm(selectedFormName);

    const formDetails = rows.find(
      (row) => row.QA_FORM_NAME === selectedFormName,
    );
    if (formDetails) {
      setSelectedFormAccount(formDetails.ACCOUNT);
    } else {
      setSelectedFormAccount("");
    }

    // Reset employee info
    setSelectedEmployeeId("");
    setEmployeeName("");
    setIsManualEntry(false);
  };

  const handleEmployeeChange = (e) => {
    const selectedValue = e.target.value;

    if (selectedValue === "other") {
      setIsManualEntry(true);
      setEmployeeName("");
      setSelectedEmployeeId("");
      setFormData((prev) => ({ ...prev, agentID: "" }));
      return;
    }

    setIsManualEntry(false);

    const selectedEmp = allEmployees.find(
      (emp) => emp.employeeId === selectedValue,
    );
    if (selectedEmp) {
      setEmployeeName(selectedEmp.employee_name);
      setSelectedEmployeeId(selectedEmp.employeeId);
      setFormData((prev) => ({ ...prev, agentID: selectedEmp.employeeId }));
    }
  };

  const formatDateForSQL = (date) => {
    const d = new Date(date);
    return d.toISOString().slice(0, 19).replace("T", " ");
  };

  const handleGenerateForm = () => {
    if (!selectedForm) {
      console.warn("No QA Form selected.");
      return;
    }
    setIsFormGenerated(true);
  };

  const calculateScore = (groupedData, observations) => {
    let possible = 0;
    let attained = 0;
    let ztpFlagged = false;

    Object.entries(groupedData).forEach(([compKey, compData]) => {
      const isZTP = compKey === "C011";
      Object.entries(compData.questions).forEach(([qKey, qVal]) => {
        const obs = observations[qKey];
        const pts = parseFloat(qVal.PTS_DEDUCTIBLE || 0);

        if (isZTP) {
          if (obs === "Flagged") ztpFlagged = true;
        } else {
          if (obs && obs !== "N/A") {
            possible += pts;
            if (obs === "Met") {
              attained += pts;
            }
          }
        }
      });
    });

    setPointsPossible(possible);
    setPointsAttained(attained);
    setQaScore(ztpFlagged ? 0 : possible ? (attained / possible) * 100 : 0);
  };

  const handleObservationChange = (questionKey, value, groupedData) => {
    setObservations((prev) => {
      const updated = { ...prev, [questionKey]: value };
      calculateScore(groupedData, updated);
      return updated;
    });
  };

  const isSaveDisabled = (() => {
    const selectedFormData = rows.find((f) => f.QA_FORM_NAME === selectedForm);
    if (!selectedFormData || !selectedFormData.components) return true;

    const groupedData = groupComponentFields(selectedFormData.components);

    // Check if any question is unanswered
    const hasMissingObservations = Object.entries(groupedData).some(
      ([compKey, compData]) => {
        const { questions } = compData;
        return Object.keys(questions).some((qId) => !observations[qId]);
      },
    );

    // Check if observation comments are empty
    const isCommentsEmpty =
      !formData.observationComments ||
      formData.observationComments.trim() === "";

    return hasMissingObservations || isCommentsEmpty;
  })();

  const handleSaveForm = async () => {
    const selectedFormData = rows.find((f) => f.QA_FORM_NAME === selectedForm);
    if (!selectedFormData || !selectedFormData.components) return;

    const grouped = groupComponentFields(selectedFormData.components);
    const auditFields = {};

    Object.entries(grouped).forEach(([compKey, compData]) => {
      const { questions } = compData;
      Object.entries(questions).forEach(([qId, qVal]) => {
        auditFields[`${qId}_RESULT`] = observations[qId] || null;
        auditFields[`${qId}_PTS_DEDUCTIBLE`] =
          observations[qId] === "Met"
            ? qVal.PTS_DEDUCTIBLE
            : observations[qId] === "Not Met"
              ? 0
              : null;
      });
    });

    const auditPayload = {
      QA_FORM_NAME: selectedFormData.QA_FORM_NAME,
      ACCOUNT: selectedFormData.ACCOUNT,
      LOB: selectedFormData.LOB,
      TASK: selectedFormData.TASK,
      EVALUATION_DATE: formatDateForSQL(new Date()),
      EVALUATION_TYPE: formData.evaluationType,
      AGENT_ID: selectedEmployeeId,
      AGENT_NAME: employeeName,
      SUPERVISOR_ID: isManualEntry
        ? manualSupervisorId
        : allEmployees.find((emp) => emp.employeeId === selectedEmployeeId)
            ?.supervisorId || "",
      SUPERVISOR_NAME: isManualEntry
        ? manualSupervisorName
        : allEmployees.find((emp) => emp.employeeId === selectedEmployeeId)
            ?.supervisorName || "",
      EVALUATOR_NAME: userName,
      POINTS_ATTAINED: pointsAttained,
      POINTS_POSSIBLE: pointsPossible,
      QA_SCORE: qaScore,
      COMMENTS: formData.observationComments || "",
      ...auditFields, // 👈 inject Qxxx_RESULT and Qxxx_PTS_DEDUCTIBLE
    };

    try {
      await axios.post(`${SERVER_URL}/api/save_qa_audit`, auditPayload, {
        withCredentials: true,
      });
      console.log("✅ QA Audit saved successfully.");
      setSaveSuccess(true);
      setShowSaveModal(true);
      // Optional: Reset form
      resetForm();
    } catch (error) {
      console.error("❌ Save Error:", error);
      setSaveSuccess(false);
      setShowSaveModal(true);
    }
  };

  const resetForm = () => {
    setIsFormGenerated(false);
    setSelectedForm("");
    setSelectedFormAccount("");
    setSelectedEmployeeId("");
    setEmployeeName("");
    setFormData({ evaluationType: "", observationComments: "" });
    setManualSupervisorId("");
    setManualSupervisorName("");
    setQaScore(100);
    setPointsPossible(0);
    setPointsAttained(0);
    setPtsDeductible(0);
    setObservations({});
    setGeneratedFormFields([]);
    setIsManualEntry(false);
    setIsFormLocked(false);
  };

  const showCancelButton = !!(
    selectedForm ||
    selectedEmployeeId ||
    employeeName ||
    manualSupervisorName ||
    manualSupervisorId ||
    formData.evaluationType
  );

  const isGenerateDisabled =
    isFormGenerated ||
    !(
      selectedForm &&
      selectedEmployeeId &&
      formData.evaluationType &&
      (!isManualEntry ||
        (employeeName && manualSupervisorName && manualSupervisorId))
    );

  return (
    <div className="h-screen overflow-hidden bg-[#f5f7fa] flex flex-col">
      <AppHeader user={user} />
      <main className="flex-1 flex overflow-hidden">
        {/* Sidebar Filter Panel */}
        <aside className="w-96 border-r border-gray-200 bg-white/80 p-4 space-y-4">
          <div className="space-y-4 justify-start">
            {/* QA Form Dropdown */}
            <div className="w-full">
              <label
                htmlFor="qa-form-dropdown"
                className="block text-sm font-bold text-gray-700 text-left"
              >
                Select QA Form:
              </label>
              <select
                id="qa-form-dropdown"
                value={selectedForm}
                onChange={handleFormChange}
                className="mt-1 block w-full lg:max-w-[515px] rounded-md border border-gray-300 shadow-sm px-3 py-2 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                disabled={isFormGenerated}
              >
                <option value="" disabled selected>
                  -- Select --
                </option>
                {qaFormOptions.map((formName, index) => (
                  <option key={index} value={formName}>
                    {formName}
                  </option>
                ))}
              </select>
            </div>

            {/* Agent Name Dropdown */}
            <div className="w-full">
              <label
                htmlFor="employee-select"
                className="block text-sm font-bold text-gray-700 text-left"
              >
                Agent Name:
              </label>
              <select
                id="employee-select"
                value={isManualEntry ? "other" : selectedEmployeeId}
                onChange={handleEmployeeChange}
                className="mt-1 block w-full lg:max-w-[515px] rounded-md border border-gray-300 shadow-sm px-3 py-2 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                disabled={isFormGenerated || !isFormSelected}
              >
                <option value="" disabled selected>
                  -- Select --
                </option>

                {allEmployees
                  .filter((emp) => emp.account === selectedFormAccount)
                  .map((emp) => (
                    <option key={emp.employeeId} value={emp.employeeId}>
                      {emp.employee_name}
                    </option>
                  ))}

                <option value="other">Other</option>
              </select>
            </div>

            {/* Manual Entry */}
            {isManualEntry && (
              <div className="flex flex-col justify-start sm:flex-row sm:space-x-4">
                <div className="flex flex-row w-full flex-wrap gap-8">
                  <div className="flex flex-col">
                    <label className="block text-sm font-bold text-gray-700 text-left">
                      Enter Agent Name:
                    </label>
                    <input
                      id="employee-name"
                      type="text"
                      className="mt-1 block w-[330px] rounded-md border border-gray-300 shadow-sm px-3 py-2"
                      value={employeeName}
                      onChange={(e) => setEmployeeName(e.target.value)}
                      disabled={isFormGenerated}
                    />
                  </div>

                  <div className="flex flex-col">
                    <label className="block text-sm font-bold text-gray-700 text-left">
                      Enter Agent ID:
                    </label>
                    <input
                      id="employee-id"
                      type="text"
                      className="mt-1 block w-[150px] rounded-md border border-gray-300 shadow-sm px-3 py-2"
                      value={selectedEmployeeId}
                      onChange={(e) => {
                        const value = e.target.value;

                        // ✅ Allow empty input
                        if (value === "") {
                          setSelectedEmployeeId("");
                          setFormData((prev) => ({ ...prev, agentID: "" }));
                          return;
                        }

                        // ✅ Allow only digits
                        if (!/^\d+$/.test(value)) return;

                        // ✅ Enforce max 7 digits
                        if (value.length > 7) return;

                        setSelectedEmployeeId(value);
                        setFormData((prev) => ({
                          ...prev,
                          agentID: value,
                        }));
                      }}
                      disabled={isFormGenerated}
                    />
                  </div>
                  <div className="flex flex-row w-full flex-wrap gap-8">
                    <div className="flex flex-col">
                      <label className="block text-sm font-bold text-gray-700 text-left">
                        Supervisor Name:
                      </label>
                      <input
                        type="text"
                        className="mt-1 block w-[330px] rounded-md border border-gray-300 shadow-sm px-3 py-2"
                        value={manualSupervisorName}
                        onChange={(e) =>
                          setManualSupervisorName(e.target.value)
                        }
                        disabled={isFormGenerated}
                      />
                    </div>

                    <div className="flex flex-col">
                      <label className="block text-sm font-bold text-gray-700 text-left">
                        Supervisor ID:
                      </label>
                      <input
                        type="text"
                        className="mt-1 block w-[150px] rounded-md border border-gray-300 shadow-sm px-3 py-2"
                        value={manualSupervisorId}
                        onChange={(e) => {
                          const value = e.target.value;

                          if (value === "") {
                            setManualSupervisorId("");
                            return;
                          }

                          if (!/^\d+$/.test(value)) return;
                          if (value.length > 7) return;
                          setManualSupervisorId(value);
                        }}
                        disabled={isFormGenerated}
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Evaluation Type Dropdown */}
            <div className="w-full">
              <label
                htmlFor="evaluation-type"
                className="block text-sm font-bold text-gray-700 text-left"
              >
                Evaluation Type:
              </label>
              <select
                id="evaluation-type"
                value={formData.evaluationType || ""}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    evaluationType: e.target.value,
                  }))
                }
                className="mt-1 block w-full lg:max-w-[515px] rounded-md border border-gray-300 shadow-sm px-3 py-2 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                disabled={
                  isFormGenerated || !isFormSelected || !isAgentSelected
                }
              >
                <option value="" disabled>
                  -- Select --
                </option>

                <option
                  value="QA Observation"
                  disabled={userType === "Team Lead" || userType === "Manager"}
                >
                  QA Observation
                </option>

                <option
                  value="TL Observation"
                  disabled={userType === "QA" || userType === "QA Admin"}
                >
                  TL Observation
                </option>

                <option value="Nesting">Nesting</option>
              </select>
            </div>
          </div>

          <div className="flex space-x-4 mt-4">
            <button
              type="button"
              onClick={handleGenerateForm}
              className={`px-4 py-2 text-sm rounded-md transition ${
                isGenerateDisabled
                  ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                  : "bg-indigo-600 text-white hover:bg-indigo-700"
              }`}
              disabled={isGenerateDisabled}
            >
              Generate Form
            </button>

            {showCancelButton && (
              <button
                type="button"
                onClick={() => {
                  setIsFormGenerated(false);
                  setGeneratedFormFields([]);
                  setSelectedForm("");
                  setSelectedEmployeeId("");
                  setEmployeeName("");
                  setFormData((prev) => ({
                    ...prev,
                    evaluationType: "",
                    agentID: "",
                    observationComments: "",
                  }));
                  setIsManualEntry(false);
                  setQaScore(100);
                  setPointsPossible(0);
                  setPtsDeductible(0);
                  setManualSupervisorId("");
                  setManualSupervisorName("");
                  setIsFormLocked(false);
                  setObservations({});
                }}
                className="px-4 py-2 text-sm rounded-md bg-red-400 text-white hover:bg-red-600 transition"
              >
                Cancel
              </button>
            )}
          </div>
        </aside>

        {/* Main Content */}
        <div className="bg-white p-6 rounded-lg shadow-md mb-4 w-full h-full sm:w-2/3 lg:w-2/3 lg:min-w-[80%] ml-4 overflow-y-auto overflow-x-hidden max-h-[100vh]">
          {/* generate qa form here */}
          {isFormGenerated &&
            selectedForm &&
            (() => {
              const selectedFormData = rows.find(
                (f) => f.QA_FORM_NAME === selectedForm,
              );
              if (!selectedFormData || !selectedFormData.components)
                return null;

              const groupedData = groupComponentFields(
                selectedFormData.components,
              );

              return (
                <div className="p-6 mb-4 w-full sm:w-2/3 lg:w-full lg:min-w-[100%] ml-1">
                  {/* Header Info */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-y-2 gap-x-12 text-sm mb-6 text-left">
                    <div>
                      <strong>QA FORM NAME:</strong> {selectedForm}
                    </div>
                    <div>
                      <strong>ACCOUNT:</strong> {selectedFormAccount}
                    </div>

                    <div>
                      <strong>AGENT NAME:</strong> {employeeName} [
                      {selectedEmployeeId || "—"}]
                    </div>
                    <div>
                      <strong>LOB:</strong> {selectedFormData.LOB || "—"}
                    </div>

                    <div>
                      <strong>SUPERVISOR NAME:</strong>{" "}
                      {isManualEntry
                        ? manualSupervisorName || "—"
                        : allEmployees.find(
                            (emp) => emp.employeeId === selectedEmployeeId,
                          )?.supervisorName || "—"}{" "}
                      [
                      {isManualEntry
                        ? manualSupervisorId || "—"
                        : allEmployees.find(
                            (emp) => emp.employeeId === selectedEmployeeId,
                          )?.supervisorId || "—"}
                      ]
                    </div>

                    <div>
                      <strong>TASK:</strong> {selectedFormData.TASK || "—"}
                    </div>
                    <div>
                      <strong>EVALUATOR NAME:</strong> {userName}
                    </div>
                    <div>
                      <strong>EVALUATION DATE:</strong>{" "}
                      {new Date().toLocaleString()}
                    </div>
                    <div>
                      <strong>EVALUATION TYPE:</strong>{" "}
                      {formData.evaluationType || "—"}
                    </div>
                    <div>
                      <strong>QA SCORE: </strong>
                      <span
                        className={`font-bold text-xl ml-2 ${qaScore >= 95 ? "text-green-700" : qaScore >= 85 ? "text-yellow-600" : "text-red-600"}`}
                      >
                        {qaScore.toFixed(2)}%
                      </span>
                    </div>
                  </div>

                  {/* QA Table */}
                  <div className="overflow-x-auto w-full">
                    <table className="w-full table-fixed border border-gray-300 text-sm">
                      <thead>
                        <tr className="bg-blue-900 text-white">
                          <th className="text-left px-4 py-2 w-[25%]">
                            Section
                          </th>
                          <th className="text-left px-4 py-2 w-[45%]">
                            Line Item
                          </th>
                          <th className="text-center px-4 py-2 w-[30%]">
                            Observation
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {Object.entries(groupedData).map(
                          ([compKey, compData]) => {
                            const { title, questions } = compData;
                            const qEntries = Object.entries(questions);
                            const isZTP = compKey === "C011";

                            return qEntries.map(([qKey, qVal], idx) => (
                              <tr
                                key={`${compKey}-${qKey}`}
                                className="border-t border-gray-200"
                              >
                                {idx === 0 && (
                                  <td
                                    rowSpan={qEntries.length}
                                    className="font-bold px-4 py-2 w-[25%] align-top whitespace-normal break-words"
                                  >
                                    {title}
                                  </td>
                                )}
                                <td className="pl-2 pr-8 py-2 w-[40%] break-words whitespace-normal">
                                  {qVal.QUESTION || "—"}
                                </td>
                                <td className="text-center px-4 py-2 w-[30%]">
                                  {(isZTP
                                    ? ["Flagged", "N/A"]
                                    : ["Met", "Not Met", "N/A"]
                                  ).map((opt) => (
                                    <label
                                      key={opt}
                                      className="inline-flex items-center mr-6"
                                    >
                                      <input
                                        type="radio"
                                        name={`obs-${qKey}`}
                                        value={opt}
                                        checked={observations[qKey] === opt}
                                        onChange={() =>
                                          handleObservationChange(
                                            qKey,
                                            opt,
                                            groupedData,
                                          )
                                        }
                                        className="mr-1"
                                      />
                                      {opt}
                                    </label>
                                  ))}
                                </td>
                              </tr>
                            ));
                          },
                        )}
                      </tbody>
                      <tfoot>
                        <tr className="border-t border-gray-300">
                          <td
                            colSpan={3}
                            className="px-4 py-4 text-left align-top"
                          >
                            <div>
                              <label
                                htmlFor="observation-comments"
                                className="block text-md font-bold text-black mb-1"
                              >
                                Observation Comments:
                              </label>
                              <textarea
                                id="observation-comments"
                                rows={4}
                                className="w-full border border-gray-300 rounded-md shadow-sm px-3 py-2 text-sm focus:ring-indigo-500 focus:border-indigo-500 resize-none"
                                placeholder="Enter any additional observations or comments here..."
                                value={formData.observationComments || ""}
                                onChange={(e) =>
                                  setFormData((prev) => ({
                                    ...prev,
                                    observationComments: e.target.value,
                                  }))
                                }
                                disabled={isFormLocked}
                              />
                            </div>
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                    <div className="mt-6 text-right">
                      <button
                        type="button"
                        className={`px-6 py-2 rounded-md text-white text-sm transition ${
                          isSaveDisabled
                            ? "bg-gray-400 cursor-not-allowed"
                            : "bg-green-600 hover:bg-green-700"
                        }`}
                        disabled={isSaveDisabled}
                        onClick={handleSaveForm}
                      >
                        Save
                      </button>
                    </div>
                  </div>
                </div>
              );
            })()}
        </div>
      </main>

      {showSaveModal && (
        <div className="fixed inset-0 z-50 bg-black bg-opacity-50 flex items-center justify-center transition-opacity duration-200">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6 animate-modalEnter">
            <div className="flex items-center mb-4">
              {saveSuccess ? (
                <svg
                  className="w-6 h-6 text-green-600 mr-2 flex-shrink-0"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              ) : (
                <svg
                  className="w-6 h-6 text-red-600 mr-2 flex-shrink-0"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              )}
              <h2
                className={`text-xl font-bold ${saveSuccess ? "text-green-600" : "text-red-600"}`}
              >
                {saveSuccess
                  ? "QA Audit saved successfully!"
                  : "Failed to save QA Audit."}
              </h2>
            </div>

            <div className="flex justify-end space-x-3 mt-6">
              {saveSuccess ? (
                <>
                  <button
                    onClick={() => {
                      resetForm();
                      setShowSaveModal(false);
                    }}
                    className="bg-[#f58220] hover:bg-orange-600 text-white px-4 py-2 rounded text-sm"
                  >
                    Evaluate Another
                  </button>
                  <button
                    onClick={() => navigate("/Dashboard")}
                    className="bg-[#00a1c9] hover:bg-[#008bb1] text-white px-4 py-2 rounded text-sm"
                  >
                    Back to Dashboard
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={() => setShowSaveModal(false)}
                    className="bg-[#f58220] hover:bg-orange-600 text-white px-4 py-2 rounded text-sm"
                  >
                    Try Again
                  </button>
                  <button
                    onClick={() => navigate("/Dashboard")}
                    className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded text-sm"
                  >
                    Cancel
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default QAForms;
