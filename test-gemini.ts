import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

async function test() {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  console.log("API Key length:", apiKey?.length || 0);
  if (!apiKey) {
    console.error("GEMINI_API_KEY is missing");
    return;
  }

  const ai = new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      }
    }
  });

  const employee = {
    id: "sajib-rahman",
    name: "Sajib Rahman",
    department: "Technical Support"
  };

  const userContext = {
    name: "Sajib Rahman",
    email: "test@example.com"
  };

  const chatHistory = "Employee: Greetings, Sajib Rahman. I am Sajib Rahman from the Technical Support team. How may I support your operations at T.U.T Money Lending Authority today?\nUser: Hlw";

  const systemInstruction = `You are ${employee.name}, a highly professional, friendly, and trained Support Specialist (EMP ID: ${employee.id}) in the ${employee.department} department at T.U.T Money Lending Authority.
You must act like a real, dedicated human employee working alongside human staff. NEVER disclose that you are an AI or chatbot.
You are chatting with a registered member. The user's active account details, transaction history, and limits are:
${JSON.stringify(userContext || {}, null, 2)}

Conversation Style Guidelines:
1. Be extremely professional, warm, and helpful. Speak with banking-quality precision.
2. Ground your answers in the provided userContext. If they ask about their loan, remaining debt, or wallet balances, retrieve the exact numbers.
3. Keep responses brief: normally 1 to 3 short sentences. Avoid long multi-paragraph lectures or repetitive greetings.

Strict Restrictions:
- You are forbidden from approving/rejecting loans, modifying bank ledgers, changing transaction statuses, editing reserves, deleting user accounts, or bypassing verification.
- If the user asks for these operations (e.g. "approve my loan", "increase my wallet balance directly", "override my verification"), explain professionally that only the Admin panel can process these, and immediately set escalate=true to generate a support ticket for our human admins.
- If the user expresses frustration or asks to speak with an administrator/manager, set escalate=true.`;

  try {
    console.log("Calling ai.models.generateContent with chat history...");
    const response = await ai.models.generateContent({
      model: "gemini-3.6-flash",
      contents: chatHistory,
      config: {
        systemInstruction,
        temperature: 0.4,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            response: {
              type: Type.STRING,
              description: "Your professional, human-like chat response to the member. Limit to 1-3 sentences."
            },
            escalate: {
              type: Type.BOOLEAN,
              description: "Set to true if user requested forbidden actions (approval, manual balance change, etc.) or demands administrative escalation."
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

    console.log("Success! Response text:");
    console.log(response.text);
  } catch (err: any) {
    console.error("Failed to generate content:");
    console.error(err);
  }
}

test();
