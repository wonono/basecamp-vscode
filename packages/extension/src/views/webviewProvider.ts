import * as vscode from "vscode";
import { getNonce } from "../utils/nonce";

interface PanelOptions {
  viewType: string;
  title: string;
  extensionUri: vscode.Uri;
  retainContextWhenHidden?: boolean;
  /** Additional style-src directives (e.g., "'unsafe-inline'") */
  extraStyleSrc?: string;
}

export function createWebviewPanel(options: PanelOptions): vscode.WebviewPanel {
  return vscode.window.createWebviewPanel(
    options.viewType,
    options.title,
    vscode.ViewColumn.One,
    {
      enableScripts: true,
      retainContextWhenHidden: options.retainContextWhenHidden ?? false,
      localResourceRoots: [
        vscode.Uri.joinPath(options.extensionUri, "webview"),
      ],
    }
  );
}

export function getWebviewUri(
  webview: vscode.Webview,
  extensionUri: vscode.Uri,
  ...pathSegments: string[]
): vscode.Uri {
  return webview.asWebviewUri(
    vscode.Uri.joinPath(extensionUri, ...pathSegments)
  );
}

export function getWebviewHtml(
  webview: vscode.Webview,
  extensionUri: vscode.Uri,
  panelDir: string,
  extraStyleSrc?: string
): string {
  const nonce = getNonce();
  const baseStyleUri = getWebviewUri(
    webview,
    extensionUri,
    "webview",
    "shared",
    "base.css"
  );
  const panelStyleUri = getWebviewUri(
    webview,
    extensionUri,
    "webview",
    panelDir,
    "style.css"
  );
  const sharedScriptUri = getWebviewUri(
    webview,
    extensionUri,
    "webview",
    "shared",
    "vscode-api.js"
  );
  const panelScriptUri = getWebviewUri(
    webview,
    extensionUri,
    "webview",
    panelDir,
    "script.js"
  );

  const styleSrc = extraStyleSrc
    ? `${webview.cspSource} ${extraStyleSrc}`
    : webview.cspSource;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy"
        content="default-src 'none';
                 style-src ${styleSrc};
                 script-src 'nonce-${nonce}';
                 img-src ${webview.cspSource} https:;">
  <link rel="stylesheet" href="${baseStyleUri}">
  <link rel="stylesheet" href="${panelStyleUri}">
  <title>Basecamp</title>
</head>
<body>
  <div id="app"></div>
  <script nonce="${nonce}" src="${sharedScriptUri}"></script>
  <script nonce="${nonce}" src="${panelScriptUri}"></script>
</body>
</html>`;
}
