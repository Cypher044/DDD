import { useEffect, useMemo, useRef, useState } from "react";
import { api } from "../lib/api";
import LoginPanel from "./LoginPanel";

const STORAGE_KEY = "sunu-bus-driver-session";

function computeHeading(previousPosition, nextPosition) {
  if (!previousPosition) {
    return 0;
  }

  const latDelta = nextPosition.lat - previousPosition.lat;
  const lngDelta = nextPosition.lng - previousPosition.lng;

  if (latDelta === 0 && lngDelta === 0) {
    return 0;
  }

  return Math.round((Math.atan2(lngDelta, latDelta) * 180) / Math.PI);
}

export default function DriverPanel({
  lines,
  session,
  onDriverLogin,
  onDriverLogout,
  onDriverAction
}) {
  const [busId, setBusId] = useState("");
  const [lineId, setLineId] = useState("");
  const [tracking, setTracking] = useState(false);
  const [driverBuses, setDriverBuses] = useState([]);
  const [driverStatus, setDriverStatus] = useState(
    "Tracking inactif. Le chauffeur doit autoriser la localisation."
  );
  const [lastPosition, setLastPosition] = useState(null);
  const watchIdRef = useRef(null);
  const lastPositionRef = useRef(null);

  useEffect(() => {
    const savedSession = window.localStorage.getItem(STORAGE_KEY);
    if (savedSession) {
      try {
        const parsed = JSON.parse(savedSession);
        setBusId(parsed.busId || "");
        setLineId(parsed.lineId || "");
      } catch {
        window.localStorage.removeItem(STORAGE_KEY);
      }
    }

    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!session?.token) {
      setDriverBuses([]);
      return;
    }

    api
      .getDriverBuses(session.token)
      .then((buses) => setDriverBuses(buses))
      .catch(() => {
        setDriverStatus("Impossible de charger les bus assignes.");
      });
  }, [session]);

  const selectedBus = useMemo(
    () => driverBuses.find((bus) => bus.id === busId) || null,
    [driverBuses, busId]
  );

  useEffect(() => {
    if (!busId && driverBuses.length === 1) {
      setBusId(driverBuses[0].id);
    }
  }, [busId, driverBuses]);

  useEffect(() => {
    if (selectedBus?.lineId) {
      setLineId(selectedBus.lineId);
      return;
    }

    if (!lineId && lines.length > 0) {
      setLineId(lines[0].id);
    }
  }, [selectedBus, lineId, lines]);

  if (!session?.token) {
    return (
      <LoginPanel
        title="Connexion chauffeur"
        description="Le chauffeur doit se connecter avant de lancer le suivi GPS."
        role="driver"
        defaultPhone="+221700000001"
        defaultPassword="demo-driver"
        onLogin={onDriverLogin}
      />
    );
  }

  async function pushPosition(position) {
    const payload = {
      busId,
      lineId,
      lat: position.coords.latitude,
      lng: position.coords.longitude,
      speed:
        position.coords.speed && Number.isFinite(position.coords.speed)
          ? Math.round(position.coords.speed * 3.6)
          : 0,
      heading:
        position.coords.heading && Number.isFinite(position.coords.heading)
          ? Math.round(position.coords.heading)
          : computeHeading(lastPositionRef.current, {
              lat: position.coords.latitude,
              lng: position.coords.longitude
            }),
      recordedAt: new Date(position.timestamp).toISOString()
    };

    await api.sendDriverLocation(payload, session.token);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ busId, lineId }));

    lastPositionRef.current = {
      lat: payload.lat,
      lng: payload.lng
    };
    setLastPosition(payload);
    onDriverAction(`Position automatique envoyee pour ${busId}.`);
    setDriverStatus("Tracking actif. La position est envoyee automatiquement.");
  }

  function startTracking() {
    if (!("geolocation" in navigator)) {
      setDriverStatus("La geolocalisation n'est pas disponible sur cet appareil.");
      return;
    }

    if (!busId || !lineId) {
      setDriverStatus("Choisis d'abord le bus affecte au chauffeur.");
      return;
    }

    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
    }

    setTracking(true);
    setDriverStatus("Demande de permission GPS en cours...");

    watchIdRef.current = navigator.geolocation.watchPosition(
      (position) => {
        pushPosition(position).catch(() => {
          setDriverStatus("Echec d'envoi de la position au serveur.");
          setTracking(false);
        });
      },
      (error) => {
        setTracking(false);
        setDriverStatus(
          `Impossible de suivre la position: ${error.message || "erreur GPS"}`
        );
      },
      {
        enableHighAccuracy: true,
        maximumAge: 5000,
        timeout: 15000
      }
    );
  }

  function stopTracking() {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }

    setTracking(false);
    setDriverStatus("Tracking arrete.");
  }

  return (
    <section className="panel">
      <div className="panel__header">
        <div>
          <p className="eyebrow">Chauffeur</p>
          <h2>Envoi automatique de position</h2>
        </div>
        <span className={`tracking-pill ${tracking ? "is-live" : ""}`}>
          {tracking ? "GPS actif" : "GPS inactif"}
        </span>
      </div>

      <div className="driver-stack">
        <label>
          Bus affecte
          <select value={busId} onChange={(event) => setBusId(event.target.value)}>
            <option value="">Choisir un bus assigne</option>
            {driverBuses.map((bus) => (
              <option key={bus.id} value={bus.id}>
                {bus.label} - {bus.id}
              </option>
            ))}
          </select>
        </label>

        <label>
          Ligne
          <select
            value={lineId}
            onChange={(event) => setLineId(event.target.value)}
            disabled={Boolean(selectedBus?.lineId)}
          >
            {lines.length === 0 ? (
              <option value="">Chargement des lignes...</option>
            ) : null}
            {lines.map((line) => (
              <option key={line.id} value={line.id}>
                {line.code} - {line.name}
              </option>
            ))}
          </select>
        </label>

        <div className="driver-form__actions">
          <button type="button" onClick={startTracking}>
            Demarrer le tracking
          </button>
          <button type="button" className="secondary" onClick={stopTracking}>
            Arreter
          </button>
          <button type="button" className="ghost" onClick={onDriverLogout}>
            Deconnexion
          </button>
        </div>

        <div className="driver-status-card">
          <strong>Connecte: {session.fullName}</strong>
          <p>{session.phone}</p>
          <p>
            {driverBuses.length > 0
              ? `${driverBuses.length} bus assigne(s) disponible(s).`
              : "Aucun bus n'est encore assigne a ce chauffeur."}
          </p>
        </div>

        <div className="driver-status-card">
          <strong>{driverStatus}</strong>
          <p>
            Une fois active, la position GPS du chauffeur est envoyee sans clic
            manuel au backend, puis diffusee au site usager en temps reel.
          </p>
        </div>

        {lastPosition ? (
          <div className="driver-position">
            <span>Derniere position envoyee</span>
            <strong>
              {lastPosition.lat.toFixed(5)}, {lastPosition.lng.toFixed(5)}
            </strong>
            <small>Ligne active: {lineId}</small>
            <small>{new Date(lastPosition.recordedAt).toLocaleString()}</small>
          </div>
        ) : null}
      </div>
    </section>
  );
}
