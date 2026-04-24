import React from "react";
import { Dialog, Transition } from "@headlessui/react";
import { Fragment } from "react";
import { SERVER_URL } from "../lib/constants";

// Group component fields like C01, C02, ..., ZTP
const groupComponentFields = (flatData) => {
  const grouped = {};

  Object.entries(flatData).forEach(([key, value]) => {
    const compMatch = key.match(/^(C\d{3})_COMP$/); // e.g. C001_COMP
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

const ViewQAFormModal = ({ isOpen, onClose, formHeader, formDetails }) => {
  if (!formHeader || !formDetails) return null;

  const groupedData = groupComponentFields(formDetails);

  const toggleStatusHandler = async () => {
    const isCurrentlyDisabled = formHeader.STATUS === "Disabled";
    const nextStatus = isCurrentlyDisabled ? "Active" : "Disabled";

    const confirm = window.confirm(
      `Are you sure you want to ${isCurrentlyDisabled ? "enable" : "disable"} this form?`,
    );
    if (!confirm) return;

    try {
      const res = await fetch(
        `${SERVER_URL}/api/qa_form_list/${formHeader.QA_FORM_NAME}/status`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          credentials: "include", // 🔥 THIS IS THE FIX
          body: JSON.stringify({ status: nextStatus }),
        },
      );

      if (res.ok) {
        // alert(`✅ Form has been ${nextStatus.toLowerCase()}.`);
        onClose(); // trigger refresh from parent
      } else {
        const data = await res.json();
        alert(`❌ Failed: ${data.message}`);
      }
    } catch (err) {
      console.error("❌ Error updating status:", err);
      alert("Something went wrong.");
    }
  };

  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={onClose}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black bg-opacity-25" />
        </Transition.Child>

        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4 text-center">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <Dialog.Panel className="w-full max-w-5xl transform overflow-hidden rounded-xl bg-white p-6 text-left align-middle shadow-xl transition-all">
                <Dialog.Title className="text-xl font-bold text-gray-900 mb-4">
                  QA Form: {formHeader.QA_FORM_NAME || "—"}
                </Dialog.Title>

                {/* Header Info */}
                <div className="grid grid-cols-2 gap-y-2 gap-x-12 text-sm mb-6">
                  <div>
                    <strong>Account:</strong> {formHeader.ACCOUNT || "—"}
                  </div>
                  <div>
                    <strong>LOB:</strong> {formHeader.LOB || "—"}
                  </div>
                  <div>
                    <strong>Task:</strong> {formHeader.TASK || "—"}
                  </div>
                  <div>
                    <strong>Created Date:</strong>{" "}
                    {formHeader.CREATED_DATE
                      ? new Date(formHeader.CREATED_DATE).toLocaleDateString()
                      : "—"}
                  </div>
                  <div>
                    <strong>Created By:</strong> {formHeader.CREATED_BY || "—"}
                  </div>
                  <div>
                    <strong>Status:</strong> {formHeader.STATUS || "—"}
                  </div>
                </div>

                {/* QA Sections Table */}
                <div className="overflow-x-auto">
                  <table className="w-full border border-gray-300 text-sm">
                    <thead>
                      <tr className="bg-blue-900 text-white">
                        <th className="text-left px-4 py-2 w-1/3">Section</th>
                        <th className="text-left px-4 py-2 w-1/2">Line Item</th>
                        <th className="text-center px-4 py-2 w-1/3">
                          Pts Deduction
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {Object.entries(groupedData)
                        .filter(([key]) => key !== "__ALL")
                        .map(([compKey, compMeta]) => {
                          const compTitle =
                            compMeta.title || "Untitled Component";
                          const isZTP = compKey === "C011";

                          const matchPrefix = isZTP ? "C011_ZTP" : compKey;

                          const matchingQuestions = Object.entries(
                            groupedData.__ALL || {},
                          )
                            .filter(([_, qData]) =>
                              (qData.QUESTION || "").startsWith(
                                `${matchPrefix} -`,
                              ),
                            )
                            .map(([_, qData]) => ({
                              question: (qData.QUESTION || "").replace(
                                `${matchPrefix} -`,
                                "",
                              ),
                              deduction:
                                qData.PTS_DEDUCTIBLE || (isZTP ? "100" : "—"),
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
                                  <td className="text-center px-4 py-2">
                                    {row.deduction}
                                  </td>
                                </tr>
                              ))}
                            </React.Fragment>
                          );
                        })}
                    </tbody>
                  </table>
                </div>

                <div className="mt-6 text-right">
                  <button
                    className={`mr-3 px-4 py-2 rounded-lg text-white ${
                      formHeader.STATUS === "Disabled"
                        ? "bg-green-600 hover:bg-green-700"
                        : "bg-red-600 hover:bg-red-700"
                    }`}
                    onClick={toggleStatusHandler}
                  >
                    {formHeader.STATUS === "Disabled"
                      ? "Enable Form"
                      : "Disable Form"}
                  </button>
                  <button
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                    onClick={onClose}
                  >
                    Close
                  </button>
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
};

export default ViewQAFormModal;
