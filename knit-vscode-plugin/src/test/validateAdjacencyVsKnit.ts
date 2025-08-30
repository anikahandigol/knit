import { buildFromDump, normalizeClassname, extractConsumerFromProvider } from "../knit/adjacency";

function normalize(name: string): string {
  return normalizeClassname(name);
}

type Edge = [string, string];

function extractExpectedEdges(data: Record<string, any>): [Set<string>, Set<string>] {
  const nodes = new Set<string>();
  const edges = new Set<string>();
  for (const classname in data) {
    const details = data[classname];
    const nClass = normalize(classname);
    nodes.add(nClass);
    for (const providerEntry of details.providers || []) {
      const provider = providerEntry.provider || '';
      const consumer = extractConsumerFromProvider(provider);
      if (consumer) {
        const nConsumer = normalize(consumer);
        edges.add(`${nConsumer}->${nClass}`);
        nodes.add(nConsumer);
      }
    }
  }
  return [nodes, edges];
}

function edgesFromAdjacency(adjList: Record<string, string[]>): [Set<string>, Set<string>] {
  const nodes = new Set<string>(Object.keys(adjList));
  const edges = new Set<string>();
  for (const src in adjList) {
    for (const dst of adjList[src]) {
      edges.add(`${src}->${dst}`);
    }
  }
  return [nodes, edges];
}

function validateKnitData(data: Record<string, any>): [boolean, string] {
  const { nodes: builtNodes, edges: builtEdges } = buildFromDump(data);
  // Convert nodes and edges to adjacency list format for comparison
  const adjList: Record<string, string[]> = {};
  Object.keys(builtNodes).forEach(n => { adjList[n] = []; });
  builtEdges.forEach(([src, dst]: [string, string]) => {
    adjList[src].push(dst);
  });
  const [adjNodes, adjEdges] = edgesFromAdjacency(adjList);
  const [expNodes, expEdges] = extractExpectedEdges(data);

  const missingNodes = Array.from(expNodes).filter((n: string) => !adjNodes.has(n));
  const extraNodes = Array.from(adjNodes).filter((n: string) => !expNodes.has(n));
  const missingEdges = Array.from(expEdges).filter((e: string) => !adjEdges.has(e));
  const extraEdges = Array.from(adjEdges).filter((e: string) => !expEdges.has(e));

  const lines: string[] = [];
  lines.push("Validation summary:");
  lines.push(`  Nodes expected: ${expNodes.size}, built: ${adjNodes.size}`);
  lines.push(`  Edges expected: ${expEdges.size}, built: ${adjEdges.size}`);

  if (missingNodes.length) {
    lines.push("\nMissing nodes (in knit.json but not in adjacency):");
    missingNodes.sort().forEach((n: string) => lines.push(`  - ${n}`));
  }

  if (extraNodes.length) {
    lines.push("\nExtra nodes (in adjacency but not in knit.json):");
    extraNodes.sort().forEach((n: string) => lines.push(`  - ${n}`));
  }

  if (missingEdges.length) {
    lines.push("\nMissing edges (present in knit.json providers, absent in adjacency):");
    missingEdges.sort().forEach((e: string) => lines.push(`  - ${e.replace('->', ' -> ')}`));
  }

  if (extraEdges.length) {
    lines.push("\nExtra edges (present in adjacency, not in knit.json providers):");
    extraEdges.sort().forEach((e: string) => lines.push(`  - ${e.replace('->', ' -> ')}`));
  }

  const ok = !(missingNodes.length || extraNodes.length || missingEdges.length || extraEdges.length);
  lines.push("\nRESULT: " + (ok ? "PASS — adjacency list matches knit.json" : "FAIL — adjacency list does not match knit.json"));
  console.log(lines.join('\n'));
  return [ok, lines.join('\n')];
}

// testing:
function runValidation(jsonData: Record<string, any>) {
  const [ok, report] = validateKnitData(jsonData);
  console.log(report);
}

var sampleJson = {
    "knit/demo/AddCommand": {
        "parent": ["knit.demo.GitCommand"],
        "providers": [
            {
                "provider": "knit.demo.AddCommand.<init> -> knit.demo.GitCommand",
                "parameters": [
                    "knit.demo.MemoryFileSystem",
                    "knit.demo.MemoryObjectStore",
                    "knit.demo.StagingArea",
                ],
            }
        ],
    },
    "knit/demo/AuditLogger": {
        "parent": ["java.lang.Object"],
        "providers": [
            {
                "provider": "knit.demo.AuditLogger.<init> -> knit.demo.AuditLogger",
                "parameters": ["knit.demo.EventBus"],
            }
        ],
    },
};


 runValidation(sampleJson);
