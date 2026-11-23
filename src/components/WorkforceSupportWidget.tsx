import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  collection, 
  addDoc, 
  setDoc,
  doc, 
  onSnapshot, 
  query, 
  where, 
  orderBy, 
  limit 
} from 'firebase/firestore';
import { db } from '../firebase';
import { Employee, SupportTicket, ChatMessage, ChatSession, AgentReportedIssue } from '../types/workforce';
import { generateHumanEmployeeResponse } from '../utils/workforceKnowledge';
import { calculateComprehensiveCreditScore } from '../utils/creditScoreEngine';
import { calculateMemberLoanAllocations } from '../utils/loanAllocationEngine';
import { calculateAuthorizedRepaymentWindow } from '../utils/repaymentTermEngine';
import { 
  MessageSquare, 
  X, 
  Send, 
  ChevronRight, 
  ChevronLeft,
  Minimize2,
  Maximize2,
  AlertCircle, 
  CheckCircle2, 
  Headphones,
  ClipboardList,
  Languages,
  FileCheck2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

// Core Dedicated Banking Officers (Human Professional Profiles)
export const TWO_CORE_AI_AGENTS: Employee[] = [
  {
    id: 'EMP-00101',
    name: 'Zubair Ahmed',
    gender: 'Male',
    photoUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=400',
    department: 'Credit & Underwriting',
    position: 'Senior Credit & Verification Officer',
    joinedDate: '2024-01-15',
    status: 'Available',
    performanceScore: 99,
    employeeType: 'Human Employee',
    averageResponseTime: '< 1 min',
    customerSatisfaction: '4.98/5',
    totalChats: 1280,
    bio: 'Dedicated officer for member loan limits, repayment verifications, ledger review, and ethical lending compliance.',
    specialization: 'Loan Disbursal, Limit Reviews & Repayments'
  },
  {
    id: 'EMP-00102',
    name: 'Nusrat Jahan',
    gender: 'Female',
    photoUrl: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&q=80&w=400',
    department: 'Treasury & Member Care',
    position: 'Member Relations & Treasury Specialist',
    joinedDate: '2024-02-01',
    status: 'Available',
    performanceScore: 99,
    employeeType: 'Human Employee',
    averageResponseTime: '< 1 min',
    customerSatisfaction: '4.99/5',
    totalChats: 1450,
    bio: 'Specialist in deposit savings, segregated vault safety (1:1 protected reserves), withdrawal queries, and dispute care.',
    specialization: 'Deposit Reserves, Vault Safety & Member Care'
  }
];

interface WorkforceSupportWidgetProps {
  currentUser: {
    uid: string;
    email?: string;
    name: string;
    nid: string;
    phone?: string;
    memberId?: string;
    status: string;
    totalLoan: number;
    totalDeposit: number;
    remainingDebt: number;
    totalRepaid?: number;
    borrowingLimit?: number;
    subscriptionTier?: string | null;
    subscriptionStatus?: string | null;
    continuousSubscriptionMonths?: number;
    loansTakenThisMonth?: number;
    address?: string;
    emergencyContact?: string | {
      name?: string;
      phone?: string;
      relation?: string;
    };
  };
  transactions?: any[];
}

export const WorkforceSupportWidget: React.FC<WorkforceSupportWidgetProps> = ({ currentUser, transactions = [] }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [employees, setEmployees] = useState<Employee[]>(TWO_CORE_AI_AGENTS);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'chat' | 'issues'>('chat');
  const [myReportedIssues, setMyReportedIssues] = useState<AgentReportedIssue[]>([]);
  
  // Smart contextual launcher state
  const [isPageScrolling, setIsPageScrolling] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [isMinimized, setIsMinimized] = useState<boolean>(() => {
    const saved = localStorage.getItem('tut_desk_widget_minimized');
    if (saved === 'true') return true;
    if (saved === 'false') return false;
    return typeof window !== 'undefined' ? window.innerWidth < 768 : true;
  });

  // Language preference ('en' | 'bn') - strictly enforced in responses
  const [language, setLanguage] = useState<'en' | 'bn'>(() => {
    const saved = localStorage.getItem('tut_support_language');
    return (saved === 'bn' || saved === 'en') ? saved : 'en';
  });

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const scrollTimeoutRef = useRef<any>(null);

  // Smart Context-Aware Scroll Behavior:
  // When member scrolls the dashboard, widget smoothly dims to avoid obstructing data/buttons
  useEffect(() => {
    const handleScroll = () => {
      setIsPageScrolling(true);
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
      scrollTimeoutRef.current = setTimeout(() => {
        setIsPageScrolling(false);
      }, 1200);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', handleScroll);
      if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
    };
  }, []);

  // Save language preference
  const handleSelectLanguage = (lang: 'en' | 'bn') => {
    setLanguage(lang);
    localStorage.setItem('tut_support_language', lang);
  };

  // Compute live credit, loan allocation, repayment eligibility & ledger snapshot for expert officers
  const enrichedUserContext = useMemo(() => {
    const creditReport = calculateComprehensiveCreditScore(currentUser, transactions);
    const loanSummary = calculateMemberLoanAllocations(currentUser.uid, transactions, currentUser);
    const repaymentWindow = calculateAuthorizedRepaymentWindow(currentUser, transactions, 0);

    const pendingTransactions = transactions
      .filter((t) => (t.status || '').toLowerCase() === 'pending')
      .slice(0, 6)
      .map((t) => ({
        id: t.id,
        memoId: t.memoId || t.id,
        type: t.type,
        amount: Number(t.amount || 0),
        status: t.status,
        date: t.date,
        dueDate: t.dueDate,
        paymentMethod: t.paymentMethod || t.method,
        trxId: t.transactionId || t.trxId || t.paymentReference,
      }));

    const recentTransactions = transactions.slice(0, 10).map((t) => ({
      id: t.id,
      memoId: t.memoId || t.id,
      type: t.type,
      amount: Number(t.amount || 0),
      status: t.status,
      date: t.date,
      dueDate: t.dueDate,
      paymentMethod: t.paymentMethod || t.method,
      trxId: t.transactionId || t.trxId || t.paymentReference,
    }));

    const openIssues = myReportedIssues
      .filter((i) => i.status !== 'Resolved')
      .slice(0, 8)
      .map((i) => ({
        id: i.id,
        title: i.title,
        category: i.category,
        priority: i.priority,
        status: i.status,
        description: i.description,
        missingDetails: i.missingDetails || [],
        relatedTransactionId: i.relatedTransactionId,
      }));

    return {
      ...currentUser,
      ledgerSnapshot: {
        creditScore: creditReport.score,
        creditTier: creditReport.label,
        riskRating: creditReport.riskRating,
        utilizationPct: creditReport.utilizationPct,
        collateralRatio: creditReport.collateralRatio,
        repaymentRatio: creditReport.repaymentRatio,
        isOverdue: creditReport.isOverdue,
        overdueLoansCount: creditReport.overdueLoansCount,
        overdueLoanDetails: creditReport.overdueLoanDetails || [],
        maxRepaymentDays: repaymentWindow.maxDays,
        maxRepaymentDate: repaymentWindow.maxDateStr,
        repaymentSummary: repaymentWindow.tierSummary,
        pendingTransactions,
        recentTransactions,
        activeLoans: (loanSummary.loans || [])
          .filter((l) => l.status !== 'PAID' && l.status !== 'CANCELLED')
          .slice(0, 5)
          .map((l) => ({
            loanNumber: l.loanNumber,
            totalAmount: l.originalAmount,
            remainingAmount: l.remainingAmount,
            dueDate: l.dueDateStr,
            isOverdue: l.isOverdue,
          })),
      },
      openIssues,
    };
  }, [currentUser, transactions, myReportedIssues]);

  // Localized baseline prompts (clean text without decorative emoji clutter)
  const quickRepliesEn = [
    { label: "Account Summary", prompt: "What is my registered member information and account summary?" },
    { label: "Credit Score & Term", prompt: "What is my current credit score and maximum repayment term?" },
    { label: "Pending Requests", prompt: "Do I have any pending transactions right now?" },
    { label: "Loan & Limit", prompt: "What is my current loan debt and available borrowing capacity?" },
    { label: "Deposit Vault", prompt: "What is my deposit savings balance and how is it protected?" },
    { label: "bKash / Nagad Steps", prompt: "How do I pay or deposit via bKash or Nagad?" },
    { label: "Report an Issue", prompt: "I need help investigating a transaction issue." }
  ];

  const quickRepliesBn = [
    { label: "আমার অ্যাকাউন্ট", prompt: "আমার নিবন্ধিত অ্যাকাউন্টের বিস্তারিত তথ্য দিন।" },
    { label: "ক্রেডিট স্কোর ও মেয়াদ", prompt: "আমার ক্রেডিট স্কোর এবং সর্বোচ্চ পরিশোধের সময়সীমা কত দিন?" },
    { label: "পেন্ডিং লেনদেন", prompt: "আমার কোনো লেনদেন কি বর্তমানে পেন্ডিং অবস্থায় আছে?" },
    { label: "ঋণের সীমা ও বকেয়া", prompt: "আমার বর্তমান ঋণের সীমা ও বকেয়া কত?" },
    { label: "সঞ্চয় ভল্ট", prompt: "আমার সঞ্চয় ব্যালেন্স কত এবং তা কীভাবে সংরক্ষিত?" },
    { label: "বিকাশ / নগদ", prompt: "বিকাশ বা নগদে কীভাবে টাকা পাঠাব?" },
    { label: "সমস্যা জানান", prompt: "আমার একটি লেনদেন নিয়ে সমস্যা হচ্ছে, যাচাই করে দিন।" }
  ];

  const latestOfficerSuggestions = useMemo(() => {
    for (let i = chatMessages.length - 1; i >= 0; i--) {
      const m = chatMessages[i];
      if (m.sender === 'employee') {
        if (m.suggestedReplies && m.suggestedReplies.length > 0) {
          return m.suggestedReplies.map((s) => ({ label: s, prompt: s }));
        }
        break;
      }
    }
    return null;
  }, [chatMessages]);

  const currentQuickReplies = latestOfficerSuggestions || (language === 'bn' ? quickRepliesBn : quickRepliesEn);

  // Listen to verified officer records in Firestore
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'employees'), (snapshot) => {
      let maleAgent: Employee = { ...TWO_CORE_AI_AGENTS[0] };
      let femaleAgent: Employee = { ...TWO_CORE_AI_AGENTS[1] };
      let foundMale = false;
      let foundFemale = false;

      snapshot.forEach((docSnap) => {
        const data = docSnap.data() as Partial<Employee>;
        const name = (data.name || '').trim();
        const gender = data.gender;

        if ((name === 'Zubair Ahmed' || gender === 'Male') && !foundMale) {
          foundMale = true;
          maleAgent = {
            ...TWO_CORE_AI_AGENTS[0],
            ...data,
            id: 'EMP-00101',
            docId: docSnap.id
          };
        } else if ((name === 'Nusrat Jahan' || gender === 'Female') && !foundFemale) {
          foundFemale = true;
          femaleAgent = {
            ...TWO_CORE_AI_AGENTS[1],
            ...data,
            id: 'EMP-00102',
            docId: docSnap.id
          };
        }
      });

      setEmployees([maleAgent, femaleAgent]);
    }, (err) => {
      console.warn("Retaining default banking officers:", err);
      setEmployees(TWO_CORE_AI_AGENTS);
    });

    return () => unsub();
  }, []);

  // Real-time listener for user's reported inquiries/issues
  useEffect(() => {
    if (!currentUser?.uid) return;

    const q = query(
      collection(db, 'agent_reported_issues'),
      where('userId', '==', currentUser.uid),
      orderBy('createdAt', 'desc'),
      limit(25)
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
      setMyReportedIssues(list);
    }, (err) => {
      console.warn("Could not load inquiries:", err);
    });

    return () => unsubIssues();
  }, [currentUser?.uid]);

  // Sync / Load chat session with selected officer
  useEffect(() => {
    if (!selectedEmployee || !currentUser.uid) {
      setChatMessages([]);
      setActiveSessionId(null);
      return;
    }

    const chatsRef = collection(db, 'workforce_chats');
    const q = query(
      chatsRef,
      where('userId', '==', currentUser.uid),
      where('employeeId', '==', selectedEmployee.id),
      orderBy('updatedAt', 'desc'),
      limit(1)
    );

    const unsubChat = onSnapshot(q, (snapshot) => {
      if (!snapshot.empty) {
        const chatDoc = snapshot.docs[0];
        const data = chatDoc.data() as ChatSession;
        setChatMessages(data.messages || []);
        setActiveSessionId(chatDoc.id);
      } else {
        const firstName = (currentUser.name || 'Member').split(' ')[0];
        const greetingText = language === 'bn'
          ? `আসসালামু আলাইকুম ${firstName}! আমি ${selectedEmployee.name}, ${selectedEmployee.department === 'Credit & Underwriting' ? 'সিনিয়র ঋণ ও ক্রেডিট কর্মকর্তা' : 'সদস্য সেবা ও আমানত কর্মকর্তা'}। আপনার ঋণ, সঞ্চয়, পরিশোধ বা অন্য কোনো বিষয়ে কীভাবে সহায়তা করতে পারি?`
          : `Hello ${firstName}! I am ${selectedEmployee.name} from the ${selectedEmployee.department} desk. How may I assist you with your loans, deposits, repayments, or account inquiries today?`;

        const initialGreeting: ChatMessage = {
          sender: 'employee',
          text: greetingText,
          timestamp: Date.now()
        };
        setChatMessages([initialGreeting]);
        setActiveSessionId(null);
      }
    }, (err) => {
      console.warn("Using offline greeting:", err);
      const firstName = (currentUser.name || 'Member').split(' ')[0];
      const fallbackGreeting = language === 'bn'
        ? `স্বাগতম ${firstName}! আমি ${selectedEmployee.name}। আজ আপনাকে কীভাবে সাহায্য করতে পারি?`
        : `Welcome ${firstName}! I am ${selectedEmployee.name}. How may I help you today?`;
      setChatMessages([{
        sender: 'employee',
        text: fallbackGreeting,
        timestamp: Date.now()
      }]);
    });

    return () => unsubChat();
  }, [selectedEmployee, currentUser.uid, language]);

  // Auto-scroll to bottom of chat
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages, isTyping]);

  // Save chat to Firestore
  const saveChatToFirestore = async (updatedMessages: ChatMessage[]) => {
    if (!selectedEmployee || !currentUser.uid) return;

    try {
      const chatsRef = collection(db, 'workforce_chats');
      const lastText = updatedMessages[updatedMessages.length - 1]?.text || "";

      if (activeSessionId) {
        await setDoc(doc(db, 'workforce_chats', activeSessionId), {
          messages: updatedMessages,
          lastMessage: lastText,
          updatedAt: Date.now()
        }, { merge: true });
      } else {
        const newSession: Omit<ChatSession, 'id'> = {
          userId: currentUser.uid,
          userName: currentUser.name,
          employeeId: selectedEmployee.id,
          employeeName: selectedEmployee.name,
          messages: updatedMessages,
          lastMessage: lastText,
          updatedAt: Date.now(),
          status: 'active'
        };
        const docRef = await addDoc(chatsRef, newSession);
        setActiveSessionId(docRef.id);
      }
    } catch (err) {
      console.warn("Session saved locally:", err);
    }
  };

  // Smart Issue Registry & Case Enrichment in Firestore (no duplicate spam)
  const upsertMemberIssue = async (params: {
    action: 'create' | 'update_existing';
    existingIssueId?: string;
    category: string;
    priority: string;
    title: string;
    description: string;
    agentDiagnosis?: string;
    recommendedAction?: string;
    relatedTransactionId?: string;
    missingDetails?: string[];
  }): Promise<{ issue: AgentReportedIssue; actionType: 'created' | 'updated' }> => {
    const existingMatch =
      params.action === 'update_existing'
        ? myReportedIssues.find(
            (i) =>
              i.status !== 'Resolved' &&
              (i.id === params.existingIssueId || i.docId === params.existingIssueId)
          ) || myReportedIssues.find((i) => i.status !== 'Resolved' && i.category === params.category)
        : undefined;

    if (existingMatch) {
      const targetDocId = existingMatch.docId || existingMatch.id;
      const mergedDescription = existingMatch.description?.includes(params.description.slice(0, 40))
        ? existingMatch.description
        : `${existingMatch.description}\n[Follow-up]: ${params.description}`;
      const diagnosisBlock = params.agentDiagnosis
        ? `${params.agentDiagnosis}${params.recommendedAction ? ` | Next Action: ${params.recommendedAction}` : ''}`
        : params.recommendedAction || existingMatch.agentNotes || '';
      const remainingMissing = Array.isArray(params.missingDetails) ? params.missingDetails : [];
      const updatedRecord: AgentReportedIssue = {
        ...existingMatch,
        priority: (params.priority as any) || existingMatch.priority,
        description: mergedDescription,
        agentNotes: diagnosisBlock || existingMatch.agentNotes,
        recommendedAction: params.recommendedAction || existingMatch.recommendedAction,
        relatedTransactionId: params.relatedTransactionId || existingMatch.relatedTransactionId,
        missingDetails: remainingMissing,
        evidenceComplete: remainingMissing.length === 0,
        followUpCount: (existingMatch.followUpCount || 0) + 1,
        updatedAt: Date.now(),
        chatSnippet: params.description.slice(0, 200),
      };

      try {
        await setDoc(doc(db, 'agent_reported_issues', targetDocId), updatedRecord, { merge: true });
        await setDoc(
          doc(db, 'workforce_tickets', targetDocId),
          {
            priority: updatedRecord.priority,
            description: `[${selectedEmployee?.name || 'Support Desk'} Update] ${updatedRecord.title}: ${params.description}`,
            updatedAt: Date.now(),
          },
          { merge: true }
        );
      } catch (err) {
        console.error('Failed to enrich existing inquiry:', err);
      }
      return { issue: updatedRecord, actionType: 'updated' };
    }

    const issueId = `ISS-${Math.floor(10000 + Math.random() * 90000)}`;
    const missingList = Array.isArray(params.missingDetails) ? params.missingDetails : [];
    const combinedNotes = params.agentDiagnosis
      ? `${params.agentDiagnosis}${params.recommendedAction ? ` | Action: ${params.recommendedAction}` : ''}`
      : params.recommendedAction || 'Forwarded to Central Operations Desk for review.';

    const newIssue: AgentReportedIssue = {
      id: issueId,
      ticketId: issueId,
      docId: issueId,
      userId: currentUser.uid,
      userName: currentUser.name,
      userEmail: currentUser.email || '',
      userPhone: currentUser.phone || '',
      memberId: currentUser.memberId || `TUT-${currentUser.uid.slice(0, 6).toUpperCase()}`,
      agentId: selectedEmployee?.id || 'EMP-00101',
      agentName: selectedEmployee?.name || 'Zubair Ahmed',
      agentGender: (selectedEmployee?.gender as 'Male' | 'Female') || 'Male',
      category: (params.category as any) || 'Loan Issue',
      priority: (params.priority as any) || 'Medium',
      title: params.title || (language === 'bn' ? 'সদস্যের লেনদেন অনুসন্ধান' : 'Member Transaction Inquiry'),
      description: params.description || '',
      agentNotes: combinedNotes,
      recommendedAction: params.recommendedAction || 'Review member transaction file.',
      relatedTransactionId: params.relatedTransactionId,
      missingDetails: missingList,
      evidenceComplete: missingList.length === 0,
      followUpCount: 0,
      status: 'Open',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      chatSnippet: params.description.slice(0, 200),
    };

    try {
      await setDoc(doc(db, 'agent_reported_issues', issueId), newIssue, { merge: true });

      const newTicket: SupportTicket = {
        id: issueId,
        userId: currentUser.uid,
        userEmail: currentUser.email || 'support@tut.com',
        userName: currentUser.name,
        priority: params.priority as any,
        category: (params.category as any) || 'Loan Issue',
        assignedDepartment: selectedEmployee?.department || 'Credit & Underwriting',
        status: 'Open',
        description: `[${selectedEmployee?.name || 'Support Desk'}] ${newIssue.title}: ${params.description}`,
        estimatedResponseTime: params.priority === 'Urgent' ? '1-2 Hours' : '3-6 Hours',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      await setDoc(doc(db, 'workforce_tickets', issueId), newTicket, { merge: true });
    } catch (err) {
      console.error("Failed to persist inquiry:", err);
    }

    return { issue: newIssue, actionType: 'created' };
  };

  // Send message handler with role-grounded intelligence, clarifying enquiry, and deduplicated reporting
  const handleSendMessage = async (textToSend: string) => {
    if (!textToSend.trim() || !selectedEmployee) return;

    const userMessage: ChatMessage = {
      sender: 'user',
      text: textToSend.trim(),
      timestamp: Date.now()
    };

    const newMessages = [...chatMessages, userMessage];
    setChatMessages(newMessages);
    setInputMessage('');
    setIsTyping(true);

    await saveChatToFirestore(newMessages);

    try {
      const response = await fetch('/api/digital-workforce/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: newMessages,
          employee: {
            id: selectedEmployee.id,
            name: selectedEmployee.name,
            gender: selectedEmployee.gender,
            department: selectedEmployee.department,
            position: selectedEmployee.position,
            customPrompt: selectedEmployee.customPrompt || '',
            temperature: selectedEmployee.temperature
          },
          userContext: enrichedUserContext,
          isAdmin: false,
          preferredLanguage: language
        })
      });

      if (!response.ok) {
        throw new Error(`API returned status ${response.status}`);
      }

      const data = await response.json();

      setTimeout(async () => {
        setIsTyping(false);
        let finalMessages = [...newMessages];

        const fallbackReply = generateHumanEmployeeResponse(textToSend, enrichedUserContext, selectedEmployee, false, language);
        const employeeResponse: ChatMessage = {
          sender: 'employee',
          text: data.response || fallbackReply.response,
          timestamp: Date.now(),
          suggestedReplies: Array.isArray(data.suggestedReplies) && data.suggestedReplies.length > 0
            ? data.suggestedReplies
            : fallbackReply.suggestedReplies
        };
        finalMessages.push(employeeResponse);

        const action: 'none' | 'create' | 'update_existing' =
          data.issueAction === 'update_existing'
            ? 'update_existing'
            : (data.issueAction === 'create' || data.issueDetected || data.escalate)
              ? 'create'
              : 'none';

        if (action !== 'none') {
          const result = await upsertMemberIssue({
            action,
            existingIssueId: data.existingIssueId,
            category: data.issueCategory || 'General Inquiry',
            priority: data.issuePriority || (data.escalate ? 'High' : 'Medium'),
            title: data.issueTitle || (language === 'bn' ? 'সদস্যের অনুসন্ধান' : 'Member Inquiry'),
            description: data.issueDetails || textToSend,
            agentDiagnosis: data.agentDiagnosis,
            recommendedAction: data.recommendedAction,
            relatedTransactionId: data.relatedTransactionId,
            missingDetails: data.missingDetails,
          });

          if (result?.issue) {
            const isUpdated = result.actionType === 'updated';
            const issueAlert: ChatMessage = {
              sender: 'employee',
              text: isUpdated
                ? (language === 'bn'
                    ? `কেস #${result.issue.id} হালনাগাদ হয়েছে: আপনার দেওয়া নতুন তথ্য ও প্রমাণ মূল ফাইলে যুক্ত করা হয়েছে।`
                    : `Case #${result.issue.id} Updated: New verification details have been attached to your active inquiry.`)
                : (language === 'bn'
                    ? `অনুসন্ধান নথিভুক্ত হয়েছে (#${result.issue.id}): আপনার বিষয়টি আমাদের অপারেশন ডেস্কে রেকর্ড করা হয়েছে।`
                    : `Inquiry Logged (#${result.issue.id}): I have filed your report with our Operations Desk for review.`),
              timestamp: Date.now(),
              issueId: result.issue.id,
              issueActionType: result.actionType,
            };
            finalMessages.push(issueAlert);
          }
        }

        setChatMessages(finalMessages);
        await saveChatToFirestore(finalMessages);
      }, 450);

    } catch (err) {
      console.warn("Using localized fallback dialogue engine:", err);

      setTimeout(async () => {
        setIsTyping(false);
        const fallback = generateHumanEmployeeResponse(textToSend, enrichedUserContext, selectedEmployee, false, language);

        let finalMessages = [...newMessages];
        const employeeResponse: ChatMessage = {
          sender: 'employee',
          text: fallback.response,
          timestamp: Date.now(),
          suggestedReplies: fallback.suggestedReplies
        };
        finalMessages.push(employeeResponse);

        const fallbackAction =
          fallback.issueAction === 'update_existing'
            ? 'update_existing'
            : (fallback.issueAction === 'create' || fallback.issueDetected || fallback.escalate)
              ? 'create'
              : 'none';

        if (fallbackAction !== 'none') {
          const result = await upsertMemberIssue({
            action: fallbackAction,
            existingIssueId: fallback.existingIssueId,
            category: fallback.issueCategory || fallback.ticketCategory || 'Loan Issue',
            priority: fallback.issuePriority || fallback.ticketPriority || 'High',
            title: fallback.issueTitle || `${language === 'bn' ? 'সদস্য অনুসন্ধান' : 'Member Inquiry'}: ${textToSend.slice(0, 35)}`,
            description: fallback.issueDetails || fallback.ticketDescription || textToSend,
            agentDiagnosis: fallback.agentDiagnosis,
            recommendedAction: fallback.recommendedAction,
            relatedTransactionId: fallback.relatedTransactionId,
            missingDetails: fallback.missingDetails,
          });

          if (result?.issue) {
            const isUpdated = result.actionType === 'updated';
            const issueAlert: ChatMessage = {
              sender: 'employee',
              text: isUpdated
                ? (language === 'bn'
                    ? `কেস #${result.issue.id} হালনাগাদ হয়েছে: নতুন তথ্য রেকর্ডবুকে সংযুক্ত করা হয়েছে।`
                    : `Case #${result.issue.id} Updated: Your additional details have been added to the active inquiry.`)
                : (language === 'bn'
                    ? `অনুসন্ধান নথিভুক্ত হয়েছে (#${result.issue.id}): আপনার অনুরোধটি আমাদের অপারেশন রেকর্ডবুকে জমা রাখা হয়েছে।`
                    : `Inquiry Logged (#${result.issue.id}): Your request has been filed for administrative review.`),
              timestamp: Date.now(),
              issueId: result.issue.id,
              issueActionType: result.actionType,
            };
            finalMessages.push(issueAlert);
          }
        }

        setChatMessages(finalMessages);
        await saveChatToFirestore(finalMessages);
      }, 450);
    }
  };

  // Adaptive opacity for the launcher:
  // Dims when scrolling page down, instantly opaque on hover or when stationary
  const launcherOpacity = isHovered ? 'opacity-100 scale-100' : isPageScrolling ? 'opacity-35 scale-95' : 'opacity-95 scale-100';

  return (
    <>
      {/* Smart Adaptive Floating Support Launcher */}
      <div 
        className={`fixed bottom-20 sm:bottom-24 md:bottom-6 right-4 md:right-6 z-50 transition-all duration-300 ease-out ${launcherOpacity}`}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        {isMinimized ? (
          <div className="flex items-center gap-1.5">
            <button 
              onClick={() => setIsOpen(true)}
              className="relative w-11 h-11 bg-slate-900/90 hover:bg-slate-900 border border-slate-700/60 hover:border-blue-500/60 backdrop-blur-xl rounded-xl shadow-lg flex items-center justify-center text-slate-200 hover:text-white transition-all cursor-pointer active:scale-95"
              title={language === 'bn' ? 'সদস্য সহায়তা' : 'Member Support'}
            >
              <Headphones className="w-5 h-5 text-blue-400" />
              <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-emerald-500 rounded-full border-2 border-slate-950" />
            </button>
            
            <button
              type="button"
              onClick={() => {
                setIsMinimized(false);
                localStorage.setItem('tut_desk_widget_minimized', 'false');
              }}
              className="p-1.5 bg-slate-900/80 hover:bg-slate-800 border border-slate-700/50 text-slate-400 hover:text-white rounded-lg transition-all cursor-pointer"
              title="Expand support badge"
            >
              <Maximize2 className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-1.5 bg-slate-950/85 hover:bg-slate-900/95 border border-slate-800 hover:border-slate-700 backdrop-blur-xl pl-2.5 pr-2 py-1.5 rounded-full shadow-xl transition-all duration-200">
            <button 
              onClick={() => setIsOpen(true)}
              className="flex items-center gap-2.5 text-left cursor-pointer group pr-1"
            >
              <div className="relative w-7 h-7 bg-blue-600/20 text-blue-400 border border-blue-500/30 rounded-full flex items-center justify-center group-hover:bg-blue-600 group-hover:text-white transition-colors">
                <Headphones className="w-3.5 h-3.5" />
                <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-emerald-500 rounded-full border border-slate-950" />
              </div>
              <div className="flex flex-col">
                <span className="text-[11px] font-semibold text-slate-100 tracking-tight leading-tight group-hover:text-blue-400 transition-colors">
                  {language === 'bn' ? 'সদস্য সেবা' : 'Member Care'}
                </span>
                <span className="hidden sm:block text-[9px] text-slate-400 leading-none">
                  {language === 'bn' ? 'অনলাইন সহায়তা' : 'Online · 24/7'}
                </span>
              </div>
            </button>

            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setIsMinimized(true);
                localStorage.setItem('tut_desk_widget_minimized', 'true');
              }}
              className="p-1 hover:bg-white/10 text-slate-400 hover:text-white rounded-full transition-colors cursor-pointer"
              title="Minimize button"
            >
              <Minimize2 className="w-3 h-3" />
            </button>
          </div>
        )}
      </div>

      {/* Slide-over Support Drawer */}
      <AnimatePresence>
        {isOpen && (
          <div className="fixed inset-0 z-[100] flex justify-end">
            {/* Backdrop */}
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsOpen(false)}
              className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm"
            />

            {/* Support Panel */}
            <motion.div 
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 260 }}
              className="relative w-full max-w-md h-full bg-slate-950 border-l border-slate-800 shadow-2xl flex flex-col overflow-hidden text-slate-200"
            >
              {/* Top Bar Header */}
              <div className="p-4 border-b border-slate-800 bg-slate-900/50 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-blue-600/10 border border-blue-500/20 text-blue-400 flex items-center justify-center">
                    <Headphones className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-white tracking-tight">
                      {language === 'bn' ? 'টি.ইউ.টি সদস্য সহায়তা' : 'T.U.T Member Care'}
                    </h3>
                    <div className="flex items-center gap-1.5 text-[10px] text-slate-400">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                      <span>{language === 'bn' ? 'কর্মকর্তা উপস্থিত আছেন' : 'Officers active now'}</span>
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  {/* Language Switcher Toggle */}
                  <div className="flex items-center p-0.5 bg-slate-900 border border-slate-800 rounded-lg text-[10px] font-semibold">
                    <button
                      onClick={() => handleSelectLanguage('en')}
                      className={`px-2 py-0.5 rounded-md transition-colors ${
                        language === 'en' 
                          ? 'bg-blue-600 text-white font-bold' 
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      EN
                    </button>
                    <button
                      onClick={() => handleSelectLanguage('bn')}
                      className={`px-2 py-0.5 rounded-md transition-colors ${
                        language === 'bn' 
                          ? 'bg-blue-600 text-white font-bold' 
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      বাংলা
                    </button>
                  </div>

                  {/* Mode Toggle: Chat vs My Inquiries */}
                  <button
                    onClick={() => setViewMode(viewMode === 'chat' ? 'issues' : 'chat')}
                    className={`px-2.5 py-1 rounded-lg text-[10px] font-semibold border transition-colors flex items-center gap-1 ${
                      viewMode === 'issues'
                        ? 'bg-blue-600 text-white border-blue-500'
                        : 'bg-slate-900 text-slate-300 border-slate-800 hover:text-white'
                    }`}
                    title={language === 'bn' ? 'আমার অনুসন্ধান তালিকা' : 'My Inquiries'}
                  >
                    <ClipboardList className="w-3.5 h-3.5" />
                    <span>{language === 'bn' ? 'অনুরোধ' : 'Inquiries'} ({myReportedIssues.length})</span>
                  </button>

                  {/* Close or back to root */}
                  <button 
                    onClick={() => {
                      if (selectedEmployee) {
                        setSelectedEmployee(null);
                      } else {
                        setIsOpen(false);
                      }
                    }}
                    className="w-7 h-7 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
                    title="Close"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Drawer Body */}
              <div className="flex-1 overflow-y-auto flex flex-col">
                <AnimatePresence mode="wait">
                  
                  {/* TAB: MY REPORTED INQUIRIES & ISSUES */}
                  {viewMode === 'issues' ? (
                    <motion.div 
                      key="issues_view"
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                      className="p-4 space-y-4 flex-1"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-semibold text-slate-400">
                          {language === 'bn' ? 'আপনার দায়ের করা অনুসন্ধানসমূহ' : 'Tracked Inquiries & Requests'}
                        </span>
                        <button
                          onClick={() => setViewMode('chat')}
                          className="text-[10px] text-blue-400 hover:underline flex items-center gap-1 cursor-pointer"
                        >
                          <MessageSquare className="w-3 h-3" />
                          <span>{language === 'bn' ? 'চ্যাটে ফিরে যান' : 'Back to Chat'}</span>
                        </button>
                      </div>

                      {myReportedIssues.length === 0 ? (
                        <div className="p-8 text-center bg-slate-900/40 border border-slate-800/80 rounded-2xl space-y-2 mt-4">
                          <CheckCircle2 className="w-8 h-8 text-slate-500 mx-auto" />
                          <h4 className="text-xs font-semibold text-white">
                            {language === 'bn' ? 'কোনো অমীমাংসিত অভিযোগ নেই' : 'No Open Inquiries'}
                          </h4>
                          <p className="text-[11px] text-slate-400 leading-relaxed">
                            {language === 'bn' 
                              ? 'লেনদেনে কোনো সমস্যা হলে চ্যাটে জানান। আমাদের কর্মকর্তারা তাৎক্ষণিকভাবে এখানে তা রেকর্ড করবেন।'
                              : 'Any discrepancy, payment delay, or dispute you report in chat will appear here with live updates.'}
                          </p>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {myReportedIssues.map((issue, idx) => (
                            <div 
                              key={`${issue.id || 'issue'}-${idx}`}
                              className="bg-slate-900/50 border border-slate-800 rounded-xl p-3.5 space-y-2 text-left"
                            >
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-[10px] font-mono text-blue-400 font-medium">#{issue.id}</span>
                                <span className={`text-[9px] font-semibold px-2 py-0.5 rounded-full border ${
                                  issue.status === 'Resolved' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                                  issue.status === 'In Progress' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' :
                                  'bg-amber-500/10 text-amber-400 border-amber-500/20'
                                }`}>
                                  {issue.status === 'Resolved' ? (language === 'bn' ? 'সমাধানকৃত' : 'Resolved') :
                                   issue.status === 'In Progress' ? (language === 'bn' ? 'পর্যালোচনাধীন' : 'In Review') :
                                   (language === 'bn' ? 'অপেক্ষমাণ' : 'Pending')}
                                </span>
                              </div>

                               <h4 className="text-xs font-semibold text-white">{issue.title}</h4>
                              <p className="text-[11px] text-slate-300 leading-relaxed whitespace-pre-line">{issue.description}</p>

                              {issue.relatedTransactionId && (
                                <div className="inline-flex items-center gap-1.5 text-[10px] font-mono text-slate-300 bg-slate-950/70 border border-slate-800 px-2 py-0.5 rounded-md">
                                  <FileCheck2 className="w-3 h-3 text-blue-400" />
                                  <span>Ref: {issue.relatedTransactionId}</span>
                                </div>
                              )}

                              {issue.missingDetails && issue.missingDetails.length > 0 && issue.status !== 'Resolved' && (
                                <div className="p-2 bg-amber-500/10 border border-amber-500/20 rounded-lg flex items-center justify-between gap-2 text-[10px] text-amber-300">
                                  <span>
                                    {language === 'bn' ? 'অতিরিক্ত তথ্য প্রয়োজন:' : 'Needed:'} {issue.missingDetails.join(', ')}
                                  </span>
                                  <button
                                    onClick={() => {
                                      const assignedOfficer = employees.find((e) => e.id === issue.agentId) || employees[0];
                                      setSelectedEmployee(assignedOfficer);
                                      setViewMode('chat');
                                      setInputMessage(
                                        language === 'bn'
                                          ? `কেস #${issue.id} সংক্রান্ত তথ্য: `
                                          : `Regarding case #${issue.id}: `
                                      );
                                    }}
                                    className="px-2 py-0.5 bg-amber-500/20 hover:bg-amber-500/30 rounded text-amber-200 font-semibold shrink-0 cursor-pointer"
                                  >
                                    {language === 'bn' ? 'তথ্য দিন' : 'Provide'}
                                  </button>
                                </div>
                              )}

                              <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-[10px] text-slate-400">
                                <span>{language === 'bn' ? 'দায়িত্বপ্রাপ্ত:' : 'Assigned to:'} <strong className="text-slate-200">{issue.agentName}</strong></span>
                                <span>{new Date(issue.updatedAt || issue.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric' })}</span>
                              </div>

                              {issue.adminNotes && (
                                <div className="mt-2 p-2.5 bg-slate-950/80 border border-slate-800 rounded-lg text-[10px] text-slate-300">
                                  <strong className="block text-blue-400 font-semibold mb-0.5">
                                    {language === 'bn' ? 'অপারেশন টিমের মন্তব্য:' : 'Desk Response:'}
                                  </strong>
                                  {issue.adminNotes}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </motion.div>
                  ) : !selectedEmployee ? (
                    /* STEP 1: SELECT BANKING SPECIALIST */
                    <motion.div 
                      key="list"
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                      className="p-4 space-y-4 flex-1"
                    >
                      {/* Language selection banner */}
                      <div className="p-3 bg-slate-900/60 border border-slate-800 rounded-xl flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                          <Languages className="w-4 h-4 text-blue-400 shrink-0" />
                          <span className="text-[11px] text-slate-300">
                            {language === 'bn' ? 'ভাষা নির্বাচন করুন:' : 'Preferred Language:'}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => handleSelectLanguage('en')}
                            className={`px-2.5 py-1 text-xs rounded-lg transition-colors cursor-pointer ${
                              language === 'en' ? 'bg-blue-600 text-white font-bold' : 'bg-slate-800 text-slate-400 hover:text-white'
                            }`}
                          >
                            English
                          </button>
                          <button
                            onClick={() => handleSelectLanguage('bn')}
                            className={`px-2.5 py-1 text-xs rounded-lg transition-colors cursor-pointer ${
                              language === 'bn' ? 'bg-blue-600 text-white font-bold' : 'bg-slate-800 text-slate-400 hover:text-white'
                            }`}
                          >
                            বাংলা
                          </button>
                        </div>
                      </div>

                      <div className="space-y-1">
                        <h4 className="text-xs font-semibold text-slate-300">
                          {language === 'bn' ? 'কর্মকর্তা নির্বাচন করুন' : 'Select a Banking Officer'}
                        </h4>
                        <p className="text-[11px] text-slate-500">
                          {language === 'bn' 
                            ? 'আপনার ঋণ ও অ্যাকাউন্টের প্রয়োজনে সরাসরি কর্মকর্তার সাথে কথা বলুন।' 
                            : 'Connect directly with an officer for loan approvals, savings, or inquiries.'}
                        </p>
                      </div>
                      
                      <div className="space-y-3">
                        {employees.map((emp, idx) => (
                          <button
                            key={`${emp.id}-${idx}`}
                            onClick={() => setSelectedEmployee(emp)}
                            className="w-full text-left bg-slate-900/40 hover:bg-slate-900/80 border border-slate-800 hover:border-slate-700 p-3.5 rounded-xl flex items-center justify-between gap-3 group transition-all duration-200 cursor-pointer"
                          >
                            <div className="flex items-center gap-3">
                              <div className="relative">
                                <img 
                                  src={emp.photoUrl} 
                                  alt={emp.name} 
                                  className="w-12 h-12 rounded-xl object-cover border border-slate-800"
                                  referrerPolicy="no-referrer"
                                />
                                <span className="absolute -bottom-1 -right-1 w-3 h-3 rounded-full border-2 border-slate-950 bg-emerald-500" />
                              </div>
                              <div className="space-y-0.5">
                                <h4 className="text-xs font-bold text-white group-hover:text-blue-400 transition-colors">
                                  {emp.name}
                                </h4>
                                <p className="text-[11px] text-slate-300">
                                  {emp.id === 'EMP-00101' 
                                    ? (language === 'bn' ? 'সিনিয়র ঋণ ও ক্রেডিট কর্মকর্তা' : 'Senior Credit & Verification Officer')
                                    : (language === 'bn' ? 'সদস্য সেবা ও আমানত কর্মকর্তা' : 'Member Relations & Treasury Specialist')}
                                </p>
                                <span className="text-[10px] text-slate-400 block">
                                  {emp.id === 'EMP-00101'
                                    ? (language === 'bn' ? 'ঋণ অনুমোদন, সীমা ও পরিশোধ যাচাই' : 'Loan Limits, Approvals & Repayments')
                                    : (language === 'bn' ? 'সঞ্চয় আমানত, ভল্ট নিরাপত্তা ও সেবা' : 'Deposit Reserves, Vault Safety & Inquiries')}
                                </span>
                              </div>
                            </div>
                            <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-white group-hover:translate-x-0.5 transition-all shrink-0" />
                          </button>
                        ))}
                      </div>

                      <div className="p-3 bg-slate-900/30 border border-slate-800/80 rounded-xl text-[10px] text-slate-400 leading-relaxed">
                        <div className="flex items-center gap-1.5 text-slate-300 font-semibold mb-0.5">
                          <CheckCircle2 className="w-3.5 h-3.5 text-blue-400" />
                          <span>{language === 'bn' ? 'নিরাপদ সহায়তা সেবা' : 'Verified Banking Care'}</span>
                        </div>
                        {language === 'bn'
                          ? 'আমাদের কর্মকর্তারা সার্বক্ষণিক অনলাইন থাকেন। যেকোনো অনাকাঙ্ক্ষিত লেনদেন বা সমস্যা জানাতে পারেন।'
                          : 'Our banking desk operates around the clock. Your transactions and inquiries are audited under bank-grade security.'}
                      </div>
                    </motion.div>
                  ) : (
                    /* STEP 2: REALISTIC CONVERSATION WITH CHOSEN OFFICER */
                    <motion.div 
                      key="chat"
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                      className="flex-1 flex flex-col h-full bg-slate-950 relative"
                    >
                      {/* Officer Top Bar */}
                      <div className="p-3 bg-slate-900/60 border-b border-slate-800 flex items-center justify-between px-3.5">
                        <div className="flex items-center gap-2.5">
                          <button
                            onClick={() => setSelectedEmployee(null)}
                            className="p-1 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors cursor-pointer"
                            title={language === 'bn' ? 'কর্মকর্তা পরিবর্তন' : 'Change Officer'}
                          >
                            <ChevronLeft className="w-4 h-4" />
                          </button>
                          <img 
                            src={selectedEmployee.photoUrl} 
                            alt={selectedEmployee.name} 
                            className="w-8 h-8 rounded-lg object-cover border border-slate-800"
                            referrerPolicy="no-referrer"
                          />
                          <div>
                            <h4 className="text-xs font-bold text-white leading-tight">{selectedEmployee.name}</h4>
                            <span className="text-[10px] text-slate-400 block leading-none mt-0.5">
                              {selectedEmployee.id === 'EMP-00101'
                                ? (language === 'bn' ? 'ঋণ কর্মকর্তা · সক্রিয়' : 'Credit Officer · Active now')
                                : (language === 'bn' ? 'সদস্য সেবা কর্মকর্তা · সক্রিয়' : 'Member Specialist · Active now')}
                            </span>
                          </div>
                        </div>

                        {/* Language pill toggle in chat header */}
                        <div className="flex items-center p-0.5 bg-slate-950 border border-slate-800 rounded-md text-[9px] font-semibold">
                          <button
                            onClick={() => handleSelectLanguage('en')}
                            className={`px-1.5 py-0.5 rounded transition-colors ${
                              language === 'en' ? 'bg-blue-600 text-white font-bold' : 'text-slate-400 hover:text-white'
                            }`}
                          >
                            EN
                          </button>
                          <button
                            onClick={() => handleSelectLanguage('bn')}
                            className={`px-1.5 py-0.5 rounded transition-colors ${
                              language === 'bn' ? 'bg-blue-600 text-white font-bold' : 'text-slate-400 hover:text-white'
                            }`}
                          >
                            বাংলা
                          </button>
                        </div>
                      </div>

                      {/* Chat Messages */}
                      <div className="flex-1 p-3.5 overflow-y-auto space-y-3 custom-scrollbar">
                        {chatMessages.map((msg, idx) => (
                          <div 
                            key={idx}
                            className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
                          >
                            <div className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-xs leading-relaxed space-y-1 ${
                              msg.sender === 'user' 
                                ? 'bg-blue-600 text-white rounded-br-xs shadow-sm' 
                                : msg.issueId
                                  ? 'bg-slate-900 border border-amber-500/30 text-slate-200 rounded-bl-xs'
                                  : 'bg-slate-900 text-slate-200 border border-slate-800 rounded-bl-xs'
                            }`}>
                              {/* Clean reference badge for recorded/updated issues */}
                              {msg.issueId && (
                                <div className={`flex items-center gap-1.5 mb-1 font-semibold text-[10px] ${
                                  msg.issueActionType === 'updated' ? 'text-blue-400' : 'text-amber-400'
                                }`}>
                                  <AlertCircle className="w-3 h-3" />
                                  <span>
                                    {msg.issueActionType === 'updated'
                                      ? (language === 'bn' ? 'কেস হালনাগাদ' : 'Inquiry Updated')
                                      : (language === 'bn' ? 'অনুরোধ রেকর্ড করা হয়েছে' : 'Inquiry Logged')} #{msg.issueId}
                                  </span>
                                </div>
                              )}
                              
                              <p className="whitespace-pre-wrap">{msg.text}</p>
                              
                              <span className="block text-[8px] opacity-60 text-right mt-0.5">
                                {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>
                          </div>
                        ))}

                        {/* Typing indicator: Clean 3-dot pulse (NO robotic text) */}
                        {isTyping && (
                          <div className="flex justify-start">
                            <div className="bg-slate-900 border border-slate-800 rounded-2xl rounded-bl-xs px-3.5 py-2.5 flex items-center gap-1.5">
                              <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                              <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                              <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                            </div>
                          </div>
                        )}
                        <div ref={messagesEndRef} />
                      </div>

                      {/* Quick banking suggestion chips */}
                      {chatMessages.length > 0 && !isTyping && (
                        <div className="px-3 py-2 flex gap-1.5 overflow-x-auto shrink-0 border-t border-slate-900 bg-slate-950">
                          {currentQuickReplies.map((reply, idx) => (
                            <button
                              key={idx}
                              onClick={() => handleSendMessage(reply.prompt)}
                              className="bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 text-[10px] font-medium text-slate-300 hover:text-white px-2.5 py-1.5 rounded-lg whitespace-nowrap shrink-0 transition-colors cursor-pointer"
                            >
                              {reply.label}
                            </button>
                          ))}
                        </div>
                      )}

                      {/* Message Input Box */}
                      <div className="p-3 border-t border-slate-800 bg-slate-900/40 flex gap-2">
                        <input
                          type="text"
                          placeholder={language === 'bn' 
                            ? `${selectedEmployee.name}-কে বার্তা লিখুন...` 
                            : `Message ${selectedEmployee.name}...`}
                          value={inputMessage}
                          onChange={(e) => setInputMessage(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleSendMessage(inputMessage);
                          }}
                          className="flex-1 bg-slate-950 border border-slate-800 px-3.5 py-2 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors"
                        />
                        <button
                          onClick={() => handleSendMessage(inputMessage)}
                          disabled={!inputMessage.trim()}
                          className="w-9 h-9 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl flex items-center justify-center transition-all cursor-pointer active:scale-95 shrink-0"
                          title={language === 'bn' ? 'বার্তা পাঠান' : 'Send message'}
                        >
                          <Send className="w-3.5 h-3.5 text-white" />
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
};
