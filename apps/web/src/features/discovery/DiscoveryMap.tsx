import React, { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { DiscoveredOpportunity, GeoCoordinates, UrgencyLevel } from "@nearvia/types";

interface DiscoveryMapProps {
  center: GeoCoordinates;
  radiusKm: number;
  opportunities: DiscoveredOpportunity[];
  selectedOpportunityId?: string | null;
  onSelectOpportunity?: (id: string) => void;
}

export const DiscoveryMap: React.FC<DiscoveryMapProps> = ({
  center,
  radiusKm,
  opportunities,
  selectedOpportunityId,
  onSelectOpportunity,
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);
  const radiusCircleRef = useRef<L.Circle | null>(null);
  const centerMarkerRef = useRef<L.Marker | null>(null);

  // Initialize Map
  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (!mapInstanceRef.current) {
      const map = L.map(mapContainerRef.current, {
        center: [center.latitude, center.longitude],
        zoom: 13,
        zoomControl: false,
      });

      // Standard OpenStreetMap Tiles (Free, High-Resolution, Zero Watermark)
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

  // Update Center, Radius Circle, and Markers
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    // Pan or Fly map to selected opportunity or search center
    const selectedOpp = opportunities.find((o) => o.id === selectedOpportunityId);
    if (selectedOpp) {
      map.flyTo(
        [selectedOpp.location.latitude, selectedOpp.location.longitude],
        14,
        { animate: true, duration: 0.8 },
      );
    } else {
      map.setView(
        [center.latitude, center.longitude],
        radiusKm <= 3 ? 14 : radiusKm <= 6 ? 13 : 12,
        { animate: true },
      );
    }

    // Update or create Center Marker (User Location)
    if (centerMarkerRef.current) {
      centerMarkerRef.current.setLatLng([center.latitude, center.longitude]);
    } else {
      const userIcon = L.divIcon({
        className: "custom-user-pin",
        html: `
          <div class="relative flex items-center justify-center">
            <span class="animate-ping absolute inline-flex h-8 w-8 rounded-full bg-blue-500 opacity-60"></span>
            <div class="relative w-6 h-6 rounded-full bg-blue-600 border-2 border-white shadow-xl flex items-center justify-center">
              <div class="w-2 h-2 rounded-full bg-white"></div>
            </div>
          </div>
        `,
        iconSize: [32, 32],
        iconAnchor: [16, 16],
      });

      centerMarkerRef.current = L.marker([center.latitude, center.longitude], {
        icon: userIcon,
        zIndexOffset: 1000,
      })
        .bindTooltip("Your Location (Center)", {
          direction: "top",
          offset: [0, -12],
          className: "font-sans font-bold text-xs bg-slate-900 text-white rounded-lg px-2 py-1 shadow-md",
        })
        .addTo(map);
    }

    // Update or create Radius Circle (5 KM)
    if (radiusCircleRef.current) {
      radiusCircleRef.current.setLatLng([center.latitude, center.longitude]);
      radiusCircleRef.current.setRadius(radiusKm * 1000);
    } else {
      radiusCircleRef.current = L.circle(
        [center.latitude, center.longitude],
        {
          radius: radiusKm * 1000,
          color: "#2563EB",
          fillColor: "#2563EB",
          fillOpacity: 0.06,
          weight: 1.5,
          dashArray: "6, 6",
        },
      ).addTo(map);
    }

    // Render Opportunity Pins with Wage Flags
    if (markersLayerRef.current) {
      markersLayerRef.current.clearLayers();

      opportunities.forEach((opp) => {
        const isSelected = opp.id === selectedOpportunityId;
        const payDisplay = `₹${opp.paymentAmount}`;
        const distDisplay = `${opp.distanceKm.toFixed(1)} km`;

        const iconHtml = `
          <div class="cursor-pointer transition-all duration-200 ${
            isSelected
              ? "scale-110 -translate-y-1 z-50"
              : "hover:scale-105 hover:-translate-y-0.5"
          }">
            <div class="px-2.5 py-1 rounded-xl shadow-lg border text-xs font-black font-mono flex items-center space-x-1.5 whitespace-nowrap ${
              isSelected
                ? "bg-orange-600 text-white border-orange-700 ring-4 ring-orange-200"
                : (opp as any).isInstant || opp.urgency === UrgencyLevel.IMMEDIATE
                ? "bg-amber-500 text-slate-900 border-amber-600 ring-2 ring-amber-200"
                : opp.urgency === UrgencyLevel.URGENT
                ? "bg-rose-600 text-white border-rose-700"
                : "bg-slate-900 text-white border-slate-700"
            }">
              ${(opp as any).isInstant ? "<span>⚡</span>" : ""}
              <span>${payDisplay}</span>
              <span class="opacity-70 text-[10px] font-medium">• ${distDisplay}</span>
            </div>
            <div class="w-2 h-2 mx-auto rotate-45 -mt-1 ${
              isSelected
                ? "bg-orange-600"
                : (opp as any).isInstant || opp.urgency === UrgencyLevel.IMMEDIATE
                ? "bg-amber-500"
                : opp.urgency === UrgencyLevel.URGENT
                ? "bg-rose-600"
                : "bg-slate-900"
            }"></div>
          </div>
        `;

        const oppIcon = L.divIcon({
          className: "custom-map-pin",
          html: iconHtml,
          iconSize: [95, 32],
          iconAnchor: [47, 32],
        });

        const marker = L.marker([opp.location.latitude, opp.location.longitude], {
          icon: oppIcon,
        });

        marker.on("click", () => {
          if (onSelectOpportunity) {
            onSelectOpportunity(opp.id);
          }
        });

        const popupContent = `
          <div class="p-2 space-y-1 text-slate-900 max-w-[200px]">
            <div class="text-[10px] font-bold uppercase tracking-wider text-slate-500">${opp.categoryName}</div>
            <div class="font-extrabold text-xs text-slate-900 leading-tight">${opp.title}</div>
            <div class="flex items-center justify-between text-xs font-bold pt-1 border-t border-slate-100 mt-1">
              <span class="text-orange-600 font-mono font-black">${payDisplay}</span>
              <span class="text-slate-500 text-[11px]">${opp.distanceKm.toFixed(1)} km</span>
            </div>
          </div>
        `;

        marker.bindPopup(popupContent, { offset: [0, -20] });
        markersLayerRef.current?.addLayer(marker);

        if (isSelected) {
          marker.openPopup();
        }
      });
    }
  }, [center, radiusKm, opportunities, selectedOpportunityId]);

  return (
    <div className="relative w-full h-full rounded-3xl overflow-hidden shadow-card border border-slate-200 bg-white">
      {/* Map Canvas Container */}
      <div ref={mapContainerRef} className="w-full h-full min-h-[380px]" />

      {/* Floating Map Legend */}
      <div className="absolute top-4 right-4 z-[400] bg-white/95 backdrop-blur-md px-3 py-2.5 rounded-2xl border border-slate-200/90 shadow-md text-[11px] font-bold text-slate-700 space-y-1.5 pointer-events-none">
        <div className="text-[10px] uppercase font-black tracking-wider text-slate-400">
          5 KM Radius Legend
        </div>
        <div className="flex items-center space-x-2">
          <span className="w-2.5 h-2.5 rounded-full bg-blue-600"></span>
          <span>Your Location</span>
        </div>
        <div className="flex items-center space-x-2">
          <span className="w-2.5 h-2.5 rounded-md bg-slate-900"></span>
          <span>Task / Shift Pay</span>
        </div>
        <div className="flex items-center space-x-2">
          <span className="w-2.5 h-2.5 rounded-md bg-rose-600"></span>
          <span>Urgent Need</span>
        </div>
      </div>
    </div>
  );
};
