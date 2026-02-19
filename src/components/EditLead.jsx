import { useState } from "react";
import { db } from "../firebase/firebase";
import { doc, updateDoc, serverTimestamp } from "firebase/firestore";

import { QUERY_TYPES, STATUS, FIVERR_ACCOUNTS, BRANDS } from "../config";

export default function EditLead({ lead, onDone }) {

  const [form, setForm] = useState(lead);
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);

  const save = async () => {
    try {
      setLoading(true);

      await updateDoc(doc(db, "leads", lead.id), {
        fullName: form.fullName,
        cell: form.cell,
        queryType: form.queryType,
        fiverr: form.fiverr,
        brand: form.brand,
        status: form.status,
        updatedAt: serverTimestamp()
      });

      setMsg("✅ Updated Successfully");

      setTimeout(() => {
        onDone();
      }, 600);

    } catch (err) {
      console.log(err);
      setMsg("❌ Error updating lead");
    }

    setLoading(false);
  };

  return (
    <div style={s.card}>

      {msg && <div style={s.msg}>{msg}</div>}

      <Label text="Client Name" />
      <input
        style={s.input}
        value={form.fullName}
        onChange={e =>
          setForm({ ...form, fullName: e.target.value })
        }
      />

      <Label text="Cell Number" />
      <input
        style={s.input}
        value={form.cell}
        onChange={e =>
          setForm({ ...form, cell: e.target.value })
        }
      />

      <Label text="Service Type" />
      <select
        style={s.input}
        value={form.queryType}
        onChange={e =>
          setForm({ ...form, queryType: e.target.value })
        }
      >
        {QUERY_TYPES.map(q =>
          <option key={q}>{q}</option>
        )}
      </select>

      <Label text="Fiverr Account" />
      <select
        style={s.input}
        value={form.fiverr}
        onChange={e =>
          setForm({ ...form, fiverr: e.target.value })
        }
      >
        {FIVERR_ACCOUNTS.map(q =>
          <option key={q}>{q}</option>
        )}
      </select>

      <Label text="Brand" />
      <select
        style={s.input}
        value={form.brand}
        onChange={e =>
          setForm({ ...form, brand: e.target.value })
        }
      >
        {BRANDS.map(q =>
          <option key={q}>{q}</option>
        )}
      </select>

      <Label text="Status" />
      <select
        style={s.input}
        value={form.status}
        onChange={e =>
          setForm({ ...form, status: e.target.value })
        }
      >
        {STATUS.map(q =>
          <option key={q}>{q}</option>
        )}
      </select>

      <button
        style={s.btn}
        onClick={save}
        disabled={loading}
      >
        {loading ? "Saving..." : "Update Lead"}
      </button>

    </div>
  );
}

const Label = ({ text }) => (
  <div style={s.label}>{text}</div>
);

const s = {
  card: {
    background: "white",
    padding: 12,
  },

  label: {
    fontSize: 13,
    fontWeight: 600,
    marginTop: 6
  },

  input: {
    width: "100%",
    padding: 8,
    margin: "4px 0",
    borderRadius: 8,
    border: "1px solid #cbd5e1"
  },

  btn: {
    background: "#2563eb",
    color: "white",
    padding: 10,
    width: "100%",
    border: "none",
    borderRadius: 8,
    marginTop: 8
  },

  msg: {
    padding: 6,
    marginBottom: 6,
    background: "#f1f5f9",
    borderRadius: 6
  }
};
