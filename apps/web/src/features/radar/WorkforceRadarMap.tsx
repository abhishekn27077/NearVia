import React, { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { GeoCoordinates, WorkforceRadarHotspot, WorkforceRadarCluster } from "@nearvia/types";

interface WorkforceRadarMapProps {
  center: GeoCoordinates;
  radiusKm: number;
  hotspots?: WorkforceRadarHotspot[];
  clusters?: WorkforceRadarCluster[];
  role: "WORKER" | "PROVIDER" | "AGENT" | "ADMIN";
  selectedHotspotId?: string | null;
  onSelectHotspot?: (id: string) => void;
}

export const WorkforceRadarMap: React.FC<WorkforceRadarMapProps> = ({
  center,
  radiusKm,
  hotspots = [],
  clusters = [],
  role,
  selectedHotspotId,
  onSelectHotspot,
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);
  const radiusCircleRef = useRef<L.Circle | null>(null);
  const centerMarkerRef = useRef<L.Marker | null>(null);

  // 1. Initialize Leaflet Map
  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (!mapInstanceRef.current) {
      const map = L.map(mapContainerRef.current, {
        center: [center.latitude, center.longitude],
        zoom: radiusKm <= 3 ? 14 : radiusKm <= 6 ? 13 : 12,
        zoomControl: false,
      });

      // Free OpenStreetMap Tiles (Zero Paid APIs, High Availability)
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19,
      }).addTo(map);

      L.control.zoom({ position: "bottomright" }).addTo(map);

      markersLayerRef.current = L.layerGroup().addTo(map);
      mapInstanceRef.current = map;
    }

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // 2. Sync Map View, Search Center, Radar Radius Circle, and Aggregated Markers
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !markersLayerRef.current) return;

    // Center Map view
    map.setView(
      [center.latitude, center.longitude],
      radiusKm <= 3 ? 14 : radiusKm <= 6 ? 13 : 12,
      { animate: true }
    );

    // Update or create Center Marker
    const centerIcon = L.divIcon({
      className: "radar-center-pin",
      html: `
        <div class="relative flex items-center justify-center w-8 h-8">
          <div class="absolute w-8 h-8 rounded-full bg-orange-500/20 animate-ping"></div>
          <div class="relative w-4 h-4 rounded-full bg-orange-600 border-2 border-white shadow-md flex items-center justify-center text-white text-[9px] font-black">
            ●
          </div>
        </div>
      `,
      iconSize: [32, 32],
      iconAnchor: [16, 16],
    });

    if (centerMarkerRef.current) {
      centerMarkerRef.current.setLatLng([center.latitude, center.longitude]);
    } else {
      centerMarkerRef.current = L.marker([center.latitude, center.longitude], {
        icon: centerIcon,
        zIndexOffset: 1000,
      })
        .bindPopup(`
          <div class="text-xs p-1">
            <strong class="font-black text-slate-900">Search Center</strong>
            <p class="text-slate-500 text-[11px]">Radius: ${radiusKm} KM</p>
          </div>
        `)
        .addTo(map);
    }

    // Update or create Radar Boundary Radius Circle
    if (radiusCircleRef.current) {
      radiusCircleRef.current.setLatLng([center.latitude, center.longitude]);
      radiusCircleRef.current.setRadius(radiusKm * 1000);
    } else {
      radiusCircleRef.current = L.circle([center.latitude, center.longitude], {
        radius: radiusKm * 1000,
        color: "#ea580c",
        weight: 1.5,
        opacity: 0.7,
        fillColor: "#ea580c",
        fillOpacity: 0.05,
        dashArray: "4, 6",
      }).addTo(map);
    }

    // Clear and redraw Aggregated Locality Markers
    markersLayerRef.current.clearLayers();

    // A. Render Hotspots (Demand-side or Platform-wide)
    if (hotspots.length > 0) {
      hotspots.forEach((spot) => {
        const isSelected = spot.id === selectedHotspotId;
        const count = role === "PROVIDER" ? spot.activeWorkersCount : spot.activeOpportunitiesCount;
        const countLabel = role === "PROVIDER" ? "Talent" : "Jobs";

        const badgeColor =
          spot.urgencyTier === "CRITICAL_SHORTAGE"
            ? "bg-rose-600 text-white"
            : spot.urgencyTier === "HIGH_DEMAND"
            ? "bg-amber-600 text-white"
            : role === "WORKER"
            ? "bg-blue-600 text-white"
            : "bg-emerald-600 text-white";

        const iconHtml = `
          <div class="cursor-pointer transition-transform duration-150 hover:scale-110 ${isSelected ? "scale-115" : ""}">
            <div class="px-2.5 py-1 rounded-full shadow-lg border-2 ${isSelected ? "border-orange-500 ring-2 ring-orange-300" : "border-white"} ${badgeColor} text-xs font-black flex items-center space-x-1 whitespace-nowrap">
              <span>${role === "WORKER" ? "💼" : "⚡"}</span>
              <span>${count} ${countLabel}</span>
            </div>
          </div>
        `;

        const hotspotIcon = L.divIcon({
          className: "custom-radar-hotspot-pin",
          html: iconHtml,
          iconSize: [80, 30],
          iconAnchor: [40, 15],
        });

        const marker = L.marker([spot.latitude, spot.longitude], { icon: hotspotIcon });

        marker.on("click", () => {
          if (onSelectHotspot) onSelectHotspot(spot.id);
        });

        // Informative Popup
        const categoriesHtml = spot.topCategories
          .map((cat) => `<span class="inline-block bg-slate-100 text-slate-700 text-[10px] font-bold px-1.5 py-0.5 rounded mr-1 mb-1">${cat}</span>`)
          .join("");

        marker.bindPopup(`
          <div class="p-1 space-y-1.5 min-w-[180px]">
            <div class="font-black text-xs text-slate-900 border-b border-slate-100 pb-1">
              ${spot.locationName}
            </div>
            <div class="text-[11px] text-slate-600 space-y-0.5">
              <div><strong class="text-slate-800">${spot.activeOpportunitiesCount}</strong> Active Open Jobs</div>
              ${spot.avgWage ? `<div>Avg Wage: <strong class="text-emerald-700 font-bold">₹${spot.avgWage}/day</strong></div>` : ""}
            </div>
            ${spot.topCategories.length > 0 ? `<div class="pt-1">${categoriesHtml}</div>` : ""}
          </div>
        `);

        markersLayerRef.current?.addLayer(marker);
      });
    }

    // B. Render Provider-Side Worker Clusters if present
    if (role === "PROVIDER" && clusters.length > 0 && hotspots.length === 0) {
      clusters.forEach((cluster, idx) => {
        const isSelected = cluster.id === selectedHotspotId;
        const iconHtml = `
          <div class="cursor-pointer transition-transform duration-150 hover:scale-110 ${isSelected ? "scale-115" : ""}">
            <div class="px-2.5 py-1 rounded-full shadow-lg border-2 ${isSelected ? "border-emerald-600 ring-2 ring-emerald-300" : "border-white"} bg-emerald-600 text-white text-xs font-black flex items-center space-x-1 whitespace-nowrap">
              <span>👷</span>
              <span>${cluster.availableWorkersCount} Online</span>
            </div>
          </div>
        `;

        const clusterIcon = L.divIcon({
          className: "custom-radar-cluster-pin",
          html: iconHtml,
          iconSize: [85, 30],
          iconAnchor: [42, 15],
        });

        const marker = L.marker(
          [cluster.centerCoordinates.latitude + (idx * 0.003 - 0.006), cluster.centerCoordinates.longitude + (idx * 0.003 - 0.006)],
          { icon: clusterIcon }
        );

        marker.bindPopup(`
          <div class="p-1 space-y-1.5 min-w-[170px]">
            <div class="font-black text-xs text-slate-900 border-b border-slate-100 pb-1">
              ${cluster.approximateAreaName}
            </div>
            <div class="text-[11px] text-emerald-700 font-bold">
              ${cluster.availableWorkersCount} Available Workers Online
            </div>
            <p class="text-[10px] text-slate-400">
              Aggregated Locality • Zero Individual GPS Tracking
            </p>
          </div>
        `);

        markersLayerRef.current?.addLayer(marker);
      });
    }
  }, [center, radiusKm, hotspots, clusters, role, selectedHotspotId, onSelectHotspot]);

  return (
    <div className="relative w-full h-full min-h-[350px] rounded-3xl overflow-hidden border border-slate-200 shadow-sm bg-slate-100">
      <div ref={mapContainerRef} className="w-full h-full min-h-[350px]" />
      
      {/* Privacy Guarantee Floating Badge */}
      <div className="absolute top-3 left-3 z-[400] bg-white/95 backdrop-blur-xs border border-slate-200/80 px-3 py-1.5 rounded-full shadow-xs flex items-center space-x-2 text-[11px] font-bold text-slate-700">
        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
        <span>Privacy Protected · Aggregated Area Zones Only</span>
      </div>

      {/* Radar Radius Badge */}
      <div className="absolute bottom-3 left-3 z-[400] bg-slate-900/90 backdrop-blur-xs text-white px-3 py-1.5 rounded-full shadow-md text-xs font-black">
        Radar: {radiusKm} KM
      </div>
    </div>
  );
};
