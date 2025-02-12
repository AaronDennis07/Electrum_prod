import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import toast, { Toaster } from "react-hot-toast";
import { useAuth } from "./AuthContext";
import { XMarkIcon } from "@heroicons/react/24/outline";

const EnrollmentPeriodCourses = () => {
  const { sessionName } = useParams();

  const { user, logout } = useAuth(); // Use the user.userId from context
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [enrollingCourseId, setEnrollingCourseId] = useState(null);
  const [enrolled, setEnrolled] = useState(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const navigate = useNavigate();
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [selectedCourse, setSelectedCourse] = useState(null);

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const handleHomeClick = () => {
    navigate("/session"); // Adjust this path to your actual home page route
  };

  useEffect(() => {
    // //console.log(user);
    if (user && user.userId) {
      fetchCourses();
    } else {
      navigate("/login");
    }
  }, []);
  useEffect(() => {}, [enrolled]);

  const fetchCourses = async () => {
    setLoading(true);
    try {
      const response = await fetch(`https://backendelectrumnhce.sunkn.tech/session/${sessionName}`);
      if (!response.ok) {
        throw new Error("Network response was not ok");
      }
      const data = await response.json();
      const mappedCourses = data.courses.map((course) => ({
        ...course,
        availableSeats: course.Seats,
      }));

        // Sort courses by Id in ascending order
      const sortedCourses = mappedCourses.sort((a, b) => a.Id - b.Id);

      setCourses(sortedCourses);
      setLoading(false);
    } catch (error) {
      setError("Failed to fetch courses");
      setLoading(false);
      toast.error("Failed to load courses. Please try again later.");
    }
    checkEnrollmentStatus();
  };
  const checkEnrollmentStatus = async () => {
    // //console.log("helooooooooooooooooooooooooo");
    try {
      const response = await fetch(
        `https://backendelectrumnhce.sunkn.tech/session/${sessionName}/checkenrollment/${user.userId}`
      );
      if (!response.ok) {
        throw new Error("Failed to check enrollment status");
      }

      const data = await response.json();
      // //console.log(data);
      if (data.enrolled) {
        setEnrolled(data.course);
      }
    } catch (error) {
      setError("Failed to check enrollment status");
      toast.error("Failed to check enrollment status.");
    }
  };

  useEffect(() => {
    if (courses.length > 0) {
      const ws = new WebSocket(
        `wss://backendelectrumnhce.sunkn.tech/session/ws/${sessionName}`
      );

      ws.onopen = () => {
        //console.log("WebSocket Connected");
      };

      ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        setCourses((prevCourses) =>
          prevCourses.map((course) => ({
            ...course,
            availableSeats: parseInt(
              data[course.Id] || course.availableSeats
            ),
          }))
        );
      };

      ws.onclose = () => {
        // console.log("WebSocket Disconnected");
      };

      return () => {
        ws.close();
      };
    }
  }, [courses.length, sessionName]);

  const handleEnrollConfirm = (course) => {
    setSelectedCourse(course);
    setIsConfirmOpen(true);
  };

  const handleEnrollCancel = () => {
    setIsConfirmOpen(false);
    setSelectedCourse(null);
  };

  const handleEnrollSubmit = async () => {
    if (!selectedCourse) return;
    
    setEnrollingCourseId(selectedCourse.Id);

    setIsConfirmOpen(false);

    try {
      const response = await fetch(
        `https://backendelectrumnhce.sunkn.tech/session/${sessionName}/enroll`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            id: user.userId,
            course: selectedCourse.Id.toString(),
          }),
        }
      );

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message);
      }
      
      toast.success(`Successfully enrolled in course ${selectedCourse.Code}`);
      checkEnrollmentStatus();
    } catch (error) {
      toast.error(`${error.message}`);
      setEnrolled(null);
    } finally {
      setEnrollingCourseId(null);
      setSelectedCourse(null);
    }
  };

  // Helper function to determine slot background color based on slot name.
  const getSlotBgColor = (slot) => {
    const lowerSlot = slot.toLowerCase();
    // Define an object that maps each slot category to an array of color classes.
    const mapping = {
      morning: ["bg-yellow-300", "bg-yellow-400", "bg-yellow-500"],
      afternoon: ["bg-orange-300", "bg-orange-400", "bg-orange-500"],
      evening: ["bg-purple-300", "bg-purple-400", "bg-purple-500"],
    };

    // Loop through the keys and check if the slot matches the category.
    for (const key in mapping) {
      if (lowerSlot.includes(key)) {
        // Try to extract a number from the slot string.
        const match = lowerSlot.match(/\d+/);
        let index = 0;
        if (match && match[0]) {
          // Use the number as an index (adjusted by -1 for array index).
          index = parseInt(match[0], 10) - 1;
          // Clamp the index to the bounds of our colors array.
          if (index < 0) index = 0;
          if (index >= mapping[key].length) index = mapping[key].length - 1;
        }
        return mapping[key][index];
      }
    }
    return "bg-gray-300"; // Default color if no matching slot category is found.
  };

  // if (!user.userId) {
  //   return <Navigate to="/login" />;
  // }

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
          <div className="hidden md:flex items-center space-x-4">
            <span className="text-white text-sm">
              USN: {user.userId}
            </span>
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
          <span className="block text-white mb-2">
            USN: {user.userId}
          </span>
          <button onClick={handleHomeClick} className="block text-white mb-2">
            Home
          </button>
          <button onClick={handleLogout} className="block text-white">
            Logout
          </button>
        </div>
      )}
      <div className="container mx-auto p-4 bg-gray-100">
        <Toaster position="top-right" />
        <h1 className="text-3xl font-bold mb-6 text-center text-indigo-800">
          Course Enrollment for {sessionName}
        </h1>
        {enrolled && (
          <div className="max-w-md mx-auto my-8 p-6 bg-blue-100 border-l-4 border-blue-500 text-blue-700 shadow-lg rounded-lg">
            <div className="flex items-center">
              <svg
                className="w-6 h-6 mr-4 text-blue-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M5 13l4 4L19 7"
                ></path>
              </svg>
              <div>
                <h2 className="text-lg font-semibold">Enrollment Status</h2>
                <p className="mt-1">
                  You have been enrolled to course{" "}
                  <span className="font-bold">{enrolled.name}</span>{" "}
                  <span className="font-bold">{enrolled.code}</span>.
                </p>
              </div>
            </div>
          </div>
        )}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {courses.map((course) => (
            <div
              key={course.Id}
              className="bg-white rounded-lg shadow-lg overflow-hidden hover:shadow-xl transition-shadow duration-300 border border-indigo-100"
            >
              <div className="p-6">
                <h2 className="text-xl font-semibold mb-2 text-indigo-700">
                  {(() => {
                    try {
                      return course.Name.split("(")[0].trim();
                    } catch (error) {
                      console.error(
                        "Error parsing course name:",
                        error,
                        course
                      );
                      return course.Name || "Course Name Not Available";
                    }
                  })()}
                </h2>
                <p className="text-gray-600 mb-1">
                  Course Code: {course.Code || "N/A"}
                </p>
                {(() => {
                  try {
                    const match = course.Name.match(/\(([^)]+)\)/);
                    if (!match) return null;
                    const slot = match[1];
                    return (
                      <p className="text-gray-600 mb-4">
                        Slot:{" "}
                        <span
                          className={`text-black px-2 py-1 rounded ${getSlotBgColor(
                            slot
                          )}`}
                        >
                          {slot}
                        </span>
                      </p>
                    );
                  } catch (error) {
                    console.error(
                      "Error parsing course slot:",
                      error,
                      course
                    );
                    return null;
                  }
                })()}
                <div className="mb-4">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-sm font-medium text-gray-700">
                      Available Seats:
                    </span>
                    <span className="text-sm font-medium text-indigo-600">
                      {course.availableSeats} / {course.Seats}
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2.5">
                    <div
                      className="bg-indigo-600 h-2.5 rounded-full transition-all duration-500 ease-in-out"
                      style={{
                        width: `${(course.availableSeats / course.Seats) * 100}%`,
                      }}
                    ></div>
                  </div>
                </div>
                <button
                  className={`w-full font-bold py-2 px-4 rounded transition duration-300 disabled:cursor-not-allowed disabled:opacity-50 ${
                    enrollingCourseId === course.Id
                      ? "bg-indigo-500 hover:bg-indigo-700 text-white"
                      : course.availableSeats === 0
                      ? "bg-red-500 text-white"
                      : enrolled
                      ? enrolled.ID === course.Id
                        ? "bg-green-500 text-white"
                        : "bg-gray-300 text-gray-700"
                      : "bg-indigo-500 hover:bg-indigo-700 text-white"
                  }`}
                  onClick={() => handleEnrollConfirm(course)}
                  disabled={
                    enrollingCourseId !== null ||
                    course.availableSeats === 0 ||
                    enrolled !== null
                  }
                >
                  {enrollingCourseId === course.Id
                    ? "Enrolling..."
                    : enrolled?.ID === course.Id
                    ? "Enrolled"
                    : course.availableSeats === 0
                    ? "Full"
                    : "Enroll"}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
      {isConfirmOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">Confirm Enrollment</h3>
              <button
                onClick={handleEnrollCancel}
                className="text-gray-500 hover:text-gray-700"
              >
                <XMarkIcon className="h-6 w-6" />
              </button>
            </div>
            <p className="mb-4">
              Are you sure you want to enroll in the following course?
            </p>
            <div className="mb-4">
              <p>
                <strong>Course Name:</strong> {selectedCourse?.Name}
              </p>
              <p>
                <strong>Course Code:</strong> {selectedCourse?.Code}
              </p>
            </div>
            <div className="flex justify-end space-x-2">
              <button
                onClick={handleEnrollCancel}
                className="px-4 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleEnrollSubmit}
                className="px-4 py-2 bg-indigo-500 text-white rounded hover:bg-indigo-600 transition-colors"
              >
                Confirm Enrollment
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EnrollmentPeriodCourses;
