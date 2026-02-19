import { useState, useEffect } from "react";
import { db } from "../firebase/firebase";
import {
  collection,
  addDoc,
  onSnapshot,
  updateDoc,
  deleteDoc,
  doc,
  query,
  where,
  serverTimestamp,
  getDocs,
  writeBatch
} from "firebase/firestore";

export default function TodoBoard() {

  const today = new Date().toISOString().slice(0,10);
  const formattedDate = new Date().toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric'
  });

  const [list, setList] = useState([]);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [lateTasks, setLateTasks] = useState([]);
  const [showLateTasks, setShowLateTasks] = useState(false);

  // ─── CHECK AND ROLLOVER LATE TASKS ─────────────
  useEffect(() => {
    const checkLateTasks = async () => {
      try {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = yesterday.toISOString().slice(0,10);

        // Query yesterday's incomplete tasks
        const q = query(
          collection(db, "todos"),
          where("date", "==", yesterdayStr),
          where("done", "==", false)
        );

        const snapshot = await getDocs(q);
        const lateTasksList = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));

        if (lateTasksList.length > 0) {
          setLateTasks(lateTasksList);
          
          // Auto-rollover to today (optional - you can comment this out if you want manual control)
          await rolloverLateTasks(lateTasksList);
        }
      } catch (err) {
        console.log("Error checking late tasks:", err);
      }
    };

    checkLateTasks();
  }, []);

  // ─── ROLLOVER LATE TASKS ───────────────────────
  const rolloverLateTasks = async (tasksToRollover = lateTasks) => {
    try {
      const batch = writeBatch(db);
      
      tasksToRollover.forEach(task => {
        // Update the task to today's date and mark as late
        const taskRef = doc(db, "todos", task.id);
        batch.update(taskRef, {
          date: today,
          isLate: true,
          originalDate: task.date,
          rolledOverAt: serverTimestamp()
        });
      });

      await batch.commit();
      
      // Refresh the list
      setShowLateTasks(false);
      setLateTasks([]);
      
    } catch (err) {
      setError("Failed to rollover late tasks");
      console.error("Rollover error:", err);
    }
  };

  // ─── LOAD TODAY TODOS ──────────────────────────
  useEffect(() => {
    if (!db) {
      setError("Firebase DB not initialized");
      return;
    }

    try {
      const q = query(
        collection(db, "todos"),
        where("date", "==", today)
      );

      const unsub = onSnapshot(
        q,
        snap => {
          const data = snap.docs.map(d => ({
            id: d.id,
            text: d.data()?.text || "",
            done: d.data()?.done || false,
            date: d.data()?.date || today,
            isLate: d.data()?.isLate || false,
            originalDate: d.data()?.originalDate || null,
            createdAt: d.data()?.createdAt || serverTimestamp()
          }));

          // Sort: late tasks first, then incomplete, then by creation time
          const sorted = data.sort((a, b) => {
            // Late tasks first
            if (a.isLate !== b.isLate) return b.isLate ? 1 : -1;
            // Incomplete first
            if (a.done !== b.done) return a.done ? 1 : -1;
            // Then by creation time
            return (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0);
          });

          setList(sorted);
          setLoading(false);
        },
        err => {
          console.log("Todo Snapshot Error:", err);
          setError(err.message);
          setLoading(false);
        }
      );

      return () => unsub();

    } catch(err){
      setError(String(err));
      setLoading(false);
    }
  }, [today]);

  // ─── ADD TASK ──────────────────────────────────
  const add = async () => {
    try {
      if (!text.trim()) return;

      await addDoc(collection(db, "todos"), {
        text: text.trim(),
        date: today,
        done: false,
        isLate: false,
        createdAt: serverTimestamp(),
        order: list.length
      });

      setText("");
      setError("");
    } catch(err){
      console.log("Add Todo Error:", err);
      setError("Failed to add task");
    }
  };

  // ─── TOGGLE DONE ───────────────────────────────
  const toggle = async (t) => {
    try {
      await updateDoc(doc(db, "todos", t.id), {
        done: !t.done,
        ...(t.isLate && { isLate: false }) // Remove late status when completed
      });
    } catch(err){
      setError("Failed to update task");
    }
  };

  // ─── DELETE ────────────────────────────────────
  const remove = async (id) => {
    try {
      await deleteDoc(doc(db, "todos", id));
    } catch(err){
      setError("Failed to delete task");
    }
  };

  // ─── DISMISS LATE TASKS ALERT ──────────────────
  const dismissLateTasks = () => {
    setShowLateTasks(false);
    // You could also mark them as seen in localStorage
    localStorage.setItem(`lateTasksDismissed_${today}`, 'true');
  };

  // Calculate completion stats
  const completedCount = list.filter(t => t.done).length;
  const lateCount = list.filter(t => t.isLate).length;
  const totalCount = list.length;
  const completionPercentage = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  // Check if we should show late tasks alert
  useEffect(() => {
    if (lateTasks.length > 0 && !localStorage.getItem(`lateTasksDismissed_${today}`)) {
      setShowLateTasks(true);
    }
  }, [lateTasks, today]);

  return (
    <div style={styles.container}>
      
      {/* Header */}
      <div style={styles.header}>
        <div style={styles.headerLeft}>
          <div style={styles.headerIcon}>📋</div>
          <div>
            <h3 style={styles.title}>Today's Tasks</h3>
            <p style={styles.date}>{formattedDate}</p>
          </div>
        </div>
        <div style={styles.statsBadge}>
          <span style={styles.statsText}>
            {completedCount}/{totalCount}
          </span>
          {lateCount > 0 && (
            <span style={styles.lateBadge}>{lateCount} late</span>
          )}
        </div>
      </div>

      {/* Late Tasks Alert */}
      {showLateTasks && lateTasks.length > 0 && (
        <div style={styles.lateAlert}>
          <div style={styles.lateAlertHeader}>
            <div style={styles.lateAlertIcon}>⚠️</div>
            <div style={styles.lateAlertContent}>
              <div style={styles.lateAlertTitle}>
                {lateTasks.length} unfinished task{lateTasks.length !== 1 ? 's' : ''} from yesterday
              </div>
              <div style={styles.lateAlertText}>
                These tasks have been carried over to today
              </div>
            </div>
          </div>
          <div style={styles.lateAlertActions}>
            <button 
              style={styles.lateAlertButton}
              onClick={() => rolloverLateTasks()}
            >
              ✓ Mark as Rolled Over
            </button>
            <button 
              style={styles.lateAlertDismiss}
              onClick={dismissLateTasks}
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* Progress Bar */}
      <div style={styles.progressContainer}>
        <div style={styles.progressBar}>
          <div 
            style={{
              ...styles.progressFill,
              width: `${completionPercentage}%`,
              backgroundColor: completionPercentage === 100 ? '#10b981' : '#3b82f6'
            }}
          />
          {lateCount > 0 && (
            <div 
              style={{
                ...styles.lateProgressFill,
                width: `${(lateCount / totalCount) * 100}%`,
                left: `${(completedCount / totalCount) * 100}%`
              }}
            />
          )}
        </div>
        <div style={styles.progressText}>
          {completionPercentage}% complete
          {lateCount > 0 && ` • ${lateCount} late`}
        </div>
      </div>

      {/* Add Task Input */}
      <div style={styles.inputContainer}>
        <div style={styles.inputWrapper}>
          <div style={styles.inputIcon}>+</div>
          <input
            style={styles.input}
            placeholder="What needs to be done today?"
            value={text}
            onChange={e => setText(e.target.value)}
            onKeyDown={e => e.key === "Enter" && add()}
          />
          {text.trim() && (
            <button 
              style={styles.addButton}
              onClick={add}
              title="Add task"
            >
              Add
            </button>
          )}
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div style={styles.errorMessage}>
          <span style={styles.errorIcon}>⚠️</span>
          {error}
        </div>
      )}

      {/* Tasks List */}
      <div style={styles.tasksContainer}>
        {loading ? (
          <div style={styles.loadingState}>
            <div style={styles.loadingSpinner}></div>
            <div style={styles.loadingText}>Loading tasks...</div>
          </div>
        ) : list.length === 0 ? (
          <div style={styles.emptyState}>
            <div style={styles.emptyIcon}>✨</div>
            <div style={styles.emptyText}>No tasks for today</div>
            <div style={styles.emptyHint}>Add a task to get started</div>
          </div>
        ) : (
          <div style={styles.tasksList}>
            {list.map((t, index) => (
              <div 
                key={t.id} 
                style={{
                  ...styles.taskItem,
                  backgroundColor: t.done ? '#f8fafc' : (t.isLate ? '#fef2f2' : 'white'),
                  borderLeftColor: t.isLate ? '#dc2626' : (t.done ? '#10b981' : '#3b82f6'),
                  borderLeftWidth: t.isLate ? '4px' : '4px',
                  opacity: t.done ? 0.8 : 1
                }}
              >
                <div 
                  style={styles.taskContent}
                  onClick={() => toggle(t)}
                >
                  <div style={styles.taskCheckbox}>
                    {t.done ? (
                      <div style={styles.checkboxChecked}>✓</div>
                    ) : (
                      <div style={styles.checkboxUnchecked}></div>
                    )}
                  </div>
                  <div style={styles.taskTextContainer}>
                    <div style={styles.taskHeader}>
                      {t.isLate && (
                        <span style={styles.lateTag}>LATE</span>
                      )}
                      <div 
                        style={{
                          ...styles.taskText,
                          textDecoration: t.done ? 'line-through' : 'none',
                          color: t.done ? '#64748b' : (t.isLate ? '#dc2626' : '#1e293b')
                        }}
                      >
                        {t.text}
                      </div>
                    </div>
                    <div style={styles.taskMeta}>
                      {t.isLate && t.originalDate && (
                        <span style={styles.originalDate}>
                          Originally from {new Date(t.originalDate).toLocaleDateString()}
                        </span>
                      )}
                      {t.createdAt?.seconds && (
                        <span style={styles.taskTime}>
                          {new Date(t.createdAt.seconds * 1000).toLocaleTimeString([], { 
                            hour: '2-digit', 
                            minute: '2-digit' 
                          })}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <button 
                  style={{
                    ...styles.deleteButton,
                    color: t.isLate ? '#dc2626' : '#94a3b8'
                  }}
                  onClick={() => remove(t.id)}
                  title="Delete task"
                >
                  <svg 
                    width="14" 
                    height="14" 
                    viewBox="0 0 24 24" 
                    fill="none" 
                    stroke="currentColor" 
                    strokeWidth="2"
                  >
                    <path d="M18 6L6 18M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Quick Stats */}
      {list.length > 0 && (
        <div style={styles.footer}>
          <div style={styles.stats}>
            <div style={styles.statItem}>
              <span style={styles.statNumber}>{totalCount}</span>
              <span style={styles.statLabel}>Total</span>
            </div>
            <div style={styles.statDivider} />
            <div style={styles.statItem}>
              <span style={styles.statNumber}>{completedCount}</span>
              <span style={styles.statLabel}>Done</span>
            </div>
            <div style={styles.statDivider} />
            <div style={styles.statItem}>
              <span style={{
                ...styles.statNumber,
                color: lateCount > 0 ? '#dc2626' : '#1e293b'
              }}>
                {lateCount}
              </span>
              <span style={styles.statLabel}>Late</span>
            </div>
            <div style={styles.statDivider} />
            <div style={styles.statItem}>
              <span style={styles.statNumber}>{totalCount - completedCount - lateCount}</span>
              <span style={styles.statLabel}>Pending</span>
            </div>
          </div>
        </div>
      )}

      {/* Manual Rollover Button (for testing/edge cases) */}
      {!loading && (
        <div style={styles.rolloverSection}>
          <button 
            style={styles.rolloverButton}
            onClick={async () => {
              // Find and rollover any late tasks
              const yesterday = new Date();
              yesterday.setDate(yesterday.getDate() - 1);
              const yesterdayStr = yesterday.toISOString().slice(0,10);
              
              try {
                const q = query(
                  collection(db, "todos"),
                  where("date", "==", yesterdayStr),
                  where("done", "==", false)
                );
                
                const snapshot = await getDocs(q);
                const tasks = snapshot.docs.map(doc => ({
                  id: doc.id,
                  ...doc.data()
                }));
                
                if (tasks.length > 0) {
                  await rolloverLateTasks(tasks);
                } else {
                  setError("No unfinished tasks from yesterday");
                  setTimeout(() => setError(""), 3000);
                }
              } catch (err) {
                setError("Failed to check for late tasks");
              }
            }}
          >
            🔄 Check for Late Tasks
          </button>
        </div>
      )}
    </div>
  );
}

// ─── MODERN STYLES WITH LATE TASK FEATURES ───────
const styles = {
  container: {
    backgroundColor: 'white',
    borderRadius: '12px',
    padding: '20px',
    border: '1px solid #e2e8f0',
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.04)',
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
    width: '100%',
    boxSizing: 'border-box',
  },

  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },

  headerLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },

  headerIcon: {
    fontSize: '24px',
    backgroundColor: '#f0f9ff',
    width: '40px',
    height: '40px',
    borderRadius: '10px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#3b82f6',
  },

  title: {
    fontSize: '16px',
    fontWeight: '700',
    color: '#1e293b',
    margin: '0 0 2px 0',
  },

  date: {
    fontSize: '12px',
    color: '#64748b',
    fontWeight: '400',
    margin: 0,
  },

  statsBadge: {
    backgroundColor: '#f1f5f9',
    padding: '6px 12px',
    borderRadius: '20px',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },

  statsText: {
    fontSize: '12px',
    fontWeight: '600',
    color: '#475569',
  },

  lateBadge: {
    fontSize: '10px',
    fontWeight: '600',
    color: '#dc2626',
    backgroundColor: '#fee2e2',
    padding: '2px 6px',
    borderRadius: '10px',
  },

  lateAlert: {
    backgroundColor: '#fffbeb',
    border: '1px solid #fde68a',
    borderRadius: '10px',
    padding: '12px',
    animation: 'slideDown 0.3s ease',
  },

  lateAlertHeader: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '10px',
    marginBottom: '10px',
  },

  lateAlertIcon: {
    fontSize: '18px',
    flexShrink: 0,
  },

  lateAlertContent: {
    flex: 1,
  },

  lateAlertTitle: {
    fontSize: '13px',
    fontWeight: '600',
    color: '#92400e',
    marginBottom: '2px',
  },

  lateAlertText: {
    fontSize: '12px',
    color: '#92400e',
    opacity: 0.8,
  },

  lateAlertActions: {
    display: 'flex',
    gap: '8px',
  },

  lateAlertButton: {
    flex: 1,
    backgroundColor: '#f59e0b',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    padding: '6px 12px',
    fontSize: '12px',
    fontWeight: '500',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
  },

  lateAlertDismiss: {
    backgroundColor: 'transparent',
    color: '#92400e',
    border: '1px solid #fde68a',
    borderRadius: '6px',
    padding: '6px 12px',
    fontSize: '12px',
    fontWeight: '500',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
  },

  progressContainer: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
    position: 'relative',
  },

  progressBar: {
    width: '100%',
    height: '6px',
    backgroundColor: '#f1f5f9',
    borderRadius: '3px',
    overflow: 'hidden',
    position: 'relative',
  },

  progressFill: {
    height: '100%',
    borderRadius: '3px',
    transition: 'width 0.3s ease',
    position: 'absolute',
    left: 0,
    top: 0,
    zIndex: 1,
  },

  lateProgressFill: {
    height: '100%',
    borderRadius: '3px',
    backgroundColor: '#dc2626',
    position: 'absolute',
    top: 0,
    zIndex: 2,
    transition: 'all 0.3s ease',
  },

  progressText: {
    fontSize: '11px',
    color: '#64748b',
    fontWeight: '500',
    display: 'flex',
    justifyContent: 'space-between',
  },

  inputContainer: {
    width: '100%',
  },

  inputWrapper: {
    display: 'flex',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderRadius: '10px',
    padding: '8px 12px',
    border: '1px solid #e2e8f0',
    transition: 'all 0.2s ease',
  },

  inputIcon: {
    color: '#94a3b8',
    fontSize: '18px',
    marginRight: '10px',
    fontWeight: '300',
  },

  input: {
    flex: 1,
    border: 'none',
    outline: 'none',
    backgroundColor: 'transparent',
    fontSize: '14px',
    color: '#1e293b',
    fontFamily: 'inherit',
  },

  addButton: {
    background: '#3b82f6',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    padding: '6px 12px',
    fontSize: '12px',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    marginLeft: '8px',
    flexShrink: 0,
  },

  errorMessage: {
    backgroundColor: '#fef2f2',
    color: '#dc2626',
    padding: '8px 12px',
    borderRadius: '8px',
    fontSize: '12px',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    border: '1px solid #fecaca',
  },

  errorIcon: {
    fontSize: '14px',
  },

  tasksContainer: {
    width: '100%',
  },

  loadingState: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '20px',
    gap: '12px',
  },

  loadingSpinner: {
    width: '24px',
    height: '24px',
    border: '2px solid #e2e8f0',
    borderTopColor: '#3b82f6',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite',
  },

  loadingText: {
    fontSize: '12px',
    color: '#64748b',
  },

  emptyState: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '20px',
    gap: '8px',
    textAlign: 'center',
  },

  emptyIcon: {
    fontSize: '32px',
    opacity: 0.5,
    marginBottom: '4px',
  },

  emptyText: {
    fontSize: '13px',
    fontWeight: '600',
    color: '#475569',
  },

  emptyHint: {
    fontSize: '11px',
    color: '#94a3b8',
  },

  tasksList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    maxHeight: '300px',
    overflowY: 'auto',
    paddingRight: '4px',
  },

  taskItem: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '12px',
    borderRadius: '10px',
    border: '1px solid #e2e8f0',
    borderLeftWidth: '4px',
    transition: 'all 0.2s ease',
    cursor: 'pointer',
    '&:hover': {
      borderColor: '#cbd5e1',
      transform: 'translateY(-1px)',
    },
  },

  taskContent: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    flex: 1,
  },

  taskCheckbox: {
    flexShrink: 0,
  },

  checkboxUnchecked: {
    width: '18px',
    height: '18px',
    borderRadius: '4px',
    border: '2px solid #cbd5e1',
    backgroundColor: 'white',
    transition: 'all 0.2s ease',
  },

  checkboxChecked: {
    width: '18px',
    height: '18px',
    borderRadius: '4px',
    backgroundColor: '#10b981',
    color: 'white',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '12px',
    fontWeight: 'bold',
  },

  taskTextContainer: {
    flex: 1,
    minWidth: 0,
  },

  taskHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    marginBottom: '2px',
  },

  lateTag: {
    fontSize: '9px',
    fontWeight: '700',
    color: '#dc2626',
    backgroundColor: '#fee2e2',
    padding: '1px 4px',
    borderRadius: '3px',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    flexShrink: 0,
  },

  taskText: {
    fontSize: '14px',
    fontWeight: '500',
    lineHeight: 1.4,
    wordBreak: 'break-word',
    flex: 1,
  },

  taskMeta: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontSize: '11px',
    color: '#94a3b8',
  },

  originalDate: {
    fontSize: '10px',
    color: '#f59e0b',
    fontStyle: 'italic',
  },

  taskTime: {
    fontSize: '11px',
  },

  deleteButton: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    padding: '4px',
    borderRadius: '4px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'all 0.2s ease',
    flexShrink: 0,
    '&:hover': {
      backgroundColor: '#fee2e2',
    },
  },

  footer: {
    paddingTop: '12px',
    borderTop: '1px solid #f1f5f9',
  },

  stats: {
    display: 'flex',
    justifyContent: 'space-around',
    alignItems: 'center',
  },

  statItem: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '2px',
    flex: 1,
  },

  statNumber: {
    fontSize: '16px',
    fontWeight: '700',
    transition: 'color 0.3s ease',
  },

  statLabel: {
    fontSize: '11px',
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  },

  statDivider: {
    width: '1px',
    height: '20px',
    backgroundColor: '#e2e8f0',
  },

  rolloverSection: {
    paddingTop: '12px',
    borderTop: '1px solid #f1f5f9',
    textAlign: 'center',
  },

  rolloverButton: {
    backgroundColor: '#f8fafc',
    color: '#64748b',
    border: '1px solid #e2e8f0',
    borderRadius: '8px',
    padding: '6px 12px',
    fontSize: '11px',
    fontWeight: '500',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '4px',
    '&:hover': {
      backgroundColor: '#f1f5f9',
      borderColor: '#cbd5e1',
    },
  },
};

// Add CSS animations
if (typeof document !== 'undefined') {
  const styleSheet = document.createElement('style');
  styleSheet.textContent = `
    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }
    
    @keyframes slideDown {
      from {
        opacity: 0;
        transform: translateY(-10px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }
    
    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.7; }
    }
  `;
  document.head.appendChild(styleSheet);
}