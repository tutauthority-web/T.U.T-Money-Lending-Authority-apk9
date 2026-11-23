import React, { useState, useEffect } from 'react';
import { 
  collection, 
  getDocs, 
  getDoc,
  addDoc, 
  updateDoc, 
  setDoc,
  doc, 
  onSnapshot, 
  query, 
  orderBy,
  where,
  limit,
  deleteDoc
} from 'firebase/firestore';
import { db } from '../firebase';
import { Employee, SupportTicket, WorkforceReport, AgentReportedIssue } from '../types/workforce';
import { generateHumanEmployeeResponse } from '../utils/workforceKnowledge';
import { TWO_CORE_AI_AGENTS } from './WorkforceSupportWidget';
import { 
  Users, 
  Sparkles, 
  FileText, 
  CheckCircle, 
  Clock, 
  AlertCircle, 
  MessageSquare, 
  TrendingUp, 
  ThumbsUp, 
  Sliders, 
  Calendar, 
  Activity, 
  Settings, 
  Search, 
  Filter, 
  ChevronRight, 
  Loader2, 
  Check, 
  Eye, 
  RefreshCw, 
  Send, 
  Compass, 
  Maximize2, 
  Minimize2, 
  Download, 
  BookOpen, 
  Trash2, 
  Plus, 
  FileJson, 
  UserCheck, 
  Smile, 
  ShieldAlert, 
  ArrowLeft, 
  LogOut,
  ShieldCheck,
  AlertTriangle,
  ClipboardList,
  CheckCircle2,
  Copy,
  Zap,
  BarChart3,
  Flame,
  SlidersHorizontal
} from 'lucide-react';

interface WorkforceManagementProps {
  systemStats: {
    totalUsers: number;
    totalLoans: number;
    totalDeposits: number;
    remainingDebt: number;
    pendingMembersCount: number;
    pendingTransactionsCount: number;
  };
  recentTransactions?: any[];
  reserveSummary?: {
    availableReserve?: number;
    targetReserve?: number;
  };
  currentUser?: {
    uid: string;
    email?: string;
    name: string;
    nid: string;
    status: string;
    totalLoan: number;
    totalDeposit: number;
    remainingDebt: number;
    borrowingLimit?: number;
    subscriptionTier?: string | null;
  };
  isAdmin?: boolean;
}

export const WorkforceManagement: React.FC<WorkforceManagementProps> = ({ 
  systemStats, 
  recentTransactions = [],
  reserveSummary,
  currentUser, 
  isAdmin = true 
}) => {
  // Core AI Agents (Exactly 2: 1 Male, 1 Female)
  const [employees, setEmployees] = useState<Employee[]>(TWO_CORE_AI_AGENTS);
  const [issues, setIssues] = useState<AgentReportedIssue[]>([]);
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Navigation Tabs
  const [activeTab, setActiveTab] = useState<'monitoring' | 'issues_tracker' | 'admin_chat' | 'reports'>('monitoring');

  // Admin Executive Chat State
  const [selectedAgentForChat, setSelectedAgentForChat] = useState<Employee>(TWO_CORE_AI_AGENTS[0]);
  const [adminChatHistory, setAdminChatHistory] = useState<any[]>([]);
  const [adminInput, setAdminInput] = useState('');
  const [isAdminTyping, setIsAdminTyping] = useState(false);

  // Issues Filter & Search
  const [issueSearch, setIssueSearch] = useState('');
  const [issueStatusFilter, setIssueStatusFilter] = useState<'all' | 'Open' | 'In Progress' | 'Resolved'>('all');
  const [issuePriorityFilter, setIssuePriorityFilter] = useState<'all' | 'Urgent' | 'High' | 'Medium' | 'Low'>('all');
  const [issueAgentFilter, setIssueAgentFilter] = useState<string>('all');
  const [selectedIssueDetail, setSelectedIssueDetail] = useState<AgentReportedIssue | null>(null);
  const [adminResolutionNote, setAdminResolutionNote] = useState('');
  const [isUpdatingIssue, setIsUpdatingIssue] = useState(false);

  // Conversation Inspector
  const [recentChatSessions, setRecentChatSessions] = useState<any[]>([]);
  const [selectedSessionForInspect, setSelectedSessionForInspect] = useState<any | null>(null);

  // Executive Reports State
  const [reportType, setReportType] = useState<'daily' | 'issues' | 'reserves' | 'weekly'>('daily');
  const [generatedReport, setGeneratedReport] = useState<string | null>(null);
  const [generatingReport, setGeneratingReport] = useState(false);
  const [reportCopied, setReportCopied] = useState(false);

  // AI Prompt & Persona Tuning Modal
  const [tuningAgent, setTuningAgent] = useState<Employee | null>(null);
  const [tuningPrompt, setTuningPrompt] = useState('');
  const [tuningTemp, setTuningTemp] = useState(0.3);
  const [savingTuning, setSavingTuning] = useState(false);

  // 1. Sync & Seed exactly the 2 core AI agents in Firestore
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'employees'), async (snapshot) => {
      let maleAgent: Employee = { ...TWO_CORE_AI_AGENTS[0] };
      let femaleAgent: Employee = { ...TWO_CORE_AI_AGENTS[1] };
      let foundMale = false;
      let foundFemale = false;
      const redundantDocIds: string[] = [];

      snapshot.forEach((docSnap) => {
        const data = docSnap.data() as Partial<Employee>;
        const name = (data.name || '').trim();
        const gender = data.gender;

        if (name === 'Zubair Ahmed' || gender === 'Male') {
          if (!foundMale) {
            foundMale = true;
            maleAgent = {
              ...TWO_CORE_AI_AGENTS[0],
              ...data,
              id: 'EMP-00101',
              docId: docSnap.id
            };
          } else if (isAdmin) {
            redundantDocIds.push(docSnap.id);
          }
        } else if (name === 'Nusrat Jahan' || gender === 'Female') {
          if (!foundFemale) {
            foundFemale = true;
            femaleAgent = {
              ...TWO_CORE_AI_AGENTS[1],
              ...data,
              id: 'EMP-00102',
              docId: docSnap.id
            };
          } else if (isAdmin) {
            redundantDocIds.push(docSnap.id);
          }
        } else if (isAdmin) {
          redundantDocIds.push(docSnap.id);
        }
      });

      // Always enforce exactly 2 distinct agents (Zubair Ahmed first, Nusrat Jahan second)
      setEmployees([maleAgent, femaleAgent]);
      setLoading(false);

      // Auto-seed or clean duplicates if admin
      if (isAdmin) {
        if (!foundMale) {
          try {
            await setDoc(doc(db, 'employees', 'EMP-00101'), TWO_CORE_AI_AGENTS[0], { merge: true });
          } catch (e) {
            console.warn("Could not seed male agent:", e);
          }
        }
        if (!foundFemale) {
          try {
            await setDoc(doc(db, 'employees', 'EMP-00102'), TWO_CORE_AI_AGENTS[1], { merge: true });
          } catch (e) {
            console.warn("Could not seed female agent:", e);
          }
        }

        // Clean up redundant duplicate documents if any
        if (redundantDocIds.length > 0) {
          for (const redId of redundantDocIds) {
            if (redId !== 'EMP-00101' && redId !== 'EMP-00102') {
              try {
                await deleteDoc(doc(db, 'employees', redId));
              } catch (e) {
                console.warn(`Could not clean duplicate employee doc ${redId}:`, e);
              }
            }
          }
        }
      }
    }, (err) => {
      console.warn("Could not listen to employees collection, using 2 core defaults:", err);
      setEmployees(TWO_CORE_AI_AGENTS);
      setLoading(false);
    });

    return () => unsub();
  }, [isAdmin]);

  // 2. Listen to Member Reported Issues (Noted down by AI Agents)
  useEffect(() => {
    const q = query(
      collection(db, 'agent_reported_issues'),
      orderBy('createdAt', 'desc')
    );

    const unsubIssues = onSnapshot(q, (snapshot) => {
      const list: AgentReportedIssue[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        list.push({ 
          ...data,
          id: data.id || docSnap.id,
          ticketId: data.ticketId || data.id || docSnap.id,
          docId: docSnap.id
        } as AgentReportedIssue);
      });
      setIssues(list);
    }, (err) => {
      console.warn("Could not load agent_reported_issues:", err);
    });

    return () => unsubIssues();
  }, []);

  // 3. Listen to Recent Member Chat Sessions for conversation inspector
  useEffect(() => {
    const q = query(
      collection(db, 'workforce_chats'),
      orderBy('updatedAt', 'desc')
    );

    const unsubChats = onSnapshot(q, (snapshot) => {
      const list: any[] = [];
      snapshot.forEach((docSnap) => {
        list.push({ id: docSnap.id, ...docSnap.data() });
      });
      setRecentChatSessions(list);
    }, (err) => {
      console.warn("Could not load workforce_chats:", err);
    });

    return () => unsubChats();
  }, []);

  // Load Admin Chat History when switching agent
  useEffect(() => {
    if (!selectedAgentForChat) return;

    const channelId = `admin_exec_${selectedAgentForChat.id}`;
    const unsub = onSnapshot(doc(db, 'workforce_p2p_chats', channelId), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setAdminChatHistory(data.messages || []);
      } else {
        // Initial executive greeting
        setAdminChatHistory([
          {
            sender: 'employee',
            senderName: selectedAgentForChat.name,
            text: `Greetings, Administrator. I am ${selectedAgentForChat.name} (${selectedAgentForChat.gender === 'Male' ? 'Senior Underwriting & Credit Officer' : 'Senior Accounts & Member Relations Specialist'}). All live financial ledgers, member queues, and reserve vaults are synchronized. How can I assist you with operational intelligence today?`,
            timestamp: Date.now()
          }
        ]);
      }
    }, (err) => {
      console.warn("Using offline admin chat session:", err);
      setAdminChatHistory([
        {
          sender: 'employee',
          senderName: selectedAgentForChat.name,
          text: `Greetings, Administrator. I am ${selectedAgentForChat.name}. System operations and AI monitoring are active 24/7.`,
          timestamp: Date.now()
        }
      ]);
    });

    return () => unsub();
  }, [selectedAgentForChat]);

  // Send message in Admin Executive Chat
  const handleSendAdminMessage = async (textToSend: string) => {
    if (!textToSend.trim() || !selectedAgentForChat) return;

    const userMsg = {
      sender: 'user',
      senderName: currentUser?.name || 'Administrator',
      text: textToSend.trim(),
      timestamp: Date.now()
    };

    const newMsgs = [...adminChatHistory, userMsg];
    setAdminChatHistory(newMsgs);
    setAdminInput('');
    setIsAdminTyping(true);

    const channelId = `admin_exec_${selectedAgentForChat.id}`;

    // Prepare rich operational & ledger context for executive briefing
    const openCases = issues.filter(i => i.status !== 'Resolved');
    const liveAdminContext = {
      platformStats: systemStats,
      reserveSummary: reserveSummary || {},
      activeIssuesCount: openCases.length,
      urgentIssuesCount: openCases.filter(i => i.priority === 'Urgent').length,
      recentOpenIssues: openCases.slice(0, 8).map(i => ({
        id: i.id,
        title: i.title,
        category: i.category,
        priority: i.priority,
        member: i.userName,
        assignedOfficer: i.agentName,
        relatedTx: i.relatedTransactionId,
        diagnosis: i.agentNotes,
        recommendedAction: i.recommendedAction,
      })),
      pendingTransactionsSample: recentTransactions
        .filter((t: any) => (t.status || '').toLowerCase() === 'pending')
        .slice(0, 8)
        .map((t: any) => ({
          memoId: t.memoId || t.id,
          type: t.type,
          amount: t.amount,
          user: t.userName,
          method: t.paymentMethod,
          trxId: t.transactionId,
          date: t.date,
        })),
      currentAdministrator: currentUser?.name || 'Administrator',
      agentRole: selectedAgentForChat.position
    };

    try {
      const response = await fetch('/api/digital-workforce/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: newMsgs,
          employee: {
            id: selectedAgentForChat.id,
            name: selectedAgentForChat.name,
            gender: selectedAgentForChat.gender,
            department: selectedAgentForChat.department,
            position: selectedAgentForChat.position,
            customPrompt: selectedAgentForChat.customPrompt || '',
            temperature: selectedAgentForChat.temperature !== undefined ? selectedAgentForChat.temperature : 0.25
          },
          userContext: liveAdminContext,
          isAdmin: true
        })
      });

      const data = await response.json();
      setIsAdminTyping(false);

      const agentResponse = {
        sender: 'employee',
        senderName: selectedAgentForChat.name,
        text: data.response || "Operational review completed. System ledgers are fully aligned.",
        timestamp: Date.now()
      };

      const finalMsgs = [...newMsgs, agentResponse];
      setAdminChatHistory(finalMsgs);

      // Persist in Firestore
      try {
        await setDoc(doc(db, 'workforce_p2p_chats', channelId), {
          id: channelId,
          messages: finalMsgs,
          lastMessage: agentResponse.text,
          updatedAt: Date.now(),
          agentId: selectedAgentForChat.id,
          agentName: selectedAgentForChat.name
        }, { merge: true });
      } catch (saveErr) {
        console.warn("Admin chat saved locally:", saveErr);
      }

    } catch (err: any) {
      console.warn("Running 24/7 admin fallback:", err);
      setIsAdminTyping(false);
      const fallback = generateHumanEmployeeResponse(textToSend, liveAdminContext as any, selectedAgentForChat, true);

      const agentResponse = {
        sender: 'employee',
        senderName: selectedAgentForChat.name,
        text: fallback.response,
        timestamp: Date.now()
      };

      const finalMsgs = [...newMsgs, agentResponse];
      setAdminChatHistory(finalMsgs);
    }
  };

  // Generate Executive Operational Report
  const handleGenerateReport = async () => {
    setGeneratingReport(true);
    setGeneratedReport(null);
    setReportCopied(false);

    try {
      const response = await fetch('/api/digital-workforce/report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reportType,
          systemStats,
          reserveSummary,
          recentTransactions: recentTransactions.slice(0, 15).map((t: any) => ({
            memoId: t.memoId || t.id,
            type: t.type,
            amount: t.amount,
            status: t.status,
            method: t.paymentMethod,
            trxId: t.transactionId,
            date: t.date,
          })),
          recentIssues: issues.slice(0, 15).map(i => ({
            id: i.id,
            category: i.category,
            priority: i.priority,
            title: i.title,
            status: i.status,
            reportedBy: i.userName,
            agent: i.agentName,
            relatedTransactionId: i.relatedTransactionId,
            agentNotes: i.agentNotes,
            recommendedAction: i.recommendedAction,
            evidenceComplete: i.evidenceComplete,
          }))
        })
      });

      const data = await response.json();
      if (data.success && data.reportMarkdown) {
        setGeneratedReport(data.reportMarkdown);
      } else {
        setGeneratedReport("Failed to generate report output. Please check server logs.");
      }
    } catch (err: any) {
      console.error("Report synthesis failed:", err);
      setGeneratedReport(`Network error occurred during report synthesis: ${err.message}`);
    } finally {
      setGeneratingReport(false);
    }
  };

  // Copy Report to Clipboard
  const handleCopyReport = () => {
    if (!generatedReport) return;
    navigator.clipboard.writeText(generatedReport);
    setReportCopied(true);
    setTimeout(() => setReportCopied(false), 2000);
  };

  // Update Status of an Issue Noted by Banking Officer / AI
  const handleUpdateIssueStatus = async (
    issueId: string, 
    newStatus: 'Open' | 'In Progress' | 'Resolved',
    notes?: string
  ) => {
    setIsUpdatingIssue(true);
    try {
      const updateData: any = {
        status: newStatus,
        updatedAt: Date.now()
      };
      if (notes !== undefined) {
        updateData.adminNotes = notes;
      }

      // Optimistically update local state immediately
      setIssues(prev => prev.map(item => {
        if (item.id === issueId || item.docId === issueId || item.ticketId === issueId) {
          return {
            ...item,
            status: newStatus,
            adminNotes: notes !== undefined ? notes : item.adminNotes,
            updatedAt: Date.now()
          };
        }
        return item;
      }));

      // Update local state if viewing details
      if (selectedIssueDetail && (selectedIssueDetail.id === issueId || selectedIssueDetail.docId === issueId || selectedIssueDetail.ticketId === issueId)) {
        setSelectedIssueDetail({
          ...selectedIssueDetail,
          status: newStatus,
          adminNotes: notes !== undefined ? notes : selectedIssueDetail.adminNotes,
          updatedAt: Date.now()
        });
      }

      // Find the issue in memory to get existing data & docId
      const targetIssue = issues.find(i => 
        i.id === issueId || i.docId === issueId || i.ticketId === issueId
      );

      const targetDocId = targetIssue?.docId || issueId;
      let targetDocRef = doc(db, 'agent_reported_issues', targetDocId);
      let foundSnap = await getDoc(targetDocRef);

      // If direct doc lookup by targetDocId wasn't found, try looking up by 'id' or 'ticketId'
      if (!foundSnap.exists()) {
        try {
          const qById = query(collection(db, 'agent_reported_issues'), where('id', '==', issueId), limit(1));
          const querySnap = await getDocs(qById);
          if (!querySnap.empty) {
            targetDocRef = doc(db, 'agent_reported_issues', querySnap.docs[0].id);
            foundSnap = querySnap.docs[0];
          } else {
            const qByTicket = query(collection(db, 'agent_reported_issues'), where('ticketId', '==', issueId), limit(1));
            const queryTicketSnap = await getDocs(qByTicket);
            if (!queryTicketSnap.empty) {
              targetDocRef = doc(db, 'agent_reported_issues', queryTicketSnap.docs[0].id);
              foundSnap = queryTicketSnap.docs[0];
            }
          }
        } catch (queryErr) {
          console.warn("Could not query document fallback:", queryErr);
        }
      }

      // Using setDoc with { merge: true } guarantees it will never throw "No document to update"
      if (foundSnap.exists()) {
        await setDoc(targetDocRef, updateData, { merge: true });
      } else {
        // Create/upsert the record under issueId so it persists properly
        await setDoc(doc(db, 'agent_reported_issues', issueId), {
          id: issueId,
          ticketId: issueId,
          docId: issueId,
          title: targetIssue?.title || `Inquiry ${issueId}`,
          description: targetIssue?.description || 'Member inquiry logged through support desk',
          category: targetIssue?.category || 'Loan Issue',
          priority: targetIssue?.priority || 'Medium',
          userName: targetIssue?.userName || 'Member',
          userId: targetIssue?.userId || 'unknown',
          agentId: targetIssue?.agentId || 'EMP-00101',
          agentName: targetIssue?.agentName || 'Zubair Ahmed',
          agentGender: targetIssue?.agentGender || 'Male',
          createdAt: targetIssue?.createdAt || Date.now(),
          ...updateData
        }, { merge: true });
      }

      // Best effort update on workforce_tickets
      try {
        const ticketRef = doc(db, 'workforce_tickets', issueId);
        const ticketSnap = await getDoc(ticketRef);
        if (ticketSnap.exists()) {
          await setDoc(ticketRef, { status: newStatus, updatedAt: Date.now() }, { merge: true });
        }
      } catch (tErr) {
        // Ignore ticket sync error
      }
    } catch (err) {
      console.error("Error updating issue status:", err);
    } finally {
      setIsUpdatingIssue(false);
    }
  };

  // Toggle Agent Status (Available / Busy / Offline)
  const handleToggleAgentStatus = async (emp: Employee) => {
    const statuses: ('Available' | 'Busy' | 'Offline')[] = ['Available', 'Busy', 'Offline'];
    const nextStatus = statuses[(statuses.indexOf(emp.status) + 1) % statuses.length];

    try {
      const targetDocId = emp.docId || emp.id;
      if (targetDocId) {
        await setDoc(doc(db, 'employees', targetDocId), {
          status: nextStatus,
          lastUpdated: new Date().toISOString()
        }, { merge: true });
      }
      setEmployees(prev => prev.map(e => e.id === emp.id ? { ...e, status: nextStatus } : e));
    } catch (err) {
      console.error("Error toggling employee status:", err);
    }
  };

  // Save AI Tuning Configuration
  const handleSaveTuning = async () => {
    if (!tuningAgent) return;
    setSavingTuning(true);

    try {
      const targetDocId = tuningAgent.docId || tuningAgent.id;
      if (targetDocId) {
        await setDoc(doc(db, 'employees', targetDocId), {
          customPrompt: tuningPrompt.trim(),
          temperature: tuningTemp,
          lastUpdated: new Date().toISOString()
        }, { merge: true });
      }
      setEmployees(prev => prev.map(e => e.id === tuningAgent.id ? {
        ...e,
        customPrompt: tuningPrompt.trim(),
        temperature: tuningTemp
      } : e));
      setTuningAgent(null);
    } catch (err) {
      console.error("Error saving AI tuning:", err);
    } finally {
      setSavingTuning(false);
    }
  };

  // Export Issues to CSV for Audit Compliance
  const handleExportIssuesCSV = () => {
    if (issues.length === 0) return;

    const headers = ['Issue ID', 'Member Name', 'Member Phone', 'Category', 'Priority', 'Agent Name', 'Agent Gender', 'Title', 'Status', 'Date Reported', 'Admin Notes'];
    const rows = issues.map(i => [
      `"${i.id}"`,
      `"${i.userName || ''}"`,
      `"${i.userPhone || ''}"`,
      `"${i.category}"`,
      `"${i.priority}"`,
      `"${i.agentName}"`,
      `"${i.agentGender}"`,
      `"${(i.title || '').replace(/"/g, '""')}"`,
      `"${i.status}"`,
      `"${new Date(i.createdAt).toISOString()}"`,
      `"${(i.adminNotes || '').replace(/"/g, '""')}"`
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const link = document.createElement('a');
    link.setAttribute('href', encodeURI(csvContent));
    link.setAttribute('download', `TUT_Member_Reported_Issues_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  // Filtered Issues list
  const filteredIssues = issues.filter(i => {
    const matchesSearch = 
      (i.userName || '').toLowerCase().includes(issueSearch.toLowerCase()) ||
      (i.title || '').toLowerCase().includes(issueSearch.toLowerCase()) ||
      (i.description || '').toLowerCase().includes(issueSearch.toLowerCase()) ||
      (i.id || '').toLowerCase().includes(issueSearch.toLowerCase());
    
    const matchesStatus = issueStatusFilter === 'all' || i.status === issueStatusFilter;
    const matchesPriority = issuePriorityFilter === 'all' || i.priority === issuePriorityFilter;
    const matchesAgent = issueAgentFilter === 'all' || i.agentName === issueAgentFilter;

    return matchesSearch && matchesStatus && matchesPriority && matchesAgent;
  });

  return (
    <div className="space-y-6 text-left pb-16">
      {/* Top Banner & Quick Navigation */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-900/90 to-blue-950/40 border border-white/10 rounded-3xl p-5 sm:p-6 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-80 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />
        
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="text-[10px] font-black uppercase tracking-[0.2em] bg-blue-500/20 text-blue-400 border border-blue-500/30 px-2.5 py-0.5 rounded-full flex items-center gap-1.5">
                <ShieldCheck className="w-3 h-3 text-blue-400" />
                Operations &amp; Support Desk
              </span>
              <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                24/7 Active
              </span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
              Banking Officers &amp; Issue Operations Hub
            </h2>
            <p className="text-xs text-slate-400 max-w-2xl mt-1">
              Command console for your 2 specialized banking officers: <strong>Zubair Ahmed</strong> (Credit &amp; Underwriting) &amp; <strong>Nusrat Jahan</strong> (Treasury &amp; Member Care). Monitor live member conversations, audit structured case files, consult officers directly, and compile executive reports.
            </p>
          </div>

          {/* Quick Stats Pill */}
          <div className="flex items-center gap-3 bg-slate-950/80 border border-white/10 p-2.5 rounded-2xl shrink-0">
            <div className="px-3 py-1 text-center border-r border-white/10">
              <div className="text-base font-black text-white">{issues.length}</div>
              <div className="text-[9px] font-bold uppercase text-slate-400">Issues Noted</div>
            </div>
            <div className="px-3 py-1 text-center border-r border-white/10">
              <div className="text-base font-black text-amber-400">
                {issues.filter(i => i.status !== 'Resolved').length}
              </div>
              <div className="text-[9px] font-bold uppercase text-slate-400">Open Cases</div>
            </div>
            <div className="px-3 py-1 text-center">
              <div className="text-base font-black text-emerald-400">4.98</div>
              <div className="text-[9px] font-bold uppercase text-slate-400">Avg CSAT</div>
            </div>
          </div>
        </div>

        {/* Navigation Tabs Bar */}
        <div className="flex items-center gap-2 mt-6 border-t border-white/10 pt-4 overflow-x-auto custom-scrollbar">
          <button
            onClick={() => setActiveTab('monitoring')}
            className={`px-4 py-2 rounded-xl text-xs font-black tracking-wide flex items-center gap-2 transition-all cursor-pointer ${
              activeTab === 'monitoring'
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30'
                : 'bg-slate-950/60 text-slate-400 hover:text-white hover:bg-slate-900 border border-white/5'
            }`}
          >
            <Activity className="w-4 h-4" />
            AI Agent Monitoring (2)
          </button>

          <button
            onClick={() => setActiveTab('issues_tracker')}
            className={`px-4 py-2 rounded-xl text-xs font-black tracking-wide flex items-center gap-2 transition-all cursor-pointer relative ${
              activeTab === 'issues_tracker'
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30'
                : 'bg-slate-950/60 text-slate-400 hover:text-white hover:bg-slate-900 border border-white/5'
            }`}
          >
            <ClipboardList className="w-4 h-4 text-amber-400" />
            Member Issues Tracker
            {issues.filter(i => i.status === 'Open').length > 0 && (
              <span className="bg-amber-500 text-slate-950 text-[10px] font-black px-1.5 py-0.2 rounded-full">
                {issues.filter(i => i.status === 'Open').length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('admin_chat')}
            className={`px-4 py-2 rounded-xl text-xs font-black tracking-wide flex items-center gap-2 transition-all cursor-pointer ${
              activeTab === 'admin_chat'
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30'
                : 'bg-slate-950/60 text-slate-400 hover:text-white hover:bg-slate-900 border border-white/5'
            }`}
          >
            <MessageSquare className="w-4 h-4 text-emerald-400" />
            Admin Executive Chat
          </button>

          <button
            onClick={() => setActiveTab('reports')}
            className={`px-4 py-2 rounded-xl text-xs font-black tracking-wide flex items-center gap-2 transition-all cursor-pointer ${
              activeTab === 'reports'
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30'
                : 'bg-slate-950/60 text-slate-400 hover:text-white hover:bg-slate-900 border border-white/5'
            }`}
          >
            <FileText className="w-4 h-4 text-purple-400" />
            Executive Reports &amp; Summaries
          </button>
        </div>
      </div>

      {/* ======================================================== */}
      {/* TAB 1: AI AGENT MONITORING & PERFORMANCE */}
      {/* ======================================================== */}
      {activeTab === 'monitoring' && (
        <div className="space-y-6">
          {/* Section Subhead */}
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-black text-white flex items-center gap-2">
                <Users className="w-4 h-4 text-blue-400" />
                The 2 Dedicated AI Officers (1 Male, 1 Female)
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Trained in banking rules, dual-reserve safety, member ledgers, and automatic issue noting.
              </p>
            </div>
            <span className="text-xs font-bold text-slate-400">
              Total Agents: <strong className="text-white">2 Active</strong>
            </span>
          </div>

          {/* The 2 Core Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {employees.map((emp, idx) => (
              <div 
                key={`${emp.id || (emp.gender === 'Male' ? 'EMP-00101' : 'EMP-00102')}-${idx}`}
                className="bg-slate-900/60 border border-white/10 hover:border-blue-500/30 rounded-3xl p-5 shadow-xl transition-all relative flex flex-col justify-between"
              >
                <div>
                  {/* Top Bar with Desk Role and Status */}
                  <div className="flex items-center justify-between mb-4">
                    <span className={`text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full border flex items-center gap-1.5 ${
                      emp.gender === 'Male'
                        ? 'bg-blue-500/20 text-blue-300 border-blue-500/30'
                        : 'bg-pink-500/20 text-pink-300 border-pink-500/30'
                    }`}>
                      {emp.id === 'EMP-00101' ? 'Credit & Underwriting' : 'Treasury & Member Care'}
                    </span>

                    <button
                      onClick={() => handleToggleAgentStatus(emp)}
                      className={`text-[9px] font-black uppercase px-2.5 py-0.5 rounded-full border flex items-center gap-1.5 cursor-pointer transition-colors ${
                        emp.status === 'Available'
                          ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/30'
                          : 'bg-amber-500/20 text-amber-400 border-amber-500/30 hover:bg-amber-500/30'
                      }`}
                      title="Click to toggle status"
                    >
                      <span className={`w-1.5 h-1.5 rounded-full ${emp.status === 'Available' ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`} />
                      {emp.status} • 24/7 Live
                    </button>
                  </div>

                  {/* Profile Header */}
                  <div className="flex items-start gap-4">
                    <div className="relative shrink-0">
                      <img 
                        src={emp.photoUrl} 
                        alt={emp.name} 
                        className="w-16 h-16 rounded-2xl object-cover border-2 border-white/10 shadow-lg"
                        referrerPolicy="no-referrer"
                      />
                      <span className="absolute -bottom-1 -right-1 bg-slate-950 p-1 rounded-full border border-white/10">
                        <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                      </span>
                    </div>

                    <div className="space-y-1">
                      <h4 className="text-base font-black text-white">{emp.name}</h4>
                      <p className="text-xs font-semibold text-blue-400">{emp.position}</p>
                      <p className="text-[11px] text-slate-400">{emp.department} Desk</p>
                    </div>
                  </div>

                  {/* Bio / Specialty */}
                  <div className="mt-3.5 p-3 bg-slate-950/60 border border-white/5 rounded-2xl text-[11px] text-slate-300 leading-relaxed">
                    {emp.bio || 'Trained banking digital officer supporting members 24/7.'}
                  </div>

                  {/* Metrics Grid */}
                  <div className="grid grid-cols-3 gap-2 mt-4">
                    <div className="bg-slate-950/50 border border-white/5 p-2 rounded-xl text-center">
                      <div className="text-[10px] text-slate-500 font-bold uppercase">SLA Speed</div>
                      <div className="text-xs font-black text-white mt-0.5">&lt; 1.1s</div>
                    </div>
                    <div className="bg-slate-950/50 border border-white/5 p-2 rounded-xl text-center">
                      <div className="text-[10px] text-slate-500 font-bold uppercase">Rating</div>
                      <div className="text-xs font-black text-amber-300 mt-0.5">⭐ {emp.customerSatisfaction}</div>
                    </div>
                    <div className="bg-slate-950/50 border border-white/5 p-2 rounded-xl text-center">
                      <div className="text-[10px] text-slate-500 font-bold uppercase">Accuracy</div>
                      <div className="text-xs font-black text-emerald-400 mt-0.5">{emp.performanceScore}%</div>
                    </div>
                  </div>

                  {/* Multi-Key Credit Saver Badge */}
                  <div className="mt-3.5 py-1.5 px-3 rounded-xl bg-slate-950/80 border border-white/5 flex items-center justify-between text-[11px]">
                    <span className="text-slate-400 flex items-center gap-1.5 font-medium">
                      <Zap className="w-3.5 h-3.5 text-amber-400" />
                      Dedicated API Key:
                    </span>
                    <code className="font-mono text-[10px] font-bold text-blue-400 bg-blue-950/40 px-2 py-0.5 rounded border border-blue-500/20">
                      {emp.id === 'EMP-00101' ? 'GEMINI_API_KEY_OFFICER_1' : 'GEMINI_API_KEY_OFFICER_2'}
                    </code>
                  </div>
                </div>

                {/* Card Actions */}
                <div className="mt-4 pt-3.5 border-t border-white/10 flex items-center justify-between gap-3">
                  <button
                    onClick={() => {
                      setSelectedAgentForChat(emp);
                      setActiveTab('admin_chat');
                    }}
                    className="flex-1 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs py-2 px-3 rounded-xl flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <MessageSquare className="w-3.5 h-3.5" />
                    Chat with {emp.name.split(' ')[0]}
                  </button>

                  <button
                    onClick={() => {
                      setTuningAgent(emp);
                      setTuningPrompt(emp.customPrompt || '');
                      setTuningTemp(emp.temperature !== undefined ? emp.temperature : 0.3);
                    }}
                    className="p-2 bg-slate-950 hover:bg-slate-800 border border-white/10 rounded-xl text-slate-300 hover:text-white transition-colors cursor-pointer"
                    title="Tune AI Prompt & Persona"
                  >
                    <Sliders className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Multi-Key & Credit Saving Status Card */}
          <div className="bg-gradient-to-r from-blue-950/30 via-slate-900/60 to-purple-950/30 border border-blue-500/20 rounded-3xl p-5 shadow-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3.5">
              <div className="w-10 h-10 rounded-2xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center shrink-0">
                <Zap className="w-5 h-5 text-amber-400" />
              </div>
              <div>
                <h4 className="text-sm font-black text-white flex items-center gap-2">
                  Multi-Key Credit Saving & Automatic Failover Engine
                  <span className="text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded-full">
                    Active
                  </span>
                </h4>
                <p className="text-xs text-slate-300 mt-0.5 leading-relaxed">
                  You can provide separate Gemini API keys for <strong>Zubair Ahmed</strong> (<code className="text-blue-300">GEMINI_API_KEY_OFFICER_1</code>) and <strong>Nusrat Jahan</strong> (<code className="text-pink-300">GEMINI_API_KEY_OFFICER_2</code>). Each bot uses its own credits. If a key runs out or hits rate limits, the system automatically falls over to the next key or the 24/7 banking engine with zero errors!
                </p>
              </div>
            </div>
          </div>

          {/* Conversation Inspector: Review recent member chats handled by agents */}
          <div className="bg-slate-900/60 border border-white/10 rounded-3xl p-5 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-sm font-black text-white flex items-center gap-2">
                  <Eye className="w-4 h-4 text-blue-400" />
                  Live Conversation Inspector
                </h4>
                <p className="text-xs text-slate-400">
                  Inspect real-time member chats handled by Zubair and Nusrat to verify tone, accuracy, and compliance.
                </p>
              </div>
              <span className="text-xs font-bold text-slate-400">
                {recentChatSessions.length} Sessions Logged
              </span>
            </div>

            {recentChatSessions.length === 0 ? (
              <div className="p-8 text-center bg-slate-950/40 rounded-2xl text-xs text-slate-500">
                No member conversations recorded yet. When members chat with the AI widget, sessions will stream here.
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {/* Sessions list */}
                <div className="lg:col-span-1 space-y-2 max-h-96 overflow-y-auto custom-scrollbar pr-1">
                  {recentChatSessions.map((session, idx) => (
                    <button
                      key={`${session.id || 'sess'}-${idx}`}
                      onClick={() => setSelectedSessionForInspect(session)}
                      className={`w-full text-left p-3 rounded-2xl border transition-all cursor-pointer ${
                        selectedSessionForInspect?.id === session.id
                          ? 'bg-blue-950/50 border-blue-500 text-white'
                          : 'bg-slate-950/60 border-white/5 hover:border-white/20 text-slate-300'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-white">{session.userName}</span>
                        <span className="text-[9px] text-slate-500">
                          {new Date(session.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <div className="text-[10px] text-blue-400 mt-0.5">Agent: {session.employeeName}</div>
                      <p className="text-[11px] text-slate-400 line-clamp-1 mt-1">{session.lastMessage || '...'}</p>
                    </button>
                  ))}
                </div>

                {/* Inspect window */}
                <div className="lg:col-span-2 bg-slate-950/80 border border-white/10 rounded-2xl p-4 flex flex-col justify-between h-96">
                  {selectedSessionForInspect ? (
                    <div className="flex-1 flex flex-col overflow-hidden">
                      <div className="border-b border-white/10 pb-2 mb-3 flex items-center justify-between">
                        <div>
                          <h5 className="text-xs font-bold text-white">
                            Member: {selectedSessionForInspect.userName}
                          </h5>
                          <span className="text-[10px] text-slate-400">
                            Officer Assigned: {selectedSessionForInspect.employeeName}
                          </span>
                        </div>
                        <span className="text-[10px] font-mono text-slate-500">
                          {new Date(selectedSessionForInspect.updatedAt).toLocaleString()}
                        </span>
                      </div>

                      <div className="flex-1 overflow-y-auto space-y-3 pr-2 custom-scrollbar text-xs">
                        {(selectedSessionForInspect.messages || []).map((msg: any, idx: number) => (
                          <div 
                            key={idx}
                            className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
                          >
                            <div className={`max-w-[80%] rounded-2xl p-3 ${
                              msg.sender === 'user'
                                ? 'bg-blue-600 text-white rounded-br-none'
                                : 'bg-slate-900 text-slate-200 border border-white/10 rounded-bl-none'
                            }`}>
                              <span className="block text-[9px] opacity-70 font-bold mb-1">
                                {msg.sender === 'user' ? selectedSessionForInspect.userName : selectedSessionForInspect.employeeName}
                              </span>
                              <p className="whitespace-pre-wrap">{msg.text}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-center h-full text-xs text-slate-500">
                      Select a conversation on the left to inspect full dialogue history.
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 2: MEMBER ISSUES TRACKER (NOTED DOWN BY AGENTS) */}
      {/* ======================================================== */}
      {activeTab === 'issues_tracker' && (
        <div className="space-y-6">
          {/* Header & Controls */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h3 className="text-base font-black text-white flex items-center gap-2">
                <ClipboardList className="w-5 h-5 text-amber-400" />
                Member Issues Recorded by AI Agents
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Every grievance, transaction dispute, or delay reported by a member to Zubair or Nusrat is automatically filed here.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleExportIssuesCSV}
                disabled={issues.length === 0}
                className="px-3 py-2 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-slate-300 hover:text-white border border-white/10 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                Export to CSV
              </button>
            </div>
          </div>

          {/* Search & Filters */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 bg-slate-900/60 border border-white/10 p-3.5 rounded-2xl">
            {/* Search */}
            <div className="relative">
              <Search className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
              <input
                type="text"
                placeholder="Search member, issue title..."
                value={issueSearch}
                onChange={(e) => setIssueSearch(e.target.value)}
                className="w-full bg-slate-950 border border-white/10 pl-9 pr-3 py-2 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
              />
            </div>

            {/* Filter by Status */}
            <div>
              <select
                value={issueStatusFilter}
                onChange={(e: any) => setIssueStatusFilter(e.target.value)}
                className="w-full bg-slate-950 border border-white/10 px-3 py-2 rounded-xl text-xs text-white focus:outline-none focus:border-blue-500"
              >
                <option value="all">All Statuses ({issues.length})</option>
                <option value="Open">Open ({issues.filter(i => i.status === 'Open').length})</option>
                <option value="In Progress">In Progress ({issues.filter(i => i.status === 'In Progress').length})</option>
                <option value="Resolved">Resolved ({issues.filter(i => i.status === 'Resolved').length})</option>
              </select>
            </div>

            {/* Filter by Priority */}
            <div>
              <select
                value={issuePriorityFilter}
                onChange={(e: any) => setIssuePriorityFilter(e.target.value)}
                className="w-full bg-slate-950 border border-white/10 px-3 py-2 rounded-xl text-xs text-white focus:outline-none focus:border-blue-500"
              >
                <option value="all">All Priorities</option>
                <option value="Urgent">Urgent</option>
                <option value="High">High</option>
                <option value="Medium">Medium</option>
                <option value="Low">Low</option>
              </select>
            </div>

            {/* Filter by Agent */}
            <div>
              <select
                value={issueAgentFilter}
                onChange={(e) => setIssueAgentFilter(e.target.value)}
                className="w-full bg-slate-950 border border-white/10 px-3 py-2 rounded-xl text-xs text-white focus:outline-none focus:border-blue-500"
              >
                <option value="all">All Officers</option>
                <option value="Zubair Ahmed">Zubair Ahmed (Credit Desk)</option>
                <option value="Nusrat Jahan">Nusrat Jahan (Treasury Desk)</option>
              </select>
            </div>
          </div>

          {/* Issues List Table */}
          {filteredIssues.length === 0 ? (
            <div className="p-12 text-center bg-slate-900/40 border border-white/10 rounded-3xl space-y-3">
              <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto" />
              <h4 className="text-sm font-bold text-white">No Issues Matching Filters</h4>
              <p className="text-xs text-slate-400 max-w-md mx-auto">
                No open member issues matching your query. All reports filed by members during chat will appear here.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredIssues.map((issue, idx) => (
                <div
                  key={`${issue.id || 'issue'}-${idx}`}
                  className="bg-slate-900/60 border border-white/10 hover:border-blue-500/30 rounded-2xl p-4 sm:p-5 shadow-lg transition-all space-y-3"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-mono font-bold text-blue-400 bg-blue-500/10 px-2.5 py-0.5 rounded-lg border border-blue-500/20">
                        #{issue.id}
                      </span>
                      <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-md border ${
                        issue.priority === 'Urgent' ? 'bg-red-500/20 text-red-300 border-red-500/30' :
                        issue.priority === 'High' ? 'bg-amber-500/20 text-amber-300 border-amber-500/30' :
                        'bg-slate-800 text-slate-300 border-white/10'
                      }`}>
                        {issue.priority} Priority
                      </span>
                      <span className="text-[10px] bg-slate-800 text-slate-300 px-2 py-0.5 rounded-md border border-white/5">
                        {issue.category}
                      </span>
                      {issue.relatedTransactionId && (
                        <span className="text-[10px] font-mono bg-indigo-500/15 text-indigo-300 px-2 py-0.5 rounded-md border border-indigo-500/25">
                          Ref: {issue.relatedTransactionId}
                        </span>
                      )}
                      {issue.evidenceComplete === false && (
                        <span className="text-[10px] font-semibold bg-amber-500/10 text-amber-300 px-2 py-0.5 rounded-md border border-amber-500/20">
                          Awaiting Member Info
                        </span>
                      )}
                    </div>

                    {/* Status Action */}
                    <div className="flex items-center gap-2">
                      <select
                        value={issue.status}
                        onChange={(e) => handleUpdateIssueStatus(issue.id, e.target.value as any)}
                        className={`text-xs font-bold px-3 py-1 rounded-xl border focus:outline-none cursor-pointer ${
                          issue.status === 'Resolved' ? 'bg-emerald-950/60 text-emerald-400 border-emerald-500/40' :
                          issue.status === 'In Progress' ? 'bg-blue-950/60 text-blue-400 border-blue-500/40' :
                          'bg-amber-950/60 text-amber-400 border-amber-500/40'
                        }`}
                      >
                        <option value="Open">Status: Open</option>
                        <option value="In Progress">Status: In Progress</option>
                        <option value="Resolved">Status: Resolved</option>
                      </select>
                    </div>
                  </div>

                  {/* Title & Description */}
                  <div>
                    <h4 className="text-sm font-bold text-white">{issue.title}</h4>
                    <p className="text-xs text-slate-300 mt-1 leading-relaxed bg-slate-950/40 p-3 rounded-xl border border-white/5 whitespace-pre-line">
                      {issue.description}
                    </p>
                  </div>

                  {/* Member & Agent Info */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-2 border-t border-white/5 text-[11px] text-slate-400">
                    <div>
                      Member: <strong className="text-slate-200">{issue.userName}</strong> ({issue.memberId || 'ID on file'})
                    </div>
                    <div>
                      Filing Officer: <strong className="text-blue-400">{issue.agentName}</strong>
                    </div>
                    <div className="sm:text-right">
                      Updated: {new Date(issue.updatedAt || issue.createdAt).toLocaleString()}
                    </div>
                  </div>

                  {/* Officer Diagnosis & Recommended Admin Action */}
                  {(issue.agentNotes || issue.recommendedAction || (issue.missingDetails && issue.missingDetails.length > 0)) && (
                    <div className="bg-blue-950/30 border border-blue-500/20 p-3 rounded-xl text-[11px] text-blue-100 space-y-1.5">
                      {issue.agentNotes && (
                        <div>
                          <strong className="text-blue-400 font-bold">Officer Assessment: </strong>
                          <span>{issue.agentNotes}</span>
                        </div>
                      )}
                      {issue.recommendedAction && (
                        <div>
                          <strong className="text-emerald-400 font-bold">Recommended Action: </strong>
                          <span className="text-slate-200">{issue.recommendedAction}</span>
                        </div>
                      )}
                      {issue.missingDetails && issue.missingDetails.length > 0 && issue.status !== 'Resolved' && (
                        <div className="text-amber-300">
                          <strong>Pending Member Details: </strong>
                          {issue.missingDetails.join(', ')}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Admin Resolution Note Input */}
                  <div className="pt-2 flex flex-col sm:flex-row gap-2 items-center">
                    <input
                      type="text"
                      defaultValue={issue.adminNotes || ''}
                      placeholder="Add official admin resolution note..."
                      onBlur={(e) => {
                        if (e.target.value !== issue.adminNotes) {
                          handleUpdateIssueStatus(issue.id, issue.status, e.target.value);
                        }
                      }}
                      className="flex-1 bg-slate-950 border border-white/10 px-3 py-1.5 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                    />
                    {issue.status !== 'Resolved' && (
                      <button
                        onClick={() => handleUpdateIssueStatus(issue.id, 'Resolved')}
                        className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer shrink-0"
                      >
                        Mark Resolved
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 3: ADMIN EXECUTIVE CHAT */}
      {/* ======================================================== */}
      {activeTab === 'admin_chat' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-black text-white flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-emerald-400" />
                Admin Executive Operations Console
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Direct operational briefing desk with your Credit &amp; Treasury officers grounded in live ledgers and queues.
              </p>
            </div>

            {/* Officer Selector Switcher */}
            <div className="flex items-center gap-2 bg-slate-900/90 border border-white/10 p-1.5 rounded-2xl">
              {employees.map((emp, idx) => (
                <button
                  key={`${emp.id || (emp.gender === 'Male' ? 'EMP-00101' : 'EMP-00102')}-${idx}`}
                  onClick={() => setSelectedAgentForChat(emp)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
                    selectedAgentForChat.id === emp.id
                      ? 'bg-blue-600 text-white shadow-md'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800'
                  }`}
                >
                  <img 
                    src={emp.photoUrl} 
                    alt={emp.name} 
                    className="w-4.5 h-4.5 rounded-full object-cover" 
                    referrerPolicy="no-referrer"
                  />
                  <span>{emp.name.split(' ')[0]} · {emp.id === 'EMP-00101' ? 'Credit' : 'Treasury'}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Quick Admin Inquiries */}
          <div className="flex items-center gap-2 overflow-x-auto custom-scrollbar pb-1">
            <span className="text-[10px] font-bold uppercase text-slate-500 shrink-0">Quick Briefings:</span>
            {[
              "Give me today's executive operational summary.",
              "Audit open member inquiries and missing verification details.",
              "Evaluate dual-reserve liquidity and active debt exposure.",
              "Prioritize pending bKash & Nagad verification queues.",
              "Draft an advisory announcement regarding deposit safety."
            ].map((promptText, idx) => (
              <button
                key={idx}
                onClick={() => handleSendAdminMessage(promptText)}
                className="bg-slate-900/80 hover:bg-slate-800 border border-white/10 text-[11px] font-semibold text-slate-300 hover:text-white px-3 py-1.5 rounded-xl whitespace-nowrap shrink-0 transition-colors cursor-pointer"
              >
                {promptText}
              </button>
            ))}
          </div>

          {/* Chat Container */}
          <div className="bg-slate-900/70 border border-white/10 rounded-3xl p-5 shadow-2xl flex flex-col h-[520px]">
            {/* Header of Active Officer */}
            <div className="border-b border-white/10 pb-3 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <img 
                  src={selectedAgentForChat.photoUrl} 
                  alt={selectedAgentForChat.name} 
                  className="w-10 h-10 rounded-2xl object-cover border border-white/15"
                  referrerPolicy="no-referrer"
                />
                <div>
                  <h4 className="text-sm font-black text-white flex items-center gap-2">
                    {selectedAgentForChat.name}
                    <span className="text-[10px] bg-blue-500/20 text-blue-300 px-2 py-0.5 rounded-full font-bold">
                      {selectedAgentForChat.id === 'EMP-00101' ? 'Credit & Underwriting' : 'Treasury & Member Care'}
                    </span>
                  </h4>
                  <p className="text-[11px] text-slate-400">{selectedAgentForChat.position} · Executive Desk</p>
                </div>
              </div>

              <div className="text-right">
                <span className="text-[10px] text-emerald-400 font-bold bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-lg block">
                  Live Ledger Sync
                </span>
              </div>
            </div>

            {/* Messages Scroll Area */}
            <div className="flex-1 overflow-y-auto space-y-4 py-4 pr-2 custom-scrollbar">
              {adminChatHistory.map((msg, idx) => (
                <div 
                  key={idx}
                  className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div className={`max-w-[85%] rounded-2xl p-4 text-xs leading-relaxed space-y-1.5 ${
                    msg.sender === 'user'
                      ? 'bg-blue-600 text-white rounded-br-none shadow-lg shadow-blue-600/20'
                      : 'bg-slate-950 text-slate-200 border border-white/10 rounded-bl-none shadow-xl'
                  }`}>
                    <span className="block text-[9px] opacity-70 font-black tracking-wider uppercase">
                      {msg.sender === 'user' ? (currentUser?.name || 'Administrator') : selectedAgentForChat.name}
                    </span>
                    <p className="whitespace-pre-wrap">{msg.text}</p>
                    <span className="block text-[8px] opacity-50 text-right">
                      {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                </div>
              ))}

              {isAdminTyping && (
                <div className="flex justify-start">
                  <div className="bg-slate-950 text-slate-400 border border-white/10 rounded-2xl p-3.5 text-xs flex items-center gap-2">
                    <span className="italic">Compiling executive operational response...</span>
                    <div className="flex gap-1">
                      <span className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                      <span className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                      <span className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Input Bar */}
            <div className="border-t border-white/10 pt-3 flex items-center gap-2">
              <input
                type="text"
                placeholder={`Ask ${selectedAgentForChat.name.split(' ')[0]} for summaries, issue reviews, or risk audits...`}
                value={adminInput}
                onChange={(e) => setAdminInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSendAdminMessage(adminInput);
                }}
                className="flex-1 bg-slate-950 border border-white/10 px-4 py-3 rounded-2xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
              />
              <button
                onClick={() => handleSendAdminMessage(adminInput)}
                disabled={!adminInput.trim() || isAdminTyping}
                className="w-11 h-11 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-2xl flex items-center justify-center transition-all shadow-md active:scale-95 shrink-0 cursor-pointer"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 4: EXECUTIVE REPORTS & SUMMARIES */}
      {/* ======================================================== */}
      {activeTab === 'reports' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-black text-white flex items-center gap-2">
                <FileText className="w-5 h-5 text-purple-400" />
                Executive Operational Reports Generator
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Generate audit summaries directly from live transactions, reserve solvency metrics, and reported inquiries.
              </p>
            </div>
          </div>

          {/* Report Selection Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              {
                id: 'daily',
                title: 'Daily Operations Summary',
                desc: 'Comprehensive 24h health check, loan velocity, deposit flows, and SLA.'
              },
              {
                id: 'issues',
                title: 'Member Issues & Incident Audit',
                desc: 'In-depth aggregation of issues noted down by Zubair Ahmed & Nusrat Jahan.'
              },
              {
                id: 'reserves',
                title: 'Dual Reserve & Liquidity Risk',
                desc: 'Solvency check comparing Main Reserves against segregated Deposit ring-fence.'
              },
              {
                id: 'weekly',
                title: 'Weekly Executive Briefing',
                desc: 'Board-ready report with trends, growth, risk mitigations, and actions.'
              }
            ].map((card) => (
              <button
                key={card.id}
                onClick={() => setReportType(card.id as any)}
                className={`p-4 rounded-2xl border text-left transition-all cursor-pointer ${
                  reportType === card.id
                    ? 'bg-purple-950/40 border-purple-500 text-white shadow-xl shadow-purple-950/30'
                    : 'bg-slate-900/50 border-white/5 hover:border-white/20 text-slate-300'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-black uppercase text-purple-400 tracking-wider">
                    Tier: {card.id.toUpperCase()}
                  </span>
                  {reportType === card.id && (
                    <span className="w-2 h-2 rounded-full bg-purple-400" />
                  )}
                </div>
                <h4 className="text-xs font-bold text-white">{card.title}</h4>
                <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">{card.desc}</p>
              </button>
            ))}
          </div>

          {/* Generate Button */}
          <div className="flex items-center gap-3">
            <button
              onClick={handleGenerateReport}
              disabled={generatingReport}
              className="px-5 py-3 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white font-bold text-xs rounded-2xl flex items-center gap-2 shadow-xl shadow-purple-600/20 transition-all cursor-pointer"
            >
              {generatingReport ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Compiling Executive Report...
                </>
              ) : (
                <>
                  <FileText className="w-4 h-4 text-purple-200" />
                  Compile {reportType.toUpperCase()} Report
                </>
              )}
            </button>
          </div>

          {/* Generated Report Output */}
          {generatedReport && (
            <div className="bg-slate-900/80 border border-white/10 rounded-3xl p-6 shadow-2xl space-y-4">
              <div className="flex items-center justify-between border-b border-white/10 pb-3">
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-emerald-400" />
                  <span className="text-xs font-black text-white uppercase tracking-wider">
                    {reportType.toUpperCase()} Report Generated Successfully
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={handleCopyReport}
                    className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-xs font-bold text-white rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    {reportCopied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    {reportCopied ? 'Copied' : 'Copy'}
                  </button>
                </div>
              </div>

              <div className="bg-slate-950/70 p-5 rounded-2xl border border-white/5 font-sans text-xs text-slate-200 whitespace-pre-wrap leading-relaxed max-h-[500px] overflow-y-auto custom-scrollbar">
                {generatedReport}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ======================================================== */}
      {/* TUNING MODAL (Customize Persona & Temperature) */}
      {/* ======================================================== */}
      {tuningAgent && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-white/15 rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-3">
                <img 
                  src={tuningAgent.photoUrl} 
                  alt={tuningAgent.name} 
                  className="w-10 h-10 rounded-xl object-cover" 
                  referrerPolicy="no-referrer"
                />
                <div>
                  <h4 className="text-sm font-black text-white">{tuningAgent.name} Tuning</h4>
                  <span className="text-[10px] text-slate-400">{tuningAgent.position}</span>
                </div>
              </div>
              <button 
                onClick={() => setTuningAgent(null)}
                className="w-8 h-8 rounded-full bg-slate-950 text-slate-400 hover:text-white flex items-center justify-center cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-bold text-slate-300 block mb-1">
                  Custom Persona / Operational Directives:
                </label>
                <textarea
                  rows={4}
                  value={tuningPrompt}
                  onChange={(e) => setTuningPrompt(e.target.value)}
                  placeholder="e.g. Always emphasize that member deposit reserves are ring-fenced 1:1 and never at risk..."
                  className="w-full bg-slate-950 border border-white/10 p-3 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <div className="flex justify-between text-xs font-bold text-slate-300 mb-1">
                  <span>Temperature (Precision vs Creativity):</span>
                  <span className="font-mono text-blue-400">{tuningTemp}</span>
                </div>
                <input
                  type="range"
                  min="0.1"
                  max="0.9"
                  step="0.05"
                  value={tuningTemp}
                  onChange={(e) => setTuningTemp(parseFloat(e.target.value))}
                  className="w-full cursor-pointer"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-white/10">
              <button
                onClick={() => setTuningAgent(null)}
                className="px-4 py-2 bg-slate-800 text-slate-300 hover:text-white rounded-xl text-xs font-bold cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveTuning}
                disabled={savingTuning}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold cursor-pointer flex items-center gap-1.5"
              >
                {savingTuning && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Save Directives
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
