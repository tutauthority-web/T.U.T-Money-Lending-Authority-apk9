import React, { useState, useEffect } from 'react';
import { 
  collection, 
  getDocs, 
  addDoc, 
  updateDoc, 
  setDoc,
  doc, 
  onSnapshot, 
  query, 
  orderBy,
  where
} from 'firebase/firestore';
import { db } from '../firebase';
import { Employee, SupportTicket, WorkforceReport } from '../types/workforce';
import { generateHumanEmployeeResponse } from '../utils/workforceKnowledge';
import { 
  Users, 
  UserPlus, 
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
  UploadCloud, 
  Download, 
  BookOpen, 
  Trash2, 
  Plus, 
  FileJson, 
  UserCheck, 
  Smile, 
  ShieldAlert, 
  ArrowLeft, 
  LogOut 
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

const CANNED_REPLIES = [
  { label: "Member Dossier", text: "Hello! Here is your verified file on record: Member ID, active borrowing limit, current debt, and deposit reserves are synchronized 24/7." },
  { label: "Loan Due & Limit", text: "Your current active loan balance and remaining borrowing limit are displayed directly in your portal header. Settle anytime via the Repayment tab." },
  { label: "Deposit Withdrawal", text: "Member Deposit Reserves are held in a segregated ring-fenced vault separate from loan capital and can be withdrawn anytime upon request." },
  { label: "Repayment Guidance", text: "Repayments can be completed via bKash, Nagad, or Bank Transfer under the Repayment tab. Simply transfer and submit your Transaction ID." },
  { label: "Approval Time", text: "Loan verification and deposit reconciliations are completed within 30 minutes to 2 hours during active banking cycles." },
  { label: "Verify Income", text: "Hello! I am reviewing your file. Could you please upload your latest income verification document?" },
  { label: "Expedite Loan", text: "Apologies for any latency in our queue. I have personally flagged your loan application for priority review." },
  { label: "General Greeting", text: "Wa Alaikum Assalam! Thank you for contacting T.U.T Headquarters support. I am at your service 24/7." }
];

export const WorkforceManagement: React.FC<WorkforceManagementProps> = ({ systemStats, currentUser, isAdmin = false }) => {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'employees' | 'tickets' | 'analytics' | 'reports' | 'my_desk'>('employees');
  
  // My Officer Desk State
  const [activeChats, setActiveChats] = useState<any[]>([]);
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
  const [chatReplyText, setChatReplyText] = useState('');
  
  // My Profile Edit States
  const [myPhoto, setMyPhoto] = useState('');
  const [myPos, setMyPos] = useState('');
  const [myDept, setMyDept] = useState('Customer Support');
  const [myStatus, setMyStatus] = useState<'Available' | 'Busy' | 'Offline'>('Available');
  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false);

  // Modals / Form States
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [reportType, setReportType] = useState<'daily' | 'weekly' | 'monthly'>('daily');
  const [generatedReport, setGeneratedReport] = useState<string | null>(null);
  const [generatingReport, setGeneratingReport] = useState(false);

  // Expanded / Comfort Live Chat states
  const [isChatMaximized, setIsChatMaximized] = useState(false);
  const [chatMode, setChatMode] = useState<'member' | 'staff'>('member');
  const [selectedStaffId, setSelectedStaffId] = useState<string | null>(null);
  const [staffChats, setStaffChats] = useState<any[]>([]);
  const [staffReplyText, setStaffReplyText] = useState('');
  const [isSendingStaffMsg, setIsSendingStaffMsg] = useState(false);

  // File Drag & Drop Import states
  const [isDragOver, setIsDragOver] = useState(false);
  const [importStatus, setImportStatus] = useState<{ success?: number; error?: string; message?: string } | null>(null);

  // Interactive AI Tuning Sandbox states
  const [showTuningModal, setShowTuningModal] = useState(false);
  const [tuningPrompt, setTuningPrompt] = useState('');
  const [tuningTemp, setTuningTemp] = useState(0.4);
  const [sandboxMessages, setSandboxMessages] = useState<any[]>([]);
  const [sandboxInput, setSandboxInput] = useState('');
  const [isSandboxTyping, setIsSandboxTyping] = useState(false);

  // New Employee Form States
  const [empName, setEmpName] = useState('');
  const [empDept, setEmpDept] = useState('Customer Support');
  const [empPos, setEmpPos] = useState('Support Associate');
  const [empPhoto, setEmpPhoto] = useState('');
  const [empType, setEmpType] = useState<'Digital Employee' | 'Human Employee'>('Digital Employee');
  const [empStatus, setEmpStatus] = useState<'Available' | 'Busy' | 'Offline'>('Available');
  const [empAiCode, setEmpAiCode] = useState('');
  const [empScore, setEmpScore] = useState(98);

  // Ticket Filters
  const [ticketFilter, setTicketFilter] = useState<'all' | 'Open' | 'In Progress' | 'Resolved'>('all');
  const [ticketSearch, setTicketSearch] = useState('');

  // Default portrait URLs
  const defaultPortraits = [
    'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&q=80&w=200',
    'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=200',
    'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=200',
    'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&q=80&w=200',
    'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&q=80&w=200'
  ];

  // Load and seed workforce data
  useEffect(() => {
    // 1. Listen to Employees collection
    const unsubEmployees = onSnapshot(collection(db, 'employees'), async (snapshot) => {
      let emps: Employee[] = [];
      snapshot.forEach((doc) => {
        emps.push({ id: doc.id, ...doc.data() } as Employee);
      });

      // If empty, let's seed initial digital/human employees
      if (emps.length === 0) {
        const initialEmployees: Omit<Employee, 'id'>[] = [
          {
            name: 'Tusnut Jahan',
            photoUrl: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&q=80&w=200',
            department: 'Customer Support',
            position: 'AI Operations Desk lead',
            joinedDate: '2024-03-01',
            status: 'Available',
            performanceScore: 99,
            employeeType: 'Digital Employee',
            internalAiCode: 'AI-CS-001',
            aiModelVersion: 'Gemini 3.5 Flash',
            knowledgeVersion: 'v3.5.2',
            lastUpdated: new Date().toISOString(),
            averageResponseTime: '< 1 min',
            customerSatisfaction: '4.95/5',
            totalChats: 412
          },
          {
            name: 'Adnan Chowdhury',
            photoUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=200',
            department: 'Member Support',
            position: 'AI Borrowing Specialist',
            joinedDate: '2024-04-12',
            status: 'Available',
            performanceScore: 98,
            employeeType: 'Digital Employee',
            internalAiCode: 'AI-MS-002',
            aiModelVersion: 'Gemini 3.5 Flash',
            knowledgeVersion: 'v3.5.1',
            lastUpdated: new Date().toISOString(),
            averageResponseTime: '< 1 min',
            customerSatisfaction: '4.88/5',
            totalChats: 289
          },
          {
            name: 'Sajib Rahman',
            photoUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&q=80&w=200',
            department: 'Technical Support',
            position: 'AI Cyber ledger Officer',
            joinedDate: '2024-05-18',
            status: 'Available',
            performanceScore: 97,
            employeeType: 'Digital Employee',
            internalAiCode: 'AI-TS-003',
            aiModelVersion: 'Gemini 3.5 Flash',
            knowledgeVersion: 'v3.5.3',
            lastUpdated: new Date().toISOString(),
            averageResponseTime: '1 min',
            customerSatisfaction: '4.91/5',
            totalChats: 174
          },
          {
            name: 'Farhana Yasmin',
            photoUrl: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&q=80&w=200',
            department: 'Information Desk',
            position: 'AI Policy Desk Advisor',
            joinedDate: '2024-01-20',
            status: 'Busy',
            performanceScore: 96,
            employeeType: 'Digital Employee',
            internalAiCode: 'AI-ID-004',
            aiModelVersion: 'Gemini 3.5 Flash',
            knowledgeVersion: 'v3.5.0',
            lastUpdated: new Date().toISOString(),
            averageResponseTime: '< 2 mins',
            customerSatisfaction: '4.85/5',
            totalChats: 322
          },
          {
            name: 'Tahsin Ullah Tusher',
            photoUrl: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?auto=format&fit=crop&q=80&w=200',
            department: 'Customer Support',
            position: 'Human Director / Founder',
            joinedDate: '2023-01-10',
            status: 'Offline',
            performanceScore: 100,
            employeeType: 'Human Employee',
            lastUpdated: new Date().toISOString(),
            averageResponseTime: 'N/A',
            customerSatisfaction: '5.0/5',
            totalChats: 890
          }
        ];

        for (const emp of initialEmployees) {
          await addDoc(collection(db, 'employees'), emp);
        }
      } else {
        setEmployees(emps);
      }
    });

    // 2. Listen to Support Tickets
    const unsubTickets = onSnapshot(
      query(collection(db, 'workforce_tickets'), orderBy('createdAt', 'desc')),
      (snapshot) => {
        let tix: SupportTicket[] = [];
        snapshot.forEach((doc) => {
          tix.push({ id: doc.id, ...doc.data() } as SupportTicket);
        });
        setTickets(tix);
        setLoading(false);
      }
    );

    return () => {
      unsubEmployees();
      unsubTickets();
    };
  }, []);

  // Find my personal employee record
  const myEmployeeProfile = employees.find(
    (e) => e.name.toLowerCase() === (currentUser?.name || 'Tahsin Ullah Tusher').toLowerCase()
  );

  // Sync my local edit state with the found profile
  useEffect(() => {
    if (myEmployeeProfile) {
      setMyPhoto(myEmployeeProfile.photoUrl || '');
      setMyPos(myEmployeeProfile.position || '');
      setMyDept(myEmployeeProfile.department || 'Customer Support');
      setMyStatus(myEmployeeProfile.status || 'Available');
    }
  }, [myEmployeeProfile]);

  // Listen to live workforce workforce chats
  useEffect(() => {
    if (!currentUser) return;

    let q;
    if (isAdmin) {
      q = query(collection(db, 'workforce_chats'), orderBy('updatedAt', 'desc'));
    } else {
      q = query(
        collection(db, 'workforce_chats'),
        where('employeeName', '==', currentUser.name),
        orderBy('updatedAt', 'desc')
      );
    }

    const unsubChats = onSnapshot(
      q,
      (snapshot) => {
        let chatsList: any[] = [];
        snapshot.forEach((doc) => {
          chatsList.push({ id: doc.id, ...doc.data() });
        });
        setActiveChats(chatsList);
      },
      (err) => console.error("Error listening to workforce chats:", err)
    );

    return () => unsubChats();
  }, [currentUser, isAdmin]);

  // Listen to live workforce P2P internal staff chats
  useEffect(() => {
    if (!currentUser) return;

    let q;
    if (isAdmin) {
      // Chief Admin can oversee ALL staff P2P chats to inquire or resolve issues
      q = query(collection(db, 'workforce_p2p_chats'), orderBy('updatedAt', 'desc'));
    } else {
      // Human employees see only their conversations
      q = query(
        collection(db, 'workforce_p2p_chats'),
        where('participants', 'array-contains', currentUser.uid || 'admin-uid'),
        orderBy('updatedAt', 'desc')
      );
    }

    const unsubStaff = onSnapshot(
      q,
      (snapshot) => {
        let staffChatsList: any[] = [];
        snapshot.forEach((doc) => {
          staffChatsList.push({ id: doc.id, ...doc.data() });
        });
        setStaffChats(staffChatsList);
      },
      (err) => console.error("Error listening to staff P2P chats:", err)
    );

    return () => unsubStaff();
  }, [currentUser, isAdmin]);

  // Update personal employee profile handler
  const handleUpdateMyProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!myEmployeeProfile) return;
    setIsUpdatingProfile(true);

    try {
      await updateDoc(doc(db, 'employees', myEmployeeProfile.id), {
        photoUrl: myPhoto.trim() || 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?auto=format&fit=crop&q=80&w=200',
        position: myPos.trim() || 'Human Director / Founder',
        department: myDept,
        status: myStatus,
        lastUpdated: new Date().toISOString()
      });
    } catch (err) {
      console.error("Error updating personal employee profile:", err);
    } finally {
      setIsUpdatingProfile(false);
    }
  };

  // Register personal employee profile if missing
  const handleRegisterMyProfile = async () => {
    const newEmp: Omit<Employee, 'id'> = {
      name: currentUser?.name || 'Tahsin Ullah Tusher',
      photoUrl: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?auto=format&fit=crop&q=80&w=200',
      department: 'Customer Support',
      position: 'Human Director / Founder',
      joinedDate: new Date().toISOString().split('T')[0],
      status: 'Available',
      performanceScore: 100,
      employeeType: 'Human Employee',
      lastUpdated: new Date().toISOString(),
      averageResponseTime: 'N/A',
      customerSatisfaction: '5.0/5',
      totalChats: 0
    };

    try {
      await addDoc(collection(db, 'employees'), newEmp);
    } catch (err) {
      console.error("Error registering employee profile:", err);
    }
  };

  // Send message back to user chat session from officer terminal
  const handleSendChatReply = async (e: React.FormEvent, chatId: string, currentMessages: any[]) => {
    e.preventDefault();
    if (!chatReplyText.trim()) return;

    const newReply = {
      sender: 'employee',
      text: chatReplyText.trim(),
      timestamp: Date.now()
    };

    const updatedMessages = [...currentMessages, newReply];

    try {
      await updateDoc(doc(db, 'workforce_chats', chatId), {
        messages: updatedMessages,
        lastMessage: chatReplyText.trim(),
        updatedAt: Date.now()
      });
      setChatReplyText('');
    } catch (err) {
      console.error("Error sending message to workforce chat:", err);
    }
  };

  // Add Employee Handler
  const handleAddEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!empName.trim() || !empPos.trim()) return;

    const randomPhoto = defaultPortraits[Math.floor(Math.random() * defaultPortraits.length)];
    const finalPhoto = empPhoto.trim() || randomPhoto;

    const newEmp: Omit<Employee, 'id'> = {
      name: empName.trim(),
      photoUrl: finalPhoto,
      department: empDept,
      position: empPos.trim(),
      joinedDate: new Date().toISOString().split('T')[0],
      status: empStatus,
      performanceScore: empScore,
      employeeType: empType,
      internalAiCode: empType === 'Digital Employee' ? (empAiCode.trim() || `AI-USER-${Math.floor(100 + Math.random() * 900)}`) : undefined,
      aiModelVersion: empType === 'Digital Employee' ? 'Gemini 3.5 Flash' : undefined,
      knowledgeVersion: empType === 'Digital Employee' ? 'v3.5.0' : undefined,
      lastUpdated: new Date().toISOString(),
      averageResponseTime: empType === 'Digital Employee' ? '< 1 min' : '2 Hours',
      customerSatisfaction: '5.0/5',
      totalChats: 0
    };

    try {
      await addDoc(collection(db, 'employees'), newEmp);
      setShowAddModal(false);
      // Reset form
      setEmpName('');
      setEmpPos('');
      setEmpPhoto('');
      setEmpAiCode('');
      setEmpScore(98);
    } catch (err) {
      console.error("Error adding employee:", err);
    }
  };

  // Open Tuning Modal with loaded values
  const handleOpenTuning = (emp: Employee) => {
    setEditingEmployee(emp);
    setTuningPrompt(emp.customPrompt || '');
    setTuningTemp(emp.temperature !== undefined ? emp.temperature : 0.4);
    setSandboxMessages([
      {
        sender: 'employee',
        text: `Hello Admin! I am ${emp.name}, operating as the ${emp.position} in ${emp.department}. I am ready to test your system instructions. How can I assist you in operations today?`,
        timestamp: Date.now()
      }
    ]);
    setSandboxInput('');
    setShowTuningModal(true);
  };

  // Save AI Employee Custom Prompt & Temperature
  const handleSaveTuning = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingEmployee) return;

    try {
      await updateDoc(doc(db, 'employees', editingEmployee.id), {
        customPrompt: tuningPrompt,
        temperature: tuningTemp,
        lastUpdated: new Date().toISOString()
      });
      // Update locally
      setEmployees(prev => prev.map(emp => {
        if (emp.id === editingEmployee.id) {
          return { ...emp, customPrompt: tuningPrompt, temperature: tuningTemp };
        }
        return emp;
      }));
      setShowTuningModal(false);
    } catch (err) {
      console.error("Error saving AI tuning configuration:", err);
    }
  };

  // Run a sandbox test chat with the tuned digital employee
  const handleSendSandboxMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sandboxInput.trim() || !editingEmployee) return;

    const userMsg = {
      sender: 'user',
      text: sandboxInput.trim(),
      timestamp: Date.now()
    };

    const newMsgs = [...sandboxMessages, userMsg];
    setSandboxMessages(newMsgs);
    setSandboxInput('');
    setIsSandboxTyping(true);

    try {
      const response = await fetch('/api/digital-workforce/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: newMsgs,
          employee: {
            id: editingEmployee.id,
            name: editingEmployee.name,
            department: editingEmployee.department,
            customPrompt: tuningPrompt,
            temperature: tuningTemp
          },
          userContext: systemStats || {},
          isAdmin: true
        })
      });

      const data = await response.json();
      setIsSandboxTyping(false);
      setSandboxMessages([...newMsgs, {
        sender: 'employee',
        text: data.response || "No response received. Please check backend log.",
        timestamp: Date.now()
      }]);
    } catch (err) {
      console.error("Sandbox simulation error - using 24/7 knowledge fallback:", err);
      setIsSandboxTyping(false);
      const fallback = generateHumanEmployeeResponse(sandboxInput.trim() || userMsg.text, systemStats as any, editingEmployee, true);
      setSandboxMessages([...newMsgs, {
        sender: 'employee',
        text: fallback.response,
        timestamp: Date.now()
      }]);
    }
  };

  // Send message back to internal staff chat session
  const handleSendStaffMessage = async (e: React.FormEvent, targetEmployee: Employee, currentMessages: any[]) => {
    e.preventDefault();
    if (!staffReplyText.trim() || !currentUser) return;

    const messageText = staffReplyText.trim();
    setStaffReplyText('');
    setIsSendingStaffMsg(true);

    const newMsg = {
      senderId: currentUser.uid || 'admin',
      senderName: currentUser.name || 'Chief Admin',
      text: messageText,
      timestamp: Date.now()
    };

    const updatedMessages = [...currentMessages, newMsg];
    const channelId = `${currentUser.uid || 'admin'}_${targetEmployee.id}`;

    try {
      // 1. Write the user's message to Firestore workforce_p2p_chats
      await setDoc(doc(db, 'workforce_p2p_chats', channelId), {
        id: channelId,
        participants: [currentUser.uid || 'admin', targetEmployee.id],
        messages: updatedMessages,
        lastMessage: messageText,
        updatedAt: Date.now(),
        employeeId: targetEmployee.id,
        employeeName: targetEmployee.name,
        employeePhoto: targetEmployee.photoUrl,
        employeePosition: targetEmployee.position,
        initiatorId: currentUser.uid || 'admin',
        initiatorName: currentUser.name || 'Chief Admin'
      }, { merge: true });

      // 2. If the recipient is a Digital Employee (AI Agent), trigger Gemini response!
      if (targetEmployee.employeeType === 'Digital Employee') {
        const apiMessages = updatedMessages.map(msg => ({
          sender: msg.senderId === targetEmployee.id ? 'employee' : 'user',
          text: msg.text
        }));

        const response = await fetch('/api/digital-workforce/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messages: apiMessages,
            employee: {
              id: targetEmployee.id,
              name: targetEmployee.name,
              department: targetEmployee.department,
              customPrompt: targetEmployee.customPrompt || '',
              temperature: targetEmployee.temperature !== undefined ? targetEmployee.temperature : 0.4
            },
            userContext: systemStats || {},
            isAdmin: true
          })
        });

        const data = await response.json();
        const aiText = data.response || "Operational message processed. System core fully synchronized.";

        const aiMsg = {
          senderId: targetEmployee.id,
          senderName: targetEmployee.name,
          text: aiText,
          timestamp: Date.now()
        };

        // Append Gemini's response to Firestore
        await setDoc(doc(db, 'workforce_p2p_chats', channelId), {
          messages: [...updatedMessages, aiMsg],
          lastMessage: aiText,
          updatedAt: Date.now()
        }, { merge: true });
      }
    } catch (err) {
      console.error("Error sending staff P2P message:", err);
    } finally {
      setIsSendingStaffMsg(false);
    }
  };

  // Handle Drag & Drop states
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleFileDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      await processImportFile(files[0]);
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      await processImportFile(files[0]);
    }
  };

  const processImportFile = async (file: File) => {
    setImportStatus(null);

    // Intercept image files and handle gracefully as custom profile pictures
    if (file.type.startsWith('image/') || /\.(jpe?g|png|gif|webp)$/i.test(file.name)) {
      const imgReader = new FileReader();
      imgReader.onload = async (event) => {
        try {
          const base64Url = event.target?.result as string;
          if (activeTab === 'my_desk') {
            setMyPhoto(base64Url);
            setImportStatus({
              success: 1,
              message: `Loaded image "${file.name}" into your personal profile! Don't forget to click Save below.`
            });
          } else {
            setEmpPhoto(base64Url);
            setShowAddModal(true);
            setImportStatus({
              success: 1,
              message: `Loaded image "${file.name}" into the "Station New Officer" form! Choose details and click Confirm.`
            });
          }
        } catch (err: any) {
          console.error("Error processing image file:", err);
          setImportStatus({ error: "Failed to process image file." });
        }
      };
      imgReader.readAsDataURL(file);
      return;
    }

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const text = event.target?.result as string;
        const parsed = JSON.parse(text);
        
        let profilesToImport: any[] = [];
        if (Array.isArray(parsed)) {
          profilesToImport = parsed;
        } else if (typeof parsed === 'object' && parsed !== null) {
          profilesToImport = [parsed];
        } else {
          throw new Error("File content must be a valid JSON array or object containing employee profiles.");
        }

        let importCount = 0;
        for (const item of profilesToImport) {
          if (!item.name || !item.position || !item.department) {
            continue; // Skip invalid rows
          }
          
          const newEmp: Omit<Employee, 'id'> = {
            name: item.name.trim(),
            photoUrl: item.photoUrl || defaultPortraits[Math.floor(Math.random() * defaultPortraits.length)],
            department: item.department,
            position: item.position.trim(),
            joinedDate: item.joinedDate || new Date().toISOString().split('T')[0],
            status: item.status || 'Available',
            performanceScore: item.performanceScore || 98,
            employeeType: item.employeeType || 'Digital Employee',
            internalAiCode: item.internalAiCode || `AI-GEN-${Math.floor(100 + Math.random() * 900)}`,
            aiModelVersion: item.aiModelVersion || 'Gemini 3.5 Flash',
            knowledgeVersion: item.knowledgeVersion || 'v1.0.0',
            lastUpdated: new Date().toISOString(),
            averageResponseTime: item.averageResponseTime || '< 1 min',
            customerSatisfaction: item.customerSatisfaction || '4.9/5',
            totalChats: item.totalChats || 0,
            customPrompt: item.customPrompt || '',
            temperature: item.temperature !== undefined ? item.temperature : 0.4
          };

          await addDoc(collection(db, 'employees'), newEmp);
          importCount++;
        }

        setImportStatus({ success: importCount });
      } catch (err: any) {
        console.error("Error importing file:", err);
        setImportStatus({ error: err?.message || "Failed to parse JSON file." });
      }
    };
    reader.readAsText(file);
  };

  const handleExportJSON = () => {
    const cleanEmps = employees.map(({ id, ...rest }) => rest);
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(cleanEmps, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `TUT_Money_Lending_Employees_${new Date().toISOString().split('T')[0]}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  // Toggle Employee Status
  const handleToggleStatus = async (employeeId: string, currentStatus: 'Available' | 'Busy' | 'Offline') => {
    const statuses: ('Available' | 'Busy' | 'Offline')[] = ['Available', 'Busy', 'Offline'];
    const nextIndex = (statuses.indexOf(currentStatus) + 1) % statuses.length;
    const nextStatus = statuses[nextIndex];

    try {
      await updateDoc(doc(db, 'employees', employeeId), {
        status: nextStatus,
        lastUpdated: new Date().toISOString()
      });
    } catch (err) {
      console.error("Error updating status:", err);
    }
  };

  // Update Ticket Status
  const handleUpdateTicketStatus = async (ticketId: string, nextStatus: 'Open' | 'In Progress' | 'Resolved') => {
    try {
      await updateDoc(doc(db, 'workforce_tickets', ticketId), {
        status: nextStatus,
        updatedAt: Date.now()
      });
    } catch (err) {
      console.error("Error updating ticket:", err);
    }
  };

  // Generate AI Operation Report
  const handleGenerateReport = async () => {
    setGeneratingReport(true);
    setGeneratedReport(null);

    try {
      const response = await fetch('/api/digital-workforce/report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reportType,
          systemStats
        })
      });

      const data = await response.json();
      if (data.success) {
        setGeneratedReport(data.reportMarkdown);
      } else {
        setGeneratedReport("Failed to compile report. Please verify your Gemini API Key configuration.");
      }
    } catch (err: any) {
      console.error("Report generation failed:", err);
      setGeneratedReport(`Network error occurred during report synthesis: ${err.message}`);
    } finally {
      setGeneratingReport(false);
    }
  };

  // Filtered Tickets
  const filteredTickets = tickets.filter(t => {
    const matchesFilter = ticketFilter === 'all' || t.status === ticketFilter;
    const matchesSearch = t.userName.toLowerCase().includes(ticketSearch.toLowerCase()) || 
                          t.userEmail.toLowerCase().includes(ticketSearch.toLowerCase()) || 
                          t.description.toLowerCase().includes(ticketSearch.toLowerCase()) ||
                          t.id.toLowerCase().includes(ticketSearch.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  return (
    <div className="space-y-6">
      {/* Header Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-slate-900/60 border border-white/5 p-4 rounded-2xl flex items-center justify-between shadow-xl">
          <div className="space-y-1">
            <span className="text-xs text-slate-400 font-bold uppercase tracking-wider block">Active Workforce</span>
            <div className="text-2xl font-black text-white">{employees.length} Officers</div>
            <span className="text-[10px] text-emerald-400 font-bold block">
              {employees.filter(e => e.employeeType === 'Digital Employee').length} AI Agents Active
            </span>
          </div>
          <div className="w-12 h-12 bg-blue-600/10 text-blue-400 rounded-xl flex items-center justify-center">
            <Users className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-slate-900/60 border border-white/5 p-4 rounded-2xl flex items-center justify-between shadow-xl">
          <div className="space-y-1">
            <span className="text-xs text-slate-400 font-bold uppercase tracking-wider block">Escalated Tickets</span>
            <div className="text-2xl font-black text-white">
              {tickets.filter(t => t.status !== 'Resolved').length} Active
            </div>
            <span className="text-[10px] text-amber-400 font-bold block">
              {tickets.filter(t => t.status === 'Open').length} Unassigned / Open
            </span>
          </div>
          <div className="w-12 h-12 bg-amber-500/10 text-amber-400 rounded-xl flex items-center justify-center">
            <AlertCircle className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-slate-900/60 border border-white/5 p-4 rounded-2xl flex items-center justify-between shadow-xl">
          <div className="space-y-1">
            <span className="text-xs text-slate-400 font-bold uppercase tracking-wider block">Avg Resolution Time</span>
            <div className="text-2xl font-black text-white">4.2 Mins</div>
            <span className="text-[10px] text-emerald-400 font-bold block">Digital Agent SLA Met 100%</span>
          </div>
          <div className="w-12 h-12 bg-emerald-500/10 text-emerald-400 rounded-xl flex items-center justify-center">
            <Clock className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-slate-900/60 border border-white/5 p-4 rounded-2xl flex items-center justify-between shadow-xl">
          <div className="space-y-1">
            <span className="text-xs text-slate-400 font-bold uppercase tracking-wider block">Operational CSAT</span>
            <div className="text-2xl font-black text-white">4.92 / 5</div>
            <span className="text-[10px] text-blue-400 font-bold block">Based on {employees.reduce((acc, curr) => acc + curr.totalChats, 0)} chats</span>
          </div>
          <div className="w-12 h-12 bg-purple-500/10 text-purple-400 rounded-xl flex items-center justify-center">
            <ThumbsUp className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="flex border-b border-white/10 gap-2 overflow-x-auto pb-px">
        <button
          onClick={() => setActiveTab('employees')}
          className={`px-4 py-3 text-xs uppercase tracking-widest font-black border-b-2 transition-all shrink-0 flex items-center gap-2 ${
            activeTab === 'employees' 
              ? 'border-blue-500 text-white bg-blue-500/5' 
              : 'border-transparent text-slate-400 hover:text-white hover:bg-white/[0.01]'
          }`}
        >
          <Users className="w-3.5 h-3.5" />
          Employees Directory
        </button>
        <button
          onClick={() => setActiveTab('tickets')}
          className={`px-4 py-3 text-xs uppercase tracking-widest font-black border-b-2 transition-all shrink-0 flex items-center gap-2 ${
            activeTab === 'tickets' 
              ? 'border-blue-500 text-white bg-blue-500/5' 
              : 'border-transparent text-slate-400 hover:text-white hover:bg-white/[0.01]'
          }`}
        >
          <AlertCircle className="w-3.5 h-3.5" />
          Support Tickets
          {tickets.filter(t => t.status !== 'Resolved').length > 0 && (
            <span className="bg-amber-500 text-slate-950 text-[10px] font-black px-2 py-0.5 rounded-full">
              {tickets.filter(t => t.status !== 'Resolved').length}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('analytics')}
          className={`px-4 py-3 text-xs uppercase tracking-widest font-black border-b-2 transition-all shrink-0 flex items-center gap-2 ${
            activeTab === 'analytics' 
              ? 'border-blue-500 text-white bg-blue-500/5' 
              : 'border-transparent text-slate-400 hover:text-white hover:bg-white/[0.01]'
          }`}
        >
          <Activity className="w-3.5 h-3.5" />
          Performance Analytics
        </button>
        <button
          onClick={() => setActiveTab('reports')}
          className={`px-4 py-3 text-xs uppercase tracking-widest font-black border-b-2 transition-all shrink-0 flex items-center gap-2 ${
            activeTab === 'reports' 
              ? 'border-blue-500 text-white bg-blue-500/5' 
              : 'border-transparent text-slate-400 hover:text-white hover:bg-white/[0.01]'
          }`}
        >
          <FileText className="w-3.5 h-3.5" />
          AI Operation Reports
        </button>
        <button
          onClick={() => setActiveTab('my_desk')}
          className={`px-4 py-3 text-xs uppercase tracking-widest font-black border-b-2 transition-all shrink-0 flex items-center gap-2 ${
            activeTab === 'my_desk' 
              ? 'border-blue-500 text-white bg-blue-500/5' 
              : 'border-transparent text-slate-400 hover:text-white hover:bg-white/[0.01]'
          }`}
        >
          <MessageSquare className="w-3.5 h-3.5 text-blue-400" />
          My Officer Desk
        </button>
      </div>

      {/* Main Content Area */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 space-y-4">
          <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
          <span className="text-sm text-slate-400 font-bold uppercase tracking-wider">Loading Digital Workforce...</span>
        </div>
      ) : (
        <>
          {/* TAB 1: EMPLOYEES DIRECTORY */}
          {activeTab === 'employees' && (
            <div className="space-y-6">
              {/* Header and Quick Actions */}
              <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 bg-slate-900/20 p-6 rounded-3xl border border-white/5">
                <div className="space-y-1">
                  <h3 className="text-lg font-black text-white flex items-center gap-2">
                    <Users className="w-5 h-5 text-blue-500 animate-pulse" />
                    ACTIVE STAFF ALLOCATION
                  </h3>
                  <p className="text-xs text-slate-400">Manage digital agents & human employees, tune AI core system prompts, and upload staff profiles.</p>
                </div>
                
                <div className="flex flex-wrap gap-2.5 items-center">
                  <button
                    onClick={() => setShowAddModal(true)}
                    className="flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 text-white text-xs uppercase tracking-widest font-black px-4 py-3 rounded-xl shadow-lg shadow-blue-600/20 active:scale-95 transition-all"
                  >
                    <UserPlus className="w-4 h-4" />
                    Station Officer
                  </button>

                  <button
                    onClick={handleExportJSON}
                    className="flex items-center justify-center gap-2 bg-slate-900 hover:bg-slate-800 text-slate-300 text-xs uppercase tracking-widest font-black px-4 py-3 rounded-xl border border-white/10 active:scale-95 transition-all"
                    title="Export employee directory database to JSON"
                  >
                    <Download className="w-4 h-4" />
                    Export Database
                  </button>
                </div>
              </div>

              {/* Drag & Drop File Import Drawer */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="md:col-span-2">
                  <div
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleFileDrop}
                    className={`border-2 border-dashed rounded-3xl p-6 transition-all duration-300 flex flex-col md:flex-row items-center justify-between gap-6 ${
                      isDragOver 
                        ? 'border-blue-500 bg-blue-500/10 text-white shadow-2xl scale-[1.01]' 
                        : 'border-white/10 bg-slate-900/30 hover:border-white/20'
                    }`}
                  >
                    <div className="flex items-center gap-4 text-left">
                      <div className="w-12 h-12 rounded-2xl bg-blue-500/10 text-blue-400 flex items-center justify-center shrink-0">
                        <UploadCloud className="w-6 h-6 animate-bounce" style={{ animationDuration: '3s' }} />
                      </div>
                      <div>
                        <h4 className="text-xs font-black text-white uppercase tracking-wider">Drag & Drop Staff JSON or Image</h4>
                        <p className="text-[10px] text-slate-400 max-w-sm mt-0.5 leading-relaxed">
                          Drop a compliant <code>.json</code> file to bulk-import profiles, or drop an <strong>image file</strong> to instantly draft or update a custom profile photo!
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-col items-end gap-2 shrink-0 w-full md:w-auto">
                      <label className="w-full md:w-auto text-center cursor-pointer bg-slate-950 hover:bg-slate-900 border border-white/10 text-slate-300 text-[10px] uppercase tracking-widest font-black px-4 py-3 rounded-xl transition-all block">
                        Browse Profiles / Photo
                        <input
                          type="file"
                          accept=".json,image/*"
                          onChange={handleFileSelect}
                          className="hidden"
                        />
                      </label>
                    </div>
                  </div>
                </div>

                {/* Import Status Banner / Preset Helper */}
                <div className="bg-slate-900/20 border border-white/5 rounded-3xl p-5 flex flex-col justify-center space-y-2">
                  {importStatus ? (
                    <div className="space-y-1">
                      {importStatus.success !== undefined ? (
                        <>
                          <div className="flex items-center gap-1.5 text-emerald-400 text-xs font-black uppercase">
                            <CheckCircle className="w-4 h-4" />
                            Import Successful!
                          </div>
                          <p className="text-[11px] text-slate-400 leading-relaxed">
                            {importStatus.message || `Successfully imported ${importStatus.success} new officer cards into the Firestore registry.`}
                          </p>
                        </>
                      ) : (
                        <>
                          <div className="flex items-center gap-1.5 text-rose-400 text-xs font-black uppercase">
                            <AlertCircle className="w-4 h-4" />
                            Import Failed
                          </div>
                          <p className="text-[10px] text-slate-400 line-clamp-2">
                            {importStatus.error}
                          </p>
                        </>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-1 text-left">
                      <span className="text-[9px] font-black uppercase text-slate-400 tracking-wider flex items-center gap-1">
                        <FileJson className="w-3.5 h-3.5 text-yellow-500" />
                        JSON Import Template
                      </span>
                      <p className="text-[10px] text-slate-400 leading-relaxed">
                        Expected format: Array of objects with <code>name</code>, <code>position</code>, <code>department</code>, and optional <code>customPrompt</code>.
                      </p>
                    </div>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {employees.map((emp) => (
                  <div 
                    key={emp.id}
                    className="relative bg-slate-900/40 border border-white/5 rounded-3xl p-6 shadow-xl overflow-hidden hover:border-white/10 transition-all duration-300 group"
                  >
                    {/* Background visual accents */}
                    <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-blue-600/5 to-purple-500/0 rounded-full blur-2xl pointer-events-none" />

                    <div className="flex items-start justify-between gap-4 relative">
                      <div className="flex gap-4">
                        <div className="relative">
                          <img 
                            src={emp.photoUrl} 
                            alt={emp.name}
                            className="w-14 h-14 rounded-2xl object-cover border border-white/10 shadow-lg"
                            referrerPolicy="no-referrer"
                          />
                          <span className={`absolute -bottom-1 -right-1 w-4.5 h-4.5 rounded-full border-4 border-slate-950 flex items-center justify-center ${
                            emp.status === 'Available' ? 'bg-emerald-500' :
                            emp.status === 'Busy' ? 'bg-amber-500' : 'bg-slate-500'
                          }`} title={emp.status} />
                        </div>
                        <div>
                          <h4 className="text-base font-black text-white group-hover:text-blue-400 transition-colors">{emp.name}</h4>
                          <span className="text-[10px] text-slate-400 block font-semibold uppercase mt-0.5">{emp.position}</span>
                          <span className="text-[11px] text-blue-400 font-bold block mt-1">{emp.department}</span>
                        </div>
                      </div>

                      {/* Employee Type Badge (Visible only to admin dashboard) */}
                      <span className={`text-[9px] font-black uppercase tracking-wider px-2 py-1 rounded-lg ${
                        emp.employeeType === 'Digital Employee' 
                          ? 'bg-blue-600/20 text-blue-400 border border-blue-500/10' 
                          : 'bg-indigo-600/20 text-indigo-400 border border-indigo-500/10'
                      }`}>
                        {emp.employeeType === 'Digital Employee' ? 'AI Agent' : 'Human'}
                      </span>
                    </div>

                    {/* Metadata block for AI Employees */}
                    {emp.employeeType === 'Digital Employee' && (
                      <div className="mt-4 p-3 bg-slate-950/60 border border-white/5 rounded-2xl space-y-2 text-[11px]">
                        <div className="flex justify-between">
                          <span className="text-slate-400 font-semibold">EMP Code:</span>
                          <span className="text-slate-200 font-mono">{emp.internalAiCode}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400 font-semibold">Core Engine:</span>
                          <span className="text-blue-400 font-mono flex items-center gap-1">
                            <Sparkles className="w-3 h-3 text-blue-400 animate-pulse" />
                            {emp.aiModelVersion}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400 font-semibold">KB Version:</span>
                          <span className="text-purple-400 font-mono">{emp.knowledgeVersion}</span>
                        </div>
                      </div>
                    )}

                    {/* Common Stats */}
                    <div className="grid grid-cols-3 gap-2 mt-4 pt-4 border-t border-white/5 text-center">
                      <div>
                        <span className="text-[9px] text-slate-500 font-black uppercase tracking-wider block">ID</span>
                        <span className="text-xs text-white font-mono font-bold">{emp.id.substring(0, 8)}</span>
                      </div>
                      <div>
                        <span className="text-[9px] text-slate-500 font-black uppercase tracking-wider block">CSAT Score</span>
                        <span className="text-xs text-white font-bold">{emp.customerSatisfaction}</span>
                      </div>
                      <div>
                        <span className="text-[9px] text-slate-500 font-black uppercase tracking-wider block">Chats Done</span>
                        <span className="text-xs text-white font-bold">{emp.totalChats}</span>
                      </div>
                    </div>

                    {/* Actions bar */}
                    <div className="grid grid-cols-2 gap-2 mt-4 pt-4 border-t border-white/5">
                      <button
                        onClick={() => handleToggleStatus(emp.id, emp.status)}
                        className="text-[10px] font-black uppercase tracking-wider py-2 rounded-xl border border-white/10 hover:bg-white/5 text-slate-300 hover:text-white transition-all text-center flex items-center justify-center gap-1"
                        title="Toggle availability status"
                      >
                        <RefreshCw className="w-3 h-3 text-slate-400" />
                        {emp.status}
                      </button>

                      <button
                        onClick={() => {
                          setSelectedStaffId(`${currentUser?.uid || 'admin'}_${emp.id}`);
                          setChatMode('staff');
                          setActiveTab('my_desk');
                        }}
                        className="text-[10px] font-black uppercase tracking-wider py-2 rounded-xl bg-blue-600/10 hover:bg-blue-600/20 text-blue-400 hover:text-blue-300 transition-all text-center flex items-center justify-center gap-1"
                        title="Launch internal P2P Operations inquiry"
                      >
                        <MessageSquare className="w-3.5 h-3.5" />
                        P2P Chat
                      </button>

                      {emp.employeeType === 'Digital Employee' && (
                        <button
                          onClick={() => handleOpenTuning(emp)}
                          className="col-span-2 text-[10px] font-black uppercase tracking-wider py-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white shadow-md active:scale-[0.98] transition-all text-center flex items-center justify-center gap-1.5"
                        >
                          <Sliders className="w-3.5 h-3.5" />
                          Tune AI Persona & Test
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 2: SUPPORT TICKETS BOARD */}
          {activeTab === 'tickets' && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <h3 className="text-lg font-black text-white">ESCALATED COMPLIANCE TICKETS</h3>
                  <p className="text-xs text-slate-400">Review tickets created by AI Employees when a user requests manual ledger changes or overrides.</p>
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => setTicketFilter('all')}
                    className={`px-3 py-1.5 text-[11px] uppercase tracking-wider font-bold rounded-lg transition-all ${
                      ticketFilter === 'all' ? 'bg-blue-600 text-white' : 'bg-slate-900 border border-white/5 text-slate-400 hover:text-white'
                    }`}
                  >
                    All
                  </button>
                  <button
                    onClick={() => setTicketFilter('Open')}
                    className={`px-3 py-1.5 text-[11px] uppercase tracking-wider font-bold rounded-lg transition-all ${
                      ticketFilter === 'Open' ? 'bg-red-500/20 text-red-400 border border-red-500/10' : 'bg-slate-900 border border-white/5 text-slate-400 hover:text-white'
                    }`}
                  >
                    Open
                  </button>
                  <button
                    onClick={() => setTicketFilter('In Progress')}
                    className={`px-3 py-1.5 text-[11px] uppercase tracking-wider font-bold rounded-lg transition-all ${
                      ticketFilter === 'In Progress' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/10' : 'bg-slate-900 border border-white/5 text-slate-400 hover:text-white'
                    }`}
                  >
                    In Progress
                  </button>
                  <button
                    onClick={() => setTicketFilter('Resolved')}
                    className={`px-3 py-1.5 text-[11px] uppercase tracking-wider font-bold rounded-lg transition-all ${
                      ticketFilter === 'Resolved' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/10' : 'bg-slate-900 border border-white/5 text-slate-400 hover:text-white'
                    }`}
                  >
                    Resolved
                  </button>
                </div>
              </div>

              {/* Search Bar */}
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input
                  type="text"
                  placeholder="Search tickets by ID, member, or category..."
                  value={ticketSearch}
                  onChange={(e) => setTicketSearch(e.target.value)}
                  className="w-full bg-slate-950 border border-white/10 pl-11 pr-4 py-3 rounded-2xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500/50 transition-colors"
                />
              </div>

              {filteredTickets.length === 0 ? (
                <div className="bg-slate-900/20 border border-white/5 p-12 rounded-3xl text-center space-y-3">
                  <CheckCircle className="w-12 h-12 text-emerald-400 mx-auto animate-bounce" />
                  <h4 className="text-sm font-black text-white uppercase tracking-wider">ALL CLEAR! NO ACTIVE TICKETS</h4>
                  <p className="text-xs text-slate-400 max-w-sm mx-auto">No members are currently waiting on human manual intervention. AI Employees are handling all inquiries.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {filteredTickets.map((ticket) => (
                    <div 
                      key={ticket.id}
                      className="bg-slate-900/40 border border-white/5 p-6 rounded-3xl shadow-xl space-y-4 hover:border-white/10 transition-colors"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-white/5">
                        <div className="flex items-center gap-3">
                          <span className="text-xs font-mono font-bold text-blue-400 bg-blue-500/10 px-2 py-1 rounded-lg">
                            {ticket.id}
                          </span>
                          <h4 className="text-sm font-black text-white">{ticket.category}</h4>
                        </div>

                        <div className="flex items-center gap-2">
                          <span className={`text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-lg ${
                            ticket.priority === 'Urgent' ? 'bg-red-600/20 text-red-400 border border-red-500/20' :
                            ticket.priority === 'High' ? 'bg-rose-500/20 text-rose-400 border border-rose-500/10' :
                            ticket.priority === 'Medium' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/10' :
                            'bg-blue-600/20 text-blue-400 border border-blue-500/10'
                          }`}>
                            {ticket.priority} Priority
                          </span>

                          <span className={`text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-lg ${
                            ticket.status === 'Resolved' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/10' :
                            ticket.status === 'In Progress' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/10' :
                            'bg-red-500/20 text-red-400 border border-red-500/10'
                          }`}>
                            {ticket.status}
                          </span>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <p className="text-xs text-slate-300 italic">"{ticket.description}"</p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-[11px] pt-2">
                          <div>
                            <span className="text-slate-500 block font-bold uppercase tracking-wider text-[9px]">Submitted By</span>
                            <span className="text-slate-200 font-bold">{ticket.userName} ({ticket.userEmail})</span>
                          </div>
                          <div>
                            <span className="text-slate-500 block font-bold uppercase tracking-wider text-[9px]">Assigned Dept</span>
                            <span className="text-blue-400 font-bold">{ticket.assignedDepartment}</span>
                          </div>
                          <div>
                            <span className="text-slate-500 block font-bold uppercase tracking-wider text-[9px]">Estimated SLA</span>
                            <span className="text-slate-200 font-bold">{ticket.estimatedResponseTime}</span>
                          </div>
                          <div>
                            <span className="text-slate-500 block font-bold uppercase tracking-wider text-[9px]">Created Date</span>
                            <span className="text-slate-200 font-bold">{new Date(ticket.createdAt).toLocaleString()}</span>
                          </div>
                        </div>
                      </div>

                      {/* SLA Warning banner if Urgent */}
                      {ticket.priority === 'Urgent' && ticket.status !== 'Resolved' && (
                        <div className="bg-red-500/10 border border-red-500/20 p-3 rounded-2xl flex items-center gap-2 text-xs text-red-400">
                          <AlertCircle className="w-4 h-4 shrink-0 animate-pulse" />
                          <span className="font-bold uppercase tracking-wide">Lending override requested. Please review member debt ledger and approve manually.</span>
                        </div>
                      )}

                      {/* Actions */}
                      {ticket.status !== 'Resolved' && (
                        <div className="flex gap-2 justify-end pt-2">
                          {ticket.status === 'Open' && (
                            <button
                              onClick={() => handleUpdateTicketStatus(ticket.id, 'In Progress')}
                              className="text-[11px] font-black uppercase tracking-widest bg-amber-500 hover:bg-amber-400 text-slate-950 px-4 py-2 rounded-xl transition-all"
                            >
                              Mark In Progress
                            </button>
                          )}
                          <button
                            onClick={() => handleUpdateTicketStatus(ticket.id, 'Resolved')}
                            className="text-[11px] font-black uppercase tracking-widest bg-emerald-500 hover:bg-emerald-400 text-slate-950 px-4 py-2 rounded-xl transition-all flex items-center gap-1.5"
                          >
                            <Check className="w-3.5 h-3.5" />
                            Resolve Issue
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 3: PERFORMANCE ANALYTICS */}
          {activeTab === 'analytics' && (
            <div className="space-y-6">
              <div className="space-y-1">
                <h3 className="text-lg font-black text-white">WORKFORCE OPTIMIZATION AUDIT</h3>
                <p className="text-xs text-slate-400">Real-time metrics tracking digital support SLA adherence, escalation triggers, and resolution logs.</p>
              </div>

              {/* Bento Grid Analytics */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="md:col-span-2 bg-slate-900/40 border border-white/5 p-6 rounded-3xl shadow-xl space-y-4">
                  <h4 className="text-xs uppercase tracking-widest font-black text-white flex items-center gap-2">
                    <Activity className="w-4 h-4 text-blue-400" />
                    Response Time SLA Distribution (Hourly)
                  </h4>
                  <div className="h-60 flex items-end justify-between gap-3 pt-6 px-4">
                    {[35, 12, 10, 8, 4, 2, 1, 1, 1, 2, 5, 8].map((val, idx) => (
                      <div key={idx} className="flex-1 flex flex-col items-center gap-2 h-full justify-end">
                        <div 
                          style={{ height: `${(val / 35) * 100}%` }} 
                          className="w-full bg-gradient-to-t from-blue-600 to-indigo-400 rounded-t-lg group relative"
                        >
                          <span className="absolute -top-7 left-1/2 -translate-x-1/2 bg-slate-950 text-[10px] font-bold text-white px-1.5 py-0.5 rounded border border-white/10 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                            {val} chats
                          </span>
                        </div>
                        <span className="text-[10px] text-slate-500 font-bold">{idx * 2}h</span>
                      </div>
                    ))}
                  </div>
                  <div className="flex justify-between text-xs text-slate-400 pt-2 border-t border-white/5">
                    <span>98.6% of digital inquiries resolved in under 1 minute.</span>
                    <span className="text-emerald-400 font-bold">Excellent SLA Match</span>
                  </div>
                </div>

                <div className="bg-slate-900/40 border border-white/5 p-6 rounded-3xl shadow-xl space-y-4 flex flex-col justify-between">
                  <div className="space-y-4">
                    <h4 className="text-xs uppercase tracking-widest font-black text-white flex items-center gap-2">
                      <Sliders className="w-4 h-4 text-purple-400" />
                      Department Load Summary
                    </h4>
                    
                    <div className="space-y-3">
                      <div>
                        <div className="flex justify-between text-xs font-bold text-slate-200 mb-1">
                          <span>Customer Support</span>
                          <span className="text-blue-400">45% (320 chats)</span>
                        </div>
                        <div className="w-full h-1.5 bg-slate-950 rounded-full overflow-hidden">
                          <div className="w-[45%] h-full bg-blue-500" />
                        </div>
                      </div>
                      <div>
                        <div className="flex justify-between text-xs font-bold text-slate-200 mb-1">
                          <span>Member Support</span>
                          <span className="text-blue-400">30% (210 chats)</span>
                        </div>
                        <div className="w-full h-1.5 bg-slate-950 rounded-full overflow-hidden">
                          <div className="w-[30%] h-full bg-purple-500" />
                        </div>
                      </div>
                      <div>
                        <div className="flex justify-between text-xs font-bold text-slate-200 mb-1">
                          <span>Information Desk</span>
                          <span className="text-blue-400">18% (128 chats)</span>
                        </div>
                        <div className="w-full h-1.5 bg-slate-950 rounded-full overflow-hidden">
                          <div className="w-[18%] h-full bg-indigo-500" />
                        </div>
                      </div>
                      <div>
                        <div className="flex justify-between text-xs font-bold text-slate-200 mb-1">
                          <span>Technical Support</span>
                          <span className="text-blue-400">7% (52 chats)</span>
                        </div>
                        <div className="w-full h-1.5 bg-slate-950 rounded-full overflow-hidden">
                          <div className="w-[7%] h-full bg-amber-500" />
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="bg-slate-950/60 border border-white/5 p-4 rounded-2xl flex items-center gap-3">
                    <TrendingUp className="w-5 h-5 text-emerald-400 shrink-0" />
                    <span className="text-xs text-slate-300">
                      Digital workforce deployment has reduced operational overheads by <strong className="text-white">৳142,000 BDT</strong> this month.
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: AI OPERATION REPORTS */}
          {activeTab === 'reports' && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <h3 className="text-lg font-black text-white">GENERATE BOARD ROOM DIGESTS</h3>
                  <p className="text-xs text-slate-400">Synthesize official, executive reports from the platform's active debt ledger, user database, and workforce stats.</p>
                </div>

                <div className="flex gap-2">
                  <select 
                    value={reportType}
                    onChange={(e) => setReportType(e.target.value as any)}
                    className="bg-slate-950 border border-white/10 px-3 py-2 text-xs text-white rounded-xl focus:outline-none focus:border-blue-500"
                  >
                    <option value="daily">Daily Operations Summary</option>
                    <option value="weekly">Weekly Operational Digest</option>
                    <option value="monthly">Monthly Boardroom Audit</option>
                  </select>
                  <button
                    onClick={handleGenerateReport}
                    disabled={generatingReport}
                    className="flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 text-white text-xs uppercase tracking-widest font-black px-4 py-2.5 rounded-xl shadow-lg transition-all active:scale-95 shrink-0"
                  >
                    {generatingReport ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Synthesizing...
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4" />
                        Generate AI Report
                      </>
                    )}
                  </button>
                </div>
              </div>

              {generatedReport ? (
                <div className="bg-slate-900/40 border border-white/5 rounded-3xl p-6 sm:p-8 shadow-xl space-y-6 max-h-[70vh] overflow-y-auto custom-scrollbar">
                  <div className="flex items-center justify-between border-b border-white/5 pb-4">
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-5 h-5 text-blue-400 animate-pulse" />
                      <span className="text-xs text-slate-400 uppercase font-black tracking-widest">
                        AI Operational Synthesis
                      </span>
                    </div>
                    <span className="text-xs text-slate-400 font-mono">
                      Generated at: {new Date().toLocaleString()}
                    </span>
                  </div>

                  {/* Render report in clean stylized container */}
                  <div className="prose prose-invert max-w-none text-slate-300 text-sm leading-relaxed space-y-4 whitespace-pre-wrap font-sans">
                    {generatedReport}
                  </div>
                </div>
              ) : (
                <div className="bg-slate-900/20 border border-white/5 p-12 rounded-3xl text-center space-y-4">
                  <FileText className="w-16 h-16 text-slate-600 mx-auto" />
                  <h4 className="text-sm font-black text-white uppercase tracking-wider">BOARD AUDIT ENGINE STANDBY</h4>
                  <p className="text-xs text-slate-400 max-w-md mx-auto">Select a report period at the top right and click 'Generate AI Report'. Our model will compile and write a high-fidelity business intelligence summary using live T.U.T Money metrics.</p>
                </div>
              )}
            </div>
          )}

          {/* TAB 5: MY OFFICER DESK */}
          {activeTab === 'my_desk' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* LEFT COLUMN: Profile Info & Status Control */}
              <div className="space-y-6">
                <div className="bg-slate-900/40 border border-white/5 p-6 rounded-3xl shadow-xl space-y-6">
                  <div className="space-y-1">
                    <h3 className="text-sm font-black text-white uppercase tracking-wider">OFFICER TERMINAL</h3>
                    <p className="text-[11px] text-slate-400">Manage your public directory card, online status, and terminal registry.</p>
                  </div>

                  {myEmployeeProfile ? (
                    <div className="space-y-6">
                      {/* Public Card Preview */}
                      <div className="p-4 bg-slate-950/60 border border-white/5 rounded-2xl flex items-center gap-4">
                        <img 
                          src={myPhoto || 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?auto=format&fit=crop&q=80&w=200'} 
                          alt={myEmployeeProfile.name}
                          className="w-16 h-16 rounded-2xl object-cover border border-white/10"
                        />
                        <div>
                          <h4 className="text-sm font-black text-white">{myEmployeeProfile.name}</h4>
                          <span className="text-[10px] text-slate-400 block font-semibold uppercase">{myPos || 'Human Director / Founder'}</span>
                          <span className="text-[10px] text-blue-400 font-bold block mt-0.5">{myDept}</span>
                          <span className={`inline-block text-[9px] font-black uppercase mt-1 px-2 py-0.5 rounded-md ${
                            myStatus === 'Available' ? 'bg-emerald-500/20 text-emerald-400' :
                            myStatus === 'Busy' ? 'bg-amber-500/20 text-amber-400' : 'bg-slate-500/20 text-slate-400'
                          }`}>
                            {myStatus}
                          </span>
                        </div>
                      </div>

                      {/* Edit Profile Form */}
                      <form onSubmit={handleUpdateMyProfile} className="space-y-4 pt-4 border-t border-white/5">
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">My Title / Position</label>
                          <input 
                            type="text" 
                            required
                            placeholder="e.g. Founder & Chief Director"
                            value={myPos}
                            onChange={(e) => setMyPos(e.target.value)}
                            className="w-full bg-slate-950 border border-white/10 px-3 py-2 text-xs text-white rounded-xl focus:outline-none focus:border-blue-500"
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">My Department</label>
                          <select 
                            value={myDept}
                            onChange={(e) => setMyDept(e.target.value)}
                            className="w-full bg-slate-950 border border-white/10 px-3 py-2 text-xs text-white rounded-xl focus:outline-none focus:border-blue-500"
                          >
                            <option value="Customer Support">Customer Support</option>
                            <option value="Member Support">Member Support</option>
                            <option value="Technical Support">Technical Support</option>
                            <option value="Information Desk">Information Desk</option>
                          </select>
                        </div>

                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Profile Photo</label>
                          <div className="flex gap-2 items-center">
                            <input 
                              type="text" 
                              placeholder="Photo URL or Upload file..."
                              value={myPhoto.startsWith('data:') ? 'Local Image Loaded (Base64)' : myPhoto}
                              onChange={(e) => {
                                if (!e.target.value.startsWith('Local Image')) {
                                  setMyPhoto(e.target.value);
                                }
                              }}
                              className="flex-1 bg-slate-950 border border-white/10 px-3 py-2 text-xs text-white rounded-xl focus:outline-none focus:border-blue-500"
                            />
                            <label className="cursor-pointer bg-slate-850 hover:bg-slate-800 border border-white/10 text-slate-300 text-[9px] font-black uppercase px-2.5 py-2.5 rounded-xl transition-all shrink-0">
                              Upload File
                              <input
                                type="file"
                                accept="image/*"
                                onChange={(e) => {
                                  const file = e.target.files?.[0];
                                  if (file) {
                                    const reader = new FileReader();
                                    reader.onload = (ev) => {
                                      setMyPhoto(ev.target?.result as string);
                                    };
                                    reader.readAsDataURL(file);
                                  }
                                }}
                                className="hidden"
                              />
                            </label>
                          </div>
                        </div>

                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Availability Status</label>
                          <div className="grid grid-cols-3 gap-2">
                            {(['Available', 'Busy', 'Offline'] as const).map((st) => (
                              <button
                                key={st}
                                type="button"
                                onClick={() => setMyStatus(st)}
                                className={`py-1.5 text-[10px] font-bold uppercase rounded-lg border transition-all ${
                                  myStatus === st 
                                    ? 'bg-blue-600 border-blue-500 text-white' 
                                    : 'bg-slate-950 border-white/5 text-slate-400 hover:text-white'
                                }`}
                              >
                                {st}
                              </button>
                            ))}
                          </div>
                        </div>

                        <button
                          type="submit"
                          disabled={isUpdatingProfile}
                          className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 text-white text-[10px] uppercase tracking-wider font-black py-2.5 rounded-xl shadow-lg transition-all active:scale-95 flex items-center justify-center gap-1.5"
                        >
                          {isUpdatingProfile ? (
                            <>
                              <Loader2 className="w-3 h-3 animate-spin" />
                              Syncing...
                            </>
                          ) : 'Save & Sync Card'}
                        </button>
                      </form>
                    </div>
                  ) : (
                    <div className="space-y-4 py-4 text-center">
                      <div className="w-12 h-12 bg-blue-500/10 text-blue-400 rounded-2xl flex items-center justify-center mx-auto">
                        <Users className="w-6 h-6 animate-pulse" />
                      </div>
                      <h4 className="text-xs font-black text-white uppercase tracking-wider">No Officer Profile Connected</h4>
                      <p className="text-[11px] text-slate-400 leading-relaxed">
                        To claim employee access and chat with members as yourself, you need an active staff profile in our Firestore registry under your logged-in name: <strong>{currentUser?.name || 'Tahsin Ullah Tusher'}</strong>.
                      </p>
                      <button
                        onClick={handleRegisterMyProfile}
                        className="bg-blue-600 hover:bg-blue-500 text-white text-[10px] uppercase tracking-wider font-black px-4 py-2.5 rounded-xl shadow-lg transition-all"
                      >
                        Register Officer Card
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* RIGHT COLUMN: Live Messaging Inbox Workspace */}
              <div 
                className={`${
                  isChatMaximized 
                    ? 'fixed inset-4 sm:inset-10 bg-slate-950 border border-white/10 z-[100] rounded-3xl flex flex-col shadow-2xl h-[calc(100vh-2rem)] sm:h-[calc(100vh-5rem)]' 
                    : 'lg:col-span-2 bg-slate-900/40 border border-white/5 rounded-3xl shadow-xl flex flex-col h-[75vh]'
                } overflow-hidden transition-all duration-300`}
              >
                {/* Workspace Header */}
                <div className="p-4 bg-slate-900/80 border-b border-white/5 flex flex-col sm:flex-row gap-3 items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-blue-600/10 text-blue-400 flex items-center justify-center">
                      <MessageSquare className="w-5 h-5 animate-pulse" />
                    </div>
                    <div>
                      <h3 className="text-xs font-black text-white uppercase tracking-wider flex items-center gap-1.5">
                        OPERATIONS WORKSPACE
                        <span className="bg-blue-500/20 text-blue-400 text-[8px] tracking-widest font-bold px-1.5 py-0.5 rounded-full">
                          COMFORT MODE
                        </span>
                      </h3>
                      <p className="text-[10px] text-slate-400">Directly inspect active customer tickets or chat privately with other employees.</p>
                    </div>
                  </div>

                  {/* Mode Toggles and Action Buttons */}
                  <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                    <div className="bg-slate-950 p-1 rounded-xl border border-white/5 flex gap-1">
                      <button
                        onClick={() => {
                          setChatMode('member');
                          setSelectedChatId('');
                        }}
                        className={`px-3 py-1.5 rounded-lg text-[10px] uppercase font-black tracking-wider transition-all ${
                          chatMode === 'member' 
                            ? 'bg-blue-600 text-white shadow-md' 
                            : 'text-slate-400 hover:text-white hover:bg-white/5'
                        }`}
                      >
                        Members
                      </button>
                      <button
                        onClick={() => {
                          setChatMode('staff');
                          setSelectedStaffId('');
                        }}
                        className={`px-3 py-1.5 rounded-lg text-[10px] uppercase font-black tracking-wider transition-all ${
                          chatMode === 'staff' 
                            ? 'bg-blue-600 text-white shadow-md' 
                            : 'text-slate-400 hover:text-white hover:bg-white/5'
                        }`}
                      >
                        Internal P2P
                      </button>
                    </div>

                    {/* Maximize Button */}
                    <button
                      onClick={() => setIsChatMaximized(!isChatMaximized)}
                      className="p-2 bg-slate-900 hover:bg-slate-800 border border-white/10 rounded-xl text-slate-300 hover:text-white active:scale-95 transition-all"
                      title={isChatMaximized ? "Exit Comfort Mode" : "Maximize Workspace"}
                    >
                      {isChatMaximized ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                    </button>

                    {/* Exit Desk Button */}
                    <button
                      onClick={() => setActiveTab('employees')}
                      className="p-2 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 hover:border-red-500/40 rounded-xl text-red-400 hover:text-red-300 active:scale-95 transition-all flex items-center gap-1.5 text-[10px] uppercase font-black tracking-wider"
                      title="Exit Operations Workspace"
                    >
                      <LogOut className="w-4 h-4" />
                      <span>Exit Desk</span>
                    </button>
                  </div>
                </div>

                {/* Main Workspace Layout */}
                <div className="flex-1 flex overflow-hidden">
                  
                  {/* Left Sidebar: Thread Selectors */}
                  <div className={`${
                    (chatMode === 'member' ? selectedChatId : selectedStaffId) 
                      ? 'hidden md:block' 
                      : 'w-full'
                  } md:w-1/3 border-r border-white/5 overflow-y-auto custom-scrollbar bg-slate-950/20 shrink-0`}>
                    
                    {chatMode === 'member' ? (
                      // MEMBER SUPPORT RECIPIENTS
                      activeChats.length === 0 ? (
                        <div className="p-6 text-center text-slate-500 text-[11px] h-full flex flex-col items-center justify-center space-y-2">
                          <Smile className="w-8 h-8 text-slate-700" />
                          <p>No active customer support tickets found in Firestore.</p>
                        </div>
                      ) : (
                        <div className="divide-y divide-white/[0.03]">
                          {activeChats.map((chat) => {
                            const isSelected = selectedChatId === chat.id;
                            return (
                              <button
                                key={chat.id}
                                onClick={() => setSelectedChatId(chat.id)}
                                className={`w-full p-4 text-left transition-colors flex items-start gap-3 border-b border-white/[0.02] ${
                                  isSelected ? 'bg-blue-600/10 text-white border-l-4 border-blue-500' : 'hover:bg-white/[0.02] text-slate-400'
                                }`}
                              >
                                <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-600/20 to-purple-600/20 border border-blue-500/20 text-slate-200 text-xs font-black flex items-center justify-center uppercase shrink-0">
                                  {chat.userName?.substring(0, 2) || 'US'}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex justify-between items-baseline">
                                    <h4 className="text-[11px] font-black truncate text-white">{chat.userName}</h4>
                                    <span className="text-[8px] text-slate-500 font-mono">
                                      {new Date(chat.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </span>
                                  </div>
                                  <p className="text-[10px] truncate text-slate-400 mt-1">{chat.lastMessage}</p>
                                  <div className="flex items-center gap-1.5 mt-2">
                                    <span className="text-[8px] uppercase font-black text-slate-500">Agent:</span>
                                    <span className="text-[9px] font-bold text-blue-400 truncate">{chat.employeeName}</span>
                                  </div>
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      )
                    ) : (
                      // INTERNAL P2P STAFF CHATS LIST
                      <div className="divide-y divide-white/[0.03]">
                        <div className="p-3 bg-slate-950/40 text-[9px] font-black uppercase text-slate-400 tracking-wider">
                          Internal Personnel Directory
                        </div>
                        {employees.map((emp) => {
                          const channelId = `${currentUser?.uid || 'admin'}_${emp.id}`;
                          const isSelected = selectedStaffId === channelId;
                          const lastThread = staffChats.find(c => c.id === channelId);
                          
                          return (
                            <button
                              key={emp.id}
                              onClick={() => setSelectedStaffId(channelId)}
                              className={`w-full p-4 text-left transition-colors flex items-start gap-3 border-b border-white/[0.02] ${
                                isSelected ? 'bg-blue-600/10 text-white border-l-4 border-blue-500' : 'hover:bg-white/[0.02] text-slate-400'
                              }`}
                            >
                              <div className="relative shrink-0">
                                <img 
                                  src={emp.photoUrl} 
                                  alt={emp.name} 
                                  className="w-9 h-9 rounded-xl object-cover border border-white/10"
                                />
                                <span className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-slate-950 ${
                                  emp.status === 'Available' ? 'bg-emerald-500' :
                                  emp.status === 'Busy' ? 'bg-amber-500' : 'bg-slate-500'
                                }`} />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex justify-between items-baseline">
                                  <h4 className="text-[11px] font-black truncate text-white">{emp.name}</h4>
                                  {emp.employeeType === 'Digital Employee' && (
                                    <span className="bg-blue-500/15 text-blue-400 text-[7px] font-black px-1 py-0.5 rounded-md uppercase tracking-wider">
                                      AI Agent
                                    </span>
                                  )}
                                </div>
                                <span className="text-[9px] text-slate-400 block truncate uppercase tracking-tight mt-0.5">{emp.position}</span>
                                {lastThread && (
                                  <p className="text-[10px] text-slate-400 truncate mt-1.5 italic">"{lastThread.lastMessage}"</p>
                                )}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Right Panel: Chat Room / Thread */}
                  <div className={`${
                    (chatMode === 'member' ? selectedChatId : selectedStaffId) 
                      ? 'flex w-full' 
                      : 'hidden md:flex'
                  } flex-1 flex-col justify-between bg-slate-950/40 relative`}>
                    
                    {chatMode === 'member' ? (
                      // MEMBER MODE MESSAGES
                      selectedChatId ? (() => {
                        const chatDoc = activeChats.find(c => c.id === selectedChatId);
                        if (!chatDoc) return <div className="flex-1 flex items-center justify-center text-slate-500 text-xs">Conversation not found.</div>;
                        
                        return (
                          <>
                            {/* Thread Header */}
                            <div className="px-4 py-3 bg-slate-900/60 border-b border-white/5 flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                {/* Back Button (visible on mobile/small screens only) */}
                                <button
                                  type="button"
                                  onClick={() => setSelectedChatId('')}
                                  className="md:hidden p-1.5 hover:bg-slate-800 text-slate-400 hover:text-white rounded-lg transition-all flex items-center justify-center shrink-0"
                                  title="Back to Conversations"
                                >
                                  <ArrowLeft className="w-4 h-4" />
                                </button>

                                <div className="w-8 h-8 rounded-lg bg-blue-600/10 text-blue-400 font-bold flex items-center justify-center uppercase">
                                  {chatDoc.userName?.substring(0, 2)}
                                </div>
                                <div>
                                  <h4 className="text-xs font-black text-white">{chatDoc.userName}</h4>
                                  <span className="text-[9px] text-slate-400">Handled by: <strong className="text-blue-400">{chatDoc.employeeName}</strong></span>
                                </div>
                              </div>
                              {chatDoc.status === 'escalated' && (
                                <span className="bg-rose-500/20 text-rose-400 text-[8px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider flex items-center gap-1 border border-rose-500/35">
                                  <ShieldAlert className="w-3 h-3 animate-bounce" />
                                  Escalated Compliance
                                </span>
                              )}
                            </div>

                            {/* Message List */}
                            <div className="flex-1 p-6 overflow-y-auto space-y-4 custom-scrollbar">
                              {chatDoc.messages?.map((msg: any, mIdx: number) => {
                                const isMe = msg.sender === 'employee';
                                return (
                                  <div 
                                    key={mIdx} 
                                    className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}
                                  >
                                    <div className={`max-w-[75%] rounded-2xl p-3 text-xs leading-relaxed shadow-lg ${
                                      isMe 
                                        ? 'bg-blue-600 text-white rounded-tr-none' 
                                        : 'bg-slate-900 text-slate-200 rounded-tl-none border border-white/5'
                                    }`}>
                                      <p className="whitespace-pre-wrap">{msg.text}</p>
                                      <span className="block text-[8px] text-right opacity-60 mt-1 font-mono">
                                        {msg.timestamp ? new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                                      </span>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>

                            {/* Quick Canned Responses Drawer */}
                            <div className="px-4 py-2 bg-slate-950/60 border-t border-white/5 flex gap-2 overflow-x-auto custom-scrollbar shrink-0">
                              {CANNED_REPLIES.map((rep, idx) => (
                                <button
                                  key={idx}
                                  onClick={() => setChatReplyText(rep.text)}
                                  className="bg-slate-900 hover:bg-slate-800 border border-white/5 text-slate-300 hover:text-white text-[9px] font-bold uppercase tracking-wider px-3 py-1.5 rounded-lg shrink-0 transition-all"
                                >
                                  {rep.label}
                                </button>
                              ))}
                            </div>

                            {/* Chat Input */}
                            <form 
                              onSubmit={(e) => handleSendChatReply(e, chatDoc.id, chatDoc.messages || [])}
                              className="p-4 border-t border-white/5 bg-slate-900/60 flex gap-2"
                            >
                              <input 
                                type="text" 
                                placeholder={`Type responsive reply as ${myEmployeeProfile?.name || 'Chief Director'}...`}
                                value={chatReplyText}
                                onChange={(e) => setChatReplyText(e.target.value)}
                                className="flex-1 bg-slate-950 border border-white/10 px-4 py-3 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                              />
                              <button 
                                type="submit"
                                className="bg-blue-600 hover:bg-blue-500 text-white p-3 rounded-xl hover:shadow-lg transition-all active:scale-95 flex items-center justify-center shrink-0"
                              >
                                <Send className="w-4 h-4" />
                              </button>
                            </form>
                          </>
                        );
                      })() : (
                        <div className="flex-1 flex flex-col items-center justify-center text-center p-6 space-y-2">
                          <Smile className="w-10 h-10 text-slate-700 animate-bounce" style={{ animationDuration: '3s' }} />
                          <h4 className="text-xs font-black text-white uppercase tracking-wider">SUPPORT DESK IDLE</h4>
                          <p className="text-[10px] text-slate-500 max-w-xs leading-relaxed">
                            No member conversation selected. Tapping an active conversation on the left rail will load historical ledgers & chat panels.
                          </p>
                        </div>
                      )
                    ) : (
                      // STAFF P2P MODE MESSAGES
                      selectedStaffId ? (() => {
                        const targetEmpId = selectedStaffId.split('_')[1];
                        const targetEmployee = employees.find(e => e.id === targetEmpId);
                        const chatDoc = staffChats.find(c => c.id === selectedStaffId);
                        const chatMessages = chatDoc?.messages || [];
                        
                        if (!targetEmployee) return <div className="flex-1 flex items-center justify-center text-slate-500 text-xs">Employee not found.</div>;
                        
                        return (
                          <>
                            {/* Thread Header */}
                            <div className="px-4 py-3 bg-slate-900/60 border-b border-white/5 flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                {/* Back Button (visible on mobile/small screens only) */}
                                <button
                                  type="button"
                                  onClick={() => setSelectedStaffId('')}
                                  className="md:hidden p-1.5 hover:bg-slate-800 text-slate-400 hover:text-white rounded-lg transition-all flex items-center justify-center shrink-0"
                                  title="Back to Personnel"
                                >
                                  <ArrowLeft className="w-4 h-4" />
                                </button>

                                <img 
                                  src={targetEmployee.photoUrl} 
                                  alt={targetEmployee.name} 
                                  className="w-9 h-9 rounded-xl object-cover border border-white/10"
                                />
                                <div>
                                  <h4 className="text-xs font-black text-white">{targetEmployee.name}</h4>
                                  <span className="text-[9px] text-slate-400 font-medium uppercase">{targetEmployee.position} • {targetEmployee.department}</span>
                                </div>
                              </div>
                              <span className={`text-[8px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full ${
                                targetEmployee.employeeType === 'Digital Employee' 
                                  ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' 
                                  : 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20'
                              }`}>
                                {targetEmployee.employeeType === 'Digital Employee' ? 'Digital Core AI' : 'Human Officer'}
                              </span>
                            </div>

                            {/* Message List */}
                            <div className="flex-1 p-6 overflow-y-auto space-y-4 custom-scrollbar">
                              {chatMessages.length === 0 ? (
                                <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-2">
                                  <BookOpen className="w-8 h-8 text-slate-700 animate-pulse" />
                                  <h4 className="text-xs font-black text-slate-300 uppercase tracking-wide">SECURE CHANNELS SECURED</h4>
                                  <p className="text-[10px] text-slate-500 max-w-xs leading-relaxed">
                                    No prior chats recorded. Initiate an operations inquiry with {targetEmployee.name} below.
                                  </p>
                                </div>
                              ) : (
                                chatMessages.map((msg: any, mIdx: number) => {
                                  const isMe = msg.senderId === (currentUser?.uid || 'admin');
                                  const isAiRecipient = msg.senderId === targetEmployee.id;
                                  
                                  return (
                                    <div 
                                      key={mIdx} 
                                      className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}
                                    >
                                      <div className={`max-w-[75%] rounded-2xl p-3 text-xs leading-relaxed shadow-lg ${
                                        isMe 
                                          ? 'bg-blue-600 text-white rounded-tr-none' 
                                          : isAiRecipient && targetEmployee.employeeType === 'Digital Employee'
                                          ? 'bg-purple-600/20 border border-purple-500/20 text-purple-200 rounded-tl-none'
                                          : 'bg-slate-900 text-slate-200 rounded-tl-none border border-white/5'
                                      }`}>
                                        <div className="flex items-center justify-between gap-4 mb-1">
                                          <span className="text-[8px] opacity-75 font-black uppercase tracking-wider">{msg.senderName}</span>
                                          {isAiRecipient && targetEmployee.employeeType === 'Digital Employee' && (
                                            <span className="bg-purple-500/25 text-purple-300 text-[6px] px-1 rounded uppercase tracking-widest font-black animate-pulse">
                                              AI System Core
                                            </span>
                                          )}
                                        </div>
                                        <p className="whitespace-pre-wrap">{msg.text}</p>
                                        <span className="block text-[8px] text-right opacity-60 mt-1 font-mono">
                                          {msg.timestamp ? new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                                        </span>
                                      </div>
                                    </div>
                                  );
                                })
                              )}

                              {isSendingStaffMsg && (
                                <div className="flex justify-start">
                                  <div className="bg-purple-600/10 border border-purple-500/10 rounded-2xl p-3 text-xs text-purple-300 rounded-tl-none flex items-center gap-2">
                                    <Loader2 className="w-3.5 h-3.5 text-purple-400 animate-spin" />
                                    <span>{targetEmployee.name} is running digital directives...</span>
                                  </div>
                                </div>
                              )}
                            </div>

                            {/* Chat Input */}
                            <form 
                              onSubmit={(e) => handleSendStaffMessage(e, targetEmployee, chatMessages)}
                              className="p-4 border-t border-white/5 bg-slate-900/60 flex gap-2"
                            >
                              <input 
                                type="text" 
                                placeholder={`Message ${targetEmployee.name}...`}
                                value={staffReplyText}
                                onChange={(e) => setStaffReplyText(e.target.value)}
                                className="flex-1 bg-slate-950 border border-white/10 px-4 py-3 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                              />
                              <button 
                                type="submit"
                                disabled={isSendingStaffMsg}
                                className="bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 text-white p-3 rounded-xl hover:shadow-lg transition-all active:scale-95 flex items-center justify-center shrink-0"
                              >
                                <Send className="w-4 h-4" />
                              </button>
                            </form>
                          </>
                        );
                      })() : (
                        <div className="flex-1 flex flex-col items-center justify-center text-center p-6 space-y-2">
                          <Users className="w-10 h-10 text-slate-700 animate-pulse" />
                          <h4 className="text-xs font-black text-white uppercase tracking-wider">P2P SECURE TELEMETRY</h4>
                          <p className="text-[10px] text-slate-500 max-w-xs leading-relaxed">
                            Select any human employee or digital core agent on the left rail directory to open secure encrypted private chats.
                          </p>
                        </div>
                      )
                    )}

                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* ADD EMPLOYEE MODAL */}
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-[100] flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-white/10 w-full max-w-lg rounded-3xl overflow-hidden shadow-2xl relative animate-in fade-in zoom-in duration-300">
            <div className="p-6 border-b border-white/10 flex items-center justify-between">
              <h3 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-blue-500" />
                Station New Officer
              </h3>
              <button 
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-white text-sm"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAddEmployee} className="p-6 space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Employee Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Sayeeda Sultana"
                  value={empName}
                  onChange={(e) => setEmpName(e.target.value)}
                  className="w-full bg-slate-950 border border-white/10 px-4 py-3 rounded-xl text-xs text-white focus:outline-none focus:border-blue-500/50"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Department</label>
                  <select
                    value={empDept}
                    onChange={(e) => setEmpDept(e.target.value)}
                    className="w-full bg-slate-950 border border-white/10 px-4 py-3 rounded-xl text-xs text-white focus:outline-none focus:border-blue-500"
                  >
                    <option value="Customer Support">Customer Support</option>
                    <option value="Member Support">Member Support</option>
                    <option value="Technical Support">Technical Support</option>
                    <option value="Information Desk">Information Desk</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Employee Type</label>
                  <select
                    value={empType}
                    onChange={(e) => setEmpType(e.target.value as any)}
                    className="w-full bg-slate-950 border border-white/10 px-4 py-3 rounded-xl text-xs text-white focus:outline-none focus:border-blue-500"
                  >
                    <option value="Digital Employee">Digital Employee (AI)</option>
                    <option value="Human Employee">Human Employee</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Position / Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Senior Lending Analyst"
                  value={empPos}
                  onChange={(e) => setEmpPos(e.target.value)}
                  className="w-full bg-slate-950 border border-white/10 px-4 py-3 rounded-xl text-xs text-white focus:outline-none focus:border-blue-500/50"
                />
              </div>

              {empType === 'Digital Employee' && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Internal AI Code</label>
                    <input
                      type="text"
                      placeholder="e.g. AI-CS-005"
                      value={empAiCode}
                      onChange={(e) => setEmpAiCode(e.target.value)}
                      className="w-full bg-slate-950 border border-white/10 px-4 py-3 rounded-xl text-xs text-white focus:outline-none focus:border-blue-500/50"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Target Performance (Score)</label>
                    <input
                      type="number"
                      min="50"
                      max="100"
                      value={empScore}
                      onChange={(e) => setEmpScore(parseInt(e.target.value) || 98)}
                      className="w-full bg-slate-950 border border-white/10 px-4 py-3 rounded-xl text-xs text-white focus:outline-none focus:border-blue-500/50"
                    />
                  </div>
                </div>
              )}

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Custom Profile Photo</label>
                <div className="flex gap-2 items-center">
                  <input
                    type="text"
                    placeholder="Photo URL or Upload file..."
                    value={empPhoto.startsWith('data:') ? 'Local Image Loaded (Base64)' : empPhoto}
                    onChange={(e) => {
                      if (!e.target.value.startsWith('Local Image')) {
                        setEmpPhoto(e.target.value);
                      }
                    }}
                    className="flex-1 bg-slate-950 border border-white/10 px-4 py-3 rounded-xl text-xs text-white focus:outline-none focus:border-blue-500/50"
                  />
                  <label className="cursor-pointer bg-slate-850 hover:bg-slate-800 border border-white/10 text-slate-300 text-[10px] font-black uppercase px-3 py-3 rounded-xl transition-all shrink-0">
                    Upload File
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          const reader = new FileReader();
                          reader.onload = (ev) => {
                            setEmpPhoto(ev.target?.result as string);
                          };
                          reader.readAsDataURL(file);
                        }
                      }}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>

              <div className="pt-4 flex gap-3 justify-end border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-3 text-xs uppercase tracking-widest font-black text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-blue-600 hover:bg-blue-500 text-white text-xs uppercase tracking-widest font-black px-6 py-3 rounded-xl shadow-lg active:scale-95 transition-all"
                >
                  Confirm Stationing
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* AI TUNING & SANDBOX PLAYGROUND MODAL */}
      {showTuningModal && editingEmployee && (
        <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-md z-[110] flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-white/10 w-full max-w-5xl h-[85vh] rounded-3xl overflow-hidden shadow-2xl flex flex-col relative animate-in fade-in zoom-in duration-300">
            {/* Modal Header */}
            <div className="p-6 border-b border-white/10 flex items-center justify-between shrink-0 bg-slate-900/80">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-purple-500/10 text-purple-400 flex items-center justify-center">
                  <Sliders className="w-5 h-5 animate-pulse" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-1.5">
                    AI BRAIN TUNING WORKSPACE
                    <span className="bg-purple-500/20 text-purple-400 text-[8px] font-black px-1.5 py-0.5 rounded uppercase tracking-widest">
                      Sandbox v1.5
                    </span>
                  </h3>
                  <p className="text-[10px] text-slate-400">Tuning AI core instructions and temperature settings for <strong>{editingEmployee.name}</strong>.</p>
                </div>
              </div>
              <button 
                onClick={() => setShowTuningModal(false)}
                className="text-slate-400 hover:text-white text-sm"
              >
                ✕
              </button>
            </div>

            {/* Split Workspace */}
            <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
              {/* LEFT COLUMN: SYSTEM PROMPT EDITING FORM */}
              <form onSubmit={handleSaveTuning} className="w-full md:w-1/2 p-6 border-r border-white/5 flex flex-col justify-between overflow-y-auto custom-scrollbar">
                <div className="space-y-6">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                      <BookOpen className="w-3.5 h-3.5 text-blue-400" />
                      Core System Instructions (System Instructions)
                    </label>
                    <p className="text-[10px] text-slate-500 leading-relaxed mb-2">
                      Define the AI's identity, department rules, tone, constraints, and custom response protocols. This guides their entire conversational logic.
                    </p>
                    <textarea
                      required
                      rows={10}
                      placeholder="e.g. You are a Senior Lending Analyst. Be highly professional, helpful, but firm on collateral standards. Never approve loans exceeding $10,000 without supervisor verification..."
                      value={tuningPrompt}
                      onChange={(e) => setTuningPrompt(e.target.value)}
                      className="w-full bg-slate-950 border border-white/10 px-4 py-3 rounded-2xl text-xs text-white placeholder-slate-600 font-mono leading-relaxed focus:outline-none focus:border-purple-500/50 focus:ring-1 focus:ring-purple-500/20 custom-scrollbar"
                    />
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                        <Activity className="w-3.5 h-3.5 text-blue-400" />
                        Temperature Control
                      </label>
                      <span className="text-xs font-mono font-bold text-purple-400 bg-purple-500/10 px-2 py-0.5 rounded">
                        {tuningTemp.toFixed(1)}
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-500 leading-relaxed">
                      Lower temperatures keep answers strictly deterministic and factual. Higher values allow creative, brand-representative conversations.
                    </p>
                    <div className="flex items-center gap-4 pt-1">
                      <span className="text-[10px] text-slate-500 font-bold uppercase">Deterministic (0.0)</span>
                      <input
                        type="range"
                        min="0.0"
                        max="1.0"
                        step="0.1"
                        value={tuningTemp}
                        onChange={(e) => setTuningTemp(parseFloat(e.target.value))}
                        className="flex-1 accent-purple-500 cursor-pointer h-1.5 bg-slate-950 rounded-lg appearance-none"
                      />
                      <span className="text-[10px] text-slate-500 font-bold uppercase">Creative (1.0)</span>
                    </div>
                  </div>
                </div>

                <div className="pt-6 border-t border-white/5 flex gap-3 justify-end bg-slate-900 mt-6 shrink-0">
                  <button
                    type="button"
                    onClick={() => setShowTuningModal(false)}
                    className="px-4 py-3 text-xs uppercase tracking-widest font-black text-slate-400 hover:text-white transition-all"
                  >
                    Cancel Draft
                  </button>
                  <button
                    type="submit"
                    className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white text-xs uppercase tracking-widest font-black px-6 py-3 rounded-xl shadow-lg hover:shadow-purple-500/10 active:scale-95 transition-all"
                  >
                    Save & Deploy Brain
                  </button>
                </div>
              </form>

              {/* RIGHT COLUMN: REAL-TIME SANDBOX TESTING SIMULATOR */}
              <div className="w-full md:w-1/2 p-6 flex flex-col justify-between bg-slate-950/40">
                <div className="flex flex-col h-full">
                  {/* Sandbox Header */}
                  <div className="pb-3 border-b border-white/5 flex items-center justify-between shrink-0 mb-4">
                    <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider flex items-center gap-1.5">
                      <Sparkles className="w-4 h-4 text-purple-400 animate-pulse" />
                      Live Simulator Sandbox
                    </span>
                    <span className="text-[8px] uppercase tracking-widest font-bold text-slate-500 px-1.5 py-0.5 border border-white/10 rounded">
                      Unsaved Draft Testing
                    </span>
                  </div>

                  {/* Sandbox Conversation History */}
                  <div className="flex-1 overflow-y-auto space-y-4 pr-1 mb-4 custom-scrollbar">
                    {sandboxMessages.map((msg, mIdx) => {
                      const isUser = msg.sender === 'user';
                      return (
                        <div 
                          key={mIdx} 
                          className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}
                        >
                          <div className={`max-w-[85%] rounded-2xl p-3 text-xs leading-relaxed shadow-md ${
                            isUser 
                              ? 'bg-blue-600 text-white rounded-tr-none' 
                              : 'bg-slate-900 border border-white/5 text-slate-200 rounded-tl-none'
                          }`}>
                            <div className="flex items-center justify-between gap-4 mb-1">
                              <span className="text-[8px] opacity-75 font-black uppercase tracking-wider">
                                {isUser ? 'Tahsin (Admin)' : editingEmployee.name}
                              </span>
                              {!isUser && (
                                <span className="bg-purple-500/20 text-purple-400 text-[6px] font-bold px-1 rounded">
                                  Tuned Draft response
                                </span>
                              )}
                            </div>
                            <p className="whitespace-pre-wrap">{msg.text}</p>
                            <span className="block text-[8px] text-right opacity-60 mt-1 font-mono">
                              {msg.timestamp ? new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                            </span>
                          </div>
                        </div>
                      );
                    })}

                    {isSandboxTyping && (
                      <div className="flex justify-start">
                        <div className="bg-purple-600/10 border border-purple-500/10 rounded-2xl p-3 text-xs text-purple-300 rounded-tl-none flex items-center gap-2">
                          <Loader2 className="w-3.5 h-3.5 text-purple-400 animate-spin" />
                          <span>Gemini is modeling system instructions...</span>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Sandbox Chat Input */}
                  <form onSubmit={handleSendSandboxMessage} className="flex gap-2 shrink-0">
                    <input
                      type="text"
                      placeholder={`Test chat prompt... (e.g. Can I borrow $20k?)`}
                      value={sandboxInput}
                      onChange={(e) => setSandboxInput(e.target.value)}
                      className="flex-1 bg-slate-950 border border-white/10 px-3 py-2.5 rounded-xl text-xs text-white placeholder-slate-600 focus:outline-none focus:border-purple-500/50"
                    />
                    <button
                      type="submit"
                      disabled={isSandboxTyping}
                      className="bg-purple-600 hover:bg-purple-500 disabled:bg-purple-900 text-white p-2.5 rounded-xl transition-all flex items-center justify-center shrink-0"
                    >
                      <Send className="w-4 h-4" />
                    </button>
                  </form>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
