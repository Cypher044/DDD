import { useEffect, useMemo, useRef, useState } from "react";
import { divIcon } from "leaflet";
import {
  CircleMarker,
  MapContainer,
  Marker,
  Polyline,
  Popup,
  TileLayer
} from "react-leaflet";
import AdminPanel from "./components/AdminPanel";
import DriverPanel from "./components/DriverPanel";
import LoginPanel from "./components/LoginPanel";
import { api } from "./lib/api";
import { socket } from "./lib/socket";

const DRIVER_SESSION_KEY = "sunu-bus-driver-auth";
const ADMIN_SESSION_KEY = "sunu-bus-admin-auth";

const ROUTE_BLUEPRINTS = {
  "line-1": {
    title: "Parcelles Assainies ↔ Plateau",
    code: "L7",
    zone: "Plateau",
    schedule: "6h00-22h00",
    frequency: "Un bus toutes les 15 min",
    badgeColor: "#245645",
    accent: "#2c7f62",
    nextBus: "4 min",
    stops: [
      { name: "Parcelles Assainies", lat: 14.765, lng: -17.429, eta: "Origine" },
      { name: "Liberte 5", lat: 14.739, lng: -17.453, eta: "2 min" },
      { name: "Liberte 6", lat: 14.728, lng: -17.456, eta: "6 min" },
      { name: "Mairie de Pikine", lat: 14.748, lng: -17.392, eta: "8 min" },
      { name: "HLM", lat: 14.716, lng: -17.467, eta: "9 min" },
      { name: "Sandaga", lat: 14.670, lng: -17.438, eta: "12 min" },
      { name: "Plateau", lat: 14.671, lng: -17.433, eta: "Terminus" }
    ]
  },
  "line-2": {
    title: "Keur Massar ↔ Plateau",
    code: "L15",
    zone: "Guediawaye",
    schedule: "6h00-22h00",
    frequency: "Un bus toutes les 18 min",
    badgeColor: "#e88626",
    accent: "#ff9a3c",
    nextBus: "8 min",
    stops: [
      { name: "Keur Massar", lat: 14.786, lng: -17.311, eta: "Origine" },
      { name: "Mbao", lat: 14.741, lng: -17.328, eta: "4 min" },
      { name: "HLM", lat: 14.716, lng: -17.467, eta: "8 min" },
      { name: "Sandaga", lat: 14.670, lng: -17.438, eta: "11 min" },
      { name: "Plateau", lat: 14.671, lng: -17.433, eta: "Terminus" }
    ]
  },
  "line-3": {
    title: "Parcelles ↔ Sandaga",
    code: "L1",
    zone: "Par arret",
    schedule: "7h00-20h00",
    frequency: "Un bus toutes les 12 min",
    badgeColor: "#4468b2",
    accent: "#5f84d8",
    nextBus: "3 min",
    stops: [
      { name: "Parcelles", lat: 14.756, lng: -17.456, eta: "Origine" },
      { name: "Universite Cheikh Anta Diop", lat: 14.692, lng: -17.467, eta: "3 min" },
      { name: "HLM", lat: 14.716, lng: -17.467, eta: "7 min" },
      { name: "Sandaga", lat: 14.670, lng: -17.438, eta: "Terminus" }
    ]
  }
};

const EXTRA_LINES = [
  {
    id: "line-26",
    code: "L26",
    title: "Pikine → Markez",
    name: "Pikine → Markez",
    zone: "Pikine",
    schedule: "6h00-22h00",
    frequency: "12 arrets",
    badgeColor: "#6a53c3",
    accent: "#7e67d8",
    nextBus: "6 min",
    stops: [
      { name: "Pikine", lat: 14.764, lng: -17.391, eta: "Origine" },
      { name: "Markez", lat: 14.725, lng: -17.455, eta: "Terminus" }
    ]
  },
  {
    id: "line-31",
    code: "L31",
    title: "Aviere 7 → Plateau",
    name: "Aviere 7 → Plateau",
    zone: "Plateau",
    schedule: "6h00-22h00",
    frequency: "12 arrets",
    badgeColor: "#dc5b5b",
    accent: "#f07575",
    nextBus: "9 min",
    stops: [
      { name: "Aviere 7", lat: 14.731, lng: -17.482, eta: "Origine" },
      { name: "Plateau", lat: 14.671, lng: -17.433, eta: "Terminus" }
    ]
  },
  {
    id: "line-45",
    code: "L45",
    title: "Alviere 5 → Dosna",
    name: "Alviere 5 → Dosna",
    zone: "Guediawaye",
    schedule: "6h00-22h00",
    frequency: "12 arrets",
    badgeColor: "#db5b8c",
    accent: "#ef77a5",
    nextBus: "5 min",
    stops: [
      { name: "Alviere 5", lat: 14.737, lng: -17.438, eta: "Origine" },
      { name: "Dosna", lat: 14.780, lng: -17.398, eta: "Terminus" }
    ]
  }
];

function normalizePosition(position) {
  return {
    ...position,
    lat: Number(position.lat),
    lng: Number(position.lng),
    speed: Number(position.speed ?? 0),
    heading: Number(position.heading ?? 0)
  };
}

function createMapIcon(color, label) {
  return divIcon({
    className: "route-marker-wrapper",
    html: `<div class="route-marker" style="--route-color:${color}"><span>${label}</span></div>`,
    iconSize: [48, 48],
    iconAnchor: [24, 24]
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

function getLineRealtimeStatus(line, buses) {
  const recentBus = buses
    .filter((bus) => bus.position)
    .sort(
      (a, b) =>
        new Date(b.position.recordedAt || 0).getTime() - new Date(a.position.recordedAt || 0).getTime()
    )[0];

  if (!recentBus) {
    return "Position indisponible";
  }

  const nearestStop =
    line.stops.reduce(
      (best, stop) => {
        const distance = Math.hypot(recentBus.position.lat - stop.lat, recentBus.position.lng - stop.lng);
        return !best || distance < best.distance ? { stop, distance } : best;
      },
      null
    )?.stop || line.stops[0];

  const origin = line.stops[0];
  const terminus = line.stops[line.stops.length - 1];
  const heading = Number(recentBus.position.heading);

  let directionLabel = "sens inconnu";
  if (Number.isFinite(heading)) {
    const toOrigin = bearingBetween(recentBus.position, origin);
    const toTerminus = bearingBetween(recentBus.position, terminus);
    directionLabel =
      angularDistance(normalizeBearing(heading), toOrigin) <
      angularDistance(normalizeBearing(heading), toTerminus)
        ? "retour"
        : "aller";
  }

  return `Position ${nearestStop.name}, ${directionLabel}`;
}

function getBusRealtimeStatus(line, bus) {
  if (!bus?.position) {
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

/** Nouvelle key quand les coords changent pour que Leaflet affiche le deplacement (react-leaflet + socket). */
function LiveBusMarker({ bus, line }) {
  if (!bus.position) {
    return null;
  }

  const { lat, lng } = bus.position;
  const positionKey = `${lat.toFixed(6)}_${lng.toFixed(6)}`;

  return (
    <Marker
      key={`${bus.id}-${positionKey}`}
      position={[lat, lng]}
      icon={createMapIcon(line.badgeColor, line.code)}
    >
      <Popup>
        <strong>{bus.label}</strong>
        <br />
        {line.title}
        <br />
        {getBusRealtimeStatus(line, bus)}
      </Popup>
    </Marker>
  );
}

function Header({ siteMode, onModeChange, onNavigate, publicPage }) {
  const publicLinks = [
    ["home", "Accueil"],
    ["live", "Carte"],
    ["lines", "Lignes"],
    ["stop", "Aide"]
  ];

  return (
    <header className="site-header">
      <div className="site-header__brand" onClick={() => onNavigate("home")}>
        <div className="brand-mark">
          <span />
          <span />
        </div>
        <div>
          <strong>DemDikk</strong>
          <small>plus qu'un patrimoine</small>
        </div>
        <b>SUNU BUS</b>
      </div>

      <nav className="site-header__nav">
        {publicLinks.map(([id, label]) => (
          <button
            key={id}
            type="button"
            className={siteMode === "public" && publicPage === id ? "active" : ""}
            onClick={() => {
              onModeChange("public");
              onNavigate(id);
            }}
          >
            {label}
          </button>
        ))}
        <button
          type="button"
          className={siteMode === "driver" ? "active" : "cta-secondary"}
          onClick={() => onModeChange("driver")}
        >
          Chauffeur
        </button>
        <button
          type="button"
          className={siteMode === "admin" ? "active" : "cta-primary"}
          onClick={() => onModeChange("admin")}
        >
          Ouvrir la carte
        </button>
      </nav>
    </header>
  );
}

function RouteMap({ line, buses, height = 420, compact = false }) {
  const positions = line.stops.map((stop) => [stop.lat, stop.lng]);
  const centeredBuses = buses.filter((bus) => bus.position);
  const mapClassName = compact ? "route-map route-map--compact" : "route-map";

  return (
    <MapContainer center={positions[0]} zoom={12} scrollWheelZoom className={mapClassName} style={{ height }}>
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <Polyline positions={positions} pathOptions={{ color: line.badgeColor, weight: 6 }} />
      {line.stops.map((stop, index) => (
        <CircleMarker
          key={`${line.id}-${stop.name}`}
          center={[stop.lat, stop.lng]}
          radius={index === 0 || index === line.stops.length - 1 ? 8 : 6}
          pathOptions={{ color: line.badgeColor, fillColor: "#ffffff", fillOpacity: 1, weight: 4 }}
        >
          <Popup>{stop.name}</Popup>
        </CircleMarker>
      ))}
      {centeredBuses.map((bus) => (
        <LiveBusMarker key={bus.id} bus={bus} line={line} />
      ))}
    </MapContainer>
  );
}

function HomePage({ featuredLine, onNavigate, status }) {
  return (
    <section className="public-stack">
      <section className="landing-hero">
        <div className="landing-hero__overlay">
          <div>
            <p className="eyebrow">GPS bus tracking</p>
            <h1>Suivez votre bus en temps reel</h1>
            <p>
              Planifiez vos déplacements avec précision, choisissez votre ligne et
              voyez instantanément le prochain passage.
            </p>
            <div className="landing-hero__actions">
              <button type="button" className="cta-primary" onClick={() => onNavigate("live")}>
                Ouvrir la carte →
              </button>
              <span className="status-chip">{status}</span>
            </div>
          </div>
        </div>
      </section>

      <section className="feature-grid">
        <article className="feature-card">
          <span>📍</span>
          <div>
            <strong>Geolocalisation en temps reel</strong>
            <p>Suivez les bus sur la carte.</p>
          </div>
        </article>
        <article className="feature-card">
          <span>🚌</span>
          <div>
            <strong>Toutes les lignes DDD</strong>
            <p>De Ligne 1 a Ligne 121.</p>
          </div>
        </article>
        <article className="feature-card">
          <span>🕘</span>
          <div>
            <strong>Reduisez votre attente</strong>
            <p>Planifiez votre trajet.</p>
          </div>
        </article>
      </section>

      <section className="how-section">
        <h2>Comment ca marche ?</h2>
        <div className="how-grid">
          <article className="how-card">
            <b>1</b>
            <strong>Choisir sa ligne</strong>
            <p>{featuredLine.title}</p>
          </article>
          <article className="how-card">
            <b>2</b>
            <strong>Voir le bus sur la carte</strong>
            <p>Suivi live du vehicule et du prochain passage.</p>
          </article>
          <article className="how-card">
            <b>3</b>
            <strong>Se rendre a l'arret</strong>
            <p>Les arrets et temps d'arrivee sont visibles.</p>
          </article>
        </div>
      </section>
    </section>
  );
}

function LinesPage({ lines, onOpenLine }) {
  return (
    <section className="public-stack">
      <section className="catalog-hero">
        <div>
          <h1>Toutes les lignes DDD</h1>
          <p>Trouvez votre ligne de bus</p>
        </div>
      </section>

      <section className="catalog-toolbar">
        <input placeholder="Rechercher une ligne..." />
        <div className="catalog-filters">
          <button type="button">Toutes zones</button>
          <button type="button">Plateau</button>
          <button type="button">Guediawaye</button>
          <button type="button">Pikine</button>
          <button type="button">Par arret</button>
        </div>
      </section>

      <section className="line-card-grid">
        {lines.map((line) => (
          <article className="line-card" key={line.id} onClick={() => onOpenLine(line.id)}>
            <span className="line-card__badge" style={{ background: line.badgeColor }}>
              {line.code}
            </span>
            <div>
              <strong>{line.title}</strong>
              <p>
                {line.frequency} | {line.schedule}
              </p>
            </div>
            <button type="button">→</button>
          </article>
        ))}
      </section>
    </section>
  );
}

function LiveMapPage({ line, buses, onOpenLine, onOpenStop }) {
  const realtimeLabel = getLineRealtimeStatus(line, buses);

  return (
    <section className="live-layout">
      <div className="live-toolbar">
        <span className="live-toolbar__icon">🚌</span>
        <button type="button" className="live-toolbar__selector" onClick={() => onOpenLine(line.id)}>
          {line.code} — {line.title} | {realtimeLabel}
        </button>
      </div>

      <div className="live-hero-card">
        <div className="live-hero-card__map">
          <RouteMap line={line} buses={buses} />
        </div>
        <aside className="live-side-card">
          <span className="pill" style={{ background: "#245645", color: "#fff" }}>
            {line.code}
          </span>
          <small>{realtimeLabel}</small>
          <h2>{line.title}</h2>
          <div className="metric-card">
            <div className="metric-card__icon">🕘</div>
            <div>
              <small>Prochain bus dans</small>
              <strong>{line.nextBus}</strong>
            </div>
          </div>
          <div className="stop-times">
            {line.stops.slice(1, 4).map((stop) => (
              <button key={stop.name} type="button" className="stop-time-row" onClick={() => onOpenStop(stop.name)}>
                <span>{stop.name}</span>
                <strong>{stop.eta}</strong>
              </button>
            ))}
          </div>
          <button type="button" className="cta-primary cta-wide">
            Alertes authentifiees
          </button>
        </aside>
      </div>
    </section>
  );
}

function LineDetailPage({ line, buses, onOpenLive }) {
  return (
    <section className="line-detail-layout">
      <div className="line-detail-main">
        <div className="line-detail__heading">
          <span className="line-detail__code">{line.code}</span>
          <h1>{line.title}</h1>
        </div>

        <article className="line-detail-card">
          <div className="line-detail-tabs">
            <button type="button" className="active">
              Mini map
            </button>
            <button type="button">Dini map</button>
          </div>
          <RouteMap line={line} buses={buses} compact height={320} />
          <div className="line-detail-meta">
            <div className="line-detail-meta__card">
              <strong>Frequence</strong>
              <p>{line.frequency}</p>
            </div>
            <div className="line-detail-meta__card">
              <strong>Horaires</strong>
              <p>Lun-Ven : {line.schedule}</p>
            </div>
          </div>
          <button type="button" className="cta-primary cta-wide" onClick={() => onOpenLive(line.id)}>
            Suivre cette ligne en temps reel →
          </button>
        </article>
      </div>

      <aside className="stop-panel">
        <h3>Arrets de la ligne</h3>
        <div className="stop-timeline">
          {line.stops.map((stop, index) => (
            <article key={stop.name} className={`stop-timeline__item ${index === 2 ? "is-highlight" : ""}`}>
              <span />
              <div>
                <strong>{stop.name}</strong>
                <p>{stop.eta}</p>
              </div>
            </article>
          ))}
        </div>
      </aside>
    </section>
  );
}

function StopPage({ line, stopName }) {
  const stop = line.stops.find((item) => item.name === stopName) || line.stops[1];
  const nearby = line.stops.slice(1, 4);
  const arrivals = [
    { code: "L7", color: "#245645", destination: "Plateau", eta: "3 min" },
    { code: "L15", color: "#e8a427", destination: "Grand-Yoff", eta: "8 min" },
    { code: "L1", color: "#3f74c8", destination: "Plateau", eta: "12 min" },
    { code: "L26", color: "#6a53c3", destination: "Rufisque", eta: "18 min" }
  ];

  return (
    <section className="stop-layout">
      <div className="stop-layout__intro">
        <div className="stop-pin">📍</div>
        <div>
          <h1>Arret {stop.name}</h1>
          <p>Dakar, Senegal</p>
        </div>
      </div>

      <div className="stop-layout__grid">
        <article className="stop-card">
          <RouteMap line={line} buses={[]} compact height={280} />
          <h3>Arrets proches</h3>
          {nearby.map((item, index) => (
            <div className="nearby-row" key={item.name}>
              <span className="pill" style={{ background: ["#245645", "#e8a427", "#3f74c8"][index], color: "#fff" }}>
                {["L7", "L15", "L1"][index]}
              </span>
              <b>{item.name}</b>
              <strong>{150 + index * 150} m</strong>
            </div>
          ))}
        </article>

        <article className="stop-card">
          <h3>Prochains bus</h3>
          <small>Mis a jour il y a 5s</small>
          {arrivals.map((arrival) => (
            <div className="arrival-row" key={`${arrival.code}-${arrival.destination}`}>
              <span className="pill" style={{ background: arrival.color, color: "#fff" }}>
                {arrival.code}
              </span>
              <span>{arrival.destination}</span>
              <strong>{arrival.eta}</strong>
            </div>
          ))}
          <button type="button" className="report-btn">
            Signaler un probleme
          </button>
        </article>
      </div>
    </section>
  );
}

function AdminConsole({
  adminSession,
  summary,
  lines,
  publicLines,
  buses,
  users,
  onAdminLogin,
  onAdminLogout,
  onRefresh
}) {
  const [section, setSection] = useState("flotte");
  const fleetRows = buses.map((bus, index) => ({
    ...bus,
    gpsId: `GPS-${["A17", "B03", "C11", "D02"][index % 4]}`,
    battery: [78, 45, 12, 62][index % 4],
    operator: ["Orange", "Free", "Expresso", "Yas"][index % 4],
    signal: ["Actif", "Signal faible", "Hors ligne", "Actif"][index % 4]
  }));
  const lineAssignments = lines.map((line, index) => ({
    ...line,
    assigned: fleetRows.filter((bus) => bus.lineId === line.id).length,
    capacity: 4 + index,
    progress: Math.min(100, Math.round((fleetRows.filter((bus) => bus.lineId === line.id).length / (4 + index)) * 100) || 0)
  }));

  if (!adminSession?.token) {
    return (
      <LoginPanel
        title="Console d'administration"
        description="Connectez-vous pour acceder au dashboard, a la flotte et aux assignations."
        role="admin"
        defaultPhone="+221700000999"
        defaultPassword="demo-admin"
        onLogin={onAdminLogin}
      />
    );
  }

  return (
    <section className="admin-console">
      <aside className="admin-sidebar">
        <div className="admin-sidebar__brand">
          <div className="brand-mark">
            <span />
            <span />
          </div>
          <div>
            <strong>DemDikk</strong>
            <small>Console</small>
          </div>
        </div>

        <nav className="admin-sidebar__nav">
          {[
            ["dashboard", "Dashboard"],
            ["flotte", "Flotte"],
            ["lignes", "Lignes"],
            ["assignations", "Assignations"],
            ["gestion", "Parametres"]
          ].map(([id, label]) => (
            <button
              key={id}
              type="button"
              className={section === id ? "active" : ""}
              onClick={() => setSection(id)}
            >
              {label}
            </button>
          ))}
        </nav>
      </aside>

      <div className="admin-stage">
        <div className="admin-stage__topbar">
          <div>
            <h1>Sunu Bus — Console d'Administration</h1>
            <p>{adminSession.fullName}</p>
          </div>
          <div className="admin-stage__actions">
            <button type="button" className="cta-primary" onClick={onRefresh}>
              + Ajouter un boitier
            </button>
            <button type="button" className="ghost" onClick={onAdminLogout}>
              Deconnexion
            </button>
          </div>
        </div>

        <div className="admin-kpis">
          <article><strong>Total boitiers:</strong> {summary.totalBuses ?? 0}</article>
          <article><strong>Actifs:</strong> {summary.activeBuses ?? 0}</article>
          <article><strong>Hors ligne:</strong> {Math.max((summary.totalBuses ?? 0) - (summary.activeBuses ?? 0), 0)}</article>
          <article><strong>Signal faible:</strong> {summary.pendingOfflineBuffers ?? 0}</article>
          <article><strong>Points GPS (historique):</strong> {summary.totalPositionSamples ?? 0}</article>
        </div>

        {section === "flotte" || section === "dashboard" ? (
          <section className="console-card">
            <div className="console-card__toolbar">
              <input placeholder="Rechercher un bus ou boitier..." />
              <div className="console-card__filters">
                <button type="button">Statut</button>
                <button type="button">Ligne</button>
                <button type="button">Operateur SIM</button>
              </div>
            </div>
            <div className="table-shell">
              <table className="fleet-table">
                <thead>
                  <tr>
                    <th>ID Boitier</th>
                    <th>Bus N°</th>
                    <th>Ligne assignee</th>
                    <th>Statut</th>
                    <th>Derniere position</th>
                    <th>Batterie %</th>
                    <th>Operateur</th>
                  </tr>
                </thead>
                <tbody>
                  {fleetRows.map((row) => (
                    <tr key={row.id}>
                      <td>{row.gpsId}</td>
                      <td>{row.label}</td>
                      <td>{publicLines.find((line) => line.id === row.lineId)?.name || "Non assignee"}</td>
                      <td>{row.signal}</td>
                      <td>
                        {row.position
                          ? `${row.position.lat.toFixed(3)}°, ${row.position.lng.toFixed(3)}°`
                          : "N/A"}
                      </td>
                      <td>{row.battery}%</td>
                      <td>{row.operator}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ) : null}

        {section === "assignations" ? (
          <section className="assignment-grid">
            <article className="console-card">
              <h3>Boitiers GPS disponibles</h3>
              <div className="assignment-list">
                {fleetRows.map((row) => (
                  <div key={row.id} className="assignment-row">
                    <div>
                      <strong>
                        {row.gpsId} | {row.label}
                      </strong>
                      <p>{lines.find((line) => line.id === row.lineId)?.code || "Non assigne"}</p>
                    </div>
                    <button type="button">Affecter</button>
                  </div>
                ))}
              </div>
            </article>
            <article className="console-card">
              <h3>Lignes et leurs assignations</h3>
              <div className="assignment-progress">
                {lineAssignments.map((line) => (
                  <div key={line.id}>
                    <div className="assignment-progress__label">
                      <strong>
                        {line.code} — {line.name}
                      </strong>
                      <span>{line.progress}%</span>
                    </div>
                    <div className="progress-bar">
                      <span style={{ width: `${line.progress}%`, background: line.color }} />
                    </div>
                  </div>
                ))}
              </div>
            </article>
          </section>
        ) : null}

        {section === "gestion" ? (
          <AdminPanel
            session={adminSession}
            summary={summary}
            lines={lines}
            buses={buses}
            users={users}
            onAdminLogin={onAdminLogin}
            onAdminLogout={onAdminLogout}
            onRefresh={onRefresh}
          />
        ) : null}
      </div>
    </section>
  );
}

export default function App() {
  const [lines, setLines] = useState([]);
  const [buses, setBuses] = useState([]);
  const [users, setUsers] = useState([]);
  const [summary, setSummary] = useState({});
  const [siteMode, setSiteMode] = useState("public");
  const [publicPage, setPublicPage] = useState("home");
  const [selectedLineId, setSelectedLineId] = useState("line-1");
  const [selectedStopName, setSelectedStopName] = useState("Universite Cheikh Anta Diop");
  const [status, setStatus] = useState("Synchronisation en cours...");
  const [driverSession, setDriverSession] = useState(() =>
    JSON.parse(window.localStorage.getItem(DRIVER_SESSION_KEY) || "null")
  );
  const [adminSession, setAdminSession] = useState(() =>
    JSON.parse(window.localStorage.getItem(ADMIN_SESSION_KEY) || "null")
  );
  const linesRef = useRef([]);

  async function loadData() {
    const [nextLines, nextBuses] = await Promise.all([api.getLines(), api.getBuses()]);

    setLines(nextLines);
    linesRef.current = nextLines;
    setBuses(
      nextBuses.map((bus) => ({
        ...bus,
        position: bus.position ? normalizePosition(bus.position) : null
      }))
    );
  }

  async function loadAdminData(token) {
    if (!token) {
      setSummary({});
      setUsers([]);
      return;
    }

    const [nextSummary, nextUsers] = await Promise.all([
      api.getAdminSummary(token),
      api.getAdminUsers(token)
    ]);

    setSummary(nextSummary);
    setUsers(nextUsers);
  }

  useEffect(() => {
    loadData()
      .then(() => setStatus("Plateforme synchronisee."))
      .catch(() => setStatus("Impossible de charger les donnees."));

    const onPosition = (payload) => {
      const nextPosition = normalizePosition(payload);
      const targetId = String(nextPosition.busId);

      setBuses((current) => {
        const idx = current.findIndex((bus) => String(bus.id) === targetId);
        if (idx === -1) {
          return [
            ...current,
            {
              id: targetId,
              label: targetId,
              lineId: nextPosition.lineId,
              status: "active",
              driverId: null,
              position: nextPosition
            }
          ];
        }
        return current.map((bus, i) =>
          i === idx
            ? {
                ...bus,
                lineId: nextPosition.lineId ?? bus.lineId,
                position: nextPosition
              }
            : bus
        );
      });
      setStatus(`Position recue pour ${targetId}.`);
    };

    const onRefresh = () => {
      loadData().catch(() => {
        setStatus("Erreur pendant la synchronisation.");
      });
    };

    const onSocketConnect = () => {
      loadData().catch(() => {
        setStatus("Reconnexion: impossible de recharger les bus.");
      });
    };

    socket.on("bus:position", onPosition);
    socket.on("bus:refresh", onRefresh);
    socket.on("connect", onSocketConnect);

    return () => {
      socket.off("bus:position", onPosition);
      socket.off("bus:refresh", onRefresh);
      socket.off("connect", onSocketConnect);
    };
  }, []);

  useEffect(() => {
    if (adminSession?.token) {
      loadAdminData(adminSession.token).catch(() => {
        setStatus("Impossible de charger les donnees admin.");
      });
    } else {
      setSummary({});
      setUsers([]);
    }
  }, [adminSession]);

  const catalogLines = useMemo(() => {
    const merged = lines.map((line, index) => {
      const blueprint = ROUTE_BLUEPRINTS[line.id];
      if (blueprint) {
        return {
          ...blueprint,
          id: line.id,
          code: blueprint.code || line.code,
          name: line.name,
          color: line.color
        };
      }

      return {
        id: line.id,
        code: line.code,
        title: line.name,
        name: line.name,
        zone: index % 2 === 0 ? "Plateau" : "Pikine",
        schedule: "6h00-22h00",
        frequency: "12 arrets",
        badgeColor: line.color,
        accent: line.color,
        nextBus: `${4 + index} min`,
        stops: [
          { name: "Depart", lat: 14.72 + index * 0.01, lng: -17.45 + index * 0.01, eta: "Origine" },
          { name: "Intermediaire", lat: 14.70 + index * 0.008, lng: -17.43 + index * 0.007, eta: "5 min" },
          { name: "Terminus", lat: 14.67 + index * 0.004, lng: -17.41 + index * 0.004, eta: "Terminus" }
        ]
      };
    });

    return [...merged, ...EXTRA_LINES];
  }, [lines]);

  const featuredLine =
    catalogLines.find((line) => line.id === selectedLineId) || catalogLines[0] || EXTRA_LINES[0];
  const featuredLineBuses = buses.filter((bus) => bus.lineId === featuredLine?.id);

  function navigatePublic(page) {
    setSiteMode("public");
    setPublicPage(page);
  }

  function openLine(lineId) {
    setSelectedLineId(lineId);
    setPublicPage("line");
  }

  function openLive(lineId) {
    setSelectedLineId(lineId);
    setPublicPage("live");
  }

  function openStop(stopName) {
    setSelectedStopName(stopName);
    setPublicPage("stop");
  }

  async function handleDriverAction(message) {
    await loadData();
    setStatus(message);
  }

  async function handleDriverLogin(credentials) {
    const session = await api.login(credentials);
    setDriverSession(session);
    window.localStorage.setItem(DRIVER_SESSION_KEY, JSON.stringify(session));
    setStatus(`Chauffeur connecte: ${session.fullName}.`);
  }

  function handleDriverLogout() {
    setDriverSession(null);
    window.localStorage.removeItem(DRIVER_SESSION_KEY);
    setStatus("Session chauffeur fermee.");
  }

  async function handleAdminLogin(credentials) {
    const session = await api.login(credentials);
    setAdminSession(session);
    window.localStorage.setItem(ADMIN_SESSION_KEY, JSON.stringify(session));
    await loadAdminData(session.token);
    setStatus(`Admin connecte: ${session.fullName}.`);
  }

  function handleAdminLogout() {
    setAdminSession(null);
    window.localStorage.removeItem(ADMIN_SESSION_KEY);
    setStatus("Session admin fermee.");
  }

  async function handleAdminRefresh() {
    await Promise.all([loadData(), loadAdminData(adminSession?.token)]);
    setStatus("Donnees admin synchronisees.");
  }

  return (
    <main className="app-shell">
      <Header
        siteMode={siteMode}
        onModeChange={setSiteMode}
        onNavigate={navigatePublic}
        publicPage={publicPage}
      />

      {siteMode === "public" ? (
        <section className="page-shell">
          {publicPage === "home" ? (
            <HomePage featuredLine={featuredLine} onNavigate={navigatePublic} status={status} />
          ) : null}
          {publicPage === "lines" ? (
            <LinesPage lines={catalogLines} onOpenLine={openLine} />
          ) : null}
          {publicPage === "line" ? (
            <LineDetailPage line={featuredLine} buses={featuredLineBuses} onOpenLive={openLive} />
          ) : null}
          {publicPage === "stop" ? (
            <StopPage line={featuredLine} stopName={selectedStopName} />
          ) : null}
          {publicPage === "live" ? (
            <LiveMapPage
              line={featuredLine}
              buses={featuredLineBuses}
              onOpenLine={openLine}
              onOpenStop={openStop}
            />
          ) : null}
        </section>
      ) : null}

      {siteMode === "driver" ? (
        <section className="workspace-shell">
          <div className="workspace-card">
            <DriverPanel
              lines={lines}
              session={driverSession}
              onDriverLogin={handleDriverLogin}
              onDriverLogout={handleDriverLogout}
              onDriverAction={handleDriverAction}
            />
          </div>
          <div className="workspace-card">
            <LiveMapPage
              line={featuredLine}
              buses={featuredLineBuses}
              onOpenLine={openLine}
              onOpenStop={openStop}
            />
          </div>
        </section>
      ) : null}

      {siteMode === "admin" ? (
        <section className="page-shell">
          <AdminConsole
            adminSession={adminSession}
            summary={summary}
            lines={lines}
            publicLines={catalogLines}
            buses={buses}
            users={users}
            onAdminLogin={handleAdminLogin}
            onAdminLogout={handleAdminLogout}
            onRefresh={handleAdminRefresh}
          />
        </section>
      ) : null}
    </main>
  );
}
