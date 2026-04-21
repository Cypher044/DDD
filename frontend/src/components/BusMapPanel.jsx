import { useEffect, useMemo, useRef, useState } from "react";
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
  if (!bus?.position) {
    return "Position indisponible";
  }

  const exactPosition = `${bus.position.lat.toFixed(6)}, ${bus.position.lng.toFixed(6)}`;

  if (!line?.stops?.length) {
    return `Position exacte: ${exactPosition}`;
  }

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

  return `Position exacte: ${exactPosition} (${directionLabel})`;
}

function extractReadablePlaceName(data) {
  if (!data) {
    return null;
  }

  return (
    data.locality ||
    data.city ||
    data.principalSubdivision ||
    data.localityInfo?.administrative?.[2]?.name ||
    data.localityInfo?.administrative?.[1]?.name ||
    data.countryName ||
    null
  );
}

export default function BusMapPanel({
  buses,
  lines,
  title = "Carte MVP",
  subtitle = "Vue live sur Dakar"
}) {
  const [placeNamesByBus, setPlaceNamesByBus] = useState({});
  const fetchedCoordKeysRef = useRef(new Set());
  const positionedBuses = buses.filter(
    (bus) =>
      bus.position &&
      Number.isFinite(bus.position.lat) &&
      Number.isFinite(bus.position.lng)
  );
  const lineById = useMemo(
    () => Object.fromEntries(lines.map((line) => [line.id, line])),
    [lines]
  );

  useEffect(() => {
    let isCancelled = false;

    async function resolvePlaceName(bus) {
      const lat = bus.position.lat;
      const lng = bus.position.lng;
      const coordKey = `${lat.toFixed(5)},${lng.toFixed(5)}`;

      if (fetchedCoordKeysRef.current.has(coordKey)) {
        return;
      }

      fetchedCoordKeysRef.current.add(coordKey);

      try {
        const response = await fetch(
          `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${encodeURIComponent(
            lat
          )}&longitude=${encodeURIComponent(lng)}&localityLanguage=fr`,
          {
            headers: {
              "Accept-Language": "fr"
            }
          }
        );

        if (!response.ok) {
          throw new Error("reverse-geocode-failed");
        }

        const data = await response.json();
        const readableName = extractReadablePlaceName(data);

        if (!isCancelled && readableName) {
          setPlaceNamesByBus((current) => ({
            ...current,
            [bus.id]: readableName
          }));
        }
      } catch {
        // Keep coordinates-only display if reverse geocoding fails.
      }
    }

    positionedBuses.forEach((bus) => {
      resolvePlaceName(bus);
    });

    return () => {
      isCancelled = true;
    };
  }, [positionedBuses]);

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
            const line = lineById[bus.lineId];
            const exactCoords = `${bus.position.lat.toFixed(6)}, ${bus.position.lng.toFixed(6)}`;
            const readablePlace = placeNamesByBus[bus.id];

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
                  {readablePlace ? `Position: ${readablePlace}` : "Position: recherche du lieu..."}
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
              const line = lineById[bus.lineId];
              const readablePlace = placeNamesByBus[bus.id];

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
                    <small>
                      {bus.position ? `Position: ${readablePlace || "localisation..."}` : "Position indisponible"}
                    </small>
                    <small>
                      {bus.position
                        ? `Coordonnees: ${bus.position.lat.toFixed(6)}, ${bus.position.lng.toFixed(6)}`
                        : "Coordonnees indisponibles"}
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
