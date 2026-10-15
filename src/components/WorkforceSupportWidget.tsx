import React, { useState, useEffect, useRef } from 'react';
import { 
  collection, 
  getDocs, 
  addDoc, 
  updateDoc, 
  doc, 
  onSnapshot, 
  query, 
  where, 
  orderBy, 
  limit 
} from 'firebase/firestore';
import { db } from '../firebase';
import { Employee, SupportTicket, ChatMessage, ChatSession } from '../types/workforce';
import { generateHumanEmployeeResponse } from '../utils/workforceKnowledge';
import { 
  MessageSquare, 
  X, 
  Send, 
  ChevronRight, 
  ChevronLeft,
  Minimize2,
  Maximize2,
  AlertCircle, 
  Clock, 
  CheckCircle, 
  ShieldAlert, 
  User, 
  Sparkles, 
  Navigation, 
  Compass, 
  CreditCard, 
  HelpCircle, 
  Coins,
  ShieldCheck,
  Zap
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

const DEFAULT_EMPLOYEES: Employee[] = [
  {
    id: 'EMP-00101',
    name: 'Rafiqul Islam',
    photoUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=400',
    department: 'Customer Support',
    position: 'Senior Loan & Advisory Officer',
    joinedDate: '2024-01-15',
    status: 'Available',
    performanceScore: 99,
    employeeType: 'Digital Employee',
    averageResponseTime: 'Instant (24/7)',
    customerSatisfaction: '4.9/5',
    totalChats: 1420
  },
  {
    id: 'EMP-00102',
    name: 'Nusrat Jahan',
    photoUrl: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&q=80&w=400',
    department: 'Member Support',
    position: 'Financial Ledger & Repayment Specialist',
    joinedDate: '2024-02-01',
    status: 'Available',
    performanceScore: 98,
    employeeType: 'Digital Employee',
    averageResponseTime: 'Instant (24/7)',
    customerSatisfaction: '5.0/5',
    totalChats: 980
  },
  {
    id: 'EMP-00103',
    name: 'Tanvir Ahmed',
    photoUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=400',
    department: 'Information Desk',
    position: 'Verification & Compliance Officer',
    joinedDate: '2024-03-10',
    status: 'Available',
    performanceScore: 97,
    employeeType: 'Digital Employee',
    averageResponseTime: 'Instant (24/7)',
    customerSatisfaction: '4.8/5',
    totalChats: 750
  },
  {
    id: 'EMP-00104',
    name: 'Farhana Rahman',
    photoUrl: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?auto=format&fit=crop&q=80&w=400',
    department: 'Technical Support',
    position: 'Escalations & Priority Care Desk',
    joinedDate: '2024-04-12',
    status: 'Available',
    performanceScore: 99,
    employeeType: 'Digital Employee',
    averageResponseTime: 'Instant (24/7)',
    customerSatisfaction: '4.9/5',
    totalChats: 610
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
  };
}

export const WorkforceSupportWidget: React.FC<WorkforceSupportWidgetProps> = ({ currentUser }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [employees, setEmployees] = useState<Employee[]>(DEFAULT_EMPLOYEES);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [activeTicket, setActiveTicket] = useState<SupportTicket | null>(null);
  const [isMinimized, setIsMinimized] = useState<boolean>(() => {
    const saved = localStorage.getItem('tut_desk_widget_minimized');
    if (saved !== null) return saved === 'true';
    return false;
  });

  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  // Suggested Actions depending on user details (24/7 AI employee training)
  const quickReplies = [
    { label: "👤 My Member Info", prompt: "What is my registered member information and account dossier?" },
    { label: "💳 Loan Due & Limit", prompt: "What is my current loan due and borrowing limit?" },
    { label: "💰 Savings & Withdraw", prompt: "What is my deposit savings balance and can I withdraw it?" },
    { label: "📝 How to Borrow", prompt: "How do I apply for a new loan?" },
    { label: "🔄 How to Repay", prompt: "How do I make a loan repayment?" },
    { label: "🕒 Approval Duration", prompt: "How long does loan verification and disbursal take?" },
    { label: "🏢 Office & 24/7 Hours", prompt: "What are your office hours and support availability?" },
    { label: "⚠️ Urgent Escalate", prompt: "I have an urgent ledger dispute and want to speak with an administrator." }
  ];

  // Load active employees list from Firestore or retain defaults
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'employees'), (snapshot) => {
      let emps: Employee[] = [];
      snapshot.forEach((doc) => {
        emps.push({ id: doc.id, ...doc.data() } as Employee);
      });
      if (emps.length > 0) {
        // Sort online/available employees to the top
        emps.sort((a, b) => {
          if (a.status === 'Available' && b.status !== 'Available') return -1;
          if (a.status === 'Busy' && b.status === 'Offline') return -1;
          return 1;
        });
        setEmployees(emps);
      } else {
        setEmployees(DEFAULT_EMPLOYEES);
      }
    }, (err) => {
      console.warn("Retaining fallback default workforce employees:", err);
      setEmployees(DEFAULT_EMPLOYEES);
    });

    return () => unsub();
  }, []);

  // Sync / Load chat session with selected employee
  useEffect(() => {
    if (!selectedEmployee || !currentUser.uid) {
      setChatMessages([]);
      setActiveSessionId(null);
      return;
    }

    // Try finding an existing chat session between this user and this employee in Firestore
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
        // Create initial greeting from the employee
        const firstName = (currentUser.name || 'Member').split(' ')[0];
        const initialGreeting: ChatMessage = {
          sender: 'employee',
          text: `Greetings, ${firstName}! I am ${selectedEmployee.name} from the ${selectedEmployee.department} team at T.U.T Money Lending Authority. How may I assist you with your account, loans, or repayments today?`,
          timestamp: Date.now()
        };
        setChatMessages([initialGreeting]);
        setActiveSessionId(null);
      }
    }, (err) => {
      console.warn("Using offline greeting:", err);
      const firstName = (currentUser.name || 'Member').split(' ')[0];
      setChatMessages([{
        sender: 'employee',
        text: `Greetings, ${firstName}! I am ${selectedEmployee.name} from the ${selectedEmployee.department} team. How may I assist you with your account today?`,
        timestamp: Date.now()
      }]);
    });

    return () => unsubChat();
  }, [selectedEmployee, currentUser]);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages, isTyping]);

  // Save / Sync conversation messages to Firestore
  const saveChatToFirestore = async (updatedMessages: ChatMessage[]) => {
    if (!selectedEmployee || !currentUser.uid) return;

    try {
      const chatsRef = collection(db, 'workforce_chats');
      const lastText = updatedMessages[updatedMessages.length - 1]?.text || "";

      if (activeSessionId) {
        await updateDoc(doc(db, 'workforce_chats', activeSessionId), {
          messages: updatedMessages,
          lastMessage: lastText,
          updatedAt: Date.now()
        });
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
      console.warn("Local chat saved in session:", err);
    }
  };

  // Create escalated Support Ticket
  const createSupportTicket = async (category: string, priority: string, description: string) => {
    try {
      const ticketId = `TICKET-${Math.floor(10000 + Math.random() * 90000)}`;
      const newTicket: SupportTicket = {
        id: ticketId,
        userId: currentUser.uid,
        userEmail: currentUser.email || 'no-email@tut.com',
        userName: currentUser.name,
        priority: priority as any,
        category: category as any,
        assignedDepartment: selectedEmployee?.department || 'Customer Support',
        status: 'Open',
        description,
        estimatedResponseTime: priority === 'Urgent' ? '2 Hours' : '6 Hours',
        createdAt: Date.now(),
        updatedAt: Date.now()
      };

      await addDoc(collection(db, 'workforce_tickets'), newTicket);
      return newTicket;
    } catch (err) {
      console.error("Failed to create escalated ticket in Firestore:", err);
      return {
        id: `TICKET-${Math.floor(10000 + Math.random() * 90000)}`,
        userId: currentUser.uid,
        userEmail: currentUser.email || 'support@tut.com',
        userName: currentUser.name,
        priority: priority as any,
        category: category as any,
        assignedDepartment: selectedEmployee?.department || 'Customer Support',
        status: 'Open',
        description,
        estimatedResponseTime: '2-4 Hours',
        createdAt: Date.now(),
        updatedAt: Date.now()
      } as SupportTicket;
    }
  };

  // Send message handler with 24/7 intelligent zero-downtime fallback
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

    // Persist user's message
    await saveChatToFirestore(newMessages);

    try {
      // Setup payload for Gemini API proxy route
      const response = await fetch('/api/digital-workforce/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: newMessages,
          employee: {
            id: selectedEmployee.id,
            name: selectedEmployee.name,
            department: selectedEmployee.department
          },
          userContext: currentUser,
          isAdmin: false
        })
      });

      if (!response.ok) {
        throw new Error(`API returned status ${response.status}`);
      }

      const data = await response.json();
      
      setTimeout(async () => {
        setIsTyping(false);
        let finalMessages = [...newMessages];

        const employeeResponse: ChatMessage = {
          sender: 'employee',
          text: data.response || generateHumanEmployeeResponse(textToSend, currentUser, selectedEmployee, false).response,
          timestamp: Date.now()
        };
        finalMessages.push(employeeResponse);

        // Check if escalated Support Ticket was generated
        if (data.escalate) {
          const ticket = await createSupportTicket(
            data.ticketCategory || 'General Help',
            data.ticketPriority || 'Medium',
            data.ticketDescription || textToSend
          );

          if (ticket) {
            const escalationAlert: ChatMessage = {
              sender: 'employee',
              text: `⚠️ ESCALATION LOGGED: I have created an official Priority Ticket (${ticket.id}) for our Chief Underwriter. Estimated manual callback time: ${ticket.estimatedResponseTime}.`,
              timestamp: Date.now(),
              ticketId: ticket.id
            };
            finalMessages.push(escalationAlert);
          }
        }

        setChatMessages(finalMessages);
        await saveChatToFirestore(finalMessages);
      }, 750);

    } catch (err) {
      console.warn("Running 24/7 local human-fallback intelligence engine:", err);
      
      // Zero-downtime Guarantee: instantly compute precise human response from trained knowledge engine
      setTimeout(async () => {
        setIsTyping(false);
        const fallback = generateHumanEmployeeResponse(textToSend, currentUser, selectedEmployee, false);
        
        let finalMessages = [...newMessages];
        const employeeResponse: ChatMessage = {
          sender: 'employee',
          text: fallback.response,
          timestamp: Date.now()
        };
        finalMessages.push(employeeResponse);

        if (fallback.escalate) {
          const ticket = await createSupportTicket(
            fallback.ticketCategory || 'General Help',
            fallback.ticketPriority || 'High',
            fallback.ticketDescription || textToSend
          );

          if (ticket) {
            const escalationAlert: ChatMessage = {
              sender: 'employee',
              text: `⚠️ ESCALATION LOGGED: I have recorded an official Priority Ticket (${ticket.id}) directly for our Chief Underwriter. Estimated review time: ${ticket.estimatedResponseTime}.`,
              timestamp: Date.now(),
              ticketId: ticket.id
            };
            finalMessages.push(escalationAlert);
          }
        }

        setChatMessages(finalMessages);
        await saveChatToFirestore(finalMessages);
      }, 600);
    }
  };

  return (
    <>
      {/* Floating Smart Action Button */}
      {isMinimized ? (
        /* Compact Mode: Small non-blocking circular badge */
        <div className="fixed bottom-20 sm:bottom-24 md:bottom-6 right-4 md:right-6 z-50 flex items-center gap-1.5">
          <button 
            onClick={() => setIsOpen(true)}
            className="relative w-11 h-11 bg-slate-950/95 hover:bg-slate-900 border border-blue-500/40 hover:border-blue-400 backdrop-blur-xl rounded-2xl shadow-[0_10px_30px_rgba(59,130,246,0.25)] flex items-center justify-center text-blue-400 hover:text-white hover:scale-105 active:scale-95 transition-all group cursor-pointer"
            title="Chat with Desk Officer (Click to open)"
          >
            <MessageSquare className="w-5 h-5 text-blue-400 group-hover:rotate-12 transition-transform" />
            <span className="absolute -top-1 -right-1 flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-blue-500 border-2 border-slate-950"></span>
            </span>
          </button>
          
          <button
            type="button"
            onClick={() => {
              setIsMinimized(false);
              localStorage.setItem('tut_desk_widget_minimized', 'false');
            }}
            className="p-1.5 bg-slate-950/80 hover:bg-slate-900 border border-white/10 text-slate-400 hover:text-white rounded-xl transition-all shadow-md group cursor-pointer"
            title="Expand support badge"
          >
            <Maximize2 className="w-3.5 h-3.5 text-slate-400 group-hover:text-blue-400" />
          </button>
        </div>
      ) : (
        /* Expanded Mode: Banner with Minimize toggle */
        <div className="fixed bottom-20 sm:bottom-24 md:bottom-6 right-4 md:right-6 z-50 flex items-center gap-2">
          <button 
            onClick={() => setIsOpen(true)}
            className="flex items-center gap-3 bg-slate-950/95 hover:bg-slate-900 border border-blue-500/30 hover:border-blue-400 backdrop-blur-xl pl-3 pr-4 py-2.5 rounded-2xl shadow-[0_20px_50px_rgba(59,130,246,0.25)] hover:shadow-[0_20px_50px_rgba(59,130,246,0.35)] transition-all duration-300 hover:scale-[1.02] active:scale-95 group text-left cursor-pointer"
            title="Open T.U.T Digital Workforce Support Desk"
          >
            <div className="relative">
              <div className="w-9 h-9 bg-blue-600 text-white rounded-xl flex items-center justify-center transition-transform group-hover:rotate-12 duration-300 shadow-md">
                <MessageSquare className="w-4.5 h-4.5 text-white" />
              </div>
              <span className="absolute -top-1 -right-1 flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-blue-500 border-2 border-slate-950"></span>
              </span>
            </div>
            <div className="flex flex-col text-left pr-1">
              <span className="text-[9px] font-black uppercase text-blue-400 tracking-[0.15em] flex items-center gap-1.5 leading-none">
                Corporate Support
                <span className="w-1 h-1 rounded-full bg-blue-400 animate-pulse" />
              </span>
              <span className="text-[10px] font-black text-white tracking-tight mt-1 leading-none uppercase">
                Chat with Desk Officer
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
            className="p-2 bg-slate-950/90 hover:bg-slate-900 border border-white/10 hover:border-white/20 text-slate-400 hover:text-white rounded-xl transition-all shadow-md group cursor-pointer"
            title="Minimize support box so it doesn't block screen visuals"
          >
            <Minimize2 className="w-3.5 h-3.5 group-hover:scale-110 transition-transform" />
          </button>
        </div>
      )}

      {/* Slide-over Drawer UI */}
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

            {/* Panel */}
            <motion.div 
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="relative w-full max-w-md h-full bg-slate-950 border-l border-white/10 shadow-2xl flex flex-col overflow-hidden"
            >
              {/* Drawer Header */}
              <div className="p-4 border-b border-white/10 bg-slate-900/40 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 bg-blue-600/10 rounded-lg flex items-center justify-center border border-blue-500/20">
                    <Compass className="w-5 h-5 text-blue-400" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-white uppercase tracking-wider">T.U.T Operations Desk</h3>
                    <p className="text-[10px] text-slate-400">Select stationed support officers for manual assistance</p>
                  </div>
                </div>
                <button 
                  onClick={() => {
                    if (selectedEmployee) {
                      setSelectedEmployee(null);
                    } else {
                      setIsOpen(false);
                    }
                  }}
                  className="w-8 h-8 rounded-full bg-slate-900 border border-white/10 flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Drawer Body Container */}
              <div className="flex-1 overflow-y-auto flex flex-col">
                <AnimatePresence mode="wait">
                  
                  {/* STEP 1: CHOOSE OFFICER LIST */}
                  {!selectedEmployee ? (
                    <motion.div 
                      key="list"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="p-4 space-y-4 flex-1"
                    >
                      <span className="text-[10px] font-black uppercase text-slate-500 tracking-wider block mb-2">Available Stations</span>
                      
                      {employees.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-20 space-y-3">
                          <Compass className="w-8 h-8 text-slate-600 animate-spin" />
                          <span className="text-xs text-slate-500">Retrieving employee registers...</span>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {employees.map((emp) => (
                            <button
                              key={emp.id}
                              onClick={() => setSelectedEmployee(emp)}
                              className="w-full text-left bg-slate-900/30 hover:bg-slate-900/80 border border-white/5 hover:border-white/10 p-4 rounded-2xl flex items-center justify-between gap-3 group transition-all duration-200"
                            >
                              <div className="flex items-center gap-3">
                                <div className="relative">
                                  <img 
                                    src={emp.photoUrl} 
                                    alt={emp.name} 
                                    className="w-11 h-11 rounded-xl object-cover border border-white/10 shadow"
                                    referrerPolicy="no-referrer"
                                  />
                                  <span className={`absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full border-2 border-slate-950 ${
                                    emp.status === 'Available' ? 'bg-emerald-500' :
                                    emp.status === 'Busy' ? 'bg-amber-500' : 'bg-slate-500'
                                  }`} />
                                </div>
                                <div className="space-y-0.5">
                                  <h4 className="text-xs font-black text-white group-hover:text-blue-400 transition-colors">{emp.name}</h4>
                                  <p className="text-[10px] text-slate-400">{emp.position}</p>
                                  <span className="text-[9px] font-black uppercase text-blue-400 block tracking-wider pt-0.5">{emp.department}</span>
                                </div>
                              </div>
                              <div className="flex flex-col items-end gap-1 shrink-0">
                                <span className="text-[9px] text-slate-500 font-bold">{emp.averageResponseTime} SLA</span>
                                <ChevronRight className="w-4 h-4 text-slate-600 group-hover:text-white group-hover:translate-x-0.5 transition-all" />
                              </div>
                            </button>
                          ))}
                        </div>
                      )}
                    </motion.div>
                  ) : (
                    <motion.div 
                      key="chat"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="flex-1 flex flex-col h-full bg-slate-950 relative"
                    >
                      {/* Active Officer Mini Header */}
                      <div className="p-3 bg-slate-900/60 border-b border-white/5 flex items-center justify-between px-4">
                        <div className="flex items-center gap-2.5">
                          <button
                            onClick={() => setSelectedEmployee(null)}
                            className="p-1 hover:bg-white/10 rounded-lg text-slate-400 hover:text-white transition-colors"
                            title="Back to Station Directory"
                          >
                            <ChevronLeft className="w-4 h-4" />
                          </button>
                          <img 
                            src={selectedEmployee.photoUrl} 
                            alt={selectedEmployee.name} 
                            className="w-8 h-8 rounded-lg object-cover border border-white/10"
                            referrerPolicy="no-referrer"
                          />
                          <div>
                            <h4 className="text-xs font-black text-white leading-tight">{selectedEmployee.name}</h4>
                            <span className="text-[9px] text-slate-400 block leading-none mt-0.5">{selectedEmployee.department} • 24/7 Live Desk</span>
                          </div>
                        </div>

                        {/* Status tag */}
                        <div className="flex items-center gap-1.5 bg-slate-950 border border-white/5 px-2.5 py-1 rounded-lg">
                          <span className={`w-1.5 h-1.5 rounded-full ${
                            selectedEmployee.status === 'Available' ? 'bg-emerald-500 animate-pulse' :
                            selectedEmployee.status === 'Busy' ? 'bg-amber-500' : 'bg-slate-500'
                          }`} />
                          <span className="text-[9px] font-black text-emerald-400 uppercase tracking-wider">24/7 ONLINE</span>
                        </div>
                      </div>

                      {/* Messages Viewport */}
                      <div className="flex-1 p-4 overflow-y-auto space-y-4 custom-scrollbar">
                        {chatMessages.map((msg, idx) => (
                          <div 
                            key={idx}
                            className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
                          >
                            <div className={`max-w-[85%] rounded-2xl p-3.5 text-xs leading-relaxed space-y-1.5 ${
                              msg.sender === 'user' 
                                ? 'bg-blue-600 text-white rounded-br-none shadow-lg shadow-blue-600/10' 
                                : msg.ticketId 
                                  ? 'bg-red-500/10 border border-red-500/20 text-red-300 rounded-bl-none shadow-inner' 
                                  : 'bg-slate-900 text-slate-200 border border-white/5 rounded-bl-none'
                            }`}>
                              {/* Icon block for escalated tickets */}
                              {msg.ticketId && (
                                <div className="flex items-center gap-2 mb-1.5 border-b border-red-500/10 pb-1 text-red-400 font-black tracking-wider uppercase text-[10px]">
                                  <ShieldAlert className="w-3.5 h-3.5" />
                                  Administrative Escalation
                                </div>
                              )}
                              
                              <p className="whitespace-pre-wrap">{msg.text}</p>
                              
                              <span className="block text-[8px] opacity-60 text-right mt-1">
                                {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>
                          </div>
                        ))}

                        {/* Typing indicator */}
                        {isTyping && (
                          <div className="flex justify-start">
                            <div className="bg-slate-900 text-slate-400 border border-white/5 rounded-2xl rounded-bl-none p-3.5 flex items-center gap-1">
                              <span className="text-[10px] italic pr-1">Agent is analyzing ledger...</span>
                              <div className="flex gap-1">
                                <span className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                                <span className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                                <span className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                              </div>
                            </div>
                          </div>
                        )}
                        <div ref={messagesEndRef} />
                      </div>

                      {/* Quick suggested chips */}
                      {chatMessages.length > 0 && !isTyping && (
                        <div className="px-4 py-2 flex gap-1.5 overflow-x-auto shrink-0 border-t border-white/5 bg-slate-950">
                          {quickReplies.map((reply, idx) => (
                            <button
                              key={idx}
                              onClick={() => handleSendMessage(reply.prompt)}
                              className="bg-slate-900/60 hover:bg-slate-900 border border-white/5 hover:border-white/10 text-[10px] font-bold text-slate-300 hover:text-white px-2.5 py-1.5 rounded-lg whitespace-nowrap shrink-0 transition-colors"
                            >
                              {reply.label}
                            </button>
                          ))}
                        </div>
                      )}

                      {/* Footer Inputs */}
                      <div className="p-3 border-t border-white/10 bg-slate-900/20 flex gap-2">
                        <input
                          type="text"
                          placeholder={`Type messages to ${selectedEmployee.name.split(' ')[0]}...`}
                          value={inputMessage}
                          onChange={(e) => setInputMessage(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleSendMessage(inputMessage);
                          }}
                          className="flex-1 bg-slate-950 border border-white/10 px-4 py-2.5 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500/50"
                        />
                        <button
                          onClick={() => handleSendMessage(inputMessage)}
                          className="w-10 h-10 bg-blue-600 hover:bg-blue-500 text-white rounded-xl flex items-center justify-center transition-all shadow-md active:scale-95 shrink-0"
                        >
                          <Send className="w-4 h-4 text-white" />
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
