import React, { useState } from "react";
import { toast, Toaster } from "react-hot-toast";
import { Upload, FileText, X } from "lucide-react";
import * as XLSX from "xlsx";
import { useNavigate } from "react-router-dom";
import { useAuth } from "./AuthContext";

const CreateSessionForm = () => {
  const [sessionName, setSessionName] = useState("");
  const [sessionType, setSessionType] = useState("open");
  const [file, setFile] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [excelData, setExcelData] = useState(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const navigate = useNavigate();
  const { logout } = useAuth();

  const handleLogout = () => {
    logout();
    navigate("/admin/login");
  };

  const handleHomeClick = () => {
    navigate("/admin/session"); // Adjust this path to your actual home page route
  };

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    setFile(selectedFile);

    if (selectedFile) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: "array" });

        const firstSheetName = workbook.SheetNames[0];
        const secondSheetName = workbook.SheetNames[1];

        const firstSheetData = XLSX.utils.sheet_to_json(
          workbook.Sheets[firstSheetName],
          { header: 1 }
        );
        const firstColumnData = firstSheetData.map((row) => row[0]);
        const secondSheetData = XLSX.utils.sheet_to_json(
          workbook.Sheets[secondSheetName]
        );

        setExcelData({
          eligibleUSN: firstColumnData,
          courseInfo: secondSheetData,
        });
      };
      reader.readAsArrayBuffer(selectedFile);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);

    const formData = new FormData();
    formData.append("file", file);

    const sessionData = {
      session: {
        name: sessionName,
        session_type: sessionType,
      },
    };

    formData.append("data", JSON.stringify(sessionData));

    try {
      const response = await fetch("http://127.0.0.1:8000/session", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error("Failed to create session");
      }

      toast.success("Session created successfully!");
      setSessionName("");
      setSessionType("open");
      setFile(null);
      setExcelData(null);
    } catch (error) {
      toast.error(`Error creating session: ${error.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-gray-100 min-h-screen">
      {/* Navbar */}
      <nav className="bg-indigo-600 p-4">
        <div className="container mx-auto flex justify-between items-center">
          <button
            onClick={handleHomeClick}
            className="text-white hover:text-indigo-200"
          >
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
              ></path>
            </svg>
          </button>
          <div className="text-white text-2xl font-bold">Electrum@NHCE</div>
          <div className="hidden md:flex items-center">
            <button
              onClick={handleLogout}
              className="text-white hover:text-indigo-200"
            >
              Logout
            </button>
          </div>
          <div className="md:hidden">
            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="text-white"
            >
              <svg
                className="w-6 h-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M4 6h16M4 12h16m-7 6h7"
                ></path>
              </svg>
            </button>
          </div>
        </div>
      </nav>

      {/* Mobile Menu */}
      {isMenuOpen && (
        <div className="md:hidden bg-indigo-500 p-4">
          <button onClick={handleHomeClick} className="block text-white mb-2">
            Home
          </button>
          <button onClick={handleLogout} className="block text-white">
            Logout
          </button>
        </div>
      )}
      <div className="max-w-4xl mx-auto p-6 bg-white rounded-lg shadow-lg">
        <Toaster />
        <h2 className="text-2xl font-bold mb-6 text-center">
          Create New Session
        </h2>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label
              htmlFor="sessionName"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Session Name
            </label>
            <input
              id="sessionName"
              type="text"
              value={sessionName}
              onChange={(e) => setSessionName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>
          <div>
            <label
              htmlFor="sessionType"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Session Type
            </label>
            <select
              id="sessionType"
              value={sessionType}
              onChange={(e) => setSessionType(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="open">Open</option>
              <option value="professional">Professional</option>
            </select>
          </div>
          <div>
            <label
              htmlFor="file"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Upload Excel File
            </label>
            <div className="flex items-center justify-center w-full">
              <label
                htmlFor="file"
                className="flex flex-col items-center justify-center w-full h-64 border-2 border-gray-300 border-dashed rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100"
              >
                <div className="flex flex-col items-center justify-center pt-5 pb-6">
                  <Upload className="w-10 h-10 mb-3 text-gray-400" />
                  <p className="mb-2 text-sm text-gray-500">
                    <span className="font-semibold">Click to upload</span> or
                    drag and drop
                  </p>
                  <p className="text-xs text-gray-500">
                    XLSX or XLS (MAX. 10MB)
                  </p>
                </div>
                <input
                  id="file"
                  type="file"
                  onChange={handleFileChange}
                  className="hidden"
                  accept=".xlsx, .xls"
                  required
                />
              </label>
            </div>
            {file && (
              <div className="mt-2 flex items-center">
                <FileText className="w-5 h-5 mr-2 text-blue-500" />
                <span className="text-sm text-gray-600">{file.name}</span>
                <button
                  type="button"
                  onClick={() => {
                    setFile(null);
                    setExcelData(null);
                  }}
                  className="ml-2 text-red-500 hover:text-red-700"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            )}
          </div>
          {/* {excelData && (
          <div className="space-y-4 bg-blue-50 p-4 rounded-lg">
            <h3 className="text-lg font-semibold text-blue-700">Excel File Contents</h3>
            <div>
              <h4 className="text-md font-semibold text-blue-600">Eligible USNs (Sheet 1)</h4>
              <ul className="list-disc list-inside">
                {excelData.eligibleUSN.slice(0, 5).map((item, index) => (
                  <li key={index} className="text-gray-700">{item.USN}</li>
                ))}
                {excelData.eligibleUSN.length > 5 && <li className="text-gray-700">...</li>}
              </ul>
            </div>
            <div>
              <h4 className="text-md font-semibold text-blue-600">Course Information (Sheet 2)</h4>
              <ul className="list-disc list-inside">
                {excelData.courseInfo.map((item, index) => (
                  <li key={index} className="text-gray-700">
                    {item.course_name} (ID: {item.course_id}, Dept: {item.department}, Sheets: {item.number_of_sheets})
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )} */}
          <div>
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full bg-blue-500 text-white py-2 px-4 rounded-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50 disabled:opacity-50"
            >
              {isSubmitting ? "Creating Session..." : "Create Session"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateSessionForm;
