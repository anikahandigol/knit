import * as vscode from "vscode";
import { spawn } from "child_process";
import * as path from "path";
import * as os from "os";
import * as fs from "fs/promises";
import type { AdjacencyList } from "./knit/interfaces";
import { buildFromDump, applyChangeStatus, propagateUpstreamError } from "./knit/adjacency";
import { IncrementalAdjacency } from "./knit/incremental";

// Track all open diagram panels
const diagramPanels = new Set<vscode.WebviewPanel>();

// In-memory adjacency list built elsewhere in the extension/runtime.
// Call setWebviewAdjacency() to update and broadcast.
let currentGraph: AdjacencyList | null = null;

export function setWebviewAdjacency(adj: AdjacencyList) {
  currentGraph = adj;
  // Broadcast to any open panels
  diagramPanels.forEach((p) => p.webview.postMessage({ type: "update", data: currentGraph }));
}

export function activate(context: vscode.ExtensionContext) {
  // Hello World command
  const helloCmd = vscode.commands.registerCommand("knit-vscode-plugin.helloWorld", () => {
    vscode.window.showInformationMessage("Hello World from Knit!");
  });

  // Gradle shadowJar watcher
  const watchCmd = vscode.commands.registerCommand("knit.watchJar", () => {
    const terminal = vscode.window.createOutputChannel("Knit Watch");
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (!workspaceFolder) {
      vscode.window.showErrorMessage("No workspace folder is open!");
      return;
    }

    const repoRoot = path.resolve(workspaceFolder, "..");
    const gradleCmd = os.platform() === "win32" ? "gradlew.bat" : "./gradlew";
    const gradle = spawn(gradleCmd, ["shadowJar", "--continuous"], { cwd: repoRoot, shell: true });

    gradle.stdout.on("data", (data) => terminal.append(data.toString()));
    gradle.stderr.on("data", (data) => terminal.append(`[ERR] ${data.toString()}`));
    gradle.on("close", (code) => terminal.appendLine(`Gradle exited with code ${code}`));
    terminal.show(true);
  });

  // Open WebviewPanel command
  const openPanelCmd = vscode.commands.registerCommand("knit.openDiagramPanel", async () => {
    const panel = vscode.window.createWebviewPanel(
      "knitGraphPanel",
      "Knit Dependency Graph",
      vscode.ViewColumn.Two,
      {
        enableScripts: true,
        localResourceRoots: [
          vscode.Uri.joinPath(context.extensionUri, "out"),
          vscode.Uri.joinPath(context.extensionUri, "resources"),
        ],
      },
    );

    // Track panel
    diagramPanels.add(panel);
    panel.onDidDispose(() => diagramPanels.delete(panel));

    panel.webview.onDidReceiveMessage(
      (message) => {
        switch (message.type) {
          case "navigateToNode":
            vscode.window.showInformationMessage(`Navigating to: ${message.nodeId}`);
            break;
          case "requestGraphData":
            if (currentGraph) {
              panel.webview.postMessage({ type: "graphData", data: currentGraph });
            } else {
              computeGraphData()
                .then((data) => panel.webview.postMessage({ type: "graphData", data }))
                .catch(() => panel.webview.postMessage({ type: "graphData", data: getFallbackGraphData() }));
            }
            break;
          case "exportGraph":
            vscode.window.showInformationMessage("Exporting graph...");
            break;
          default:
            break;
        }
      },
      undefined,
      context.subscriptions,
    );

    // Build html and scripts
    panel.webview.html = getHtml(context, panel.webview);

    // Send initial data
    if (currentGraph) {
      panel.webview.postMessage({ type: "graphData", data: currentGraph });
    } else {
      computeGraphData()
        .then((data) => panel.webview.postMessage({ type: "graphData", data }))
        .catch(() => panel.webview.postMessage({ type: "graphData", data: getFallbackGraphData() }));
    }

    // Watch for changes only while this panel is open
    const disposable = vscode.workspace.onDidChangeTextDocument((event) => {
      if (event.document.fileName.endsWith(".mmd") || event.document.fileName.endsWith(".json")) {
        if (currentGraph) {
          diagramPanels.forEach((p) => p.webview.postMessage({ type: "update", data: currentGraph }));
        } else {
          computeGraphData()
            .then((data) => diagramPanels.forEach((p) => p.webview.postMessage({ type: "update", data })))
            .catch(() => diagramPanels.forEach((p) => p.webview.postMessage({ type: "update", data: getFallbackGraphData() })));
        }
      }
    });

    panel.onDidDispose(() => disposable.dispose());
  });

  // Close WebviewPanel command
  const closePanelCmd = vscode.commands.registerCommand("knit.closeDiagramPanel", () => {
    diagramPanels.forEach((panel) => panel.dispose());
    diagramPanels.clear();
  });

  // Manually recompute graph from known locations and broadcast to webview
  const refreshGraphCmd = vscode.commands.registerCommand("knit.refreshGraph", async () => {
    try {
      const data = await computeGraphData();
      // Update in-memory graph and notify panels
      currentGraph = data;
      diagramPanels.forEach((p) => p.webview.postMessage({ type: "update", data }));
      vscode.window.setStatusBarMessage("Knit graph refreshed", 2000);
    } catch (e) {
      vscode.window.showErrorMessage(`Failed to refresh Knit graph: ${e}`);
    }
  });

  // Load a specific JSON dump file and broadcast
  const loadGraphFromFileCmd = vscode.commands.registerCommand("knit.loadGraphFromFile", async () => {
    const picked = await vscode.window.showOpenDialog({
      canSelectFiles: true,
      canSelectFolders: false,
      canSelectMany: false,
      filters: { JSON: ["json"] },
      title: "Select knit.json",
    });
    if (!picked || picked.length === 0) {
      return;
    }
    try {
      const uri = picked[0];
      const raw = await vscode.workspace.fs.readFile(uri);
      const dump = JSON.parse(Buffer.from(raw).toString("utf8"));
      let graph = buildFromDump(dump);
      // Optionally look for sibling changes dir
      const dir = path.dirname(uri.fsPath);
      const changesDir = path.join(dir, "changes");
      try {
        const latestTxt = await fs.readFile(path.join(changesDir, "latest.txt"), "utf8");
        const latestFile = latestTxt.trim();
        const changeRaw = await fs.readFile(path.join(changesDir, latestFile), "utf8");
        const changeDump = JSON.parse(changeRaw);
        applyChangeStatus(graph.nodes, changeDump);
        const inc = new IncrementalAdjacency();
        graph = inc.applyChange(graph, changeDump);
        propagateUpstreamError(graph.edges, graph.nodes);
      } catch {}
      currentGraph = graph;
      diagramPanels.forEach((p) => p.webview.postMessage({ type: "update", data: graph }));
      vscode.window.setStatusBarMessage("Knit graph loaded from file", 2000);
    } catch (e) {
      vscode.window.showErrorMessage(`Failed to load Knit graph: ${e}`);
    }
  });

  context.subscriptions.push(
    helloCmd,
    watchCmd,
    openPanelCmd,
    closePanelCmd,
    refreshGraphCmd,
    loadGraphFromFileCmd,
  );

  // Optional: open automatically on activation
  vscode.commands.executeCommand("knit.openDiagramPanel");
}

// Generate the webview HTML
function getHtml(context: vscode.ExtensionContext, webview: vscode.Webview): string {
  const nonce = getNonce();
  const d3Cdn = "https://cdn.jsdelivr.net/npm/d3@7/dist/d3.min.js";
  const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(context.extensionUri, "out", "webview", "graph.js"));

  const csp = [
    `default-src 'none'`,
    `img-src ${webview.cspSource} https: data:`,
    `style-src ${webview.cspSource} 'unsafe-inline'`,
    `font-src ${webview.cspSource} https:`,
    `script-src ${webview.cspSource} 'nonce-${nonce}'`,
    `connect-src ${webview.cspSource}`,
  ].join("; ");

  return `
  <!DOCTYPE html>
  <html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta http-equiv="Content-Security-Policy" content="${csp}" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Knit Graph</title>
    <style>
      html, body { height: 100%; }
      body { padding: 0; margin: 0; font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif; }
      #app { height: 100vh; display: flex; flex-direction: column; }
      .controls { padding: 10px; background: #f5f5f5; border-bottom: 1px solid #ddd; display: flex; gap: 10px; align-items: center; flex-wrap: wrap; }
      .control-group { display: flex; gap: 5px; align-items: center; }
      .control-group label { font-size: 12px; font-weight: 500; }
      button { padding: 4px 8px; font-size: 12px; border: 1px solid #ccc; background: white; cursor: pointer; border-radius: 3px; }
      button:hover { background: #f0f0f0; }
      .selected-info { font-size: 12px; color: #666; }
      .legend { display: flex; gap: 15px; font-size: 11px; }
      .legend-item { display: flex; align-items: center; gap: 4px; }
      .legend-color { width: 12px; height: 12px; border-radius: 50%; }
      #graph-container { flex: 1; overflow: hidden; }
    </style>
  </head>
  <body>
    <div id="app"></div>
    <script nonce="${nonce}" src="${d3Cdn}"></script>
    <script nonce="${nonce}" type="module" src="${scriptUri}"></script>
  </body>
  </html>`;
}

function getNonce() {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let nonce = "";
  for (let i = 0; i < 32; i++) {
    nonce += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return nonce;
}

export function deactivate() {}

// Compute graph from an existing adjacency dump and optional incremental change.
async function computeGraphData(): Promise<AdjacencyList> {
  const ws = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  if (!ws) {
    return getFallbackGraphData();
  }

  // Try common locations relative to the workspace
  const baseCandidates = [
    path.join(ws, "knit.json"),
    path.join(ws, "build", "knit.json"),
    path.join(ws, "demo-jvm", "build", "knit.json"),
    path.resolve(ws, "..", "demo-jvm", "build", "knit.json"),
  ];
  const basePath = await findFirstExistingFile(baseCandidates);
  if (!basePath) {
    return getFallbackGraphData();
  }

  const baseRaw = await fs.readFile(basePath, "utf8");
  const baseDump = JSON.parse(baseRaw);
  let graph = buildFromDump(baseDump);

  const changeDirCandidates = [
    path.join(path.dirname(basePath), "changes"),
    path.join(ws, "build", "changes"),
    path.join(ws, "demo-jvm", "build", "changes"),
    path.resolve(ws, "..", "demo-jvm", "build", "changes"),
  ];
  const changeDir = await findFirstExistingDir(changeDirCandidates);
  if (changeDir) {
    try {
      const latestTxt = await fs.readFile(path.join(changeDir, "latest.txt"), "utf8");
      const latestFile = latestTxt.trim();
      const changeRaw = await fs.readFile(path.join(changeDir, latestFile), "utf8");
      const changeDump = JSON.parse(changeRaw);
      applyChangeStatus(graph.nodes, changeDump);
      const inc = new IncrementalAdjacency();
      graph = inc.applyChange(graph, changeDump);
      propagateUpstreamError(graph.edges, graph.nodes);
    } catch {
      // no changes available
    }
  }

  return graph;
}

async function findFirstExistingFile(pathsToCheck: string[]): Promise<string | undefined> {
  for (const p of pathsToCheck) {
    try {
      const st = await fs.stat(p);
      if (st.isFile()) {
        return p;
      }
    } catch {}
  }
  return undefined;
}

async function findFirstExistingDir(pathsToCheck: string[]): Promise<string | undefined> {
  for (const p of pathsToCheck) {
    try {
      const st = await fs.stat(p);
      if (st.isDirectory()) {
        return p;
      }
    } catch {}
  }
  return undefined;
}

// Temporary fallback sample graph data; used if real data can't be loaded.
function getFallbackGraphData(): AdjacencyList {
  const nodes: AdjacencyList["nodes"] = {
    "main.ts": { name: "main.ts", isOptimistic: false, isSourceError: false, isInLastUpdate: true, hasUpstreamError: false },
    "auth.ts": { name: "auth.ts", isOptimistic: true, isSourceError: false, isInLastUpdate: false, hasUpstreamError: false },
    "database.ts": { name: "database.ts", isOptimistic: false, isSourceError: true, errorMessage: "Connection failed", isInLastUpdate: false, hasUpstreamError: false },
    "api.ts": { name: "api.ts", isOptimistic: false, isSourceError: false, isInLastUpdate: true, hasUpstreamError: true },
    "utils.ts": { name: "utils.ts", isOptimistic: false, isSourceError: false, isInLastUpdate: true, hasUpstreamError: false },
    "config.ts": { name: "config.ts", isOptimistic: false, isSourceError: false, isInLastUpdate: false, hasUpstreamError: false },
  };
  const edges: AdjacencyList["edges"] = [
    ["main.ts", "auth.ts"],
    ["main.ts", "api.ts"],
    ["auth.ts", "database.ts"],
    ["api.ts", "database.ts"],
    ["api.ts", "utils.ts"],
    ["utils.ts", "config.ts"],
  ];
  return { nodes, edges };
}