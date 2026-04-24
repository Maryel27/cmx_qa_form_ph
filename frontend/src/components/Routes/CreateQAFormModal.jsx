import React, { useState, useEffect } from "react";
import UserService from "../../service/UserService";
import { SERVER_URL } from "../lib/constants.js";
import axios from "axios";
import { apiFetch } from "../lib/apiFetch";

const initialFormData = {
  formName: "",
  account: "",
  lob: "",
  task: "",
  components: [
    { sectionTitle: "", attributes: [{ name: "", points: "" }] }, // C01 as default
  ],
};

const CreateQAFormModal = ({ isOpen, onClose, onSuccess, user }) => {
  const [userid, setUserId] = useState("");
  const [userName, setUserName] = useState("");
  const [accountOptions, setAccountOptions] = useState([]);
  const [lobOptions, setLobOptions] = useState([]);
  const [taskOptions, setTaskOptions] = useState([]);
  const [selectedAccount, setSelectedAccount] = useState("");
  const [selectedLob, setSelectedLob] = useState("");
  const [selectedTask, setSelectedTask] = useState("");
  const [existingFormNames, setExistingFormNames] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState(null);

  const resetForm = () => {
    setFormData(JSON.parse(JSON.stringify(initialFormData)));
    setSelectedAccount("");
    setSelectedLob("");
    setSelectedTask("");
    setIsSubmitting(false);
  };

  // useEffect(() => {
  // const firstName = localStorage.getItem("userFirstname") || "";
  // const lastName = localStorage.getItem("userLastname") || "";
  // const storedUserId = localStorage.getItem("empId");
  // const storedUserName = `${firstName} ${lastName}`.trim();

  // setUserId(storedUserId);
  // setUserName(storedUserName);

  // }, []);

  useEffect(() => {
    if (!user) return;

    setUserId(user.empId);
    setUserName(user.fullName);
  }, [user]);

  const [formData, setFormData] = useState(initialFormData);

  useEffect(() => {
    if (!isOpen) return;

    const fetchExistingFormNames = async () => {
      try {
        const res = await apiFetch(`${SERVER_URL}/api/qa_form_list`);
        if (!res) return; // session expired handled globally

        const data = await res.json();

        // 🔒 normalize response
        const rows = Array.isArray(data)
          ? data
          : Array.isArray(data.data)
            ? data.data
            : [];

        const names = rows.map((row) =>
          row.QA_FORM_NAME?.toLowerCase()?.trim(),
        );

        setExistingFormNames(names);
      } catch (error) {
        console.error("❌ Error fetching existing form names:", error);
      }
    };

    fetchExistingFormNames();
  }, [isOpen]);

  const isDuplicateFormName = existingFormNames.includes(
    formData.formName.toLowerCase().trim(),
  );

  //Account, LOB and Task Selection
  const fetchAccountList = async () => {
    try {
      const response = await apiFetch(`${SERVER_URL}/api/accountList`);
      if (!response.ok) throw new Error("Failed to fetch account list");

      const data = await response.json();
      const uniqueAccountsMap = new Map();

      data.forEach((item) => {
        const account = item.ACCOUNT?.trim();
        const lob = item.LOB?.trim();
        const task = item.TASK?.trim();
        const accountKey = account?.toLowerCase();

        // 🛑 Skip if account is null or contains "TEST"/"FLOAT"
        if (!account || /test|float/i.test(account)) return;

        if (!uniqueAccountsMap.has(accountKey)) {
          uniqueAccountsMap.set(accountKey, {
            ACCOUNT: account,
            lobs: {},
          });
        }

        if (lob) {
          if (!uniqueAccountsMap.get(accountKey).lobs[lob]) {
            uniqueAccountsMap.get(accountKey).lobs[lob] = [];
          }
          if (
            task &&
            !uniqueAccountsMap.get(accountKey).lobs[lob].includes(task)
          ) {
            uniqueAccountsMap.get(accountKey).lobs[lob].push(task);
          }
        }
      });

      // ✅ Convert to object, sorted by ACCOUNT
      const sortedAccountObj = Object.fromEntries(
        [...uniqueAccountsMap.entries()].sort((a, b) =>
          a[1].ACCOUNT.toLowerCase().localeCompare(b[1].ACCOUNT.toLowerCase()),
        ),
      );

      // Set accountOptions for dropdown
      setAccountOptions(
        Object.values(sortedAccountObj).map((item) => item.ACCOUNT),
      );

      return sortedAccountObj;
    } catch (error) {
      console.error("Error fetching account data:", error);
      return {};
    }
  };

  const fetchLobList = async (account) => {
    try {
      if (!account) return;
      const accountData = await fetchAccountList();
      const lobs = Object.keys(accountData[account.toLowerCase()]?.lobs || {});
      setLobOptions(
        lobs.sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase())),
      );
    } catch (error) {
      console.error("Error fetching LOB data:", error);
    }
  };

  const fetchTaskList = async (account, lob) => {
    try {
      if (!account || !lob) return;
      const accountData = await fetchAccountList();
      const tasks = accountData[account.toLowerCase()]?.lobs[lob] || [];
      setTaskOptions(
        tasks.sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase())),
      );
    } catch (error) {
      console.error("Error fetching Task data:", error);
    }
  };

  // Fetch accounts on component mount
  useEffect(() => {
    fetchAccountList();
  }, []);

  // Fetch LOBs when selected account changes
  useEffect(() => {
    fetchLobList(selectedAccount);
  }, [selectedAccount]);

  // Fetch Tasks when selected LOB changes
  useEffect(() => {
    fetchTaskList(selectedAccount, selectedLob);
  }, [selectedLob]);

  //Forms Section
  const handleChange = (e, componentIndex, attrIndex, field) => {
    const newComponents = [...formData.components];
    const isZTP = newComponents[componentIndex]?.isZTP;

    if (field === "sectionTitle") {
      newComponents[componentIndex].sectionTitle = e.target.value;
    } else {
      // Prevent manual editing of points for ZTP — force 100
      if (field === "points" && isZTP) {
        newComponents[componentIndex].attributes[attrIndex].points = "100";
      } else {
        newComponents[componentIndex].attributes[attrIndex][field] =
          e.target.value;
      }
    }

    setFormData({ ...formData, components: newComponents });
  };

  const addComponent = () => {
    const nonZTPComponents = formData.components.filter((c) => !c.isZTP);
    if (nonZTPComponents.length >= 10) {
      alert("Maximum 10 components allowed.");
      return;
    }

    const ztpComponent = formData.components.find((c) => c.isZTP);
    const newComponent = {
      sectionTitle: "",
      attributes: [{ name: "", points: "" }],
    };

    setFormData({
      ...formData,
      components: ztpComponent
        ? [...nonZTPComponents, newComponent, ztpComponent]
        : [...nonZTPComponents, newComponent],
    });
  };

  const addZTP = () => {
    const hasZTP = formData.components.some((c) => c.isZTP);
    if (hasZTP) {
      alert("Only one ZTP component is allowed.");
      return;
    }

    setFormData({
      ...formData,
      components: [
        ...formData.components,
        {
          sectionTitle: "",
          attributes: [{ name: "", points: "" }],
          isZTP: true,
        },
      ],
    });
  };

  const removeComponent = (index) => {
    const newComponents = formData.components.filter((_, i) => i !== index);
    setFormData({ ...formData, components: newComponents });
  };

  const addAttribute = (componentIndex) => {
    const newComponents = [...formData.components];
    if (newComponents[componentIndex].attributes.length >= 15) {
      alert("Maximum 15 attributes allowed per component.");
      return;
    }
    const isZTP = newComponents[componentIndex].isZTP;
    newComponents[componentIndex].attributes.push({
      name: "",
      points: isZTP ? "100" : "",
    });
    setFormData({ ...formData, components: newComponents });
  };

  const removeAttribute = (componentIndex, attrIndex) => {
    const newComponents = [...formData.components];
    newComponents[componentIndex].attributes.splice(attrIndex, 1);
    setFormData({ ...formData, components: newComponents });
  };

  if (!isOpen) return null;

  const nonZTPComponents = formData.components.filter((c) => !c.isZTP);
  const ztpComponent = formData.components.find((c) => c.isZTP);
  const hasZTP = Boolean(ztpComponent);

  const handleSubmit = async () => {
    const { formName } = formData;
    const createdDate = new Date().toISOString().split("T")[0];

    setIsSubmitting(true);

    try {
      /*
    ========================================
    1️⃣ SAVE FORM HEADER (qa_forms_list)
    ========================================
    */
      const res1 = await apiFetch(`${SERVER_URL}/api/qa_forms_list`, {
        method: "POST",
        body: JSON.stringify({
          QA_FORM_NAME: formName,
          ACCOUNT: selectedAccount,
          LOB: selectedLob,
          TASK: selectedTask,
          CREATED_DATE: createdDate,
          CREATED_BY: userName,
          STATUS: "Active",
        }),
      });

      if (!res1) return; // 🔥 session expired handled globally

      const data1 = await res1.json();

      if (!res1.ok || data1.success === false) {
        throw new Error(data1.error || "Failed to save QA form header");
      }

      /*
    ========================================
    2️⃣ BUILD PAYLOAD (qa_forms_table)
    ========================================
    */

      // 2️⃣ Prepare payload for db_qa_forms_table
      const fullPayload = {
        QA_FORM_NAME: formName,
      };

      let questionIndex = 1;

      formData.components.forEach((component, compIdx) => {
        if (component.isZTP) {
          fullPayload["C011_ZTP"] = component.sectionTitle;

          component.attributes.forEach((attr) => {
            if (questionIndex <= 80) {
              const qKey = `Q${String(questionIndex).padStart(3, "0")}`;
              fullPayload[`${qKey}_QUESTION`] = `C011_ZTP - ${attr.name}`;
              fullPayload[`${qKey}_PTS_DEDUCTIBLE`] = parseFloat(
                attr.points || "100",
              );
              questionIndex++;
            }
          });
        } else {
          const compField = `C${String(compIdx + 1).padStart(3, "0")}_COMP`;
          fullPayload[compField] = component.sectionTitle;

          component.attributes.forEach((attr) => {
            if (questionIndex <= 80) {
              const qKey = `Q${String(questionIndex).padStart(3, "0")}`;
              fullPayload[`${qKey}_QUESTION`] =
                `C${String(compIdx + 1).padStart(3, "0")} - ${attr.name}`;
              fullPayload[`${qKey}_PTS_DEDUCTIBLE`] = parseFloat(
                attr.points || "0",
              );
              questionIndex++;
            }
          });
        }
      });

      /*
    ========================================
    3️⃣ SAVE FORM DETAILS (qa_forms_table)
    ========================================
    */
      const res2 = await apiFetch(`${SERVER_URL}/api/qa_forms_table`, {
        method: "POST",
        body: JSON.stringify(fullPayload),
      });

      if (!res2) return;

      const data2 = await res2.json();

      if (!res2.ok || data2.success === false) {
        throw new Error(data2.error || "Failed to save QA form details");
      }

      // ✅ SUCCESS — show prompt only
      setIsSubmitting(false);
      setSubmitStatus("success");
    } catch (err) {
      console.error("❌ Submission failed:", err);

      // ❌ ERROR — show error prompt
      setIsSubmitting(false);
      setSubmitStatus("error");
    }
  };

  const isFormValid = () => {
    if (
      !formData.formName.trim() ||
      !selectedAccount ||
      !selectedLob ||
      !selectedTask
    )
      return false;

    return formData.components.every((component) => {
      if (!component.sectionTitle.trim()) return false;
      if (!component.attributes.length) return false;

      return component.attributes.every((attr) => {
        const nameFilled = attr.name.trim() !== "";

        if (component.isZTP) return nameFilled;

        const pointsFilled =
          attr.points !== null &&
          attr.points !== undefined &&
          attr.points.toString().trim() !== "";

        return nameFilled && pointsFilled;
      });
    });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      {isSubmitting && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
          <div className="flex flex-col items-center justify-center bg-white px-6 py-6 rounded-lg shadow-lg">
            <svg
              className="animate-spin h-10 w-10 text-blue-600 mb-3"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              ></circle>
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
              ></path>
            </svg>
            <p className="text-sm text-gray-600 font-medium">
              Saving, please wait...
            </p>
          </div>
        </div>
      )}

      <div className="bg-white w-full max-w-6xl h-[90vh] overflow-y-auto p-6 rounded shadow-xl">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-bold">Create New QA Form</h2>
          <button
            className="text-xl"
            onClick={() => {
              resetForm();
              onClose();
            }}
          >
            ✕
          </button>
        </div>

        {/* Form Fields */}
        <div className="grid grid-cols-3 gap-2 mb-6">
          <input
            type="text"
            name="formName"
            placeholder="Form Name *"
            className={`border p-2 col-span-3 w-2/3 border-gray-300 rounded-md focus:ring-2 ${
              isDuplicateFormName ? "ring-red-500" : "focus:ring-gray-400"
            } outline-none`}
            value={formData.formName}
            onChange={(e) =>
              setFormData({
                ...formData,
                formName: e.target.value, // Don't trim yet
              })
            }
            onBlur={(e) =>
              setFormData({
                ...formData,
                formName: e.target.value.trim(), // ✅ Trim on blur
              })
            }
          />
          {isDuplicateFormName && (
            <p className="text-red-500 text-sm mt-1 col-span-3">
              This form name already exists. Please choose another.
            </p>
          )}
          <select
            name="selectedAccount"
            className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-gray-400 outline-none"
            value={selectedAccount}
            onChange={(e) => {
              setSelectedAccount(e.target.value);
              setSelectedLob(""); // Reset LOB when changing account
              setSelectedTask(""); // Reset Task when changing account
            }}
          >
            <option value="" disabled select>
              Select an Account
            </option>
            {accountOptions.map((account, index) => (
              <option key={index} value={account}>
                {account.toUpperCase()}
              </option>
            ))}
          </select>

          <select
            name="selectedLob"
            className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-gray-400 outline-none"
            value={selectedLob}
            onChange={(e) => {
              setSelectedLob(e.target.value);
              setSelectedTask(""); // Reset Task when changing LOB
            }}
            disabled={!selectedAccount}
          >
            <option value="">Select a LOB</option>
            {lobOptions.map((LOB, index) => (
              <option key={index} value={LOB}>
                {LOB}
              </option>
            ))}
          </select>

          <select
            name="selectedTask"
            className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-gray-400 outline-none"
            value={selectedTask}
            onChange={(e) => setSelectedTask(e.target.value)}
            disabled={!selectedLob}
          >
            <option value="">Select a Task</option>
            {taskOptions.map((TASK, index) => (
              <option key={index} value={TASK}>
                {TASK}
              </option>
            ))}
          </select>
        </div>

        {/* Non-ZTP QA Components */}
        {nonZTPComponents.map((component, componentIndex) => (
          <div
            key={componentIndex}
            className="border p-4 mb-4 rounded relative"
          >
            <div className="flex justify-between items-center">
              <h3 className="font-semibold">QA Section {componentIndex + 1}</h3>
              <button
                onClick={() => removeComponent(componentIndex)}
                className="text-red-600 text-lg"
              >
                🗑️
              </button>
            </div>

            <input
              name="sectionTitle"
              type="text"
              placeholder="Section Title"
              className="border p-2 w-full my-2"
              value={component.sectionTitle}
              onChange={(e) =>
                handleChange(e, componentIndex, null, "sectionTitle")
              }
            />

            <div className="grid grid-cols-12 gap-2 font-bold mb-2">
              <div className="col-span-1">#</div>
              <div className="col-span-8">Attributes / Line Items</div>
              <div className="col-span-2">Points Deductible</div>
              <div className="col-span-1"></div>
            </div>

            {component.attributes.map((attr, attrIndex) => (
              <div
                key={attrIndex}
                className="grid grid-cols-12 gap-2 mb-2 items-center"
              >
                <div className="col-span-1">{attrIndex + 1}</div>
                <input
                  type="text"
                  className="border p-2 col-span-8"
                  placeholder="Attribute"
                  value={attr.name}
                  onChange={(e) =>
                    handleChange(e, componentIndex, attrIndex, "name")
                  }
                />
                <input
                  type="number"
                  className="border p-2 col-span-2"
                  placeholder="Points"
                  value={attr.points}
                  onChange={(e) =>
                    handleChange(e, componentIndex, attrIndex, "points")
                  }
                />
                {component.attributes.length > 1 && (
                  <button
                    onClick={() => removeAttribute(componentIndex, attrIndex)}
                    className="text-red-500 col-span-1"
                  >
                    🗑️
                  </button>
                )}
              </div>
            ))}

            {(() => {
              const lastAttr =
                component.attributes[component.attributes.length - 1];
              const isLastBlank =
                !lastAttr.name?.trim() || !lastAttr.points?.toString().trim();
              const isDisabled =
                component.attributes.length >= 15 || isLastBlank;

              return (
                <button
                  onClick={() => addAttribute(componentIndex)}
                  className={`px-4 py-1 rounded mt-2 text-white ${
                    isDisabled
                      ? "bg-gray-400 cursor-not-allowed"
                      : "bg-blue-600"
                  }`}
                  disabled={isDisabled}
                  title={
                    isLastBlank
                      ? "Please fill in the last attribute before adding more."
                      : ""
                  }
                >
                  + Add Attributes
                </button>
              );
            })()}
          </div>
        ))}

        {/* ZTP Component */}
        {ztpComponent && (
          <div className="border p-4 mb-4 rounded relative">
            <div className="flex justify-between items-center">
              <h3 className="font-semibold">ZTP Component</h3>
              <button
                onClick={() =>
                  removeComponent(formData.components.findIndex((c) => c.isZTP))
                }
                className="text-red-600 text-lg"
              >
                🗑️
              </button>
            </div>

            <input
              type="text"
              placeholder="Section Title"
              className="border p-2 w-full my-2"
              value={ztpComponent.sectionTitle}
              onChange={(e) =>
                handleChange(
                  e,
                  formData.components.findIndex((c) => c.isZTP),
                  null,
                  "sectionTitle",
                )
              }
            />

            <div className="grid grid-cols-10 gap-2 font-bold mb-2">
              <div className="col-span-1">#</div>
              <div className="col-span-8">Attributes</div>
              <div className="col-span-1"></div>
            </div>

            {ztpComponent.attributes.map((attr, attrIndex) => (
              <div
                key={attrIndex}
                className="grid grid-cols-10 gap-2 mb-2 items-center"
              >
                <div className="col-span-1">{attrIndex + 1}</div>
                <input
                  type="text"
                  className="border p-2 col-span-8"
                  placeholder="Attribute"
                  value={attr.name}
                  onChange={(e) =>
                    handleChange(
                      e,
                      formData.components.findIndex((c) => c.isZTP),
                      attrIndex,
                      "name",
                    )
                  }
                />
                {ztpComponent.attributes.length > 1 && (
                  <button
                    onClick={() =>
                      removeAttribute(
                        formData.components.findIndex((c) => c.isZTP),
                        attrIndex,
                      )
                    }
                    className="text-red-500 col-span-1"
                  >
                    🗑️
                  </button>
                )}
              </div>
            ))}

            {(() => {
              const lastZTPAttr =
                ztpComponent.attributes[ztpComponent.attributes.length - 1];
              const isZtpLastBlank = !lastZTPAttr.name?.trim(); // only check name for ZTP
              const isZtpDisabled =
                ztpComponent.attributes.length >= 21 || isZtpLastBlank;
              const ztpIndex = formData.components.findIndex((c) => c.isZTP);

              return (
                <button
                  onClick={() => addAttribute(ztpIndex)}
                  className={`px-4 py-1 rounded mt-2 text-white ${
                    isZtpDisabled
                      ? "bg-gray-400 cursor-not-allowed"
                      : "bg-blue-600"
                  }`}
                  disabled={isZtpDisabled}
                  title={
                    isZtpLastBlank
                      ? "Please complete the last ZTP attribute before adding another."
                      : ""
                  }
                >
                  + Add Attributes
                </button>
              );
            })()}
          </div>
        )}

        {/* Footer Buttons */}
        <div className="flex gap-4 mt-4">
          <button
            onClick={addComponent}
            className={`px-4 py-2 rounded text-white ${
              nonZTPComponents.length >= 10
                ? "bg-gray-400 cursor-not-allowed"
                : "bg-blue-600"
            }`}
            disabled={nonZTPComponents.length >= 10}
          >
            + Add Component
          </button>

          <button
            onClick={addZTP}
            className={`px-4 py-2 rounded text-white ${
              hasZTP ? "bg-gray-400 cursor-not-allowed" : "bg-red-600"
            }`}
            disabled={hasZTP}
          >
            + Add ZTP
          </button>

          <button
            onClick={handleSubmit}
            className={`px-4 py-2 rounded text-white ${
              isDuplicateFormName || isSubmitting || !isFormValid()
                ? "bg-gray-400 cursor-not-allowed"
                : "bg-green-600"
            }`}
            disabled={
              isDuplicateFormName || isSubmitting || !formData.formName.trim()
            }
          >
            {isSubmitting ? "Saving..." : "Create Form"}
          </button>
        </div>
      </div>

      {submitStatus && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40">
          <div
            className="bg-white rounded-lg shadow-xl px-6 py-5 w-[360px]
                      transform transition-all duration-300 scale-100 opacity-100"
          >
            {/* ICON */}
            <div className="flex justify-center mb-3">
              {submitStatus === "success" ? (
                <div className="w-12 h-12 rounded-full bg-green-100 text-green-600 flex items-center justify-center text-2xl">
                  ✓
                </div>
              ) : (
                <div className="w-12 h-12 rounded-full bg-red-100 text-red-600 flex items-center justify-center text-2xl">
                  ✕
                </div>
              )}
            </div>

            {/* MESSAGE */}
            <h3 className="text-lg font-semibold text-center mb-2">
              {submitStatus === "success"
                ? "QA Form Created Successfully"
                : "Something went wrong"}
            </h3>

            <p className="text-sm text-gray-600 text-center mb-4">
              {submitStatus === "success"
                ? "Your QA Form has been saved."
                : "Please try again."}
            </p>

            {/* ACTION */}
            <div className="flex justify-center">
              <button
                onClick={() => {
                  if (submitStatus === "success") {
                    resetForm(); // ✅ deep reset
                    onSuccess?.(); // ✅ parent refresh + close modal
                  } else {
                    setSubmitStatus(null); // Try Again → stay open
                  }
                }}
                className={`px-5 py-2 rounded text-white ${
                  submitStatus === "success"
                    ? "bg-green-600 hover:bg-green-700"
                    : "bg-red-600 hover:bg-red-700"
                }`}
              >
                {submitStatus === "success" ? "OK" : "Try Again"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CreateQAFormModal;
