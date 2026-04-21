import { useEffect } from "react";
import { divIcon } from "leaflet";
import { MapContainer, Marker, Popup, TileLayer, useMap } from "react-leaflet";

const DAKAR_CENTER = [14.7167, -17.4677];

function MapViewport({ buses }) {
  const map = useMap();
  const positionedBuses = buses.filter(
    (bus) =>
      bus.position &&
      Number.isFinite(bus.position.lat) &&
      Number.isFinite(bus.position.lng)
  );

  useEffect(() => {
    if (positionedBuses.length === 0) {
      map.setView(DAKAR_CENTER, 12);
      return;
    }

    if (positionedBuses.length === 1) {
      const [bus] = positionedBuses;
      map.setView([bus.position.lat, bus.position.lng], 14);
      return;
    }

    const bounds = positionedBuses.map((bus) => [bus.position.lat, bus.position.lng]);
    map.fitBounds(bounds, { padding: [32, 32] });
  }, [map, positionedBuses]);

  return null;
}

function createBusIcon(color, label) {
  return divIcon({
    className: "bus-marker-wrapper",
    html: `<div class="bus-marker" style="--marker-color:${color}"><span>${label}</span></div>`,
    iconSize: [54, 54],
    iconAnchor: [27, 27]
  });
}

function toRadians(value) {
  return (value * Math.PI) / 180;
}

function toDegrees(value) {
  return (value * 180) / Math.PI;
}

function normalizeBearing(value) {
  return (value + 360) % 360;
}

function bearingBetween(from, to) {
  const lat1 = toRadians(from.lat);
  const lat2 = toRadians(to.lat);
  const lngDelta = toRadians(to.lng - from.lng);
  const y = Math.sin(lngDelta) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(lngDelta);
  return normalizeBearing(toDegrees(Math.atan2(y, x)));
}

function angularDistance(a, b) {
  const delta = Math.abs(a - b) % 360;
  return delta > 180 ? 360 - delta : delta;
}

function getBusRealtimeStatus(bus, line) {
  if (!bus?.position || !line?.stops?.length) {
    return "Position indisponible";
  }

  const nearestStop =
    line.stops.reduce(
      (best, stop) => {
        const distance = Math.hypot(bus.position.lat - stop.lat, bus.position.lng - stop.lng);
        return !best || distance < best.distance ? { stop, distance } : best;
      },
      null
    )?.stop || line.stops[0];

  const origin = line.stops[0];
  const terminus = line.stops[line.stops.length - 1];
  const heading = Number(bus.position.heading);

  let directionLabel = "sens inconnu";
  if (Number.isFinite(heading)) {
    const toOrigin = bearingBetween(bus.position, origin);
    const toTerminus = bearingBetween(bus.position, terminus);
    directionLabel =
      angularDistance(normalizeBearing(heading), toOrigin) <
      angularDistance(normalizeBearing(heading), toTerminus)
        ? "retour"
        : "aller";
  }

  return `Position ${nearestStop.name}, ${directionLabel}`;
}

export default function BusMapPanel({
  buses,
  lines,
  title = "Carte MVP",
  subtitle = "Vue live sur Dakar"
}) {
  const positionedBuses = buses.filter(
    (bus) =>
      bus.position &&
      Number.isFinite(bus.position.lat) &&
      Number.isFinite(bus.position.lng)
  );

  return (
    <section className="panel panel-map">
      <div className="panel__header">
        <div>
          <p className="eyebrow">Suivi temps reel</p>
          <h2>{title}</h2>
          <p className="panel__subtext">{subtitle}</p>
        </div>
        <span className="badge">{positionedBuses.length} bus geolocalises</span>
      </div>

      <div className="map-shell">
        <MapContainer
          center={DAKAR_CENTER}
          zoom={12}
          scrollWheelZoom
          className="leaflet-map"
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <MapViewport buses={positionedBuses} />
          {positionedBuses.map((bus) => {
            const line = lines.find((item) => item.id === bus.lineId);

            return (
              <Marker
                key={bus.id}
                position={[bus.position.lat, bus.position.lng]}
                icon={createBusIcon(line?.color || "#1d4ed8", line?.code || "B")}
              >
                <Popup>
                  <strong>{bus.label}</strong>
                  <br />
                  {line?.name || "Ligne inconnue"}
                  <br />
                  {getBusRealtimeStatus(bus, line)}
                  <br />
                  {new Date(bus.position.recordedAt).toLocaleString()}
                </Popup>
              </Marker>
            );
          })}
        </MapContainer>

        <div className="map-legend">
          <div className="map-legend__header">
            <strong>Bus actifs</strong>
            <span>{positionedBuses.length} en suivi live</span>
          </div>
          <div className="map-legend__list">
            {buses.map((bus) => {
              const line = lines.find((item) => item.id === bus.lineId);

              return (
                <article className="legend-card" key={bus.id}>
                  <span
                    className="legend-card__dot"
                    style={{ background: line?.color || "#1d4ed8" }}
                  />
                  <div>
                    <strong>{bus.label}</strong>
                    <p>{line?.name || "Ligne inconnue"}</p>
                    <small>
                      {bus.position?.recordedAt
                        ? `Maj: ${new Date(bus.position.recordedAt).toLocaleTimeString()}`
                        : "Aucune position recente"}
                    </small>
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
