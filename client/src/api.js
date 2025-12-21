// API Configuration - Import from centralized config
import { API_BASE } from "./config";

// Re-export for backward compatibility
export { API_BASE };

const API_URL = `${API_BASE}/auth`;

export const loginStudent = async (usn, password) => {
  const response = await fetch(`${API_URL}/student/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ usn, password }),
  });

  if (!response.ok) {
    const error = await response.json();
    let err = "";
    if (error.error) err = error.error;
    else err = "Something went wrong";

    throw new Error(err);
  }

  return response.json();
};

export const registerStudent = async (usn, email, password) => {
  const response = await fetch(`${API_URL}/student/register`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ usn, email, password }),
  });

  if (!response.ok) {
    const error = await response.json();
    let err = "";
    if (error.error) err = error.error;
    else err = "Something went wrong";

    throw new Error(err);
  }

  return response.json();
};

export const loginAdmin = async (email, password) => {
  const response = await fetch(`${API_URL}/admin/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email, password }),
  });

  if (!response.ok) {
    const error = await response.json();
    let err = "";
    if (error.error) err = error.error;
    else err = "Something went wrong";

    throw new Error(err);
  }

  return response.json();
};

export const fetchWithAuth = async (url, options = {}) => {
  const token = localStorage.getItem("token");
  const headers = {
    ...options.headers,
    Authorization: `Bearer ${token}`,
  };

  const response = await fetch(url, { ...options, headers });

  if (response.status === 401) {
    localStorage.removeItem("token");
    localStorage.removeItem("userType");
    window.location.href = "/login";
    throw new Error("Unauthorized");
  }

  return response;
};

export const resetStudentPassword = async (usn) => {
  const response = await fetch(`${API_URL}/student/reset-password`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ usn }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to reset password");
  }

  return response.json();
};

export const registerAdmin = async (name, email, password) => {
  const response = await fetch(`${API_URL}/admin/register`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ name, email, password }),
  });

  if (!response.ok) {
    const error = await response.json();
    let err = "";
    if (error.error) err = error.error;
    else err = "Something went wrong";

    throw new Error(err);
  }

  return response.json();
};

// Student Management APIs
export const getAllStudents = async (params = {}) => {
  const searchParams = new URLSearchParams();
  if (params.search) searchParams.append("search", params.search);
  if (params.department) searchParams.append("department", params.department);
  if (params.page) searchParams.append("page", params.page);
  if (params.limit) searchParams.append("limit", params.limit);

  const response = await fetch(
    `${API_BASE}/api/v1/student/all?${searchParams.toString()}`
  );

  if (!response.ok) {
    throw new Error("Failed to fetch students");
  }

  return response.json();
};

export const deleteStudent = async (usn) => {
  const response = await fetch(`${API_BASE}/api/v1/student/${usn}`, {
    method: "DELETE",
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to delete student");
  }

  return response.json();
};

export const exportStudentsExcel = async () => {
  const response = await fetch(`${API_BASE}/api/v1/student/export`);

  if (!response.ok) {
    throw new Error("Failed to export students");
  }

  return response.blob();
};

// Department APIs
export const getAllDepartments = async () => {
  const response = await fetch(`${API_BASE}/api/v1/student/departments`);

  if (!response.ok) {
    throw new Error("Failed to fetch departments");
  }

  return response.json();
};

export const createDepartment = async (name, fname) => {
  const response = await fetch(`${API_BASE}/api/v1/student/department`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ name, fname }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to create department");
  }

  return response.json();
};

// Session APIs - Now using session ID instead of name
export const getAllSessions = async () => {
  const response = await fetch(`${API_BASE}/session`);

  if (!response.ok) {
    throw new Error("Failed to fetch sessions");
  }

  return response.json();
};

export const getSessionDetails = async (sessionId) => {
  const response = await fetch(`${API_BASE}/session/details/${sessionId}`);

  if (!response.ok) {
    throw new Error("Failed to fetch session details");
  }

  return response.json();
};

export const getSession = async (sessionId) => {
  const response = await fetch(`${API_BASE}/session/${sessionId}`);

  if (!response.ok) {
    throw new Error("Failed to fetch session");
  }

  return response.json();
};

export const startSession = async (sessionId) => {
  const response = await fetch(`${API_BASE}/session/${sessionId}/start`, {
    method: "POST",
  });

  if (!response.ok) {
    throw new Error("Failed to start session");
  }

  return response.json();
};

export const stopSession = async (sessionId) => {
  const response = await fetch(`${API_BASE}/session/${sessionId}/stop`, {
    method: "POST",
  });

  if (!response.ok) {
    throw new Error("Failed to stop session");
  }

  return response.json();
};

export const createSession = async (formData) => {
  const response = await fetch(`${API_BASE}/session`, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || "Failed to create session");
  }

  return response.json();
};

export const uploadStudents = async (formData) => {
  const response = await fetch(`${API_BASE}/api/v1/student/upload`, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || "Failed to upload students");
  }

  return response.json();
};

export const downloadSessionExcel = async (sessionId) => {
  const response = await fetch(`${API_BASE}/session/${sessionId}/excel`);

  if (!response.ok) {
    throw new Error("Failed to download session data");
  }

  return response.blob();
};

export const checkEnrollmentStatus = async (sessionId, studentId) => {
  const response = await fetch(
    `${API_BASE}/session/${sessionId}/checkenrollment/${studentId}`
  );

  if (!response.ok) {
    throw new Error("Failed to check enrollment status");
  }

  return response.json();
};

export const enrollInCourse = async (sessionId, studentId, courseId) => {
  const response = await fetch(`${API_BASE}/session/${sessionId}/enroll`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      id: studentId,
      course: courseId.toString(),
    }),
  });

  if (!response.ok) {
    const data = await response.json();
    throw new Error(data.message || "Failed to enroll");
  }

  return response.json();
};

// Course Rules APIs - Now using session ID
export const getCourseRules = async (sessionId) => {
  const response = await fetch(`${API_BASE}/session/${sessionId}/rules`);

  if (!response.ok) {
    throw new Error("Failed to fetch course rules");
  }

  return response.json();
};

export const createCourseRule = async (sessionId, rule) => {
  const response = await fetch(`${API_BASE}/session/${sessionId}/rules`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(rule),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to create rule");
  }

  return response.json();
};

export const bulkCreateCourseRules = async (sessionId, rules) => {
  const response = await fetch(`${API_BASE}/session/${sessionId}/rules/bulk`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ rules }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to create rules");
  }

  return response.json();
};

export const deleteCourseRule = async (ruleId) => {
  const response = await fetch(`${API_BASE}/session/rules/${ruleId}`, {
    method: "DELETE",
  });

  if (!response.ok) {
    throw new Error("Failed to delete rule");
  }

  return response.json();
};
