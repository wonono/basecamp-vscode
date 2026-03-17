import * as vscode from "vscode";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";

const REF_FILE = path.join(os.tmpdir(), "basecamp-reference.md");

/**
 * Saves content to a temp file and injects the @-reference into the active
 * AI terminal (Claude Code, Cursor, etc.) if one is found, or falls back to
 * copying the reference to the clipboard.
 */
export async function addToAIContext(text: string): Promise<void> {
  fs.writeFileSync(REF_FILE, text, "utf8");

  const aiTerminal = findAITerminal();
  if (aiTerminal) {
    aiTerminal.sendText(`@${REF_FILE} `, false);
    vscode.window.showInformationMessage("Basecamp reference added to AI context.");
  } else {
    await vscode.env.clipboard.writeText(`@${REF_FILE}`);
    vscode.window.showInformationMessage("Reference copied — paste in your AI tool (⌘V).");
  }
}

const AI_TERMINAL_PATTERNS = ["claude", "cursor", "copilot", "aider", "continue"];

function findAITerminal(): vscode.Terminal | undefined {
  const terminals = vscode.window.terminals;
  // Prefer active terminal if it looks like an AI tool
  if (vscode.window.activeTerminal) {
    const name = vscode.window.activeTerminal.name.toLowerCase();
    if (AI_TERMINAL_PATTERNS.some((p) => name.includes(p))) {
      return vscode.window.activeTerminal;
    }
  }
  // Otherwise scan all terminals
  return terminals.find((t) =>
    AI_TERMINAL_PATTERNS.some((p) => t.name.toLowerCase().includes(p))
  );
}
