import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { registerStudent } from "./api";
import { toast, Toaster } from "react-hot-toast";
import { User, Mail, Lock, Eye, EyeOff } from "lucide-react";

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

    // Regex: Must start with "1NH", then two digits, two uppercase letters, then three digits
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
      setOverlayMessage("Registration successful.");
      setTimeout(() => {
        navigate("/login");
      }, 2000);
    } catch (error) {
      toast.error(error.toString());
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-100 to-indigo-200 flex flex-col justify-center py-12 sm:px-6 lg:px-8 relative">
      <Toaster position="top-right" />
      {overlayMessage && (
        <div className="absolute inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 transition-opacity duration-300">
          <div className="p-6 rounded-lg bg-gray-800 bg-opacity-90">
            <p className="text-white text-3xl font-bold mb-2 font-sans">
              {overlayMessage}
            </p>
            {overlayMessage.includes("Registration successful") && (
              <p className="text-white text-sm animate-pulse font-sans">
                Redirecting to login...
              </p>
            )}
          </div>
        </div>
      )}
      <div className={`sm:mx-auto sm:w-full sm:max-w-md ${isSubmitting ? "opacity-50 pointer-events-none" : ""}`}>
        <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
          Student Registration
        </h2>
      </div>
      <div className={`mt-8 sm:mx-auto sm:w-full sm:max-w-md ${isSubmitting ? "opacity-50 pointer-events-none" : ""}`}>
        <div className="bg-white py-8 px-4 shadow-lg sm:rounded-lg sm:px-10">
          <form className="space-y-6" onSubmit={handleSubmit}>
            {/* USN Input */}
            <div>
              <label htmlFor="usn" className="block text-sm font-medium text-gray-700">
                USN
              </label>
              <div className="mt-1 relative rounded-md shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <User className="h-5 w-5 text-indigo-500" aria-hidden="true" />
                </div>
                <input
                  id="usn"
                  name="usn"
                  type="text"
                  required
                  className="appearance-none block w-full px-3 py-2 pl-10 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                  placeholder="Enter your USN"
                  style={{ textTransform: "uppercase" }}
                  title={usn.includes("@") ? "This is a USN, not an email." : ""}
                  value={usn}
                  onChange={(e) => setUSN(e.target.value.toUpperCase())}
                />
              </div>
            </div>

            {/* Email Input */}
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                Email
              </label>
              <div className="mt-1 relative rounded-md shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Mail className="h-5 w-5 text-indigo-500" aria-hidden="true" />
                </div>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  className="appearance-none block w-full px-3 py-2 pl-10 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                  placeholder="Enter your email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
            </div>

            {/* Password Input */}
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                Password
              </label>
              <div className="mt-1 relative rounded-md shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-indigo-500" aria-hidden="true" />
                </div>
                <input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  required
                  className="appearance-none block w-full px-3 py-2 pl-10 pr-10 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
                  {showPassword ? (
                    <EyeOff
                      onClick={() => setShowPassword(false)}
                      className="h-5 w-5 text-indigo-500 cursor-pointer"
                      aria-hidden="true"
                    />
                  ) : (
                    <Eye
                      onClick={() => setShowPassword(true)}
                      className="h-5 w-5 text-indigo-500 cursor-pointer"
                      aria-hidden="true"
                    />
                  )}
                </div>
              </div>
            </div>

            {/* Confirm Password Input */}
            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700">
                Confirm Password
              </label>
              <div className="mt-1 relative rounded-md shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-indigo-500" aria-hidden="true" />
                </div>
                <input
                  id="confirmPassword"
                  name="confirmPassword"
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  required
                  className="appearance-none block w-full px-3 py-2 pl-10 pr-10 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                  placeholder="Confirm your password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />
                <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
                  {showPassword ? (
                    <EyeOff
                      onClick={() => setShowPassword(false)}
                      className="h-5 w-5 text-indigo-500 cursor-pointer"
                      aria-hidden="true"
                    />
                  ) : (
                    <Eye
                      onClick={() => setShowPassword(true)}
                      className="h-5 w-5 text-indigo-500 cursor-pointer"
                      aria-hidden="true"
                    />
                  )}
                </div>
              </div>
            </div>

            {/* Register Button */}
            <div>
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition duration-150 ease-in-out disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? "Registering..." : "Register"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default RegisterStudent;
