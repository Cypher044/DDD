import { Router } from "express";
import { requireAuth, requireRole } from "../middleware/authMiddleware.js";
import {
  createBus,
  createLine,
  createUser,
  listAdminUsers
} from "../services/transitStore.js";

const router = Router();

router.use(requireAuth, requireRole("admin"));

router.get("/users", async (_request, response, next) => {
  try {
    response.json(await listAdminUsers());
  } catch (error) {
    next(error);
  }
});

router.post("/lines", async (request, response, next) => {
  try {
    response.status(201).json(await createLine(request.body));
  } catch (error) {
    next(error);
  }
});

router.post("/buses", async (request, response, next) => {
  try {
    response.status(201).json(await createBus(request.body));
  } catch (error) {
    next(error);
  }
});

router.post("/users", async (request, response, next) => {
  try {
    response.status(201).json(await createUser(request.body));
  } catch (error) {
    next(error);
  }
});

export default router;
