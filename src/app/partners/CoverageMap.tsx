"use client";
import { useEffect, useRef } from "react";
import * as d3 from "d3";
import * as topojson from "topojson-client";
import { COVERAGE_COUNTRY_IDS } from "@/lib/partners/coverage-regions";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let geoCache: any = null;

export default function CoverageMap({ coverage }: { coverage: string | null }) {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    let cancelled = false;

    async function draw() {
      if (!svgRef.current) return;

      if (!geoCache) {
        const res = await fetch("/data/countries-110m.json");
        geoCache = await res.json();
      }
      if (cancelled || !geoCache || !svgRef.current) return;

      const lookup =
        coverage != null ? COVERAGE_COUNTRY_IDS[coverage] : undefined;
      const highlightIds: Set<number> | null =
        lookup !== undefined
          ? lookup === null
            ? null // null entry = highlight all
            : new Set(lookup)
          : new Set(); // unrecognized = highlight nothing

      const svg = svgRef.current;
      const W = svg.clientWidth || 320;
      const H = Math.round(W / 2);
      svg.setAttribute("viewBox", `0 0 ${W} ${H}`);

      const projection = d3
        .geoNaturalEarth1()
        .scale(W / 6.3)
        .translate([W / 2, H / 2]);
      const pathGen = d3.geoPath(projection);

      const countries = topojson.feature(
        geoCache,
        geoCache.objects.countries,
      ) as unknown as GeoJSON.FeatureCollection;

      const sel = d3.select(svg);
      sel.selectAll("*").remove();
      sel
        .append("rect")
        .attr("width", W)
        .attr("height", H)
        .attr("fill", "#000");

      // Exclude Antarctica (numeric id 10) from all render branches
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const noAntarcticaGeoms = (
        geoCache.objects.countries.geometries as any[]
      ).filter((g: { id: number }) => +g.id !== 10);
      const noAntarcticaFeatures = countries.features.filter(
        (f) => f.id !== 10,
      );

      if (highlightIds === null) {
        // Global coverage: draw all land white (no internal borders needed)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const land = topojson.merge(geoCache, noAntarcticaGeoms as any);
        sel
          .append("path")
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .datum(land as any)
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .attr("d", (d: any) => pathGen(d) ?? "")
          .attr("fill", "#ffffff");
      } else {
        // Non-global: show all landmasses very dark (physical map context), highlighted region white
        sel
          .append("g")
          .selectAll("path")
          .data(noAntarcticaFeatures)
          .join("path")
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .attr("d", (d) => pathGen(d as any) ?? "")
          .attr("fill", "#3a3a3a");

        if (highlightIds.size > 0) {
          // Merge highlighted countries → dissolves internal political borders
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const highlightGeoms = (
            geoCache.objects.countries.geometries as any[]
          ).filter((g: { id: number }) => highlightIds.has(+g.id));
          if (highlightGeoms.length > 0) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const merged = topojson.merge(geoCache, highlightGeoms as any);
            sel
              .append("path")
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              .datum(merged as any)
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              .attr("d", (d: any) => pathGen(d) ?? "")
              .attr("fill", "#ffffff")
              .attr("stroke", "rgba(255,255,255,0.65)")
              .attr("stroke-width", 1.2);
          }
        }
      }
    }

    draw();
    return () => {
      cancelled = true;
    };
  }, [coverage]);

  return (
    <svg
      ref={svgRef}
      style={{ width: "100%", display: "block", borderRadius: 6 }}
    />
  );
}
