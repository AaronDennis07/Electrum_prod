import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { registerStudent } from "./api";
import { toast, Toaster } from "react-hot-toast";
import { User, Mail, Lock } from "lucide-react";

const RegisterStudent = () => {
  const [usn, setUSN] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await registerStudent(usn, email, password);
      toast.success("Registration successful");
      navigate("/login");
    } catch (error) {
      console.log(error.toString());
      toast.error(error.toString());
    }
  };

  return (
<div className="min-h-screen flex flex-col">
        <div className="bg-white border-b border-gray-200 py-4">
        <div className="container mx-auto px-4">
          <div className="text-center text-gray-600">
            <p className="text-sm mb-1">
              Designed & Developed by <strong>S Aaron Dennis </strong>and <strong> Surya K N</strong> (Final Year Students, CSE Department, NHCE)
            </p>
           
             <p className="text-sm mb-2">
              Under the Guidance of <strong> Ms. Asha Rani Borah </strong> (Senior AP, CSE Department, NHCE) and <strong>Dr. R J Anandhi </strong>(Professor and Dean Academics, NHCE) 
            </p>
          </div>
        </div>
      </div>
      <div className="flex-grow bg-gradient-to-br from-blue-100 to-indigo-200 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
            <Toaster position="top-right" />
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
          Student Registration
        </h2>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow-lg sm:rounded-lg sm:px-10">
          <form className="space-y-6" onSubmit={handleSubmit}>
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
                  value={usn}
                  onChange={(e) => setUSN(e.target.value)}
                />
              </div>
            </div>

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
                  type="password"
                  autoComplete="new-password"
                  required
                  className="appearance-none block w-full px-3 py-2 pl-10 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
            </div>

            <div>
              <button
                type="submit"
                className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition duration-150 ease-in-out"
              >
                Register
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
    </div>
  );
};

export default RegisterStudent;