import React, { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "./AuthContext";
import {
  getAllStudents,
  deleteStudent,
  exportStudentsExcel,
  getAllDepartments,
  resetStudentPassword,
} from "./api";
import { toast, Toaster } from "react-hot-toast";
import {
  Search,
  Download,
  Trash2,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Users,
  Filter,
  X,
  KeyRound,
  CheckCircle,
  XCircle,
  ArrowUpDown,
} from "lucide-react";

const AdminStudents = () => {
  const [students, setStudents] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedDepartment, setSelectedDepartment] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalStudents, setTotalStudents] = useState(0);
  const [selectedStudents, setSelectedStudents] = useState(new Set());
  const [isExporting, setIsExporting] = useState(false);
  const [sortField, setSortField] = useState("usn");
  const [sortDirection, setSortDirection] = useState("asc");
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null);

  const navigate = useNavigate();
  const { logout } = useAuth();
  const ITEMS_PER_PAGE = 50;

  const handleLogout = () => {
    logout();
    navigate("/admin/login");
  };

  const handleHomeClick = () => {
    navigate("/admin/session");
  };

  const fetchDepartments = async () => {
    try {
      const data = await getAllDepartments();
      setDepartments(data.departments || []);
    } catch (error) {
      console.error("Failed to fetch departments:", error);
    }
  };

  const fetchStudents = async () => {
    setLoading(true);
    try {
      const data = await getAllStudents({
        search: searchTerm,
        department: selectedDepartment,
        page: currentPage,
        limit: ITEMS_PER_PAGE,
      });
      setStudents(data.students || []);
      setTotalPages(data.pages || 1);
      setTotalStudents(data.total || 0);
    } catch (error) {
      toast.error("Failed to fetch students");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDepartments();
  }, []);

  useEffect(() => {
    const debounceTimer = setTimeout(() => {
      fetchStudents();
    }, 300);
    return () => clearTimeout(debounceTimer);
  }, [searchTerm, selectedDepartment, currentPage]);

  const sortedStudents = useMemo(() => {
    if (!students) return [];
    return [...students].sort((a, b) => {
      let aVal = a[sortField] || "";
      let bVal = b[sortField] || "";
      if (typeof aVal === "string") aVal = aVal.toLowerCase();
      if (typeof bVal === "string") bVal = bVal.toLowerCase();
      if (sortDirection === "asc") {
        return aVal > bVal ? 1 : -1;
      }
      return aVal < bVal ? 1 : -1;
    });
  }, [students, sortField, sortDirection]);

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  const handleSelectAll = (e) => {
    if (e.target.checked) {
      setSelectedStudents(new Set(students.map((s) => s.usn)));
    } else {
      setSelectedStudents(new Set());
    }
  };

  const handleSelectStudent = (usn) => {
    const newSelected = new Set(selectedStudents);
    if (newSelected.has(usn)) {
      newSelected.delete(usn);
    } else {
      newSelected.add(usn);
    }
    setSelectedStudents(newSelected);
  };

  const handleDeleteStudent = async (usn) => {
    try {
      await deleteStudent(usn);
      toast.success(`Student ${usn} deleted`);
      setConfirmDelete(null);
      fetchStudents();
    } catch (error) {
      toast.error(error.message);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedStudents.size === 0) return;

    const confirmBulk = window.confirm(
      `Are you sure you want to delete ${selectedStudents.size} students?`
    );
    if (!confirmBulk) return;

    let deleted = 0;
    let failed = 0;

    for (const usn of selectedStudents) {
      try {
        await deleteStudent(usn);
        deleted++;
      } catch {
        failed++;
      }
    }

    toast.success(`Deleted ${deleted} students${failed > 0 ? `, ${failed} failed` : ""}`);
    setSelectedStudents(new Set());
    fetchStudents();
  };

  const handleResetPassword = async (usn) => {
    try {
      await resetStudentPassword(usn);
      toast.success(`Password reset for ${usn}`);
      fetchStudents();
    } catch (error) {
      toast.error(error.message);
    }
  };

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const blob = await exportStudentsExcel();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", "students.xlsx");
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.success("Export completed");
    } catch (error) {
      toast.error("Failed to export students");
    } finally {
      setIsExporting(false);
    }
  };

  const clearFilters = () => {
    setSearchTerm("");
    setSelectedDepartment("");
    setCurrentPage(1);
  };

  const SortIcon = ({ field }) => (
    <ArrowUpDown
      className={`w-4 h-4 inline ml-1 ${
        sortField === field ? "text-amber-400" : "text-slate-500"
      }`}
    />
  );

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
              onClick={() => navigate("/admin/departments")}
              className="text-slate-300 hover:text-amber-400 transition-colors text-sm"
            >
              Departments
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

      {/* Mobile Menu */}
      {isMenuOpen && (
        <div className="md:hidden bg-slate-800 border-b border-slate-700 p-4">
          <button onClick={() => navigate("/admin/departments")} className="block text-slate-300 mb-2">
            Departments
          </button>
          <button onClick={handleLogout} className="block text-slate-300">
            Logout
          </button>
        </div>
      )}

      <Toaster position="top-right" />

      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold text-white flex items-center gap-3">
              <Users className="w-8 h-8 text-amber-400" />
              Student Management
            </h1>
            <p className="text-slate-400 mt-1">
              {totalStudents.toLocaleString()} students in the system
            </p>
          </div>

          <div className="flex gap-3">
            <button
              onClick={fetchStudents}
              className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </button>
            <button
              onClick={handleExport}
              disabled={isExporting}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg transition-colors disabled:opacity-50"
            >
              <Download className="w-4 h-4" />
              {isExporting ? "Exporting..." : "Export Excel"}
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-slate-800/50 rounded-xl p-4 mb-6 border border-slate-700">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input
                type="text"
                placeholder="Search by USN, name, or email..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full pl-10 pr-4 py-2.5 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-400/50 focus:border-amber-400"
              />
            </div>

            <div className="relative min-w-[200px]">
              <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
              <select
                value={selectedDepartment}
                onChange={(e) => {
                  setSelectedDepartment(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full pl-10 pr-4 py-2.5 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-amber-400/50 focus:border-amber-400 appearance-none cursor-pointer"
              >
                <option value="">All Departments</option>
                {departments.map((dept) => (
                  <option key={dept.id} value={dept.name}>
                    {dept.name}
                  </option>
                ))}
              </select>
            </div>

            {(searchTerm || selectedDepartment) && (
              <button
                onClick={clearFilters}
                className="flex items-center gap-2 px-4 py-2 bg-slate-600 hover:bg-slate-500 text-white rounded-lg transition-colors"
              >
                <X className="w-4 h-4" />
                Clear
              </button>
            )}
          </div>
        </div>

        {/* Bulk Actions */}
        {selectedStudents.size > 0 && (
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 mb-6 flex items-center justify-between">
            <span className="text-amber-400 font-medium">
              {selectedStudents.size} student{selectedStudents.size > 1 ? "s" : ""} selected
            </span>
            <button
              onClick={handleBulkDelete}
              className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg transition-colors"
            >
              <Trash2 className="w-4 h-4" />
              Delete Selected
            </button>
          </div>
        )}

        {/* Table */}
        <div className="bg-slate-800/50 rounded-xl border border-slate-700 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-slate-700/50">
                  <th className="px-4 py-3 text-left">
                    <input
                      type="checkbox"
                      checked={selectedStudents.size === students.length && students.length > 0}
                      onChange={handleSelectAll}
                      className="w-4 h-4 rounded border-slate-500 text-amber-500 focus:ring-amber-400/50 bg-slate-600"
                    />
                  </th>
                  <th
                    className="px-4 py-3 text-left text-xs font-semibold text-slate-300 uppercase tracking-wider cursor-pointer hover:text-amber-400"
                    onClick={() => handleSort("usn")}
                  >
                    USN <SortIcon field="usn" />
                  </th>
                  <th
                    className="px-4 py-3 text-left text-xs font-semibold text-slate-300 uppercase tracking-wider cursor-pointer hover:text-amber-400"
                    onClick={() => handleSort("name")}
                  >
                    Name <SortIcon field="name" />
                  </th>
                  <th
                    className="px-4 py-3 text-left text-xs font-semibold text-slate-300 uppercase tracking-wider cursor-pointer hover:text-amber-400"
                    onClick={() => handleSort("email")}
                  >
                    Email <SortIcon field="email" />
                  </th>
                  <th
                    className="px-4 py-3 text-left text-xs font-semibold text-slate-300 uppercase tracking-wider cursor-pointer hover:text-amber-400"
                    onClick={() => handleSort("department")}
                  >
                    Department <SortIcon field="department" />
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-300 uppercase tracking-wider">
                    Previous Course
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-slate-300 uppercase tracking-wider">
                    Registered
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-slate-300 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700">
                {loading ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-12 text-center text-slate-400">
                      <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-2" />
                      Loading students...
                    </td>
                  </tr>
                ) : sortedStudents.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-12 text-center text-slate-400">
                      No students found
                    </td>
                  </tr>
                ) : (
                  sortedStudents.map((student) => (
                    <tr
                      key={student.usn}
                      className="hover:bg-slate-700/30 transition-colors"
                    >
                      <td className="px-4 py-3">
                        <input
                          type="checkbox"
                          checked={selectedStudents.has(student.usn)}
                          onChange={() => handleSelectStudent(student.usn)}
                          className="w-4 h-4 rounded border-slate-500 text-amber-500 focus:ring-amber-400/50 bg-slate-600"
                        />
                      </td>
                      <td className="px-4 py-3 text-white font-mono text-sm">
                        {student.usn}
                      </td>
                      <td className="px-4 py-3 text-slate-200">{student.name}</td>
                      <td className="px-4 py-3 text-slate-400 text-sm">
                        {student.email}
                      </td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-1 bg-slate-600 text-slate-200 text-xs rounded-full">
                          {student.department}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-400 text-sm">
                        {student.previous_course || "-"}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {student.has_password ? (
                          <CheckCircle className="w-5 h-5 text-emerald-400 mx-auto" />
                        ) : (
                          <XCircle className="w-5 h-5 text-slate-500 mx-auto" />
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleResetPassword(student.usn)}
                            title="Reset Password"
                            className="p-1.5 text-slate-400 hover:text-amber-400 hover:bg-slate-600 rounded transition-colors"
                          >
                            <KeyRound className="w-4 h-4" />
                          </button>
                          {confirmDelete === student.usn ? (
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => handleDeleteStudent(student.usn)}
                                className="px-2 py-1 bg-red-600 text-white text-xs rounded hover:bg-red-500"
                              >
                                Confirm
                              </button>
                              <button
                                onClick={() => setConfirmDelete(null)}
                                className="px-2 py-1 bg-slate-600 text-white text-xs rounded hover:bg-slate-500"
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => setConfirmDelete(student.usn)}
                              title="Delete Student"
                              className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-slate-600 rounded transition-colors"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-slate-700">
              <div className="text-sm text-slate-400">
                Page {currentPage} of {totalPages}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="p-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="p-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminStudents;

