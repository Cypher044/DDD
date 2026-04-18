export default function ViewSwitcher({ currentView, onChange }) {
  const views = [
    { id: "passenger", label: "Site usager" },
    { id: "driver", label: "Site chauffeur" },
    { id: "admin", label: "Admin" }
  ];

  return (
    <div className="view-switcher">
      {views.map((view) => (
        <button
          key={view.id}
          type="button"
          className={currentView === view.id ? "active" : ""}
          onClick={() => onChange(view.id)}
        >
          {view.label}
        </button>
      ))}
    </div>
  );
}
