import React, { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import {
  MapPin,
  Search,
  Navigation,
  Compass,
} from "lucide-react";
import { BANGALORE_LOCALITIES } from "@nearvia/shared";

interface LocationPickerProps {
  initialLatitude?: number;
  initialLongitude?: number;
  initialAddress?: string;
  onLocationSelect: (location: {
    latitude: number;
    longitude: number;
    address: string;
  }) => void;
}

export const LocationPicker: React.FC<LocationPickerProps> = ({
  initialLatitude = 12.9784,
  initialLongitude = 77.6408,
  initialAddress = "Indiranagar 100ft Road, Bangalore",
  onLocationSelect,
}) => {
  const [latitude, setLatitude] = useState(initialLatitude);
  const [longitude, setLongitude] = useState(initialLongitude);
  const [address, setAddress] = useState(initialAddress);
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [isDetectingGps, setIsDetectingGps] = useState(false);
  const [suggestions, setSuggestions] = useState<
    Array<{ name: string; lat: number; lon: number }>
  >([]);

  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const circleRef = useRef<L.Circle | null>(null);

  // Initialize Map
  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (!mapInstanceRef.current) {
      const map = L.map(mapContainerRef.current, {
        center: [latitude, longitude],
        zoom: 14,
        zoomControl: false,
      });

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19,
      }).addTo(map);

      L.control.zoom({ position: "bottomright" }).addTo(map);

      // Custom Pin Icon
      const pinIcon = L.divIcon({
        className: "custom-picker-pin",
        html: `
          <div class="relative flex items-center justify-center -translate-y-4">
            <div class="w-8 h-8 rounded-full bg-orange-600 border-2 border-white shadow-xl flex items-center justify-center text-white">
              <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>
            </div>
            <div class="w-2.5 h-2.5 rounded-full bg-orange-600/60 animate-ping absolute -bottom-1"></div>
          </div>
        `,
        iconSize: [32, 42],
        iconAnchor: [16, 42],
      });

      // Draggable Marker
      const marker = L.marker([latitude, longitude], {
        icon: pinIcon,
        draggable: true,
      }).addTo(map);

      marker.on("dragend", (e: any) => {
        const newPos = e.target.getLatLng();
        updateCoordinates(newPos.lat, newPos.lng, true);
      });

      markerRef.current = marker;

      // 5 KM Hyperlocal Radius Circle
      const circle = L.circle([latitude, longitude], {
        radius: 5000,
        color: "#EA580C",
        fillColor: "#EA580C",
        fillOpacity: 0.05,
        weight: 1.5,
        dashArray: "5, 5",
      }).addTo(map);

      circleRef.current = circle;

      // Map Click Event
      map.on("click", (e: L.LeafletMouseEvent) => {
        updateCoordinates(e.latlng.lat, e.latlng.lng, true);
      });

      mapInstanceRef.current = map;
    }

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  const updateCoordinates = (
    lat: number,
    lng: number,
    reverseLookup = false,
    customAddress?: string,
  ) => {
    setLatitude(lat);
    setLongitude(lng);

    if (markerRef.current) {
      markerRef.current.setLatLng([lat, lng]);
    }
    if (circleRef.current) {
      circleRef.current.setLatLng([lat, lng]);
    }
    if (mapInstanceRef.current) {
      mapInstanceRef.current.panTo([lat, lng], { animate: true });
    }

    let finalAddress = customAddress || address;

    if (reverseLookup && !customAddress) {
      // Find nearest locality preset or format coordinates
      const matched = BANGALORE_LOCALITIES.find(
        (l) => Math.abs(l.latitude - lat) < 0.015 && Math.abs(l.longitude - lng) < 0.015,
      );
      if (matched) {
        finalAddress = `${matched.name}, Bengaluru`;
      } else {
        finalAddress = "Bengaluru Urban Area";
      }
      setAddress(finalAddress);
    }

    onLocationSelect({
      latitude: lat,
      longitude: lng,
      address: finalAddress,
    });
  };

  // GPS Detection
  const handleDetectGPS = () => {
    if (!navigator.geolocation) {
      alert("Geolocation is not supported by your browser.");
      return;
    }

    setIsDetectingGps(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setIsDetectingGps(false);
        const { latitude: lat, longitude: lng } = position.coords;
        const gpsAddr = "Detected Device Location, Bengaluru";
        setAddress(gpsAddr);
        updateCoordinates(lat, lng, false, gpsAddr);
      },
      (error) => {
        setIsDetectingGps(false);
        alert(
          error.message ||
            "Unable to detect location. Please check browser permissions or select a locality preset.",
        );
      },
      { timeout: 8000, enableHighAccuracy: true },
    );
  };

  // Address Search with Nominatim / Preset Filtering
  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    setIsSearching(true);
    try {
      // First check local presets
      const matched = BANGALORE_LOCALITIES.filter((l) =>
        l.name.toLowerCase().includes(searchQuery.toLowerCase()),
      );

      if (matched.length > 0) {
        setSuggestions(
          matched.map((m) => ({
            name: `${m.name}, Bengaluru`,
            lat: m.latitude,
            lon: m.longitude,
          })),
        );
      } else {
        // Fallback to OSM Nominatim API with Bangalore bound
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
            searchQuery + ", Bengaluru, Karnataka",
          )}&limit=4`,
        );
        if (res.ok) {
          const data = await res.json();
          if (data && data.length > 0) {
            setSuggestions(
              data.map((d: any) => ({
                name: d.display_name.split(",").slice(0, 3).join(","),
                lat: parseFloat(d.lat),
                lon: parseFloat(d.lon),
              })),
            );
          }
        }
      }
    } catch {
      // Fallback
    } finally {
      setIsSearching(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Search and GPS controls */}
      <div className="flex flex-col sm:flex-row gap-2.5">
        <form onSubmit={handleSearch} className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search address or area in Bengaluru..."
            className="w-full pl-10 pr-20 py-2.5 rounded-2xl bg-white border border-slate-200 text-xs font-medium text-slate-900 placeholder-slate-400 focus:border-orange-500 shadow-xs"
          />
          <button
            type="submit"
            disabled={isSearching || !searchQuery.trim()}
            className="absolute right-1.5 top-1/2 -translate-y-1/2 px-3 py-1.5 rounded-xl bg-orange-600 hover:bg-orange-700 text-white text-[11px] font-bold transition disabled:opacity-50"
          >
            {isSearching ? "Searching..." : "Search"}
          </button>
        </form>

        <button
          type="button"
          onClick={handleDetectGPS}
          disabled={isDetectingGps}
          className="px-4 py-2.5 rounded-2xl bg-white hover:bg-slate-50 border border-slate-200 text-orange-600 text-xs font-bold transition shadow-xs flex items-center justify-center space-x-2 shrink-0"
        >
          <Navigation className={`w-3.5 h-3.5 ${isDetectingGps ? "animate-spin" : ""}`} />
          <span>{isDetectingGps ? "Detecting GPS..." : "My GPS Location"}</span>
        </button>
      </div>

      {/* Search Suggestions Dropdown */}
      {suggestions.length > 0 && (
        <div className="p-2 rounded-2xl bg-white border border-slate-200 shadow-lg space-y-1 z-20">
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-2 py-1">
            Matching Locations:
          </div>
          {suggestions.map((s, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => {
                setAddress(s.name);
                updateCoordinates(s.lat, s.lon, false, s.name);
                setSuggestions([]);
                setSearchQuery("");
              }}
              className="w-full text-left px-3 py-2 rounded-xl text-xs font-semibold text-slate-800 hover:bg-orange-50 hover:text-orange-700 transition flex items-center space-x-2"
            >
              <MapPin className="w-3.5 h-3.5 text-orange-600 shrink-0" />
              <span className="truncate">{s.name}</span>
            </button>
          ))}
        </div>
      )}

      {/* Interactive Map Picker Canvas */}
      <div className="relative rounded-3xl overflow-hidden border border-slate-200 shadow-card bg-slate-100 h-64 sm:h-72 w-full">
        <div ref={mapContainerRef} className="w-full h-full" />

        {/* Floating Hint Overlay */}
        <div className="absolute top-3 left-3 z-[400] bg-white/95 backdrop-blur-md px-3 py-1.5 rounded-xl border border-slate-200 shadow-sm text-[11px] font-bold text-slate-700 flex items-center space-x-1.5 pointer-events-none">
          <Compass className="w-3.5 h-3.5 text-orange-600" />
          <span>Click map or drag pin to position exact workplace</span>
        </div>

        {/* 5 KM Radius Badge */}
        <div className="absolute bottom-3 right-3 z-[400] bg-white/95 backdrop-blur-md px-3 py-1.5 rounded-xl border border-slate-200 shadow-sm text-[10px] font-black text-orange-700 uppercase tracking-wider pointer-events-none">
          5 KM Hyperlocal Radius
        </div>
      </div>

      {/* Selected Location Summary & Address Input */}
      <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-card space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center space-x-2 text-xs font-bold text-slate-800">
            <MapPin className="w-4 h-4 text-orange-600" />
            <span>Selected Workplace Landmark:</span>
          </div>
          <span className="text-[11px] font-bold text-slate-600 bg-slate-100 px-2.5 py-1 rounded-lg">
            Verified Location Pin
          </span>
        </div>

        <input
          type="text"
          value={address}
          onChange={(e) => {
            setAddress(e.target.value);
            onLocationSelect({
              latitude,
              longitude,
              address: e.target.value,
            });
          }}
          placeholder="e.g. Near Indiranagar Metro Station, 100 Feet Road"
          className="w-full px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-900 placeholder-slate-400 focus:bg-white focus:border-orange-500"
        />

        {/* Quick Bengaluru Presets */}
        <div>
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
            Quick Locality Presets:
          </div>
          <div className="flex flex-wrap gap-1.5">
            {BANGALORE_LOCALITIES.slice(0, 8).map((loc) => (
              <button
                key={loc.name}
                type="button"
                onClick={() => {
                  const addr = `${loc.name}, Bengaluru`;
                  setAddress(addr);
                  updateCoordinates(loc.latitude, loc.longitude, false, addr);
                }}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition ${
                  Math.abs(latitude - loc.latitude) < 0.005 &&
                  Math.abs(longitude - loc.longitude) < 0.005
                    ? "bg-orange-600 text-white shadow-xs"
                    : "bg-slate-100 hover:bg-slate-200 text-slate-700"
                }`}
              >
                {loc.name.split("/")[0]?.trim()}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
