import { createRequire as __createRequire } from 'module'; const require = __createRequire(import.meta.url);

// server/createApiApp.ts
import express from "express";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import nodemailer from "nodemailer";
import dotenv from "dotenv";
import { GoogleGenAI, Type } from "@google/genai";

// src/utils/workforceKnowledge.ts
var OFFICIAL_MERCHANT_NUMBERS = {
  bKash: "01713710607",
  Nagad: "01921801100"
};
function extractTransactionClues(message) {
  const raw = message || "";
  const lower = raw.toLowerCase();
  const memoMatch = raw.match(/\b(TXN[-_A-Z0-9]{4,}|LOAN[-_A-Z0-9]{2,}|ISS[-0-9]{4,})\b/i);
  const trxCandidateMatch = raw.match(/\b(?=[A-Z0-9]*[0-9])(?=[A-Z0-9]*[A-Z])[A-Z0-9]{7,16}\b/i);
  const amountMatches = [...raw.matchAll(/(?:৳|tk|taka|bdt|\s|^)(\d{2,6}(?:,\d{3})?)(?:\s*(?:tk|taka|bdt|টাকা))?/gi)];
  let extractedAmount;
  for (const m of amountMatches) {
    const cleaned = Number((m[1] || "").replace(/,/g, ""));
    if (!Number.isNaN(cleaned) && cleaned >= 50 && cleaned <= 5e5) {
      extractedAmount = cleaned;
      break;
    }
  }
  let method;
  if (lower.includes("bkash") || lower.includes("\u09AC\u09BF\u0995\u09BE\u09B6")) method = "bKash";
  else if (lower.includes("nagad") || lower.includes("\u09A8\u0997\u09A6")) method = "Nagad";
  else if (lower.includes("bank") || lower.includes("\u09AC\u09CD\u09AF\u09BE\u0982\u0995")) method = "Bank Transfer";
  return {
    memoId: memoMatch ? memoMatch[1].toUpperCase() : void 0,
    trxId: trxCandidateMatch && !memoMatch ? trxCandidateMatch[0].toUpperCase() : void 0,
    amount: extractedAmount,
    method
  };
}
function generateHumanEmployeeResponse(message, member = {}, employee = {}, isAdmin = false, preferredLanguage = "en") {
  const rawMessage = (message || "").trim();
  const text = rawMessage.toLowerCase();
  const isBn = preferredLanguage === "bn";
  const empId = employee.id || "EMP-00101";
  const empName = employee.name || (empId === "EMP-00102" ? "Nusrat Jahan" : "Zubair Ahmed");
  const isCreditDesk = empId === "EMP-00101" || empName.toLowerCase().includes("zubair");
  if (isAdmin) {
    const stats = member.platformStats || {};
    const totalUsers = stats.totalUsers ?? 0;
    const totalLoans = stats.totalLoans ?? 0;
    const totalDeposits = stats.totalDeposits ?? 0;
    const remainingDebt2 = stats.remainingDebt ?? 0;
    const pendingMembers = stats.pendingMembersCount ?? 0;
    const pendingTx2 = stats.pendingTransactionsCount ?? 0;
    const openIssues2 = member.activeIssuesCount ?? 0;
    const urgentIssues = member.urgentIssuesCount ?? 0;
    if (text.includes("issue") || text.includes("complaint") || text.includes("open case") || text.includes("dispute")) {
      return {
        response: `Executive Issues Brief (${empName}): There are currently ${openIssues2} open member inquiries (${urgentIssues} marked Urgent). Priority verification cases should be audited against incoming bKash (${OFFICIAL_MERCHANT_NUMBERS.bKash}) and Nagad (${OFFICIAL_MERCHANT_NUMBERS.Nagad}) merchant ledgers before clearing the pending transaction queue (${pendingTx2} pending).`,
        escalate: false
      };
    }
    if (text.includes("reserve") || text.includes("liquid") || text.includes("risk") || text.includes("exposure")) {
      const coverage = remainingDebt2 > 0 ? Math.round(totalDeposits / remainingDebt2 * 100) : 100;
      return {
        response: `Dual-Reserve & Exposure Audit (${empName}): Total Segregated Member Deposits stand at \u09F3${Number(totalDeposits).toLocaleString()} BDT (strictly ring-fenced 1:1), while active loan exposure across ${totalLoans} accounts is \u09F3${Number(remainingDebt2).toLocaleString()} BDT (Deposit-to-Debt buffer ratio: ${coverage}%). Keep pending dispatches (${pendingTx2} items) gated by TrxID validation.`,
        escalate: false
      };
    }
    if (text.includes("pending") || text.includes("queue") || text.includes("verification") || text.includes("request")) {
      return {
        response: `Operations Queue Briefing: ${pendingMembers} member KYC registrations and ${pendingTx2} financial transactions are awaiting administrative clearance, alongside ${openIssues2} unresolved member support files.`,
        escalate: false
      };
    }
    return {
      response: `Executive Operational Summary (${empName}, ${employee.department || (isCreditDesk ? "Credit & Underwriting" : "Treasury & Member Care")}): Platform tracks ${totalUsers} members, \u09F3${Number(totalDeposits).toLocaleString()} BDT in segregated vault reserves, \u09F3${Number(remainingDebt2).toLocaleString()} BDT in active loan exposure, ${pendingTx2} pending transaction verifications, and ${openIssues2} open support inquiries (${urgentIssues} urgent).`,
      escalate: false
    };
  }
  const name = member.name || member.fullName || (isBn ? "\u09B8\u09AE\u09CD\u09AE\u09BE\u09A8\u09BF\u09A4 \u09B8\u09A6\u09B8\u09CD\u09AF" : "Valued Member");
  const firstName = name.split(" ")[0];
  const memberId = member.memberId || `TUT-${(member.uid || "MEM01").substring(0, 6).toUpperCase()}`;
  const nid = member.nid || (isBn ? "\u09AF\u09BE\u099A\u09BE\u0987\u0995\u09C3\u09A4 \u09A8\u09A5\u09BF\u09AD\u09C1\u0995\u09CD\u09A4" : "Verified on file");
  const phone = member.phone || (isBn ? "\u09A8\u09A5\u09BF\u09AD\u09C1\u0995\u09CD\u09A4 \u09A8\u09AE\u09CD\u09AC\u09B0" : "Recorded on file");
  const email = member.email || (isBn ? "\u09A8\u09BF\u09AC\u09A8\u09CD\u09A7\u09BF\u09A4 \u0985\u09CD\u09AF\u09BE\u0995\u09BE\u0989\u09A8\u09CD\u099F" : "Registered account");
  const remainingDebt = Number(member.remainingDebt || 0);
  const totalLoan = Number(member.totalLoan || 0);
  const totalDeposit = Number(member.totalDeposit || member.savingsBalance || 0);
  const borrowingLimit = Number(member.borrowingLimit || 500);
  const availableCapacity = Math.max(0, borrowingLimit - remainingDebt);
  const totalRepaid = member.totalRepaid !== void 0 ? Number(member.totalRepaid) : Math.max(0, totalLoan - remainingDebt);
  const accountStatus = (member.status || "Active").toUpperCase();
  const subTier = member.subscriptionTier ? member.subscriptionTier.toUpperCase() : "STANDARD";
  const ledger = member.ledgerSnapshot || {};
  const creditScore = ledger.creditScore ?? 650;
  const creditTier = ledger.creditTier || "Good Standing";
  const utilizationPct = ledger.utilizationPct ?? (borrowingLimit > 0 ? Math.round(remainingDebt / borrowingLimit * 100) : 0);
  const isOverdue = !!ledger.isOverdue;
  const overdueLoans = ledger.overdueLoanDetails || [];
  const maxRepaymentDays = ledger.maxRepaymentDays ?? (isOverdue || creditScore < 580 ? 30 : 40);
  const maxRepaymentDate = ledger.maxRepaymentDate || "";
  const pendingTx = ledger.pendingTransactions || [];
  const recentTx = ledger.recentTransactions || [];
  const openIssues = (member.openIssues || []).filter((i) => i.status !== "Resolved");
  const clues = extractTransactionClues(rawMessage);
  const matchedTx = [...pendingTx, ...recentTx].find(
    (tx) => clues.memoId && tx.memoId?.toUpperCase() === clues.memoId || clues.trxId && tx.trxId?.toUpperCase() === clues.trxId || clues.amount && Number(tx.amount) === clues.amount
  );
  if (text.includes("approve my loan now") || text.includes("approve now") || text.includes("bypass verification") || text.includes("cheat") || text.includes("scam") || text.includes("fraud") || text.includes("talk to manager") || text.includes("talk to admin") || text.includes("\u09AA\u09CD\u09B0\u09A4\u09BE\u09B0\u09A3\u09BE") || text.includes("\u09AE\u09CD\u09AF\u09BE\u09A8\u09C7\u099C\u09BE\u09B0")) {
    const existing = openIssues[0];
    return {
      response: isBn ? `${firstName}, \u0986\u09AA\u09A8\u09BE\u09B0 \u0989\u09A6\u09CD\u09AC\u09C7\u0997\u099F\u09BF \u0986\u09AE\u09BF \u0997\u09C1\u09B0\u09C1\u09A4\u09CD\u09AC\u09C7\u09B0 \u09B8\u09BE\u09A5\u09C7 \u09A8\u09BF\u09AF\u09BC\u09C7\u099B\u09BF\u0964 \u0986\u09AE\u09BE\u09A6\u09C7\u09B0 \u09AF\u09BE\u099A\u09BE\u0987\u0995\u09B0\u09A3 \u09A8\u09C0\u09A4\u09BF\u09AE\u09BE\u09B2\u09BE\u09B0 \u09AC\u09BE\u0987\u09B0\u09C7 \u09A4\u09BE\u09CE\u0995\u09CD\u09B7\u09A3\u09BF\u0995 \u0985\u09A8\u09C1\u09AE\u09CB\u09A6\u09A8 \u09A6\u09C7\u0993\u09AF\u09BC\u09BE \u09B8\u09AE\u09CD\u09AD\u09AC \u09A8\u09AF\u09BC, \u09A4\u09AC\u09C7 \u0986\u09AE\u09BF \u0986\u09AA\u09A8\u09BE\u09B0 \u09AC\u09BF\u09B7\u09AF\u09BC\u099F\u09BF \u09B8\u09BF\u09A8\u09BF\u09AF\u09BC\u09B0 \u0985\u09AA\u09BE\u09B0\u09C7\u09B6\u09A8 \u09AE\u09CD\u09AF\u09BE\u09A8\u09C7\u099C\u09BE\u09B0\u09C7\u09B0 \u0995\u09BE\u099B\u09C7 \u0985\u0997\u09CD\u09B0\u09BE\u09A7\u09BF\u0995\u09BE\u09B0 \u09AD\u09BF\u09A4\u09CD\u09A4\u09BF\u09A4\u09C7 \u09A8\u09A5\u09BF\u09AD\u09C1\u0995\u09CD\u09A4 \u0995\u09B0\u09C7\u099B\u09BF\u0964` : `${firstName}, I take this seriously. Per compliance controls, verification steps cannot be bypassed, so I have escalated your case directly to our Senior Operations Lead for priority review.`,
      escalate: true,
      issueDetected: true,
      issueAction: existing ? "update_existing" : "create",
      existingIssueId: existing?.id,
      issueCategory: "Security / Verification",
      issuePriority: "Urgent",
      issueTitle: "Priority Verification & Dispute Escalation",
      issueDetails: `Member ${name} (${memberId}) requested priority intervention: "${rawMessage.slice(0, 140)}"`,
      agentDiagnosis: `Member standing: ${accountStatus}, Credit Score ${creditScore}, Debt \u09F3${remainingDebt}, Deposit \u09F3${totalDeposit}. Escalated per protocol.`,
      recommendedAction: "Senior Operations Administrator to review account audit trail and respond directly.",
      suggestedReplies: isBn ? ["\u0986\u09AE\u09BE\u09B0 \u099A\u09B2\u09AE\u09BE\u09A8 \u0985\u09A8\u09C1\u09B0\u09CB\u09A7\u09C7\u09B0 \u0985\u09AC\u09B8\u09CD\u09A5\u09BE \u09A6\u09C7\u0996\u09C1\u09A8", "\u0986\u09AE\u09BE\u09B0 \u09AC\u0995\u09C7\u09AF\u09BC\u09BE \u0993 \u09B8\u09C0\u09AE\u09BE \u09AF\u09BE\u099A\u09BE\u0987 \u0995\u09B0\u09C1\u09A8"] : ["Check my open inquiry status", "Review my pending transactions"],
      ticketCategory: "Security Block",
      ticketPriority: "Urgent",
      ticketDescription: `Member ${name} (${memberId}) inquiry: "${rawMessage.slice(0, 120)}"`
    };
  }
  const isProblemReport = text.includes("issue") || text.includes("problem") || text.includes("error") || text.includes("bug") || text.includes("delay") || text.includes("not received") || text.includes("missing") || text.includes("dispute") || text.includes("wrong") || text.includes("stuck") || text.includes("failed") || text.includes("complain") || text.includes("pending too long") || text.includes("\u09B8\u09AE\u09B8\u09CD\u09AF\u09BE") || text.includes("\u0985\u09AD\u09BF\u09AF\u09CB\u0997") || text.includes("\u09AD\u09C1\u09B2") || text.includes("\u09AA\u09BE\u0987\u09A8\u09BF") || text.includes("\u0986\u099F\u0995\u09C7");
  const isFollowUpEvidence = openIssues.length > 0 && Boolean(clues.trxId || clues.memoId || clues.amount || clues.method);
  if (isFollowUpEvidence && !text.includes("how to") && !text.includes("\u0995\u09C0\u09AD\u09BE\u09AC\u09C7")) {
    const targetIssue = openIssues[0];
    const parts = [];
    if (clues.method) parts.push(clues.method);
    if (clues.amount) parts.push(`\u09F3${clues.amount.toLocaleString()}`);
    if (clues.trxId) parts.push(`TrxID ${clues.trxId}`);
    if (clues.memoId) parts.push(`Ref ${clues.memoId}`);
    const summaryStr = parts.join(" \xB7 ");
    const ledgerCheckNote = matchedTx ? isBn ? `\u0986\u09AA\u09A8\u09BE\u09B0 \u09B2\u09C7\u099C\u09BE\u09B0\u09C7 ${matchedTx.memoId || ""} (\u09F3${Number(matchedTx.amount || 0).toLocaleString()}, \u0985\u09AC\u09B8\u09CD\u09A5\u09BE: ${matchedTx.status}) \u09B0\u09C7\u0995\u09B0\u09CD\u09A1\u099F\u09BF \u0996\u09C1\u0981\u099C\u09C7 \u09AA\u09BE\u0993\u09AF\u09BC\u09BE \u0997\u09C7\u099B\u09C7\u0964` : `I matched this to your ledger entry ${matchedTx.memoId || ""} (\u09F3${Number(matchedTx.amount || 0).toLocaleString()}, status: ${matchedTx.status}).` : isBn ? `\u098F\u0987 \u09A4\u09A5\u09CD\u09AF\u099F\u09BF \u0986\u09AE\u09BE\u09A6\u09C7\u09B0 \u09AA\u09C7\u09AE\u09C7\u09A8\u09CD\u099F \u09AF\u09BE\u099A\u09BE\u0987\u0995\u09B0\u09A3 \u09A1\u09C7\u09B8\u09CD\u0995\u09C7 \u09AE\u09BF\u09B2\u09BF\u09AF\u09BC\u09C7 \u09A6\u09C7\u0996\u09BE \u09B9\u099A\u09CD\u099B\u09C7\u0964` : `I have attached this to our verification queue for merchant statement cross-check.`;
    return {
      response: isBn ? `\u09A7\u09A8\u09CD\u09AF\u09AC\u09BE\u09A6 ${firstName}! \u0986\u09AA\u09A8\u09BE\u09B0 \u09A6\u09C7\u0993\u09AF\u09BC\u09BE \u09A4\u09A5\u09CD\u09AF (${summaryStr}) \u0986\u09AE\u09BF \u099A\u09B2\u09AE\u09BE\u09A8 \u0995\u09C7\u09B8 #${targetIssue.id}-\u098F \u09AF\u09C1\u0995\u09CD\u09A4 \u0995\u09B0\u09C7\u099B\u09BF\u0964 ${ledgerCheckNote}` : `Thank you, ${firstName}. I have updated case #${targetIssue.id} with your details (${summaryStr}). ${ledgerCheckNote}`,
      escalate: false,
      issueDetected: true,
      issueAction: "update_existing",
      existingIssueId: targetIssue.id,
      issueCategory: targetIssue.category || "Repayment Verification",
      issuePriority: targetIssue.priority || "High",
      issueTitle: targetIssue.title,
      issueDetails: `Follow-up evidence received (${summaryStr}): "${rawMessage.slice(0, 140)}"`,
      agentDiagnosis: matchedTx ? `Matched ledger entry ${matchedTx.memoId || matchedTx.id} (${matchedTx.type}, \u09F3${matchedTx.amount}, ${matchedTx.status}, TrxID: ${matchedTx.trxId || clues.trxId || "N/A"}).` : `Member provided ${summaryStr}; no exact TrxID auto-match in last 10 ledger entries \u2014 manual merchant ledger reconciliation advised.`,
      recommendedAction: `Cross-verify ${clues.method || "bKash/Nagad"} merchant ledger for ${clues.trxId || clues.amount || "submitted payment"} and update #${targetIssue.id}.`,
      relatedTransactionId: matchedTx?.memoId || clues.memoId || clues.trxId,
      missingDetails: !clues.trxId && !matchedTx?.trxId ? ["Transaction ID (TrxID)"] : [],
      suggestedReplies: isBn ? ["\u0995\u09CB\u09A8\u09CB \u099F\u09CD\u09B0\u09BE\u09A8\u099C\u09C7\u0995\u09B6\u09A8 \u09AA\u09C7\u09A8\u09CD\u09A1\u09BF\u0982 \u0986\u099B\u09C7?", "\u0986\u09AE\u09BE\u09B0 \u09AC\u09B0\u09CD\u09A4\u09AE\u09BE\u09A8 \u09B8\u099E\u09CD\u099A\u09AF\u09BC \u0993 \u09AC\u0995\u09C7\u09AF\u09BC\u09BE \u0995\u09A4?"] : ["Are any of my requests still pending?", "Show my updated account summary"]
    };
  }
  if (isProblemReport) {
    const hasSpecificTarget = Boolean(
      clues.trxId || clues.memoId || clues.amount || rawMessage.length > 55
    );
    if (!hasSpecificTarget && pendingTx.length === 0) {
      return {
        response: isBn ? `\u09A6\u09C1\u0983\u0996\u09BF\u09A4 \u09B6\u09C1\u09A8\u09C7, ${firstName}\u0964 \u0986\u09AE\u09BF \u09AC\u09BF\u09B7\u09AF\u09BC\u099F\u09BF \u098F\u0996\u09A8\u0987 \u09AF\u09BE\u099A\u09BE\u0987 \u0995\u09B0\u09C7 \u09A8\u09A5\u09BF\u09AD\u09C1\u0995\u09CD\u09A4 \u0995\u09B0\u099B\u09BF\u2014\u09B6\u09C1\u09A7\u09C1 \u09AC\u09B2\u09AC\u09C7\u09A8 \u0995\u09BF \u098F\u099F\u09BF \u0995\u09CB\u09A8 \u09B2\u09C7\u09A8\u09A6\u09C7\u09A8 (\u099C\u09AE\u09BE, \u098B\u09A3 \u09A8\u09BE \u09AA\u09B0\u09BF\u09B6\u09CB\u09A7), \u0995\u09A4 \u099F\u09BE\u0995\u09BE, \u098F\u09AC\u0982 \u0986\u09AA\u09A8\u09BE\u09B0 \u09AC\u09BF\u0995\u09BE\u09B6/\u09A8\u0997\u09A6 TrxID \u09A8\u09AE\u09CD\u09AC\u09B0\u099F\u09BF \u0995\u09A4?` : `I am sorry to hear that, ${firstName}, and I will check this right away. Could you share whether this involves a deposit, loan, or repayment, along with the \u09F3 amount and your bKash/Nagad TrxID?`,
        escalate: false,
        issueDetected: false,
        issueAction: "none",
        needsClarification: true,
        missingDetails: ["Transaction Type", "Amount (BDT)", "TrxID / Reference"],
        suggestedReplies: isBn ? ["\u0986\u09AE\u09BE\u09B0 \u09AC\u09BF\u0995\u09BE\u09B6 \u099C\u09AE\u09BE \u098F\u0996\u09A8\u09CB \u09AF\u09CB\u0997 \u09B9\u09AF\u09BC\u09A8\u09BF", "\u098B\u09A3 \u09AA\u09B0\u09BF\u09B6\u09CB\u09A7 \u0995\u09B0\u09C7\u099B\u09BF \u0995\u09BF\u09A8\u09CD\u09A4\u09C1 \u09AC\u0995\u09C7\u09AF\u09BC\u09BE \u0995\u09AE\u09C7\u09A8\u09BF", "\u098B\u09A3 \u0986\u09AC\u09C7\u09A6\u09A8 \u09AA\u09C7\u09A8\u09CD\u09A1\u09BF\u0982 \u09B9\u09AF\u09BC\u09C7 \u0986\u099B\u09C7"] : ["My bKash deposit is delayed", "My repayment did not update balance", "My loan request has been pending"]
      };
    }
    const inferredCategory = text.includes("repay") || text.includes("pay") || text.includes("\u09AA\u09B0\u09BF\u09B6\u09CB\u09A7") ? "Repayment Verification" : text.includes("deposit") || text.includes("withdraw") || text.includes("\u099C\u09AE\u09BE") || text.includes("\u0989\u09A4\u09CD\u09A4\u09CB\u09B2\u09A8") ? "Deposit Help" : text.includes("bug") || text.includes("app") || text.includes("crash") ? "App Bug" : "Loan Issue";
    const targetPending = matchedTx || pendingTx[0];
    const targetRef = targetPending?.memoId || clues.memoId || clues.trxId;
    const missing = [];
    if (!clues.trxId && !targetPending?.trxId && inferredCategory !== "Loan Issue" && inferredCategory !== "App Bug") {
      missing.push("Transaction ID (TrxID)");
    }
    if (!clues.amount && !targetPending?.amount && inferredCategory !== "App Bug") {
      missing.push("Exact Amount (BDT)");
    }
    const existingSameCat = openIssues.find((i) => i.category === inferredCategory);
    const contextNote = targetPending ? isBn ? ` \u0986\u09AA\u09A8\u09BE\u09B0 \u099A\u09B2\u09AE\u09BE\u09A8 ${targetPending.type} \u0985\u09A8\u09C1\u09B0\u09CB\u09A7 (${targetPending.memoId || ""} \xB7 \u09F3${Number(targetPending.amount || 0).toLocaleString()}) \u0986\u09AE\u09BF \u09AB\u09BE\u0987\u09B2\u09C7 \u09AF\u09C1\u0995\u09CD\u09A4 \u0995\u09B0\u09C7\u099B\u09BF\u0964` : ` I have linked your ledger entry ${targetPending.memoId || ""} (${targetPending.type} \xB7 \u09F3${Number(targetPending.amount || 0).toLocaleString()}) directly to this inquiry.` : "";
    const followUpAsk = missing.length > 0 ? isBn ? ` \u09A6\u09CD\u09B0\u09C1\u09A4 \u09B8\u09AE\u09BE\u09A7\u09BE\u09A8\u09C7\u09B0 \u099C\u09A8\u09CD\u09AF \u0985\u09A8\u09C1\u0997\u09CD\u09B0\u09B9 \u0995\u09B0\u09C7 ${missing.join(" \u098F\u09AC\u0982 ")} \u09B6\u09C7\u09AF\u09BC\u09BE\u09B0 \u0995\u09B0\u09AC\u09C7\u09A8 \u0995\u09BF?` : ` To speed up verification, could you also share your ${missing.join(" and ")}?` : "";
    return {
      response: isBn ? `${firstName}, \u09AC\u09BF\u09B7\u09AF\u09BC\u099F\u09BF \u099C\u09BE\u09A8\u09BE\u09A8\u09CB\u09B0 \u099C\u09A8\u09CD\u09AF \u09A7\u09A8\u09CD\u09AF\u09AC\u09BE\u09A6\u0964${contextNote} \u0986\u09AE\u09BF \u0986\u09AE\u09BE\u09A6\u09C7\u09B0 \u0985\u09AA\u09BE\u09B0\u09C7\u09B6\u09A8 \u09A1\u09C7\u09B8\u09CD\u0995\u09C7 \u09AC\u09BF\u09B7\u09AF\u09BC\u099F\u09BF \u0997\u09C1\u09B0\u09C1\u09A4\u09CD\u09AC\u09C7\u09B0 \u09B8\u09BE\u09A5\u09C7 \u09A8\u09A5\u09BF\u09AD\u09C1\u0995\u09CD\u09A4 \u0995\u09B0\u099B\u09BF\u0964${followUpAsk}` : `Thank you for flagging this, ${firstName}.${contextNote} I am logging this cleanly with our Operations Desk so it is audited promptly.${followUpAsk}`,
      escalate: text.includes("urgent") || text.includes("\u099C\u09B0\u09C1\u09B0\u09BF"),
      issueDetected: true,
      issueAction: existingSameCat ? "update_existing" : "create",
      existingIssueId: existingSameCat?.id,
      issueCategory: inferredCategory,
      issuePriority: text.includes("urgent") || text.includes("\u099C\u09B0\u09C1\u09B0\u09BF") || missing.length === 0 ? "High" : "Medium",
      issueTitle: `${inferredCategory}${targetRef ? ` (${targetRef})` : ""}`,
      issueDetails: `${rawMessage.slice(0, 180)}`,
      agentDiagnosis: targetPending ? `Matched ledger entry: ${targetPending.memoId || "N/A"} | ${targetPending.type} \u09F3${targetPending.amount} | Status: ${targetPending.status} | TrxID: ${targetPending.trxId || clues.trxId || "Missing"}.` : `Member reported ${inferredCategory}; pending ledger items: ${pendingTx.length}. Missing clues: ${missing.length > 0 ? missing.join(", ") : "None"}.`,
      recommendedAction: targetPending?.trxId || clues.trxId ? `Audit ${clues.method || targetPending?.paymentMethod || "merchant"} record for TrxID ${targetPending?.trxId || clues.trxId} and reconcile member ledger.` : `Review member's ${inferredCategory} record and verify incoming bKash (${OFFICIAL_MERCHANT_NUMBERS.bKash}) / Nagad (${OFFICIAL_MERCHANT_NUMBERS.Nagad}) settlement.`,
      relatedTransactionId: targetRef,
      missingDetails: missing,
      needsClarification: missing.length > 0,
      suggestedReplies: missing.length > 0 ? isBn ? ["\u09AC\u09BF\u0995\u09BE\u09B6 (01713710607) \u09A5\u09C7\u0995\u09C7 \u09AA\u09BE\u09A0\u09BF\u09AF\u09BC\u09C7\u099B\u09BF", "\u09A8\u0997\u09A6 (01921801100) \u09A5\u09C7\u0995\u09C7 \u09AA\u09BE\u09A0\u09BF\u09AF\u09BC\u09C7\u099B\u09BF"] : ["Sent via bKash (01713710607)", "Sent via Nagad (01921801100)"] : void 0
    };
  }
  if (text.includes("pending") || text.includes("status") || text.includes("recent transaction") || text.includes("last transaction") || text.includes("\u09AA\u09C7\u09A8\u09CD\u09A1\u09BF\u0982") || text.includes("\u0985\u09AC\u09B8\u09CD\u09A5\u09BE") || text.includes("\u09B6\u09C7\u09B7 \u09B2\u09C7\u09A8\u09A6\u09C7\u09A8")) {
    if (pendingTx.length > 0) {
      const summary = pendingTx.slice(0, 3).map((t) => `${t.memoId || "REQ"} (${t.type}: \u09F3${Number(t.amount || 0).toLocaleString()} via ${t.paymentMethod || "Portal"})`).join(", ");
      return {
        response: isBn ? `${firstName}, \u0986\u09AA\u09A8\u09BE\u09B0 \u0985\u09CD\u09AF\u09BE\u0995\u09BE\u0989\u09A8\u09CD\u099F\u09C7 \u09AC\u09B0\u09CD\u09A4\u09AE\u09BE\u09A8\u09C7 ${pendingTx.length}\u099F\u09BF \u09B2\u09C7\u09A8\u09A6\u09C7\u09A8 \u09AF\u09BE\u099A\u09BE\u0987\u09AF\u09BC\u09C7\u09B0 \u0985\u09AA\u09C7\u0995\u09CD\u09B7\u09BE\u09AF\u09BC \u0986\u099B\u09C7: ${summary}\u0964 \u09B8\u09BE\u09A7\u09BE\u09B0\u09A3\u09A4 \u09E9\u09E6 \u09AE\u09BF\u09A8\u09BF\u099F \u09A5\u09C7\u0995\u09C7 \u09E8 \u0998\u09A3\u09CD\u099F\u09BE\u09B0 \u09AE\u09A7\u09CD\u09AF\u09C7 \u09AF\u09BE\u099A\u09BE\u0987 \u09B8\u09AE\u09CD\u09AA\u09A8\u09CD\u09A8 \u09B9\u09AF\u09BC\u0964 \u0995\u09CB\u09A8\u09CB TrxID \u09B8\u0982\u09B6\u09CB\u09A7\u09A8 \u0995\u09B0\u09A4\u09C7 \u09B9\u09B2\u09C7 \u099C\u09BE\u09A8\u09BE\u09A4\u09C7 \u09AA\u09BE\u09B0\u09C7\u09A8\u0964` : `${firstName}, you currently have ${pendingTx.length} pending transaction(s): ${summary}. Verification normally completes within 30 minutes to 2 hours\u2014let me know if any TrxID needs checking.`,
        escalate: false,
        issueAction: "none",
        suggestedReplies: isBn ? ["\u09B2\u09C7\u09A8\u09A6\u09C7\u09A8\u099F\u09BF \u0985\u09A8\u09C7\u0995\u0995\u09CD\u09B7\u09A3 \u0986\u099F\u0995\u09C7 \u0986\u099B\u09C7", "\u0986\u09AE\u09BE\u09B0 \u0995\u09CD\u09B0\u09C7\u09A1\u09BF\u099F \u09B8\u09CD\u0995\u09CB\u09B0 \u0995\u09C7\u09AE\u09A8?"] : ["One of these has been pending too long", "Check my credit score"]
      };
    }
    const latest = recentTx[0];
    return {
      response: isBn ? `${firstName}, \u0986\u09AA\u09A8\u09BE\u09B0 \u0995\u09CB\u09A8\u09CB \u09B2\u09C7\u09A8\u09A6\u09C7\u09A8 \u09AC\u09B0\u09CD\u09A4\u09AE\u09BE\u09A8\u09C7 \u09AA\u09C7\u09A8\u09CD\u09A1\u09BF\u0982 \u0985\u09AC\u09B8\u09CD\u09A5\u09BE\u09AF\u09BC \u09A8\u09C7\u0987\u0964${latest ? ` \u0986\u09AA\u09A8\u09BE\u09B0 \u09B8\u09B0\u09CD\u09AC\u09B6\u09C7\u09B7 \u09B2\u09C7\u09A8\u09A6\u09C7\u09A8 \u099B\u09BF\u09B2 ${latest.type} (\u09F3${Number(latest.amount || 0).toLocaleString()} \xB7 ${latest.status})\u0964` : ""}` : `${firstName}, you have no pending transactions right now.${latest ? ` Your most recent entry was a ${latest.status} ${latest.type} of \u09F3${Number(latest.amount || 0).toLocaleString()} BDT.` : ""}`,
      escalate: false,
      issueAction: "none"
    };
  }
  if (text.includes("credit score") || text.includes("score") || text.includes("repayment date") || text.includes("repayment period") || text.includes("how many days") || text.includes("extend") || text.includes("\u0995\u09CD\u09B0\u09C7\u09A1\u09BF\u099F \u09B8\u09CD\u0995\u09CB\u09B0") || text.includes("\u09AA\u09B0\u09BF\u09B6\u09CB\u09A7\u09C7\u09B0 \u09A4\u09BE\u09B0\u09BF\u0996") || text.includes("\u0995\u09A4 \u09A6\u09BF\u09A8")) {
    return {
      response: isBn ? `${firstName}, \u0986\u09AA\u09A8\u09BE\u09B0 \u09AC\u09B0\u09CD\u09A4\u09AE\u09BE\u09A8 T.U.T \u0995\u09CD\u09B0\u09C7\u09A1\u09BF\u099F \u09B8\u09CD\u0995\u09CB\u09B0 \u09B9\u09B2\u09CB ${creditScore}/850 (${creditTier}), \u098F\u09AC\u0982 \u098B\u09A3 \u09AC\u09CD\u09AF\u09AC\u09B9\u09BE\u09B0\u09C7\u09B0 \u09B9\u09BE\u09B0 ${utilizationPct}%\u0964 \u098F\u09B0 \u09AD\u09BF\u09A4\u09CD\u09A4\u09BF\u09A4\u09C7 \u0986\u09AA\u09A8\u09BF \u09B8\u09B0\u09CD\u09AC\u09CB\u099A\u09CD\u099A ${maxRepaymentDays} \u09A6\u09BF\u09A8\u09C7\u09B0 \u09AE\u09A7\u09CD\u09AF\u09C7 \u09AA\u09B0\u09BF\u09B6\u09CB\u09A7\u09C7\u09B0 \u09B8\u09AE\u09AF\u09BC\u09B8\u09C0\u09AE\u09BE \u09AA\u09BE\u099A\u09CD\u099B\u09C7\u09A8${isOverdue ? " (\u09AC\u0995\u09C7\u09AF\u09BC\u09BE \u09B8\u09AE\u09AF\u09BC\u09CB\u09A4\u09CD\u09A4\u09C0\u09B0\u09CD\u09A3 \u09A5\u09BE\u0995\u09BE\u09AF\u09BC \u09AC\u09B0\u09CD\u09A4\u09AE\u09BE\u09A8\u09C7 \u09E9\u09E6 \u09A6\u09BF\u09A8\u09C7 \u09B8\u09C0\u09AE\u09BE\u09AC\u09A6\u09CD\u09A7)" : ""}\u0964` : `${firstName}, your current T.U.T Credit Score is ${creditScore}/850 (${creditTier}) with ${utilizationPct}% limit utilization. Based on your score, history, and capacity, your authorized repayment window is up to ${maxRepaymentDays} days${maxRepaymentDate ? ` (max due date ${maxRepaymentDate})` : ""}.`,
      escalate: false,
      issueAction: "none",
      suggestedReplies: isBn ? ["\u0995\u09C0\u09AD\u09BE\u09AC\u09C7 \u0995\u09CD\u09B0\u09C7\u09A1\u09BF\u099F \u09B8\u09CD\u0995\u09CB\u09B0 \u0993 \u09B8\u09AE\u09AF\u09BC\u09B8\u09C0\u09AE\u09BE \u09AC\u09BE\u09A1\u09BC\u09BE\u09AC?", "\u0986\u09AE\u09BE\u09B0 \u09AC\u0995\u09C7\u09AF\u09BC\u09BE \u098B\u09A3\u09C7\u09B0 \u09AC\u09BF\u09AC\u09B0\u09A3 \u09A6\u09C7\u0996\u09BE\u09A8"] : ["How can I increase my score & term?", "Check my active debt balance"]
    };
  }
  if (text.includes("my info") || text.includes("my information") || text.includes("amar info") || text.includes("amar account") || text.includes("account dossier") || text.includes("my details") || text.includes("\u0986\u09AE\u09BE\u09B0 \u09A4\u09A5\u09CD\u09AF") || text.includes("\u0986\u09AE\u09BE\u09B0 \u0985\u09CD\u09AF\u09BE\u0995\u09BE\u0989\u09A8\u09CD\u099F")) {
    return {
      response: isBn ? `${firstName}, \u0986\u09AA\u09A8\u09BE\u09B0 \u09A8\u09BF\u09AC\u09A8\u09CD\u09A7\u09BF\u09A4 \u09B9\u09BF\u09B8\u09BE\u09AC: \u09B8\u09A6\u09B8\u09CD\u09AF \u0986\u0987\u09A1\u09BF ${memberId} (${accountStatus} \xB7 ${subTier}) | \u0995\u09CD\u09B0\u09C7\u09A1\u09BF\u099F \u09B8\u09CD\u0995\u09CB\u09B0: ${creditScore}/850 | \u098B\u09A3\u09C7\u09B0 \u09B8\u09C0\u09AE\u09BE: \u09F3${borrowingLimit.toLocaleString()} | \u09AC\u0995\u09C7\u09AF\u09BC\u09BE: \u09F3${remainingDebt.toLocaleString()} | \u09B8\u099E\u09CD\u099A\u09AF\u09BC \u09AD\u09B2\u09CD\u099F: \u09F3${totalDeposit.toLocaleString()}\u0964` : `${firstName}, here is your live ledger summary: Member ID ${memberId} (${accountStatus} \xB7 ${subTier}) | Credit Score: ${creditScore}/850 | Borrowing Limit: \u09F3${borrowingLimit.toLocaleString()} BDT | Active Debt: \u09F3${remainingDebt.toLocaleString()} BDT | Vault Savings: \u09F3${totalDeposit.toLocaleString()} BDT.`,
      escalate: false,
      issueAction: "none"
    };
  }
  if (text.includes("nid") || text.includes("\u098F\u09A8\u0986\u0987\u09A1\u09BF")) {
    return {
      response: isBn ? `\u0986\u09AA\u09A8\u09BE\u09B0 \u09AB\u09BE\u0987\u09B2\u09C7 \u09A8\u09BF\u09AC\u09A8\u09CD\u09A7\u09BF\u09A4 NID \u09A8\u09AE\u09CD\u09AC\u09B0 \u09B9\u09B2\u09CB ${nid} (${name} \u09A8\u09BE\u09AE\u09C7 \u09AF\u09BE\u099A\u09BE\u0987\u0995\u09C3\u09A4)\u0964` : `Your verified National ID (NID) on file is ${nid}, registered under ${name}.`,
      escalate: false,
      issueAction: "none"
    };
  }
  if (text.includes("member id") || text.includes("\u0986\u09AE\u09BE\u09B0 \u0986\u0987\u09A1\u09BF")) {
    return {
      response: isBn ? `\u0986\u09AA\u09A8\u09BE\u09B0 \u0985\u09AB\u09BF\u09B8\u09BF\u09AF\u09BC\u09BE\u09B2 T.U.T \u09B8\u09A6\u09B8\u09CD\u09AF \u0986\u0987\u09A1\u09BF ${memberId}\u0964` : `Your official T.U.T Member ID is ${memberId}.`,
      escalate: false,
      issueAction: "none"
    };
  }
  if (text.includes("my phone") || text.includes("my email") || text.includes("\u09AB\u09CB\u09A8 \u09A8\u09AE\u09CD\u09AC\u09B0")) {
    return {
      response: isBn ? `\u0986\u09AA\u09A8\u09BE\u09B0 \u09A8\u09BF\u09AC\u09A8\u09CD\u09A7\u09BF\u09A4 \u09AE\u09CB\u09AC\u09BE\u0987\u09B2 \u09A8\u09AE\u09CD\u09AC\u09B0: ${phone} \u098F\u09AC\u0982 \u0987\u09AE\u09C7\u0987\u09B2: ${email}\u0964` : `Your contact record shows Mobile: ${phone} and Email: ${email}.`,
      escalate: false,
      issueAction: "none"
    };
  }
  if (text.includes("debt") || text.includes("due") || text.includes("baki") || text.includes("overdue") || text.includes("remaining") || text.includes("\u09AC\u0995\u09C7\u09AF\u09BC\u09BE") || text.includes("\u09AC\u09BE\u0995\u09BF")) {
    if (remainingDebt > 0) {
      const overdueNote = isOverdue && overdueLoans.length > 0 ? isBn ? ` \u26A0\uFE0F \u098F\u09B0 \u09AE\u09A7\u09CD\u09AF\u09C7 ${overdueLoans[0].loanNumber} (\u09F3${overdueLoans[0].remainingAmount.toLocaleString()}) \u09A8\u09BF\u09B0\u09CD\u09A7\u09BE\u09B0\u09BF\u09A4 \u09A4\u09BE\u09B0\u09BF\u0996 (${overdueLoans[0].dueDateStr}) \u0985\u09A4\u09BF\u0995\u09CD\u09B0\u09AE \u0995\u09B0\u09C7\u099B\u09C7\u2014\u098F\u099F\u09BF \u09B6\u09CB\u09A7 \u0995\u09B0\u09B2\u09C7 \u09E8\u09EA \u0998\u09A3\u09CD\u099F\u09BE\u09B0 \u09AE\u09A7\u09CD\u09AF\u09C7 \u09B8\u09CD\u0995\u09CB\u09B0 \u09AA\u09C1\u09A8\u09B0\u09C1\u09A6\u09CD\u09A7\u09BE\u09B0 \u09B9\u09AF\u09BC\u0964` : ` Note: Loan ${overdueLoans[0].loanNumber} (\u09F3${overdueLoans[0].remainingAmount.toLocaleString()} BDT) passed its due date (${overdueLoans[0].dueDateStr}); settling it restores your standing within 24 hours.` : "";
      return {
        response: isBn ? `${firstName}, \u0986\u09AA\u09A8\u09BE\u09B0 \u09AC\u09B0\u09CD\u09A4\u09AE\u09BE\u09A8 \u09AE\u09CB\u099F \u09AC\u0995\u09C7\u09AF\u09BC\u09BE \u09F3${remainingDebt.toLocaleString()} (\u09AE\u09CB\u099F \u09AA\u09B0\u09BF\u09B6\u09CB\u09A7\u09BF\u09A4: \u09F3${totalRepaid.toLocaleString()})\u0964${overdueNote}` : `${firstName}, your current outstanding balance is \u09F3${remainingDebt.toLocaleString()} BDT (total repaid to date: \u09F3${totalRepaid.toLocaleString()} BDT).${overdueNote}`,
        escalate: false,
        issueAction: "none"
      };
    }
    return {
      response: isBn ? `\u09B8\u09C1\u09B8\u0982\u09AC\u09BE\u09A6 ${firstName}! \u0986\u09AA\u09A8\u09BE\u09B0 \u09AC\u09B0\u09CD\u09A4\u09AE\u09BE\u09A8\u09C7 \u0995\u09CB\u09A8\u09CB \u09AC\u0995\u09C7\u09AF\u09BC\u09BE \u09A8\u09C7\u0987 (\u09F3\u09E6), \u098F\u09AC\u0982 \u0986\u09AA\u09A8\u09BF \u09B8\u09B0\u09CD\u09AC\u09CB\u099A\u09CD\u099A \u09F3${availableCapacity.toLocaleString()} \u09AA\u09B0\u09CD\u09AF\u09A8\u09CD\u09A4 \u098B\u09A3\u09C7\u09B0 \u099C\u09A8\u09CD\u09AF \u09AF\u09CB\u0997\u09CD\u09AF\u0964` : `Good news, ${firstName}\u2014you have \u09F30 BDT in outstanding debt and full access to \u09F3${availableCapacity.toLocaleString()} BDT in borrowing capacity.`,
      escalate: false,
      issueAction: "none"
    };
  }
  if (text.includes("limit") || text.includes("capacity") || text.includes("eligible") || text.includes("borrow") || text.includes("\u09B8\u09C0\u09AE\u09BE") || text.includes("\u098B\u09A3 \u09AA\u09BE\u09AC")) {
    return {
      response: isBn ? `${firstName}, \u0986\u09AA\u09A8\u09BE\u09B0 \u0985\u09A8\u09C1\u09AE\u09CB\u09A6\u09BF\u09A4 \u098B\u09A3\u09B8\u09C0\u09AE\u09BE \u09F3${borrowingLimit.toLocaleString()} \u098F\u09AC\u0982 \u09AC\u0995\u09C7\u09AF\u09BC\u09BE \u09AC\u09BE\u09A6\u09C7 \u09AC\u09B0\u09CD\u09A4\u09AE\u09BE\u09A8\u09C7 \u09F3${availableCapacity.toLocaleString()} \u09AA\u09B0\u09CD\u09AF\u09A8\u09CD\u09A4 \u0997\u09CD\u09B0\u09B9\u09A3\u09AF\u09CB\u0997\u09CD\u09AF (\u09AC\u09CD\u09AF\u09AC\u09B9\u09BE\u09B0\u09C7\u09B0 \u09B9\u09BE\u09B0 ${utilizationPct}%, \u09B8\u09B0\u09CD\u09AC\u09CB\u099A\u09CD\u099A \u09AA\u09B0\u09BF\u09B6\u09CB\u09A7 \u09B8\u09AE\u09AF\u09BC\u09B8\u09C0\u09AE\u09BE ${maxRepaymentDays} \u09A6\u09BF\u09A8)\u0964` : `${firstName}, your approved limit is \u09F3${borrowingLimit.toLocaleString()} BDT with \u09F3${availableCapacity.toLocaleString()} BDT immediately available (${utilizationPct}% utilization; authorized term up to ${maxRepaymentDays} days).`,
      escalate: false,
      issueAction: "none"
    };
  }
  if (text.includes("withdraw") || text.includes("cash out") || text.includes("\u0989\u09A4\u09CD\u09A4\u09CB\u09B2\u09A8") || text.includes("\u099F\u09BE\u0995\u09BE \u09A4\u09C1\u09B2\u09AC")) {
    return {
      response: isBn ? `${firstName}, \u0986\u09AA\u09A8\u09BE\u09B0 \u09B8\u099E\u09CD\u099A\u09BF\u09A4 \u0986\u09AE\u09BE\u09A8\u09A4 \u09F3${totalDeposit.toLocaleString()} \u0986\u09AE\u09BE\u09A6\u09C7\u09B0 \u09AE\u09C2\u09B2 \u098B\u09A3 \u09A4\u09B9\u09AC\u09BF\u09B2 \u09A5\u09C7\u0995\u09C7 \u09B8\u09AE\u09CD\u09AA\u09C2\u09B0\u09CD\u09A3 \u0986\u09B2\u09BE\u09A6\u09BE \u09B8\u09C1\u09B0\u0995\u09CD\u09B7\u09BF\u09A4 \u09AD\u09B2\u09CD\u099F\u09C7 \u09B8\u0982\u09B0\u0995\u09CD\u09B7\u09BF\u09A4\u0964 \u0986\u09AA\u09A8\u09BF \u09AA\u09CB\u09B0\u09CD\u099F\u09BE\u09B2\u09C7\u09B0 \u0989\u09A4\u09CD\u09A4\u09CB\u09B2\u09A8 \u0985\u09AA\u09B6\u09A8 \u09A5\u09C7\u0995\u09C7 \u09AF\u09C7\u0995\u09CB\u09A8\u09CB \u09B8\u09AE\u09AF\u09BC \u0986\u09AC\u09C7\u09A6\u09A8 \u0995\u09B0\u09A4\u09C7 \u09AA\u09BE\u09B0\u09C7\u09A8\u0964` : `${firstName}, your deposit savings of \u09F3${totalDeposit.toLocaleString()} BDT are held in our 1:1 segregated vault, completely separate from lending capital, and remain withdrawable anytime via your dashboard.`,
      escalate: false,
      issueAction: "none"
    };
  }
  if (text.includes("deposit") || text.includes("savings") || text.includes("vault") || text.includes("\u09B8\u099E\u09CD\u099A\u09AF\u09BC") || text.includes("\u099C\u09AE\u09BE")) {
    return {
      response: isBn ? `${firstName}, \u0986\u09AA\u09A8\u09BE\u09B0 \u09AF\u09BE\u099A\u09BE\u0987\u0995\u09C3\u09A4 \u09B8\u099E\u09CD\u099A\u09AF\u09BC \u09AD\u09B2\u09CD\u099F \u09AC\u09CD\u09AF\u09BE\u09B2\u09C7\u09A8\u09CD\u09B8 \u09F3${totalDeposit.toLocaleString()}\u0964 \u099C\u09AE\u09BE \u0995\u09B0\u09A4\u09C7 \u09AC\u09BF\u0995\u09BE\u09B6 (${OFFICIAL_MERCHANT_NUMBERS.bKash}) \u09AC\u09BE \u09A8\u0997\u09A6 (${OFFICIAL_MERCHANT_NUMBERS.Nagad})-\u098F \u099F\u09BE\u0995\u09BE \u09AA\u09BE\u09A0\u09BF\u09AF\u09BC\u09C7 \u09AA\u09CB\u09B0\u09CD\u099F\u09BE\u09B2\u09C7 \u09B8\u09A0\u09BF\u0995 TrxID \u099C\u09AE\u09BE \u09A6\u09BF\u09A8\u0964` : `${firstName}, your verified vault savings balance is \u09F3${totalDeposit.toLocaleString()} BDT. All member deposits remain ring-fenced 1:1. New deposits can be sent to bKash (${OFFICIAL_MERCHANT_NUMBERS.bKash}) or Nagad (${OFFICIAL_MERCHANT_NUMBERS.Nagad}) with your TrxID.`,
      escalate: false,
      issueAction: "none"
    };
  }
  if (text.includes("repay") || text.includes("pay due") || text.includes("bkash") || text.includes("nagad") || text.includes("payment") || text.includes("\u09AA\u09B0\u09BF\u09B6\u09CB\u09A7") || text.includes("\u09AC\u09BF\u0995\u09BE\u09B6") || text.includes("\u09A8\u0997\u09A6")) {
    return {
      response: isBn ? `\u09AA\u09B0\u09BF\u09B6\u09CB\u09A7 \u09AC\u09BE \u099C\u09AE\u09BE \u09A6\u09C7\u0993\u09AF\u09BC\u09BE\u09B0 \u099C\u09A8\u09CD\u09AF \u0985\u09AB\u09BF\u09B8\u09BF\u09AF\u09BC\u09BE\u09B2 \u09AC\u09BF\u0995\u09BE\u09B6 (${OFFICIAL_MERCHANT_NUMBERS.bKash}) \u0985\u09A5\u09AC\u09BE \u09A8\u0997\u09A6 (${OFFICIAL_MERCHANT_NUMBERS.Nagad}) \u09A8\u09AE\u09CD\u09AC\u09B0\u09C7 \u09B8\u09C7\u09A8\u09CD\u09A1 \u09AE\u09BE\u09A8\u09BF \u0995\u09B0\u09C7 \u099F\u09CD\u09B0\u09BE\u09A8\u099C\u09C7\u0995\u09B6\u09A8 \u0986\u0987\u09A1\u09BF (TrxID) \u09AA\u09CB\u09B0\u09CD\u099F\u09BE\u09B2\u09C7 \u099C\u09AE\u09BE \u09A6\u09BF\u09A8\u0964 \u0986\u09AA\u09A8\u09BE\u09B0 \u099C\u09A8\u09CD\u09AF \u09AC\u09B0\u09CD\u09A4\u09AE\u09BE\u09A8\u09C7 \u09B8\u09B0\u09CD\u09AC\u09CB\u099A\u09CD\u099A ${maxRepaymentDays} \u09A6\u09BF\u09A8 \u09AA\u09B0\u09CD\u09AF\u09A8\u09CD\u09A4 \u09AA\u09B0\u09BF\u09B6\u09CB\u09A7\u09C7\u09B0 \u09A4\u09BE\u09B0\u09BF\u0996 \u09A8\u09BF\u09B0\u09CD\u09A7\u09BE\u09B0\u09A3 \u0995\u09B0\u09BE \u09AF\u09BE\u09AF\u09BC\u0964` : `To make a payment or deposit, send funds to our official bKash (${OFFICIAL_MERCHANT_NUMBERS.bKash}) or Nagad (${OFFICIAL_MERCHANT_NUMBERS.Nagad}) account, then enter your TrxID in the Repayment portal and press-and-hold to confirm. Your account supports terms up to ${maxRepaymentDays} days.`,
      escalate: false,
      issueAction: "none"
    };
  }
  if (text.includes("how to apply") || text.includes("loan application") || text.includes("\u098B\u09A3 \u0986\u09AC\u09C7\u09A6\u09A8")) {
    return {
      response: isBn ? `\u09A8\u09A4\u09C1\u09A8 \u098B\u09A3\u09C7\u09B0 \u099C\u09A8\u09CD\u09AF \u09A1\u09CD\u09AF\u09BE\u09B6\u09AC\u09CB\u09B0\u09CD\u09A1 \u09A5\u09C7\u0995\u09C7 'Borrow' \u0985\u09AA\u09B6\u09A8\u09C7 \u09AF\u09BE\u09A8, \u09F3${availableCapacity.toLocaleString()} \u09B8\u09C0\u09AE\u09BE\u09B0 \u09AE\u09A7\u09CD\u09AF\u09C7 \u09AA\u09B0\u09BF\u09AE\u09BE\u09A3 \u09B2\u09BF\u0996\u09C1\u09A8, \u09AA\u09B0\u09BF\u09B6\u09CB\u09A7\u09C7\u09B0 \u09A4\u09BE\u09B0\u09BF\u0996 \u09AC\u09C7\u099B\u09C7 \u09A8\u09BF\u09A8 (\u09B8\u09B0\u09CD\u09AC\u09CB\u099A\u09CD\u099A ${maxRepaymentDays} \u09A6\u09BF\u09A8) \u098F\u09AC\u0982 \u09AA\u09CD\u09B0\u09C7\u09B8-\u0985\u09CD\u09AF\u09BE\u09A8\u09CD\u09A1-\u09B9\u09CB\u09B2\u09CD\u09A1 \u0995\u09B0\u09C7 \u099C\u09AE\u09BE \u09A6\u09BF\u09A8\u0964 \u09B8\u09BE\u09A7\u09BE\u09B0\u09A3\u09A4 \u09E9\u09E6 \u09AE\u09BF\u09A8\u09BF\u099F \u09A5\u09C7\u0995\u09C7 \u09E8 \u0998\u09A3\u09CD\u099F\u09BE\u09B0 \u09AE\u09A7\u09CD\u09AF\u09C7 \u09AA\u09CD\u09B0\u0995\u09CD\u09B0\u09BF\u09AF\u09BC\u09BE \u09B8\u09AE\u09CD\u09AA\u09A8\u09CD\u09A8 \u09B9\u09AF\u09BC\u0964` : `Open the Borrow portal from your dashboard, enter up to \u09F3${availableCapacity.toLocaleString()} BDT, choose a repayment date (your window allows up to ${maxRepaymentDays} days), and hold the confirmation bar to submit. Reviews take 30 minutes to 2 hours.`,
      escalate: false,
      issueAction: "none"
    };
  }
  if (text.includes("how long") || text.includes("duration") || text.includes("time") || text.includes("\u0995\u09A4 \u09B8\u09AE\u09AF\u09BC")) {
    return {
      response: isBn ? `\u09A8\u09A4\u09C1\u09A8 \u09B8\u09A6\u09B8\u09CD\u09AF \u09AF\u09BE\u099A\u09BE\u0987 \u09B8\u09BE\u09A7\u09BE\u09B0\u09A3\u09A4 \u09E7\u09EB-\u09EA\u09EB \u09AE\u09BF\u09A8\u09BF\u099F \u098F\u09AC\u0982 \u098B\u09A3 \u09AC\u09BE \u099C\u09AE\u09BE\u09B0 \u0985\u09A8\u09C1\u09AE\u09CB\u09A6\u09A8 \u09E9\u09E6 \u09AE\u09BF\u09A8\u09BF\u099F \u09A5\u09C7\u0995\u09C7 \u09E8 \u0998\u09A3\u09CD\u099F\u09BE\u09B0 \u09AE\u09A7\u09CD\u09AF\u09C7 \u09B8\u09AE\u09CD\u09AA\u09A8\u09CD\u09A8 \u09B9\u09AF\u09BC\u0964` : `Membership KYC reviews take 15\u201345 minutes, while loan and deposit verifications typically complete within 30 minutes to 2 hours.`,
      escalate: false,
      issueAction: "none"
    };
  }
  if (text.includes("interest") || text.includes("halal") || text.includes("sharia") || text.includes("\u09B8\u09C1\u09A6") || text.includes("\u09B9\u09BE\u09B2\u09BE\u09B2")) {
    return {
      response: isBn ? `T.U.T \u09B8\u09AE\u09CD\u09AA\u09C2\u09B0\u09CD\u09A3 \u09E6% \u099A\u0995\u09CD\u09B0\u09AC\u09C3\u09A6\u09CD\u09A7\u09BF \u09B8\u09C1\u09A6\u09C7 \u09B6\u09B0\u09BF\u09AF\u09BC\u09BE\u09B9\u09B8\u09AE\u09CD\u09AE\u09A4 \u09A8\u09C0\u09A4\u09BF\u09A4\u09C7 \u09AA\u09B0\u09BF\u099A\u09BE\u09B2\u09BF\u09A4 \u09B9\u09AF\u09BC\u0964 \u0995\u09CB\u09A8\u09CB \u09AC\u09BF\u09B2\u09AE\u09CD\u09AC \u099C\u09B0\u09BF\u09AE\u09BE\u09A8\u09BE \u09AC\u09BE \u0997\u09CB\u09AA\u09A8 \u099A\u09BE\u09B0\u09CD\u099C \u09A8\u09C7\u0987\u2014\u09B6\u09C1\u09A7\u09C1\u09AE\u09BE\u09A4\u09CD\u09B0 \u09A8\u09BF\u09B0\u09CD\u09A7\u09BE\u09B0\u09BF\u09A4 \u09B8\u09BE\u09AC\u09B8\u09CD\u0995\u09CD\u09B0\u09BF\u09AA\u09B6\u09A8 \u099A\u09BE\u09B0\u09CD\u099F\u09BE\u09B0 \u09AB\u09BF \u09AA\u09CD\u09B0\u09AF\u09CB\u099C\u09CD\u09AF\u0964` : `T.U.T operates under a strict 0% compound usury (zero-interest) Sharia charter\u2014no compounding penalties or hidden fees apply, only transparent tier charter contributions.`,
      escalate: false,
      issueAction: "none"
    };
  }
  if (text.includes("are you real") || text.includes("are you human") || text.includes("are you ai") || text.includes("\u09A4\u09C1\u09AE\u09BF \u0995\u09BF \u09AE\u09BE\u09A8\u09C1\u09B7") || text.includes("\u09B0\u09CB\u09AC\u099F")) {
    const roleLabelBn = isCreditDesk ? "\u09B8\u09BF\u09A8\u09BF\u09AF\u09BC\u09B0 \u098B\u09A3 \u0993 \u0995\u09CD\u09B0\u09C7\u09A1\u09BF\u099F \u0995\u09B0\u09CD\u09AE\u0995\u09B0\u09CD\u09A4\u09BE" : "\u099F\u09CD\u09B0\u09C7\u099C\u09BE\u09B0\u09BF \u0993 \u09B8\u09A6\u09B8\u09CD\u09AF \u09B8\u09C7\u09AC\u09BE \u09AC\u09BF\u09B6\u09C7\u09B7\u099C\u09CD\u099E";
    const roleLabelEn = isCreditDesk ? "Senior Credit & Underwriting Officer" : "Treasury & Member Care Specialist";
    return {
      response: isBn ? `\u0986\u09AE\u09BF ${empName}, T.U.T-\u098F\u09B0 ${roleLabelBn}\u0964 \u0986\u09AA\u09A8\u09BE\u09B0 \u0985\u09CD\u09AF\u09BE\u0995\u09BE\u0989\u09A8\u09CD\u099F, \u0995\u09CD\u09B0\u09C7\u09A1\u09BF\u099F \u09B8\u09C0\u09AE\u09BE \u0993 \u09B2\u09C7\u09A8\u09A6\u09C7\u09A8 \u09B8\u0982\u0995\u09CD\u09B0\u09BE\u09A8\u09CD\u09A4 \u09AF\u09C7\u0995\u09CB\u09A8\u09CB \u09AC\u09BF\u09B7\u09AF\u09BC\u09C7 \u09A4\u09BE\u09CE\u0995\u09CD\u09B7\u09A3\u09BF\u0995 \u09B8\u09B9\u09BE\u09AF\u09BC\u09A4\u09BE\u09B0 \u099C\u09A8\u09CD\u09AF \u0986\u09AE\u09BF \u09B8\u09B0\u09BE\u09B8\u09B0\u09BF \u0995\u09BE\u099C \u0995\u09B0\u099B\u09BF\u0964` : `I am ${empName}, ${roleLabelEn} on the T.U.T operations desk. I can verify your live ledger, review transactions, or register an investigation file anytime.`,
      escalate: false,
      issueAction: "none"
    };
  }
  if (text === "hi" || text === "hello" || text === "hey" || text.startsWith("salam") || text.includes("assalamu") || text.includes("kemon achen") || text.includes("\u0995\u09C7\u09AE\u09A8 \u0986\u099B\u09C7\u09A8") || text.includes("\u09B8\u09BE\u09B2\u09BE\u09AE")) {
    return {
      response: isBn ? `\u0993\u09AF\u09BC\u09BE\u09B2\u09BE\u0987\u0995\u09C1\u09AE \u0986\u09B8\u09B8\u09BE\u09B2\u09BE\u09AE ${firstName}! \u0986\u09AE\u09BF ${empName} \u09AC\u09B2\u099B\u09BF\u0964 \u0986\u09AA\u09A8\u09BE\u09B0 \u0985\u09CD\u09AF\u09BE\u0995\u09BE\u0989\u09A8\u09CD\u099F, \u098B\u09A3\u09C7\u09B0 \u09B8\u09C0\u09AE\u09BE \u09AC\u09BE \u099A\u09B2\u09AE\u09BE\u09A8 \u0995\u09CB\u09A8\u09CB \u09B2\u09C7\u09A8\u09A6\u09C7\u09A8 \u09A8\u09BF\u09AF\u09BC\u09C7 \u0995\u09C0\u09AD\u09BE\u09AC\u09C7 \u09B8\u09BE\u09B9\u09BE\u09AF\u09CD\u09AF \u0995\u09B0\u09A4\u09C7 \u09AA\u09BE\u09B0\u09BF?` : `Welcome, ${firstName}! This is ${empName}. How can I assist you with your account, limits, or any recent transactions today?`,
      escalate: false,
      issueAction: "none"
    };
  }
  if (text.includes("thank") || text.includes("dhonnobad") || text.includes("shukriya") || text.includes("\u09A7\u09A8\u09CD\u09AF\u09AC\u09BE\u09A6")) {
    return {
      response: isBn ? `\u0986\u09AA\u09A8\u09BE\u0995\u09C7\u0993 \u09A7\u09A8\u09CD\u09AF\u09AC\u09BE\u09A6, ${firstName}! \u0986\u09B0 \u0995\u09CB\u09A8\u09CB \u09A4\u09A5\u09CD\u09AF \u09AC\u09BE \u09B8\u09B9\u09BE\u09AF\u09BC\u09A4\u09BE\u09B0 \u09AA\u09CD\u09B0\u09AF\u09BC\u09CB\u099C\u09A8 \u09B9\u09B2\u09C7 \u099C\u09BE\u09A8\u09BE\u09AC\u09C7\u09A8\u0964` : `You are very welcome, ${firstName}! Let me know anytime if you need another check.`,
      escalate: false,
      issueAction: "none"
    };
  }
  return {
    response: isBn ? `\u09B9\u09CD\u09AF\u09BE\u09B2\u09CB ${firstName}, \u0986\u09AE\u09BF ${empName} \u09AC\u09B2\u099B\u09BF\u0964 \u0986\u09AA\u09A8\u09BE\u09B0 \u09AC\u09B0\u09CD\u09A4\u09AE\u09BE\u09A8 \u09B8\u099E\u09CD\u099A\u09AF\u09BC \u09F3${totalDeposit.toLocaleString()}, \u09AC\u0995\u09C7\u09AF\u09BC\u09BE \u09F3${remainingDebt.toLocaleString()}, \u098F\u09AC\u0982 \u0995\u09CD\u09B0\u09C7\u09A1\u09BF\u099F \u09B8\u09CD\u0995\u09CB\u09B0 ${creditScore}/850\u0964 \u0995\u09CB\u09A8 \u09A8\u09BF\u09B0\u09CD\u09A6\u09BF\u09B7\u09CD\u099F \u09B2\u09C7\u09A8\u09A6\u09C7\u09A8, \u098B\u09A3 \u09AC\u09BE \u09B8\u09AE\u09B8\u09CD\u09AF\u09BE\u09B0 \u09AC\u09BF\u09B7\u09AF\u09BC\u09C7 \u09B8\u09BE\u09B9\u09BE\u09AF\u09CD\u09AF \u0995\u09B0\u09AC \u09AC\u09B2\u09AC\u09C7\u09A8 \u0995\u09BF?` : `Hello ${firstName}, I am ${empName}. Your account currently shows \u09F3${totalDeposit.toLocaleString()} BDT in savings, \u09F3${remainingDebt.toLocaleString()} BDT active debt, and a ${creditScore}/850 credit score. Which transaction, limit, or question would you like me to look into?`,
    escalate: false,
    issueAction: "none",
    suggestedReplies: isBn ? ["\u0986\u09AE\u09BE\u09B0 \u09AA\u09C7\u09A8\u09CD\u09A1\u09BF\u0982 \u09B2\u09C7\u09A8\u09A6\u09C7\u09A8 \u099A\u09C7\u0995 \u0995\u09B0\u09C1\u09A8", "\u0986\u09AE\u09BE\u09B0 \u0995\u09CD\u09B0\u09C7\u09A1\u09BF\u099F \u09B8\u09CD\u0995\u09CB\u09B0 \u0993 \u09B8\u09C0\u09AE\u09BE \u09A6\u09C7\u0996\u09C1\u09A8", "\u098F\u0995\u099F\u09BF \u09B2\u09C7\u09A8\u09A6\u09C7\u09A8\u09C7\u09B0 \u09B8\u09AE\u09B8\u09CD\u09AF\u09BE \u099C\u09BE\u09A8\u09BE\u09AC"] : ["Check my pending transactions", "Explain my credit score & term limit", "Report a transaction issue"]
  };
}

// firebase-applet-config.json
var firebase_applet_config_default = {
  projectId: "gen-lang-client-0312572565",
  appId: "1:278919564636:web:1ed2471933bef5bb820599",
  apiKey: "AIzaSyBWYtSU0nHhJVXFxfZdVW8SRogpt01Xt5k",
  authDomain: "gen-lang-client-0312572565.firebaseapp.com",
  firestoreDatabaseId: "ai-studio-884d8dda-61da-42fa-9798-5147f9508a62",
  storageBucket: "gen-lang-client-0312572565.firebasestorage.app",
  messagingSenderId: "278919564636",
  measurementId: ""
};

// server/createApiApp.ts
dotenv.config();
var loadFirebasePublicConfig = () => {
  const candidates = [
    path.join(process.cwd(), "firebase-applet-config.json"),
    path.join(process.cwd(), "..", "firebase-applet-config.json"),
    ...typeof __dirname !== "undefined" ? [
      path.resolve(__dirname, "../firebase-applet-config.json"),
      path.resolve(__dirname, "../../firebase-applet-config.json")
    ] : []
  ];
  let fromFile = firebase_applet_config_default || {};
  for (const candidatePath of candidates) {
    try {
      if (fs.existsSync(candidatePath)) {
        const raw = fs.readFileSync(candidatePath, "utf8");
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === "object") {
          fromFile = { ...fromFile, ...parsed };
          break;
        }
      }
    } catch {
    }
  }
  return {
    projectId: process.env.TUT_FIREBASE_PROJECT_ID?.trim() || fromFile.projectId || "",
    firestoreDatabaseId: process.env.TUT_FIREBASE_DATABASE_ID?.trim() || fromFile.firestoreDatabaseId || "",
    apiKey: process.env.TUT_FIREBASE_API_KEY?.trim() || fromFile.apiKey || "",
    authDomain: process.env.TUT_FIREBASE_AUTH_DOMAIN?.trim() || fromFile.authDomain || "",
    appId: process.env.TUT_FIREBASE_APP_ID?.trim() || fromFile.appId || "",
    storageBucket: process.env.TUT_FIREBASE_STORAGE_BUCKET?.trim() || fromFile.storageBucket || "",
    messagingSenderId: process.env.TUT_FIREBASE_MESSAGING_SENDER_ID?.trim() || fromFile.messagingSenderId || ""
  };
};
var HAS_PERSISTENT_SIGNING_SECRET = Boolean(process.env.TUT_GATEWAY_SIGNING_SECRET?.trim());
var GATEWAY_SIGNING_SECRET = process.env.TUT_GATEWAY_SIGNING_SECRET?.trim() || crypto.randomBytes(32).toString("hex");
var safeAsync = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};
function mountBaseSecurityMiddleware(app2) {
  app2.disable("x-powered-by");
  app2.set("trust proxy", true);
  app2.use((req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    next();
  });
  const jsonMiddleware = express.json({ limit: "8mb" });
  app2.use((req, res, next) => {
    if (req.body !== void 0 && req.body !== null && typeof req.body === "object" && !Buffer.isBuffer(req.body)) {
      return next();
    }
    return jsonMiddleware(req, res, next);
  });
}
function mountApiRoutes(app2, options = {}) {
  const isServerless = Boolean(options.serverless || process.env.VERCEL);
  const FIREBASE_PUBLIC_CONFIG = loadFirebasePublicConfig();
  const cleanKey = (k) => {
    const trimmed = k?.trim();
    if (!trimmed || trimmed === "MY_GEMINI_API_KEY" || trimmed.length < 10) return null;
    return trimmed;
  };
  const getAvailableGeminiKeys = (forAgentId, forAgentName) => {
    const candidates = [];
    const keyOfficer1 = cleanKey(
      process.env.GEMINI_API_KEY_OFFICER_1 || process.env.GEMINI_API_KEY_ZUBAIR
    );
    const keyOfficer2 = cleanKey(
      process.env.GEMINI_API_KEY_OFFICER_2 || process.env.GEMINI_API_KEY_NUSRAT
    );
    const keyMain = cleanKey(process.env.GEMINI_API_KEY);
    const key2 = cleanKey(process.env.GEMINI_API_KEY_2);
    const key3 = cleanKey(process.env.GEMINI_API_KEY_3);
    const key4 = cleanKey(process.env.GEMINI_API_KEY_4);
    const rawList = process.env.GEMINI_API_KEYS || "";
    const poolKeys = rawList.split(",").map((s) => cleanKey(s)).filter((s) => !!s);
    const isOfficer1 = forAgentId === "EMP-00101" || forAgentName && forAgentName.toLowerCase().includes("zubair");
    const isOfficer2 = forAgentId === "EMP-00102" || forAgentName && forAgentName.toLowerCase().includes("nusrat");
    if (isOfficer1 && keyOfficer1) {
      candidates.push({
        key: keyOfficer1,
        label: "Dedicated Key for Zubair Ahmed (EMP-00101)",
        assignedAgentId: "EMP-00101"
      });
    }
    if (isOfficer2 && keyOfficer2) {
      candidates.push({
        key: keyOfficer2,
        label: "Dedicated Key for Nusrat Jahan (EMP-00102)",
        assignedAgentId: "EMP-00102"
      });
    }
    if (keyMain) {
      candidates.push({ key: keyMain, label: "Primary Default GEMINI_API_KEY" });
    }
    if (!isOfficer1 && keyOfficer1) {
      candidates.push({
        key: keyOfficer1,
        label: "Shared Failover Pool (Officer 1 Key)",
        assignedAgentId: "EMP-00101"
      });
    }
    if (!isOfficer2 && keyOfficer2) {
      candidates.push({
        key: keyOfficer2,
        label: "Shared Failover Pool (Officer 2 Key)",
        assignedAgentId: "EMP-00102"
      });
    }
    if (key2) candidates.push({ key: key2, label: "Secondary GEMINI_API_KEY_2" });
    if (key3) candidates.push({ key: key3, label: "Tertiary GEMINI_API_KEY_3" });
    if (key4) candidates.push({ key: key4, label: "Quaternary GEMINI_API_KEY_4" });
    poolKeys.forEach((k, idx) => {
      candidates.push({ key: k, label: `Pooled Key #${idx + 1}` });
    });
    const seen = /* @__PURE__ */ new Set();
    return candidates.filter((c) => {
      if (seen.has(c.key)) return false;
      seen.add(c.key);
      return true;
    });
  };
  const executeWithGeminiPool = async (agentId, agentName, operation) => {
    const keys = getAvailableGeminiKeys(agentId, agentName);
    if (keys.length === 0) {
      throw new Error("No active GEMINI_API_KEY configured in environment variables or secrets.");
    }
    let lastError = null;
    for (let i = 0; i < keys.length; i++) {
      const candidate = keys[i];
      try {
        const ai = new GoogleGenAI({
          apiKey: candidate.key,
          httpOptions: {
            headers: {
              "User-Agent": "aistudio-build"
            }
          }
        });
        return await operation(ai, candidate.label);
      } catch (err) {
        lastError = err;
        const errMsg = err?.message || String(err);
        const hasNext = i < keys.length - 1;
        console.warn(
          `[Gemini Multi-Key Failover] ${candidate.label} encountered issue: ${errMsg}. ${hasNext ? `Switching to next key (${keys[i + 1].label})...` : "All available keys attempted."}`
        );
      }
    }
    throw lastError;
  };
  const generateWithModelFallback = async (ai, contents, config) => {
    const candidateModels = ["gemini-3.8-flash", "gemini-3.1-flash-lite", "gemini-flash-latest"];
    let lastErr = null;
    for (let i = 0; i < candidateModels.length; i++) {
      const model = candidateModels[i];
      try {
        return await ai.models.generateContent({
          model,
          contents,
          config
        });
      } catch (err) {
        lastErr = err;
        const errMsg = err?.message || String(err);
        const isTemporarySpike = err?.status === 503 || errMsg.includes("503") || errMsg.includes("high demand") || errMsg.includes("UNAVAILABLE");
        if (isTemporarySpike && i < candidateModels.length - 1) {
          console.warn(
            `[Gemini Model Auto-Fallback] ${model} experiencing temporary demand spike. Automatically routing to ${candidateModels[i + 1]}...`
          );
          continue;
        }
        throw err;
      }
    }
    throw lastErr;
  };
  let cachedAuthFailure = null;
  let lastSmtpCheck = {
    checked: false,
    connected: null,
    code: "UNCHECKED",
    error: null,
    latencyMs: 0,
    checkedAt: null
  };
  const getGmailCreds = () => {
    const authUser = (process.env.TUT_AUTHORITY_GMAIL_USER || process.env.AUTHORITY_GMAIL_USER)?.trim();
    const authPass = (process.env.TUT_AUTHORITY_GMAIL_APP_PASSWORD || process.env.AUTHORITY_GMAIL_APP_PASSWORD)?.replace(/\s+/g, "").trim();
    if (authUser && authPass) {
      return {
        gmailUser: authUser,
        gmailPass: authPass,
        senderSource: process.env.TUT_AUTHORITY_GMAIL_USER ? "TUT_AUTHORITY_GMAIL_USER" : "AUTHORITY_GMAIL_USER"
      };
    }
    const gmailUser = process.env.GMAIL_USER?.trim();
    const gmailPass = process.env.GMAIL_APP_PASSWORD?.replace(/\s+/g, "").trim();
    return {
      gmailUser,
      gmailPass,
      senderSource: gmailUser ? "GMAIL_USER" : null
    };
  };
  const maskEmail = (email) => {
    if (!email) return null;
    const parts = email.split("@");
    if (parts.length !== 2) return email;
    const local = parts[0];
    const shown = local.length > 3 ? `${local.slice(0, 3)}***` : `${local.slice(0, 1)}***`;
    return `${shown}@${parts[1]}`;
  };
  const verifyGmailSmtpNow = async () => {
    const { gmailUser, gmailPass, senderSource } = getGmailCreds();
    const checkedAt = (/* @__PURE__ */ new Date()).toISOString();
    if (!gmailUser || !gmailPass) {
      lastSmtpCheck = {
        checked: true,
        connected: false,
        code: "NOT_CONFIGURED",
        error: "Missing GMAIL_USER or GMAIL_APP_PASSWORD in AI Studio Secrets / Vercel Environment Variables.",
        latencyMs: 0,
        checkedAt
      };
      return { ...lastSmtpCheck, gmailUser, gmailPass, senderSource };
    }
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: { user: gmailUser, pass: gmailPass }
    });
    const startedAt = Date.now();
    try {
      await transporter.verify();
      const latencyMs = Date.now() - startedAt;
      cachedAuthFailure = null;
      lastSmtpCheck = {
        checked: true,
        connected: true,
        code: "OK",
        error: null,
        latencyMs,
        checkedAt
      };
      return { ...lastSmtpCheck, gmailUser, gmailPass, senderSource };
    } catch (error) {
      const latencyMs = Date.now() - startedAt;
      const isAuthError = error?.code === "EAUTH" || error?.responseCode === 535 || String(error?.message || "").includes("535-5.7.8") || String(error?.message || "").includes("Username and Password not accepted");
      const errorMessage = isAuthError ? "Gmail rejected the App Password (535-5.7.8). Ensure 2-Step Verification is active on the Google account and generate a fresh 16-character App Password." : error?.message || "Unable to reach Gmail SMTP server.";
      const credFingerprint = `${gmailUser}:${gmailPass.length}:${gmailPass.slice(0, 2)}`;
      if (isAuthError) {
        cachedAuthFailure = {
          fingerprint: credFingerprint,
          message: errorMessage,
          timestamp: Date.now()
        };
      }
      lastSmtpCheck = {
        checked: true,
        connected: false,
        code: isAuthError ? "EAUTH" : error?.code || "VERIFY_FAILED",
        error: errorMessage,
        latencyMs,
        checkedAt
      };
      return { ...lastSmtpCheck, gmailUser, gmailPass, senderSource: getGmailCreds().senderSource };
    }
  };
  if (!isServerless) {
    verifyGmailSmtpNow().catch(() => {
    });
  }
  app2.get("/api/health", (_req, res) => {
    const { gmailUser, gmailPass, senderSource } = getGmailCreds();
    const resendConfigured = !!cleanKey(process.env.RESEND_API_KEY);
    const officer1KeySet = !!cleanKey(
      process.env.GEMINI_API_KEY_OFFICER_1 || process.env.GEMINI_API_KEY_ZUBAIR
    );
    const officer2KeySet = !!cleanKey(
      process.env.GEMINI_API_KEY_OFFICER_2 || process.env.GEMINI_API_KEY_NUSRAT
    );
    const primaryKeySet = !!cleanKey(process.env.GEMINI_API_KEY);
    const secondaryKeySet = !!cleanKey(process.env.GEMINI_API_KEY_2);
    const allKeys = getAvailableGeminiKeys();
    const credsPresent = !!gmailUser && gmailPass?.length === 16;
    res.json({
      status: "ok",
      timestamp: (/* @__PURE__ */ new Date()).toISOString(),
      uptimeSeconds: Math.round(process.uptime()),
      hostingMode: isServerless ? "vercel-serverless" : "node-server",
      vercelEnv: process.env.VERCEL_ENV || null,
      config: {
        gmailUserSet: !!gmailUser,
        gmailAppPasswordSet: !!gmailPass,
        gmailAppPasswordLength: gmailPass?.length || 0,
        isCorrectLength: gmailPass?.length === 16,
        senderEmail: maskEmail(gmailUser),
        activeSenderEmail: gmailUser || null,
        senderDisplayName: "T.U.T Authority",
        senderAvatarUrl: "/assets/tut-authority-logo.jpg",
        senderSource,
        emailGatewayReady: lastSmtpCheck.checked ? Boolean(lastSmtpCheck.connected || resendConfigured) : Boolean(credsPresent || resendConfigured),
        smtpVerified: lastSmtpCheck.connected,
        smtpCode: lastSmtpCheck.code,
        smtpError: lastSmtpCheck.error,
        smtpLatencyMs: lastSmtpCheck.latencyMs,
        smtpCheckedAt: lastSmtpCheck.checkedAt,
        hasResendFallback: resendConfigured,
        adminEmail: process.env.ADMIN_EMAIL?.trim() || "tahsinullahtusher999@gmail.com",
        persistentSigningSecretConfigured: HAS_PERSISTENT_SIGNING_SECRET,
        firebaseConfigLoaded: Boolean(FIREBASE_PUBLIC_CONFIG.projectId && FIREBASE_PUBLIC_CONFIG.apiKey)
      },
      geminiAi: {
        totalKeysInPool: allKeys.length,
        officer1DedicatedKey: officer1KeySet,
        officer2DedicatedKey: officer2KeySet,
        primaryKeySet,
        secondaryKeySet,
        multiKeyPoolActive: allKeys.length > 1
      }
    });
  });
  app2.get(
    "/api/banking/system-status",
    safeAsync(async (_req, res) => {
      res.json({
        status: "operational",
        hostingMode: isServerless ? "vercel-serverless" : "node-server",
        architecture: "Google Cloud Firestore Enterprise with Atomic ACID Transactions",
        security: {
          atomicTransactions: true,
          p2pTransferAtomicProtection: true,
          adminApprovalAtomicProtection: true,
          loanSettlementAtomicProtection: true,
          dataEncryptedAtRest: true,
          dataEncryptedInTransit: true,
          immutableAuditTrail: true
        },
        timestamp: (/* @__PURE__ */ new Date()).toISOString()
      });
    })
  );
  const PRIMARY_VERCEL_ORIGIN = "https://t-u-t-money-lending-authority-apkma.vercel.app";
  const gatewayRateBuckets = /* @__PURE__ */ new Map();
  const checkGatewayRateLimit = (ipKey, maxPerMin = 40) => {
    const now = Date.now();
    const bucket = gatewayRateBuckets.get(ipKey);
    if (!bucket || now > bucket.resetAt) {
      gatewayRateBuckets.set(ipKey, { count: 1, resetAt: now + 6e4 });
      return true;
    }
    if (bucket.count >= maxPerMin) return false;
    bucket.count += 1;
    return true;
  };
  const canonicalReceiptMessage = (p) => {
    return [
      "TUT-CARD-RECEIPT-V2",
      String(p.txId || "").trim(),
      String(p.memoId || "").trim(),
      String(p.merchantId || "").trim(),
      String(p.merchantName || "").trim(),
      String(p.orderId || "").trim(),
      Number(p.amount || 0).toFixed(2),
      String(p.currency || "BDT").toUpperCase(),
      String(p.payerUid || "").trim(),
      String(p.payerMemberId || "").trim(),
      String(p.cardLast4 || "").trim(),
      String(p.method || "T.U.T. Card").trim(),
      String(p.timestamp || "").trim()
    ].join("|");
  };
  const signReceiptPayload = (payload) => {
    const msg = canonicalReceiptMessage(payload);
    return crypto.createHmac("sha256", GATEWAY_SIGNING_SECRET).update(msg).digest("hex");
  };
  const signCompactData = (data) => {
    const bodyB64 = Buffer.from(JSON.stringify(data), "utf8").toString("base64url");
    const sig = crypto.createHmac("sha256", GATEWAY_SIGNING_SECRET).update(bodyB64).digest("base64url");
    return `${bodyB64}.${sig}`;
  };
  const verifyCompactData = (token) => {
    if (typeof token !== "string") return null;
    const parts = token.trim().split(".");
    if (parts.length !== 2) return null;
    const [bodyB64, providedSig] = parts;
    if (!bodyB64 || !providedSig) return null;
    const expectedSig = crypto.createHmac("sha256", GATEWAY_SIGNING_SECRET).update(bodyB64).digest("base64url");
    const a = Buffer.from(providedSig, "utf8");
    const b = Buffer.from(expectedSig, "utf8");
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
    try {
      return JSON.parse(Buffer.from(bodyB64, "base64url").toString("utf8"));
    } catch {
      return null;
    }
  };
  const verifyFirebaseIdToken = async (idToken) => {
    const firebaseApiKey = FIREBASE_PUBLIC_CONFIG.apiKey;
    if (!firebaseApiKey) {
      throw new Error("Firebase public configuration missing.");
    }
    const verifyResp = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(
        firebaseApiKey
      )}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken })
      }
    );
    const verifyData = await verifyResp.json().catch(() => ({}));
    const tokenUser = Array.isArray(verifyData?.users) ? verifyData.users[0] : null;
    if (!verifyResp.ok || !tokenUser?.localId) {
      return null;
    }
    return tokenUser;
  };
  const decodeFirestoreValue = (val) => {
    if (!val || typeof val !== "object") return void 0;
    if ("stringValue" in val) return val.stringValue;
    if ("integerValue" in val) return Number(val.integerValue);
    if ("doubleValue" in val) return Number(val.doubleValue);
    if ("booleanValue" in val) return Boolean(val.booleanValue);
    if ("timestampValue" in val) return val.timestampValue;
    if ("nullValue" in val) return null;
    if ("arrayValue" in val) {
      const values = Array.isArray(val.arrayValue?.values) ? val.arrayValue.values : [];
      return values.map(decodeFirestoreValue);
    }
    if ("mapValue" in val) {
      const fields = val.mapValue?.fields || {};
      const out = {};
      for (const [k, v] of Object.entries(fields)) {
        out[k] = decodeFirestoreValue(v);
      }
      return out;
    }
    return void 0;
  };
  const readFirestoreDocWithUserToken = async (collectionPath, docId, idToken) => {
    const projectId = FIREBASE_PUBLIC_CONFIG.projectId;
    const databaseId = FIREBASE_PUBLIC_CONFIG.firestoreDatabaseId || "(default)";
    if (!projectId) {
      throw new Error("Firebase projectId missing.");
    }
    const safeCol = collectionPath.replace(/^\/+|\/+$/g, "");
    const safeId = encodeURIComponent(docId.trim());
    const url = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(
      projectId
    )}/databases/${encodeURIComponent(databaseId)}/documents/${safeCol}/${safeId}`;
    const resp = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${idToken}`,
        "Content-Type": "application/json"
      }
    });
    if (resp.status === 404) return null;
    if (!resp.ok) {
      const errBody = await resp.text().catch(() => "");
      throw new Error(`Firestore read rejected (${resp.status}): ${errBody.slice(0, 200)}`);
    }
    const docJson = await resp.json().catch(() => null);
    const fields = docJson?.fields;
    if (!fields || typeof fields !== "object") return null;
    const result = {};
    for (const [k, v] of Object.entries(fields)) {
      result[k] = decodeFirestoreValue(v);
    }
    return result;
  };
  const isSafeWebhookUrl = (rawUrl) => {
    try {
      const parsed = new URL(rawUrl.trim());
      if (parsed.protocol !== "https:") return false;
      const host = parsed.hostname.toLowerCase();
      if (!host || host === "localhost" || host.endsWith(".local") || host.endsWith(".internal") || host === "::1" || host === "[::1]") {
        return false;
      }
      const ipv4Match = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
      if (ipv4Match) {
        const [, a, b] = ipv4Match.map(Number);
        if (a === 10 || a === 127 || a === 0 || a === 169 && b === 254 || a === 172 && b >= 16 && b <= 31 || a === 192 && b === 168) {
          return false;
        }
      }
      return host.includes(".");
    } catch {
      return false;
    }
  };
  const resolveRequestBaseUrl = (req) => {
    const rawHost = req.headers["x-forwarded-host"] || req.get("host") || "";
    const host = String(Array.isArray(rawHost) ? rawHost[0] : rawHost).split(",")[0].trim().toLowerCase();
    if (host.includes("vercel.app")) {
      return `https://${host}`;
    }
    const envUrl = process.env.APP_URL?.trim().replace(/\/+$/, "") || "";
    if (envUrl && !envUrl.includes("ais-") && !envUrl.includes(".run.app") && !envUrl.includes("localhost")) {
      return envUrl;
    }
    return PRIMARY_VERCEL_ORIGIN;
  };
  app2.options("/api/gateway/public-config", (_req, res) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    res.setHeader("Access-Control-Max-Age", "86400");
    res.status(204).end();
  });
  app2.get("/api/gateway/public-config", (req, res) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Cache-Control", "no-store");
    const baseUrl = resolveRequestBaseUrl(req);
    res.json({
      provider: "T.U.T. Private Lending Authority",
      gatewayVersion: "2.0-card-only",
      currency: "BDT",
      hostingMode: isServerless ? "vercel-serverless" : "node-server",
      persistentSigningSecretConfigured: HAS_PERSISTENT_SIGNING_SECRET,
      primaryUrl: PRIMARY_VERCEL_ORIGIN,
      firebase: {
        projectId: FIREBASE_PUBLIC_CONFIG.projectId || "",
        firestoreDatabaseId: FIREBASE_PUBLIC_CONFIG.firestoreDatabaseId || "",
        apiKey: FIREBASE_PUBLIC_CONFIG.apiKey || "",
        authDomain: FIREBASE_PUBLIC_CONFIG.authDomain || "",
        appId: FIREBASE_PUBLIC_CONFIG.appId || "",
        storageBucket: FIREBASE_PUBLIC_CONFIG.storageBucket || "",
        messagingSenderId: FIREBASE_PUBLIC_CONFIG.messagingSenderId || ""
      },
      gateway: {
        checkoutUrl: `${baseUrl}/pay`,
        createSessionUrl: `${baseUrl}/api/gateway/create-session`,
        parseSessionUrl: `${baseUrl}/api/gateway/parse-session`,
        confirmPaymentUrl: `${baseUrl}/api/gateway/confirm-payment`,
        verifyPaymentUrl: `${baseUrl}/api/gateway/verify-payment`,
        verifyReceiptUrl: `${baseUrl}/api/gateway/verify-payment`,
        publicConfigUrl: `${baseUrl}/api/gateway/public-config`,
        supportedInstruments: ["tut_card"]
      }
    });
  });
  app2.options("/api/gateway/create-session", (_req, res) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    res.setHeader("Access-Control-Max-Age", "86400");
    res.status(204).end();
  });
  app2.post(
    "/api/gateway/create-session",
    safeAsync(async (req, res) => {
      res.setHeader("Access-Control-Allow-Origin", "*");
      const clientIp = String(req.ip || req.headers["x-forwarded-for"] || "unknown");
      if (!checkGatewayRateLimit(`sess:${clientIp}`, 60)) {
        return res.status(429).json({ success: false, error: "Too many checkout session requests." });
      }
      const {
        amount,
        merchantId = "",
        merchantName,
        orderId,
        returnUrl = "",
        reference = ""
      } = req.body || {};
      const parsedAmount = Number(amount);
      if (!Number.isFinite(parsedAmount) || parsedAmount <= 0 || parsedAmount > 5e5) {
        return res.status(400).json({ success: false, error: "Amount must be between 1 and 500,000 BDT." });
      }
      if (!merchantName || typeof merchantName !== "string" || !merchantName.trim()) {
        return res.status(400).json({ success: false, error: "merchantName is required." });
      }
      const cleanOrderId = String(orderId || `ORD-${Date.now().toString(36).toUpperCase()}`).trim().slice(0, 100);
      let safeReturnUrl = "";
      if (typeof returnUrl === "string" && returnUrl.trim()) {
        try {
          const parsedRet = new URL(returnUrl.trim());
          if (parsedRet.protocol === "https:" || parsedRet.protocol === "http:") {
            safeReturnUrl = parsedRet.toString();
          }
        } catch {
          return res.status(400).json({ success: false, error: "Invalid returnUrl format." });
        }
      }
      const exp = Date.now() + 60 * 60 * 1e3;
      const sessionPayload = {
        v: 2,
        amount: Math.round(parsedAmount * 100) / 100,
        merchantId: String(merchantId || "").trim().slice(0, 100),
        merchantName: merchantName.trim().slice(0, 120),
        orderId: cleanOrderId,
        returnUrl: safeReturnUrl,
        reference: String(reference || "").trim().slice(0, 200),
        exp
      };
      const sessionToken = signCompactData(sessionPayload);
      const baseUrl = resolveRequestBaseUrl(req);
      const checkoutUrl = `${baseUrl}/pay?session=${encodeURIComponent(sessionToken)}`;
      res.json({
        success: true,
        sessionToken,
        checkoutUrl,
        expiresAt: new Date(exp).toISOString()
      });
    })
  );
  app2.get("/api/gateway/parse-session", (req, res) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Cache-Control", "no-store");
    const rawSession = String(req.query.session || "").trim();
    const parsed = verifyCompactData(rawSession);
    if (!parsed || parsed.v !== 2) {
      return res.status(400).json({ valid: false, error: "Invalid checkout session signature." });
    }
    if (!parsed.exp || Date.now() > Number(parsed.exp)) {
      return res.status(410).json({ valid: false, error: "Checkout session has expired." });
    }
    res.json({ valid: true, session: parsed });
  });
  app2.post(
    "/api/gateway/confirm-payment",
    safeAsync(async (req, res) => {
      const clientIp = String(req.ip || req.headers["x-forwarded-for"] || "unknown");
      if (!checkGatewayRateLimit(`confirm:${clientIp}`, 40)) {
        return res.status(429).json({ success: false, error: "Too many gateway confirmation requests." });
      }
      const authHeader = String(req.headers.authorization || "");
      const idToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
      if (!idToken) {
        return res.status(401).json({ success: false, error: "Missing Firebase Authorization Bearer token." });
      }
      const txId = String(req.body?.txId || "").trim();
      if (!txId || !/^[a-zA-Z0-9_-]{6,128}$/.test(txId)) {
        return res.status(400).json({ success: false, error: "Valid txId is required." });
      }
      const tokenUser = await verifyFirebaseIdToken(idToken);
      if (!tokenUser) {
        return res.status(403).json({ success: false, error: "Caller identity could not be verified." });
      }
      const txDoc = await readFirestoreDocWithUserToken("transactions", txId, idToken);
      if (!txDoc) {
        return res.status(404).json({ success: false, error: "Transaction record not found in ledger." });
      }
      if (txDoc.userId !== tokenUser.localId) {
        return res.status(403).json({ success: false, error: "Transaction does not belong to authenticated user." });
      }
      if (txDoc.type !== "merchant_payment" || txDoc.paymentInstrument !== "tut_card") {
        return res.status(400).json({ success: false, error: "Only confirmed T.U.T. Card payments can be certified." });
      }
      if (txDoc.status !== "confirmed") {
        return res.status(409).json({ success: false, error: "Transaction is not in confirmed state." });
      }
      const amount = Number(txDoc.amount);
      if (!Number.isFinite(amount) || amount <= 0) {
        return res.status(400).json({ success: false, error: "Invalid transaction amount." });
      }
      const timestamp = typeof txDoc.timestamp === "string" && txDoc.timestamp ? txDoc.timestamp : (/* @__PURE__ */ new Date()).toISOString();
      const receipt = {
        txId,
        memoId: String(txDoc.memoId || txId),
        merchantId: String(txDoc.merchantId || ""),
        merchantName: String(txDoc.merchantName || "Authorized Partner App").slice(0, 120),
        orderId: String(txDoc.orderId || txDoc.transactionId || txId).slice(0, 120),
        amount,
        currency: "BDT",
        payerUid: String(tokenUser.localId),
        payerEmail: String(tokenUser.email || ""),
        payerMemberId: String(req.body?.payerMemberId || ""),
        cardLast4: String(txDoc.cardLast4 || ""),
        method: "T.U.T. Card",
        timestamp
      };
      const signature = signReceiptPayload(receipt);
      const receiptToken = signCompactData({ v: 2, receipt, sig: signature });
      let webhookDelivered = false;
      let webhookAttempted = false;
      let allowedOrigins = [];
      if (receipt.merchantId && /^[a-zA-Z0-9_-]{4,100}$/.test(receipt.merchantId)) {
        try {
          const merchantDoc = await readFirestoreDocWithUserToken(
            "merchant_apps",
            receipt.merchantId,
            idToken
          );
          if (merchantDoc && merchantDoc.status === "active") {
            if (Array.isArray(merchantDoc.allowedOrigins)) {
              allowedOrigins = merchantDoc.allowedOrigins.filter(
                (o) => typeof o === "string" && o.startsWith("http")
              );
            }
            const webhookUrl = typeof merchantDoc.webhookUrl === "string" ? merchantDoc.webhookUrl.trim() : "";
            if (webhookUrl && isSafeWebhookUrl(webhookUrl)) {
              webhookAttempted = true;
              const controller = new AbortController();
              const timer = setTimeout(() => controller.abort(), 5e3);
              try {
                const hookResp = await fetch(webhookUrl, {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                    "X-TUT-Event": "payment.confirmed",
                    "X-TUT-Signature": signature
                  },
                  body: JSON.stringify({
                    event: "payment.confirmed",
                    receipt,
                    signature,
                    token: receiptToken
                  }),
                  redirect: "error",
                  signal: controller.signal
                });
                webhookDelivered = hookResp.ok;
              } catch (hookErr) {
                console.warn("[Gateway Webhook] Delivery failed:", hookErr?.message);
              } finally {
                clearTimeout(timer);
              }
            }
          }
        } catch (mErr) {
          console.warn("[Gateway Confirm] Merchant lookup skipped:", mErr?.message);
        }
      }
      res.json({
        success: true,
        receipt,
        signature,
        token: receiptToken,
        webhookAttempted,
        webhookDelivered,
        allowedOrigins
      });
    })
  );
  const handleVerifyGatewayPayment = safeAsync(async (req, res) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    const clientIp = String(req.ip || req.headers["x-forwarded-for"] || "unknown");
    if (!checkGatewayRateLimit(`verify:${clientIp}`, 90)) {
      return res.status(429).json({ valid: false, error: "Rate limit exceeded." });
    }
    const { token, receipt, signature } = req.body || {};
    let targetReceipt = null;
    let targetSignature = "";
    if (typeof token === "string" && token.trim()) {
      const parsed = verifyCompactData(token.trim());
      if (!parsed || parsed.v !== 2 || !parsed.receipt || typeof parsed.sig !== "string") {
        return res.status(401).json({ valid: false, error: "Invalid or tampered payment token." });
      }
      targetReceipt = parsed.receipt;
      targetSignature = parsed.sig;
    } else if (receipt && typeof signature === "string" && /^[a-f0-9]{64}$/i.test(signature.trim())) {
      targetReceipt = receipt;
      targetSignature = signature.trim();
    } else {
      return res.status(400).json({
        valid: false,
        error: "Provide either { token } or { receipt, signature }."
      });
    }
    const expectedSig = signReceiptPayload(targetReceipt);
    const sigBuf = Buffer.from(targetSignature.toLowerCase(), "hex");
    const expectedBuf = Buffer.from(expectedSig.toLowerCase(), "hex");
    const isMatch = sigBuf.length === expectedBuf.length && crypto.timingSafeEqual(sigBuf, expectedBuf);
    if (!isMatch) {
      return res.status(401).json({ valid: false, error: "Invalid payment signature." });
    }
    res.json({
      valid: true,
      status: "paid",
      verifiedAt: (/* @__PURE__ */ new Date()).toISOString(),
      txId: targetReceipt.txId,
      memoId: targetReceipt.memoId,
      amount: targetReceipt.amount,
      currency: targetReceipt.currency || "BDT",
      orderId: targetReceipt.orderId,
      merchantId: targetReceipt.merchantId || "",
      merchantName: targetReceipt.merchantName,
      cardLast4: targetReceipt.cardLast4 || "",
      method: targetReceipt.method || "T.U.T. Card",
      payerEmail: targetReceipt.payerEmail || null
    });
  });
  app2.options("/api/gateway/verify-payment", (_req, res) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    res.setHeader("Access-Control-Max-Age", "86400");
    res.status(204).end();
  });
  app2.post("/api/gateway/verify-payment", handleVerifyGatewayPayment);
  app2.options("/api/gateway/verify-receipt", (_req, res) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    res.setHeader("Access-Control-Max-Age", "86400");
    res.status(204).end();
  });
  app2.post("/api/gateway/verify-receipt", handleVerifyGatewayPayment);
  const tryResendFallback = async (params) => {
    const resendKey = cleanKey(process.env.RESEND_API_KEY);
    if (!resendKey) return null;
    const fromEmail = process.env.RESEND_FROM_EMAIL?.trim() || "T.U.T Authority <onboarding@resend.dev>";
    const startedAt = Date.now();
    try {
      const resendAttachments = Array.isArray(params.attachments) && params.attachments.length > 0 ? params.attachments.map((att) => ({
        filename: att.filename,
        content: att.content
      })) : void 0;
      const resp = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${resendKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          from: fromEmail,
          to: [params.to],
          subject: params.subject,
          text: params.text,
          html: params.html,
          ...resendAttachments ? { attachments: resendAttachments } : {}
        })
      });
      const json = await resp.json().catch(() => ({}));
      const latencyMs = Date.now() - startedAt;
      if (resp.ok && json?.id) {
        return { success: true, latencyMs, messageId: json.id, provider: "resend" };
      }
      return { success: false, latencyMs, error: json?.message || "Resend fallback failed" };
    } catch (e) {
      return {
        success: false,
        latencyMs: Date.now() - startedAt,
        error: e?.message || "Resend network error"
      };
    }
  };
  app2.post(
    "/api/gateway/card-recovery/send-otp",
    safeAsync(async (req, res) => {
      const clientIp = String(req.ip || req.headers["x-forwarded-for"] || "unknown");
      if (!checkGatewayRateLimit(`otp-send:${clientIp}`, 10)) {
        return res.status(429).json({
          success: false,
          error: "Too many recovery OTP requests. Please wait a minute."
        });
      }
      const authHeader = String(req.headers.authorization || "");
      const idToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
      if (!idToken) {
        return res.status(401).json({ success: false, error: "Authentication required." });
      }
      const tokenUser = await verifyFirebaseIdToken(idToken);
      if (!tokenUser?.localId || !tokenUser?.email) {
        return res.status(403).json({ success: false, error: "Verified account email required for Email OTP recovery." });
      }
      const otp = String(crypto.randomInt(1e5, 1e6));
      const expiresAt = Date.now() + 10 * 60 * 1e3;
      const otpHash = crypto.createHmac("sha256", GATEWAY_SIGNING_SECRET).update(`otp:${tokenUser.localId}:${expiresAt}:${otp}`).digest("hex");
      const subject = "T.U.T. Card Key Recovery Verification Code";
      const text = `Your T.U.T. Card Payment Key recovery code is: ${otp}

This code expires in 10 minutes. If you did not request a key recovery, freeze your card immediately from your dashboard.`;
      const html = `
        <div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;padding:24px;background:#0b132b;color:#f8fafc;border-radius:12px;">
          <h2 style="margin:0 0 12px;color:#fbbf24;">T.U.T. Authority \u2014 Card Key Recovery</h2>
          <p style="font-size:14px;color:#cbd5e1;line-height:1.5;">Use the one-time verification code below to reset your 6-digit T.U.T. Card Payment Key:</p>
          <div style="margin:20px 0;padding:16px;background:#070d1f;border:1px solid #334155;border-radius:10px;text-align:center;font-size:28px;font-weight:bold;letter-spacing:8px;color:#fde68a;font-family:monospace;">
            ${otp}
          </div>
          <p style="font-size:12px;color:#94a3b8;">Valid for 10 minutes. Never share this code with anyone.</p>
        </div>
      `;
      const { gmailUser, gmailPass } = getGmailCreds();
      let sent = false;
      if (gmailUser && gmailPass) {
        try {
          const transporter = nodemailer.createTransport({
            service: "gmail",
            auth: { user: gmailUser, pass: gmailPass }
          });
          await transporter.sendMail({
            from: `"T.U.T Authority" <${gmailUser}>`,
            to: tokenUser.email,
            subject,
            text,
            html
          });
          sent = true;
        } catch (mailErr) {
          console.warn("[Card Recovery OTP] Gmail send failed:", mailErr?.message);
        }
      }
      if (!sent) {
        const relay = await tryResendFallback({
          to: tokenUser.email,
          subject,
          text,
          html
        });
        if (relay?.success) {
          sent = true;
        }
      }
      if (!sent) {
        return res.status(503).json({
          success: false,
          code: "EMAIL_NOT_CONFIGURED",
          error: "Email delivery is not configured on the server right now. Use your Master Recovery Backup Key or Security Question instead."
        });
      }
      const challengeToken = signCompactData({
        purpose: "card-recovery-challenge",
        uid: tokenUser.localId,
        expiresAt,
        otpHash
      });
      res.json({
        success: true,
        challengeToken,
        maskedEmail: maskEmail(tokenUser.email),
        expiresAt: new Date(expiresAt).toISOString()
      });
    })
  );
  app2.post(
    "/api/gateway/card-recovery/verify-otp",
    safeAsync(async (req, res) => {
      const clientIp = String(req.ip || req.headers["x-forwarded-for"] || "unknown");
      if (!checkGatewayRateLimit(`otp-verify:${clientIp}`, 20)) {
        return res.status(429).json({ success: false, error: "Too many verification attempts." });
      }
      const authHeader = String(req.headers.authorization || "");
      const idToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
      if (!idToken) {
        return res.status(401).json({ success: false, error: "Authentication required." });
      }
      const tokenUser = await verifyFirebaseIdToken(idToken);
      if (!tokenUser?.localId) {
        return res.status(403).json({ success: false, error: "Invalid user session." });
      }
      const { challengeToken, otp } = req.body || {};
      const cleanOtp = String(otp || "").trim();
      if (!/^\d{6}$/.test(cleanOtp)) {
        return res.status(400).json({ success: false, error: "Enter the 6-digit verification code." });
      }
      const challenge = verifyCompactData(String(challengeToken || ""));
      if (!challenge || challenge.purpose !== "card-recovery-challenge" || challenge.uid !== tokenUser.localId) {
        return res.status(400).json({ success: false, error: "Invalid or mismatched recovery challenge." });
      }
      if (!challenge.expiresAt || Date.now() > Number(challenge.expiresAt)) {
        return res.status(410).json({ success: false, error: "Verification code expired. Request a new code." });
      }
      const candidateHash = crypto.createHmac("sha256", GATEWAY_SIGNING_SECRET).update(`otp:${tokenUser.localId}:${challenge.expiresAt}:${cleanOtp}`).digest("hex");
      const a = Buffer.from(candidateHash, "hex");
      const b = Buffer.from(challenge.otpHash, "hex");
      if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
        return res.status(401).json({ success: false, error: "Incorrect 6-digit verification code." });
      }
      const proofToken = signCompactData({
        purpose: "card-recovery-proof",
        uid: tokenUser.localId,
        exp: Date.now() + 10 * 60 * 1e3
      });
      res.json({ success: true, recoveryAuthToken: proofToken });
    })
  );
  app2.post(
    "/api/send-email",
    safeAsync(async (req, res) => {
      if (!req.body) {
        return res.status(400).json({ success: false, error: "Missing request body" });
      }
      const { to, subject, text, html, forceRetry, attachments } = req.body;
      const normalizedAttachments = Array.isArray(attachments) ? attachments.filter(
        (a) => a && typeof a.filename === "string" && typeof a.content === "string" && a.content.length > 0
      ).slice(0, 4).map((a) => ({
        filename: a.filename,
        content: a.content,
        encoding: a.encoding === "base64" ? "base64" : "base64",
        ...a.contentType ? { contentType: a.contentType } : {}
      })) : void 0;
      if (!to) {
        return res.status(400).json({ success: false, error: "Required parameter 'to' is missing or empty" });
      }
      const { gmailUser, gmailPass } = getGmailCreds();
      if (!gmailUser || !gmailPass) {
        const relay = await tryResendFallback({
          to,
          subject: subject || "T.U.T. Account Notification",
          text: text || "",
          html: html || "",
          attachments: normalizedAttachments
        });
        if (relay?.success) {
          return res.json(relay);
        }
        console.warn("[Email Gateway] Gmail credentials not configured; skipping SMTP dispatch.");
        return res.json({
          success: false,
          code: "NOT_CONFIGURED",
          retryable: true,
          latencyMs: 0,
          error: "Email service not configured. Add GMAIL_USER and GMAIL_APP_PASSWORD in AI Studio Secrets or Vercel Environment Variables."
        });
      }
      const credFingerprint = `${gmailUser}:${gmailPass.length}:${gmailPass.slice(0, 2)}`;
      if (!forceRetry && cachedAuthFailure && cachedAuthFailure.fingerprint === credFingerprint && Date.now() - cachedAuthFailure.timestamp < 2 * 60 * 1e3) {
        const relay = await tryResendFallback({
          to,
          subject: subject || "T.U.T. Account Notification",
          text: text || "",
          html: html || "",
          attachments: normalizedAttachments
        });
        if (relay?.success) {
          return res.json(relay);
        }
        return res.json({
          success: false,
          code: "EAUTH",
          retryable: false,
          latencyMs: 0,
          error: cachedAuthFailure.message
        });
      }
      const transporter = nodemailer.createTransport({
        service: "gmail",
        auth: {
          user: gmailUser,
          pass: gmailPass
        }
      });
      const startedAt = Date.now();
      try {
        const info = await transporter.sendMail({
          from: `"T.U.T Authority" <${gmailUser}>`,
          to,
          subject: subject || "T.U.T Authority Notification",
          text: text || "",
          html: html || "",
          ...normalizedAttachments && normalizedAttachments.length > 0 ? { attachments: normalizedAttachments } : {}
        });
        const latencyMs = Date.now() - startedAt;
        cachedAuthFailure = null;
        lastSmtpCheck = {
          checked: true,
          connected: true,
          code: "OK",
          error: null,
          latencyMs,
          checkedAt: (/* @__PURE__ */ new Date()).toISOString()
        };
        console.log(`[Server] Email sent successfully to: ${to} (${latencyMs}ms)`);
        res.json({
          success: true,
          latencyMs,
          messageId: info?.messageId || null,
          provider: "gmail"
        });
      } catch (error) {
        const latencyMs = Date.now() - startedAt;
        const isAuthError = error?.code === "EAUTH" || error?.responseCode === 535 || String(error?.message || "").includes("535-5.7.8") || String(error?.message || "").includes("Username and Password not accepted");
        const errorMessage = isAuthError ? "Gmail authentication failed (535-5.7.8). Check GMAIL_USER and generate a fresh 16-character GMAIL_APP_PASSWORD with 2-Step Verification enabled." : error?.message || "Failed to send email";
        if (isAuthError) {
          if (!cachedAuthFailure || cachedAuthFailure.fingerprint !== credFingerprint) {
            console.warn(
              `[Email Gateway] Gmail authentication rejected (535-5.7.8) for ${gmailUser}. Verify GMAIL_APP_PASSWORD.`
            );
          }
          cachedAuthFailure = {
            fingerprint: credFingerprint,
            message: errorMessage,
            timestamp: Date.now()
          };
        } else {
          console.warn(`[Email Gateway] Delivery warning to ${to}:`, errorMessage);
        }
        lastSmtpCheck = {
          checked: true,
          connected: false,
          code: isAuthError ? "EAUTH" : error?.code || "SEND_FAILED",
          error: errorMessage,
          latencyMs,
          checkedAt: (/* @__PURE__ */ new Date()).toISOString()
        };
        const relay = await tryResendFallback({
          to,
          subject: subject || "T.U.T. Account Notification",
          text: text || "",
          html: html || "",
          attachments: normalizedAttachments
        });
        if (relay?.success) {
          return res.json(relay);
        }
        res.json({
          success: false,
          latencyMs,
          code: isAuthError ? "EAUTH" : error?.code || "SEND_FAILED",
          retryable: !isAuthError,
          error: errorMessage
        });
      }
    })
  );
  app2.post(
    "/api/email/verify",
    safeAsync(async (_req, res) => {
      const result = await verifyGmailSmtpNow();
      const resendConfigured = !!cleanKey(process.env.RESEND_API_KEY);
      return res.json({
        ok: Boolean(result.connected),
        connected: Boolean(result.connected),
        code: result.code,
        senderEmail: maskEmail(result.gmailUser),
        activeSenderEmail: result.gmailUser || null,
        senderDisplayName: "T.U.T Authority",
        senderAvatarUrl: "/assets/tut-authority-logo.jpg",
        senderSource: result.senderSource || null,
        adminEmail: process.env.ADMIN_EMAIL?.trim() || "tahsinullahtusher999@gmail.com",
        gmailUserSet: !!result.gmailUser,
        gmailAppPasswordSet: !!result.gmailPass,
        passwordLengthOk: (result.gmailPass?.length || 0) === 16,
        hasResendFallback: resendConfigured,
        latencyMs: result.latencyMs,
        checkedAt: result.checkedAt || (/* @__PURE__ */ new Date()).toISOString(),
        error: result.error
      });
    })
  );
  app2.post(
    "/api/digital-workforce/chat",
    safeAsync(async (req, res) => {
      if (!req.body) {
        return res.status(400).json({ error: "Missing request body" });
      }
      const { messages, employee, userContext, isAdmin, preferredLanguage } = req.body;
      const lang = preferredLanguage === "bn" ? "bn" : "en";
      if (!employee || !messages || !Array.isArray(messages)) {
        return res.status(400).json({
          error: "Required parameters 'employee' and 'messages' are missing or invalid"
        });
      }
      const isCreditOfficer = employee.id === "EMP-00101" || String(employee.name || "").toLowerCase().includes("zubair") || String(employee.department || "").toLowerCase().includes("credit");
      const rolePlaybook = isCreditOfficer ? `OFFICER SPECIALIZATION \u2014 SENIOR CREDIT & UNDERWRITING OFFICER (Zubair Ahmed):
- Primary Expertise: Borrowing limits, credit risk assessment, loan allocations, overdue rehabilitation, and repayment window eligibility.
- Credit Score Model (300\u2013850 scale, 0% usury): Payment History (35%), Limit Utilization (30% \u2014 <30% optimal fast-track, >85% liquidity rationing), Vault Collateral Coverage (20%), Subscription Charter Loyalty (10%), KYC Integrity (5%).
- Dynamic Repayment Term Policy: Standard window is 30 days (restricted/overdue or score <580) to 40 days (1 month 10 days baseline). Verified members can unlock up to 90 days dynamically via Credit Score bonus (640+: +5d, 700+: +12d, 780+: +20d), settled repayment history (up to +15d), and low utilization + strong collateral capacity (up to +15d).
- Delinquency Rehabilitation (REG-404): Paying off an overdue loan restores up to 80% of penalty points within 24 hours of settlement.` : `OFFICER SPECIALIZATION \u2014 TREASURY & MEMBER CARE SPECIALIST (Nusrat Jahan):
- Primary Expertise: Segregated 1:1 Member Deposit Vault safety, withdrawals, bKash & Nagad TrxID payment verification, subscription charters, and member dispute care.
- Dual-Reserve Protection: Member Deposit Reserves are ring-fenced 1:1 in a segregated vault and never commingled with lending pools; deposits remain withdrawable anytime.
- Official Payment Channels: bKash (01713710607) and Nagad (01921801100). Always verify Transaction ID (TrxID), exact BDT amount, payment channel, and memo reference (TXN-...) during reconciliation.
- Subscription Charters: Bronze (\u09F350/mo -> \u09F3500 base limit), Silver (\u09F3100/mo -> \u09F31,500 base limit), Gold (\u09F3150/mo -> \u09F32,500 base limit); streaks unlock loyalty score and higher ceilings.`;
      try {
        const lastMessage = messages[messages.length - 1]?.text || "";
        const chatHistory = messages.slice(-14).map(
          (msg) => `${msg.sender === "user" ? isAdmin ? "Admin" : "Member" : employee.name}: ${msg.text}`
        ).join("\n");
        const customPrompt = employee.customPrompt || "";
        const customTemp = typeof employee.temperature === "number" ? employee.temperature : null;
        if (isAdmin) {
          let systemInstruction = `You are ${employee.name}, ${employee.position} (${employee.department}, ID: ${employee.id}) at T.U.T. Money Lending Authority.
${rolePlaybook}

You are advising the System Administrator inside the Operations Console.
Live Platform, Reserve, Queue & Issues Context:
${JSON.stringify(userContext || {}, null, 2)}

EXECUTIVE BRIEFING DIRECTIVES:
1. Speak strictly as an experienced senior banking officer. Never mention AI, models, prompts, or system internals.
2. Cite exact figures from the live context (total deposits, active debt exposure, pending verifications, open/urgent issues, deposit-to-debt solvency buffer).
3. Prioritize actionable risk controls: highlight TrxID audit priorities for bKash (01713710607) & Nagad (01921801100), overdue recovery exposure, and unresolved urgent member cases.
4. Format answers clearly with concise structure (2\u20135 crisp sentences or short bullet points).`;
          if (customPrompt) {
            systemInstruction += `

Administrator Directives for ${employee.name}:
${customPrompt}`;
          }
          const responseText = await executeWithGeminiPool(
            employee.id,
            employee.name,
            async (ai) => {
              const response = await generateWithModelFallback(ai, chatHistory, {
                systemInstruction,
                temperature: customTemp !== null ? customTemp : 0.22
              });
              return response.text?.trim() || "Operational review completed. All ledgers remain synchronized.";
            }
          );
          return res.json({
            response: responseText,
            escalate: false,
            issueDetected: false
          });
        } else {
          let systemInstruction = `You are ${employee.name}, ${employee.position} (${employee.department}) at T.U.T. Money Lending Authority.
${rolePlaybook}

REALISM & COMMUNICATION STANDARDS:
- Speak as a calm, expert, empathetic human banking officer.
- NEVER say you are an AI, bot, model, or automated assistant. Never use robotic disclaimers or long walls of text.
- Keep replies concise, crisp, and practical (typically 1 to 3 focused sentences).

STRICT LANGUAGE RULE:
Selected conversation language: ${lang === "bn" ? "BENGALI (\u09AC\u09BE\u0982\u09B2\u09BE)" : "ENGLISH"}.
- Reply EXCLUSIVELY in ${lang === "bn" ? "natural, polite everyday BENGALI (\u09AC\u09BE\u0982\u09B2\u09BE script)" : "clear, warm conversational ENGLISH"}, even if the member writes in another language or Banglish.
${lang === "bn" ? '- Use natural Bangla banking phrasing (\u09AF\u09C7\u09AE\u09A8: "\u0986\u09AA\u09A8\u09BE\u09B0 \u09AC\u0995\u09C7\u09AF\u09BC\u09BE", "\u09B8\u099E\u09CD\u099A\u09AF\u09BC \u09AD\u09B2\u09CD\u099F", "\u09AC\u09BF\u0995\u09BE\u09B6/\u09A8\u0997\u09A6 TrxID", "\u0995\u09CB\u09A8\u09CB \u099A\u09BF\u09A8\u09CD\u09A4\u09BE \u09A8\u09C7\u0987, \u0986\u09AE\u09BF \u09A6\u09C7\u0996\u099B\u09BF").' : ""}

LIVE MEMBER DOSSIER, LEDGER & OPEN INQUIRIES:
${JSON.stringify(userContext || {}, null, 2)}

EXPERT ENQUIRY SKILL:
1. AUDIT BEFORE ASKING: Always check userContext.ledgerSnapshot (pendingTransactions, recentTransactions, activeLoans, overdueLoanDetails, creditScore, maxRepaymentDays) first! If a matching pending or recent transaction is already on file, quote its Memo ID, amount, payment method, and status immediately.
2. TARGETED CLARIFICATION: If the member mentions a payment delay, missing deposit, failed repayment, or vague problem WITHOUT sufficient specifics (e.g., missing TrxID, payment method bKash/Nagad, exact \u09F3 amount, or which transaction), ask 1\u20132 direct, friendly clarifying questions rather than guessing!
   - Populate needsClarification = true and list what is missing in missingDetails.
   - Do NOT open a premature duplicate ticket if they only said "I have a problem" without telling you what happened yet \u2014 set issueAction = 'none' and ask what happened first. Once they describe the actual incident/dispute, register or update the ticket immediately!

SMART REPORT NOTING & DEDUPLICATION:
- Check userContext.openIssues before opening any new issue!
- issueAction MUST be one of:
  * "none": normal Q&A, policy query, status check, or initial vague "I need to report an issue" before any facts are known.
  * "create": member reported a concrete issue, dispute, delay, missing credit, bug, or escalation NOT covered by an open issue in userContext.openIssues.
  * "update_existing": member provided follow-up evidence (like a TrxID, amount, channel, or clarification) or extra details relating to an EXISTING open issue in userContext.openIssues! Set existingIssueId to that exact ISS-XXXXX ID.
- Whenever issueAction is "create" or "update_existing":
  * issueTitle: short 4\u20138 word factual docket heading in English for Ops clarity (e.g., "Delayed bKash Deposit \u09F31,500 TrxID Check").
  * issueDetails: factual 1\u20132 sentence record including amount, payment channel, TrxID/memo if known, and member's stated problem.
  * agentDiagnosis: concise investigative finding from comparing the member's claim against ledgerSnapshot (note what matched or what is still missing).
  * recommendedAction: exact operational instruction for the Admin Desk (e.g., "Verify TrxID XXXXX on bKash 01713710607 merchant log and approve TXN-...").
  * relatedTransactionId: exact TXN-... memo or TrxID if identified.
  * missingDetails: array of any remaining verification gaps (empty array if complete).
  * issuePriority: Urgent (fraud/lockout/severe dispute), High (missing money/delayed settlement/failed repayment), Medium (general delay/account update), Low (minor question).
- suggestedReplies: provide 2\u20133 ultra-short (2\u20136 word) contextual follow-up options in ${lang === "bn" ? "BENGALI" : "ENGLISH"} relevant to the next logical step in the enquiry.`;
          if (customPrompt) {
            systemInstruction += `

Custom Persona/Instructions for ${employee.name}:
${customPrompt}`;
          }
          let parsedResult = null;
          try {
            parsedResult = await executeWithGeminiPool(
              employee.id,
              employee.name,
              async (ai) => {
                const response = await generateWithModelFallback(ai, chatHistory, {
                  systemInstruction,
                  temperature: customTemp !== null ? customTemp : 0.3,
                  responseMimeType: "application/json",
                  responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                      response: {
                        type: Type.STRING,
                        description: "Concise, warm, expert human banking officer response in the selected language (1-3 sentences)."
                      },
                      issueAction: {
                        type: Type.STRING,
                        description: "Must be 'none', 'create', or 'update_existing'."
                      },
                      existingIssueId: {
                        type: Type.STRING,
                        description: "Exact ISS-XXXXX id from userContext.openIssues when issueAction is 'update_existing'."
                      },
                      issueDetected: {
                        type: Type.BOOLEAN,
                        description: "True when issueAction is 'create' or 'update_existing'."
                      },
                      issueCategory: {
                        type: Type.STRING,
                        description: "One of: 'Loan Issue', 'Deposit Help', 'Repayment Verification', 'Security / Verification', 'App Bug', 'General Inquiry'."
                      },
                      issuePriority: {
                        type: Type.STRING,
                        description: "One of: 'Low', 'Medium', 'High', 'Urgent'."
                      },
                      issueTitle: {
                        type: Type.STRING,
                        description: "Short 4-8 word factual title for the operations docket."
                      },
                      issueDetails: {
                        type: Type.STRING,
                        description: "Factual incident summary including amount, channel, and TrxID/memo if present."
                      },
                      agentDiagnosis: {
                        type: Type.STRING,
                        description: "Officer investigation notes comparing member statement against ledgerSnapshot."
                      },
                      recommendedAction: {
                        type: Type.STRING,
                        description: "Specific next verification or resolution step for the Admin Desk."
                      },
                      relatedTransactionId: {
                        type: Type.STRING,
                        description: "Related TXN memo ID or TrxID if identified."
                      },
                      missingDetails: {
                        type: Type.ARRAY,
                        items: { type: Type.STRING },
                        description: "Specific details still needed from the member (e.g. TrxID, Payment Method), or empty."
                      },
                      needsClarification: {
                        type: Type.BOOLEAN,
                        description: "True if waiting on member to supply clarifying info."
                      },
                      escalate: {
                        type: Type.BOOLEAN,
                        description: "True if demanding forbidden manual bypass or direct executive intervention."
                      },
                      suggestedReplies: {
                        type: Type.ARRAY,
                        items: { type: Type.STRING },
                        description: "2-3 concise contextual quick-reply suggestions in the selected language."
                      }
                    },
                    required: ["response", "issueAction", "issueDetected", "escalate"]
                  }
                });
                return JSON.parse(response.text?.trim() || "{}");
              }
            );
          } catch (jsonErr) {
            console.warn("[Gemini Multi-Key Result Parse Warning]:", jsonErr);
          }
          if (parsedResult && parsedResult.response) {
            const cleanExistingId = parsedResult.existingIssueId && parsedResult.existingIssueId !== "null" && parsedResult.existingIssueId !== "undefined" ? String(parsedResult.existingIssueId).trim() : void 0;
            const normalizedAction = parsedResult.issueAction === "update_existing" && cleanExistingId ? "update_existing" : parsedResult.issueAction === "create" || parsedResult.issueDetected ? "create" : "none";
            return res.json({
              response: parsedResult.response,
              issueAction: normalizedAction,
              existingIssueId: cleanExistingId,
              issueDetected: normalizedAction !== "none",
              issueCategory: parsedResult.issueCategory || "General Inquiry",
              issuePriority: parsedResult.issuePriority || "Medium",
              issueTitle: parsedResult.issueTitle || (normalizedAction !== "none" ? "Member Reported Inquiry" : ""),
              issueDetails: parsedResult.issueDetails || lastMessage,
              agentDiagnosis: parsedResult.agentDiagnosis || "",
              recommendedAction: parsedResult.recommendedAction || "Review member transaction ledger.",
              relatedTransactionId: parsedResult.relatedTransactionId || void 0,
              missingDetails: Array.isArray(parsedResult.missingDetails) ? parsedResult.missingDetails : [],
              needsClarification: !!parsedResult.needsClarification,
              suggestedReplies: Array.isArray(parsedResult.suggestedReplies) ? parsedResult.suggestedReplies.slice(0, 3) : [],
              escalate: !!parsedResult.escalate,
              ticketCategory: parsedResult.issueCategory || "General Help",
              ticketPriority: parsedResult.issuePriority || "Medium",
              ticketDescription: parsedResult.issueDetails || lastMessage
            });
          }
          const fallbackObj = generateHumanEmployeeResponse(
            lastMessage,
            userContext,
            employee,
            false,
            lang
          );
          return res.json(fallbackObj);
        }
      } catch (error) {
        console.error("[Gemini Chat API Error - Running 24/7 Fallback Engine]:", error);
        const lastMsg = messages && messages[messages.length - 1]?.text || "";
        const fallbackObj = generateHumanEmployeeResponse(
          lastMsg,
          userContext,
          employee,
          isAdmin,
          lang
        );
        return res.json(fallbackObj);
      }
    })
  );
  app2.post(
    "/api/digital-workforce/report",
    safeAsync(async (req, res) => {
      if (!req.body) {
        return res.status(400).json({ error: "Missing request body" });
      }
      const { reportType, systemStats, recentIssues, recentTransactions, reserveSummary } = req.body;
      if (!reportType) {
        return res.status(400).json({ error: "Required parameter 'reportType' is missing" });
      }
      try {
        const reportMarkdown = await executeWithGeminiPool(void 0, void 0, async (ai) => {
          const response = await generateWithModelFallback(
            ai,
            `Compile an executive operational audit report for T.U.T. Money Lending Authority.
Report Tier: ${reportType.toUpperCase()} OPERATIONAL BRIEFING
Live Financial & Operations Metrics:
${JSON.stringify({ systemStats, reserveSummary }, null, 2)}
Recent Transaction Sample:
${JSON.stringify((recentTransactions || []).slice(0, 15), null, 2)}
Tracked Member Inquiries & Agent Diagnoses:
${JSON.stringify(recentIssues || [], null, 2)}

Structure cleanly with executive markdown headings and concise tables where helpful:
1. Executive Overview & Liquidity Coverage (Deposit Vault 1:1 segregation vs Active Debt Exposure)
2. Credit & Pending Queue Telemetry (KYC backlog, pending deposit/loan clearances, bKash 01713710607 / Nagad 01921801100 reconciliation load)
3. Desk Performance & Escalated Issues Audit (comparing Credit Desk [Zubair Ahmed] vs Treasury & Member Care Desk [Nusrat Jahan], root causes, evidence completeness, open vs resolved backlog)
4. Immediate Operational Priorities (3\u20135 concrete action items for Administrator review)
Tone: Concise, bank-grade, factual, strictly grounded in the numbers supplied. No filler.`,
            {
              temperature: 0.25
            }
          );
          return response.text || "Report generation completed with empty output.";
        });
        res.json({
          success: true,
          reportMarkdown
        });
      } catch (error) {
        console.error("[Gemini Report API Error]:", error);
        const reportTitle = (reportType || "Operations").toUpperCase();
        const stats = systemStats || {};
        const coverageRatio = (stats.remainingDebt || 0) > 0 ? `${Math.round((stats.totalDeposits || 0) / stats.remainingDebt * 100)}%` : "100%+";
        const fallbackReport = `# EXECUTIVE OPERATIONAL REPORT: ${reportTitle}
**Authority:** T.U.T Money Lending Authority  
**Status:** Synchronized Ledger Summary

---

### 1. Core Platform & Liquidity Coverage
- **Registered Members:** ${stats.totalUsers || 0} (${stats.pendingMembersCount || 0} awaiting KYC review)
- **Segregated Deposit Vault:** \u09F3${(stats.totalDeposits || 0).toLocaleString()} BDT (1:1 Ring-Fenced)
- **Active Loan Exposure:** \u09F3${(stats.remainingDebt || 0).toLocaleString()} BDT across ${stats.totalLoans || 0} loan records
- **Deposit-to-Debt Buffer:** ${coverageRatio}

---

### 2. Pending Operations & Inquiry Desk
- **Pending Transactions:** ${stats.pendingTransactionsCount || 0} items awaiting TrxID / underwriting clearance
- **Active Member Inquiries:** ${(recentIssues || []).filter((i) => i.status !== "Resolved").length} unresolved cases logged across Credit Desk (Zubair Ahmed) & Treasury Desk (Nusrat Jahan)

---

### 3. Priority Action Items
1. Reconcile pending bKash (01713710607) and Nagad (01921801100) TrxID submissions in the transaction queue.
2. Clear open High/Urgent inquiries flagged with agent diagnoses in the Member Issues Tracker.
3. Complete pending member KYC reviews (${stats.pendingMembersCount || 0} queued).`;
        res.json({
          success: true,
          reportMarkdown: fallbackReport
        });
      }
    })
  );
  app2.all("/api/*", (_req, res) => {
    res.status(404).json({
      error: "API endpoint not found",
      timestamp: (/* @__PURE__ */ new Date()).toISOString()
    });
  });
}
function mountErrorHandler(app2) {
  app2.use((err, _req, res, _next) => {
    console.error("[Global Error Handled]:", err);
    res.status(err?.status || 500).json({
      error: "Internal Server Error",
      message: err?.message || "An unexpected error occurred on the server.",
      timestamp: (/* @__PURE__ */ new Date()).toISOString()
    });
  });
}
function createApiApp(options = {}) {
  const app2 = express();
  mountBaseSecurityMiddleware(app2);
  mountApiRoutes(app2, options);
  mountErrorHandler(app2);
  return app2;
}

// server/vercelHandler.ts
var app = createApiApp({ serverless: true });
function handler(req, res) {
  if (req && typeof req.url === "string" && !req.url.startsWith("/api")) {
    req.url = `/api${req.url.startsWith("/") ? "" : "/"}${req.url}`;
  }
  return app(req, res);
}
export {
  handler as default
};
