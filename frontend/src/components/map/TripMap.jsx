import React, { useMemo } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import { CATEGORY_COLORS } from "../../utils";

// Custom teardrop pin, colored by category, with a label
function pin(color, label) {
  return L.divIcon({
    className: "",
    html: `<div class="coco-pin" style="background:${color}"><span>${label ?? ""}</span></div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 28],
    popupAnchor: [0, -28],
  });
}

function FitBounds({ points }) {
  const map = useMap();
  React.useEffect(() => {
    const valid = points.filter((p) => p.lat != null && p.lng != null);
    if (valid.length === 1) {
      map.setView([valid[0].lat, valid[0].lng], 13, { animate: false });
    } else if (valid.length > 1) {
      const bounds = L.latLngBounds(valid.map((p) => [p.lat, p.lng]));
      map.fitBounds(bounds, { padding: [40, 40], animate: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [points.length]);
  return null;
}

export default function TripMap({ points = [], center, height = 420, className }) {
  const valid = useMemo(() => points.filter((p) => p.lat != null && p.lng != null), [points]);
  const fallback = center || (valid[0] ? [valid[0].lat, valid[0].lng] : [20, 0]);

  return (
    <div className={className} style={{ height, borderRadius: 16, overflow: "hidden" }} data-testid="trip-map">
      <MapContainer center={fallback} zoom={valid.length ? 12 : 2} style={{ height: "100%", width: "100%" }} scrollWheelZoom>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {valid.map((p, i) => (
          <Marker key={p.id || i} position={[p.lat, p.lng]} icon={pin(CATEGORY_COLORS[p.category] || "#2C5530", p.label ?? i + 1)}>
            <Popup>
              <div style={{ minWidth: 140 }}>
                <strong>{p.title}</strong>
                {p.location && <div style={{ color: "#4B5563", fontSize: 12 }}>{p.location}</div>}
                {p.category && <div style={{ color: "#8A8F87", fontSize: 11, textTransform: "capitalize" }}>{p.category}</div>}
              </div>
            </Popup>
          </Marker>
        ))}
        <FitBounds points={valid} />
      </MapContainer>
    </div>
  );
}
