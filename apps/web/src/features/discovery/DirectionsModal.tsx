import React, { useEffect, useState, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import {
  X,
  Navigation,
  Clock,
  MapPin,
  ExternalLink,
  Car,
  Footprints,
} from "lucide-react";
import { GeoCoordinates } from "@nearvia/types";
import {
  fetchRoutingDirections,
  getDirectionsUrl,
  RouteResult,
  formatDistance,
} from "@nearvia/shared";

interface DirectionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  origin: GeoCoordinates;
  destination: GeoCoordinates;
  destinationTitle: string;
  destinationAddress: string;
  originLabel?: string;
}

export const DirectionsModal: React.FC<DirectionsModalProps> = ({
  isOpen,
  onClose,
  origin,
  destination,
  destinationTitle,
  destinationAddress,
  originLabel = "Your Location",
}) => {
  const [travelMode, setTravelMode] = useState<"driving" | "walking">("driving");
  const [route, setRoute] = useState<RouteResult | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const polylineRef = useRef<L.Polyline | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    loadRoute(travelMode);
  }, [isOpen, origin, destination, travelMode]);

  const loadRoute = async (mode: "driving" | "walking") => {
    setIsLoading(true);
    try {
      const res = await fetchRoutingDirections(origin, destination, mode);
      setRoute(res);
    } catch {
      // Handled inside helper
    } finally {
      setIsLoading(false);
    }
  };

  // Map Setup and Polyline Rendering
  useEffect(() => {
    if (!isOpen || !mapContainerRef.current) return;

    if (!mapInstanceRef.current) {
      const bounds = L.latLngBounds(
        [origin.latitude, origin.longitude],
        [destination.latitude, destination.longitude],
      );

      const map = L.map(mapContainerRef.current, {
        zoomControl: false,
      }).fitBounds(bounds, { padding: [40, 40] });

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19,
      }).addTo(map);

      L.control.zoom({ position: "bottomright" }).addTo(map);

      // Origin Marker (Worker - Blue Pin)
      const originIcon = L.divIcon({
        className: "origin-map-pin",
        html: `
          <div class="w-6 h-6 rounded-full bg-blue-600 border-2 border-white shadow-xl flex items-center justify-center text-white">
            <div class="w-2 h-2 rounded-full bg-white"></div>
          </div>
        `,
        iconSize: [24, 24],
        iconAnchor: [12, 12],
      });

      L.marker([origin.latitude, origin.longitude], { icon: originIcon })
        .bindTooltip(originLabel, {
          direction: "top",
          className: "font-sans font-bold text-xs bg-slate-900 text-white rounded-lg px-2 py-1 shadow-md",
        })
        .addTo(map);

      // Destination Marker (Job - Orange Pin)
      const destIcon = L.divIcon({
        className: "dest-map-pin",
        html: `
          <div class="w-7 h-7 rounded-full bg-orange-600 border-2 border-white shadow-xl flex items-center justify-center text-white">
            <svg xmlns="http://www.w3.org/2000/svg" class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>
          </div>
        `,
        iconSize: [28, 28],
        iconAnchor: [14, 28],
      });

      L.marker([destination.latitude, destination.longitude], {
        icon: destIcon,
      })
        .bindTooltip(destinationTitle, {
          direction: "top",
          className: "font-sans font-bold text-xs bg-slate-900 text-white rounded-lg px-2 py-1 shadow-md",
        })
        .addTo(map);

      mapInstanceRef.current = map;
    }

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [isOpen]);

  // Update Route Polyline
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !route) return;

    if (polylineRef.current) {
      polylineRef.current.remove();
    }

    const polyline = L.polyline(route.coordinates, {
      color: travelMode === "walking" ? "#10B981" : "#EA580C",
      weight: 5,
      opacity: 0.85,
      dashArray: travelMode === "walking" ? "8, 8" : undefined,
    }).addTo(map);

    polylineRef.current = polyline;

    const bounds = L.latLngBounds(route.coordinates);
    map.fitBounds(bounds, { padding: [50, 50], maxZoom: 16 });
  }, [route, travelMode]);

  if (!isOpen) return null;

  const googleMapsUrl = getDirectionsUrl(origin, destination);

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-5 sm:p-6 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-xl bg-orange-50 text-orange-600 border border-orange-100">
              <Navigation className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-black text-slate-900 font-display">
                Directions & Travel Route
              </h2>
              <p className="text-xs text-slate-500 font-medium truncate max-w-xs">
                To: {destinationTitle}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-50 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Travel Mode Selector & Metrics Pill */}
        <div className="p-4 sm:p-5 bg-slate-50 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3">
          <div className="flex rounded-2xl bg-white border border-slate-200 p-1 shadow-xs">
            <button
              onClick={() => setTravelMode("driving")}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center space-x-1.5 ${
                travelMode === "driving"
                  ? "bg-orange-600 text-white shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <Car className="w-3.5 h-3.5" />
              <span>Drive / Bike</span>
            </button>
            <button
              onClick={() => setTravelMode("walking")}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center space-x-1.5 ${
                travelMode === "walking"
                  ? "bg-emerald-600 text-white shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <Footprints className="w-3.5 h-3.5" />
              <span>Walk</span>
            </button>
          </div>

          <div className="flex items-center space-x-3 text-xs font-bold text-slate-800">
            {isLoading ? (
              <span className="text-slate-400 text-xs animate-pulse font-medium">
                Calculating road route...
              </span>
            ) : route ? (
              <>
                <div className="flex items-center space-x-1 text-slate-900 font-black text-sm">
                  <Clock className="w-4 h-4 text-orange-600" />
                  <span>{route.durationFormatted}</span>
                </div>
                <div className="text-slate-400">•</div>
                <div className="text-slate-600">
                  {formatDistance(route.distanceKm)} road distance
                </div>
              </>
            ) : null}
          </div>
        </div>

        {/* Interactive Map Canvas */}
        <div className="relative flex-1 min-h-[260px] w-full bg-slate-100">
          <div ref={mapContainerRef} className="w-full h-full" />
        </div>

        {/* Destination & Action Footer */}
        <div className="p-5 sm:p-6 bg-white border-t border-slate-100 space-y-4">
          <div className="flex items-start space-x-3 text-xs">
            <MapPin className="w-4 h-4 text-orange-600 shrink-0 mt-0.5" />
            <div>
              <div className="font-bold text-slate-900">{destinationTitle}</div>
              <div className="text-slate-500 font-medium">{destinationAddress}</div>
            </div>
          </div>

          <div className="flex items-center justify-between gap-3 pt-1">
            <button
              onClick={onClose}
              className="px-4 py-2.5 rounded-2xl bg-slate-100 text-xs font-bold text-slate-700 hover:bg-slate-200 transition"
            >
              Close
            </button>

            <a
              href={googleMapsUrl}
              target="_blank"
              rel="noreferrer"
              className="px-5 py-2.5 rounded-2xl bg-orange-600 hover:bg-orange-700 text-white text-xs font-black transition shadow-md shadow-orange-600/20 flex items-center space-x-2"
            >
              <span>Start Turn-by-Turn Navigation</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};
