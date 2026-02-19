import { useState } from "react";
import { db } from "../firebase/firebase";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";

import { QUERY_TYPES, STATUS, FIVERR_ACCOUNTS, BRANDS } from "../config";

export default function AddLead({ onDone }) {
  const empty = {
    fullName: "",
    cell: "",
    queryType: "3D Jewelry",
    fiverr: "Arsalanco1",
    brand: "IT CORP inc",
    status: "Still in Talk",
    comment: "",
    followDate: "",
    followTime: "",
  };

  const [form, setForm] = useState(empty);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");

  // ─── VALIDATION ─────────────────────
  const validate = () => {
    if (!form.fullName.trim()) return "Client name required";
    if (!form.cell.trim()) return "Cell number required";
    if (form.cell.length < 6) return "Cell seems invalid";
    
    if ((form.followDate && !form.followTime) || (!form.followDate && form.followTime)) {
      return "Select both follow-up date & time";
    }

    if (form.followDate && form.followTime) {
      const d = new Date(`${form.followDate}T${form.followTime}`);
      if (d < new Date()) return "Follow-up must be future time";
    }

    return null;
  };

  // ─── SAVE ───────────────────────────
  const save = async () => {
    const error = validate();
    if (error) {
      setMsg(error);
      return;
    }

    try {
      setLoading(true);
      setMsg("");

      let followUpAt = null;
      if (form.followDate && form.followTime) {
        followUpAt = new Date(`${form.followDate}T${form.followTime}`).toISOString();
      }

      await addDoc(collection(db, "leads"), {
        fullName: form.fullName.trim(),
        cell: form.cell.trim(),
        queryType: form.queryType,
        fiverr: form.fiverr,
        brand: form.brand,
        status: form.status,
        comments: form.comment
          ? [{
              text: form.comment.trim(),
              date: new Date().toLocaleString(),
            }]
          : [],
        followUpAt,
        notified: false,
        createdAt: serverTimestamp(),
      });

      setMsg("✅ Lead Added Successfully");
      setForm(empty);
      setTimeout(() => {
        if (onDone) onDone();
      }, 800);

    } catch (err) {
      console.log(err);
      setMsg("❌ Error saving lead");
    }

    setLoading(false);
  };

  // ─── RESET ──────────────────────────
  const resetForm = () => {
    setForm(empty);
    setMsg("");
  };

  // ─── UI ─────────────────────────────
  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h3 style={styles.title}>Add New Lead</h3>
        <p style={styles.subtitle}>Fill in the details to start tracking</p>
      </div>

      {msg && (
        <div style={{
          ...styles.alert,
          backgroundColor: msg.includes("✅") ? "#d1fae5" : "#fee2e2",
          color: msg.includes("✅") ? "#065f46" : "#7f1d1d",
          borderColor: msg.includes("✅") ? "#a7f3d0" : "#fecaca",
        }}>
          {msg}
        </div>
      )}

      <div style={styles.formGrid}>
        {/* Row 1: Name & Phone */}
        <div style={styles.formGroup}>
          <label style={styles.label}>
            <span style={styles.labelText}>Client Name</span>
            <span style={styles.required}>*</span>
          </label>
          <input
            style={styles.input}
            placeholder="John Doe"
            value={form.fullName}
            onChange={e => setForm({ ...form, fullName: e.target.value })}
          />
        </div>

        <div style={styles.formGroup}>
          <label style={styles.label}>
            <span style={styles.labelText}>Phone Number</span>
            <span style={styles.required}>*</span>
          </label>
          <input
            style={styles.input}
            placeholder="+1234567890"
            value={form.cell}
            onChange={e => setForm({ ...form, cell: e.target.value })}
          />
        </div>

        {/* Row 2: Query Type & Fiverr Account */}
        <div style={styles.formGroup}>
          <label style={styles.label}>
            <span style={styles.labelText}>Service Type</span>
          </label>
          <select
            style={styles.select}
            value={form.queryType}
            onChange={e => setForm({ ...form, queryType: e.target.value })}
          >
            {QUERY_TYPES.map(q => (
              <option key={q} value={q}>
                {q}
              </option>
            ))}
          </select>
        </div>

        <div style={styles.formGroup}>
          <label style={styles.label}>
            <span style={styles.labelText}>Fiverr Account</span>
          </label>
          <select
            style={styles.select}
            value={form.fiverr}
            onChange={e => setForm({ ...form, fiverr: e.target.value })}
          >
            {FIVERR_ACCOUNTS.map(q => (
              <option key={q} value={q}>
                {q}
              </option>
            ))}
          </select>
        </div>

        {/* Row 3: Brand & Status */}
        <div style={styles.formGroup}>
          <label style={styles.label}>
            <span style={styles.labelText}>Brand</span>
          </label>
          <select
            style={styles.select}
            value={form.brand}
            onChange={e => setForm({ ...form, brand: e.target.value })}
          >
            {BRANDS.map(q => (
              <option key={q} value={q}>
                {q}
              </option>
            ))}
          </select>
        </div>

        <div style={styles.formGroup}>
          <label style={styles.label}>
            <span style={styles.labelText}>Status</span>
          </label>
          <select
            style={styles.select}
            value={form.status}
            onChange={e => setForm({ ...form, status: e.target.value })}
          >
            {STATUS.map(q => (
              <option key={q} value={q}>
                {q}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Initial Comment */}
      <div style={styles.formGroup}>
        <label style={styles.label}>
          <span style={styles.labelText}>Initial Comment</span>
          <span style={styles.labelHint}>Optional</span>
        </label>
        <textarea
          style={styles.textarea}
          placeholder="Add any notes about this lead..."
          rows="3"
          value={form.comment}
          onChange={e => setForm({ ...form, comment: e.target.value })}
        />
      </div>

      {/* Follow-up Section */}
      <div style={styles.followupCard}>
        <div style={styles.followupHeader}>
          <div>
            <span style={styles.followupTitle}>Schedule Follow-up</span>
            <span style={styles.followupSubtitle}>Optional reminder</span>
          </div>
          <div style={styles.followupIcon}>⏰</div>
        </div>
        
        <div style={styles.dateTimeGrid}>
          <div style={styles.dateTimeGroup}>
            <label style={styles.dateTimeLabel}>Date</label>
            <input
              type="date"
              style={styles.dateInput}
              value={form.followDate}
              onChange={e => setForm({ ...form, followDate: e.target.value })}
            />
          </div>
          
          <div style={styles.dateTimeGroup}>
            <label style={styles.dateTimeLabel}>Time</label>
            <input
              type="time"
              style={styles.dateInput}
              value={form.followTime}
              onChange={e => setForm({ ...form, followTime: e.target.value })}
            />
          </div>
        </div>
        
        {form.followDate && form.followTime && (
          <div style={styles.followupPreview}>
            <span style={styles.previewLabel}>Scheduled for:</span>
            <span style={styles.previewValue}>
              {new Date(`${form.followDate}T${form.followTime}`).toLocaleString()}
            </span>
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div style={styles.buttonRow}>
        <button
          style={styles.secondaryButton}
          onClick={resetForm}
          disabled={loading}
        >
          <span style={styles.buttonIcon}>↺</span>
          Clear
        </button>
        
        <button
          style={styles.primaryButton}
          onClick={save}
          disabled={loading}
        >
          {loading ? (
            <>
              <span style={styles.buttonSpinner}></span>
              Saving...
            </>
          ) : (
            <>
              <span style={styles.buttonIcon}>✓</span>
              Save Lead
            </>
          )}
        </button>
      </div>
    </div>
  );
}

// ─── OPTIMIZED STYLES ──────────────────────────────
const styles = {
  container: {
    backgroundColor: 'white',
    borderRadius: '12px',
    padding: '20px',
    maxWidth: '100%',
    width: '100%',
    boxSizing: 'border-box',
  },

  header: {
    marginBottom: '20px',
  },

  title: {
    fontSize: '18px',
    fontWeight: '700',
    color: '#1e293b',
    margin: '0 0 4px 0',
  },

  subtitle: {
    fontSize: '13px',
    color: '#64748b',
    fontWeight: '400',
    margin: 0,
  },

  alert: {
    padding: '10px 16px',
    borderRadius: '8px',
    marginBottom: '20px',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontSize: '13px',
    border: '1px solid',
  },

  formGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: '16px',
    marginBottom: '16px',
  },

  formGroup: {
    marginBottom: '16px',
  },

  label: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '6px',
  },

  labelText: {
    fontSize: '13px',
    fontWeight: '600',
    color: '#1e293b',
  },

  required: {
    color: '#dc2626',
    fontSize: '12px',
  },

  labelHint: {
    fontSize: '11px',
    color: '#94a3b8',
    fontWeight: '400',
  },

  input: {
    width: '100%',
    padding: '8px 12px',
    borderRadius: '8px',
    border: '1px solid #e2e8f0',
    backgroundColor: '#f8fafc',
    fontSize: '14px',
    color: '#1e293b',
    boxSizing: 'border-box',
    transition: 'all 0.2s ease',
  },

  select: {
    width: '100%',
    padding: '8px 12px',
    borderRadius: '8px',
    border: '1px solid #e2e8f0',
    backgroundColor: '#f8fafc',
    fontSize: '14px',
    color: '#1e293b',
    boxSizing: 'border-box',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
  },

  textarea: {
    width: '100%',
    padding: '8px 12px',
    borderRadius: '8px',
    border: '1px solid #e2e8f0',
    backgroundColor: '#f8fafc',
    fontSize: '14px',
    color: '#1e293b',
    boxSizing: 'border-box',
    resize: 'vertical',
    minHeight: '80px',
    fontFamily: 'inherit',
    transition: 'all 0.2s ease',
  },

  followupCard: {
    backgroundColor: '#f8fafc',
    borderRadius: '10px',
    padding: '16px',
    marginBottom: '20px',
    border: '1px solid #e2e8f0',
  },

  followupHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '12px',
  },

  followupTitle: {
    fontSize: '14px',
    fontWeight: '600',
    color: '#1e293b',
    display: 'block',
  },

  followupSubtitle: {
    fontSize: '12px',
    color: '#64748b',
    display: 'block',
    marginTop: '2px',
  },

  followupIcon: {
    fontSize: '20px',
    color: '#3b82f6',
  },

  dateTimeGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
    gap: '12px',
  },

  dateTimeGroup: {
    flex: 1,
  },

  dateTimeLabel: {
    fontSize: '12px',
    fontWeight: '500',
    color: '#64748b',
    marginBottom: '4px',
    display: 'block',
  },

  dateInput: {
    width: '100%',
    padding: '8px 12px',
    borderRadius: '8px',
    border: '1px solid #e2e8f0',
    backgroundColor: 'white',
    fontSize: '14px',
    color: '#1e293b',
    boxSizing: 'border-box',
  },

  followupPreview: {
    marginTop: '12px',
    padding: '8px 12px',
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    borderRadius: '6px',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },

  previewLabel: {
    fontSize: '12px',
    fontWeight: '500',
    color: '#1d4ed8',
  },

  previewValue: {
    fontSize: '13px',
    fontWeight: '600',
    color: '#1e293b',
  },

  buttonRow: {
    display: 'flex',
    gap: '12px',
    marginTop: '24px',
  },

  primaryButton: {
    flex: 1,
    background: '#3b82f6',
    color: 'white',
    borderRadius: '8px',
    border: 'none',
    padding: '10px 16px',
    fontWeight: '600',
    fontSize: '14px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    transition: 'all 0.2s ease',
    height: '40px',
  },

  secondaryButton: {
    flex: 1,
    background: '#f1f5f9',
    color: '#475569',
    borderRadius: '8px',
    border: '1px solid #e2e8f0',
    padding: '10px 16px',
    fontWeight: '600',
    fontSize: '14px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    transition: 'all 0.2s ease',
    height: '40px',
  },

  buttonIcon: {
    fontSize: '16px',
  },

  buttonSpinner: {
    width: '16px',
    height: '16px',
    border: '2px solid rgba(255, 255, 255, 0.3)',
    borderTopColor: 'white',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite',
  },
};

// Add animation for spinner
if (typeof document !== 'undefined') {
  const styleSheet = document.createElement('style');
  styleSheet.textContent = `
    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }
  `;
  document.head.appendChild(styleSheet);
}