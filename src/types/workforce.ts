export interface Employee {
  id: string; // EMP-XXXXX
  name: string;
  gender: 'Male' | 'Female';
  photoUrl: string;
  department: 'Customer Support' | 'Member Support' | 'Technical Support' | 'Information Desk' | 'Credit & Underwriting' | 'Treasury & Member Care' | string;
  position: string;
  joinedDate: string;
  status: 'Available' | 'Busy' | 'Offline';
  performanceScore: number; // Out of 100
  employeeType: 'Digital Employee' | 'Human Employee';
  internalAiCode?: string; // AI-CS-001 (Admins only)
  aiModelVersion?: string; // Gemini 3.8 Flash
  knowledgeVersion?: string; // v3.8.0
  lastUpdated?: string; // ISO string
  averageResponseTime: string; // e.g., "Instant (24/7)"
  customerSatisfaction: string; // e.g., "4.98/5"
  totalChats: number;
  customPrompt?: string; // Optional custom instruction / persona prompt override
  temperature?: number; // Optional temperature for Gemini generation
  bio?: string;
  specialization?: string;
  docId?: string;
}

export interface AgentReportedIssue {
  id: string; // ISS-XXXXX
  ticketId?: string;
  docId?: string; // Firestore document ID
  userId: string;
  userName: string;
  userEmail?: string;
  userPhone?: string;
  memberId?: string;
  agentId: string;
  agentName: string;
  agentGender: 'Male' | 'Female';
  category: 'Loan Issue' | 'Deposit Help' | 'Repayment Verification' | 'Security / Verification' | 'App Bug' | 'General Inquiry';
  priority: 'Low' | 'Medium' | 'High' | 'Urgent';
  title: string;
  description: string;
  agentNotes?: string;
  recommendedAction?: string;
  relatedTransactionId?: string;
  evidenceComplete?: boolean;
  missingDetails?: string[];
  followUpCount?: number;
  adminNotes?: string;
  status: 'Open' | 'In Progress' | 'Resolved';
  createdAt: number;
  updatedAt: number;
  chatSnippet?: string;
}

export interface SupportTicket {
  id: string; // TICKET-XXXXX
  userId: string;
  userEmail: string;
  userName: string;
  priority: 'Low' | 'Medium' | 'High' | 'Urgent';
  category: 'Loan Issue' | 'Deposit Help' | 'Security Block' | 'General Help' | 'Technical Error';
  assignedDepartment: string;
  status: 'Open' | 'In Progress' | 'Resolved';
  description: string;
  estimatedResponseTime: string;
  createdAt: number;
  updatedAt: number;
}

export interface ChatMessage {
  sender: 'user' | 'employee';
  text: string;
  timestamp: number;
  ticketId?: string; // For escalation message bubbles
  issueId?: string;  // For issue noted/updated bubble
  issueActionType?: 'created' | 'updated';
  suggestedReplies?: string[];
}

export interface ChatSession {
  id: string;
  userId: string;
  userName: string;
  employeeId: string;
  employeeName: string;
  messages: ChatMessage[];
  lastMessage: string;
  updatedAt: number;
  status: 'active' | 'escalated';
}

export interface WorkforceReport {
  id: string;
  type: 'daily' | 'weekly' | 'monthly';
  generatedAt: number;
  content: string;
  stats: {
    totalChats: number;
    ticketsCreated: number;
    averageSatisfaction: number;
    escalationRate: number;
    openIssuesCount?: number;
  };
}
