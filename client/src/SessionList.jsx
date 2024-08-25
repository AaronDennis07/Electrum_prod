import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "./AuthContext";

const SessionListPage = () => {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const navigate = useNavigate();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const { logout } = useAuth();
  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const handleHomeClick = () => {
    navigate("/session"); // Adjust this path to your actual home page route
  };

  useEffect(() => {
    fetch("http://127.0.0.1:8000/session")
      .then((response) => {
        if (!response.ok) {
          throw new Error("Network response was not ok");
        }
        return response.json();
      })
      .then((data) => {
        // Add random start times for upcoming sessions
        const enhancedData = data.map((session) => {
          if (session.status === "upcoming") {
            const randomFutureDate = new Date(Date.now());
            return { ...session, startTime: randomFutureDate };
          }
          return session;
        });
        setSessions(enhancedData);
        setLoading(false);
      })
      .catch((error) => {
        setError("Failed to fetch sessions");
        setLoading(false);
      });
  }, []);

  const getStatusColor = (status) => {
    switch (status) {
      case "open":
        return "bg-green-500";
      case "closed":
        return "bg-red-500";
      case "upcoming":
        return "bg-yellow-500";
      default:
        return "bg-gray-500";
    }
  };

  const handleApply = (sessionName) => {
    console.log(sessionName);
    navigate(`/enroll/${sessionName}`);
  };

  const renderProgressBar = (applied, total) => (
    <div className="w-full bg-gray-200 rounded-full h-2.5 mb-4">
      <div
        className="bg-blue-600 h-2.5 rounded-full"
        style={{ width: `${(applied / total) * 100}%` }}
      ></div>
    </div>
  );

  const renderSessionCard = (session) => (
    <div key={session.ID} className="bg-white shadow-md rounded-lg p-6 mb-4">
      <h3 className="text-xl font-semibold mb-2">{session.name}</h3>
      <p className="text-gray-600 mb-2">Type: {session.session_type}</p>
      <div
        className={`inline-block px-2 py-1 rounded-full text-white text-sm ${getStatusColor(session.status)} mb-2`}
      >
        {session.status}
      </div>
      {session.status === "open" && (
        <>
          {renderProgressBar(session.applied_students, session.total_students)}
          <p className="text-gray-600 mb-2">
            {session.applied_students} / {session.total_students} students
          </p>
          <button
            onClick={() => handleApply(session.name)}
            className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded mt-2"
          >
            Apply Now
          </button>
        </>
      )}
      {session.status === "upcoming" && (
        <p className="text-gray-600 mt-2">
          Starts in: {session.startTime.toLocaleString()}
        </p>
      )}
      <p className="text-gray-500 text-sm mt-4">
        Created: {new Date(session.CreatedAt).toLocaleDateString()}
      </p>
    </div>
  );

  const renderSessionSection = (title, sessionList) => (
    <div className="mb-8">
      <h2 className="text-2xl font-bold mb-4">{title}</h2>
      {sessionList.length > 0 ? (
        sessionList.map(renderSessionCard)
      ) : (
        <p className="text-gray-500">
          No {title.toLowerCase()} sessions available.
        </p>
      )}
    </div>
  );

  if (loading) return <div className="text-center mt-8">Loading...</div>;
  if (error)
    return <div className="text-center mt-8 text-red-500">{error}</div>;

  const liveSessions = sessions.filter((session) => session.status === "open");
  const upcomingSessions = sessions.filter(
    (session) => session.status === "upcoming"
  );
  const closedSessions = sessions.filter(
    (session) => session.status === "closed"
  );

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
       <div className="bg-white border-b border-gray-200 py-4">
        <div className="container mx-auto px-4">
          <div className="text-center text-gray-600">
            <p className="text-sm mb-1">
              Designed & Developed by <strong>S Aaron Dennis </strong>and <strong> Surya K N</strong> (Final Year Students, CSE Department, NHCE)
            </p>
           
             <p className="text-sm mb-1">
              Under the Guidance of <strong> Ms. Asha Rani Borah </strong> (Senior AP, CSE Department, NHCE) and <strong>Dr. R J Anandhi </strong>(Professor and Dean Academics, NHCE) 
            </p>
          </div>
        </div>
      </div>
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-8">Session List</h1>
        {renderSessionSection("Live", liveSessions)}
        {renderSessionSection("Upcoming", upcomingSessions)}
        {renderSessionSection("Closed", closedSessions)}
      </div>
    </div>
  );
};

export default SessionListPage;