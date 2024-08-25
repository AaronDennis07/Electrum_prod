import React, { createContext, useState, useContext, useEffect } from "react";

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const token = localStorage.getItem("token");
    const userType = localStorage.getItem("userType");
    const previous_course = localStorage.getItem("previous_course");
    const previous_course_id = localStorage.getItem("previous_course_id");
    const userId = localStorage.getItem("userId");
    console.log(userType);
    console.log(token);
    console.log(userId);
    if (token && userType && userId) {
      setUser({ token, userType, userId ,previous_course,previous_course_id});
    }
    setLoading(false);
  }, []);

  const login = (token, userType, userId,previous_course,previous_course_id) => {
    localStorage.setItem("token", token);
    localStorage.setItem("userType", userType);
    localStorage.setItem("previous_course",userType==="student"?  previous_course : null);
    localStorage.setItem("previous_course_id",userType==="student"? previous_course_id.replace("6", "7"):null);
    localStorage.setItem("userId", userId);
    setUser({ token, userType,userId, previous_course,previous_course_id});
  };

  const logout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("userType");
    localStorage.removeItem("userId");
    localStorage.removeItem("previous_course");
    localStorage.removeItem("previous_course_id");
    
    setUser(null);
  };
  if (loading) return <div>loading..</div>;
  return (
    <AuthContext.Provider value={{ user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
