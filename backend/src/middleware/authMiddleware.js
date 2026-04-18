import jwt from "jsonwebtoken";
import { env } from "../config/env.js";

export function requireAuth(request, response, next) {
  const authorization = request.headers.authorization || "";
  const token = authorization.startsWith("Bearer ")
    ? authorization.slice(7)
    : null;

  if (!token) {
    return response.status(401).json({
      message: "Authentification requise."
    });
  }

  try {
    request.user = jwt.verify(token, env.jwtSecret);
    return next();
  } catch {
    return response.status(401).json({
      message: "Session invalide ou expiree."
    });
  }
}

export function requireRole(...roles) {
  return (request, response, next) => {
    if (!request.user || !roles.includes(request.user.role)) {
      return response.status(403).json({
        message: "Acces non autorise."
      });
    }

    return next();
  };
}
