import React, { useState, useRef, useEffect } from "react";
import { toast, Toaster } from "react-hot-toast";
import {
  Upload,
  FileSpreadsheet,
  X,
  Download,
  Users,
  AlertTriangle,
  CheckCircle,
  XCircle,
  ChevronDown,
  ChevronUp,
  Search,
  Building2,
} from "lucide-react";
import * as XLSX from "xlsx";
import { useNavigate } from "react-router-dom";
import { useAuth } from "./AuthContext";
import { uploadStudents, getAllDepartments, getAllStudents } from "./api";

const UploadStudent = () => {
  const [file, setFile] = useState(null);
  const [fileName, setFileName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [previewData, setPreviewData] = useState(null);
  const [departments, setDepartments] = useState([]);
  const [existingUSNs, setExistingUSNs] = useState(new Set());
  const [validationIssues, setValidationIssues] = useState([]);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [showAllRows, setShowAllRows] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const fileInputRef = useRef(null);

  const navigate = useNavigate();
  const { logout } = useAuth();

  useEffect(() => {
    fetchDepartments();
    fetchExistingStudents();
  }, []);

  const fetchDepartments = async () => {
    try {
      const data = await getAllDepartments();
      setDepartments(data.departments || []);
    } catch (error) {
      console.error("Failed to fetch departments:", error);
    }
  };

  const fetchExistingStudents = async () => {
    try {
      const data = await getAllStudents({ limit: 10000 });
      const usnSet = new Set((data.students || []).map((s) => s.usn));
      setExistingUSNs(usnSet);
    } catch (error) {
      console.error("Failed to fetch existing students:", error);
    }
  };

  const handleLogout = () => {
    logout();
    navigate("/admin/login");
  };

  const handleHomeClick = () => {
    navigate("/admin/session");
  };

  const downloadTemplate = () => {
    const wb = XLSX.utils.book_new();

    const data = [
      ["USN", "Name", "Email", "Department", "Previous Course", "Previous Course ID"],
      ["1NH21CS001", "John Doe", "john@example.com", "CSE", "Programming", "CS101"],
      ["1NH21EC001", "Jane Smith", "jane@example.com", "ECE", "Electronics", "EC101"],
    ];

    const ws = XLSX.utils.aoa_to_sheet(data);
    XLSX.utils.book_append_sheet(wb, ws, "Sheet1");

    XLSX.writeFile(wb, "student_upload_template.xlsx");
    toast.success("Template downloaded");
  };

  const validateData = (rows) => {
    const issues = [];
    const deptNames = new Set(departments.map((d) => d.name));
    const seenUSNs = new Set();

    rows.forEach((row, idx) => {
      const usn = row[0];
      const name = row[1];
      const email = row[2];
      const dept = row[3];

      // Skip header row if it looks like one
      if (idx === 0 && usn?.toLowerCase?.() === "usn") {
        return;
      }

      // Required fields
      if (!usn || String(usn).trim() === "") {
        issues.push({
          type: "error",
          row: idx + 1,
          message: `Row ${idx + 1}: Missing USN`,
        });
        return;
      }

      // Check for existing USN
      if (existingUSNs.has(usn)) {
        issues.push({
          type: "warning",
          row: idx + 1,
          message: `Row ${idx + 1}: USN "${usn}" already exists in system`,
        });
      }

      // Check for duplicates within file
      if (seenUSNs.has(usn)) {
        issues.push({
          type: "warning",
          row: idx + 1,
          message: `Row ${idx + 1}: Duplicate USN "${usn}" in file`,
        });
      }
      seenUSNs.add(usn);

      // Check department
      if (dept && !deptNames.has(dept)) {
        issues.push({
          type: "error",
          row: idx + 1,
          message: `Row ${idx + 1}: Unknown department "${dept}"`,
        });
      }

      // Check email format
      if (email && !email.includes("@")) {
        issues.push({
          type: "warning",
          row: idx + 1,
          message: `Row ${idx + 1}: Invalid email format`,
        });
      }
    });

    return issues;
  };

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (!selectedFile) return;

    setFile(selectedFile);
    setFileName(selectedFile.name);

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: "array" });

        const sheetName = workbook.SheetNames[0];
        const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], {
          header: 1,
        });

        // Filter out empty rows
        const filteredRows = rows.filter((row) =>
          row.some((cell) => cell !== undefined && cell !== "")
        );

        setPreviewData(filteredRows);

        // Validate
        const issues = validateData(filteredRows);
        setValidationIssues(issues);

        if (issues.some((i) => i.type === "error")) {
          toast.error("File has validation errors - please fix before submitting");
        } else if (issues.length > 0) {
          toast.success("File loaded with warnings - review before submitting");
        } else {
          toast.success("File loaded successfully");
        }
      } catch (err) {
        toast.error("Failed to parse Excel file");
        setFile(null);
        setFileName("");
        setPreviewData(null);
      }
    };
    reader.readAsArrayBuffer(selectedFile);
  };

  const handleRemoveFile = () => {
    setFile(null);
    setFileName("");
    setPreviewData(null);
    setValidationIssues([]);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!file) {
      toast.error("Please upload an Excel file");
      return;
    }

    if (validationIssues.some((i) => i.type === "error")) {
      toast.error("Please fix validation errors before submitting");
      return;
    }

    setIsSubmitting(true);

    const formData = new FormData();
    formData.append("student", file);

    try {
      const result = await uploadStudents(formData);

      const messages = [];
      if (result.notCreated && result.notCreated.length > 0) {
        messages.push(`${result.notCreated.length} duplicates skipped`);
      }
      if (result.skippedDept && result.skippedDept.length > 0) {
        messages.push(`${result.skippedDept.length} skipped (unknown dept)`);
      }

      if (messages.length > 0) {
        toast.success(`Upload complete. ${messages.join(", ")}`);
      } else {
        toast.success("Students uploaded successfully!");
      }

      handleRemoveFile();

      // Navigate back after delay
      setTimeout(() => navigate("/admin/students"), 1500);
    } catch (error) {
      toast.error(`Error: ${error.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Get stats
  const totalRows = previewData?.filter(
    (row, idx) => idx === 0 || row[0]?.toLowerCase?.() !== "usn"
  ).length || 0;
  const hasHeader = previewData?.[0]?.[0]?.toLowerCase?.() === "usn";
  const dataRows = hasHeader ? totalRows - 1 : totalRows;
  const errorCount = validationIssues.filter((i) => i.type === "error").length;
  const warningCount = validationIssues.filter((i) => i.type === "warning").length;
  const hasErrors = errorCount > 0;

  // Filter rows for search
  const filteredRows = previewData?.filter((row, idx) => {
    if (idx === 0 && hasHeader) return true;
    return row.some((cell) =>
      String(cell || "")
        .toLowerCase()
        .includes(searchTerm.toLowerCase())
    );
  });

  const getRowStatus = (rowIdx) => {
    const issues = validationIssues.filter((i) => i.row === rowIdx + 1);
    if (issues.some((i) => i.type === "error")) return "error";
    if (issues.some((i) => i.type === "warning")) return "warning";
    return "ok";
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Navbar */}
      <nav className="bg-slate-800/80 backdrop-blur-sm border-b border-slate-700 sticky top-0 z-50">
        <div className="container mx-auto px-4 py-3 flex justify-between items-center">
          <button
            onClick={handleHomeClick}
            className="text-slate-300 hover:text-amber-400 transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
              />
            </svg>
          </button>
          <div className="text-white text-xl font-bold tracking-wide">
            <span className="text-amber-400">Electrum</span>
            <span className="text-slate-400 text-sm ml-1">Admin</span>
          </div>
          <div className="hidden md:flex items-center gap-4">
            <button
              onClick={() => navigate("/admin/students")}
              className="text-slate-300 hover:text-amber-400 transition-colors text-sm"
            >
              View Students
            </button>
            <button
              onClick={handleLogout}
              className="text-slate-300 hover:text-red-400 transition-colors text-sm"
            >
              Logout
            </button>
          </div>
          <button
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className="md:hidden text-slate-300"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16m-7 6h7" />
            </svg>
          </button>
        </div>
      </nav>

      {isMenuOpen && (
        <div className="md:hidden bg-slate-800 border-b border-slate-700 p-4">
          <button onClick={() => navigate("/admin/students")} className="block text-slate-300 mb-2">
            View Students
          </button>
          <button onClick={handleHomeClick} className="block text-slate-300 mb-2">
            Home
          </button>
          <button onClick={handleLogout} className="block text-slate-300">
            Logout
          </button>
        </div>
      )}

      <Toaster position="top-right" />

      <div className="container mx-auto px-4 py-8 max-w-6xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">Upload Students</h1>
          <p className="text-slate-400">Add students to the system via Excel file</p>
        </div>

        {/* Template & Department Info */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-blue-300 font-medium">Download Template</p>
                <p className="text-blue-400/70 text-sm">
                  USN, Name, Email, Department, Previous Course, Previous Course ID
                </p>
              </div>
              <button
                onClick={downloadTemplate}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors"
              >
                <Download className="w-4 h-4" />
                Download
              </button>
            </div>
          </div>

          <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-amber-300 font-medium">Available Departments</p>
                <p className="text-amber-400/70 text-sm">
                  {departments.length > 0
                    ? departments.map((d) => d.name).join(", ")
                    : "No departments configured"}
                </p>
              </div>
              <button
                onClick={() => navigate("/admin/departments")}
                className="flex items-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-lg transition-colors"
              >
                <Building2 className="w-4 h-4" />
                Manage
              </button>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* File Upload */}
          <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6">
            <h2 className="text-lg font-semibold text-white mb-4">Upload Excel File</h2>

            <div className="relative">
              <input
                ref={fileInputRef}
                type="file"
                onChange={handleFileChange}
                className="hidden"
                accept=".xlsx, .xls"
                id="file-upload"
              />
              <label
                htmlFor="file-upload"
                className={`flex flex-col items-center justify-center w-full h-40 border-2 border-dashed rounded-xl cursor-pointer transition-colors ${
                  file
                    ? "border-emerald-500/50 bg-emerald-500/10"
                    : "border-slate-600 hover:border-amber-500/50 hover:bg-slate-700/50"
                }`}
              >
                {file ? (
                  <div className="flex items-center gap-3">
                    <FileSpreadsheet className="w-10 h-10 text-emerald-400" />
                    <div>
                      <p className="text-white font-medium">{fileName}</p>
                      <p className="text-slate-400 text-sm">
                        {(file.size / 1024).toFixed(1)} KB
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        handleRemoveFile();
                      }}
                      className="p-1 text-slate-400 hover:text-red-400"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                ) : (
                  <>
                    <Upload className="w-10 h-10 text-slate-400 mb-2" />
                    <p className="text-slate-300">
                      <span className="font-medium text-amber-400">Click to upload</span> or drag
                      and drop
                    </p>
                    <p className="text-slate-500 text-sm">XLSX or XLS (max 10MB)</p>
                  </>
                )}
              </label>
            </div>
          </div>

          {/* Validation Issues */}
          {validationIssues.length > 0 && (
            <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6">
              <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-amber-400" />
                Validation Issues ({errorCount} errors, {warningCount} warnings)
              </h2>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {validationIssues.slice(0, 20).map((issue, idx) => (
                  <div
                    key={idx}
                    className={`flex items-start gap-2 p-3 rounded-lg ${
                      issue.type === "error"
                        ? "bg-red-500/10 border border-red-500/30"
                        : "bg-amber-500/10 border border-amber-500/30"
                    }`}
                  >
                    {issue.type === "error" ? (
                      <XCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
                    ) : (
                      <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0" />
                    )}
                    <span className={issue.type === "error" ? "text-red-300" : "text-amber-300"}>
                      {issue.message}
                    </span>
                  </div>
                ))}
                {validationIssues.length > 20 && (
                  <p className="text-slate-400 text-sm text-center">
                    ... and {validationIssues.length - 20} more issues
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Preview */}
          {previewData && (
            <>
              {/* Summary */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4 flex items-center gap-3">
                  <div className="p-2 bg-blue-500/20 rounded-lg">
                    <Users className="w-5 h-5 text-blue-400" />
                  </div>
                  <div>
                    <p className="text-slate-400 text-sm">Students</p>
                    <p className="text-xl font-bold text-white">{dataRows}</p>
                  </div>
                </div>

                <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4 flex items-center gap-3">
                  <div className="p-2 bg-emerald-500/20 rounded-lg">
                    <CheckCircle className="w-5 h-5 text-emerald-400" />
                  </div>
                  <div>
                    <p className="text-slate-400 text-sm">Valid</p>
                    <p className="text-xl font-bold text-white">
                      {dataRows - errorCount}
                    </p>
                  </div>
                </div>

                <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4 flex items-center gap-3">
                  <div className="p-2 bg-amber-500/20 rounded-lg">
                    <AlertTriangle className="w-5 h-5 text-amber-400" />
                  </div>
                  <div>
                    <p className="text-slate-400 text-sm">Warnings</p>
                    <p className="text-xl font-bold text-white">{warningCount}</p>
                  </div>
                </div>

                <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4 flex items-center gap-3">
                  <div className="p-2 bg-red-500/20 rounded-lg">
                    <XCircle className="w-5 h-5 text-red-400" />
                  </div>
                  <div>
                    <p className="text-slate-400 text-sm">Errors</p>
                    <p className="text-xl font-bold text-white">{errorCount}</p>
                  </div>
                </div>
              </div>

              {/* Data Table */}
              <div className="bg-slate-800/50 border border-slate-700 rounded-xl overflow-hidden">
                <button
                  type="button"
                  onClick={() => setShowAllRows(!showAllRows)}
                  className="w-full flex items-center justify-between p-4 text-left hover:bg-slate-700/30 transition-colors"
                >
                  <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                    <Users className="w-5 h-5 text-blue-400" />
                    Preview Data ({dataRows} rows)
                  </h2>
                  {showAllRows ? (
                    <ChevronUp className="w-5 h-5 text-slate-400" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-slate-400" />
                  )}
                </button>

                {showAllRows && (
                  <div className="border-t border-slate-700">
                    {/* Search */}
                    <div className="p-4 border-b border-slate-700">
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input
                          type="text"
                          placeholder="Search in data..."
                          value={searchTerm}
                          onChange={(e) => setSearchTerm(e.target.value)}
                          className="w-full pl-10 pr-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-400/50"
                        />
                      </div>
                    </div>

                    <div className="overflow-x-auto max-h-96 overflow-y-auto">
                      <table className="w-full">
                        <thead className="sticky top-0">
                          <tr className="bg-slate-700">
                            <th className="px-4 py-3 text-left text-xs font-semibold text-slate-300 uppercase">
                              Status
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-slate-300 uppercase">
                              USN
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-slate-300 uppercase">
                              Name
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-slate-300 uppercase">
                              Email
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-slate-300 uppercase">
                              Department
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-slate-300 uppercase">
                              Prev Course
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-700">
                          {filteredRows?.map((row, idx) => {
                            const isHeader = idx === 0 && hasHeader;
                            const status = isHeader ? "header" : getRowStatus(idx);
                            const deptExists = !row[3] || departments.some((d) => d.name === row[3]);

                            return (
                              <tr
                                key={idx}
                                className={`
                                  ${isHeader ? "bg-slate-700/50 font-medium" : "hover:bg-slate-700/30"}
                                  ${status === "error" ? "bg-red-500/10" : ""}
                                  ${status === "warning" ? "bg-amber-500/5" : ""}
                                `}
                              >
                                <td className="px-4 py-3">
                                  {isHeader ? (
                                    <span className="text-slate-400 text-xs">HEADER</span>
                                  ) : status === "error" ? (
                                    <XCircle className="w-4 h-4 text-red-400" />
                                  ) : status === "warning" ? (
                                    <AlertTriangle className="w-4 h-4 text-amber-400" />
                                  ) : (
                                    <CheckCircle className="w-4 h-4 text-emerald-400" />
                                  )}
                                </td>
                                <td className="px-4 py-3 text-white font-mono text-sm">
                                  {row[0]}
                                  {existingUSNs.has(row[0]) && !isHeader && (
                                    <span className="ml-2 text-xs text-amber-400">(exists)</span>
                                  )}
                                </td>
                                <td className="px-4 py-3 text-slate-200">{row[1]}</td>
                                <td className="px-4 py-3 text-slate-400 text-sm">{row[2]}</td>
                                <td className="px-4 py-3">
                                  {row[3] && (
                                    <span
                                      className={`px-2 py-1 rounded text-xs ${
                                        deptExists || isHeader
                                          ? "bg-slate-600 text-slate-200"
                                          : "bg-red-500/20 text-red-400"
                                      }`}
                                    >
                                      {row[3]}
                                      {!deptExists && !isHeader && " ✗"}
                                    </span>
                                  )}
                                </td>
                                <td className="px-4 py-3 text-slate-400 text-sm">{row[4]}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}

          {/* Submit */}
          <div className="flex gap-4">
            <button
              type="button"
              onClick={() => navigate("/admin/session")}
              className="flex-1 px-6 py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-xl transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !file || hasErrors}
              className="flex-1 px-6 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? "Uploading..." : "Upload Students"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default UploadStudent;
