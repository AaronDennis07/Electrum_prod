import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "./AuthContext";
import { API_BASE } from "./api";
import {
  Calendar,
  Clock,
  Users,
  Zap,
  CheckCircle,
  XCircle,
  ArrowRight,
  BookOpen,
  Loader2,
  RefreshCw,
  LogOut,
} from "lucide-react";

const SessionListPage = () => {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const navigate = useNavigate();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const { user, logout } = useAuth();

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const fetchSessions = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE}/session`);
      if (!response.ok) {
        throw new Error("Network response was not ok");
      }
      const data = await response.json();
      setSessions(data);
      setError(null);
    } catch (error) {
      setError("Failed to fetch sessions");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSessions();
  }, []);

  const handleApply = (sessionId) => {
    navigate(`/enroll/${sessionId}`);
  };

  const getStatusConfig = (status) => {
    switch (status) {
      case "open":
        return {
          icon: <Zap className="w-3.5 h-3.5" />,
          label: "Live",
          bg: "bg-emerald-50",
          text: "text-emerald-700",
          border: "border-emerald-200",
        };
      case "closed":
        return {
          icon: <CheckCircle className="w-3.5 h-3.5" />,
          label: "Closed",
          bg: "bg-slate-100",
          text: "text-slate-600",
          border: "border-slate-200",
        };
      case "upcoming":
        return {
          icon: <Clock className="w-3.5 h-3.5" />,
          label: "Upcoming",
          bg: "bg-amber-50",
          text: "text-amber-700",
          border: "border-amber-200",
        };
      default:
        return {
          icon: <CheckCircle className="w-3.5 h-3.5" />,
          label: status,
          bg: "bg-slate-100",
          text: "text-slate-600",
          border: "border-slate-200",
        };
    }
  };

  const liveSessions = sessions.filter((session) => session.status === "open");
  const upcomingSessions = sessions.filter((session) => session.status === "upcoming");
  const closedSessions = sessions.filter((session) => session.status === "closed");

  const renderSessionCard = (session) => {
    const statusConfig = getStatusConfig(session.status);
    const progressPercent = session.total_students
      ? ((session.applied_students || 0) / session.total_students) * 100
      : 0;

    return (
      <div
        key={session.ID}
        className={`bg-white border rounded-xl overflow-hidden transition-all duration-200 hover:shadow-md ${
          session.status === "open" ? "border-emerald-200" : "border-slate-200"
        }`}
      >
        <div className="p-5">
          {/* Header */}
          <div className="flex items-start justify-between mb-3">
            <div className="flex-1 min-w-0">
              <h3 className="text-lg font-semibold text-slate-800 truncate">{session.name}</h3>
              <p className="text-slate-500 text-sm">{session.session_type}</p>
            </div>
            <span
              className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border ${statusConfig.bg} ${statusConfig.text} ${statusConfig.border}`}
            >
              {statusConfig.icon}
              {statusConfig.label}
            </span>
          </div>

          {/* Stats for Open Sessions */}
          {session.status === "open" && (
            <div className="mb-4">
              <div className="flex justify-between items-center mb-1.5">
                <span className="text-slate-500 text-sm flex items-center gap-1">
                  <Users className="w-4 h-4" />
                  Enrollment
                </span>
                <span className="text-slate-700 text-sm font-medium">
                  {session.applied_students || 0} / {session.total_students || 0}
                </span>
              </div>
              <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>
          )}

          {/* Actions */}
          {session.status === "open" && (
            <button
              onClick={() => handleApply(session.ID)}
              className="w-full flex items-center justify-center gap-2 py-2.5 bg-slate-800 hover:bg-slate-700 text-white font-medium rounded-lg transition-colors"
            >
              Enroll Now
              <ArrowRight className="w-4 h-4" />
            </button>
          )}
          {session.status === "upcoming" && (
            <div className="text-center py-2.5 bg-amber-50 border border-amber-200 text-amber-700 rounded-lg text-sm">
              Coming Soon
            </div>
          )}
          {session.status === "closed" && (
            <div className="text-center py-2.5 bg-slate-50 border border-slate-200 text-slate-500 rounded-lg text-sm">
              Registration Closed
            </div>
          )}

          {/* Footer */}
          <p className="text-slate-400 text-xs mt-3">
            {new Date(session.CreatedAt).toLocaleDateString()}
          </p>
        </div>
      </div>
    );
  };

  const renderSection = (title, sessionList, showIfEmpty = true) => {
    if (sessionList.length === 0 && !showIfEmpty) return null;

    return (
      <div className="mb-8">
        <h2 className="text-lg font-semibold text-slate-700 mb-4 flex items-center gap-2">
          {title}
          <span className="px-2 py-0.5 bg-slate-100 text-slate-500 text-sm rounded-full">
            {sessionList.length}
          </span>
        </h2>
        {sessionList.length === 0 ? (
          <div className="text-center py-8 bg-slate-50 rounded-xl border border-slate-200">
            <p className="text-slate-400">No {title.toLowerCase()} available</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {sessionList.map(renderSessionCard)}
          </div>
        )}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-slate-400 mx-auto mb-3" />
          <p className="text-slate-500">Loading sessions...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="bg-white border border-red-200 rounded-xl p-8 text-center max-w-md">
          <XCircle className="w-10 h-10 text-red-400 mx-auto mb-3" />
          <p className="text-slate-600 mb-4">{error}</p>
          <button
            onClick={fetchSessions}
            className="px-5 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Navbar */}
      <nav className="bg-white border-b border-slate-200 sticky top-0 z-50">
        <div className="container mx-auto px-4 py-3 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-slate-700" />
            <span className="font-semibold text-slate-800">Electrum</span>
          </div>
          <div className="hidden md:flex items-center gap-4">
            <span className="text-slate-500 text-sm">
              {user?.userId}
            </span>
            <button
              onClick={handleLogout}
              className="flex items-center gap-1.5 text-slate-500 hover:text-slate-700 text-sm transition-colors"
            >
              <LogOut className="w-4 h-4" />
              Logout
            </button>
          </div>
          <button
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className="md:hidden text-slate-500"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16m-7 6h7" />
            </svg>
          </button>
        </div>
      </nav>

      {/* Mobile Menu */}
      {isMenuOpen && (
        <div className="md:hidden bg-white border-b border-slate-200 p-4">
          <p className="text-slate-500 text-sm mb-2">{user?.userId}</p>
          <button onClick={handleLogout} className="text-slate-600 text-sm flex items-center gap-1.5">
            <LogOut className="w-4 h-4" />
            Logout
          </button>
        </div>
      )}

      <div className="container mx-auto px-4 py-6">
        {/* Refresh Button */}
        <div className="flex justify-end mb-4">
          <button
            onClick={fetchSessions}
            className="flex items-center gap-1.5 px-3 py-1.5 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors text-sm"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
        </div>

        {/* Sessions */}
        {renderSection("Live Sessions", liveSessions, true)}
        {renderSection("Upcoming", upcomingSessions, true)}
        {renderSection("Past Sessions", closedSessions, false)}

        {/* Empty State */}
        {sessions.length === 0 && (
          <div className="text-center py-16">
            <Calendar className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <h3 className="text-lg font-medium text-slate-600 mb-1">No Sessions Available</h3>
            <p className="text-slate-400 text-sm">Check back later for enrollment sessions</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default SessionListPage;
