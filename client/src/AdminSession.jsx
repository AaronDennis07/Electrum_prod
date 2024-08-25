import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "./AuthContext";

const AdminSessionPage = () => {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const navigate = useNavigate();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const { logout } = useAuth();

  const handleLogout = () => {
    logout();
    navigate("/admin/login");
  };

  const handleHomeClick = () => {
    navigate("/admin/session"); // Adjust this path to your actual home page route
  };

  useEffect(() => {
    fetchSessions();
  }, []);

  const fetchSessions = () => {
    fetch("http://35.154.39.136:8000/session")
      .then((response) => {
        if (!response.ok) {
          throw new Error("Network response was not ok");
        }
        return response.json();
      })
      .then((data) => {
        // Sort sessions by creation date in descending order
        const sortedSessions = data.sort(
          (a, b) => new Date(b.CreatedAt) - new Date(a.CreatedAt)
        );
        setSessions(sortedSessions);
        setLoading(false);
      })
      .catch((error) => {
        setError("Failed to fetch sessions");
        setLoading(false);
      });
  };

  const handleStartStop = (sessionName, action) => {
    fetch(`http://35.154.39.136:8000/session/${sessionName}/${action}`, {
      method: "POST",
    })
      .then((response) => {
        if (!response.ok) {
          throw new Error("Failed to update session status");
        }
        return response.json();
      })
      .then(() => {
        // Refresh the session list after successful update
        fetchSessions();
      })
      .catch((error) => {
        setError(`Failed to ${action} session: ${error.message}`);
      });
  };

  const handleDetails = (sessionName) => {
    navigate(`/admin/session/${sessionName}`);
  };

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

  const renderSessionCard = (session) => (
    <div key={session.ID} className="bg-white shadow-md rounded-lg p-6 mb-4">
      <h3 className="text-xl font-semibold mb-2" onClick={() => handleDetails}>
        {session.name}
      </h3>
      <p className="text-gray-600 mb-2">Type: {session.session_type}</p>
      <p className="text-gray-600 mb-2">
        Total Students: {session.total_students}
      </p>
      <p className="text-gray-600 mb-2">
        Applied Students: {session.applied_students}
      </p>
      <div
        className={`inline-block px-2 py-1 rounded-full text-white text-sm ${getStatusColor(session.status)} mb-2`}
      >
        {session.status}
      </div>
      <p className="text-gray-500 text-sm mb-4">
        Created: {new Date(session.CreatedAt).toLocaleString()}
      </p>
      <div className="flex space-x-2">
        <button
          onClick={() => handleStartStop(session.name, "start")}
          className="bg-green-500 hover:bg-green-700 text-white font-bold py-2 px-4 rounded"
          disabled={session.status === "open"}
        >
          Start
        </button>
        <button
          onClick={() => handleStartStop(session.name, "stop")}
          className="bg-red-500 hover:bg-red-700 text-white font-bold py-2 px-4 rounded"
          disabled={session.status === "closed"}
        >
          Stop
        </button>
        <button
          onClick={() => handleDetails(session.name)}
          className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
        >
          Details
        </button>
      </div>
    </div>
  );

  if (loading) return <div className="text-center mt-8">Loading...</div>;
  if (error)
    return <div className="text-center mt-8 text-red-500">{error}</div>;

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
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-8">Admin Session Management</h1>
        <button
          className="bg-green-500 hover:bg-green-700 text-white font-bold py-2 px-4 rounded"
          onClick={() => {
            navigate("/admin/create");
          }}
        >
          Create
        </button>
        <button
          className="bg-green-500 hover:bg-green-700 text-white font-bold py-2 px-4 rounded mx-2"
          onClick={() => {
            navigate("/admin/upload");
          }}
        >
          Upload
        </button>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {sessions.map(renderSessionCard)}
        </div>
      </div>
    </div>
  );
};

export default AdminSessionPage;
