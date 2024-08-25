import React, { useState, useRef } from "react";
import { toast, Toaster } from "react-hot-toast";
import { OutTable, ExcelRenderer } from 'react-excel-renderer';
import { Upload, File, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "./AuthContext";

const UploadStudent = () => {
  const [file, setFile] = useState(null);
  const [fileName, setFileName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [previewData, setPreviewData] = useState(null);
  const fileInputRef = useRef(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const navigate = useNavigate();
  const {logout} = useAuth()
 
  const handleLogout = () => {
    logout(); 
     navigate('/admin/login');
   };
 
   const handleHomeClick = () => {
     navigate('/admin/session'); // Adjust this path to your actual home page route
   };
   
  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      setFile(selectedFile);
      setFileName(selectedFile.name);

      ExcelRenderer(selectedFile, (err, resp) => {
        if (err) {
          console.error(err);
          toast.error("Error reading Excel file");
        } else {
          setPreviewData({
            cols: resp.cols.slice(0, 5),  // Limit to first 5 columns
            rows: resp.rows.slice(0, 21)  // Show header + first 20 rows
          });
        }
      });
    }
  };

  const handleRemoveFile = () => {
    setFile(null);
    setFileName("");
    setPreviewData(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);

    const formData = new FormData();
    formData.append("student", file);

    try {
      const response = await fetch("http://127.0.0.1:8000/api/v1/student/upload", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error("Failed to upload student");
      }

      toast.success("Students added successfully!");
      handleRemoveFile();
    } catch (error) {
      toast.error(`Error adding students: ${error.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-gray-100 min-h-screen">
      {/* Navbar */}
<nav className="bg-indigo-600 p-4">
  <div className="container mx-auto flex justify-between items-center">
    <button onClick={handleHomeClick} className="text-white hover:text-indigo-200">
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"></path>
      </svg>
    </button>
    <div className="text-white text-2xl font-bold">Electrum@NHCE</div>
    <div className="hidden md:flex items-center">
      <button onClick={handleLogout} className="text-white hover:text-indigo-200">Logout</button>
    </div>
    <div className="md:hidden">
      <button onClick={() => setIsMenuOpen(!isMenuOpen)} className="text-white">
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16m-7 6h7"></path>
        </svg>
      </button>
    </div>
  </div>
</nav>

      {/* Mobile Menu */}
      {isMenuOpen && (
        <div className="md:hidden bg-indigo-500 p-4">
          <button onClick={handleHomeClick} className="block text-white mb-2">Home</button>
          <button onClick={handleLogout} className="block text-white">Logout</button>
        </div>
      )}
    <div className="container mx-auto p-4 bg-gray-100 min-h-screen">
      <Toaster position="top-right" />
      <h1 className="text-3xl font-bold mb-6 text-center text-indigo-800">
        Add Students
      </h1>
      <div className="max-w-4xl mx-auto bg-white p-6 rounded-lg shadow-md">
        <form onSubmit={handleSubmit} className="mb-6">
          <div className="mb-4">
            <label
              htmlFor="file"
              className="block text-gray-700 text-sm font-bold mb-2"
            >
              Upload Excel File:
            </label>
            <div className="relative border-2 border-gray-300 border-dashed rounded-md p-6 mt-1">
              <input
                type="file"
                id="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                accept=".xlsx, .xls"
                required
              />
              <div className="text-center">
                <Upload className="mx-auto h-12 w-12 text-gray-400" />
                <p className="mt-1 text-sm text-gray-600">
                  {fileName || "Drop your Excel file here, or click to select"}
                </p>
              </div>
            </div>
          </div>
          {fileName && (
            <div className="flex items-center mt-2 text-sm text-gray-600">
              <File className="h-4 w-4 mr-2" />
              <span className="truncate">{fileName}</span>
              <button
                type="button"
                onClick={handleRemoveFile}
                className="ml-2 text-red-500 hover:text-red-700"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          )}
          <button
            type="submit"
            className="w-full mt-4 bg-indigo-500 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline transition duration-300 ease-in-out"
            disabled={isSubmitting || !file}
          >
            {isSubmitting ? "Adding students..." : "Upload Students"}
          </button>
        </form>
        
        {previewData && (
          <div className="mt-6">
            <h2 className="text-xl font-semibold mb-2">File Preview (First 20 rows)</h2>
            <div className="overflow-x-auto">
              <OutTable
                data={previewData.rows}
                columns={previewData.cols}
                tableClassName="min-w-full divide-y divide-gray-200"
                tableHeaderRowClass="bg-gray-50"
                tableHeaderCellClass="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                tableBodyRowClass="bg-white divide-y divide-gray-200"
                tableBodyCellClass="px-6 py-4 whitespace-nowrap text-sm text-gray-500"
              />
            </div>
          </div>
        )}
      </div>
    </div>
    </div>
  );
};

export default UploadStudent;