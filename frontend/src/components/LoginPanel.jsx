import { useState } from "react";

export default function LoginPanel({
  title,
  description,
  role,
  defaultPhone,
  defaultPassword,
  onLogin
}) {
  const [phone, setPhone] = useState(defaultPhone || "");
  const [password, setPassword] = useState(defaultPassword || "");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setLoading(true);
    setStatus("");

    try {
      await onLogin({ phone, password, role });
    } catch (error) {
      setStatus(error.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="panel">
      <div className="panel__header">
        <div>
          <p className="eyebrow">{role === "admin" ? "Admin" : "Chauffeur"}</p>
          <h2>{title}</h2>
          <p className="panel__subtext">{description}</p>
        </div>
      </div>

      <form className="driver-stack" onSubmit={submit}>
        <label>
          Telephone
          <input value={phone} onChange={(event) => setPhone(event.target.value)} />
        </label>
        <label>
          Mot de passe
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </label>
        <button type="submit" disabled={loading}>
          {loading ? "Connexion..." : "Se connecter"}
        </button>
        {status ? <p className="form-error">{status}</p> : null}
      </form>
    </section>
  );
}
