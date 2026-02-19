import { useState, useMemo, useEffect } from "react";
import { STATUS, FIVERR_ACCOUNTS, QUERY_TYPES } from "../config";

export default function LeadTable({
  leads,
  onStatusChange,
  onCommentChange,
  onFollowChange,
  onDelete,
  onEdit,
  getScore,
  getSuggestion,
  getHealth,
  openWhatsApp
}) {

  const [search, setSearch] = useState("");
  const [activeCommentId, setActiveCommentId] = useState(null);
  const [commentText, setCommentText] = useState("");
  const [expandedLead, setExpandedLead] = useState(null);
  
  // Status tabs - each status is its own tab
  const [activeTab, setActiveTab] = useState("active"); // Default to "active" tab
  
  // Other filter states
  const [filters, setFilters] = useState({
    fiverr: "all",
    queryType: "all",
    priority: "all",
    dateRange: "all"
  });
  
  // Sort states
  const [sortBy, setSortBy] = useState("created"); // Default to created date
  const [sortOrder, setSortOrder] = useState("desc"); // Default to descending (newest first)

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(25); // Show 25 leads per page

  // ─── STATUS CONFIG WITH HIGH CONTRAST COLORS ─────────────────────
  const statusConfig = {
    "Still in Talk": { 
      color: "#92400E", // Darker amber - HIGH CONTRAST
      icon: "💬",
      bgColor: "#FEF3C7",
      borderColor: "#B45309"
    },
    "Pending": { 
      color: "#1E40AF", // Darker blue - HIGH CONTRAST
      icon: "⏳",
      bgColor: "#DBEAFE",
      borderColor: "#1D4ED8"
    },
    "Order Placed": { 
      color: "#5B21B6", // Darker purple - HIGH CONTRAST
      icon: "💰",
      bgColor: "#EDE9FE",
      borderColor: "#6D28D9"
    },
    "Order Delivered": { 
      color: "#065F46", // Darker green - HIGH CONTRAST
      icon: "✅",
      bgColor: "#D1FAE5",
      borderColor: "#047857"
    },
    "Cancelled": { 
      color: "#991B1B", // Darker red - HIGH CONTRAST
      icon: "❌",
      bgColor: "#FEE2E2",
      borderColor: "#DC2626"
    }
  };

  // Define which statuses belong to "active" tab
  const activeStatuses = ["Still in Talk", "Pending", "Order Placed"];

  // ─── SMART PROCESSING WITH FILTERS & SORTING ────────────────
  const processedLeads = useMemo(() => {
    // Add metadata and format dates
    let processed = leads.map(lead => {
      const health = getHealth(lead);
      const score = getScore(lead);
      const suggestion = getSuggestion(lead);
      
      // Get creation date from Firestore timestamp or regular date
      let createdAt = null;
      if (lead.createdAt?.seconds) {
        // Firestore timestamp
        createdAt = new Date(lead.createdAt.seconds * 1000);
      } else if (lead.createdAt) {
        // Regular Date object or string
        createdAt = new Date(lead.createdAt);
      } else {
        // Fallback to current date if no creation date
        createdAt = new Date();
      }
      
      // Calculate timestamp for sorting (newest first by default)
      const createdTimestamp = createdAt.getTime();
      
      // Format date for display
      const formattedDate = createdAt.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
      
      const formattedTime = createdAt.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      });
      
      // Update priority calculation
      return {
        ...lead,
        health,
        score,
        suggestion,
        // Store original timestamp for sorting
        createdTimestamp,
        // Store formatted dates for display
        formattedDate,
        formattedTime,
        // Store the Date object
        createdAtDate: createdAt,
        priority: health.text === "Overdue" ? 1 : 
                 health.text === "Soon" ? 2 : 
                 lead.status === "Order Placed" ? 3 : 
                 lead.status === "Still in Talk" ? 4 : 
                 lead.status === "Pending" ? 5 : 
                 lead.status === "Order Delivered" ? 6 : 7 // Cancelled gets lowest priority
      };
    });

    // Apply status tab filter FIRST
    if (activeTab === "active") {
      // Show only active statuses
      processed = processed.filter(lead => activeStatuses.includes(lead.status));
    } else if (activeTab === "all") {
      // Show all statuses (no filter)
    } else {
      // Show specific status tab
      processed = processed.filter(lead => lead.status === activeTab);
    }

    // Apply other filters
    processed = processed.filter(lead => {
      if (filters.fiverr !== "all" && lead.fiverr !== filters.fiverr) return false;
      if (filters.queryType !== "all" && lead.queryType !== filters.queryType) return false;
      if (filters.priority !== "all") {
        if (filters.priority === "overdue" && lead.health.text !== "Overdue") return false;
        if (filters.priority === "soon" && lead.health.text !== "Soon") return false;
      }
      if (filters.dateRange !== "all") {
        const created = lead.createdAtDate || new Date();
        const now = new Date();
        const diffDays = Math.floor((now - created) / (1000 * 60 * 60 * 24));
        
        if (filters.dateRange === "today" && diffDays > 0) return false;
        if (filters.dateRange === "week" && diffDays > 7) return false;
        if (filters.dateRange === "month" && diffDays > 30) return false;
      }
      return true;
    });

    // Apply search
    if (search.trim()) {
      const searchLower = search.toLowerCase();
      processed = processed.filter(lead => 
        lead.fullName?.toLowerCase().includes(searchLower) ||
        lead.cell?.includes(search) ||
        lead.brand?.toLowerCase().includes(searchLower) ||
        lead.queryType?.toLowerCase().includes(searchLower) ||
        lead.comments?.some(comment => 
          comment.text.toLowerCase().includes(searchLower)
        )
      );
    }

    // Apply sorting - NEWEST FIRST BY DEFAULT (descending order by creation date)
    processed.sort((a, b) => {
      let aVal, bVal;
      
      switch(sortBy) {
        case "priority":
          aVal = a.priority;
          bVal = b.priority;
          break;
        case "status":
          aVal = a.status;
          bVal = b.status;
          break;
        case "created":
          // Sort by creation timestamp (newest first by default)
          aVal = a.createdTimestamp;
          bVal = b.createdTimestamp;
          break;
        case "followUp":
          aVal = a.followUpAt ? new Date(a.followUpAt).getTime() : 0;
          bVal = b.followUpAt ? new Date(b.followUpAt).getTime() : 0;
          break;
        case "name":
          aVal = a.fullName?.toLowerCase() || "";
          bVal = b.fullName?.toLowerCase() || "";
          break;
        case "score":
          aVal = a.score || 0;
          bVal = b.score || 0;
          break;
        default:
          // Default to newest first
          aVal = a.createdTimestamp;
          bVal = b.createdTimestamp;
      }

      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return sortOrder === "asc" ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      } else {
        // For numbers (including timestamps), newest/largest first by default
        return sortOrder === "asc" ? aVal - bVal : bVal - aVal;
      }
    });

    return processed.map((lead, index) => ({
      ...lead,
      sequence: index + 1
    }));
  }, [leads, activeTab, filters, search, sortBy, sortOrder, getHealth, getScore, getSuggestion]);

  // ─── PAGINATION CALCULATIONS ───────────────────────────────
  const totalItems = processedLeads.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage);
  
  // Calculate current page items
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentLeads = processedLeads.slice(indexOfFirstItem, indexOfLastItem);
  
  // Generate page numbers
  const pageNumbers = [];
  for (let i = 1; i <= totalPages; i++) {
    pageNumbers.push(i);
  }

  // Reset to first page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [activeTab, filters, search, sortBy, sortOrder]);

  // ─── HANDLERS ─────────────────────────────
  const handleSort = (column) => {
    if (sortBy === column) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortBy(column);
      setSortOrder("desc"); // Always default to descending for dates
    }
  };

  const handleAddComment = (leadId) => {
    if (commentText.trim() && onCommentChange) {
      onCommentChange(leadId, commentText);
      setCommentText("");
      setActiveCommentId(null);
    }
  };

  const handleSetFollowUp = (leadId, date, time) => {
    if (date && time && onFollowChange) {
      onFollowChange(leadId, new Date(`${date}T${time}`).toISOString());
    } else if (date && onFollowChange) {
      // If only date is provided (from quick options)
      onFollowChange(leadId, date);
    }
  };

  const getSortIcon = (column) => {
    if (sortBy !== column) return "↕️";
    return sortOrder === "asc" ? "⬆️" : "⬇️";
  };

  // Handle status change - if status changes, lead will move to appropriate tab
  const handleStatusChange = (leadId, newStatus) => {
    onStatusChange(leadId, newStatus);
  };

  // Pagination handlers
  const handlePageChange = (pageNumber) => {
    setCurrentPage(pageNumber);
    // Scroll to top of table
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleNextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage(currentPage + 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handlePrevPage = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  // Calculate visible page numbers (like standard pagination)
  const getVisiblePages = () => {
    const delta = 2; // Number of pages to show before and after current page
    const range = [];
    const rangeWithDots = [];
    let l;

    for (let i = 1; i <= totalPages; i++) {
      if (i === 1 || i === totalPages || (i >= currentPage - delta && i <= currentPage + delta)) {
        range.push(i);
      }
    }

    range.forEach((i) => {
      if (l) {
        if (i - l === 2) {
          rangeWithDots.push(l + 1);
        } else if (i - l !== 1) {
          rangeWithDots.push('...');
        }
      }
      rangeWithDots.push(i);
      l = i;
    });

    return rangeWithDots;
  };

  // Function to get time ago for recent leads
  const getTimeAgo = (date) => {
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  return (
    <div style={styles.container}>
      
      {/* STATUS TABS - HIGH CONTRAST */}
      <div style={styles.tabsContainer}>
        <div style={styles.tabs}>
          <button
            style={{
              ...styles.tabButton,
              ...(activeTab === "active" && styles.activeTabButton),
              backgroundColor: activeTab === "active" ? '#1E40AF' : '#FFFFFF',
              color: activeTab === "active" ? '#FFFFFF' : '#1E293B',
              borderColor: activeTab === "active" ? '#1E40AF' : '#CBD5E1',
              borderWidth: '2px'
            }}
            onClick={() => setActiveTab("active")}
          >
            <span style={styles.tabIcon}>📈</span>
            Active in Progress
            <span style={styles.tabCount}>
              {leads.filter(lead => activeStatuses.includes(lead.status)).length}
            </span>
          </button>
          
          <button
            style={{
              ...styles.tabButton,
              backgroundColor: activeTab === "Still in Talk" ? '#FEF3C7' : '#FFFFFF',
              color: activeTab === "Still in Talk" ? '#92400E' : '#1E293B',
              borderColor: activeTab === "Still in Talk" ? '#B45309' : '#CBD5E1',
              borderWidth: '2px'
            }}
            onClick={() => setActiveTab("Still in Talk")}
          >
            <span style={styles.tabIcon}>💬</span>
            Still in Talk
            <span style={styles.tabCount}>
              {leads.filter(lead => lead.status === "Still in Talk").length}
            </span>
          </button>
          
          <button
            style={{
              ...styles.tabButton,
              backgroundColor: activeTab === "Pending" ? '#DBEAFE' : '#FFFFFF',
              color: activeTab === "Pending" ? '#1E40AF' : '#1E293B',
              borderColor: activeTab === "Pending" ? '#1D4ED8' : '#CBD5E1',
              borderWidth: '2px'
            }}
            onClick={() => setActiveTab("Pending")}
          >
            <span style={styles.tabIcon}>⏳</span>
            Pending
            <span style={styles.tabCount}>
              {leads.filter(lead => lead.status === "Pending").length}
            </span>
          </button>
          
          <button
            style={{
              ...styles.tabButton,
              backgroundColor: activeTab === "Order Placed" ? '#EDE9FE' : '#FFFFFF',
              color: activeTab === "Order Placed" ? '#5B21B6' : '#1E293B',
              borderColor: activeTab === "Order Placed" ? '#6D28D9' : '#CBD5E1',
              borderWidth: '2px'
            }}
            onClick={() => setActiveTab("Order Placed")}
          >
            <span style={styles.tabIcon}>💰</span>
            Order Placed
            <span style={styles.tabCount}>
              {leads.filter(lead => lead.status === "Order Placed").length}
            </span>
          </button>
          
          <button
            style={{
              ...styles.tabButton,
              backgroundColor: activeTab === "Order Delivered" ? '#D1FAE5' : '#FFFFFF',
              color: activeTab === "Order Delivered" ? '#065F46' : '#1E293B',
              borderColor: activeTab === "Order Delivered" ? '#047857' : '#CBD5E1',
              borderWidth: '2px'
            }}
            onClick={() => setActiveTab("Order Delivered")}
          >
            <span style={styles.tabIcon}>✅</span>
            Delivered
            <span style={styles.tabCount}>
              {leads.filter(lead => lead.status === "Order Delivered").length}
            </span>
          </button>
          
          <button
            style={{
              ...styles.tabButton,
              backgroundColor: activeTab === "Cancelled" ? '#FEE2E2' : '#FFFFFF',
              color: activeTab === "Cancelled" ? '#991B1B' : '#1E293B',
              borderColor: activeTab === "Cancelled" ? '#DC2626' : '#CBD5E1',
              borderWidth: '2px'
            }}
            onClick={() => setActiveTab("Cancelled")}
          >
            <span style={styles.tabIcon}>❌</span>
            Cancelled
            <span style={styles.tabCount}>
              {leads.filter(lead => lead.status === "Cancelled").length}
            </span>
          </button>
          
          <button
            style={{
              ...styles.tabButton,
              backgroundColor: activeTab === "all" ? '#0F172A' : '#FFFFFF',
              color: activeTab === "all" ? '#FFFFFF' : '#1E293B',
              borderColor: activeTab === "all" ? '#0F172A' : '#CBD5E1',
              borderWidth: '2px'
            }}
            onClick={() => setActiveTab("all")}
          >
            <span style={styles.tabIcon}>📋</span>
            All Leads
            <span style={styles.tabCount}>
              {leads.length}
            </span>
          </button>
        </div>
      </div>

      {/* COMPACT CONTROLS HEADER */}
      <div style={styles.controlsHeader}>
        {/* SEARCH WITH HIGH CONTRAST */}
        <div style={styles.searchBox}>
          <input
            style={styles.searchInput}
            placeholder="Search leads by name, phone, brand..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <div style={styles.searchIcon}>🔍</div>
        </div>

        {/* OTHER FILTERS */}
        <div style={styles.filterRow}>
          <select 
            style={styles.filterSelect}
            value={filters.fiverr}
            onChange={e => setFilters({...filters, fiverr: e.target.value})}
          >
            <option value="all">All Owners</option>
            {FIVERR_ACCOUNTS.map(f => (
              <option key={f} value={f}>{f}</option>
            ))}
          </select>

          <select 
            style={styles.filterSelect}
            value={filters.queryType}
            onChange={e => setFilters({...filters, queryType: e.target.value})}
          >
            <option value="all">All Types</option>
            {QUERY_TYPES.map(q => (
              <option key={q} value={q}>{q}</option>
            ))}
          </select>

          <select 
            style={styles.filterSelect}
            value={filters.priority}
            onChange={e => setFilters({...filters, priority: e.target.value})}
          >
            <option value="all">All Priority</option>
            <option value="overdue">Overdue</option>
            <option value="soon">Due Soon</option>
          </select>

          <select 
            style={styles.filterSelect}
            value={filters.dateRange}
            onChange={e => setFilters({...filters, dateRange: e.target.value})}
          >
            <option value="all">All Time</option>
            <option value="today">Today</option>
            <option value="week">This Week</option>
            <option value="month">This Month</option>
          </select>
        </div>
      </div>

      {/* SORT HEADER */}
      <div style={styles.sortHeader}>
        <div style={styles.sortButtons}>
          <button 
            style={styles.sortButton}
            onClick={() => handleSort("created")}
            title="Sort by Creation Date (Newest First)"
          >
            Created {getSortIcon("created")}
          </button>
          <button 
            style={styles.sortButton}
            onClick={() => handleSort("priority")}
            title="Sort by Priority"
          >
            Priority {getSortIcon("priority")}
          </button>
          <button 
            style={styles.sortButton}
            onClick={() => handleSort("name")}
            title="Sort by Name"
          >
            Name {getSortIcon("name")}
          </button>
          <button 
            style={styles.sortButton}
            onClick={() => handleSort("status")}
            title="Sort by Status"
          >
            Status {getSortIcon("status")}
          </button>
          <button 
            style={styles.sortButton}
            onClick={() => handleSort("followUp")}
            title="Sort by Next Follow-up"
          >
            Follow-up {getSortIcon("followUp")}
          </button>
          <button 
            style={styles.sortButton}
            onClick={() => handleSort("score")}
            title="Sort by Score"
          >
            Score {getSortIcon("score")}
          </button>
        </div>
        <div style={styles.resultsCount}>
          Showing <strong>{indexOfFirstItem + 1} - {Math.min(indexOfLastItem, totalItems)}</strong> of <strong>{totalItems}</strong> lead{totalItems !== 1 ? 's' : ''}
          <span style={{marginLeft: '12px', fontSize: '13px', color: '#475569', fontWeight: '600'}}>
            {activeTab === "active" ? "(Active in Progress)" : 
             activeTab === "all" ? "(All Leads)" : 
             `(${activeTab})`}
          </span>
        </div>
      </div>

      {/* COMPACT LEADS TABLE */}
      <div style={styles.tableWrapper}>
        <div style={styles.tableHeader}>
          <div style={styles.tableHeaderCell} className="sequence-col">#</div>
          <div style={styles.tableHeaderCell} className="name-col">Name & Phone</div>
          <div style={styles.tableHeaderCell} className="type-col">Type & Brand</div>
          <div style={styles.tableHeaderCell} className="owner-col">Owner</div>
          <div style={styles.tableHeaderCell} className="created-col">Created</div>
          <div style={styles.tableHeaderCell} className="status-col">Status</div>
          <div style={styles.tableHeaderCell} className="score-col">Score</div>
          <div style={styles.tableHeaderCell} className="followup-col">Follow-up</div>
          <div style={styles.tableHeaderCell} className="actions-col">Actions</div>
        </div>
        
        <div style={styles.tableContainer}>
          {currentLeads.length === 0 ? (
            <div style={styles.emptyState}>
              <div style={styles.emptyIcon}>
                {activeTab === "active" ? "📈" : 
                 activeTab === "Cancelled" ? "❌" : 
                 activeTab === "Order Delivered" ? "✅" : "📊"}
              </div>
              <div style={styles.emptyTitle}>
                {activeTab === "active" 
                  ? "No active leads in progress" 
                  : activeTab === "all"
                  ? "No leads found"
                  : `No leads with status "${activeTab}"`}
              </div>
              <div style={styles.emptyDescription}>
                Try adjusting your filters or add a new lead
              </div>
            </div>
          ) : (
            currentLeads.map((lead, index) => (
              <CompactLeadRow
                key={lead.id}
                lead={lead}
                statusConfig={statusConfig}
                isExpanded={expandedLead === lead.id}
                onToggleExpand={() => setExpandedLead(expandedLead === lead.id ? null : lead.id)}
                onStatusChange={handleStatusChange}
                onEdit={onEdit}
                onDelete={onDelete}
                activeCommentId={activeCommentId}
                setActiveCommentId={setActiveCommentId}
                commentText={commentText}
                setCommentText={setCommentText}
                onAddComment={() => handleAddComment(lead.id)}
                onSetFollowUp={(date, time) => handleSetFollowUp(lead.id, date, time)}
                openWhatsApp={openWhatsApp}
                isCancelled={lead.status === "Cancelled"}
                getTimeAgo={getTimeAgo}
              />
            ))
          )}
        </div>
      </div>

      {/* PAGINATION CONTROLS */}
      {totalPages > 1 && (
        <div style={styles.paginationContainer}>
          <div style={styles.paginationInfo}>
            <span style={styles.paginationLabel}>Page</span>
            <span style={styles.paginationCurrent}>{currentPage}</span>
            <span style={styles.paginationLabel}>of</span>
            <span style={styles.paginationTotal}>{totalPages}</span>
            <span style={styles.paginationDivider}>•</span>
            <span style={styles.paginationLabel}>{itemsPerPage} per page</span>
            <span style={styles.paginationDivider}>•</span>
            <span style={{color: '#1D4ED8', fontWeight: '700'}}>
              Newest leads first
            </span>
          </div>
          
          <div style={styles.paginationControls}>
            {/* Previous Button */}
            <button
              style={{
                ...styles.paginationButton,
                ...styles.paginationNavButton,
                ...(currentPage === 1 && styles.paginationButtonDisabled)
              }}
              onClick={handlePrevPage}
              disabled={currentPage === 1}
            >
              ← Previous
            </button>

            {/* Page Numbers */}
            <div style={styles.paginationNumbers}>
              {getVisiblePages().map((pageNum, index) => {
                if (pageNum === '...') {
                  return (
                    <span key={`dots-${index}`} style={styles.paginationDots}>
                      …
                    </span>
                  );
                }

                return (
                  <button
                    key={pageNum}
                    style={{
                      ...styles.paginationButton,
                      ...styles.paginationNumberButton,
                      ...(currentPage === pageNum && styles.paginationButtonActive)
                    }}
                    onClick={() => handlePageChange(pageNum)}
                  >
                    {pageNum}
                  </button>
                );
              })}
            </div>

            {/* Next Button */}
            <button
              style={{
                ...styles.paginationButton,
                ...styles.paginationNavButton,
                ...(currentPage === totalPages && styles.paginationButtonDisabled)
              }}
              onClick={handleNextPage}
              disabled={currentPage === totalPages}
            >
              Next →
            </button>
          </div>

          {/* Quick Page Input */}
          <div style={styles.paginationJump}>
            <span style={styles.paginationJumpText}>Go to:</span>
            <input
              type="number"
              min="1"
              max={totalPages}
              value={currentPage}
              onChange={(e) => {
                const value = parseInt(e.target.value);
                if (value >= 1 && value <= totalPages) {
                  handlePageChange(value);
                }
              }}
              style={styles.paginationInput}
              onKeyPress={(e) => {
                if (e.key === 'Enter') {
                  const value = parseInt(e.target.value);
                  if (value >= 1 && value <= totalPages) {
                    handlePageChange(value);
                  }
                }
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

// ─── COMPACT LEAD ROW COMPONENT ────────────────────
function CompactLeadRow({
  lead,
  statusConfig,
  isExpanded,
  onToggleExpand,
  onStatusChange,
  onEdit,
  onDelete,
  activeCommentId,
  setActiveCommentId,
  commentText,
  setCommentText,
  onAddComment,
  onSetFollowUp,
  openWhatsApp,
  isCancelled,
  getTimeAgo
}) {
  const status = statusConfig[lead.status];
  const daysUntilFollowUp = lead.followUpAt 
    ? Math.ceil((new Date(lead.followUpAt) - new Date()) / (1000 * 60 * 60 * 24))
    : null;

  // Format comment date
  const formatCommentDate = (timestamp) => {
    if (!timestamp) return "";
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString() + " " + date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
  };

  // Get health indicator color
  const getHealthIndicator = () => {
    const health = lead.health?.text || "";
    if (health.includes("Overdue")) return "#B91C1C";
    if (health.includes("Soon")) return "#B45309";
    if (health.includes("Up to date")) return "#065F46";
    return "#475569";
  };

  // Determine if lead is new (within last 24 hours)
  const isNewLead = () => {
    if (!lead.createdAtDate) return false;
    const now = new Date();
    const diffHours = (now - lead.createdAtDate) / (1000 * 60 * 60);
    return diffHours < 24;
  };

  return (
    <div style={{
      ...styles.leadRow,
      ...(isCancelled && styles.cancelledLeadRow),
      borderLeftColor: getHealthIndicator(),
      borderLeftWidth: '4px',
      borderLeftStyle: 'solid',
      borderBottom: '2px solid #E2E8F0'
    }}>
      {/* MAIN ROW - ALWAYS VISIBLE */}
      <div style={styles.mainRow}>
        <div style={styles.tableCell} className="sequence-col">
          <div style={styles.sequenceCell}>
            <span style={styles.sequence}>#{lead.sequence}</span>
            <div 
              style={{
                ...styles.healthDot,
                backgroundColor: lead.health.color,
                width: '10px',
                height: '10px'
              }}
              title={lead.health.text}
            />
          </div>
        </div>
        
        <div style={styles.tableCell} className="name-col">
          <div style={styles.nameCell}>
            <div style={styles.name}>
              {lead.fullName}
              {isNewLead() && (
                <span style={styles.newBadge} title="New lead (added within 24 hours)">
                  NEW
                </span>
              )}
            </div>
            <div style={styles.phone}>{lead.cell}</div>
          </div>
        </div>

        <div style={styles.tableCell} className="type-col">
          <div style={styles.typeCell}>
            <div style={styles.queryType}>{lead.queryType}</div>
            <div style={styles.brand}>{lead.brand}</div>
          </div>
        </div>

        <div style={styles.tableCell} className="owner-col">
          <div style={styles.ownerCell}>
            <div style={styles.owner}>{lead.fiverr}</div>
          </div>
        </div>

        {/* CREATED DATE COLUMN */}
        <div style={styles.tableCell} className="created-col">
          <div style={styles.createdCell}>
            <div style={styles.createdDate}>
              {lead.formattedDate || "N/A"}
            </div>
            <div style={{
              ...styles.createdTime,
              ...(isNewLead() && styles.newCreatedTime)
            }}>
              {lead.formattedTime || "N/A"}
            </div>
            {isNewLead() && (
              <div style={styles.timeAgo}>
                {getTimeAgo(lead.createdAtDate)}
              </div>
            )}
          </div>
        </div>

        <div style={styles.tableCell} className="status-col">
          <div style={styles.statusCell}>
            <div style={{
              ...styles.statusBadge,
              backgroundColor: status.bgColor,
              color: status.color,
              borderColor: status.borderColor,
              fontWeight: '700',
              fontSize: '13px'
            }}>
              <span style={styles.statusIcon}>{status.icon}</span>
              <span style={styles.statusText}>{lead.status}</span>
            </div>
            {/* Hidden dropdown for selection */}
            <select
              style={{
                ...styles.statusSelect,
                color: status.color,
                borderColor: status.color,
                ...(isCancelled && styles.cancelledStatusSelect)
              }}
              value={lead.status}
              onChange={(e) => onStatusChange(lead.id, e.target.value)}
            >
              {Object.entries(statusConfig).map(([key, config]) => (
                <option key={key} value={key}>
                  {config.icon} {key}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div style={styles.tableCell} className="score-col">
          <div style={styles.scoreCell}>
            <div style={{
              ...styles.score,
              ...(isCancelled && styles.cancelledScore),
              backgroundColor: lead.score >= 80 ? '#D1FAE5' : 
                               lead.score >= 60 ? '#FEF3C7' : '#FEE2E2',
              color: lead.score >= 80 ? '#065F46' : 
                     lead.score >= 60 ? '#92400E' : '#B91C1C',
              fontWeight: '700',
              fontSize: '13px'
            }}>⭐ {lead.score}</div>
          </div>
        </div>

        <div style={styles.tableCell} className="followup-col">
          <div style={styles.followUpCell}>
            {lead.followUpAt ? (
              <div style={styles.followUp}>
                <span style={styles.followUpDate}>
                  {new Date(lead.followUpAt).toLocaleDateString()}
                </span>
                {daysUntilFollowUp !== null && !isCancelled && (
                  <span style={{
                    ...styles.daysBadge,
                    backgroundColor: daysUntilFollowUp < 0 ? '#FEE2E2' : 
                                    daysUntilFollowUp <= 2 ? '#FEF3C7' : '#D1FAE5',
                    color: daysUntilFollowUp < 0 ? '#B91C1C' : 
                           daysUntilFollowUp <= 2 ? '#92400E' : '#065F46',
                    fontWeight: '700',
                    fontSize: '12px'
                  }}>
                    {daysUntilFollowUp < 0 ? 'Late' : 
                     daysUntilFollowUp === 0 ? 'Today' :
                     daysUntilFollowUp === 1 ? '1d' :
                     `${daysUntilFollowUp}d`}
                  </span>
                )}
              </div>
            ) : (
              <span style={styles.noFollowUp}>—</span>
            )}
          </div>
        </div>

        <div style={styles.tableCell} className="actions-col">
          <div style={styles.actionButtons}>
            {!isCancelled && (
              <button 
                style={styles.iconButton}
                onClick={() => openWhatsApp(lead.cell)}
                title="WhatsApp"
              >
                💬
              </button>
            )}
            <button 
              style={styles.iconButton}
              onClick={() => {
                setActiveCommentId(activeCommentId === lead.id ? null : lead.id);
                if (activeCommentId !== lead.id) {
                  setCommentText(""); // Clear previous comment text
                }
              }}
              title="Add Comment"
            >
              💭
            </button>
            <button 
              style={styles.iconButton}
              onClick={() => onEdit(lead)}
              title="Edit"
            >
              ✏️
            </button>
            <button 
              style={{
                ...styles.iconButton,
                backgroundColor: isExpanded ? '#E2E8F0' : '#F1F5F9',
                fontWeight: 'bold',
                fontSize: '14px'
              }}
              onClick={onToggleExpand}
              title={isExpanded ? "Collapse" : "Expand"}
            >
              {isExpanded ? "▲" : "▼"}
            </button>
          </div>
        </div>
      </div>

      {/* EXPANDED SECTION */}
      {isExpanded && (
        <div style={styles.expandedSection}>
          {/* LEAD CREATION INFO */}
          <div style={styles.creationInfo}>
            <div style={styles.creationLabel}>Lead Created:</div>
            <div style={styles.creationValue}>
              <span style={styles.creationDate}>{lead.formattedDate || "Unknown date"}</span>
              <span style={styles.creationSeparator}>•</span>
              <span style={styles.creationTime}>{lead.formattedTime || "Unknown time"}</span>
              {isNewLead() && (
                <>
                  <span style={styles.creationSeparator}>•</span>
                  <span style={styles.creationNew}>{getTimeAgo(lead.createdAtDate)}</span>
                </>
              )}
            </div>
          </div>

          {/* SUGGESTION */}
          <div style={styles.suggestion}>
            <span style={styles.suggestionIcon}>💡</span>
            <span style={styles.suggestionText}>{lead.suggestion}</span>
          </div>

          {/* COMMENT INPUT */}
          {activeCommentId === lead.id && (
            <div style={styles.commentInputRow}>
              <textarea
                style={styles.commentTextarea}
                placeholder="Add a comment..."
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                rows="2"
                autoFocus
              />
              <div style={styles.commentActions}>
                <button 
                  style={{
                    ...styles.smallButton,
                    backgroundColor: commentText.trim() ? '#1D4ED8' : '#E2E8F0',
                    color: commentText.trim() ? 'white' : '#475569',
                    border: 'none',
                    fontWeight: '600'
                  }}
                  onClick={() => {
                    onAddComment();
                    setActiveCommentId(null);
                  }}
                  disabled={!commentText.trim()}
                >
                  Save Comment
                </button>
                <button 
                  style={{
                    ...styles.smallButton,
                    backgroundColor: '#F1F5F9',
                    fontWeight: '600'
                  }}
                  onClick={() => {
                    setActiveCommentId(null);
                    setCommentText("");
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* RECENT COMMENTS */}
          {lead.comments && lead.comments.length > 0 && (
            <div style={styles.commentsPreview}>
              <div style={styles.commentsHeader}>
                <span style={styles.commentsTitle}>Recent Comments</span>
                <span style={styles.commentsCount}>{lead.comments.length}</span>
              </div>
              <div style={styles.commentList}>
                {[...lead.comments]
                  .sort((a, b) => {
                    const dateA = a.timestamp?.toDate ? a.timestamp.toDate() : new Date(a.timestamp || a.date);
                    const dateB = b.timestamp?.toDate ? b.timestamp.toDate() : new Date(b.timestamp || b.date);
                    return dateB - dateA;
                  })
                  .slice(0, 2)
                  .map((comment, index) => (
                    <div key={index} style={styles.commentItem}>
                      <div style={styles.commentText}>{comment.text}</div>
                      <div style={styles.commentDate}>
                        {formatCommentDate(comment.timestamp || comment.date)}
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* ADVANCED ACTIONS */}
          <div style={styles.advancedActions}>
            {!isCancelled && (
              <FollowUpQuickSet 
                leadId={lead.id}
                currentFollowUp={lead.followUpAt}
                onSetFollowUp={onSetFollowUp}
              />
            )}
            <button 
              style={styles.deleteBtn}
              onClick={() => {
                if (window.confirm(`Delete "${lead.fullName}"?`)) {
                  onDelete(lead.id);
                }
              }}
              title="Delete Lead"
            >
              🗑️ Delete
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── QUICK FOLLOW-UP SETTER ────────────────────
function FollowUpQuickSet({ leadId, currentFollowUp, onSetFollowUp }) {
  const [showPicker, setShowPicker] = useState(false);
  const [date, setDate] = useState("");
  const [time, setTime] = useState("12:00"); // Default time

  // Set default date to tomorrow
  useEffect(() => {
    if (showPicker && !date) {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      setDate(tomorrow.toISOString().split('T')[0]);
    }
  }, [showPicker, date]);

  const handleQuickSet = (days) => {
    const newDate = new Date();
    newDate.setDate(newDate.getDate() + days);
    const dateStr = newDate.toISOString().split('T')[0];
    onSetFollowUp(dateStr, time);
    setShowPicker(false);
  };

  const handleCustomSave = () => {
    if (date) {
      onSetFollowUp(date, time);
      setShowPicker(false);
    }
  };

  return (
    <div style={styles.followUpSetter}>
      {showPicker ? (
        <div style={styles.followUpPicker}>
          <div style={styles.quickOptions}>
            <button style={styles.quickOption} onClick={() => handleQuickSet(1)}>Tomorrow</button>
            <button style={styles.quickOption} onClick={() => handleQuickSet(3)}>3 Days</button>
            <button style={styles.quickOption} onClick={() => handleQuickSet(7)}>1 Week</button>
          </div>
          <div style={styles.customPicker}>
            <input
              type="date"
              style={styles.dateInput}
              value={date}
              onChange={(e) => setDate(e.target.value)}
              min={new Date().toISOString().split('T')[0]}
            />
            <input
              type="time"
              style={styles.timeInput}
              value={time}
              onChange={(e) => setTime(e.target.value)}
            />
            <button 
              style={styles.saveBtn}
              onClick={handleCustomSave}
              disabled={!date}
            >
              Set
            </button>
          </div>
          <button 
            style={styles.cancelBtn}
            onClick={() => setShowPicker(false)}
          >
            Cancel
          </button>
        </div>
      ) : (
        <button 
          style={styles.setFollowUpBtn}
          onClick={() => setShowPicker(true)}
          title="Set Follow-up"
        >
          {currentFollowUp ? "✏️ Reschedule" : "📅 Schedule"}
        </button>
      )}
    </div>
  );
}

// ─── HIGH CONTRAST & SUPER READABLE STYLES ──────────────────────────
const styles = {
  container: {
    backgroundColor: '#FFFFFF',
    borderRadius: '12px',
    padding: '20px',
    border: '2px solid #E2E8F0',
    overflow: 'hidden',
    width: '100%',
    boxSizing: 'border-box',
  },

  // Tabs Container
  tabsContainer: {
    marginBottom: '20px',
    borderBottom: '2px solid #E2E8F0',
    paddingBottom: '12px',
  },

  tabs: {
    display: 'flex',
    gap: '6px',
    flexWrap: 'wrap',
    overflowX: 'auto',
    paddingBottom: '6px',
  },

  tabButton: {
    padding: '10px 16px',
    borderRadius: '8px',
    border: '2px solid',
    backgroundColor: '#FFFFFF',
    fontSize: '14px',
    color: '#0F172A',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    whiteSpace: 'nowrap',
    transition: 'all 0.2s ease',
    fontWeight: '600',
  },

  activeTabButton: {
    backgroundColor: '#1E40AF',
    color: '#FFFFFF',
    borderColor: '#1E40AF',
    fontWeight: '700',
  },

  tabIcon: {
    fontSize: '16px',
  },

  tabCount: {
    fontSize: '12px',
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    padding: '3px 8px',
    borderRadius: '12px',
    marginLeft: '6px',
    fontWeight: '700',
  },

  // Controls Header
  controlsHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '16px',
    flexWrap: 'wrap',
    gap: '16px',
  },

  searchBox: {
    display: 'flex',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: '10px',
    padding: '10px 16px',
    border: '2px solid #E2E8F0',
    flex: 1,
    minWidth: '300px',
    boxSizing: 'border-box',
    boxShadow: '0 2px 4px rgba(0, 0, 0, 0.05)',
  },

  searchInput: {
    border: 'none',
    outline: 'none',
    flex: 1,
    fontSize: '16px',
    color: '#0F172A',
    backgroundColor: 'transparent',
    minWidth: '200px',
    width: '100%',
    fontWeight: '500',
  },

  searchIcon: {
    color: '#475569',
    fontSize: '18px',
    marginLeft: '8px',
    flexShrink: 0,
  },

  filterRow: {
    display: 'flex',
    gap: '12px',
    flexWrap: 'wrap',
  },

  filterSelect: {
    padding: '10px 14px',
    borderRadius: '8px',
    border: '2px solid #E2E8F0',
    fontSize: '14px',
    color: '#0F172A',
    backgroundColor: '#FFFFFF',
    minWidth: '140px',
    maxWidth: '200px',
    boxSizing: 'border-box',
    fontWeight: '500',
    boxShadow: '0 2px 4px rgba(0, 0, 0, 0.05)',
  },

  // Sort Header
  sortHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '16px',
    paddingBottom: '12px',
    borderBottom: '2px solid #F1F5F9',
    flexWrap: 'wrap',
    gap: '12px',
  },

  sortButtons: {
    display: 'flex',
    gap: '8px',
    flexWrap: 'wrap',
  },

  sortButton: {
    padding: '8px 14px',
    borderRadius: '8px',
    border: '2px solid #E2E8F0',
    backgroundColor: '#FFFFFF',
    fontSize: '14px',
    color: '#0F172A',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    whiteSpace: 'nowrap',
    fontWeight: '600',
    boxShadow: '0 2px 4px rgba(0, 0, 0, 0.05)',
  },

  resultsCount: {
    fontSize: '15px',
    color: '#475569',
    fontWeight: '600',
    whiteSpace: 'nowrap',
  },

  // Table Wrapper
  tableWrapper: {
    width: '100%',
    overflow: 'hidden',
  },

  tableHeader: {
    display: 'grid',
    gridTemplateColumns: 'minmax(50px, 60px) minmax(160px, 2fr) minmax(120px, 140px) minmax(100px, 120px) minmax(120px, 140px) minmax(100px, 120px) minmax(70px, 80px) minmax(100px, 120px) 120px',
    gap: '12px',
    padding: '12px 0',
    borderBottom: '3px solid #E2E8F0',
    fontSize: '13px',
    fontWeight: '700',
    color: '#0F172A',
    textTransform: 'uppercase',
    letterSpacing: '0.8px',
    backgroundColor: '#F8FAFC',
    borderRadius: '8px',
    marginBottom: '8px',
  },

  tableHeaderCell: {
    padding: '0 8px',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },

  tableContainer: {
    maxHeight: '600px',
    overflowY: 'auto',
    width: '100%',
  },

  // Lead Row
  leadRow: {
    borderBottom: '2px solid #F1F5F9',
    padding: '12px 0',
    backgroundColor: '#FFFFFF',
    marginBottom: '8px',
  },

  cancelledLeadRow: {
    borderBottom: '2px solid #FECACA',
    backgroundColor: '#FEF2F2',
    padding: '12px 0',
  },

  mainRow: {
    display: 'grid',
    gridTemplateColumns: 'minmax(50px, 60px) minmax(160px, 2fr) minmax(120px, 140px) minmax(100px, 120px) minmax(120px, 140px) minmax(100px, 120px) minmax(70px, 80px) minmax(100px, 120px) 120px',
    gap: '12px',
    alignItems: 'center',
    width: '100%',
  },

  tableCell: {
    padding: '0 8px',
    minWidth: 0,
  },

  sequenceCell: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },

  sequence: {
    fontSize: '14px',
    fontWeight: '700',
    color: '#0F172A',
    backgroundColor: '#F1F5F9',
    padding: '4px 10px',
    borderRadius: '12px',
    whiteSpace: 'nowrap',
  },

  healthDot: {
    width: '10px',
    height: '10px',
    borderRadius: '50%',
    flexShrink: 0,
  },

  nameCell: {
    minWidth: 0,
    overflow: 'hidden',
  },

  name: {
    fontSize: '16px',
    fontWeight: '700',
    color: '#0F172A',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    marginBottom: '4px',
  },

  newBadge: {
    fontSize: '11px',
    fontWeight: '800',
    color: '#FFFFFF',
    backgroundColor: '#065F46',
    padding: '2px 6px',
    borderRadius: '6px',
    textTransform: 'uppercase',
    letterSpacing: '0.8px',
  },

  phone: {
    fontSize: '14px',
    color: '#475569',
    fontFamily: 'monospace',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    fontWeight: '600',
  },

  typeCell: {
    minWidth: 0,
    overflow: 'hidden',
  },

  queryType: {
    fontSize: '14px',
    fontWeight: '700',
    color: '#0F172A',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    marginBottom: '4px',
  },

  brand: {
    fontSize: '13px',
    color: '#475569',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    fontWeight: '500',
  },

  ownerCell: {
    minWidth: 0,
    overflow: 'hidden',
  },

  owner: {
    fontSize: '14px',
    color: '#0F172A',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    fontWeight: '600',
  },

  // Created Date Cell
  createdCell: {
    minWidth: 0,
    overflow: 'hidden',
  },

  createdDate: {
    fontSize: '14px',
    fontWeight: '600',
    color: '#0F172A',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    marginBottom: '2px',
  },

  createdTime: {
    fontSize: '13px',
    color: '#64748B',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },

  newCreatedTime: {
    color: '#065F46',
    fontWeight: '700',
  },

  timeAgo: {
    fontSize: '12px',
    color: '#065F46',
    backgroundColor: '#D1FAE5',
    padding: '3px 8px',
    borderRadius: '6px',
    marginTop: '4px',
    whiteSpace: 'nowrap',
    display: 'inline-block',
    fontWeight: '600',
  },

  statusCell: {
    minWidth: 0,
    position: 'relative',
  },

  statusBadge: {
    padding: '8px 12px',
    borderRadius: '8px',
    border: '2px solid',
    fontSize: '13px',
    fontWeight: '700',
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },

  statusIcon: {
    fontSize: '14px',
  },

  statusText: {
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },

  statusSelect: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    opacity: 0,
    cursor: 'pointer',
    zIndex: 1,
  },

  cancelledStatusSelect: {
    backgroundColor: '#FEF2F2',
    color: '#B91C1C',
    borderColor: '#B91C1C',
  },

  scoreCell: {
    minWidth: 0,
  },

  score: {
    fontSize: '14px',
    fontWeight: '700',
    padding: '6px 10px',
    borderRadius: '12px',
    textAlign: 'center',
    whiteSpace: 'nowrap',
  },

  cancelledScore: {
    color: '#B91C1C',
    backgroundColor: '#FEE2E2',
  },

  followUpCell: {
    minWidth: 0,
    overflow: 'hidden',
  },

  followUp: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    flexWrap: 'wrap',
  },

  followUpDate: {
    fontSize: '14px',
    color: '#0F172A',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    fontWeight: '600',
  },

  daysBadge: {
    fontSize: '12px',
    fontWeight: '700',
    padding: '4px 8px',
    borderRadius: '6px',
    whiteSpace: 'nowrap',
    flexShrink: 0,
  },

  noFollowUp: {
    fontSize: '14px',
    color: '#94A3B8',
    fontStyle: 'italic',
    fontWeight: '500',
  },

  actionButtons: {
    display: 'flex',
    gap: '6px',
    justifyContent: 'flex-end',
  },

  iconButton: {
    backgroundColor: '#F1F5F9',
    color: '#0F172A',
    border: 'none',
    borderRadius: '8px',
    width: '36px',
    height: '36px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    fontSize: '16px',
    flexShrink: 0,
    transition: 'all 0.2s ease',
    fontWeight: '600',
    border: '2px solid #E2E8F0',
  },

  // Expanded Section
  expandedSection: {
    marginTop: '16px',
    paddingTop: '16px',
    borderTop: '2px dashed #E2E8F0',
    animation: 'slideDown 0.2s ease',
    gridColumn: '1 / -1',
    backgroundColor: '#F8FAFC',
    borderRadius: '10px',
    padding: '16px',
  },

  creationInfo: {
    backgroundColor: '#FFFFFF',
    padding: '12px 16px',
    borderRadius: '8px',
    marginBottom: '12px',
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    border: '2px solid #E2E8F0',
  },

  creationLabel: {
    fontSize: '14px',
    fontWeight: '700',
    color: '#0F172A',
    whiteSpace: 'nowrap',
  },

  creationValue: {
    fontSize: '14px',
    color: '#0F172A',
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    flexWrap: 'wrap',
    fontWeight: '600',
  },

  creationDate: {
    fontWeight: '700',
  },

  creationTime: {
    color: '#475569',
  },

  creationSeparator: {
    color: '#CBD5E1',
    fontSize: '14px',
    fontWeight: '700',
  },

  creationNew: {
    fontSize: '14px',
    color: '#065F46',
    fontWeight: '700',
    backgroundColor: '#D1FAE5',
    padding: '4px 10px',
    borderRadius: '6px',
  },

  suggestion: {
    backgroundColor: '#ECFEFF',
    color: '#0F766E',
    padding: '12px 16px',
    borderRadius: '8px',
    fontSize: '14px',
    fontWeight: '600',
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    marginBottom: '12px',
    border: '2px solid #A5F3FC',
  },

  suggestionIcon: {
    fontSize: '16px',
    flexShrink: 0,
  },

  suggestionText: {
    flex: 1,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    fontWeight: '700',
  },

  commentInputRow: {
    marginBottom: '12px',
  },

  commentTextarea: {
    width: '100%',
    padding: '12px',
    borderRadius: '8px',
    border: '2px solid #E2E8F0',
    backgroundColor: '#FFFFFF',
    fontSize: '14px',
    color: '#0F172A',
    resize: 'vertical',
    minHeight: '70px',
    marginBottom: '10px',
    boxSizing: 'border-box',
    fontWeight: '500',
    lineHeight: '1.5',
  },

  commentActions: {
    display: 'flex',
    gap: '10px',
    justifyContent: 'flex-end',
  },

  smallButton: {
    padding: '10px 18px',
    borderRadius: '8px',
    border: '2px solid #E2E8F0',
    fontSize: '14px',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    transition: 'all 0.2s ease',
    fontWeight: '600',
  },

  commentsPreview: {
    marginBottom: '12px',
  },

  commentsHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '8px',
  },

  commentsTitle: {
    fontSize: '14px',
    fontWeight: '700',
    color: '#0F172A',
  },

  commentsCount: {
    fontSize: '13px',
    color: '#64748B',
    backgroundColor: '#F1F5F9',
    padding: '4px 8px',
    borderRadius: '6px',
    fontWeight: '600',
  },

  commentList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },

  commentItem: {
    backgroundColor: '#FFFFFF',
    padding: '12px',
    borderRadius: '8px',
    border: '2px solid #E2E8F0',
  },

  commentText: {
    fontSize: '14px',
    color: '#0F172A',
    marginBottom: '6px',
    wordBreak: 'break-word',
    lineHeight: '1.5',
    fontWeight: '500',
  },

  commentDate: {
    fontSize: '13px',
    color: '#64748B',
    fontWeight: '600',
  },

  advancedActions: {
    display: 'flex',
    gap: '12px',
    alignItems: 'center',
    flexWrap: 'wrap',
  },

  followUpSetter: {
    position: 'relative',
  },

  setFollowUpBtn: {
    padding: '10px 16px',
    borderRadius: '8px',
    border: '2px solid #E2E8F0',
    backgroundColor: '#F1F5F9',
    fontSize: '14px',
    color: '#0F172A',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    whiteSpace: 'nowrap',
    fontWeight: '600',
  },

  followUpPicker: {
    position: 'absolute',
    top: '100%',
    left: 0,
    backgroundColor: '#FFFFFF',
    borderRadius: '10px',
    padding: '16px',
    border: '2px solid #E2E8F0',
    boxShadow: '0 8px 30px rgba(0, 0, 0, 0.15)',
    zIndex: 100,
    minWidth: '280px',
  },

  quickOptions: {
    display: 'flex',
    gap: '8px',
    marginBottom: '12px',
  },

  quickOption: {
    flex: 1,
    padding: '10px',
    borderRadius: '8px',
    border: '2px solid #E2E8F0',
    backgroundColor: '#F8FAFC',
    fontSize: '14px',
    color: '#0F172A',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    fontWeight: '600',
  },

  customPicker: {
    display: 'flex',
    gap: '8px',
    marginBottom: '12px',
  },

  dateInput: {
    flex: 1,
    padding: '10px',
    borderRadius: '8px',
    border: '2px solid #E2E8F0',
    fontSize: '14px',
    minWidth: 0,
    fontWeight: '500',
  },

  timeInput: {
    width: '100px',
    padding: '10px',
    borderRadius: '8px',
    border: '2px solid #E2E8F0',
    fontSize: '14px',
    fontWeight: '500',
  },

  saveBtn: {
    padding: '10px 16px',
    borderRadius: '8px',
    border: 'none',
    backgroundColor: '#1D4ED8',
    color: '#FFFFFF',
    fontSize: '14px',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    fontWeight: '600',
  },

  cancelBtn: {
    width: '100%',
    padding: '10px',
    borderRadius: '8px',
    border: '2px solid #E2E8F0',
    backgroundColor: '#F1F5F9',
    fontSize: '14px',
    color: '#475569',
    cursor: 'pointer',
    fontWeight: '600',
  },

  deleteBtn: {
    padding: '10px 16px',
    borderRadius: '8px',
    border: '2px solid #FECACA',
    backgroundColor: '#FEE2E2',
    fontSize: '14px',
    color: '#B91C1C',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    whiteSpace: 'nowrap',
    fontWeight: '600',
  },

  // Pagination Styles
  paginationContainer: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: '20px',
    paddingTop: '16px',
    borderTop: '2px solid #E2E8F0',
    flexWrap: 'wrap',
    gap: '16px',
  },

  paginationInfo: {
    fontSize: '14px',
    color: '#475569',
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    fontWeight: '600',
  },

  paginationLabel: {
    color: '#64748B',
  },

  paginationCurrent: {
    backgroundColor: '#1D4ED8',
    color: '#FFFFFF',
    padding: '4px 10px',
    borderRadius: '8px',
    fontWeight: '700',
    fontSize: '15px',
  },

  paginationTotal: {
    color: '#0F172A',
    fontWeight: '700',
    fontSize: '15px',
  },

  paginationDivider: {
    fontSize: '12px',
    color: '#CBD5E1',
    fontWeight: '700',
  },

  paginationControls: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    flexWrap: 'wrap',
  },

  paginationNumbers: {
    display: 'flex',
    gap: '6px',
    alignItems: 'center',
  },

  paginationButton: {
    padding: '10px 18px',
    borderRadius: '8px',
    border: '2px solid #E2E8F0',
    backgroundColor: '#FFFFFF',
    fontSize: '14px',
    color: '#0F172A',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    whiteSpace: 'nowrap',
    fontWeight: '600',
  },

  paginationNavButton: {
    minWidth: '100px',
  },

  paginationNumberButton: {
    minWidth: '44px',
    height: '44px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },

  paginationButtonActive: {
    backgroundColor: '#1D4ED8',
    color: '#FFFFFF',
    borderColor: '#1D4ED8',
    fontWeight: '700',
  },

  paginationButtonDisabled: {
    backgroundColor: '#F1F5F9',
    color: '#CBD5E1',
    cursor: 'not-allowed',
    borderColor: '#E2E8F0',
    fontWeight: '500',
  },

  paginationDots: {
    padding: '0 12px',
    fontSize: '14px',
    color: '#94A3B8',
    fontWeight: '700',
  },

  paginationJump: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
  },

  paginationJumpText: {
    fontSize: '14px',
    color: '#64748B',
    fontWeight: '600',
  },

  paginationInput: {
    width: '80px',
    padding: '10px 12px',
    borderRadius: '8px',
    border: '2px solid #E2E8F0',
    fontSize: '14px',
    color: '#0F172A',
    textAlign: 'center',
    fontWeight: '600',
  },

  // Empty State
  emptyState: {
    textAlign: 'center',
    padding: '60px 40px',
    backgroundColor: '#F8FAFC',
    borderRadius: '12px',
    border: '2px dashed #E2E8F0',
  },

  emptyIcon: {
    fontSize: '48px',
    marginBottom: '16px',
    opacity: 0.4,
  },

  emptyTitle: {
    fontSize: '20px',
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: '8px',
  },

  emptyDescription: {
    fontSize: '16px',
    color: '#64748B',
    fontWeight: '500',
  },
};

// Add CSS animation and responsive styles
if (typeof document !== 'undefined') {
  const styleSheet = document.createElement('style');
  styleSheet.textContent = `
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

    /* High contrast and accessibility improvements */
    * {
      -webkit-font-smoothing: antialiased;
      -moz-osx-font-smoothing: grayscale;
    }

    /* Improve text rendering */
    .table-header,
    .main-row,
    .lead-row {
      text-rendering: optimizeLegibility;
    }

    /* Ensure minimum contrast ratio */
    .status-badge,
    .tab-button,
    .sort-button,
    .pagination-button {
      color-scheme: light dark;
      forced-color-adjust: none;
    }

    /* High contrast mode support */
    @media (prefers-contrast: high) {
      .container {
        border-color: #000000 !important;
      }
      
      .table-header {
        background-color: #000000 !important;
        color: #FFFFFF !important;
      }
      
      .status-badge {
        border-width: 3px !important;
      }
      
      .icon-button {
        border-width: 2px !important;
        border-color: #000000 !important;
      }
    }

    /* Improve focus visibility for accessibility */
    button:focus-visible,
    input:focus-visible,
    select:focus-visible,
    textarea:focus-visible {
      outline: 3px solid #1D4ED8 !important;
      outline-offset: 2px !important;
      border-color: #1D4ED8 !important;
      box-shadow: 0 0 0 3px rgba(29, 78, 216, 0.2) !important;
    }

    /* Hover effects with high contrast */
    .icon-button:hover {
      background-color: #E2E8F0 !important;
      border-color: #94A3B8 !important;
      transform: translateY(-1px);
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1) !important;
    }
    
    .tab-button:hover:not(.active-tab-button) {
      background-color: #F1F5F9 !important;
      border-color: #94A3B8 !important;
      transform: translateY(-1px);
    }

    /* Status badge hover effect */
    .status-badge:hover {
      opacity: 0.95;
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1) !important;
    }

    /* Pagination button hover effects */
    .pagination-button:not(.pagination-button-disabled):hover {
      background-color: #F1F5F9 !important;
      border-color: #94A3B8 !important;
      transform: translateY(-1px);
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1) !important;
    }
    
    .pagination-button-active:hover {
      background-color: #1E40AF !important;
      border-color: #1E40AF !important;
    }

    /* Responsive adjustments for zoom levels */
    @media (max-width: 1600px) {
      .table-header,
      .main-row {
        grid-template-columns: minmax(45px, 55px) minmax(140px, 2fr) minmax(110px, 130px) minmax(90px, 110px) minmax(110px, 130px) minmax(90px, 110px) minmax(65px, 75px) minmax(90px, 110px) 110px !important;
        gap: 10px !important;
      }
      
      .table-header-cell,
      .table-cell {
        font-size: 12px !important;
      }
    }

    @media (max-width: 1400px) {
      .table-header,
      .main-row {
        grid-template-columns: minmax(40px, 50px) minmax(120px, 2fr) minmax(100px, 120px) minmax(80px, 100px) minmax(100px, 120px) minmax(80px, 100px) minmax(60px, 70px) minmax(80px, 100px) 100px !important;
        gap: 8px !important;
      }
      
      .tab-button {
        font-size: 13px !important;
        padding: 8px 14px !important;
      }
      
      .filter-select {
        font-size: 13px !important;
        padding: 8px 12px !important;
      }
      
      .sort-button {
        font-size: 13px !important;
        padding: 7px 12px !important;
      }
    }

    @media (max-width: 1200px) {
      .table-header,
      .main-row {
        grid-template-columns: minmax(35px, 45px) minmax(100px, 2fr) minmax(90px, 110px) minmax(70px, 90px) minmax(90px, 110px) minmax(70px, 90px) minmax(55px, 65px) minmax(70px, 90px) 90px !important;
        gap: 6px !important;
      }
      
      .filter-select {
        min-width: 120px !important;
        max-width: 160px !important;
        font-size: 12px !important;
        padding: 7px 10px !important;
      }
      
      .sort-button {
        font-size: 12px !important;
        padding: 6px 10px !important;
      }
      
      .tab-button {
        font-size: 12px !important;
        padding: 7px 12px !important;
      }
      
      .name,
      .query-type,
      .owner,
      .follow-up-date,
      .created-date,
      .phone,
      .brand {
        font-size: 13px !important;
      }
      
      .status-badge {
        font-size: 12px !important;
        padding: 6px 10px !important;
      }
      
      .score {
        font-size: 13px !important;
        padding: 5px 8px !important;
      }
      
      .icon-button {
        width: 32px !important;
        height: 32px !important;
        font-size: 14px !important;
      }
      
      .pagination-container {
        flex-direction: column;
        align-items: stretch;
        gap: 20px !important;
      }
      
      .pagination-controls {
        order: -1;
        justify-content: center;
      }
      
      .pagination-info {
        justify-content: center;
        flex-wrap: wrap;
        gap: 8px !important;
      }
      
      .pagination-jump {
        justify-content: center;
      }
    }

    @media (max-width: 1024px) {
      .controls-header {
        flex-direction: column;
        align-items: stretch;
        gap: 12px !important;
      }
      
      .search-box {
        width: 100%;
        min-width: auto !important;
      }
      
      .filter-row {
        width: 100%;
        justify-content: flex-start;
      }
      
      .table-header,
      .main-row {
        grid-template-columns: minmax(30px, 40px) minmax(80px, 1fr) minmax(80px, 100px) minmax(60px, 80px) minmax(80px, 100px) minmax(60px, 80px) minmax(50px, 60px) minmax(60px, 80px) 80px !important;
        gap: 4px !important;
      }
      
      .table-header-cell,
      .table-cell {
        font-size: 11px !important;
        padding: 0 4px !important;
      }
      
      .name,
      .query-type,
      .owner,
      .follow-up-date,
      .created-date {
        font-size: 12px !important;
      }
      
      .phone,
      .brand {
        font-size: 11px !important;
      }
      
      .tabs {
        overflow-x: auto;
        padding-bottom: 8px;
      }
      
      .status-badge {
        font-size: 11px !important;
        padding: 5px 8px !important;
      }
      
      .created-date,
      .created-time {
        font-size: 11px !important;
      }
      
      .suggestion {
        font-size: 12px !important;
        padding: 8px 12px !important;
      }
      
      .creation-info {
        flex-direction: column;
        align-items: flex-start;
        gap: 8px !important;
      }
      
      .creation-value {
        gap: 6px !important;
      }
      
      .pagination-number-button {
        min-width: 36px !important;
        height: 36px !important;
        font-size: 12px !important;
        padding: 6px 8px !important;
      }
      
      .pagination-nav-button {
        min-width: 80px !important;
        font-size: 12px !important;
      }
      
      .pagination-input {
        width: 60px !important;
        font-size: 12px !important;
      }
      
      .comment-textarea {
        font-size: 12px !important;
      }
      
      .small-button {
        font-size: 12px !important;
        padding: 8px 14px !important;
      }
    }

    /* Prevent text size inflation on zoom */
    html {
      -webkit-text-size-adjust: 100%;
      text-size-adjust: 100%;
    }

    /* Ensure proper overflow handling */
    .table-wrapper {
      -webkit-overflow-scrolling: touch;
    }

    /* Improve touch targets on mobile/zoomed */
    .icon-button {
      min-width: 36px;
      min-height: 36px;
    }

    .small-button {
      min-height: 40px;
    }
    
    .tab-button {
      min-height: 40px;
    }
    
    .pagination-button {
      min-height: 44px;
    }
    
    /* Smooth scrolling */
    .table-container {
      scroll-behavior: smooth;
    }

    /* Print styles for better readability when printing */
    @media print {
      .container {
        border: none !important;
        box-shadow: none !important;
      }
      
      .controls-header,
      .pagination-container,
      .action-buttons {
        display: none !important;
      }
      
      .lead-row {
        break-inside: avoid;
        border: 1px solid #000000 !important;
      }
      
      .table-header {
        background-color: #000000 !important;
        color: #FFFFFF !important;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
      
      .status-badge {
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
    }

    /* Dark mode support */
    @media (prefers-color-scheme: dark) {
      .container {
        background-color: #1E293B !important;
        border-color: #475569 !important;
      }
      
      .table-header {
        background-color: #0F172A !important;
        color: #F1F5F9 !important;
      }
      
      .lead-row {
        background-color: #1E293B !important;
        border-color: #475569 !important;
      }
      
      .name,
      .query-type,
      .owner,
      .follow-up-date,
      .created-date,
      .results-count {
        color: #F1F5F9 !important;
      }
      
      .phone,
      .brand,
      .created-time {
        color: #94A3B8 !important;
      }
      
      .search-input,
      .comment-textarea,
      .filter-select {
        background-color: #0F172A !important;
        color: #F1F5F9 !important;
        border-color: #475569 !important;
      }
      
      .icon-button {
        background-color: #334155 !important;
        color: #F1F5F9 !important;
        border-color: #475569 !important;
      }
    }

    /* Animation for table rows */
    @keyframes fadeIn {
      from {
        opacity: 0;
        transform: translateY(10px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }

    .lead-row {
      animation: fadeIn 0.3s ease-out;
    }

    /* Stagger animation for rows */
    .lead-row:nth-child(1) { animation-delay: 0.05s; }
    .lead-row:nth-child(2) { animation-delay: 0.1s; }
    .lead-row:nth-child(3) { animation-delay: 0.15s; }
    .lead-row:nth-child(4) { animation-delay: 0.2s; }
    .lead-row:nth-child(5) { animation-delay: 0.25s; }
    .lead-row:nth-child(n+6) { animation-delay: 0.3s; }
  `;
  document.head.appendChild(styleSheet);
}