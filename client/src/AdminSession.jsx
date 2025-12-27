import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "./AuthContext";
import { resetStudentPassword, registerAdmin, getAllSessions, startSession, stopSession } from "./api";
import { toast, Toaster } from "react-hot-toast";
import {
  Play,
  Square,
  Eye,
  Plus,
  Upload,
  Users,
  Calendar,
  Activity,
  Settings,
  RefreshCw,
  Building2,
  UserPlus,
  KeyRound,
  ChevronRight,
  Clock,
  CheckCircle,
  XCircle,
  Zap,
} from "lucide-react";

const AdminSessionPage = () => {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const navigate = useNavigate();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  const [resetUsn, setResetUsn] = useState("");
  const [isResetting, setIsResetting] = useState(false);
  const [isCreateAdminModalOpen, setIsCreateAdminModalOpen] = useState(false);
  const [adminName, setAdminName] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [isCreatingAdmin, setIsCreatingAdmin] = useState(false);
  const [actionLoading, setActionLoading] = useState(null);

  const { logout } = useAuth();

  const handleLogout = () => {
    logout();
    navigate("/admin/login");
  };

  const handleHomeClick = () => {
    navigate("/admin/session");
  };

  useEffect(() => {
    fetchSessions();
  }, []);

  const fetchSessions = async () => {
    setLoading(true);
    try {
      const data = await getAllSessions();
      const sortedSessions = data.sort(
        (a, b) => new Date(b.CreatedAt) - new Date(a.CreatedAt)
      );
      setSessions(sortedSessions);
      setError(null);
    } catch (err) {
      setError("Failed to fetch sessions");
      toast.error("Failed to load sessions");
    } finally {
      setLoading(false);
    }
  };

  const handleStartStop = async (sessionId, sessionName, action) => {
    setActionLoading(sessionId);
    try {
      if (action === "start") {
        await startSession(sessionId);
        toast.success(`Session "${sessionName}" started`);
      } else {
        await stopSession(sessionId);
        toast.success(`Session "${sessionName}" stopped`);
      }
      fetchSessions();
    } catch (err) {
      toast.error(`Failed to ${action} session`);
    } finally {
      setActionLoading(null);
    }
  };

  const handleDetails = (sessionId) => {
    navigate(`/admin/session/${sessionId}`);
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    setIsResetting(true);

    try {
      await resetStudentPassword(resetUsn.trim());
      toast.success("Password reset successful");
      setIsResetModalOpen(false);
      setResetUsn("");
    } catch (error) {
      toast.error(error.message);
    } finally {
      setIsResetting(false);
    }
  };

  const handleCreateAdmin = async (e) => {
    e.preventDefault();
    setIsCreatingAdmin(true);

    try {
      await registerAdmin(adminName.trim(), adminEmail.trim(), adminPassword);
      toast.success("Admin created successfully");
      setIsCreateAdminModalOpen(false);
      setAdminName("");
      setAdminEmail("");
      setAdminPassword("");
    } catch (error) {
      toast.error(error.message);
    } finally {
      setIsCreatingAdmin(false);
    }
  };

  // Stats
  const liveSessions = sessions.filter((s) => s.status === "open").length;
  const upcomingSessions = sessions.filter((s) => s.status === "upcoming").length;
  const totalStudents = sessions.reduce((acc, s) => acc + (s.total_students || 0), 0);
  const appliedStudents = sessions.reduce((acc, s) => acc + (s.applied_students || 0), 0);

  const getStatusIcon = (status) => {
    switch (status) {
      case "open":
        return <Zap className="w-4 h-4 text-emerald-400" />;
      case "closed":
        return <XCircle className="w-4 h-4 text-red-400" />;
      case "upcoming":
        return <Clock className="w-4 h-4 text-amber-400" />;
      default:
        return <CheckCircle className="w-4 h-4 text-slate-400" />;
    }
  };

  const getStatusStyles = (status) => {
    switch (status) {
      case "open":
        return "bg-emerald-500/20 text-emerald-400 border-emerald-500/30";
      case "closed":
        return "bg-red-500/20 text-red-400 border-red-500/30";
      case "upcoming":
        return "bg-amber-500/20 text-amber-400 border-amber-500/30";
      default:
        return "bg-slate-500/20 text-slate-400 border-slate-500/30";
    }
  };

  const renderSessionCard = (session) => (
    <div
      key={session.ID}
      className="bg-slate-800/50 border border-slate-700 rounded-xl p-5 hover:border-slate-600 transition-all group"
    >
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3
            className="text-lg font-semibold text-white cursor-pointer hover:text-amber-400 transition-colors"
            onClick={() => handleDetails(session.ID)}
          >
            {session.name}
          </h3>
          <p className="text-slate-400 text-sm">{session.session_type}</p>
        </div>
        <span
          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${getStatusStyles(session.status)}`}
        >
          {getStatusIcon(session.status)}
          {session.status}
        </span>
      </div>

      {/* Progress */}
      <div className="mb-4">
        <div className="flex justify-between text-sm mb-1">
          <span className="text-slate-400">Enrollment Progress</span>
          <span className="text-white font-medium">
            {session.applied_students || 0} / {session.total_students || 0}
          </span>
        </div>
        <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-amber-500 to-amber-400 rounded-full transition-all"
            style={{
              width: `${session.total_students ? ((session.applied_students || 0) / session.total_students) * 100 : 0}%`,
            }}
          />
        </div>
      </div>

      <p className="text-slate-500 text-xs mb-4">
        Created: {new Date(session.CreatedAt).toLocaleDateString()} • ID: {session.ID}
      </p>

      {/* Actions */}
      <div className="flex items-center gap-2">
        {session.status !== "open" && (
          <button
            onClick={() => handleStartStop(session.ID, session.name, "start")}
            disabled={actionLoading === session.ID}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-sm rounded-lg transition-colors disabled:opacity-50"
          >
            <Play className="w-3.5 h-3.5" />
            Start
          </button>
        )}
        {session.status === "open" && (
          <button
            onClick={() => handleStartStop(session.ID, session.name, "stop")}
            disabled={actionLoading === session.ID}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600 hover:bg-red-500 text-white text-sm rounded-lg transition-colors disabled:opacity-50"
          >
            <Square className="w-3.5 h-3.5" />
            Stop
          </button>
        )}
        <button
          onClick={() => handleDetails(session.ID)}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-600 hover:bg-slate-500 text-white text-sm rounded-lg transition-colors"
        >
          <Eye className="w-3.5 h-3.5" />
          Details
        </button>
      </div>
    </div>
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
              onClick={() => navigate("/admin/students")}
              className="text-slate-300 hover:text-amber-400 transition-colors text-sm"
            >
              Students
            </button>
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
        <div className="md:hidden bg-slate-800 border-b border-slate-700 p-4 space-y-2">
          <button onClick={() => navigate("/admin/students")} className="block text-slate-300 w-full text-left py-2">
            Students
          </button>
          <button onClick={() => navigate("/admin/departments")} className="block text-slate-300 w-full text-left py-2">
            Departments
          </button>
          <button onClick={handleLogout} className="block text-slate-300 w-full text-left py-2">
            Logout
          </button>
        </div>
      )}

      <Toaster position="top-right" />

      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">Admin Dashboard</h1>
          <p className="text-slate-400">Manage sessions, students, and enrollment</p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-emerald-500/20 rounded-lg">
                <Activity className="w-5 h-5 text-emerald-400" />
              </div>
              <span className="text-slate-400 text-sm">Live Sessions</span>
            </div>
            <p className="text-2xl font-bold text-white">{liveSessions}</p>
          </div>

          <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-amber-500/20 rounded-lg">
                <Clock className="w-5 h-5 text-amber-400" />
              </div>
              <span className="text-slate-400 text-sm">Upcoming</span>
            </div>
            <p className="text-2xl font-bold text-white">{upcomingSessions}</p>
          </div>

          <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-blue-500/20 rounded-lg">
                <Users className="w-5 h-5 text-blue-400" />
              </div>
              <span className="text-slate-400 text-sm">Total Students</span>
            </div>
            <p className="text-2xl font-bold text-white">{totalStudents.toLocaleString()}</p>
          </div>

          <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-purple-500/20 rounded-lg">
                <CheckCircle className="w-5 h-5 text-purple-400" />
              </div>
              <span className="text-slate-400 text-sm">Enrolled</span>
            </div>
            <p className="text-2xl font-bold text-white">{appliedStudents.toLocaleString()}</p>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <button
            onClick={() => navigate("/admin/create")}
            className="flex items-center gap-3 p-4 bg-gradient-to-br from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 rounded-xl transition-all group"
          >
            <Plus className="w-6 h-6 text-slate-900" />
            <div className="text-left">
              <p className="font-semibold text-slate-900">New Session</p>
              <p className="text-xs text-slate-800">Create with Excel</p>
            </div>
            <ChevronRight className="w-5 h-5 text-slate-900 ml-auto opacity-0 group-hover:opacity-100 transition-opacity" />
          </button>

          <button
            onClick={() => navigate("/admin/upload")}
            className="flex items-center gap-3 p-4 bg-slate-700 hover:bg-slate-600 rounded-xl transition-all group border border-slate-600"
          >
            <Upload className="w-6 h-6 text-emerald-400" />
            <div className="text-left">
              <p className="font-semibold text-white">Upload Students</p>
              <p className="text-xs text-slate-400">Add via Excel</p>
            </div>
            <ChevronRight className="w-5 h-5 text-slate-400 ml-auto opacity-0 group-hover:opacity-100 transition-opacity" />
          </button>

          <button
            onClick={() => setIsResetModalOpen(true)}
            className="flex items-center gap-3 p-4 bg-slate-700 hover:bg-slate-600 rounded-xl transition-all group border border-slate-600"
          >
            <KeyRound className="w-6 h-6 text-amber-400" />
            <div className="text-left">
              <p className="font-semibold text-white">Reset Password</p>
              <p className="text-xs text-slate-400">Student password</p>
            </div>
            <ChevronRight className="w-5 h-5 text-slate-400 ml-auto opacity-0 group-hover:opacity-100 transition-opacity" />
          </button>

          <button
            onClick={() => setIsCreateAdminModalOpen(true)}
            className="flex items-center gap-3 p-4 bg-slate-700 hover:bg-slate-600 rounded-xl transition-all group border border-slate-600"
          >
            <UserPlus className="w-6 h-6 text-purple-400" />
            <div className="text-left">
              <p className="font-semibold text-white">Create Admin</p>
              <p className="text-xs text-slate-400">New admin user</p>
            </div>
            <ChevronRight className="w-5 h-5 text-slate-400 ml-auto opacity-0 group-hover:opacity-100 transition-opacity" />
          </button>
        </div>

        {/* Sessions */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-white">Sessions</h2>
          <button
            onClick={fetchSessions}
            className="flex items-center gap-2 px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-300 text-sm rounded-lg transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <RefreshCw className="w-8 h-8 animate-spin text-amber-400" />
          </div>
        ) : error ? (
          <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-6 text-center">
            <p className="text-red-400">{error}</p>
            <button
              onClick={fetchSessions}
              className="mt-4 px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg"
            >
              Retry
            </button>
          </div>
        ) : sessions.length === 0 ? (
          <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-12 text-center">
            <Calendar className="w-16 h-16 text-slate-600 mx-auto mb-4" />
            <p className="text-slate-400 text-lg mb-4">No sessions found</p>
            <button
              onClick={() => navigate("/admin/create")}
              className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-900 font-medium rounded-lg transition-colors"
            >
              Create your first session
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {sessions.map(renderSessionCard)}
          </div>
        )}
      </div>

      {/* Reset Password Modal */}
      {isResetModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-xl border border-slate-700 w-full max-w-md">
            <div className="flex items-center justify-between p-4 border-b border-slate-700">
              <h2 className="text-lg font-semibold text-white">Reset Student Password</h2>
              <button
                onClick={() => {
                  setIsResetModalOpen(false);
                  setResetUsn("");
                }}
                className="text-slate-400 hover:text-white transition-colors"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleResetPassword} className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">
                  Student USN
                </label>
                <input
                  type="text"
                  value={resetUsn}
                  onChange={(e) => setResetUsn(e.target.value.toUpperCase())}
                  placeholder="e.g., 1NH21CS001"
                  className="w-full px-4 py-2.5 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-400/50 focus:border-amber-400"
                  required
                />
                <p className="text-xs text-slate-500 mt-1">
                  This will clear the password and require the student to register again
                </p>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsResetModalOpen(false);
                    setResetUsn("");
                  }}
                  className="flex-1 px-4 py-2.5 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isResetting}
                  className="flex-1 px-4 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-900 font-medium rounded-lg transition-colors disabled:opacity-50"
                >
                  {isResetting ? "Resetting..." : "Reset Password"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Create Admin Modal */}
      {isCreateAdminModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-xl border border-slate-700 w-full max-w-md">
            <div className="flex items-center justify-between p-4 border-b border-slate-700">
              <h2 className="text-lg font-semibold text-white">Create New Admin</h2>
              <button
                onClick={() => {
                  setIsCreateAdminModalOpen(false);
                  setAdminName("");
                  setAdminEmail("");
                  setAdminPassword("");
                }}
                className="text-slate-400 hover:text-white transition-colors"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateAdmin} className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">
                  Name
                </label>
                <input
                  type="text"
                  value={adminName}
                  onChange={(e) => setAdminName(e.target.value)}
                  placeholder="Admin Name"
                  className="w-full px-4 py-2.5 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-400/50 focus:border-amber-400"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">
                  Email
                </label>
                <input
                  type="email"
                  value={adminEmail}
                  onChange={(e) => setAdminEmail(e.target.value)}
                  placeholder="admin@example.com"
                  className="w-full px-4 py-2.5 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-400/50 focus:border-amber-400"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">
                  Password
                </label>
                <input
                  type="password"
                  value={adminPassword}
                  onChange={(e) => setAdminPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-4 py-2.5 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-400/50 focus:border-amber-400"
                  required
                  minLength={6}
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsCreateAdminModalOpen(false);
                    setAdminName("");
                    setAdminEmail("");
                    setAdminPassword("");
                  }}
                  className="flex-1 px-4 py-2.5 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isCreatingAdmin}
                  className="flex-1 px-4 py-2.5 bg-purple-600 hover:bg-purple-500 text-white font-medium rounded-lg transition-colors disabled:opacity-50"
                >
                  {isCreatingAdmin ? "Creating..." : "Create Admin"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminSessionPage;
