"use client"

import type React from "react"
import { useEffect, useRef, useState } from "react"
import * as d3 from "d3"
import { createRoot } from "react-dom/client"

import { AdjacencyList, VSCodeMessage } from "./types"
interface GraphProps {
  data: AdjacencyList
}

const Graph: React.FC<GraphProps> = ({ data }) => {
  const svgRef = useRef<SVGSVGElement | null>(null)
  const [selectedNodes, setSelectedNodes] = useState<Set<string>>(new Set())
  const [hoveredNode, setHoveredNode] = useState<string | null>(null)
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 })
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const nodeRef = useRef<d3.Selection<SVGCircleElement, any, SVGGElement, unknown> | null>(null)
  const linkRef = useRef<d3.Selection<SVGPolylineElement, any, SVGGElement, unknown> | null>(null)
  const labelRef = useRef<d3.Selection<SVGTextElement, any, SVGGElement, unknown> | null>(null)

  useEffect(() => {
    const handleResize = () => {
      const container = document.getElementById("graph-container")
      if (container) {
        setDimensions({
          width: container.clientWidth,
          height: container.clientHeight,
        })
      }
    }

    window.addEventListener("resize", handleResize)
    handleResize()

    return () => window.removeEventListener("resize", handleResize)
  }, [])


  useEffect(() => {
    if (!data || !svgRef.current) return

    const { width, height } = dimensions
    const svg = d3.select(svgRef.current)
    svg.selectAll("*").remove()

    const zoom = d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 4])
      .filter((event) => {
        return event.type !== "dblclick"
      })
      .on("zoom", (event) => {
        svg.select("g").attr("transform", event.transform)
      })

    svg.call(zoom)

    svg.on("click", (event) => {
      if (event.target === svg.node()) {
        setSelectedNodes(new Set())
        setErrorMessage(null)
      }
    })

    const container = svg.append("g")

    svg
      .append("defs")
      .selectAll("marker")
      .data(["normal", "selected", "dimmed"])
      .enter()
      .append("marker")
      .attr("id", (d) => `arrow-${d}`)
      .attr("viewBox", "0 -5 10 10")
      .attr("refX", 6) // Better placement for marker-mid at the polyline vertex
      .attr("refY", 0)
      .attr("markerWidth", 6)
      .attr("markerHeight", 6)
      .attr("orient", "auto")
      .append("path")
      .attr("d", "M0,-5L10,0L0,5")
      .attr("fill", (d) => {
        switch (d) {
          case "selected":
            return "#8b5cf6"
          case "dimmed":
            return "#6b7280"
          default:
            return "#9ca3af"
        }
      })

    svg.attr("width", width).attr("height", height)

  const nodes = Object.values(data.nodes).map((n) => ({ ...n }))
    const links = data.edges.map(([source, target]) => ({ source, target }))

    const simulation = d3
      .forceSimulation(nodes as d3.SimulationNodeDatum[])
      .force(
        "link",
        d3
          .forceLink(links)
          .id((d: any) => d.name)
          .distance(100),
      )
      .force("charge", d3.forceManyBody().strength(-300))
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force("collision", d3.forceCollide().radius(30))

    const link = container
      .append("g")
      .attr("stroke", "#999")
      .attr("stroke-opacity", 0.6)
      .selectAll("polyline")
      .data(links)
      .enter()
      .append("polyline")
  .attr("fill", "none")
      .attr("stroke-width", 2)
      .attr("marker-end", "url(#arrow-normal)")
      .style("cursor", "pointer")
      .on("dblclick", (event, d: any) => {
        event.stopPropagation()
        const sourceName = typeof d.source === "string" ? d.source : d.source.name
        const targetName = typeof d.target === "string" ? d.target : d.target.name

        console.log("[v0] Double-click detected on edge:", sourceName, "->", targetName)

        const vscode = (window as any).vscode
        if (vscode) {
          vscode.postMessage({
            type: "navigateToEdge",
            sourceFile: sourceName,
            targetFile: targetName,
            lineNumber: 1,
          })
          console.log("[v0] Message sent to VS Code for edge:", sourceName, "->", targetName)
        } else {
          console.log("[v0] VS Code API not available")
        }
      })

    linkRef.current = link

    const node = container
      .append("g")
      .selectAll("circle")
      .data(nodes)
      .enter()
      .append("circle")
      .attr("r", 12)
      .attr("fill", (d: any) => {
        if (d.isSourceError) return "#dc2626"
        if (d.hasUpstreamError) return "#f87171"
        if (d.isOptimistic) return "#10b981"
        return "#6b7280"
      })
      .style("cursor", "pointer")
      .on("mouseenter", (event, d: any) => {
        setHoveredNode(d.name)
      })
      .on("mouseleave", () => {
        setHoveredNode(null)
      })
      .on("click", (event, d: any) => {
        event.stopPropagation()
        const newSelected = new Set(selectedNodes)
        if (newSelected.has(d.name)) {
          newSelected.delete(d.name)
        } else {
          newSelected.add(d.name)
        }
        setSelectedNodes(newSelected)

        if (d.is_source_error && d.error_message) {
          setErrorMessage(`${d.name}: ${d.error_message}`)
        } else if (d.has_upstream_error) {
          setErrorMessage(`${d.name}: Has upstream dependency errors`)
        } else {
          setErrorMessage(null)
        }
      })
      .on("dblclick", (event, d: any) => {
        event.stopPropagation()
        event.preventDefault()
        console.log("[v0] Double-click detected on node:", d.name)

        const vscode = (window as any).vscode
        if (vscode) {
          vscode.postMessage({
            type: "navigateToNode",
            nodeId: d.name,
          })
          console.log("[v0] Message sent to VS Code for node:", d.name)
        } else {
          console.log("[v0] VS Code API not available")
        }
      })
      .call(
        d3
          .drag<SVGCircleElement, any>()
          .on("start", (event, d: any) => {
            if (!event.active) simulation.alphaTarget(0.3).restart()
            d.fx = d.x
            d.fy = d.y
          })
          .on("drag", (event, d: any) => {
            d.fx = event.x
            d.fy = event.y
          })
          .on("end", (event, d: any) => {
            if (!event.active) simulation.alphaTarget(0)
            d.fx = null
            d.fy = null
          }),
      )

    nodeRef.current = node

    const label = container
      .append("g")
      .selectAll("text")
      .data(nodes)
      .enter()
      .append("text")
      .text((d: any) => d.name)
      .attr("font-size", 12)
      .attr("fill", "#ffffff")
      .attr("dx", 0)
      .attr("dy", 30)
      .attr("text-anchor", "middle")
      .style("pointer-events", "none")

    labelRef.current = label

    simulation.on("tick", () => {
      link.attr("points", (d: any) => {
        const sx = d.source.x as number;
        const sy = d.source.y as number;
        const tx = d.target.x as number;
        const ty = d.target.y as number;
        const mx = (sx + tx) / 2;
        const my = (sy + ty) / 2;
        // Slight perpendicular offset to avoid a 180° vertex (which can hide marker-mid)
        const dx = tx - sx;
        const dy = ty - sy;
        const len = Math.hypot(dx, dy) || 1;
        const nx = -dy / len;
        const ny = dx / len;
        const offset = Math.min(2, len * 0.02); // up to 2px
        const mx2 = mx + nx * offset;
        const my2 = my + ny * offset;
        return `${sx},${sy} ${mx2},${my2} ${tx},${ty}`;
      });

      node.attr("cx", (d: any) => d.x).attr("cy", (d: any) => d.y);
      label.attr("x", (d: any) => d.x).attr("y", (d: any) => d.y);
    });

    return () => {
      simulation.stop()
    }
  }, [data, dimensions])

  useEffect(() => {
    if (!nodeRef.current || !linkRef.current || !labelRef.current) return

    const hasSelection = selectedNodes.size > 0

    nodeRef.current
      .attr("r", (d: any) => (selectedNodes.has(d.name) ? 14 : 12))
      .attr("opacity", (d: any) => {
        if (!hasSelection) return 1
        return selectedNodes.has(d.name) ? 1 : 0.3
      })
      .attr("fill", (d: any) => {
        if (hoveredNode === d.name) return "#8b5cf6"
        if (selectedNodes.has(d.name)) return "#8b5cf6"
  if (d.isSourceError) return "#dc2626"
  if (d.hasUpstreamError) return "#f87171"
  if (d.isOptimistic) return "#10b981"
        return "#6b7280"
      })

    linkRef.current
      .attr("opacity", (d: any) => {
        if (!hasSelection) return 0.6
        const sourceName = typeof d.source === "string" ? d.source : d.source.name
        return selectedNodes.has(sourceName) ? 1 : 0.2
      })
      .attr("stroke", (d: any) => {
        if (!hasSelection) return "#999"
        const sourceName = typeof d.source === "string" ? d.source : d.source.name
        return selectedNodes.has(sourceName) ? "#8b5cf6" : "#999"
      })
      .attr("marker-mid", (d: any) => {
        if (!hasSelection) return "url(#arrow-normal)"
        const sourceName = typeof d.source === "string" ? d.source : d.source.name
        return selectedNodes.has(sourceName) ? "url(#arrow-selected)" : "url(#arrow-dimmed)"
      })

    labelRef.current.attr("opacity", (d: any) => {
      if (!hasSelection) return 1
      return selectedNodes.has(d.name) ? 1 : 0.5
    })
  }, [selectedNodes, hoveredNode])

  return (
    <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column" }}>
      <div className="controls">
        <div className="control-group">
          <button onClick={() => setSelectedNodes(new Set())}>Clear Selection</button>
        </div>

        {selectedNodes.size > 0 && (
          <div className="selected-info">Selected: {Array.from(selectedNodes).join(", ")}</div>
        )}

        <div className="legend" style={{ color: "#000000" }}>
          <div className="legend-item">
            <div className="legend-color" style={{ backgroundColor: "#6b7280" }}></div>
            Normal
          </div>
          <div className="legend-item">
            <div className="legend-color" style={{ backgroundColor: "#dc2626" }}></div>
            Source Error
          </div>
          <div className="legend-item">
            <div className="legend-color" style={{ backgroundColor: "#f87171" }}></div>
            Upstream Error
          </div>
          <div className="legend-item">
            <div className="legend-color" style={{ backgroundColor: "#10b981" }}></div>
            Optimistic
          </div>
          <div className="legend-item">
            <div className="legend-color" style={{ backgroundColor: "#8b5cf6" }}></div>
            Selected/Hover
          </div>
        </div>
      </div>

      <div id="graph-container" style={{ flex: 1 }}>
        <svg ref={svgRef} width="100%" height="100%"></svg>
      </div>

      {errorMessage && (
        <div
          style={{
            padding: "10px",
            backgroundColor: "#fee2e2",
            borderTop: "1px solid #fecaca",
            color: "#dc2626",
            fontSize: "14px",
            fontWeight: "500",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span>{errorMessage}</span>
            <button
              onClick={() => setErrorMessage(null)}
              style={{
                background: "none",
                border: "none",
                color: "#dc2626",
                cursor: "pointer",
                fontSize: "16px",
                padding: "0 5px",
              }}
            >
              ×
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

const GraphDemo: React.FC = () => {
  const [data, setData] = useState<AdjacencyList>({ nodes: {}, edges: [] })

  useEffect(() => {
    // Request initial data from the extension
  const vscode = (window as any).vscode || (window as any).acquireVsCodeApi?.()
    ;(window as any).vscode = vscode
    vscode?.postMessage({ type: "requestGraphData" })

    const handler = (event: MessageEvent<VSCodeMessage>) => {
      const msg = event.data
      if (msg?.type === "graphData" && msg.data) {
        setData(msg.data as AdjacencyList)
      }
      if (msg?.type === "update" && msg.data) {
        setData(msg.data as AdjacencyList)
      }
    }
    window.addEventListener("message", handler)
    return () => window.removeEventListener("message", handler)
  }, [])

  return <Graph data={data} />
}

const container = document.getElementById("app")
if (container) {
  createRoot(container).render(<GraphDemo />)
  console.log("Enhanced graph mounted successfully")
} else {
  console.error("No #app container found")
}
