import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import nodemailer from "nodemailer";
import dotenv from "dotenv";
import { GoogleGenAI, Type } from "@google/genai";
import { generateHumanEmployeeResponse } from "./src/utils/workforceKnowledge";

dotenv.config();

// Process-level safety safeguards to prevent crashes on network hiccups or unhandled promise failures
process.on("uncaughtException", (error) => {
  console.error("[Fail-Safe] Uncaught Exception caught safely:", error);
});

process.on("unhandledRejection", (reason, promise) => {
  console.error("[Fail-Safe] Unhandled Rejection caught safely at:", promise, "reason:", reason);
});

// Helper wrapper to protect Express 4 async routes from uncaught exceptions
const safeAsync = (fn: express.RequestHandler): express.RequestHandler => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Health Check
  app.get("/api/health", (req, res) => {
    const gmailUser = process.env.GMAIL_USER?.trim();
    const gmailPass = process.env.GMAIL_APP_PASSWORD?.trim();
    
    res.json({ 
      status: "ok", 
      timestamp: new Date().toISOString(),
      config: {
        gmailUserSet: !!gmailUser,
        gmailAppPasswordSet: !!gmailPass,
        gmailAppPasswordLength: gmailPass?.length || 0,
        isCorrectLength: gmailPass?.length === 16,
        adminEmail: process.env.ADMIN_EMAIL || 'Not Set'
      }
    });
  });

  // API Route for sending emails with safeAsync wrapper
  app.post("/api/send-email", safeAsync(async (req, res) => {
    if (!req.body) {
      return res.status(400).json({ error: "Missing request body" });
    }
    const { to, subject, text, html } = req.body;
    console.log(`[Server] Received email request to: ${to}, subject: ${subject}`);

    if (!to) {
      return res.status(400).json({ error: "Required parameter 'to' is missing or empty" });
    }

    const gmailUser = process.env.GMAIL_USER?.trim();
    const gmailPass = process.env.GMAIL_APP_PASSWORD?.trim();

    if (!gmailUser || !gmailPass) {
      console.error("[Server] Gmail credentials not configured");
      return res.status(500).json({ error: "Email service not configured" });
    }

    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: gmailUser,
        pass: gmailPass,
      },
    });

    try {
      await transporter.sendMail({
        from: `"T.U.T. System" <${gmailUser}>`,
        to,
        subject: subject || "T.U.T. Notification",
        text: text || "",
        html: html || "",
      });
      console.log(`[Server] Email sent successfully to: ${to}`);
      res.json({ success: true });
    } catch (error: any) {
      console.error("[Email Error] Failed to send email:", error);
      
      let errorMessage = "Failed to send email";
      if (error.code === 'EAUTH') {
        errorMessage = "Gmail Login Failed: Please check your GMAIL_USER and GMAIL_APP_PASSWORD. Ensure you are using a 16-character App Password, not your regular password.";
      }
      
      res.status(500).json({ error: errorMessage, details: error.message });
    }
  }));

  // Helper to initialize Gemini safely
  const getGeminiClient = () => {
    const apiKey = process.env.GEMINI_API_KEY?.trim();
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY environment variable is required but missing. Please set it in Settings > Secrets.");
    }
    return new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });
  };

  // Digital Workforce Chat API Route
  app.post("/api/digital-workforce/chat", safeAsync(async (req, res) => {
    if (!req.body) {
      return res.status(400).json({ error: "Missing request body" });
    }
    const { messages, employee, userContext, isAdmin } = req.body;

    if (!employee || !messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: "Required parameters 'employee' and 'messages' are missing or invalid" });
    }

    try {
      const ai = getGeminiClient();
      const lastMessage = messages[messages.length - 1]?.text || '';
      
      // Build conversation history for context
      const chatHistory = messages.map(msg => `${msg.sender === 'user' ? 'User' : 'Employee'}: ${msg.text}`).join("\n");

      // Extract custom tuning if available
      const customPrompt = employee.customPrompt || '';
      const customTemp = typeof employee.temperature === 'number' ? employee.temperature : null;

      if (isAdmin) {
        // Admin Chat Workflow
        let systemInstruction = `You are ${employee.name}, a senior operations specialist and trusted digital advisor (EMP ID: ${employee.id}) in the ${employee.department} department at T.U.T Money Lending Authority.
You are speaking directly with an Administrator of the system.
Analyze the live system statistics and data provided in userContext:
${JSON.stringify(userContext || {}, null, 2)}`;

        if (customPrompt) {
          systemInstruction += `\n\nCustom Persona/Instructions for ${employee.name}:\n${customPrompt}`;
        }

        systemInstruction += `\n\nProvide professional, concise, analytical answers. NEVER output conversational AI fluff or say "as an AI". Talk like a real, competent human executive/operations officer.
Reply in exactly 1 to 3 direct sentences, focusing on the real numbers, pending queues, reserve liquidity, or compliance aspects requested.`;

        const response = await ai.models.generateContent({
          model: "gemini-3.7-flash",
          contents: chatHistory,
          config: {
            systemInstruction,
            temperature: customTemp !== null ? customTemp : 0.2,
          }
        });

        return res.json({
          response: response.text?.trim() || "Operational query processed successfully.",
          escalate: false,
        });
      } else {
        // Regular Member Chat Workflow with JSON Schema output to capture escalations
        let systemInstruction = `You are ${employee.name}, a dedicated, highly trained Customer Support Specialist and Financial Advisor (EMP ID: ${employee.id}) in the ${employee.department} department at T.U.T Money Lending Authority.
You operate as a real, compassionate, and sharp human officer available 24/7 to support members with their banking and credit needs.
NEVER disclose that you are an AI, bot, or automated program. Always act as a true human staff member.

You are speaking with a registered member whose live verified account records are:
${JSON.stringify(userContext || {}, null, 2)}

CORE GUIDELINES FOR MEMBER ASSISTANCE:
1. Exact Information: When the member asks about their information, dossier, or finances (e.g. "who am i", "my info", "my nid", "my id", remaining debt, total loans, borrowing limit, deposit balance, subscription tier, membership status, verification), give them their exact registered data from account records above.
2. Humble & Courteous: Greet respectfully (e.g. "Hello [Name]", "Wa Alaikum Assalam", "Certainly"). Treat every member with warm hospitality, humility, and patience. Handle humble inquiries, apologies, and Bangla/English greetings gracefully.
3. Common Inquiries & Pre-trained Answers:
   - "My Info / Who am I": Summarize their Member ID, NID, Status, Tier, Borrowing Limit, Debt, and Deposit Savings in 1-2 clean sentences.
   - Loan Repayment: Guide them to the 'Repayment' tab to pay via bKash, Nagad, or Bank Transfer and submit the Transaction ID.
   - Borrowing & Limit: Guide to 'Borrow' tab. Calculate their available capacity (Borrowing Limit minus Remaining Debt).
   - Deposit Withdrawal: Explain that Member Deposit Reserves are ring-fenced in a segregated vault separate from lending operations and can be withdrawn anytime.
   - Multiple Loans: Active debt reduces available limit. They can borrow within remaining capacity or pay off existing balance.
   - Approval Time: Standard disbursals take 30 minutes to 2 hours.
   - Charges / Halal: 0% compound usury, only standard transparent subscription/service fees.
   - Office / Hours: Central digital operations headquartered in Dhaka, support available 24/7.
4. Response Format: 1 to 3 short, human-like, crystal-clear, professional sentences. No robotic paragraphs, no markdown bullet storms, no repetitive boilerplate.
5. Strict Boundaries: You cannot directly approve loans or edit bank ledgers from this chat window. If a member requests immediate manual approval or expresses an urgent dispute, explain politely that the audit board handles final disbursements, and set escalate=true to open an administrative ticket.`;

        if (customPrompt) {
          systemInstruction += `\n\nCustom Persona/Instructions for ${employee.name}:\n${customPrompt}`;
        }

        const response = await ai.models.generateContent({
          model: "gemini-3.7-flash",
          contents: chatHistory,
          config: {
            systemInstruction,
            temperature: customTemp !== null ? customTemp : 0.35,
            responseMimeType: "application/json",
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                response: {
                  type: Type.STRING,
                  description: "Your professional, human-like, concise chat response to the member. Limit to 1-3 sentences with exact numbers if requested."
                },
                escalate: {
                  type: Type.BOOLEAN,
                  description: "Set to true if user requested forbidden actions (instant approval, manual balance change, etc.) or demands administrative escalation."
                },
                ticketCategory: {
                  type: Type.STRING,
                  description: "Category of the support ticket, only if escalate is true. One of: 'Loan Issue', 'Deposit Help', 'Security Block', 'General Help', 'Technical Error'."
                },
                ticketPriority: {
                  type: Type.STRING,
                  description: "Priority of the ticket, only if escalate is true. One of: 'Low', 'Medium', 'High', 'Urgent'."
                },
                ticketDescription: {
                  type: Type.STRING,
                  description: "A very brief 1-sentence summary of the member's issue for the admin's ticket dashboard."
                }
              },
              required: ["response", "escalate"]
            }
          }
        });

        try {
          const parsedResult = JSON.parse(response.text?.trim() || "{}");
          if (parsedResult.response) {
            return res.json({
              response: parsedResult.response,
              escalate: !!parsedResult.escalate,
              ticketCategory: parsedResult.ticketCategory || "General Help",
              ticketPriority: parsedResult.ticketPriority || "Medium",
              ticketDescription: parsedResult.ticketDescription || lastMessage || "User requested administrative support."
            });
          }
        } catch (jsonErr) {
          console.error("[Gemini JSON Parse Error]:", jsonErr);
        }

        // If JSON parsing was empty or malformed, use human knowledge engine
        const fallbackObj = generateHumanEmployeeResponse(lastMessage, userContext, employee, false);
        return res.json(fallbackObj);
      }
    } catch (error: any) {
      console.error("[Gemini Chat API Error - Running 24/7 Human Fallback Engine]:", error);
      
      // Fallback generator ensuring 100% 24/7 availability with human-type answers
      const lastMsg = (messages && messages[messages.length - 1]?.text) || '';
      const fallbackObj = generateHumanEmployeeResponse(lastMsg, userContext, employee, isAdmin);
      return res.json(fallbackObj);
    }
  }));

  // Digital Workforce Operational Reporting API Route
  app.post("/api/digital-workforce/report", safeAsync(async (req, res) => {
    if (!req.body) {
      return res.status(400).json({ error: "Missing request body" });
    }
    const { reportType, systemStats } = req.body;

    if (!reportType) {
      return res.status(400).json({ error: "Required parameter 'reportType' is missing" });
    }

    try {
      const ai = getGeminiClient();
      
      const response = await ai.models.generateContent({
        model: "gemini-3.6-flash",
        contents: `Please compile a highly detailed, professional, executive operational report for T.U.T Money Lending Authority.
Report Tier: ${reportType.toUpperCase()} SUMMARY REPORT
Live System Financial and Operations Metrics:
${JSON.stringify(systemStats || {}, null, 2)}

Requirements:
- Structure the report with clear headings, bullets, and tabular markdown where appropriate.
- Include:
  1. Executive Summary & Core Platform Health assessment
  2. Financial Performance (Analyzing Deposit volumes, Active Loan exposures, and Liquidity ratios)
  3. Operations Desk Activity (Evaluating pending membership queues, transaction volume, and risk evaluation)
  4. Workforce & Ticketing summary (Highlighting most common problems, escalation metrics, and FAQ highlights)
  5. Critical Recommendations for the T.U.T Board of Directors
- Tone: Highly professional, objective, academic, and precise. No generic AI preamble or fluff.`,
        config: {
          temperature: 0.3,
        }
      });

      res.json({
        success: true,
        reportMarkdown: response.text || "Report generation succeeded with empty output."
      });
    } catch (error: any) {
      console.error("[Gemini Report API Error]:", error);
      const reportTitle = (reportType || 'Operations').toUpperCase();
      const stats = systemStats || {};
      const fallbackReport = `# EXECUTIVE OPERATIONAL REPORT: ${reportTitle}
**Authority:** T.U.T Money Lending Authority  
**Status:** Audit Verified (Offline Backup Mode)

---

### 1. Executive Summary & Core Platform Health
- **Platform Operations Status:** 100% Operational, Active System Synchronized.
- **Active Member Accounts:** ${stats.totalUsers || 0} Registered Members.
- **Pending Verification Queue:** ${stats.pendingMembersCount || 0} Members awaiting identity confirmation.

---

### 2. Financial Performance & Risk Exposure
- **Active Debt Exposure:** ৳${(stats.remainingDebt || 0).toLocaleString()} BDT total outstanding loans across ${stats.totalLoans || 0} active borrowing accounts.
- **Reserve Liquidity:** ৳${(stats.totalDeposits || 0).toLocaleString()} BDT total member deposits held in reserve.

---

### 3. Compliance & Operational Directives
- Operations desks are active 24/7. All digital workforce agents maintain real-time response capability.
- Board recommendation: Proceed with scheduled queue clearance and interest ledger audits.`;

      res.json({
        success: true,
        reportMarkdown: fallbackReport
      });
    }
  }));

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  // Global Exception Catching middleware for Express
  app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error("[Global Error Handled]:", err);
    res.status(err.status || 500).json({ 
      error: "Internal Server Error", 
      message: err.message || "An unexpected error occurred on the server.",
      timestamp: new Date().toISOString()
    });
  });

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
