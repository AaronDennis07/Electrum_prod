import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import toast, { Toaster } from "react-hot-toast";
import { useAuth } from "./AuthContext";
import { getCourseRules, getSession, checkEnrollmentStatus, enrollInCourse } from "./api";
import { getWebSocketUrl } from "./config";
import {
  BookOpen,
  Users,
  CheckCircle,
  XCircle,
  ArrowLeft,
  Zap,
  AlertTriangle,
  X,
  Loader2,
  LogOut,
  Wifi,
  WifiOff,
  RefreshCw,
} from "lucide-react";

// WebSocket reconnection configuration
const WS_RECONNECT_INTERVAL = 2000; // Start with 2 seconds
const WS_MAX_RECONNECT_INTERVAL = 30000; // Max 30 seconds
const WS_RECONNECT_DECAY = 1.5; // Exponential backoff multiplier

const EnrollmentPeriodCourses = () => {
  const { sessionId } = useParams();
  const { user, logout } = useAuth();
  const [session, setSession] = useState(null);
  const [courses, setCourses] = useState([]);
  const [rules, setRules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [enrollingCourseId, setEnrollingCourseId] = useState(null);
  const [enrolled, setEnrolled] = useState(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [selectedCourse, setSelectedCourse] = useState(null);
  const [wsConnected, setWsConnected] = useState(false);
  const [sessionClosed, setSessionClosed] = useState(false);
  const navigate = useNavigate();

  // WebSocket refs for proper cleanup
  const wsRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);
  const reconnectIntervalRef = useRef(WS_RECONNECT_INTERVAL);
  const sessionClosedRef = useRef(false); // Ref to track session closed state for closure

  // Keep ref in sync with state
  useEffect(() => {
    sessionClosedRef.current = sessionClosed;
  }, [sessionClosed]);

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const handleHomeClick = () => {
    navigate("/session");
  };

  // Memoized WebSocket URL - uses centralized config
  const wsUrl = useMemo(() => {
    return getWebSocketUrl(`session/ws/${sessionId}`);
  }, [sessionId]);

  // WebSocket connection with auto-reconnect
  const connectWebSocket = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return;
    }

    try {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log("WebSocket connected");
        setWsConnected(true);
        reconnectIntervalRef.current = WS_RECONNECT_INTERVAL; // Reset reconnect interval
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          
          // Check if session was closed
          if (data.session_closed) {
            sessionClosedRef.current = true; // Update ref immediately to prevent reconnection
            setSessionClosed(true);
            toast.error("Session has been closed by admin");
            // Close WebSocket cleanly
            ws.close(1000, "Session closed by admin");
            return;
          }

          // Update course seats
          setCourses((prevCourses) =>
            prevCourses.map((course) => ({
              ...course,
              availableSeats: parseInt(data[course.Id] ?? course.availableSeats),
            }))
          );
        } catch (err) {
          console.error("Error parsing WebSocket message:", err);
        }
      };

      ws.onclose = (event) => {
        console.log("WebSocket disconnected:", event.code, event.reason);
        setWsConnected(false);
        wsRef.current = null;

        // Don't reconnect if closed cleanly or session is closed
        // Use ref to get current value, not stale closure value
        if (event.code === 1000 || sessionClosedRef.current) {
          console.log("Not reconnecting: session closed or clean disconnect");
          return;
        }

        // Schedule reconnection with exponential backoff
        const reconnectDelay = Math.min(
          reconnectIntervalRef.current,
          WS_MAX_RECONNECT_INTERVAL
        );
        
        console.log(`Reconnecting in ${reconnectDelay}ms...`);
        reconnectTimeoutRef.current = setTimeout(() => {
          // Double-check session isn't closed before reconnecting
          if (sessionClosedRef.current) {
            console.log("Cancelling reconnection: session was closed");
            return;
          }
          reconnectIntervalRef.current = Math.min(
            reconnectIntervalRef.current * WS_RECONNECT_DECAY,
            WS_MAX_RECONNECT_INTERVAL
          );
          connectWebSocket();
        }, reconnectDelay);
      };

      ws.onerror = (error) => {
        console.error("WebSocket error:", error);
      };
    } catch (err) {
      console.error("Failed to create WebSocket:", err);
    }
  }, [wsUrl]); // sessionClosed removed - using sessionClosedRef instead

  // Cleanup WebSocket on unmount
  useEffect(() => {
    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close(1000, "Component unmounting");
      }
    };
  }, []);

  useEffect(() => {
    if (user && user.userId) {
      fetchCourses();
      fetchRules();
    } else {
      navigate("/login");
    }
  }, []);

  // Connect WebSocket after courses are loaded
  useEffect(() => {
    if (courses.length > 0 && !sessionClosed) {
      connectWebSocket();
    }
  }, [courses.length, connectWebSocket, sessionClosed]);

  const fetchCourses = async () => {
    setLoading(true);
    try {
      const data = await getSession(sessionId);
      setSession(data.session);
      
      // Check if session is closed
      if (data.session?.status === "closed") {
        setSessionClosed(true);
      }

      const mappedCourses = data.courses.map((course) => ({
        ...course,
        availableSeats: course.Seats,
      }));
      const sortedCourses = mappedCourses.sort((a, b) => a.Id - b.Id);
      setCourses(sortedCourses);
      setLoading(false);
    } catch (error) {
      setError("Failed to fetch courses");
      setLoading(false);
      toast.error("Failed to load courses. Please try again later.");
    }
    checkEnrollment();
  };

  const fetchRules = async () => {
    try {
      const data = await getCourseRules(sessionId);
      setRules(data.rules || []);
    } catch (err) {
      console.error("Failed to fetch rules:", err);
    }
  };

  const checkEnrollment = async () => {
    try {
      const data = await checkEnrollmentStatus(sessionId, user.userId);
      if (data.enrolled) {
        setEnrolled(data.course);
      }
    } catch (error) {
      // Silent fail - not critical
      console.error("Failed to check enrollment status:", error);
    }
  };

  // Apply course visibility rules (all rules are now configurable via CourseRule model)
  const visibleCourses = useMemo(() => {
    if (!courses.length) return [];

    const previousCourseId = user?.previous_course_id;

    return courses.filter((course) => {
      // Check configured rules only (no hardcoded defaults)
      const courseRules = rules.filter((r) => r.course_code === course.Code);

      for (const rule of courseRules) {
        switch (rule.rule_type) {
          case "hide_if_taken":
            if (previousCourseId === rule.target_course_code) {
              return false;
            }
            break;

          case "requires_prerequisite":
            if (previousCourseId !== rule.target_course_code) {
              return false;
            }
            break;

          case "mutually_exclusive":
            const groupCourses = rules
              .filter(
                (r) =>
                  r.rule_type === "mutually_exclusive" &&
                  r.exclusion_group === rule.exclusion_group &&
                  r.course_code !== course.Code
              )
              .map((r) => r.course_code);

            if (groupCourses.includes(previousCourseId)) {
              return false;
            }
            break;
        }
      }

      return true;
    });
  }, [courses, rules, user?.previous_course_id]);

  const handleEnrollConfirm = (course) => {
    if (sessionClosed) {
      toast.error("Session is closed");
      return;
    }
    setSelectedCourse(course);
    setIsConfirmOpen(true);
  };

  const handleEnrollCancel = () => {
    setIsConfirmOpen(false);
    setSelectedCourse(null);
  };

  const handleEnrollSubmit = async () => {
    if (!selectedCourse || sessionClosed) return;

    const courseToEnroll = selectedCourse;
    setEnrollingCourseId(courseToEnroll.Id);
    setIsConfirmOpen(false);

    // Optimistic UI update - immediately decrement the seat count
    setCourses((prevCourses) =>
      prevCourses.map((course) =>
        course.Id === courseToEnroll.Id
          ? { ...course, availableSeats: Math.max(0, course.availableSeats - 1) }
          : course
      )
    );

    try {
      await enrollInCourse(sessionId, user.userId, courseToEnroll.Id);
      toast.success(`Successfully enrolled in ${courseToEnroll.Name}`, {
        duration: 4000,
        icon: "🎉",
      });
      
      // Set enrolled state
      setEnrolled({
        ID: courseToEnroll.Id,
        name: courseToEnroll.Name,
        code: courseToEnroll.Code,
      });
    } catch (error) {
      // Revert optimistic update on failure
      setCourses((prevCourses) =>
        prevCourses.map((course) =>
          course.Id === courseToEnroll.Id
            ? { ...course, availableSeats: course.availableSeats + 1 }
            : course
        )
      );

      // Check if it's a retryable error
      if (error.message?.includes("try again")) {
        toast.error("Network issue. Please try again.", {
          duration: 4000,
        });
      } else {
        toast.error(error.message || "Enrollment failed", {
          duration: 4000,
        });
      }
      
      // Re-check enrollment status in case we're actually enrolled
      checkEnrollment();
    } finally {
      setEnrollingCourseId(null);
      setSelectedCourse(null);
    }
  };

  const handleManualRefresh = async () => {
    await fetchCourses();
    toast.success("Refreshed", { duration: 1500 });
  };

  const getSeatsPercentage = (available, total) => {
    if (!total) return 0;
    return (available / total) * 100;
  };

  const getSeatsColor = (percentage) => {
    if (percentage === 0) return "bg-red-500";
    if (percentage < 20) return "bg-orange-400";
    if (percentage < 50) return "bg-amber-400";
    return "bg-emerald-500";
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-slate-400 mx-auto mb-3" />
          <p className="text-slate-500">Loading courses...</p>
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
            onClick={fetchCourses}
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
          <button
            onClick={handleHomeClick}
            className="flex items-center gap-2 text-slate-500 hover:text-slate-700 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            <span className="hidden sm:inline text-sm">Back</span>
          </button>
          <div className="flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-slate-700" />
            <span className="font-semibold text-slate-800">Electrum</span>
            {/* Connection status indicator */}
            <span className="ml-2">
              {wsConnected ? (
                <Wifi className="w-4 h-4 text-emerald-500" title="Live updates active" />
              ) : (
                <WifiOff className="w-4 h-4 text-amber-500 animate-pulse" title="Reconnecting..." />
              )}
            </span>
          </div>
          <div className="hidden md:flex items-center gap-4">
            <button
              onClick={handleManualRefresh}
              className="p-1.5 text-slate-400 hover:text-slate-600 transition-colors"
              title="Refresh"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
            <span className="text-slate-500 text-sm">{user?.userId}</span>
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
          <button onClick={handleHomeClick} className="block text-slate-600 text-sm mb-2">
            ← Back to Sessions
          </button>
          <button onClick={handleManualRefresh} className="block text-slate-600 text-sm mb-2">
            ↻ Refresh
          </button>
          <button onClick={handleLogout} className="text-slate-600 text-sm flex items-center gap-1.5">
            <LogOut className="w-4 h-4" />
            Logout
          </button>
        </div>
      )}

      <Toaster position="top-center" />

      <div className="container mx-auto px-4 py-6">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-2xl font-semibold text-slate-800">
              {session?.name || `Session #${sessionId}`}
            </h1>
            {session?.status === "open" && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-100 text-emerald-700 text-xs font-medium rounded-full">
                <Zap className="w-3 h-3" />
                Live
              </span>
            )}
          </div>
          {user?.previous_course && (
            <p className="text-slate-500 text-sm">
              Previous: {user.previous_course}
            </p>
          )}
        </div>

        {/* Session Closed Banner */}
        {sessionClosed && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-xl p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-100 rounded-full">
                <XCircle className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <p className="font-medium text-red-800">Session Closed</p>
                <p className="text-red-600 text-sm">
                  This enrollment session has been closed.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Enrolled Banner */}
        {enrolled && (
          <div className="mb-6 bg-emerald-50 border border-emerald-200 rounded-xl p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-emerald-100 rounded-full">
                <CheckCircle className="w-5 h-5 text-emerald-600" />
              </div>
              <div>
                <p className="font-medium text-emerald-800">Successfully Enrolled</p>
                <p className="text-emerald-600 text-sm">
                  {enrolled.name} ({enrolled.code})
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Connection Status Banner */}
        {!wsConnected && !sessionClosed && (
          <div className="mb-4 bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-center gap-2">
            <WifiOff className="w-4 h-4 text-amber-600" />
            <span className="text-amber-700 text-sm">
              Reconnecting to live updates...
            </span>
            <button
              onClick={handleManualRefresh}
              className="ml-auto text-amber-700 hover:text-amber-800 text-sm underline"
            >
              Refresh manually
            </button>
          </div>
        )}

        {/* Courses Grid */}
        {visibleCourses.length === 0 ? (
          <div className="text-center py-16">
            <BookOpen className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500">No courses available for you</p>
            <p className="text-slate-400 text-sm mt-1">
              Based on your enrollment history
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {visibleCourses.map((course) => {
              const seatsPercentage = getSeatsPercentage(course.availableSeats, course.Seats);
              const seatsColor = getSeatsColor(seatsPercentage);
              const isFull = course.availableSeats <= 0;
              const isEnrolledHere = enrolled?.ID === course.Id;
              const isEnrolling = enrollingCourseId === course.Id;

              return (
                <div
                  key={course.Id}
                  className={`bg-white border rounded-xl overflow-hidden transition-all duration-200 ${
                    isEnrolledHere
                      ? "border-emerald-300 ring-1 ring-emerald-100"
                      : isFull
                        ? "border-slate-200 opacity-60"
                        : "border-slate-200 hover:border-slate-300 hover:shadow-sm"
                  }`}
                >
                  <div className="p-5">
                    {/* Status Badge */}
                    {isEnrolledHere && (
                      <div className="mb-3">
                        <span className="inline-flex items-center gap-1 px-2 py-1 bg-emerald-100 text-emerald-700 text-xs font-medium rounded-full">
                          <CheckCircle className="w-3 h-3" />
                          Enrolled
                        </span>
                      </div>
                    )}
                    {isFull && !isEnrolledHere && (
                      <div className="mb-3">
                        <span className="inline-flex items-center gap-1 px-2 py-1 bg-red-100 text-red-700 text-xs font-medium rounded-full">
                          <XCircle className="w-3 h-3" />
                          Full
                        </span>
                      </div>
                    )}

                    {/* Course Info */}
                    <div className="mb-4">
                      <h3 className="text-base font-semibold text-slate-800 mb-1 leading-snug">
                        {course.Name || "N/A"}
                      </h3>
                      <p className="text-slate-500 text-sm font-mono">{course.Code}</p>
                    </div>

                    {/* Seats Progress */}
                    <div className="mb-4">
                      <div className="flex justify-between items-center mb-1.5">
                        <span className="text-slate-500 text-sm flex items-center gap-1">
                          <Users className="w-3.5 h-3.5" />
                          Seats
                        </span>
                        <span className={`text-sm font-medium ${isFull ? "text-red-600" : "text-slate-700"}`}>
                          {Math.max(0, course.availableSeats)} / {course.Seats}
                        </span>
                      </div>
                      <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full ${seatsColor} rounded-full transition-all duration-500`}
                          style={{ width: `${Math.max(0, seatsPercentage)}%` }}
                        />
                      </div>
                    </div>

                    {/* Enroll Button */}
                    <button
                      onClick={() => handleEnrollConfirm(course)}
                      disabled={isEnrolling || isFull || enrolled !== null || sessionClosed}
                      className={`w-full py-2.5 rounded-lg font-medium transition-all duration-200 flex items-center justify-center gap-2 text-sm ${
                        isEnrolledHere
                          ? "bg-emerald-50 text-emerald-700 cursor-default"
                          : isFull || sessionClosed
                            ? "bg-slate-100 text-slate-400 cursor-not-allowed"
                            : enrolled
                              ? "bg-slate-100 text-slate-400 cursor-not-allowed"
                              : "bg-slate-800 hover:bg-slate-700 text-white"
                      }`}
                    >
                      {isEnrolling ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Enrolling...
                        </>
                      ) : isEnrolledHere ? (
                        <>
                          <CheckCircle className="w-4 h-4" />
                          Enrolled
                        </>
                      ) : sessionClosed ? (
                        "Session Closed"
                      ) : isFull ? (
                        "Course Full"
                      ) : enrolled ? (
                        "Already Enrolled"
                      ) : (
                        "Enroll"
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Confirmation Modal */}
      {isConfirmOpen && selectedCourse && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-md shadow-xl">
            <div className="p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="p-2 bg-amber-100 rounded-lg">
                  <AlertTriangle className="w-5 h-5 text-amber-600" />
                </div>
                <button
                  onClick={handleEnrollCancel}
                  className="text-slate-400 hover:text-slate-600 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <h3 className="text-lg font-semibold text-slate-800 mb-2">
                Confirm Enrollment
              </h3>
              <p className="text-slate-500 text-sm mb-5">
                This action cannot be undone. Please confirm you want to enroll in this course.
              </p>

              <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 mb-5">
                <h4 className="font-medium text-slate-800">{selectedCourse.Name}</h4>
                <p className="text-slate-500 text-sm">{selectedCourse.Code}</p>
                <div className="flex items-center gap-1 mt-2 text-slate-500 text-sm">
                  <Users className="w-4 h-4" />
                  {selectedCourse.availableSeats} seats available
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={handleEnrollCancel}
                  className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleEnrollSubmit}
                  className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-white font-medium rounded-lg transition-colors"
                >
                  Confirm
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EnrollmentPeriodCourses;
