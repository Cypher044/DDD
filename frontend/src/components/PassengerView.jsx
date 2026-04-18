export default function PassengerView({ buses, lines }) {
  return (
    <section className="panel">
      <div className="panel__header">
        <div>
          <p className="eyebrow">Usager</p>
          <h2>Bus suivis en temps reel</h2>
        </div>
      </div>

      <div className="list">
        {buses.map((bus) => {
          const line = lines.find((item) => item.id === bus.lineId);

          return (
            <article key={bus.id} className="list-item">
              <div>
                <strong>{bus.label}</strong>
                <p>{line?.name || "Ligne inconnue"}</p>
                <small className="muted">
                  Derniere mise a jour:{" "}
                  {bus.position?.recordedAt
                    ? new Date(bus.position.recordedAt).toLocaleTimeString()
                    : "aucune"}
                </small>
              </div>
              <div className="list-item__meta">
                <span className="pill">{line?.code}</span>
                <span>{bus.status}</span>
                <strong>
                  {bus.position
                    ? `${bus.position.lat.toFixed(4)}, ${bus.position.lng.toFixed(4)}`
                    : "Position indisponible"}
                </strong>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
