import React, { useState, useEffect } from "react";
import { SERVER_URL } from "../lib/constants";
import axios from "axios";
import UserService from "../../service/UserService";
import { apiFetch } from "../lib/apiFetch"; // adjust path if needed

const groupComponentFields = (flatData) => {
  const grouped = {};

  Object.entries(flatData).forEach(([key, value]) => {
    const compMatch = key.match(/^(C\d{3})_COMP$/);
    const ztpMatch = key === "C011_ZTP";

    if (compMatch) {
      const prefix = compMatch[1];
      if (!grouped[prefix]) grouped[prefix] = { title: value };
    } else if (ztpMatch) {
      if (!grouped["C011"]) grouped["C011"] = { title: value };
    } else {
      const qMatch = key.match(/^Q(\d{3})_(QUESTION|PTS_DEDUCTIBLE)$/);
      if (qMatch) {
        const [_, num, type] = qMatch;
        const questionNum = `Q${num}`;
        if (!grouped.__ALL) grouped.__ALL = {};
        if (!grouped.__ALL[questionNum]) grouped.__ALL[questionNum] = {};
        grouped.__ALL[questionNum][type] = value;
      }
    }
  });

  return grouped;
};

const AuditViewModal = ({ audit, onClose }) => {
  const [formMeta, setFormMeta] = useState(null);
  const [formDetails, setFormDetails] = useState(null);
  const [auditDetails, setAuditDetails] = useState(null);
  const [isFormLoading, setIsFormLoading] = useState(true);
  const [showDisputeModal, setShowDisputeModal] = useState(false);
  const [disputeReason, setDisputeReason] = useState("");
  const [showDispositionModal, setShowDispositionModal] = useState(false);
  const [dispositionReason, setDispositionReason] = useState("");

  const ID = audit?.ID;
  const QA_FORM_NAME = audit?.QA_FORM_NAME;

  useEffect(() => {
    const fetchFormData = async () => {
      if (!QA_FORM_NAME) return;
      try {
        setIsFormLoading(true);
        const res = await apiFetch(
          `${SERVER_URL}/api/qa_form_by_name/${encodeURIComponent(QA_FORM_NAME)}`,
        );
        const data = await res.json();
        if (res.ok) {
          setFormMeta(data.header);
          setFormDetails(data.details);
        } else {
          console.error("❌ Failed to fetch form data:", data);
        }
      } catch (err) {
        console.error("❌ Error fetching form data:", err);
      } finally {
        setIsFormLoading(false);
      }
    };

    fetchFormData();
  }, [QA_FORM_NAME]);

  const fetchAuditData = async () => {
    if (!ID) return;
    try {
      setIsFormLoading(true);
      const res = await apiFetch(`${SERVER_URL}/api/audit_by_id/${ID}`);
      const data = await res.json();
      if (res.ok) {
        setAuditDetails(data);
      } else {
        console.error("Failed to fetch audit:", data);
      }
    } catch (err) {
      console.error("Error fetching audit:", err);
    } finally {
      setIsFormLoading(false);
    }
  };

  useEffect(() => {
    fetchAuditData();
  }, [ID]);

  if (!audit || isFormLoading || !formMeta || !formDetails || !auditDetails) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50">
        <div className="bg-white p-6 rounded shadow">Loading form data...</div>
      </div>
    );
  }

  const groupedData = groupComponentFields(formDetails);

  const handleAcknowledge = async (auditId) => {
    try {
      const res = await apiFetch(`${SERVER_URL}/api/audit_status`, {
        method: "POST",
        body: JSON.stringify({
          auditId,
          STATUS: "Acknowledged",
          DISPUTE_REASON: "",
        }),
      });

      if (!res) return;
      console.log("Audit acknowledged successfully.");

      // ✅ After successful acknowledgement, re-fetch the updated audit
      fetchAuditData();
    } catch (error) {
      console.error("Acknowledgement failed:", error);
    }
  };

  const submitDispute = async () => {
    if (!disputeReason.trim()) {
      alert("Please enter a reason for dispute.");
      return;
    }
    try {
      const res = await apiFetch(`${SERVER_URL}/api/audit_status`, {
        method: "POST",
        body: JSON.stringify({
          auditId: ID,
          STATUS: "For Dispute",
          DISPUTE_REASON: disputeReason.trim(),
        }),
      });

      if (!res) return;
      console.log("Dispute submitted successfully.");
      setShowDisputeModal(false);
      setDisputeReason("");
      fetchAuditData();
    } catch (error) {
      console.error("Dispute failed:", error);
    }
  };

  const submitValidDispute = async () => {
    if (!dispositionReason.trim()) {
      alert("Please enter a reason for dispute disposition.");
      return;
    }
    try {
      const res = await apiFetch(`${SERVER_URL}/api/dispute_disposition`, {
        method: "POST",
        body: JSON.stringify({
          auditId: ID,
          STATUS: "Valid Dispute",
          DISPUTE_DISPOSITION: dispositionReason.trim(),
        }),
      });

      if (!res) return;
      console.log("Dispute disposition submitted successfully.");
      setShowDispositionModal(false); // ❗ Should hide the *Disposition* modal, not Dispute modal
      setDispositionReason(""); // Clear the disposition reason
      fetchAuditData(); // Refresh the audit details
    } catch (error) {
      console.error("Disposition failed:", error);
    }
  };

  const submitInvalidDispute = async () => {
    if (!dispositionReason.trim()) {
      alert("Please enter a reason for dispute disposition.");
      return;
    }
    try {
      const res = await apiFetch(`${SERVER_URL}/api/dispute_disposition`, {
        method: "POST",
        body: JSON.stringify({
          auditId: ID,
          STATUS: "Invalid Dispute",
          DISPUTE_DISPOSITION: dispositionReason.trim(),
        }),
      });

      if (!res) return;
      console.log("Dispute disposition submitted successfully.");
      setShowDispositionModal(false); // ❗ Should hide the *Disposition* modal, not Dispute modal
      setDispositionReason(""); // Clear the disposition reason
      fetchAuditData(); // Refresh the audit details
    } catch (error) {
      console.error("Disposition failed:", error);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white w-full max-w-7xl p-6 rounded-lg shadow-lg overflow-auto max-h-[95vh] relative">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-lg">
            <strong>
              QA FORM NAME: {auditDetails.QA_FORM_NAME || "—"}
            </strong>{" "}
          </h2>
          <div className="flex justify-between items-start mb-3 space-x-4">
            {(auditDetails?.STATUS === "Pending Acknowledgement" ||
              auditDetails?.STATUS === "Invalid Dispute") &&
              auditDetails?.AGENT_ID?.toString() ===
                localStorage.getItem("EMPLOYEEID") && (
                <button
                  onClick={() => handleAcknowledge(ID)}
                  className="px-4 py-2 bg-[#00a1c9] hover:bg-[#008bb1] text-white text-sm font-semibold rounded"
                >
                  Acknowledge
                </button>
              )}

            {auditDetails?.STATUS === "Pending Acknowledgement" &&
              auditDetails?.SUPERVISOR_ID ===
                localStorage.getItem("EMPLOYEEID") && (
                <button
                  onClick={() => setShowDisputeModal(true)}
                  className="px-4 py-2 text-white text-sm font-semibold rounded bg-[#f58220] hover:bg-orange-600"
                >
                  Dispute
                </button>
              )}

            {UserService.getQAAdminRole() === "true" &&
              auditDetails?.STATUS === "For Dispute" &&
              auditDetails?.EVALUATOR_NAME !== localStorage.getItem("name") && (
                <button
                  onClick={() => setShowDispositionModal(true)}
                  className="px-4 py-2 text-white text-sm font-semibold rounded bg-green-600 hover:bg-green-700"
                >
                  Dispute Disposition
                </button>
              )}

            <button
              onClick={onClose}
              className="px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded hover:bg-blue-700"
            >
              Close
            </button>

            {UserService.getQAAdminRole() === "true" && (
              <button
                onClick={async () => {
                  if (
                    window.confirm(
                      "Are you sure you want to delete this audit?",
                    )
                  ) {
                    try {
                      const res = await apiFetch(
                        `${SERVER_URL}/api/delete_audit/${ID}`,
                        {
                          method: "DELETE",
                        },
                      );

                      if (!res) return;
                      onClose(); // Close the modal after deletion
                    } catch (err) {
                      console.error("❌ Delete failed:", err);
                    }
                  }
                }}
                className="px-4 py-2 bg-red-800 hover:bg-red-900 text-white text-sm font-semibold rounded"
              >
                Delete
              </button>
            )}
          </div>
        </div>

        {/* Header Info */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-y-2 gap-x-12 text-sm mb-6 text-left">
          <div>
            <strong>AGENT NAME:</strong> {auditDetails.AGENT_NAME} [
            {auditDetails.AGENT_ID || "—"}]
          </div>
          <div>
            <strong>ACCOUNT:</strong> {auditDetails.ACCOUNT || "—"}
          </div>
          <div>
            <strong>SUPERVISOR NAME:</strong> {auditDetails.SUPERVISOR_NAME} [
            {auditDetails.SUPERVISOR_ID || "—"}]
          </div>
          <div>
            <strong>LOB:</strong> {auditDetails.LOB || "—"}
          </div>
          <div>
            <strong>EVALUATOR NAME:</strong>{" "}
            {auditDetails.EVALUATOR_NAME || "—"}
          </div>
          <div>
            <strong>TASK:</strong> {auditDetails.TASK || "—"}
          </div>
          <div>
            <strong>EVALUATION DATE:</strong>{" "}
            {auditDetails.EVALUATION_DATE
              ? new Date(auditDetails.EVALUATION_DATE).toLocaleString()
              : "—"}
          </div>
          <div>
            <strong>STATUS:</strong> {auditDetails.STATUS || "—"}
          </div>
          <div>
            <strong>EVALUATION TYPE:</strong>{" "}
            {auditDetails.EVALUATION_TYPE || "—"}
          </div>
          <div>
            <strong>QA SCORE:</strong>
            <span
              className={`font-bold text-xl ml-2 ${
                auditDetails.QA_SCORE >= 95
                  ? "text-green-700"
                  : auditDetails.QA_SCORE >= 85
                    ? "text-yellow-600"
                    : "text-red-600"
              }`}
            >
              {parseFloat(auditDetails.QA_SCORE).toFixed(2)}%
            </span>
          </div>
        </div>

        {/* QA Table */}
        <div className="overflow-x-auto">
          <table className="w-full border border-gray-300 text-sm">
            <thead>
              <tr className="bg-[#003f66] text-white">
                <th className="text-left px-4 py-2 w-1/3">Section</th>
                <th className="text-left px-4 py-2 w-1/2">Line Item</th>
                <th className="text-center px-4 py-2 w-1/3">Observation</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(groupedData)
                .filter(([key]) => key !== "__ALL")
                .map(([compKey, compMeta]) => {
                  const compTitle = compMeta.title || "Untitled Component";
                  const isZTP = compKey === "C011";
                  const matchPrefix = isZTP ? "C011_ZTP" : compKey;

                  const matchingQuestions = Object.entries(
                    groupedData.__ALL || {},
                  )
                    .filter(([_, qData]) =>
                      (qData.QUESTION || "").startsWith(`${matchPrefix} -`),
                    )
                    .map(([qId, qData]) => ({
                      question: (qData.QUESTION || "").replace(
                        `${matchPrefix} -`,
                        "",
                      ),
                      result: auditDetails
                        ? auditDetails[`${qId}_RESULT`] || "—"
                        : "—",
                    }));

                  if (matchingQuestions.length === 0) return null;

                  return (
                    <React.Fragment key={compKey}>
                      {matchingQuestions.map((row, idx) => (
                        <tr
                          key={`${compKey}-${idx}`}
                          className="border-t border-gray-200"
                        >
                          {idx === 0 && (
                            <td
                              rowSpan={matchingQuestions.length}
                              className="font-bold px-4 py-2 align-top whitespace-nowrap"
                            >
                              {compTitle}
                            </td>
                          )}
                          <td className="px-4 py-2">{row.question}</td>
                          <td
                            className={`text-center px-4 py-2 font-semibold ${
                              row.result === "Met"
                                ? "text-green-700"
                                : row.result === "Not Met" ||
                                    row.result === "Flagged"
                                  ? "text-red-600"
                                  : "text-black"
                            }`}
                          >
                            {row.result}
                          </td>
                        </tr>
                      ))}
                    </React.Fragment>
                  );
                })}
            </tbody>
          </table>
        </div>
        {/* Comments Section */}
        <div className="mt-6 p-4 border border-gray-300 rounded bg-gray-50">
          <h2 className="text-sm font-bold mb-2 text-black">
            Observation Comments
          </h2>
          <p className="text-sm text-black">
            {auditDetails?.COMMENTS || "No comments provided."}
          </p>
        </div>
      </div>

      {/* Reason for Dispute Modal */}
      {showDisputeModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-lg w-full max-w-md space-y-4">
            <h3 className="text-lg font-bold">Reason for Dispute</h3>
            <textarea
              value={disputeReason}
              onChange={(e) => setDisputeReason(e.target.value)}
              className="w-full border border-gray-300 resize-none rounded p-2 text-sm"
              rows={4}
              placeholder="Enter your reason here..."
            />
            <div className="flex justify-end gap-4">
              <button
                onClick={() => setShowDisputeModal(false)}
                className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
              >
                Cancel
              </button>
              <button
                onClick={submitDispute}
                disabled={!disputeReason.trim()} // ✅ disable if blank
                className={`px-4 py-2 text-white rounded 
                  ${!disputeReason.trim() ? "bg-gray-400 cursor-not-allowed" : "bg-blue-600 hover:bg-blue-700"}`}
              >
                Submit Dispute
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Dispute Disposition Modal */}
      {showDispositionModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-lg w-full max-w-md space-y-6">
            <h3 className="text-lg font-bold text-center">
              Disposition the Dispute
            </h3>

            <textarea
              value={dispositionReason}
              onChange={(e) => setDispositionReason(e.target.value)}
              className="w-full border border-gray-300 resize-none rounded p-2 text-sm"
              rows={4}
              placeholder="Enter disposition reason here..."
            />

            <div className="flex justify-end gap-4">
              <button
                onClick={() => setShowDispositionModal(false)}
                className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
              >
                Cancel
              </button>
              <button
                onClick={submitValidDispute}
                disabled={!dispositionReason.trim()} // ✅ disable if blank
                className={`px-4 py-2 text-white rounded 
                  ${!dispositionReason.trim() ? "bg-gray-400 cursor-not-allowed" : "bg-green-600 hover:bg-green-700"}`}
              >
                Valid
              </button>
              <button
                onClick={submitInvalidDispute}
                disabled={!dispositionReason.trim()} // ✅ disable if blank
                className={`px-4 py-2 text-white rounded 
                  ${!dispositionReason.trim() ? "bg-gray-400 cursor-not-allowed" : "bg-red-600 hover:bg-red-700"}`}
              >
                Invalid
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AuditViewModal;
