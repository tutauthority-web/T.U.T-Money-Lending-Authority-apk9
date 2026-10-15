export interface Employee {
  id: string; // EMP-XXXXX
  name: string;
  photoUrl: string;
  department: 'Customer Support' | 'Member Support' | 'Technical Support' | 'Information Desk' | string;
  position: string;
  joinedDate: string;
  status: 'Available' | 'Busy' | 'Offline';
  performanceScore: number; // Out of 100
  employeeType: 'Digital Employee' | 'Human Employee';
  internalAiCode?: string; // AI-CS-001 (Admins only)
  aiModelVersion?: string; // Gemini 3.5 Flash (Admins only)
  knowledgeVersion?: string; // v1.2 (Admins only)
  lastUpdated?: string; // ISO string
  averageResponseTime: string; // e.g., "1 min"
  customerSatisfaction: string; // e.g., "4.9/5"
  totalChats: number;
  customPrompt?: string; // Optional custom instruction / persona prompt override
  temperature?: number; // Optional temperature for Gemini generation (default 0.4)
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
  };
}
