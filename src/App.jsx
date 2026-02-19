import { useState, useEffect } from "react";
import { auth } from "./firebase/firebase";
import { onAuthStateChanged, signOut } from "firebase/auth";

import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";

export default function App() {

  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
  }, []);

  if (loading) {
    return <h3>Loading...</h3>;
  }

  if (!user) {
    return <Login setUser={setUser} />;
  }

  return (
    <div style={styles.app}>

      {/* TOP BAR */}
      <div style={styles.topbar}>

        <h2>Arsalan CRM</h2>

        <button
          style={styles.logout}
          onClick={() => signOut(auth)}
        >
          Logout
        </button>

      </div>

      {/* MAIN */}
      <Dashboard />

    </div>
  );
}

const styles = {
  app:{
    minHeight:"100vh",
    background:"#0a0f1c",
    color:"white"
  },

  topbar:{
    display:"flex",
    justifyContent:"space-between",
    alignItems:"center",
    padding:"10px 20px",
    background:"#0f172a"
  },

  logout:{
    background:"#dc2626",
    border:"none",
    padding:"8px 14px",
    borderRadius:6,
    color:"white"
  }
};
