import { useMemo, useState } from "react";
import { api } from "../lib/api";
import LoginPanel from "./LoginPanel";
import StatCard from "./StatCard";

const initialLineForm = {
  id: "",
  code: "",
  name: "",
  color: "#0b6e4f"
};

const initialBusForm = {
  id: "",
  label: "",
  lineId: "",
  driverId: ""
};

const initialDriverForm = {
  id: "",
  fullName: "",
  phone: "",
  password: "",
  role: "driver"
};

function slugify(value, fallback = "") {
  const normalized = value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return normalized || fallback;
}

function StatusBanner({ status }) {
  if (!status?.message) {
    return null;
  }

  return (
    <p className={status.type === "error" ? "form-error" : "form-success"}>
      {status.message}
    </p>
  );
}

function SectionHeader({ title, description, helper }) {
  return (
    <div className="admin-section__header">
      <div>
        <h3>{title}</h3>
        <p>{description}</p>
      </div>
      {helper ? <span className="admin-helper">{helper}</span> : null}
    </div>
  );
}

export default function AdminPanel({
  session,
  summary,
  lines,
  buses,
  users,
  onAdminLogin,
  onAdminLogout,
  onRefresh
}) {
  const [lineForm, setLineForm] = useState(initialLineForm);
  const [busForm, setBusForm] = useState(initialBusForm);
  const [driverForm, setDriverForm] = useState(initialDriverForm);
  const [lineStatus, setLineStatus] = useState(null);
  const [busStatus, setBusStatus] = useState(null);
  const [driverStatus, setDriverStatus] = useState(null);

  const drivers = useMemo(
    () => users.filter((user) => user.role === "driver"),
    [users]
  );

  const linePreviewId = lineForm.id.trim() || `line-${slugify(lineForm.code, "nouvelle")}`;
  const busPreviewLabel = busForm.label.trim() || busForm.id.trim() || "Nouveau bus";
  const selectedLine = lines.find((line) => line.id === busForm.lineId);
  const selectedDriver = drivers.find((driver) => driver.id === busForm.driverId);

  function updateForm(setter) {
    return (event) => {
      setter((current) => ({
        ...current,
        [event.target.name]: event.target.value
      }));
    };
  }

  async function submitLine(event) {
    event.preventDefault();
    setLineStatus(null);

    try {
      await api.createLine(lineForm, session.token);
      setLineForm(initialLineForm);
      setLineStatus({
        type: "success",
        message: "La ligne a ete ajoutee et est disponible pour les bus."
      });
      await onRefresh();
    } catch (error) {
      setLineStatus({
        type: "error",
        message: error.message
      });
    }
  }

  async function submitBus(event) {
    event.preventDefault();
    setBusStatus(null);

    try {
      await api.createBus(busForm, session.token);
      setBusForm(initialBusForm);
      setBusStatus({
        type: "success",
        message: "Le bus a ete cree et peut maintenant remonter des positions."
      });
      await onRefresh();
    } catch (error) {
      setBusStatus({
        type: "error",
        message: error.message
      });
    }
  }

  async function submitDriver(event) {
    event.preventDefault();
    setDriverStatus(null);

    try {
      await api.createUser(driverForm, session.token);
      setDriverForm(initialDriverForm);
      setDriverStatus({
        type: "success",
        message: "Le compte chauffeur a ete cree."
      });
      await onRefresh();
    } catch (error) {
      setDriverStatus({
        type: "error",
        message: error.message
      });
    }
  }

  if (!session?.token) {
    return (
      <LoginPanel
        title="Connexion admin"
        description="L'administrateur se connecte pour gerer lignes, bus et chauffeurs."
        role="admin"
        defaultPhone="+221700000999"
        defaultPassword="demo-admin"
        onLogin={onAdminLogin}
      />
    );
  }

  return (
    <section className="panel admin-panel">
      <div className="panel__header">
        <div>
          <p className="eyebrow">Admin</p>
          <h2>Back-office exploitation</h2>
          <p className="panel__subtext">
            Connecte: {session.fullName} ({session.phone})
          </p>
        </div>
        <button type="button" className="ghost" onClick={onAdminLogout}>
          Deconnexion
        </button>
      </div>

      <div className="stats-grid">
        <StatCard label="Lignes" value={summary.totalLines ?? 0} accent="#0b6e4f" />
        <StatCard label="Bus" value={summary.totalBuses ?? 0} accent="#ff7b00" />
        <StatCard
          label="Bus actifs"
          value={summary.activeBuses ?? 0}
          accent="#1d4ed8"
        />
        <StatCard
          label="Buffers offline"
          value={summary.pendingOfflineBuffers ?? 0}
          accent="#b42318"
        />
        <StatCard
          label="Points GPS (historique)"
          value={summary.totalPositionSamples ?? 0}
          accent="#6366f1"
        />
      </div>

      <div className="admin-sections">
        <section className="admin-section">
          <SectionHeader
            title="Ajouter une ligne"
            description="Crée une nouvelle ligne exploitable côté chauffeur et visible côté usager."
            helper={`Apercu ID: ${linePreviewId}`}
          />

          <div className="admin-section__body">
            <form className="admin-form" onSubmit={submitLine}>
              <label>
                ID interne
                <input
                  name="id"
                  placeholder="Optionnel, genere automatiquement"
                  value={lineForm.id}
                  onChange={updateForm(setLineForm)}
                />
              </label>
              <label>
                Code visible
                <input
                  name="code"
                  placeholder="Ex: L5"
                  value={lineForm.code}
                  onChange={updateForm(setLineForm)}
                />
              </label>
              <label>
                Nom complet
                <input
                  name="name"
                  placeholder="Ex: Liberté 6 - Plateau"
                  value={lineForm.name}
                  onChange={updateForm(setLineForm)}
                />
              </label>
              <label>
                Couleur carte
                <div className="color-row">
                  <input
                    name="color"
                    type="color"
                    value={lineForm.color}
                    onChange={updateForm(setLineForm)}
                  />
                  <span>{lineForm.color}</span>
                </div>
              </label>
              <button type="submit" disabled={!lineForm.code.trim() || !lineForm.name.trim()}>
                Ajouter la ligne
              </button>
              <StatusBanner status={lineStatus} />
            </form>

            <aside className="admin-preview">
              <h4>Apercu</h4>
              <article className="legend-card admin-preview__card">
                <span
                  className="legend-card__dot"
                  style={{ background: lineForm.color }}
                />
                <div>
                  <strong>{lineForm.code.trim() || "Code ligne"}</strong>
                  <p>{lineForm.name.trim() || "Nom de la ligne"}</p>
                  <p>{linePreviewId}</p>
                </div>
              </article>

              <div className="mini-list">
                <h4>Lignes existantes</h4>
                {lines.map((line) => (
                  <article className="legend-card" key={line.id}>
                    <span
                      className="legend-card__dot"
                      style={{ background: line.color }}
                    />
                    <div>
                      <strong>{line.code}</strong>
                      <p>{line.name}</p>
                    </div>
                  </article>
                ))}
              </div>
            </aside>
          </div>
        </section>

        <section className="admin-section">
          <SectionHeader
            title="Ajouter un bus"
            description="Associe un bus à une ligne et à un chauffeur pour démarrer l’exploitation."
            helper={`${buses.length} bus enregistres`}
          />

          <div className="admin-section__body">
            <form className="admin-form" onSubmit={submitBus}>
              <label>
                ID du bus
                <input
                  name="id"
                  placeholder="Ex: bus-010"
                  value={busForm.id}
                  onChange={updateForm(setBusForm)}
                />
              </label>
              <label>
                Libelle
                <input
                  name="label"
                  placeholder="Ex: Tata 10"
                  value={busForm.label}
                  onChange={updateForm(setBusForm)}
                />
              </label>
              <label>
                Ligne rattachee
                <select name="lineId" value={busForm.lineId} onChange={updateForm(setBusForm)}>
                  <option value="">Choisir une ligne</option>
                  {lines.map((line) => (
                    <option key={line.id} value={line.id}>
                      {line.code} - {line.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Chauffeur assigne
                <select
                  name="driverId"
                  value={busForm.driverId}
                  onChange={updateForm(setBusForm)}
                >
                  <option value="">Choisir un chauffeur</option>
                  {drivers.map((driver) => (
                    <option key={driver.id} value={driver.id}>
                      {driver.fullName}
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="submit"
                disabled={!busForm.id.trim() || !busForm.label.trim()}
              >
                Ajouter le bus
              </button>
              <StatusBanner status={busStatus} />
            </form>

            <aside className="admin-preview">
              <h4>Apercu</h4>
              <article className="legend-card admin-preview__card">
                <div>
                  <strong>{busPreviewLabel}</strong>
                  <p>{busForm.id.trim() || "ID du bus"}</p>
                  <p>{selectedLine ? selectedLine.name : "Aucune ligne selectionnee"}</p>
                  <p>
                    {selectedDriver
                      ? `Chauffeur: ${selectedDriver.fullName}`
                      : "Aucun chauffeur assigne"}
                  </p>
                </div>
              </article>

              <div className="mini-list">
                <h4>Bus existants</h4>
                {buses.map((bus) => (
                  <article className="legend-card" key={bus.id}>
                    <div>
                      <strong>{bus.label}</strong>
                      <p>{bus.id}</p>
                      <p>{bus.lineId || "Sans ligne"}</p>
                    </div>
                  </article>
                ))}
              </div>
            </aside>
          </div>
        </section>

        <section className="admin-section">
          <SectionHeader
            title="Ajouter un chauffeur"
            description="Crée un compte de connexion pour le site chauffeur."
            helper={`${drivers.length} chauffeurs enregistres`}
          />

          <div className="admin-section__body">
            <form className="admin-form" onSubmit={submitDriver}>
              <label>
                ID interne
                <input
                  name="id"
                  placeholder="Optionnel, genere automatiquement"
                  value={driverForm.id}
                  onChange={updateForm(setDriverForm)}
                />
              </label>
              <label>
                Nom complet
                <input
                  name="fullName"
                  placeholder="Ex: Mamadou Ndiaye"
                  value={driverForm.fullName}
                  onChange={updateForm(setDriverForm)}
                />
              </label>
              <label>
                Telephone
                <input
                  name="phone"
                  placeholder="Ex: +221770001122"
                  value={driverForm.phone}
                  onChange={updateForm(setDriverForm)}
                />
              </label>
              <label>
                Mot de passe provisoire
                <input
                  name="password"
                  type="password"
                  placeholder="Minimum recommande: 8 caracteres"
                  value={driverForm.password}
                  onChange={updateForm(setDriverForm)}
                />
              </label>
              <button
                type="submit"
                disabled={
                  !driverForm.fullName.trim() ||
                  !driverForm.phone.trim() ||
                  !driverForm.password.trim()
                }
              >
                Ajouter le chauffeur
              </button>
              <StatusBanner status={driverStatus} />
            </form>

            <aside className="admin-preview">
              <h4>Apercu</h4>
              <article className="legend-card admin-preview__card">
                <div>
                  <strong>{driverForm.fullName.trim() || "Nom chauffeur"}</strong>
                  <p>{driverForm.phone.trim() || "Telephone"}</p>
                  <p>{driverForm.id.trim() || `driver-${slugify(driverForm.fullName, "nouveau")}`}</p>
                </div>
              </article>

              <div className="mini-list">
                <h4>Chauffeurs existants</h4>
                {drivers.map((driver) => (
                  <article className="legend-card" key={driver.id}>
                    <div>
                      <strong>{driver.fullName}</strong>
                      <p>{driver.phone}</p>
                    </div>
                  </article>
                ))}
              </div>
            </aside>
          </div>
        </section>
      </div>
    </section>
  );
}
