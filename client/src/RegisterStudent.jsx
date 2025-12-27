import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { registerStudent } from "./api";
import { toast, Toaster } from "react-hot-toast";
import { User, Mail, Lock, Eye, EyeOff, UserPlus, ArrowRight, Loader2, CheckCircle } from "lucide-react";

const RegisterStudent = () => {
  const [usn, setUSN] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [overlayMessage, setOverlayMessage] = useState("");
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    const formattedUSN = usn.trim().toUpperCase();
    const trimmedEmail = email.trim();
    const trimmedPassword = password.trim();
    const trimmedConfirmPassword = confirmPassword.trim();

    const usnRegex = /^1NH\d{2}[A-Z]{2}\d{3}$/;
    if (!usnRegex.test(formattedUSN)) {
      toast.error("Invalid USN format. Example: 1NH21CS242");
      return;
    }

    if (trimmedPassword !== trimmedConfirmPassword) {
      toast.error("Passwords do not match");
      return;
    }

    if (trimmedPassword.length < 6) {
      toast.error("Password must be at least 6 characters long");
      return;
    }

    setIsSubmitting(true);

    try {
      await registerStudent(formattedUSN, trimmedEmail, trimmedPassword);
      setOverlayMessage("Registration successful!");
      setTimeout(() => {
        navigate("/login");
      }, 2000);
    } catch (error) {
      toast.error(error.toString());
      setIsSubmitting(false);
    }
  };

  const getPasswordStrength = () => {
    if (!password) return { level: 0, text: "", color: "" };
    if (password.length < 6) return { level: 1, text: "Too short", color: "bg-red-400" };
    if (password.length < 8) return { level: 2, text: "Weak", color: "bg-orange-400" };
    if (password.length < 12 && /[A-Z]/.test(password) && /[0-9]/.test(password)) {
      return { level: 3, text: "Good", color: "bg-amber-400" };
    }
    if (password.length >= 12 && /[A-Z]/.test(password) && /[0-9]/.test(password) && /[^A-Za-z0-9]/.test(password)) {
      return { level: 4, text: "Strong", color: "bg-emerald-500" };
    }
    return { level: 2, text: "Moderate", color: "bg-amber-400" };
  };

  const passwordStrength = getPasswordStrength();

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8">
      <Toaster position="top-center" />

      {/* Overlay Message */}
      {overlayMessage && (
        <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-8 text-center max-w-sm mx-4 shadow-xl">
            <CheckCircle className="w-12 h-12 text-emerald-500 mx-auto mb-4" />
            <p className="text-slate-700 text-lg font-medium mb-1">{overlayMessage}</p>
            <p className="text-slate-500 text-sm">Redirecting to login...</p>
          </div>
        </div>
      )}

      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        {/* Logo/Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 bg-slate-800 rounded-xl mb-4">
            <UserPlus className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-2xl font-semibold text-slate-800">Create account</h1>
          <p className="text-slate-500 mt-1">Register to start enrolling in courses</p>
        </div>

        {/* Register Form */}
        <div className="bg-white border border-slate-200 rounded-xl p-8 shadow-sm">
          <form className="space-y-4" onSubmit={handleSubmit}>
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
                  required
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200 focus:border-slate-300 transition-all"
                  placeholder="1NH21CS001"
                  style={{ textTransform: "uppercase" }}
                  value={usn}
                  onChange={(e) => setUSN(e.target.value.toUpperCase())}
                  disabled={isSubmitting}
                />
              </div>
              <p className="text-slate-400 text-xs mt-1">Your USN must be pre-registered by admin</p>
            </div>

            {/* Email Input */}
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-slate-700 mb-1.5">
                Email
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Mail className="h-5 w-5 text-slate-400" />
                </div>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200 focus:border-slate-300 transition-all"
                  placeholder="your.email@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
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
                  autoComplete="new-password"
                  required
                  className="w-full pl-10 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200 focus:border-slate-300 transition-all"
                  placeholder="Create a password"
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
              {/* Password Strength */}
              {password && (
                <div className="mt-2">
                  <div className="flex gap-1 mb-1">
                    {[1, 2, 3, 4].map((level) => (
                      <div
                        key={level}
                        className={`h-1 flex-1 rounded-full transition-colors ${
                          level <= passwordStrength.level ? passwordStrength.color : "bg-slate-200"
                        }`}
                      />
                    ))}
                  </div>
                  <p className="text-xs text-slate-500">{passwordStrength.text}</p>
                </div>
              )}
            </div>

            {/* Confirm Password Input */}
            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-slate-700 mb-1.5">
                Confirm Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-slate-400" />
                </div>
                <input
                  id="confirmPassword"
                  name="confirmPassword"
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  required
                  className={`w-full pl-10 pr-10 py-2.5 bg-slate-50 border rounded-lg text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200 transition-all ${
                    confirmPassword && confirmPassword !== password
                      ? "border-red-300"
                      : confirmPassword && confirmPassword === password
                        ? "border-emerald-300"
                        : "border-slate-200 focus:border-slate-300"
                  }`}
                  placeholder="Confirm your password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  disabled={isSubmitting}
                />
                {confirmPassword && (
                  <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
                    {confirmPassword === password ? (
                      <CheckCircle className="h-5 w-5 text-emerald-500" />
                    ) : (
                      <span className="text-red-500 text-xs">No match</span>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Register Button */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full flex items-center justify-center gap-2 py-2.5 bg-slate-800 hover:bg-slate-700 text-white font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed mt-6"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Creating account...
                </>
              ) : (
                <>
                  Create Account
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Login Link */}
          <div className="mt-6 text-center">
            <p className="text-slate-500 text-sm">
              Already have an account?{" "}
              <Link
                to="/login"
                className="text-slate-700 hover:text-slate-900 font-medium transition-colors"
              >
                Sign in
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RegisterStudent;
