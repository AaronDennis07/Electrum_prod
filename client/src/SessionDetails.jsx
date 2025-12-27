import { useState, useEffect } from "react";
import toast, { Toaster } from "react-hot-toast";
import { useNavigate, useParams } from "react-router-dom";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { useAuth } from "./AuthContext";
import {
  Download,
  RefreshCw,
  Users,
  BookOpen,
  Calendar,
  Clock,
  CheckCircle,
  XCircle,
  Zap,
  ArrowLeft,
  Settings,
  Plus,
  Trash2,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  Link2,
  Ban,
} from "lucide-react";
import { API_BASE, getSessionDetails, downloadSessionExcel, getCourseRules, createCourseRule, deleteCourseRule, bulkCreateCourseRules } from "./api";

const AdminSessionDashboard = () => {
  const [sessionData, setSessionData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { sessionId } = useParams();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [showRules, setShowRules] = useState(false);
  const [rules, setRules] = useState([]);
  const [loadingRules, setLoadingRules] = useState(false);
  const [showAddRule, setShowAddRule] = useState(false);
  const [newRule, setNewRule] = useState({
    course_code: "",
    rule_type: "hide_if_taken",
    target_course_code: "",
    exclusion_group: "",
  });
  const navigate = useNavigate();
  const { logout } = useAuth();

  const handleLogout = () => {
    logout();
    navigate("/admin/login");
  };

  const handleHomeClick = () => {
    navigate("/admin/session");
  };

  const fetchSession = async () => {
    setLoading(true);
    try {
      const data = await getSessionDetails(sessionId);
      setSessionData(data.session);
      setError(null);
    } catch (err) {
      setError("Failed to fetch session data");
    } finally {
      setLoading(false);
    }
  };

  const fetchRules = async () => {
    setLoadingRules(true);
    try {
      const data = await getCourseRules(sessionId);
      setRules(data.rules || []);
    } catch (err) {
      toast.error("Failed to load course rules");
    } finally {
      setLoadingRules(false);
    }
  };

  useEffect(() => {
    fetchSession();
  }, [sessionId]);

  useEffect(() => {
    if (showRules) {
      fetchRules();
    }
  }, [showRules]);

  const handleAddRule = async () => {
    if (!newRule.course_code) {
      toast.error("Course code is required");
      return;
    }
    if (newRule.rule_type !== "mutually_exclusive" && !newRule.target_course_code) {
      toast.error("Target course code is required for this rule type");
      return;
    }
    if (newRule.rule_type === "mutually_exclusive" && !newRule.exclusion_group) {
      toast.error("Exclusion group is required for mutually exclusive rules");
      return;
    }

    try {
      await createCourseRule(sessionId, newRule);
      toast.success("Rule created successfully");
      setNewRule({
        course_code: "",
        rule_type: "hide_if_taken",
        target_course_code: "",
        exclusion_group: "",
      });
      setShowAddRule(false);
      fetchRules();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const handleDeleteRule = async (ruleId) => {
    if (!window.confirm("Are you sure you want to delete this rule?")) return;

    try {
      await deleteCourseRule(ruleId);
      toast.success("Rule deleted");
      fetchRules();
    } catch (err) {
      toast.error("Failed to delete rule");
    }
  };

  const getRuleTypeInfo = (ruleType) => {
    switch (ruleType) {
      case "hide_if_taken":
        return {
          label: "Hide if Taken",
          icon: <Ban className="w-4 h-4" />,
          color: "text-red-400",
          bgColor: "bg-red-500/20",
          description: "Hide this course if student previously took target course",
        };
      case "requires_prerequisite":
        return {
          label: "Requires Prerequisite",
          icon: <Link2 className="w-4 h-4" />,
          color: "text-blue-400",
          bgColor: "bg-blue-500/20",
          description: "Show only if student took the prerequisite",
        };
      case "mutually_exclusive":
        return {
          label: "Mutually Exclusive",
          icon: <AlertTriangle className="w-4 h-4" />,
          color: "text-amber-400",
          bgColor: "bg-amber-500/20",
          description: "Hide if student took any course in the same group",
        };
      default:
        return {
          label: ruleType,
          icon: <Settings className="w-4 h-4" />,
          color: "text-slate-400",
          bgColor: "bg-slate-500/20",
          description: "",
        };
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case "open":
        return <Zap className="w-4 h-4" />;
      case "closed":
        return <XCircle className="w-4 h-4" />;
      case "upcoming":
        return <Clock className="w-4 h-4" />;
      default:
        return <CheckCircle className="w-4 h-4" />;
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

  const COLORS = ["#f59e0b", "#10b981", "#3b82f6", "#8b5cf6", "#ef4444", "#06b6d4"];

  const handleDownload = async () => {
    setIsDownloading(true);
    try {
      const blob = await downloadSessionExcel(sessionId);
      const url = window.URL.createObjectURL(blob);

      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `session_${sessionId}_enrollments.xlsx`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.success("Download complete");
    } catch (error) {
      toast.error(`${error.message}`);
    } finally {
      setIsDownloading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <RefreshCw className="w-8 h-8 animate-spin text-amber-400" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-6 text-center">
          <p className="text-red-400 mb-4">{error}</p>
          <button
            onClick={fetchSession}
            className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!sessionData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <p className="text-slate-400">No data available</p>
      </div>
    );
  }

  const coursesData = sessionData.Courses?.map((course, index) => ({
    name: course.name,
    code: course.code,
    totalSeats: course.seats,
    seatsFilled: course.seats_filled || 0,
    seatsAvailable: course.seats - (course.seats_filled || 0),
    color: COLORS[index % COLORS.length],
  })) || [];

  const enrollmentRate = sessionData.total_students
    ? ((sessionData.applied_students || 0) / sessionData.total_students) * 100
    : 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Navbar */}
      <nav className="bg-slate-800/80 backdrop-blur-sm border-b border-slate-700 sticky top-0 z-50">
        <div className="container mx-auto px-4 py-3 flex justify-between items-center">
          <button
            onClick={handleHomeClick}
            className="text-slate-300 hover:text-amber-400 transition-colors flex items-center gap-2"
          >
            <ArrowLeft className="w-5 h-5" />
            <span className="hidden sm:inline">Back to Dashboard</span>
          </button>
          <div className="text-white text-xl font-bold tracking-wide">
            <span className="text-amber-400">Electrum</span>
            <span className="text-slate-400 text-sm ml-1">Admin</span>
          </div>
          <div className="hidden md:flex items-center gap-4">
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
            Back to Dashboard
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
            <h1 className="text-3xl font-bold text-white mb-2">{sessionData.name}</h1>
            <div className="flex items-center gap-3">
              <span
                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium border ${getStatusStyles(sessionData.status)}`}
              >
                {getStatusIcon(sessionData.status)}
                {sessionData.status}
              </span>
              <span className="text-slate-400">{sessionData.session_type}</span>
              <span className="text-slate-500 text-sm">ID: {sessionId}</span>
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={fetchSession}
              className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              Refresh
            </button>
            <button
              onClick={handleDownload}
              disabled={isDownloading}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg transition-colors disabled:opacity-50"
            >
              <Download className="w-4 h-4" />
              {isDownloading ? "Downloading..." : "Export Excel"}
            </button>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-blue-500/20 rounded-lg">
                <Users className="w-5 h-5 text-blue-400" />
              </div>
              <span className="text-slate-400 text-sm">Total Students</span>
            </div>
            <p className="text-2xl font-bold text-white">
              {sessionData.total_students?.toLocaleString() || 0}
            </p>
          </div>

          <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-emerald-500/20 rounded-lg">
                <CheckCircle className="w-5 h-5 text-emerald-400" />
              </div>
              <span className="text-slate-400 text-sm">Enrolled</span>
            </div>
            <p className="text-2xl font-bold text-white">
              {sessionData.applied_students?.toLocaleString() || 0}
            </p>
          </div>

          <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-amber-500/20 rounded-lg">
                <BookOpen className="w-5 h-5 text-amber-400" />
              </div>
              <span className="text-slate-400 text-sm">Courses</span>
            </div>
            <p className="text-2xl font-bold text-white">{sessionData.Courses?.length || 0}</p>
          </div>

          <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-purple-500/20 rounded-lg">
                <Calendar className="w-5 h-5 text-purple-400" />
              </div>
              <span className="text-slate-400 text-sm">Enrollment Rate</span>
            </div>
            <p className="text-2xl font-bold text-white">{enrollmentRate.toFixed(1)}%</p>
          </div>
        </div>

        {/* Course Rules Section */}
        <div className="bg-slate-800/50 border border-slate-700 rounded-xl mb-8 overflow-hidden">
          <button
            onClick={() => setShowRules(!showRules)}
            className="w-full flex items-center justify-between p-4 text-left hover:bg-slate-700/30 transition-colors"
          >
            <div className="flex items-center gap-3">
              <Settings className="w-5 h-5 text-amber-400" />
              <div>
                <h2 className="text-lg font-semibold text-white">Course Visibility Rules</h2>
                <p className="text-slate-400 text-sm">
                  Configure which courses students can see based on their previous courses
                </p>
              </div>
            </div>
            {showRules ? (
              <ChevronUp className="w-5 h-5 text-slate-400" />
            ) : (
              <ChevronDown className="w-5 h-5 text-slate-400" />
            )}
          </button>

          {showRules && (
            <div className="border-t border-slate-700 p-4">
              {/* Add Rule Form */}
              {showAddRule ? (
                <div className="bg-slate-700/50 rounded-xl p-4 mb-4">
                  <h3 className="text-white font-medium mb-4">Add New Rule</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    <div>
                      <label className="block text-sm text-slate-300 mb-1">Course Code</label>
                      <select
                        value={newRule.course_code}
                        onChange={(e) => setNewRule({ ...newRule, course_code: e.target.value })}
                        className="w-full px-3 py-2 bg-slate-600 border border-slate-500 rounded-lg text-white"
                      >
                        <option value="">Select course...</option>
                        {sessionData.Courses?.map((c) => (
                          <option key={c.code} value={c.code}>
                            {c.code} - {c.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm text-slate-300 mb-1">Rule Type</label>
                      <select
                        value={newRule.rule_type}
                        onChange={(e) => setNewRule({ ...newRule, rule_type: e.target.value })}
                        className="w-full px-3 py-2 bg-slate-600 border border-slate-500 rounded-lg text-white"
                      >
                        <option value="hide_if_taken">Hide if Taken (same as previous)</option>
                        <option value="requires_prerequisite">Requires Prerequisite</option>
                        <option value="mutually_exclusive">Mutually Exclusive Group</option>
                      </select>
                    </div>
                    {newRule.rule_type !== "mutually_exclusive" && (
                      <div>
                        <label className="block text-sm text-slate-300 mb-1">
                          {newRule.rule_type === "hide_if_taken"
                            ? "Previous Course Code (hide if student took this)"
                            : "Prerequisite Course Code (required to see)"}
                        </label>
                        <input
                          type="text"
                          value={newRule.target_course_code}
                          onChange={(e) =>
                            setNewRule({ ...newRule, target_course_code: e.target.value.toUpperCase() })
                          }
                          placeholder="e.g., 23NHOP707"
                          className="w-full px-3 py-2 bg-slate-600 border border-slate-500 rounded-lg text-white placeholder-slate-400"
                        />
                      </div>
                    )}
                    {newRule.rule_type === "mutually_exclusive" && (
                      <div>
                        <label className="block text-sm text-slate-300 mb-1">
                          Exclusion Group Name
                        </label>
                        <input
                          type="text"
                          value={newRule.exclusion_group}
                          onChange={(e) => setNewRule({ ...newRule, exclusion_group: e.target.value })}
                          placeholder="e.g., language_track"
                          className="w-full px-3 py-2 bg-slate-600 border border-slate-500 rounded-lg text-white placeholder-slate-400"
                        />
                        <p className="text-xs text-slate-500 mt-1">
                          Courses with the same group name are mutually exclusive
                        </p>
                      </div>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={handleAddRule}
                      className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-900 font-medium rounded-lg"
                    >
                      Add Rule
                    </button>
                    <button
                      onClick={() => setShowAddRule(false)}
                      className="px-4 py-2 bg-slate-600 hover:bg-slate-500 text-white rounded-lg"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setShowAddRule(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-900 font-medium rounded-lg mb-4"
                >
                  <Plus className="w-4 h-4" />
                  Add Rule
                </button>
              )}

              {/* Rules List */}
              {loadingRules ? (
                <div className="flex items-center justify-center py-8">
                  <RefreshCw className="w-6 h-6 animate-spin text-amber-400" />
                </div>
              ) : rules.length === 0 ? (
                <div className="text-center py-8 text-slate-400">
                  <Settings className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p>No course rules configured</p>
                  <p className="text-sm">All courses will be visible to all eligible students</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {rules.map((rule) => {
                    const typeInfo = getRuleTypeInfo(rule.rule_type);
                    return (
                      <div
                        key={rule.ID}
                        className="flex items-center justify-between p-3 bg-slate-700/50 rounded-lg"
                      >
                        <div className="flex items-center gap-3">
                          <div className={`p-2 rounded-lg ${typeInfo.bgColor}`}>
                            {typeInfo.icon}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-white font-mono text-sm">{rule.course_code}</span>
                              <span className={`text-xs ${typeInfo.color}`}>{typeInfo.label}</span>
                            </div>
                            <p className="text-slate-400 text-sm">
                              {rule.rule_type === "mutually_exclusive"
                                ? `Group: ${rule.exclusion_group}`
                                : `Target: ${rule.target_course_code}`}
                            </p>
                          </div>
                        </div>
                        <button
                          onClick={() => handleDeleteRule(rule.ID)}
                          className="p-2 text-slate-400 hover:text-red-400 hover:bg-slate-600 rounded transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Enrollment Pie Chart */}
          <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6">
            <h2 className="text-lg font-semibold text-white mb-4">Student Enrollment</h2>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={[
                      { name: "Enrolled", value: sessionData.applied_students || 0 },
                      {
                        name: "Remaining",
                        value: (sessionData.total_students || 0) - (sessionData.applied_students || 0),
                      },
                    ]}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={90}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    <Cell fill="#10b981" />
                    <Cell fill="#334155" />
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#1e293b",
                      border: "1px solid #475569",
                      borderRadius: "8px",
                    }}
                    labelStyle={{ color: "#f8fafc" }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <p className="text-center text-slate-400 mt-4">
              <span className="text-emerald-400 font-semibold">
                {sessionData.applied_students || 0}
              </span>{" "}
              out of{" "}
              <span className="text-white font-semibold">{sessionData.total_students || 0}</span>{" "}
              students enrolled
            </p>
          </div>

          {/* Course Bar Chart */}
          <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6">
            <h2 className="text-lg font-semibold text-white mb-4">Course Seat Allocation</h2>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={coursesData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis type="number" stroke="#94a3b8" />
                  <YAxis dataKey="code" type="category" stroke="#94a3b8" width={80} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#1e293b",
                      border: "1px solid #475569",
                      borderRadius: "8px",
                    }}
                    labelStyle={{ color: "#f8fafc" }}
                  />
                  <Legend />
                  <Bar dataKey="seatsFilled" stackId="a" fill="#f59e0b" name="Filled" />
                  <Bar dataKey="seatsAvailable" stackId="a" fill="#334155" name="Available" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Course Details Table */}
        <div className="bg-slate-800/50 border border-slate-700 rounded-xl overflow-hidden">
          <div className="p-4 border-b border-slate-700">
            <h2 className="text-lg font-semibold text-white">Course Details</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-slate-700/50">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-300 uppercase">
                    Code
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-300 uppercase">
                    Name
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-300 uppercase">
                    Total Seats
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-300 uppercase">
                    Filled
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-300 uppercase">
                    Available
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-300 uppercase">
                    Fill Rate
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700">
                {sessionData.Courses?.map((course) => {
                  const fillRate = course.seats
                    ? (((course.seats_filled || 0) / course.seats) * 100).toFixed(1)
                    : 0;
                  const available = course.seats - (course.seats_filled || 0);

                  return (
                    <tr key={course.ID} className="hover:bg-slate-700/30">
                      <td className="px-4 py-3 text-white font-mono text-sm">{course.code}</td>
                      <td className="px-4 py-3 text-slate-200">{course.name}</td>
                      <td className="px-4 py-3 text-slate-200">{course.seats}</td>
                      <td className="px-4 py-3 text-emerald-400">{course.seats_filled || 0}</td>
                      <td className="px-4 py-3 text-slate-400">{available}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-24 h-2 bg-slate-700 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-amber-500 rounded-full"
                              style={{ width: `${fillRate}%` }}
                            />
                          </div>
                          <span className="text-slate-300 text-sm">{fillRate}%</span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Metadata */}
        <div className="mt-6 flex flex-wrap gap-4 text-sm text-slate-500">
          <span>Created: {new Date(sessionData.CreatedAt).toLocaleString()}</span>
          <span>•</span>
          <span>Last Updated: {new Date(sessionData.UpdatedAt).toLocaleString()}</span>
        </div>
      </div>
    </div>
  );
};

export default AdminSessionDashboard;
