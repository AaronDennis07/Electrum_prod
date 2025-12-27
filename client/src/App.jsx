import CreateSessionForm from "./CreateSession.jsx";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Navigate } from "react-router-dom";
import EnrollmentPeriodCourses from "./Enrollment.jsx";
import SessionListPage from "./SessionList.jsx";
import DownloadSession from "./DownloadSession.jsx";
import AdminSessionPage from "./AdminSession.jsx";
import UploadStudent from "./UploadStudent.jsx";
import AdminSessionDashboard from "./SessionDetails.jsx";
import { AuthProvider } from "./AuthContext.jsx";
import LoginAdmin from "./LoginAdmin.jsx";
import PrivateRoute from "./PrivateRoute.jsx";
import LoginStudent from "./LoginStudent.jsx";
import RegisterStudent from "./RegisterStudent.jsx";
import AdminStudents from "./AdminStudents.jsx";
import AdminDepartments from "./AdminDepartments.jsx";

export function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Public Routes */}
          <Route path="/admin/login" element={<LoginAdmin />} />
          <Route path="/login" element={<LoginStudent />} />
          <Route path="/register" element={<RegisterStudent />} />

          {/* Admin Routes */}
          <Route
            path="/admin/session"
            element={
              <PrivateRoute allowedUserType="admin">
                <AdminSessionPage />
              </PrivateRoute>
            }
          />
          <Route
            path="/admin/create"
            element={
              <PrivateRoute allowedUserType="admin">
                <CreateSessionForm />
              </PrivateRoute>
            }
          />
          <Route
            path="/admin/upload"
            element={
              <PrivateRoute allowedUserType="admin">
                <UploadStudent />
              </PrivateRoute>
            }
          />
          <Route
            path="/admin/students"
            element={
              <PrivateRoute allowedUserType="admin">
                <AdminStudents />
              </PrivateRoute>
            }
          />
          <Route
            path="/admin/departments"
            element={
              <PrivateRoute allowedUserType="admin">
                <AdminDepartments />
              </PrivateRoute>
            }
          />
          <Route
            path="/admin/download"
            element={
              <PrivateRoute allowedUserType="admin">
                <DownloadSession />
              </PrivateRoute>
            }
          />
          <Route
            path="/admin/session/:sessionId"
            element={
              <PrivateRoute allowedUserType="admin">
                <AdminSessionDashboard />
              </PrivateRoute>
            }
          />

          {/* Student Routes */}
          <Route
            path="/enroll/:sessionId"
            element={
              <PrivateRoute allowedUserType="student">
                <EnrollmentPeriodCourses />
              </PrivateRoute>
            }
          />
          <Route
            path="/session"
            element={
              <PrivateRoute allowedUserType="student">
                <SessionListPage />
              </PrivateRoute>
            }
          />

          {/* Default redirect */}
          <Route path="/" element={<Navigate to="/login" replace />} />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
