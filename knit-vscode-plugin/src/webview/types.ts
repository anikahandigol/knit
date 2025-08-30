export interface Node {
  name: string
  isOptimistic: boolean
  isSourceError: boolean
  errorMessage?: string
  isInLastUpdate: boolean
  hasUpstreamError: boolean
  // D3 simulation properties
  x?: number
  y?: number
  fx?: number | null
  fy?: number | null
}

export interface AdjacencyList {
  nodes: Record<string, Node>
  edges: [string, string][]
}

export interface VSCodeMessage {
  type: "navigateToNode" | "exportGraph" | "update" | "requestGraphData" | "graphData"
  nodeId?: string
  data?: any
}

export interface LayoutOptions {
  algorithm: "force" | "hierarchical" | "circular"
  nodeSpacing: number
  edgeLength: number
}

export interface FilterOptions {
  showErrors: boolean
  showNormal: boolean
  showOptimistic: boolean
  searchTerm: string
}