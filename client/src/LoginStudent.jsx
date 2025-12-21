import React, { useState } from "react";
import { loginStudent } from "./api";
import { useAuth } from "./AuthContext";
import { useNavigate, Link } from "react-router-dom";
import { toast, Toaster } from "react-hot-toast";
import { User, Lock, Eye, EyeOff, BookOpen, ArrowRight, Loader2 } from "lucide-react";

const LoginStudent = () => {
  const [usn, setUsn] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [overlayMessage, setOverlayMessage] = useState("");
  const userType = "student";
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    const formattedUSN = usn.trim().toUpperCase();
    const trimmedPassword = password.trim();

    const usnRegex = /^1NH\d{2}[A-Z]{2}\d{3}$/;
    if (!usnRegex.test(formattedUSN)) {
      toast.error("Invalid USN format. Example: 1NH21CS242");
      return;
    }

    setIsSubmitting(true);
    try {
      const data = await loginStudent(formattedUSN, trimmedPassword);
      login(
        data.token,
        userType,
        formattedUSN,
        data.previous_course,
        data.previous_course_id
      );
      navigate("/session");
    } catch (error) {
      if (error.toString() === "Error: Not registered") {
        setOverlayMessage("Not registered. Redirecting...");
        setTimeout(() => {
          navigate("/register");
        }, 2000);
      } else if (error.toString() === "Error: Invalid Credentials") {
        toast.error("Invalid credentials. Please try again.");
        setIsSubmitting(false);
      } else {
        toast.error(error.toString());
        setIsSubmitting(false);
      }
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8">
      <Toaster position="top-center" />

      {/* Overlay Message */}
      {overlayMessage && (
        <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-8 text-center max-w-sm mx-4 shadow-xl">
            <Loader2 className="w-10 h-10 animate-spin text-slate-400 mx-auto mb-4" />
            <p className="text-slate-700 text-lg font-medium">{overlayMessage}</p>
          </div>
        </div>
      )}

      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        {/* Logo/Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 bg-slate-800 rounded-xl mb-4">
            <BookOpen className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-2xl font-semibold text-slate-800">Welcome back</h1>
          <p className="text-slate-500 mt-1">Sign in to access your courses</p>
        </div>

        {/* Login Form */}
        <div className="bg-white border border-slate-200 rounded-xl p-8 shadow-sm">
          <form className="space-y-5" onSubmit={handleSubmit}>
            {/* USN Input */}
            <div>
              <label htmlFor="usn" className="block text-sm font-medium text-slate-700 mb-1.5">
                USN
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <User className="h-5 w-5 text-slate-400" />
                </div>
                <input
                  id="usn"
                  name="usn"
                  type="text"
                  autoComplete="username"
                  required
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200 focus:border-slate-300 transition-all"
                  placeholder="1NH21CS001"
                  style={{ textTransform: "uppercase" }}
                  value={usn}
                  onChange={(e) => setUsn(e.target.value.toUpperCase())}
                  disabled={isSubmitting}
                />
              </div>
            </div>

            {/* Password Input */}
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-slate-700 mb-1.5">
                Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-slate-400" />
                </div>
                <input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  required
                  className="w-full pl-10 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200 focus:border-slate-300 transition-all"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={isSubmitting}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 transition-colors"
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </div>

            {/* Sign In Button */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full flex items-center justify-center gap-2 py-2.5 bg-slate-800 hover:bg-slate-700 text-white font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Signing in...
                </>
              ) : (
                <>
                  Sign In
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Register Link */}
          <div className="mt-6 text-center">
            <p className="text-slate-500 text-sm">
              First time here?{" "}
              <Link
                to="/register"
                className="text-slate-700 hover:text-slate-900 font-medium transition-colors"
              >
                Register
              </Link>
            </p>
          </div>
        </div>

        {/* Admin Link */}
        <div className="mt-6 text-center">
          <Link
            to="/admin/login"
            className="text-slate-400 hover:text-slate-600 text-sm transition-colors"
          >
            Admin Login →
          </Link>
        </div>
      </div>
    </div>
  );
};

export default LoginStudent;
