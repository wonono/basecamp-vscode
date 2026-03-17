import * as vscode from "vscode";

export function notifyNewMessage(
  projectName: string,
  authorName: string,
  subject: string
): void {
  vscode.window.showInformationMessage(
    `Basecamp — ${projectName}: New message "${subject}" by ${authorName}`
  );
}

export function notifyNewCampfireLine(
  projectName: string,
  authorName: string,
  preview: string
): void {
  const truncated = preview.length > 60 ? preview.slice(0, 60) + "..." : preview;
  vscode.window.showInformationMessage(
    `Basecamp — ${projectName} Campfire: ${authorName}: ${truncated}`
  );
}

export function notifyNewComment(
  projectName: string,
  authorName: string,
  parentTitle: string
): void {
  vscode.window.showInformationMessage(
    `Basecamp — ${projectName}: ${authorName} commented on "${parentTitle}"`
  );
}
