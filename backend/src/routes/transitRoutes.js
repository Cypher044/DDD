import { Router } from "express";
import { requireAuth, requireRole } from "../middleware/authMiddleware.js";
import {
  flushOfflinePositions,
  getDashboardSummary,
  listBuses,
  listDriverBuses,
  listLines,
  queueOfflinePosition,
  updateBusPosition
} from "../services/transitStore.js";

export function createTransitRouter(app) {
  const router = Router();

  function getIo() {
    return app.get("io");
  }

  router.get("/lines", async (_request, response, next) => {
    try {
      response.json(await listLines());
    } catch (error) {
      next(error);
    }
  });

  router.get("/buses", async (_request, response, next) => {
    try {
      response.json(await listBuses());
    } catch (error) {
      next(error);
    }
  });

  router.get(
    "/driver/my-buses",
    requireAuth,
    requireRole("driver", "admin"),
    async (request, response, next) => {
      try {
        response.json(await listDriverBuses(request.user.sub));
      } catch (error) {
        next(error);
      }
    }
  );

  router.get(
    "/admin/summary",
    requireAuth,
    requireRole("admin"),
    async (_request, response, next) => {
    try {
      response.json(await getDashboardSummary());
    } catch (error) {
      next(error);
    }
    }
  );

  router.post(
    "/driver/location",
    requireAuth,
    requireRole("driver", "admin"),
    async (request, response, next) => {
      try {
        const { busId, lineId } = request.body;

        if (!busId || !lineId) {
          return response.status(400).json({
            message: "busId et lineId sont requis."
          });
        }

        const nextPosition = await updateBusPosition({
          ...request.body,
          driverId: request.user.sub
        });
        getIo()?.emit("bus:position", nextPosition);

        return response.status(201).json(nextPosition);
      } catch (error) {
        return next(error);
      }
    }
  );

  router.post(
    "/driver/location/offline",
    requireAuth,
    requireRole("driver", "admin"),
    async (request, response, next) => {
      try {
        const { busId, lineId } = request.body;

        if (!busId || !lineId) {
          return response.status(400).json({
            message: "busId et lineId sont requis."
          });
        }

        return response.status(202).json(
          await queueOfflinePosition(busId, {
            ...request.body,
            driverId: request.user.sub
          })
        );
      } catch (error) {
        return next(error);
      }
    }
  );

  router.post(
    "/driver/location/flush",
    requireAuth,
    requireRole("driver", "admin"),
    async (request, response, next) => {
      try {
        const { busId } = request.body;

        if (!busId) {
          return response.status(400).json({
            message: "busId est requis."
          });
        }

        const result = await flushOfflinePositions(busId);
        getIo()?.emit("bus:refresh", { busId });

        return response.json(result);
      } catch (error) {
        return next(error);
      }
    }
  );

  return router;
}
