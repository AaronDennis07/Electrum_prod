import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "./AuthContext";
import { getAllDepartments, createDepartment } from "./api";
import { toast, Toaster } from "react-hot-toast";
import { Building2, Plus, RefreshCw, X } from "lucide-react";

const AdminDepartments = () => {
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newDeptName, setNewDeptName] = useState("");
  const [newDeptFName, setNewDeptFName] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const navigate = useNavigate();
  const { logout } = useAuth();

  const handleLogout = () => {
    logout();
    navigate("/admin/login");
  };

  const handleHomeClick = () => {
    navigate("/admin/session");
  };

  const fetchDepartments = async () => {
    setLoading(true);
    try {
      const data = await getAllDepartments();
      setDepartments(data.departments || []);
    } catch (error) {
      toast.error("Failed to fetch departments");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDepartments();
  }, []);

  const handleCreateDepartment = async (e) => {
    e.preventDefault();
    if (!newDeptName.trim()) {
      toast.error("Department name is required");
      return;
    }

    setIsCreating(true);
    try {
      await createDepartment(newDeptName.trim(), newDeptFName.trim());
      toast.success("Department created successfully");
      setIsModalOpen(false);
      setNewDeptName("");
      setNewDeptFName("");
      fetchDepartments();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setIsCreating(false);
    }
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
              Students
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
          <button onClick={() => navigate("/admin/students")} className="block text-slate-300 mb-2">
            Students
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
              <Building2 className="w-8 h-8 text-amber-400" />
              Department Management
            </h1>
            <p className="text-slate-400 mt-1">
              {departments.length} department{departments.length !== 1 ? "s" : ""} configured
            </p>
          </div>

          <div className="flex gap-3">
            <button
              onClick={fetchDepartments}
              className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </button>
            <button
              onClick={() => setIsModalOpen(true)}
              className="flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-900 font-medium rounded-lg transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add Department
            </button>
          </div>
        </div>

        {/* Info Box */}
        <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-4 mb-6">
          <p className="text-blue-300 text-sm">
            <strong>Important:</strong> Departments must exist in the system before you can upload students.
            If you upload a student with an unknown department, the upload will fail for that student.
          </p>
        </div>

        {/* Departments Grid */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <RefreshCw className="w-8 h-8 animate-spin text-amber-400" />
          </div>
        ) : departments.length === 0 ? (
          <div className="bg-slate-800/50 rounded-xl border border-slate-700 p-12 text-center">
            <Building2 className="w-16 h-16 text-slate-600 mx-auto mb-4" />
            <p className="text-slate-400 text-lg mb-4">No departments found</p>
            <button
              onClick={() => setIsModalOpen(true)}
              className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-900 font-medium rounded-lg transition-colors"
            >
              Create your first department
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {departments.map((dept) => (
              <div
                key={dept.id}
                className="bg-slate-800/50 rounded-xl border border-slate-700 p-6 hover:border-amber-500/50 transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-lg font-semibold text-white">{dept.name}</h3>
                    {dept.fname && (
                      <p className="text-slate-400 text-sm mt-1">{dept.fname}</p>
                    )}
                  </div>
                  <div className="px-2 py-1 bg-slate-700 rounded text-xs text-slate-400">
                    ID: {dept.id}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create Department Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-xl border border-slate-700 w-full max-w-md">
            <div className="flex items-center justify-between p-4 border-b border-slate-700">
              <h2 className="text-lg font-semibold text-white">Add New Department</h2>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateDepartment} className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">
                  Department Code <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={newDeptName}
                  onChange={(e) => setNewDeptName(e.target.value.toUpperCase())}
                  placeholder="e.g., CSE, ECE, AIML"
                  className="w-full px-4 py-2.5 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-400/50 focus:border-amber-400"
                  required
                />
                <p className="text-xs text-slate-500 mt-1">
                  This must match exactly with department names in your Excel uploads
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">
                  Full Name
                </label>
                <input
                  type="text"
                  value={newDeptFName}
                  onChange={(e) => setNewDeptFName(e.target.value)}
                  placeholder="e.g., Computer Science and Engineering"
                  className="w-full px-4 py-2.5 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-400/50 focus:border-amber-400"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 px-4 py-2.5 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isCreating}
                  className="flex-1 px-4 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-900 font-medium rounded-lg transition-colors disabled:opacity-50"
                >
                  {isCreating ? "Creating..." : "Create Department"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminDepartments;

