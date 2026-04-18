const API_URL = import.meta.env.VITE_API_URL || "http://localhost:4000";

function buildHeaders(token, extraHeaders = {}) {
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...extraHeaders
  };
}

async function readJson(path, options = {}) {
  const response = await fetch(`${API_URL}${path}`, {
    headers: buildHeaders(options.token, options.headers),
    ...options
  });

  if (!response.ok) {
    const message = await response
      .json()
      .then((data) => data.message)
      .catch(() => `Erreur API sur ${path}`);
    throw new Error(message || `Erreur API sur ${path}`);
  }

  return response.json();
}

export const api = {
  login(payload) {
    return readJson("/auth/login", {
      method: "POST",
      body: JSON.stringify(payload)
    });
  },
  getMe(token) {
    return readJson("/auth/me", {
      token
    });
  },
  getLines() {
    return readJson("/api/lines");
  },
  getBuses() {
    return readJson("/api/buses");
  },
  getDriverBuses(token) {
    return readJson("/api/driver/my-buses", {
      token
    });
  },
  getAdminSummary(token) {
    return readJson("/api/admin/summary", {
      token
    });
  },
  getAdminUsers(token) {
    return readJson("/admin/users", {
      token
    });
  },
  createLine(payload, token) {
    return readJson("/admin/lines", {
      method: "POST",
      token,
      body: JSON.stringify(payload)
    });
  },
  createBus(payload, token) {
    return readJson("/admin/buses", {
      method: "POST",
      token,
      body: JSON.stringify(payload)
    });
  },
  createUser(payload, token) {
    return readJson("/admin/users", {
      method: "POST",
      token,
      body: JSON.stringify(payload)
    });
  },
  sendDriverLocation(payload, token) {
    return readJson("/api/driver/location", {
      method: "POST",
      token,
      body: JSON.stringify(payload)
    });
  },
  queueOfflineLocation(payload, token) {
    return readJson("/api/driver/location/offline", {
      method: "POST",
      token,
      body: JSON.stringify(payload)
    });
  },
  flushOfflineLocation(busId, token) {
    return readJson("/api/driver/location/flush", {
      method: "POST",
      token,
      body: JSON.stringify({ busId })
    });
  }
};

export { API_URL };
