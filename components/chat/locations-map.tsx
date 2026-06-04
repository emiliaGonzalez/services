"use client";

import { useEffect, useRef, useState } from "react";
import L from "leaflet";

import "leaflet/dist/leaflet.css";

export interface MapLocation {
  label: string;
  query: string;
  type: "zone" | "point";
}

interface LocationsMapProps {
  locations: MapLocation[];
}

interface Geocoded {
  label: string;
  type: "zone" | "point";
  lat: number;
  lon: number;
  geojson?: GeoJSON.GeoJsonObject;
  bbox?: number[]; // [south, north, west, east]
}

const INDIGO = "#4F46E5";

async function geocode(loc: MapLocation): Promise<Geocoded | null> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=10&polygon_geojson=1&accept-language=es&q=${encodeURIComponent(
        loc.query,
      )}`,
    );
    const data = await res.json();

    if (!data?.length) return null;

    const isPoly = (gj?: GeoJSON.GeoJsonObject) =>
      gj?.type === "Polygon" || gj?.type === "MultiPolygon";

    // Para zonas, prioriza el resultado que tenga poligono real.
    const chosen =
      (loc.type === "zone" && data.find((r: { geojson?: GeoJSON.GeoJsonObject }) => isPoly(r.geojson))) ||
      data[0];

    return {
      label: loc.label,
      type: loc.type,
      lat: parseFloat(chosen.lat),
      lon: parseFloat(chosen.lon),
      geojson: chosen.geojson,
      bbox: chosen.boundingbox?.map(Number),
    };
  } catch {
    return null;
  }
}

function zoneRadius(g: Geocoded): number {
  if (!g.bbox) return 2000;
  const [s, n, w, e] = g.bbox;
  const latM = ((n - s) * 111000) / 2;
  const lonM = ((e - w) * 111000 * Math.cos((g.lat * Math.PI) / 180)) / 2;

  return Math.max(1200, Math.hypot(latM, lonM));
}

export default function LocationsMap({ locations }: LocationsMapProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<"loading" | "ok" | "empty">("loading");

  useEffect(() => {
    if (!ref.current) return;

    const map = L.map(ref.current, {
      zoomControl: false,
      attributionControl: false,
    });

    L.tileLayer(
      "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
      { maxZoom: 19 },
    ).addTo(map);
    map.setView([23.6, -102.5], 4);

    let cancelled = false;

    (async () => {
      const results: Geocoded[] = [];

      for (const loc of locations) {
        const g = await geocode(loc);

        if (g) results.push(g);
      }
      if (cancelled) return;
      if (!results.length) {
        setState("empty");

        return;
      }

      const group = L.featureGroup();
      const isPolygon = (gj?: GeoJSON.GeoJsonObject) =>
        gj?.type === "Polygon" || gj?.type === "MultiPolygon";

      for (const g of results) {
        if (g.type === "zone" && isPolygon(g.geojson)) {
          L.geoJSON(g.geojson, {
            style: {
              color: INDIGO,
              weight: 2,
              fillColor: INDIGO,
              fillOpacity: 0.15,
            },
          })
            .bindTooltip(g.label, { sticky: true })
            .addTo(group);
        } else if (g.type === "zone") {
          L.circle([g.lat, g.lon], {
            radius: zoneRadius(g),
            color: INDIGO,
            weight: 1.5,
            fillColor: INDIGO,
            fillOpacity: 0.12,
          })
            .bindTooltip(g.label, { sticky: true })
            .addTo(group);
        } else {
          L.circleMarker([g.lat, g.lon], {
            radius: 6,
            color: INDIGO,
            weight: 2,
            fillColor: "#FFFFFF",
            fillOpacity: 1,
          })
            .bindTooltip(g.label, { direction: "top" })
            .addTo(group);
        }
      }
      group.addTo(map);
      map.fitBounds(group.getBounds().pad(0.2));
      setTimeout(() => map.invalidateSize(), 60);
      setState("ok");
    })();

    return () => {
      cancelled = true;
      map.remove();
    };
  }, [locations]);

  return (
    <div className="relative w-full h-44 rounded-xl overflow-hidden bg-foreground-100 isolate">
      <div ref={ref} className="absolute inset-0 z-0" />
      {state !== "ok" && (
        <div className="absolute inset-0 z-10 flex items-center justify-center text-sm text-foreground-400 pointer-events-none">
          {state === "loading"
            ? "Cargando mapa…"
            : "No pude ubicar las zonas en el mapa"}
        </div>
      )}
    </div>
  );
}
