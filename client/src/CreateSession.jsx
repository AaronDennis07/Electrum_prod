import React, { useState, useEffect } from "react";
import { toast, Toaster } from "react-hot-toast";
import {
  Upload,
  FileSpreadsheet,
  X,
  Download,
  Users,
  BookOpen,
  AlertTriangle,
  CheckCircle,
  ChevronDown,
  ChevronUp,
  Search,
} from "lucide-react";
import * as XLSX from "xlsx";
import { useNavigate } from "react-router-dom";
import { useAuth } from "./AuthContext";
import { createSession, getAllDepartments } from "./api";

const CreateSessionForm = () => {
  const [sessionName, setSessionName] = useState("");
  const [sessionType, setSessionType] = useState("open");
  const [file, setFile] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [excelData, setExcelData] = useState(null);
  const [departments, setDepartments] = useState([]);
  const [departmentsLoading, setDepartmentsLoading] = useState(true);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [showAllUSNs, setShowAllUSNs] = useState(false);
  const [showAllCourses, setShowAllCourses] = useState(true);
  const [usnSearch, setUsnSearch] = useState("");
  const [validationIssues, setValidationIssues] = useState([]);

  const navigate = useNavigate();
  const { logout } = useAuth();

  useEffect(() => {
    fetchDepartments();
  }, []);

  // Re-validate when departments finish loading and there's already data uploaded
  useEffect(() => {
    if (!departmentsLoading && excelData) {
      const issues = validateData(excelData.students || [], excelData.courses || []);
      setValidationIssues(issues);
    }
  }, [departmentsLoading, departments]);

  const fetchDepartments = async () => {
    setDepartmentsLoading(true);
    try {
      const data = await getAllDepartments();
      setDepartments(data.departments || []);
    } catch (error) {
      console.error("Failed to fetch departments:", error);
      toast.error("Failed to load departments");
    } finally {
      setDepartmentsLoading(false);
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

    // Sheet 1: USNs
    const usnData = [["1NH21CS001"], ["1NH21CS002"], ["1NH21CS003"]];
    const ws1 = XLSX.utils.aoa_to_sheet(usnData);
    XLSX.utils.book_append_sheet(wb, ws1, "Sheet1");

    // Sheet 2: Courses
    const courseData = [
      ["CODE101", "Introduction to Programming", 60, "CSE"],
      ["CODE102", "Data Structures", 60, "CSE"],
      ["CODE103", "Machine Learning Basics", 40, "AIML"],
    ];
    const ws2 = XLSX.utils.aoa_to_sheet(courseData);
    XLSX.utils.book_append_sheet(wb, ws2, "Sheet2");

    XLSX.writeFile(wb, "session_template.xlsx");
    toast.success("Template downloaded");
  };

  const validateData = (students, courses) => {
    const issues = [];
    const deptNames = new Set(departments.map((d) => d.name));

    // Check for invalid departments in courses (only if departments have loaded)
    courses.forEach((course, idx) => {
      // Only validate department if departments have been loaded
      if (course.Department && departments.length > 0 && !deptNames.has(course.Department)) {
        issues.push({
          type: "error",
          message: `Course "${course.Name}" has unknown department "${course.Department}"`,
        });
      }
      // Warn if departments haven't loaded and course has department specified
      if (course.Department && departmentsLoading) {
        issues.push({
          type: "warning",
          message: `Department validation pending for course "${course.Name}" - departments still loading`,
        });
      }
      if (!course.Code || !course.Name) {
        issues.push({
          type: "error",
          message: `Row ${idx + 1} in courses is missing required fields (Code or Name)`,
        });
      }
      if (!course.Seats || course.Seats <= 0) {
        issues.push({
          type: "warning",
          message: `Course "${course.Name || "Unknown"}" has invalid seat count`,
        });
      }
    });

    // Check for empty USNs
    const emptyUsns = students.filter((u) => !u || u.trim() === "").length;
    if (emptyUsns > 0) {
      issues.push({
        type: "warning",
        message: `${emptyUsns} empty USN entries will be skipped`,
      });
    }

    // Check for duplicate USNs
    const usnSet = new Set();
    const duplicates = [];
    students.forEach((usn) => {
      if (usn && usnSet.has(usn.trim())) {
        duplicates.push(usn);
      }
      if (usn) usnSet.add(usn.trim());
    });
    if (duplicates.length > 0) {
      issues.push({
        type: "warning",
        message: `${duplicates.length} duplicate USNs found`,
      });
    }

    return issues;
  };

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    setFile(selectedFile);

    if (selectedFile) {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target.result);
          const workbook = XLSX.read(data, { type: "array" });

          if (workbook.SheetNames.length < 2) {
            toast.error("Excel file must have at least 2 sheets");
            setFile(null);
            setExcelData(null);
            return;
          }

          const firstSheetName = workbook.SheetNames[0];
          const secondSheetName = workbook.SheetNames[1];

          // Get USNs from first sheet (first column only)
          const firstSheetData = XLSX.utils.sheet_to_json(
            workbook.Sheets[firstSheetName],
            { header: 1 }
          );
          const eligibleUSN = firstSheetData
            .map((row) => row[0])
            .filter((usn) => usn && String(usn).trim() !== "");

          // Get courses from second sheet
          const secondSheetRows = XLSX.utils.sheet_to_json(
            workbook.Sheets[secondSheetName],
            { header: 1 }
          );
          const courseInfo = secondSheetRows.map((row) => ({
            Code: row[0],
            Name: row[1],
            Seats: parseInt(row[2]) || 0,
            Department: row[3],
          }));

          const parsedData = {
            eligibleUSN,
            courseInfo,
          };

          setExcelData(parsedData);

          // Validate
          const issues = validateData(eligibleUSN, courseInfo);
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
          setExcelData(null);
        }
      };
      reader.readAsArrayBuffer(selectedFile);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!sessionName.trim()) {
      toast.error("Session name is required");
      return;
    }

    if (!file || !excelData) {
      toast.error("Please upload an Excel file");
      return;
    }

    if (validationIssues.some((i) => i.type === "error")) {
      toast.error("Please fix validation errors before submitting");
      return;
    }

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
      const result = await createSession(formData);
      toast.success("Session created successfully!");

      // Show summary
      if (result.notFound && result.notFound.length > 0) {
        toast(`${result.notFound.length} USNs not found in system`, { icon: "⚠️" });
      }

      setSessionName("");
      setSessionType("open");
      setFile(null);
      setExcelData(null);
      setValidationIssues([]);

      // Navigate back after delay
      setTimeout(() => navigate("/admin/session"), 1500);
    } catch (error) {
      toast.error(`Error: ${error.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredUSNs = excelData?.eligibleUSN?.filter((usn) =>
    String(usn).toLowerCase().includes(usnSearch.toLowerCase())
  );

  const totalSeats = excelData?.courseInfo?.reduce((acc, c) => acc + (c.Seats || 0), 0) || 0;
  const hasErrors = validationIssues.some((i) => i.type === "error");

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
          <div className="hidden md:flex items-center">
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
          <h1 className="text-3xl font-bold text-white mb-2">Create New Session</h1>
          <p className="text-slate-400">Upload an Excel file with eligible students and courses</p>
        </div>

        {/* Template Download */}
        <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-4 mb-6 flex items-center justify-between">
          <div>
            <p className="text-blue-300 font-medium">Need the template?</p>
            <p className="text-blue-400/70 text-sm">
              Sheet1: USNs (column A) | Sheet2: Code, Name, Seats, Department
            </p>
          </div>
          <button
            onClick={downloadTemplate}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors"
          >
            <Download className="w-4 h-4" />
            Download Template
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Session Details */}
          <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6">
            <h2 className="text-lg font-semibold text-white mb-4">Session Details</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">
                  Session Name <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={sessionName}
                  onChange={(e) => setSessionName(e.target.value)}
                  placeholder="e.g., Open Elective 2025 Odd Sem"
                  className="w-full px-4 py-2.5 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-400/50 focus:border-amber-400"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">
                  Session Type
                </label>
                <select
                  value={sessionType}
                  onChange={(e) => setSessionType(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-amber-400/50 focus:border-amber-400"
                >
                  <option value="open">Open Elective</option>
                  <option value="professional">Professional Elective</option>
                </select>
              </div>
            </div>
          </div>

          {/* File Upload */}
          <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-white">Upload Excel File</h2>
              {departmentsLoading ? (
                <span className="text-amber-400 text-sm flex items-center gap-1">
                  <span className="animate-spin">⏳</span> Loading departments...
                </span>
              ) : (
                <span className="text-emerald-400 text-sm flex items-center gap-1">
                  <CheckCircle className="w-4 h-4" /> {departments.length} departments loaded
                </span>
              )}
            </div>

            <div className="relative">
              <input
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
                      <p className="text-white font-medium">{file.name}</p>
                      <p className="text-slate-400 text-sm">
                        {(file.size / 1024).toFixed(1)} KB
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        setFile(null);
                        setExcelData(null);
                        setValidationIssues([]);
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
                      <span className="font-medium text-amber-400">Click to upload</span> or drag and drop
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
                Validation Issues
              </h2>
              <div className="space-y-2">
                {validationIssues.map((issue, idx) => (
                  <div
                    key={idx}
                    className={`flex items-start gap-2 p-3 rounded-lg ${
                      issue.type === "error"
                        ? "bg-red-500/10 border border-red-500/30"
                        : "bg-amber-500/10 border border-amber-500/30"
                    }`}
                  >
                    {issue.type === "error" ? (
                      <X className="w-5 h-5 text-red-400 flex-shrink-0" />
                    ) : (
                      <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0" />
                    )}
                    <span className={issue.type === "error" ? "text-red-300" : "text-amber-300"}>
                      {issue.message}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Data Preview */}
          {excelData && (
            <>
              {/* Summary Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4 flex items-center gap-4">
                  <div className="p-3 bg-blue-500/20 rounded-lg">
                    <Users className="w-6 h-6 text-blue-400" />
                  </div>
                  <div>
                    <p className="text-slate-400 text-sm">Eligible Students</p>
                    <p className="text-2xl font-bold text-white">
                      {excelData.eligibleUSN?.length || 0}
                    </p>
                  </div>
                </div>

                <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4 flex items-center gap-4">
                  <div className="p-3 bg-emerald-500/20 rounded-lg">
                    <BookOpen className="w-6 h-6 text-emerald-400" />
                  </div>
                  <div>
                    <p className="text-slate-400 text-sm">Courses</p>
                    <p className="text-2xl font-bold text-white">
                      {excelData.courseInfo?.length || 0}
                    </p>
                  </div>
                </div>

                <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4 flex items-center gap-4">
                  <div className="p-3 bg-amber-500/20 rounded-lg">
                    <CheckCircle className="w-6 h-6 text-amber-400" />
                  </div>
                  <div>
                    <p className="text-slate-400 text-sm">Total Seats</p>
                    <p className="text-2xl font-bold text-white">{totalSeats}</p>
                  </div>
                </div>
              </div>

              {/* Courses Table */}
              <div className="bg-slate-800/50 border border-slate-700 rounded-xl overflow-hidden">
                <button
                  type="button"
                  onClick={() => setShowAllCourses(!showAllCourses)}
                  className="w-full flex items-center justify-between p-4 text-left hover:bg-slate-700/30 transition-colors"
                >
                  <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                    <BookOpen className="w-5 h-5 text-emerald-400" />
                    Courses ({excelData.courseInfo?.length || 0})
                  </h2>
                  {showAllCourses ? (
                    <ChevronUp className="w-5 h-5 text-slate-400" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-slate-400" />
                  )}
                </button>

                {showAllCourses && (
                  <div className="border-t border-slate-700 overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="bg-slate-700/50">
                          <th className="px-4 py-3 text-left text-xs font-semibold text-slate-300 uppercase">
                            #
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-slate-300 uppercase">
                            Code
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-slate-300 uppercase">
                            Name
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-slate-300 uppercase">
                            Seats
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-slate-300 uppercase">
                            Department
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-700">
                        {excelData.courseInfo?.map((course, idx) => {
                          const deptExists = departments.some(
                            (d) => d.name === course.Department
                          );
                          return (
                            <tr
                              key={idx}
                              className={`hover:bg-slate-700/30 ${
                                !deptExists ? "bg-red-500/10" : ""
                              }`}
                            >
                              <td className="px-4 py-3 text-slate-400 text-sm">
                                {idx + 1}
                              </td>
                              <td className="px-4 py-3 text-white font-mono text-sm">
                                {course.Code}
                              </td>
                              <td className="px-4 py-3 text-slate-200">
                                {course.Name}
                              </td>
                              <td className="px-4 py-3 text-slate-200">
                                {course.Seats}
                              </td>
                              <td className="px-4 py-3">
                                <span
                                  className={`px-2 py-1 rounded text-xs ${
                                    deptExists
                                      ? "bg-slate-600 text-slate-200"
                                      : "bg-red-500/20 text-red-400"
                                  }`}
                                >
                                  {course.Department}
                                  {!deptExists && " (not found)"}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* USNs Table */}
              <div className="bg-slate-800/50 border border-slate-700 rounded-xl overflow-hidden">
                <button
                  type="button"
                  onClick={() => setShowAllUSNs(!showAllUSNs)}
                  className="w-full flex items-center justify-between p-4 text-left hover:bg-slate-700/30 transition-colors"
                >
                  <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                    <Users className="w-5 h-5 text-blue-400" />
                    Eligible Students ({excelData.eligibleUSN?.length || 0})
                  </h2>
                  {showAllUSNs ? (
                    <ChevronUp className="w-5 h-5 text-slate-400" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-slate-400" />
                  )}
                </button>

                {showAllUSNs && (
                  <div className="border-t border-slate-700">
                    {/* Search */}
                    <div className="p-4 border-b border-slate-700">
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input
                          type="text"
                          placeholder="Search USN..."
                          value={usnSearch}
                          onChange={(e) => setUsnSearch(e.target.value)}
                          className="w-full pl-10 pr-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-400/50"
                        />
                      </div>
                    </div>

                    {/* USN Grid */}
                    <div className="p-4 max-h-96 overflow-y-auto">
                      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2">
                        {filteredUSNs?.map((usn, idx) => (
                          <div
                            key={idx}
                            className="px-3 py-2 bg-slate-700 rounded text-slate-200 text-sm font-mono truncate"
                          >
                            {usn}
                          </div>
                        ))}
                      </div>
                      {filteredUSNs?.length === 0 && (
                        <p className="text-slate-400 text-center py-4">
                          No USNs match your search
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </>
          )}

          {/* Submit Button */}
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
              disabled={isSubmitting || !file || !sessionName || hasErrors}
              className="flex-1 px-6 py-3 bg-amber-500 hover:bg-amber-400 text-slate-900 font-semibold rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
