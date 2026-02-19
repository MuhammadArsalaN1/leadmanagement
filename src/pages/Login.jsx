import { useState } from "react";
import { auth } from "../firebase/firebase";
import { signInWithEmailAndPassword } from "firebase/auth";

export default function Login({ setUser }) {

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const login = async () => {
    try {
      const res = await signInWithEmailAndPassword(auth, email, password);
      setUser(res.user);
    } catch (err) {
      setError("Invalid email or password");
    }
  };

  return (
    <div style={styles.wrapper}>

      <div style={styles.card}>

        <h2>Arsalan Lead System</h2>

        {error && <p style={{color:"red"}}>{error}</p>}

        <input
          style={styles.input}
          placeholder="Email"
          onChange={(e)=>setEmail(e.target.value)}
        />

        <input
          style={styles.input}
          type="password"
          placeholder="Password"
          onChange={(e)=>setPassword(e.target.value)}
        />

        <button style={styles.btn} onClick={login}>
          Login
        </button>

      </div>

    </div>
  );
}

const styles = {
  wrapper:{
    height:"100vh",
    width:"100vw",
    display:"flex",
    alignItems:"center",
    justifyContent:"center",
    background:"#0a0f1c",
    margin:0
  },

  card:{
    background:"#0f172a",
    padding:30,
    borderRadius:12,
    width:360,
    color:"white",
    boxShadow:"0 0 20px rgba(0,0,0,0.3)"
  },

  input:{
    width:"100%",
    padding:12,
    margin:"10px 0",
    borderRadius:8,
    border:"none",
    background:"#1e293b",
    color:"white"
  },

  btn:{
    width:"100%",
    padding:12,
    background:"#2563eb",
    color:"white",
    border:"none",
    borderRadius:8,
    marginTop:10,
    cursor:"pointer"
  }
};