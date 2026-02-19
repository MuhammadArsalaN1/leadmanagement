// ─────────────────────────────────────────────────────────────
//  MODERN SALES DASHBOARD - OPTIMIZED & SPACE-EFFICIENT
//  Fixed all space issues and improved responsive design
// ─────────────────────────────────────────────────────────────

import { useState, useEffect } from "react";
import { db } from "../firebase/firebase";
import {
  collection,
  onSnapshot,
  doc,
  updateDoc,
  arrayUnion,
  serverTimestamp,
  deleteDoc
} from "firebase/firestore";

import AddLead from "../components/AddLead";
import LeadTable from "../components/LeadTable";
import EditLead from "../components/EditLead";
import TodoBoard from "../components/TodoBoard";
import { rolloverTodos } from "../utils/todoRollover";

// ─── STATUS BADGE COMPONENT ──────────────────────────────────
const StatusBadge = ({ status }) => {
  const statusConfig = {
    "Still in Talk": { color: "#b45309", bg: "#fef3c7", icon: "💬" },
    "Pending": { color: "#1d4ed8", bg: "#dbeafe", icon: "⏱" },
    "Order Placed": { color: "#6d28d9", bg: "#ede9fe", icon: "✅" },
    "Order Delivered": { color: "#047857", bg: "#d1fae5", icon: "✨" },
    "Cancelled": { color: "#475569", bg: "#f1f5f9", icon: "✕" }
  };

  const config = statusConfig[status] || { color: "#334155", bg: "#f8fafc", icon: "📝" };

  return (
    <div style={{
      backgroundColor: config.bg,
      color: config.color,
      padding: '4px 12px',
      borderRadius: '16px',
      fontSize: '12px',
      fontWeight: '700',
      display: 'inline-flex',
      alignItems: 'center',
      gap: '6px',
      border: `1px solid ${config.color}30`,
      lineHeight: '1.2',
      minHeight: '28px'
    }}>
      <span style={{ fontSize: '11px' }}>{config.icon}</span>
      {status}
    </div>
  );
};

// ─── SMART ENGINE ──────────────────────────────────────────
const getLeadHealth = (lead) => {
  if (lead.status === "Order Delivered" || lead.status === "Cancelled")
    return { color: "#1d4ed8", text: "Completed", icon: "✓" };

  if (!lead.followUpAt)
    return { color: "#64748b", text: "No Followup", icon: "—" };

  const diff = (new Date(lead.followUpAt) - new Date()) / (1000 * 60 * 60 * 24);

  if (diff < 0)
    return { color: "#b91c1c", text: "Overdue", icon: "⚠" };

  if (diff <= 2)
    return { color: "#c2410c", text: "Soon", icon: "⏰" };

  return { color: "#15803d", text: "Healthy", icon: "✓" };
};

const getScore = (l) => {
  let s = 0;
  s += (l.comments?.length || 0) * 3;
  if (l.status === "Order Placed") s += 15;
  if (l.status === "Still in Talk") s += 8;
  if (l.followUpAt) s += 5;
  if (getLeadHealth(l).text === "Overdue") s -= 5;
  if (l.status === "Cancelled") s -= 10;
  return Math.max(0, s);
};

const getSuggestion = (l) => {
  if (l.status === "Cancelled") return "This lead is cancelled";
  if (getLeadHealth(l).text === "Overdue") return "Call immediately";
  if (l.status === "Pending") return "Send price + catalog";
  if (l.status === "Still in Talk") return "Share portfolio + testimonial";
  if (!l.followUpAt) return "Schedule followup";
  return "Nurture with value message";
};

// ─── MAIN DASHBOARD ────────────────────────────────────────
export default function Dashboard() {
  const [showAdd, setShowAdd] = useState(false);
  const [editLead, setEditLead] = useState(null);
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState("table");

  useEffect(() => {
    rolloverTodos();
  }, []);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, "leads"), snap => {
      const data = snap.docs.map(d => ({
        id: d.id,
        ...d.data()
      }));
      setLeads(data);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  // Zoom detection effect
  useEffect(() => {
    const handleZoom = () => {
      const zoomLevel = window.devicePixelRatio;
      if (zoomLevel > 1.5) {
        document.documentElement.style.fontSize = `${16 / zoomLevel}px`;
      } else {
        document.documentElement.style.fontSize = '16px';
      }
    };

    window.addEventListener('resize', handleZoom);
    handleZoom();
    
    return () => window.removeEventListener('resize', handleZoom);
  }, []);

  const addActivity = (type, text) => ({
    type,
    text,
    date: new Date().toLocaleString()
  });

  const updateStatus = async (id, status) => {
    await updateDoc(doc(db, "leads", id), {
      status,
      updatedAt: serverTimestamp(),
      activity: arrayUnion(addActivity("status", `Status → ${status}`))
    });
  };

  const updateComment = async (id, text) => {
    if (!text) return;
    await updateDoc(doc(db, "leads", id), {
      comments: arrayUnion({
        text,
        date: new Date().toLocaleString()
      }),
      activity: arrayUnion(addActivity("comment", text)),
      updatedAt: serverTimestamp()
    });
  };

  const updateFollow = async (id, followUpAt) => {
    await updateDoc(doc(db, "leads", id), {
      followUpAt,
      notified: false,
      activity: arrayUnion(addActivity("followup", `Followup → ${followUpAt}`)),
      updatedAt: serverTimestamp()
    });
  };

  const deleteLead = async (id) => {
    if (!window.confirm("Delete this lead?")) return;
    await deleteDoc(doc(db, "leads", id));
  };

  const activeStatuses = ["Still in Talk", "Pending", "Order Placed"];
  
  // Get today's follow-ups
  const todaysFollowups = leads
    .filter(l => {
      if (!l.followUpAt || l.status === "Cancelled") return false;
      const followDate = new Date(l.followUpAt);
      const today = new Date();
      return followDate.toDateString() === today.toDateString();
    })
    .sort((a, b) => new Date(a.followUpAt) - new Date(b.followUpAt))
    .slice(0, 5);

  // Get overdue followups
  const overdueFollowups = leads
    .filter(l => {
      if (!l.followUpAt || l.status === "Cancelled") return false;
      const followDate = new Date(l.followUpAt);
      const today = new Date();
      return followDate < today && followDate.toDateString() !== today.toDateString();
    })
    .sort((a, b) => new Date(a.followUpAt) - new Date(b.followUpAt))
    .slice(0, 5);

  // Get urgent leads
  const urgentLeads = leads
    .filter(l => getLeadHealth(l).text === "Overdue" && l.status !== "Cancelled")
    .sort((a, b) => new Date(a.followUpAt) - new Date(b.followUpAt));

  const openWhatsApp = phone => {
    window.open(`https://wa.me/${phone}`);
  };

  const getDaysOverdue = (followUpDate) => {
    const followDate = new Date(followUpDate);
    const today = new Date();
    const diffTime = today - followDate;
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  // Metrics
  const metrics = {
    total: leads.length,
    active: leads.filter(l => activeStatuses.includes(l.status)).length,
    urgent: urgentLeads.length,
    converted: leads.filter(l => l.status === "Order Placed" || l.status === "Order Delivered").length,
  };

  return (
    <div style={styles.page}>
      {/* MODERN HEADER */}
      <div style={styles.header}>
        <div style={styles.headerContent}>
          <div style={styles.headerLeft}>
            <div style={styles.brand}>
              <div style={styles.brandIcon}>📊</div>
              <div>
                <h1 style={styles.title}>Sales Dashboard</h1>
                <div style={styles.subtitle}>Track conversations → followups → orders</div>
              </div>
            </div>
          </div>
          
          <div style={styles.metricsContainer}>
            <div style={styles.metricCard}>
              <div style={styles.metricValue}>{metrics.total}</div>
              <div style={styles.metricLabel}>Total Leads</div>
            </div>
            <div style={styles.metricCard}>
              <div style={{...styles.metricValue, color: '#1d4ed8'}}>{metrics.active}</div>
              <div style={styles.metricLabel}>Active</div>
            </div>
            <div style={styles.metricCard}>
              <div style={{...styles.metricValue, color: '#b91c1c'}}>{metrics.urgent}</div>
              <div style={styles.metricLabel}>Urgent</div>
            </div>
          </div>
          
          <div style={styles.headerActions}>
            <button style={styles.primaryButton} onClick={() => setShowAdd(true)}>
              <span style={styles.buttonIcon}>+</span>
              Add Lead
            </button>
          </div>
        </div>
      </div>

      {/* URGENT ALERT */}
      {urgentLeads.length > 0 && (
        <div style={styles.alert}>
          <div style={styles.alertContent}>
            <span style={styles.alertIcon}>⚠️</span>
            <span style={styles.alertText}>
              <strong>Attention needed!</strong> You have {urgentLeads.length} overdue followup{urgentLeads.length !== 1 ? 's' : ''}
            </span>
            <div style={styles.alertActions}>
              {urgentLeads.slice(0, 3).map((l, index) => (
                <span key={l.id} style={styles.alertLead}>
                  {l.fullName} ({getDaysOverdue(l.followUpAt)} day{getDaysOverdue(l.followUpAt) !== 1 ? 's' : ''} ago)
                  {index < Math.min(urgentLeads.length, 3) - 1 ? ', ' : ''}
                </span>
              ))}
              {urgentLeads.length > 3 && (
                <span style={styles.alertMore}>
                  and {urgentLeads.length - 3} more
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MAIN CONTENT */}
      <div style={styles.mainLayout}>
        
        {/* SIDEBAR */}
        <aside style={styles.sidebar}>
          <TodoBoard />
          
          {/* TODAY'S FOLLOWUPS */}
          <div style={styles.sidebarCard}>
            <div style={styles.cardHeader}>
              <h3 style={styles.cardTitle}>Today's Followups</h3>
              <div style={{
                ...styles.cardBadge,
                backgroundColor: todaysFollowups.length > 0 ? '#dbeafe' : '#f1f5f9',
                color: todaysFollowups.length > 0 ? '#1d4ed8' : '#475569'
              }}>{todaysFollowups.length}</div>
            </div>
            
            <div style={styles.scheduleList}>
              {todaysFollowups.map((l, index) => (
                <div key={l.id} style={styles.scheduleItem}>
                  <div style={styles.scheduleTime}>
                    {new Date(l.followUpAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                  <div style={styles.scheduleContent}>
                    <div style={styles.scheduleName}>{l.fullName}</div>
                    <div style={styles.scheduleMeta}>
                      <span style={styles.schedulePhone}>{l.cell}</span>
                      <span style={styles.scheduleStatus}> • {l.status}</span>
                    </div>
                  </div>
                  <button 
                    style={styles.scheduleAction}
                    onClick={() => openWhatsApp(l.cell)}
                    title="Message on WhatsApp"
                  >
                    💬
                  </button>
                </div>
              ))}
              
              {todaysFollowups.length === 0 && (
                <div style={styles.emptySchedule}>
                  <div style={styles.emptyIcon}>📅</div>
                  <div style={styles.emptyText}>No followups today</div>
                </div>
              )}
            </div>
          </div>

          {/* OVERDUE FOLLOWUPS */}
          {overdueFollowups.length > 0 && (
            <div style={{
              ...styles.sidebarCard,
              borderColor: '#fecaca',
              backgroundColor: '#fef2f2'
            }}>
              <div style={styles.cardHeader}>
                <h3 style={{...styles.cardTitle, color: '#b91c1c'}}>
                  <span style={{marginRight: '6px'}}>⚠️</span>
                  Overdue
                </h3>
                <div style={{
                  ...styles.cardBadge,
                  backgroundColor: '#fee2e2',
                  color: '#b91c1c'
                }}>{overdueFollowups.length}</div>
              </div>
              
              <div style={styles.scheduleList}>
                {overdueFollowups.map((l, index) => {
                  const daysOverdue = getDaysOverdue(l.followUpAt);
                  
                  return (
                    <div key={l.id} style={{
                      ...styles.scheduleItem,
                      borderColor: '#fecaca',
                      backgroundColor: '#fee2e2'
                    }}>
                      <div style={{
                        ...styles.scheduleTime,
                        backgroundColor: '#fca5a5',
                        color: '#7f1d1d',
                        fontSize: '12px'
                      }}>
                        {daysOverdue}d ago
                      </div>
                      <div style={styles.scheduleContent}>
                        <div style={{
                          ...styles.scheduleName,
                          color: '#b91c1c'
                        }}>{l.fullName}</div>
                        <div style={styles.scheduleMeta}>
                          <span style={{
                            ...styles.schedulePhone,
                            color: '#991b1b'
                          }}>{l.cell}</span>
                          <span style={{
                            ...styles.scheduleStatus,
                            color: '#991b1b'
                          }}> • {l.status}</span>
                        </div>
                      </div>
                      <button 
                        style={{
                          ...styles.scheduleAction,
                          backgroundColor: '#fca5a5',
                          color: '#7f1d1d',
                          borderColor: '#fca5a5'
                        }}
                        onClick={() => openWhatsApp(l.cell)}
                        title="Message on WhatsApp"
                      >
                        💬
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* QUICK ACTIONS */}
          <div style={styles.sidebarCard}>
            <div style={styles.cardHeader}>
              <h3 style={styles.cardTitle}>Quick Actions</h3>
            </div>
            <div style={styles.quickActions}>
              <button style={styles.quickButton} onClick={() => setShowAdd(true)}>
                <span style={styles.quickIcon}>➕</span>
                Add Lead
              </button>
              <button style={styles.quickButton} onClick={() => setView(view === "table" ? "pipeline" : "table")}>
                <span style={styles.quickIcon}>🔄</span>
                Switch View
              </button>
            </div>
          </div>
        </aside>

        {/* MAIN CONTENT AREA */}
        <main style={styles.contentArea}>
          
          {/* VIEW CONTROLS */}
          <div style={styles.viewControls}>
            <div style={styles.viewTabs}>
              <button
                style={{
                  ...styles.viewTab,
                  ...(view === "table" ? styles.viewTabActive : {})
                }}
                onClick={() => setView("table")}
              >
                <span style={styles.viewTabIcon}>📋</span>
                Table View
              </button>
              <button
                style={{
                  ...styles.viewTab,
                  ...(view === "pipeline" ? styles.viewTabActive : {})
                }}
                onClick={() => setView("pipeline")}
              >
                <span style={styles.viewTabIcon}>🧬</span>
                Pipeline View
              </button>
            </div>
            
            <div style={styles.resultsInfo}>
              <span style={styles.resultsCount}>{leads.length} total leads</span>
              <span style={styles.resultsFilter}>
                • {leads.filter(l => activeStatuses.includes(l.status)).length} active
              </span>
              {urgentLeads.length > 0 && (
                <span style={{
                  ...styles.resultsFilter,
                  color: '#b91c1c',
                  fontWeight: '700',
                  marginLeft: '6px'
                }}>
                  • {urgentLeads.length} urgent
                </span>
              )}
            </div>
          </div>

          {/* CONTENT PANEL */}
          <div style={styles.contentPanel}>
            {loading ? (
              <div style={styles.loadingState}>
                <div style={styles.loadingSpinner}></div>
                <div style={styles.loadingText}>Loading leads...</div>
              </div>
            ) : leads.length === 0 ? (
              <EmptyState onAdd={() => setShowAdd(true)} />
            ) : view === "table" ? (
              <LeadTable
                leads={leads}
                onStatusChange={updateStatus}
                onCommentChange={updateComment}
                onFollowChange={updateFollow}
                onDelete={deleteLead}
                onEdit={setEditLead}
                getScore={getScore}
                getSuggestion={getSuggestion}
                getHealth={getLeadHealth}
                openWhatsApp={openWhatsApp}
              />
            ) : (
              <PipelineView
                leads={leads.filter(l => l.status !== "Cancelled")}
                getScore={getScore}
                getSuggestion={getSuggestion}
                getHealth={getLeadHealth}
                openWhatsApp={openWhatsApp}
                onStatusChange={updateStatus}
                onEdit={setEditLead}
              />
            )}
          </div>
        </main>
      </div>

      {/* MODALS */}
      {showAdd && (
        <Modal title="Add New Lead" onClose={() => setShowAdd(false)}>
          <AddLead onDone={() => setShowAdd(false)} />
        </Modal>
      )}

      {editLead && (
        <Modal title="Lead Details" onClose={() => setEditLead(null)}>
          <div style={styles.modalContent}>
            <EditLead
              lead={editLead}
              onDone={() => setEditLead(null)}
            />
            <Activity lead={editLead} />
          </div>
        </Modal>
      )}
    </div>
  );
}

// ─── PIPELINE VIEW ──────────────────────────────────────────
function PipelineView({ leads, getScore, getSuggestion, getHealth, openWhatsApp, onStatusChange, onEdit }) {
  const stages = {
    "Still in Talk": leads.filter(l => l.status === "Still in Talk"),
    "Pending": leads.filter(l => l.status === "Pending"),
    "Order Placed": leads.filter(l => l.status === "Order Placed"),
    "Order Delivered": leads.filter(l => l.status === "Order Delivered")
  };

  const stageColors = {
    "Still in Talk": { color: "#b45309", bg: "#fef3c7" },
    "Pending": { color: "#1d4ed8", bg: "#dbeafe" },
    "Order Placed": { color: "#6d28d9", bg: "#ede9fe" },
    "Order Delivered": { color: "#047857", bg: "#d1fae5" }
  };

  return (
    <div style={styles.pipelineContainer}>
      <div style={styles.pipelineHeader}>
        <div style={styles.pipelineTitle}>Sales Pipeline</div>
        <div style={styles.pipelineSubtitle}>Visualize your leads across different stages</div>
      </div>
      
      <div style={styles.pipelineGrid}>
        {Object.entries(stages).map(([stageName, stageLeads]) => {
          const stageColor = stageColors[stageName];
          
          return (
            <div key={stageName} style={styles.pipelineColumn}>
              <div style={styles.columnHeader}>
                <div style={styles.columnTitle}>
                  <div style={{
                    ...styles.columnIcon,
                    backgroundColor: stageColor.bg,
                    color: stageColor.color
                  }}>
                    {stageName === "Still in Talk" ? "💬" :
                     stageName === "Pending" ? "⏳" : 
                     stageName === "Order Placed" ? "💰" : "✅"}
                  </div>
                  <div>
                    <div style={styles.columnName}>{stageName}</div>
                    <div style={styles.columnCount}>{stageLeads.length} leads</div>
                  </div>
                </div>
              </div>
              
              <div style={styles.columnLeads}>
                {stageLeads.map((lead, index) => {
                  const health = getHealth(lead);
                  const daysUntilFollow = lead.followUpAt 
                    ? Math.ceil((new Date(lead.followUpAt) - new Date()) / (1000 * 60 * 60 * 24))
                    : null;
                  
                  return (
                    <div key={lead.id} style={styles.leadCard}>
                      <div style={styles.leadHeader}>
                        <div style={styles.leadInfo}>
                          <div style={styles.leadNameRow}>
                            <div style={styles.leadInitial}>
                              {lead.fullName?.charAt(0) || "?"}
                            </div>
                            <div>
                              <div style={styles.leadName}>{lead.fullName}</div>
                              <div style={styles.leadPhone}>{lead.cell}</div>
                            </div>
                          </div>
                          <div style={styles.leadScore}>⭐ {getScore(lead)}</div>
                        </div>
                      </div>
                      
                      {lead.followUpAt && (
                        <div style={styles.followupInfo}>
                          <span style={styles.followupDate}>
                            {new Date(lead.followUpAt).toLocaleDateString()}
                          </span>
                          {daysUntilFollow !== null && (
                            <span style={{
                              ...styles.followupBadge,
                              backgroundColor: daysUntilFollow < 0 ? '#fee2e2' : 
                                            daysUntilFollow <= 2 ? '#fef3c7' : '#d1fae5',
                              color: daysUntilFollow < 0 ? '#b91c1c' : 
                                     daysUntilFollow <= 2 ? '#92400e' : '#065f46'
                            }}>
                              {daysUntilFollow < 0 ? 'Late' : 
                               daysUntilFollow === 0 ? 'Today' :
                               daysUntilFollow === 1 ? '1d' : `${daysUntilFollow}d`}
                            </span>
                          )}
                        </div>
                      )}
                      
                      <div style={styles.leadFooter}>
                        <div style={styles.leadHealth}>
                          <div style={{
                            ...styles.healthIndicator,
                            backgroundColor: health.color
                          }} title={health.text} />
                          <div style={styles.suggestionText}>
                            {getSuggestion(lead)}
                          </div>
                        </div>
                        <div style={styles.leadActions}>
                          <button 
                            style={styles.actionButton}
                            onClick={() => openWhatsApp(lead.cell)}
                            title="WhatsApp"
                          >
                            💬
                          </button>
                          <button 
                            style={styles.actionButton}
                            onClick={() => onEdit(lead)}
                            title="Edit"
                          >
                            ✏️
                          </button>
                        </div>
                      </div>
                      
                      <select
                        style={styles.statusSelect}
                        value={lead.status}
                        onChange={(e) => onStatusChange(lead.id, e.target.value)}
                      >
                        <option value="Pending">⏳ Pending</option>
                        <option value="Still in Talk">💬 Still in Talk</option>
                        <option value="Order Placed">💰 Order Placed</option>
                        <option value="Order Delivered">✅ Order Delivered</option>
                        <option value="Cancelled">❌ Cancelled</option>
                      </select>
                    </div>
                  );
                })}
                
                {stageLeads.length === 0 && (
                  <div style={styles.emptyColumn}>
                    <div style={styles.emptyColumnIcon}>📭</div>
                    <div style={styles.emptyColumnText}>No leads in this stage</div>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── EMPTY STATE ────────────────────────────────────────────
function EmptyState({ onAdd }) {
  return (
    <div style={styles.emptyState}>
      <div style={styles.emptyIcon}>📊</div>
      <h3 style={styles.emptyTitle}>No Leads Found</h3>
      <p style={styles.emptyDescription}>
        Start building your sales pipeline by adding your first conversation.
      </p>
      <button 
        style={styles.emptyButton}
        onClick={onAdd}
      >
        <span style={styles.buttonIcon}>+</span>
        Add Your First Lead
      </button>
    </div>
  );
}

// ─── ACTIVITY COMPONENT ─────────────────────────────────────
function Activity({ lead }) {
  return (
    <div style={styles.activityContainer}>
      <h4 style={styles.activityTitle}>Activity Timeline</h4>
      <div style={styles.activityTimeline}>
        {(lead.activity || [])
          .slice()
          .reverse()
          .map((a, i) => (
            <div key={i} style={styles.activityItem}>
              <div style={styles.activityDot} />
              <div style={styles.activityContent}>
                <div style={styles.activityMessage}>{a.text}</div>
                <div style={styles.activityTimestamp}>{a.date}</div>
              </div>
            </div>
          ))}
      </div>
    </div>
  );
}

// ─── MODAL ──────────────────────────────────────────────────
function Modal({ title, children, onClose }) {
  return (
    <div style={styles.modalOverlay}>
      <div style={styles.modal}>
        <div style={styles.modalHeader}>
          <h3 style={styles.modalTitle}>{title}</h3>
          <button 
            style={styles.modalClose}
            onClick={onClose}
            aria-label="Close modal"
          >
            ✕
          </button>
        </div>
        <div style={styles.modalBody}>
          {children}
        </div>
      </div>
    </div>
  );
}

// ─── OPTIMIZED STYLES WITH SPACE FIXES ──────────────────────
const styles = {
  page: {
    padding: '0',
    background: '#f8fafc',
    minHeight: '100vh',
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    color: '#0f172a',
    lineHeight: 1.5,
    fontSize: '14px',
    overflowX: 'hidden',
    width: '100%',
    maxWidth: '100vw',
  },

  header: {
    backgroundColor: 'white',
    padding: '16px 20px',
    borderBottom: '1px solid #e2e8f0',
    boxShadow: '0 2px 4px rgba(0, 0, 0, 0.06)',
    position: 'relative',
    zIndex: 10,
    width: '100%',
  },

  headerContent: {
    maxWidth: '1400px',
    margin: '0 auto',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '16px',
    flexWrap: 'wrap',
    width: '100%',
  },

  headerLeft: {
    flex: '1 1 200px',
    minWidth: '200px',
  },

  brand: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    flexWrap: 'wrap',
  },

  brandIcon: {
    fontSize: '20px',
    color: '#1d4ed8',
    background: '#dbeafe',
    width: '44px',
    height: '44px',
    borderRadius: '12px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: 'bold',
    flexShrink: 0,
  },

  title: {
    fontSize: '20px',
    fontWeight: '700',
    color: '#0f172a',
    margin: '0 0 4px 0',
    letterSpacing: '-0.3px',
    lineHeight: '1.2',
  },

  subtitle: {
    fontSize: '13px',
    color: '#475569',
    fontWeight: '500',
    lineHeight: '1.3',
  },

  metricsContainer: {
    display: 'flex',
    gap: '12px',
    flex: '1 1 auto',
    justifyContent: 'center',
    flexWrap: 'wrap',
    minWidth: '0',
  },

  metricCard: {
    background: 'white',
    padding: '12px 16px',
    borderRadius: '12px',
    border: '1px solid #e2e8f0',
    textAlign: 'center',
    flex: '1 1 100px',
    minWidth: '100px',
    maxWidth: '140px',
    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.08)',
    position: 'relative',
  },

  metricValue: {
    fontSize: '20px',
    fontWeight: '700',
    color: '#0f172a',
    lineHeight: 1.2,
    marginBottom: '4px',
  },

  metricLabel: {
    fontSize: '12px',
    color: '#475569',
    fontWeight: '600',
    letterSpacing: '0.3px',
  },

  headerActions: {
    flex: '1 1 140px',
    display: 'flex',
    justifyContent: 'flex-end',
    minWidth: '140px',
  },

  primaryButton: {
    background: '#1d4ed8',
    color: 'white',
    border: 'none',
    borderRadius: '10px',
    padding: '10px 16px',
    fontWeight: '600',
    fontSize: '14px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    transition: 'all 0.2s ease',
    boxShadow: '0 2px 6px rgba(29, 78, 216, 0.25)',
    letterSpacing: '0.3px',
    whiteSpace: 'nowrap',
    width: '100%',
    justifyContent: 'center',
  },

  buttonIcon: {
    fontSize: '16px',
    fontWeight: 'bold',
  },

  alert: {
    backgroundColor: '#fee2e2',
    color: '#7f1d1d',
    padding: '12px 20px',
    borderBottom: '1px solid #fecaca',
    position: 'relative',
    zIndex: 9,
    width: '100%',
  },

  alertContent: {
    maxWidth: '1400px',
    margin: '0 auto',
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    flexWrap: 'wrap',
    width: '100%',
  },

  alertIcon: {
    fontSize: '18px',
    flexShrink: 0,
    color: '#b91c1c',
  },

  alertText: {
    fontSize: '14px',
    fontWeight: '600',
    lineHeight: '1.3',
    flex: 1,
    minWidth: '180px',
  },

  alertActions: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '6px',
    fontSize: '13px',
    width: '100%',
    marginTop: '6px',
  },

  alertLead: {
    backgroundColor: '#fecaca',
    padding: '3px 6px',
    borderRadius: '4px',
    fontWeight: '600',
  },

  alertMore: {
    color: '#991b1b',
    fontStyle: 'italic',
  },

  mainLayout: {
    maxWidth: '1400px',
    margin: '20px auto',
    padding: '0 20px',
    display: 'grid',
    gridTemplateColumns: 'minmax(260px, 1fr) 3fr',
    gap: '20px',
    alignItems: 'flex-start',
    position: 'relative',
    width: '100%',
    overflow: 'visible',
  },

  sidebar: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
    position: 'sticky',
    top: '20px',
    minWidth: '0',
  },

  sidebarCard: {
    background: 'white',
    borderRadius: '14px',
    padding: '16px',
    border: '1px solid #e2e8f0',
    boxShadow: '0 1px 4px rgba(0, 0, 0, 0.06)',
    position: 'relative',
    overflow: 'hidden',
    width: '100%',
  },

  cardHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '12px',
    flexWrap: 'wrap',
    gap: '8px',
    width: '100%',
  },

  cardTitle: {
    fontSize: '15px',
    fontWeight: '700',
    color: '#0f172a',
    margin: 0,
    lineHeight: '1.3',
  },

  cardBadge: {
    background: '#f1f5f9',
    color: '#475569',
    fontSize: '12px',
    fontWeight: '700',
    padding: '4px 8px',
    borderRadius: '12px',
    flexShrink: 0,
  },

  scheduleList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
    width: '100%',
  },

  scheduleItem: {
    background: '#f8fafc',
    borderRadius: '12px',
    padding: '12px',
    border: '1px solid #e2e8f0',
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    transition: 'all 0.2s ease',
    flexWrap: 'wrap',
    width: '100%',
  },

  scheduleTime: {
    fontSize: '13px',
    fontWeight: '700',
    color: '#1d4ed8',
    background: '#eff6ff',
    padding: '4px 8px',
    borderRadius: '8px',
    minWidth: '60px',
    textAlign: 'center',
    flexShrink: 0,
  },

  scheduleContent: {
    flex: 1,
    minWidth: '120px',
  },

  scheduleName: {
    fontSize: '14px',
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: '3px',
    lineHeight: '1.3',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },

  scheduleMeta: {
    fontSize: '12px',
    color: '#475569',
    fontWeight: '500',
    lineHeight: '1.3',
    display: 'flex',
    flexWrap: 'wrap',
    gap: '4px',
  },

  schedulePhone: {
    fontFamily: 'monospace',
    letterSpacing: '0.3px',
    fontWeight: '600',
  },

  scheduleStatus: {
    fontSize: '11px',
    color: '#64748b',
    fontStyle: 'italic',
  },

  scheduleAction: {
    background: 'white',
    color: '#475569',
    border: '1px solid #e2e8f0',
    borderRadius: '8px',
    width: '32px',
    height: '32px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    fontSize: '14px',
    transition: 'all 0.2s ease',
    fontWeight: 'bold',
    flexShrink: 0,
  },

  emptySchedule: {
    textAlign: 'center',
    padding: '24px 16px',
    color: '#64748b',
    width: '100%',
  },

  emptyIcon: {
    fontSize: '24px',
    marginBottom: '8px',
    opacity: 0.5,
  },

  emptyText: {
    fontSize: '13px',
    fontWeight: '600',
    color: '#475569',
    lineHeight: '1.3',
  },

  quickActions: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    width: '100%',
  },

  quickButton: {
    background: '#f8fafc',
    border: '1px solid #e2e8f0',
    borderRadius: '10px',
    padding: '10px 14px',
    fontSize: '14px',
    fontWeight: '600',
    color: '#475569',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    transition: 'all 0.2s ease',
    textAlign: 'left',
    whiteSpace: 'nowrap',
    width: '100%',
  },

  quickIcon: {
    fontSize: '16px',
    color: '#1d4ed8',
    fontWeight: 'bold',
    flexShrink: 0,
  },

  contentArea: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
    minWidth: 0,
    width: '100%',
  },

  viewControls: {
    background: 'white',
    borderRadius: '14px',
    padding: '14px 16px',
    border: '1px solid #e2e8f0',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: '12px',
    boxShadow: '0 1px 4px rgba(0, 0, 0, 0.06)',
    position: 'relative',
    width: '100%',
  },

  viewTabs: {
    display: 'flex',
    gap: '8px',
    flexWrap: 'wrap',
  },

  viewTab: {
    padding: '8px 14px',
    background: '#f8fafc',
    border: '1px solid #e2e8f0',
    borderRadius: '10px',
    fontSize: '14px',
    fontWeight: '600',
    color: '#475569',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    transition: 'all 0.2s ease',
    whiteSpace: 'nowrap',
  },

  viewTabActive: {
    background: '#1d4ed8',
    color: 'white',
    borderColor: '#1d4ed8',
  },

  viewTabIcon: {
    fontSize: '14px',
    flexShrink: 0,
  },

  resultsInfo: {
    fontSize: '14px',
    color: '#475569',
    fontWeight: '500',
    lineHeight: '1.3',
    textAlign: 'right',
    flex: 1,
    minWidth: '180px',
  },

  resultsCount: {
    fontWeight: '700',
    color: '#0f172a',
  },

  resultsFilter: {
    color: '#64748b',
    fontWeight: '500',
  },

  contentPanel: {
    background: 'white',
    borderRadius: '14px',
    padding: '20px',
    border: '1px solid #e2e8f0',
    boxShadow: '0 1px 4px rgba(0, 0, 0, 0.06)',
    minHeight: '500px',
    position: 'relative',
    overflow: 'auto',
    width: '100%',
    maxWidth: '100%',
  },

  loadingState: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    height: '300px',
    gap: '12px',
    width: '100%',
  },

  loadingSpinner: {
    width: '36px',
    height: '36px',
    border: '3px solid #f1f5f9',
    borderTopColor: '#1d4ed8',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite',
    flexShrink: 0,
  },

  loadingText: {
    color: '#475569',
    fontSize: '15px',
    fontWeight: '600',
    lineHeight: '1.3',
  },

  // Pipeline Styles
  pipelineContainer: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
    width: '100%',
    overflow: 'hidden',
  },

  pipelineHeader: {
    paddingBottom: '12px',
    borderBottom: '1px solid #e2e8f0',
    width: '100%',
  },

  pipelineTitle: {
    fontSize: '18px',
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: '4px',
    lineHeight: '1.3',
  },

  pipelineSubtitle: {
    fontSize: '14px',
    color: '#475569',
    fontWeight: '500',
    lineHeight: '1.3',
  },

  pipelineGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
    gap: '16px',
    width: '100%',
    minWidth: '0',
  },

  pipelineColumn: {
    background: '#f8fafc',
    borderRadius: '14px',
    overflow: 'hidden',
    border: '1px solid #e2e8f0',
    maxHeight: '600px',
    display: 'flex',
    flexDirection: 'column',
    minWidth: '0',
  },

  columnHeader: {
    padding: '14px 16px',
    borderBottom: '1px solid #e2e8f0',
    background: '#f1f5f9',
    flexShrink: 0,
  },

  columnTitle: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    flexWrap: 'wrap',
  },

  columnIcon: {
    width: '36px',
    height: '36px',
    borderRadius: '10px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '16px',
    fontWeight: 'bold',
    flexShrink: 0,
  },

  columnName: {
    fontSize: '15px',
    fontWeight: '700',
    color: '#0f172a',
    lineHeight: '1.3',
  },

  columnCount: {
    fontSize: '12px',
    color: '#475569',
    marginTop: '2px',
    fontWeight: '600',
    lineHeight: '1.3',
  },

  columnLeads: {
    padding: '14px',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    flex: 1,
    overflowY: 'auto',
    overflowX: 'hidden',
  },

  leadCard: {
    background: 'white',
    borderRadius: '12px',
    padding: '14px',
    border: '1px solid #e2e8f0',
    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)',
    position: 'relative',
    minWidth: '0',
  },

  leadHeader: {
    marginBottom: '10px',
  },

  leadInfo: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    flexWrap: 'wrap',
    gap: '8px',
  },

  leadNameRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    flex: 1,
    minWidth: '150px',
  },

  leadInitial: {
    width: '36px',
    height: '36px',
    borderRadius: '10px',
    background: '#eff6ff',
    color: '#1d4ed8',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: '700',
    fontSize: '14px',
    flexShrink: 0,
  },

  leadName: {
    fontSize: '14px',
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: '2px',
    lineHeight: '1.3',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },

  leadPhone: {
    fontSize: '12px',
    color: '#475569',
    fontFamily: 'monospace',
    fontWeight: '600',
    lineHeight: '1.3',
  },

  leadScore: {
    fontSize: '13px',
    fontWeight: '700',
    color: '#b45309',
    background: '#fef3c7',
    padding: '4px 8px',
    borderRadius: '8px',
    flexShrink: 0,
  },

  followupInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    marginBottom: '10px',
    fontSize: '12px',
    flexWrap: 'wrap',
  },

  followupDate: {
    color: '#475569',
    fontWeight: '600',
    lineHeight: '1.3',
  },

  followupBadge: {
    fontSize: '11px',
    fontWeight: '700',
    padding: '3px 6px',
    borderRadius: '6px',
    flexShrink: 0,
  },

  leadFooter: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '10px',
    flexWrap: 'wrap',
    gap: '8px',
  },

  leadHealth: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    flex: 1,
    minWidth: '150px',
  },

  healthIndicator: {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    flexShrink: 0,
  },

  suggestionText: {
    fontSize: '12px',
    color: '#065f46',
    fontWeight: '600',
    flex: 1,
    lineHeight: '1.3',
  },

  leadActions: {
    display: 'flex',
    gap: '6px',
    flexShrink: 0,
  },

  actionButton: {
    background: '#f8fafc',
    color: '#475569',
    border: '1px solid #e2e8f0',
    borderRadius: '8px',
    width: '32px',
    height: '32px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    fontSize: '14px',
    transition: 'all 0.2s ease',
    fontWeight: 'bold',
    flexShrink: 0,
  },

  statusSelect: {
    width: '100%',
    padding: '6px 10px',
    borderRadius: '8px',
    border: '1px solid #e2e8f0',
    fontSize: '13px',
    color: '#475569',
    background: 'white',
    fontWeight: '600',
    cursor: 'pointer',
    lineHeight: '1.3',
  },

  emptyColumn: {
    textAlign: 'center',
    padding: '32px 16px',
    color: '#64748b',
    border: '1px dashed #e2e8f0',
    borderRadius: '12px',
    marginTop: '8px',
  },

  emptyColumnIcon: {
    fontSize: '24px',
    marginBottom: '8px',
    opacity: 0.4,
  },

  emptyColumnText: {
    fontSize: '13px',
    fontWeight: '600',
    color: '#475569',
    lineHeight: '1.3',
  },

  // Empty State
  emptyState: {
    textAlign: 'center',
    padding: '60px 20px',
    position: 'relative',
    width: '100%',
  },

  emptyIcon: {
    fontSize: '40px',
    marginBottom: '12px',
    opacity: 0.6,
    color: '#1d4ed8',
  },

  emptyTitle: {
    fontSize: '20px',
    fontWeight: '700',
    color: '#0f172a',
    margin: '0 0 12px 0',
    letterSpacing: '-0.3px',
    lineHeight: '1.3',
  },

  emptyDescription: {
    fontSize: '15px',
    color: '#475569',
    marginBottom: '24px',
    maxWidth: '380px',
    margin: '0 auto 24px',
    lineHeight: 1.6,
    fontWeight: '500',
  },

  emptyButton: {
    background: '#1d4ed8',
    color: 'white',
    border: 'none',
    borderRadius: '10px',
    padding: '12px 20px',
    fontSize: '15px',
    fontWeight: '600',
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    transition: 'all 0.2s ease',
    boxShadow: '0 2px 8px rgba(29, 78, 216, 0.25)',
    letterSpacing: '0.3px',
    whiteSpace: 'nowrap',
  },

  // Modal Styles
  modalOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '16px',
    zIndex: 1000,
    overflow: 'auto',
  },

  modal: {
    backgroundColor: 'white',
    borderRadius: '16px',
    width: '100%',
    maxWidth: '600px',
    maxHeight: '90vh',
    overflow: 'hidden',
    boxShadow: '0 20px 40px rgba(0, 0, 0, 0.15)',
    position: 'relative',
  },

  modalHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '16px 20px',
    borderBottom: '1px solid #e2e8f0',
    background: '#f8fafc',
    position: 'relative',
    zIndex: 1,
  },

  modalTitle: {
    fontSize: '18px',
    fontWeight: '700',
    color: '#0f172a',
    margin: 0,
    lineHeight: '1.3',
  },

  modalClose: {
    background: 'transparent',
    border: 'none',
    color: '#475569',
    cursor: 'pointer',
    fontSize: '20px',
    padding: '6px',
    borderRadius: '8px',
    width: '36px',
    height: '36px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'all 0.2s ease',
    fontWeight: 'bold',
    flexShrink: 0,
  },

  modalBody: {
    padding: '20px',
    overflowY: 'auto',
    maxHeight: 'calc(90vh - 60px)',
    position: 'relative',
  },

  modalContent: {
    display: 'flex',
    flexDirection: 'column',
    gap: '20px',
  },

  // Activity Container
  activityContainer: {
    background: '#f8fafc',
    borderRadius: '14px',
    padding: '16px',
    border: '1px solid #e2e8f0',
    position: 'relative',
  },

  activityTitle: {
    fontSize: '15px',
    fontWeight: '700',
    color: '#0f172a',
    margin: '0 0 12px 0',
    lineHeight: '1.3',
  },

  activityTimeline: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },

  activityItem: {
    display: 'flex',
    gap: '10px',
    alignItems: 'flex-start',
  },

  activityDot: {
    width: '8px',
    height: '8px',
    backgroundColor: '#1d4ed8',
    borderRadius: '50%',
    flexShrink: 0,
    marginTop: '6px',
  },

  activityContent: {
    flex: 1,
    minWidth: 0,
  },

  activityMessage: {
    fontSize: '14px',
    color: '#475569',
    marginBottom: '4px',
    lineHeight: 1.5,
    fontWeight: '500',
  },

  activityTimestamp: {
    fontSize: '12px',
    color: '#64748b',
    fontWeight: '500',
    lineHeight: '1.3',
  },
};

// Add CSS animations with OPTIMIZED styles
if (typeof document !== 'undefined') {
  const styleSheet = document.createElement('style');
  styleSheet.textContent = `
    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }
    
    @keyframes modalSlideIn {
      from {
        opacity: 0;
        transform: translateY(-10px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }
    
    body {
      margin: 0;
      font-family: 'Inter', sans-serif;
      -webkit-font-smoothing: antialiased;
      -moz-osx-font-smoothing: grayscale;
      font-size: 14px;
      color: #0f172a;
      overflow-x: hidden;
      transform-origin: 0 0;
    }
    
    html {
      -webkit-text-size-adjust: 100%;
      text-size-adjust: 100%;
    }
    
    /* OPTIMIZED SCROLLBARS */
    ::-webkit-scrollbar {
      width: 8px;
      height: 8px;
    }
    
    ::-webkit-scrollbar-track {
      background: #f1f5f9;
      border-radius: 4px;
    }
    
    ::-webkit-scrollbar-thumb {
      background: #cbd5e1;
      border-radius: 4px;
    }
    
    ::-webkit-scrollbar-thumb:hover {
      background: #94a3b8;
    }
    
    /* HOVER EFFECTS */
    .primary-button:hover, .empty-button:hover {
      background: #1e40af;
      transform: translateY(-1px);
      box-shadow: 0 4px 12px rgba(29, 78, 216, 0.3);
    }
    
    .schedule-item:hover, .lead-card:hover {
      border-color: #1d4ed8;
      transform: translateY(-1px);
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
    }
    
    .quick-button:hover, .action-button:hover, .schedule-action:hover {
      border-color: #1d4ed8;
      color: #1d4ed8;
      background: #f1f5f9;
    }
    
    .view-tab:hover:not(.view-tab-active) {
      background: #f1f5f9;
      border-color: #cbd5e1;
    }
    
    .modal-close:hover {
      background: #f1f5f9;
      color: #1d4ed8;
    }
    
    .metric-card:hover {
      border-color: #1d4ed8;
      transform: translateY(-1px);
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
    }
    
    /* Modal animation */
    .modal {
      animation: modalSlideIn 0.2s ease-out;
    }
    
    /* Improve focus states */
    button:focus, select:focus, input:focus, textarea:focus {
      outline: 2px solid rgba(29, 78, 216, 0.5);
      outline-offset: 1px;
      border-color: #1d4ed8 !important;
    }
    
    /* RESPONSIVE BREAKPOINTS */
    @media (max-width: 1200px) {
      .main-layout {
        grid-template-columns: 1fr !important;
        gap: 16px !important;
      }
      
      .sidebar {
        position: static !important;
        order: 2;
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
        gap: 16px;
      }
      
      .content-area {
        order: 1;
      }
      
      .header-content {
        flex-direction: column !important;
        align-items: stretch !important;
        gap: 16px !important;
      }
      
      .header-left, .metrics-container, .header-actions {
        width: 100% !important;
        flex: none !important;
      }
      
      .metrics-container {
        justify-content: space-between !important;
      }
      
      .metric-card {
        flex: 1 !important;
        max-width: none !important;
      }
    }
    
    @media (max-width: 768px) {
      .header {
        padding: 12px 16px !important;
      }
      
      .main-layout {
        margin: 16px auto !important;
        padding: 0 16px !important;
      }
      
      .content-panel {
        padding: 16px !important;
        min-height: 400px !important;
      }
      
      .modal-overlay {
        padding: 12px !important;
      }
      
      .modal {
        max-height: 95vh !important;
        max-width: 98vw !important;
      }
      
      .modal-body {
        max-height: calc(95vh - 60px) !important;
        padding: 16px !important;
      }
      
      .view-controls {
        flex-direction: column !important;
        align-items: stretch !important;
        gap: 8px !important;
        padding: 12px !important;
      }
      
      .view-tabs {
        width: 100% !important;
        justify-content: center !important;
      }
      
      .results-info {
        text-align: center !important;
        width: 100% !important;
      }
      
      .pipeline-grid {
        grid-template-columns: 1fr !important;
      }
      
      .sidebar {
        grid-template-columns: 1fr !important;
      }
      
      .alert-content {
        flex-direction: column !important;
        align-items: flex-start !important;
      }
      
      .alert-actions {
        margin-top: 6px !important;
      }
    }
    
    @media (max-width: 576px) {
      .brand {
        flex-direction: column !important;
        align-items: flex-start !important;
        gap: 8px !important;
      }
      
      .brand-icon {
        width: 40px !important;
        height: 40px !important;
        font-size: 18px !important;
      }
      
      .title {
        font-size: 18px !important;
      }
      
      .metrics-container {
        flex-direction: column !important;
        align-items: stretch !important;
      }
      
      .metric-card {
        max-width: 100% !important;
        min-width: 100% !important;
      }
      
      .schedule-item {
        flex-direction: column !important;
        align-items: stretch !important;
        gap: 8px !important;
      }
      
      .schedule-time {
        align-self: flex-start !important;
        min-width: 70px !important;
      }
      
      .schedule-action {
        align-self: flex-end !important;
      }
      
      .view-tabs {
        flex-direction: column !important;
      }
      
      .view-tab {
        width: 100% !important;
        justify-content: center !important;
      }
      
      .lead-footer {
        flex-direction: column !important;
        align-items: stretch !important;
      }
      
      .lead-actions {
        justify-content: flex-end !important;
        margin-top: 8px !important;
      }
      
      .pipeline-column {
        max-height: 400px !important;
      }
    }
    
    @media (max-width: 480px) {
      .header-content {
        gap: 12px !important;
      }
      
      .primary-button, .empty-button {
        padding: 10px 14px !important;
        font-size: 14px !important;
      }
      
      .modal-header {
        padding: 12px 16px !important;
      }
      
      .modal-title {
        font-size: 16px !important;
      }
      
      .modal-close {
        width: 32px !important;
        height: 32px !important;
        font-size: 18px !important;
      }
      
      .content-panel {
        padding: 12px !important;
      }
      
      .empty-title {
        font-size: 18px !important;
      }
      
      .empty-description {
        font-size: 14px !important;
        padding: 0 12px !important;
      }
      
      .alert-text {
        min-width: 100% !important;
      }
    }
    
    /* High DPI screens */
    @media (-webkit-min-device-pixel-ratio: 2), (min-resolution: 192dpi) {
      .border, .border-bottom, .border-top, .border-left, .border-right {
        border-width: 0.5px !important;
      }
    }
    
    /* Fix for Chrome zoom */
    * {
      -webkit-backface-visibility: hidden;
      backface-visibility: hidden;
    }
    
    .header, .sidebar-card, .content-panel, .modal, .lead-card {
      -webkit-font-smoothing: subpixel-antialiased;
      transform: translateZ(0);
    }
    
    /* Fix input zoom on iOS */
    input, select, textarea {
      font-size: 16px !important;
    }
    
    @media screen and (-webkit-min-device-pixel-ratio: 2) {
      .loading-spinner {
        -webkit-font-smoothing: antialiased;
      }
    }
    
    /* Print styles */
    @media print {
      .sidebar, .view-controls, .modal-overlay, button {
        display: none !important;
      }
      
      .main-layout {
        display: block !important;
        margin: 0 !important;
        padding: 0 !important;
      }
      
      .content-panel {
        box-shadow: none !important;
        border: 1px solid #000 !important;
      }
    }
  `;
  document.head.appendChild(styleSheet);
}