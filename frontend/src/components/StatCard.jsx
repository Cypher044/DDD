export default function StatCard({ label, value, accent }) {
  return (
    <article className="stat-card">
      <span className="stat-card__accent" style={{ background: accent }} />
      <p className="stat-card__label">{label}</p>
      <strong className="stat-card__value">{value}</strong>
    </article>
  );
}

