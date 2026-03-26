"use client";
// components/dashboard/ServerLocationsMap.tsx
// Static pre-rendered map image with hover tooltips on region legend.
// Place map image at: public/images/world-map-servers.png

import { useState } from "react";

const REGION_COLOR: Record<string, string> = {
  me: "#1D9E75",
  eu: "#185FA5",
  ap: "#0F6E56",
  am: "#378ADD",
};

const REGIONS = [
  {
    key: "me",
    label: "Middle East & Africa",
    cities: ["Jeddah", "Riyadh", "Dubai", "Doha", "Bahrain", "Cape Town"],
  },
  {
    key: "eu",
    label: "Europe",
    cities: ["London", "Amsterdam", "Paris", "Frankfurt", "Madrid", "Stockholm", "Helsinki"],
  },
  {
    key: "ap",
    label: "Asia Pacific",
    cities: ["Chennai", "Singapore", "Tokyo", "Seoul", "Sydney", "Melbourne"],
  },
  {
    key: "am",
    label: "Americas",
    cities: ["Toronto", "Ashburn", "Phoenix", "San Jose", "São Paulo"],
  },
];

interface Props {
  activeLocations?: string[]; // future: highlight active servers
}

export function ServerLocationsMap({ activeLocations = [] }: Props) {
  const [hoveredRegion, setHoveredRegion] = useState<string | null>(null);

  const activeSet = new Set(activeLocations.map(s => s.toLowerCase()));

  return (
    <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column" }}>

      {/* Map image */}
      <div style={{ flex: 1, overflow: "hidden", position: "relative" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/images/world-map-servers.png"
          alt="Server locations world map"
          draggable={false}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "fill",
            display: "block",
            userSelect: "none",
          }}
        />
      </div>

      {/* Legend with hover tooltips */}
      <div style={{
        display: "flex",
        gap: 0,
        borderTop: "1px solid #e5e7eb",
        flexWrap: "wrap",
      }}>
        {REGIONS.map(region => {
          const isHovered = hoveredRegion === region.key;
          return (
            <div
              key={region.key}
              onMouseEnter={() => setHoveredRegion(region.key)}
              onMouseLeave={() => setHoveredRegion(null)}
              style={{
                position: "relative",
                padding: "7px 14px",
                cursor: "default",
                borderRight: "1px solid #f3f4f6",
                background: isHovered ? "#f9fafb" : "transparent",
                transition: "background 0.12s",
              }}
            >
              {/* Legend item */}
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <div style={{
                  width: 9, height: 9, borderRadius: "50%",
                  background: REGION_COLOR[region.key],
                  border: "1.5px solid #fff",
                  boxShadow: `0 0 0 1.5px ${REGION_COLOR[region.key]}55`,
                  flexShrink: 0,
                }} />
                <span style={{ fontSize: 11, color: "#6b7280", whiteSpace: "nowrap" }}>
                  {region.label}
                </span>
              </div>

              {/* Popup on hover */}
              {isHovered && (
                <div style={{
                  position: "absolute",
                  bottom: "calc(100% + 6px)",
                  left: 0,
                  background: "#fff",
                  border: "1px solid #e5e7eb",
                  borderRadius: 8,
                  padding: "10px 14px",
                  boxShadow: "0 4px 16px rgba(0,0,0,0.1)",
                  zIndex: 20,
                  minWidth: 180,
                  pointerEvents: "none",
                }}>
                  {/* Region title */}
                  <div style={{
                    fontSize: 12,
                    fontWeight: 600,
                    color: REGION_COLOR[region.key],
                    marginBottom: 8,
                    paddingBottom: 6,
                    borderBottom: "1px solid #f3f4f6",
                  }}>
                    {region.label}
                  </div>

                  {/* City list */}
                  <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                    {region.cities.map(city => (
                      <div key={city} style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 7,
                        fontSize: 12,
                        color: "#374151",
                      }}>
                        <div style={{
                          width: 6, height: 6, borderRadius: "50%",
                          background: REGION_COLOR[region.key],
                          flexShrink: 0,
                          opacity: activeSet.has(city.toLowerCase()) ? 1 : 0.5,
                        }} />
                        {city}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
