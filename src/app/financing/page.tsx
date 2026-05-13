"use client";

import { useEffect, useRef } from "react";
import * as d3 from "d3";
import { sankey as d3Sankey, sankeyLinkHorizontal } from "d3-sankey";

const FLAGS: Record<string, string> = {
  Germany: "🇩🇪",
  "United States of America": "🇺🇸",
  "United Kingdom": "🇬🇧",
  Netherlands: "🇳🇱",
  "European Union": "🇪🇺",
  Luxembourg: "🇱🇺",
  Canada: "🇨🇦",
  Finland: "🇫🇮",
};

const ORANGE = "#f5a623";
const LINK_COLOR_DARK = "rgba(210,140,30,0.7)";
const LINK_COLOR_LIGHT = "rgba(255,220,130,0.45)";

function hexPath(cx: number, cy: number, r: number): string {
  const points = Array.from({ length: 6 }, (_, i) => {
    const angle = (Math.PI / 180) * (60 * i - 30);
    return `${cx + r * Math.cos(angle)},${cy + r * Math.sin(angle)}`;
  });
  return `M${points.join("L")}Z`;
}

export default function FinancingSankeyPage() {
  const svgRef = useRef<SVGSVGElement | null>(null);
  console.log("hi youre at the right place");

  useEffect(() => {
    const width = 1400;
    const height = 860;
    const margin = { top: 60, right: 240, bottom: 120, left: 280 };

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    svg.attr("viewBox", `0 0 ${width} ${height}`).style("background", ORANGE);

    const defs = svg.append("defs");

    // Gradient for links
    const linkGrad = defs
      .append("linearGradient")
      .attr("id", "linkGrad")
      .attr("x1", "0%")
      .attr("y1", "0%")
      .attr("x2", "100%")
      .attr("y2", "0%");
    linkGrad
      .append("stop")
      .attr("offset", "0%")
      .attr("stop-color", LINK_COLOR_DARK);
    linkGrad
      .append("stop")
      .attr("offset", "100%")
      .attr("stop-color", LINK_COLOR_LIGHT);

    const g = svg
      .append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    d3.json("public/data/financing_sankey.json").then((data: unknown) => {
      const d = data as {
        nodes: { name: string; level: number }[];
        links: { source: number; target: number; value: number }[];
      };
      if (!d) return;

      const sankeyGenerator = d3Sankey()
        .nodeWidth(16)
        .nodePadding(20)
        .extent([
          [0, 0],
          [innerWidth, innerHeight],
        ])
        .nodeSort(null);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const graph = sankeyGenerator({
        nodes: d.nodes.map((n) => ({ ...n })) as any,
        links: d.links.map((l) => ({ ...l })) as any,
      });

      // Lock columns
      const columns = 4;
      const columnWidth = innerWidth / (columns - 1);

      graph.nodes.forEach((node: unknown) => {
        const n = node as { level: number; x0: number; x1: number };
        n.x0 = n.level * columnWidth;
        n.x1 = n.x0 + 16;
      });

      sankeyGenerator.update(graph);

      // --- LINKS ---
      g.append("g")
        .selectAll("path")
        .data(graph.links)
        .join("path")
        .attr("d", sankeyLinkHorizontal())
        .attr("fill", "none")
        .attr("stroke", "url(#linkGrad)")
        .attr("stroke-opacity", 1)
        .attr("stroke-width", (d: unknown) =>
          Math.max(1, (d as { width: number }).width),
        );

      // --- NODES ---
      const node = g.append("g").selectAll("g").data(graph.nodes).join("g");

      node
        .append("rect")
        .attr("x", (d: unknown) => (d as { x0: number }).x0)
        .attr("y", (d: unknown) => (d as { y0: number }).y0)
        .attr("height", (d: unknown) => {
          const n = d as { y0: number; y1: number };
          return Math.max(2, n.y1 - n.y0);
        })
        .attr("width", 16)
        .attr("rx", 3)
        .attr("fill", "white");

      // --- LABELS ---
      const labelG = node.append("g");

      // Left column (level 0): flag + name + value, right-aligned
      labelG
        .filter((d: unknown) => (d as { level: number }).level === 0)
        .each(function (d: unknown) {
          const n = d as {
            name: string;
            value: number;
            x0: number;
            y0: number;
            y1: number;
          };
          const yMid = (n.y0 + n.y1) / 2;
          const xAnchor = n.x0 - 14;
          const sel = d3.select(this);

          // Flag
          sel
            .append("text")
            .attr("x", xAnchor - 28)
            .attr("y", yMid - 4)
            .attr("text-anchor", "end")
            .attr("dominant-baseline", "middle")
            .style("font-size", "18px")
            .text(FLAGS[n.name] ?? "");

          // Name
          sel
            .append("text")
            .attr("x", xAnchor - 34)
            .attr("y", yMid - 6)
            .attr("text-anchor", "end")
            .attr("dominant-baseline", "auto")
            .style("font-size", "12px")
            .style("font-weight", "700")
            .style("font-family", "Roboto, Helvetica, Arial, sans-serif")
            .style("fill", "white")
            .text(n.name);

          // Value
          sel
            .append("text")
            .attr("x", xAnchor - 34)
            .attr("y", yMid + 9)
            .attr("text-anchor", "end")
            .attr("dominant-baseline", "auto")
            .style("font-size", "11px")
            .style("font-weight", "400")
            .style("font-family", "Roboto, Helvetica, Arial, sans-serif")
            .style("fill", "rgba(255,255,255,0.85)")
            .text(`$ ${d3.format(",.0f")(n.value)}`);
        });

      // Center (level 1): "Total Invested" label above + value
      labelG
        .filter((d: unknown) => (d as { level: number }).level === 1)
        .each(function (d: unknown) {
          const n = d as {
            name: string;
            value: number;
            x0: number;
            x1: number;
            y0: number;
          };
          const xMid = (n.x0 + n.x1) / 2;
          const sel = d3.select(this);

          sel
            .append("text")
            .attr("x", xMid)
            .attr("y", n.y0 - 36)
            .attr("text-anchor", "middle")
            .style("font-size", "13px")
            .style("font-weight", "700")
            .style("font-family", "Roboto, Helvetica, Arial, sans-serif")
            .style("fill", "white")
            .text("Total Invested");

          sel
            .append("text")
            .attr("x", xMid)
            .attr("y", n.y0 - 18)
            .attr("text-anchor", "middle")
            .style("font-size", "22px")
            .style("font-weight", "900")
            .style("font-family", "Roboto, Helvetica, Arial, sans-serif")
            .style("fill", "white")
            .text(`$ ${d3.format(",.0f")((d as { value: number }).value)}`);
        });

      // Middle-right column (level 2): centered labels
      labelG
        .filter((d: unknown) => (d as { level: number }).level === 2)
        .each(function (d: unknown) {
          const n = d as {
            name: string;
            value: number;
            x0: number;
            x1: number;
            y0: number;
            y1: number;
          };
          const xMid = (n.x0 + n.x1) / 2;
          const yMid = (n.y0 + n.y1) / 2;
          const sel = d3.select(this);

          sel
            .append("text")
            .attr("x", xMid + 24)
            .attr("y", yMid - 6)
            .attr("text-anchor", "start")
            .style("font-size", "11px")
            .style("font-weight", "700")
            .style("font-family", "Roboto, Helvetica, Arial, sans-serif")
            .style("fill", "white")
            .text(n.name);

          sel
            .append("text")
            .attr("x", xMid + 24)
            .attr("y", yMid + 8)
            .attr("text-anchor", "start")
            .style("font-size", "10px")
            .style("font-family", "Roboto, Helvetica, Arial, sans-serif")
            .style("fill", "rgba(255,255,255,0.8)")
            .text(`$ ${d3.format(",.0f")(n.value)}`);
        });

      // Right column (level 3): right-side labels
      labelG
        .filter((d: unknown) => (d as { level: number }).level === 3)
        .each(function (d: unknown) {
          const n = d as {
            name: string;
            value: number;
            x1: number;
            y0: number;
            y1: number;
          };
          const yMid = (n.y0 + n.y1) / 2;
          const sel = d3.select(this);

          sel
            .append("text")
            .attr("x", n.x1 + 12)
            .attr("y", yMid - 6)
            .attr("text-anchor", "start")
            .style("font-size", "12px")
            .style("font-weight", "700")
            .style("font-family", "Roboto, Helvetica, Arial, sans-serif")
            .style("fill", "white")
            .text(n.name);

          sel
            .append("text")
            .attr("x", n.x1 + 12)
            .attr("y", yMid + 8)
            .attr("text-anchor", "start")
            .style("font-size", "11px")
            .style("font-family", "Roboto, Helvetica, Arial, sans-serif")
            .style("fill", "rgba(255,255,255,0.8)")
            .text(`$ ${d3.format(",.0f")((d as { value: number }).value)}`);
        });

      // --- HEXAGONS + COLUMN LABELS at bottom ---
      const colDefs = [
        {
          x: 0,
          label: "Donor Partners",
          sub: "Committed contributions\nas of June 2026",
          hexFill: "rgba(255,255,255,0.5)",
        },
        {
          x: columnWidth,
          label: "Total\nContributions",
          sub: "",
          hexFill: "rgba(160,110,40,0.7)",
        },
        {
          x: 2 * columnWidth,
          label: "Organisation\ntypes",
          sub: "",
          hexFill: "rgba(255,255,255,0.4)",
        },
        {
          x: 3 * columnWidth,
          label: "Investment\ntypes",
          sub: "Approved allocation\nby the CRAF'd\nSteering Comittee\nas of June 2026",
          hexFill: "rgba(255,255,255,0.3)",
        },
      ];

      const hexBottom = innerHeight + 28;
      const hexR = 18;

      colDefs.forEach((col) => {
        // Hexagon
        g.append("path")
          .attr("d", hexPath(col.x + 8, hexBottom, hexR))
          .attr("fill", col.hexFill)
          .attr("stroke", "white")
          .attr("stroke-width", 1.5);

        // Column label
        const lines = col.label.split("\n");
        const labelY = hexBottom + hexR + 14;
        lines.forEach((line, i) => {
          g.append("text")
            .attr("x", col.x + 8)
            .attr("y", labelY + i * 15)
            .attr("text-anchor", "middle")
            .style("font-size", "13px")
            .style("font-weight", "700")
            .style("font-family", "Roboto, Helvetica, Arial, sans-serif")
            .style("fill", "white")
            .text(line);
        });

        if (col.sub) {
          const subLines = col.sub.split("\n");
          const subY = labelY + lines.length * 15 + 4;
          subLines.forEach((line, i) => {
            g.append("text")
              .attr("x", col.x + 8)
              .attr("y", subY + i * 12)
              .attr("text-anchor", "middle")
              .style("font-size", "10px")
              .style("font-family", "Roboto, Helvetica, Arial, sans-serif")
              .style("fill", "rgba(255,255,255,0.75)")
              .text(line);
          });
        }
      });
    });
  }, []);

  return (
    <div
      style={{
        width: "100%",
        height: "100vh",
        background: ORANGE,
        overflow: "hidden",
      }}
    >
      <svg ref={svgRef} width="100%" height="100%" />
    </div>
  );
}
