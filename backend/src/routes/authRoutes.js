import { Router } from "express";
import { requireAuth } from "../middleware/authMiddleware.js";
import { authenticate } from "../services/transitStore.js";

const router = Router();

router.post("/login", async (request, response, next) => {
  try {
    const result = await authenticate(request.body);

    if (!result) {
      return response.status(401).json({
        message: "Identifiants invalides."
      });
    }

    return response.json(result);
  } catch (error) {
    return next(error);
  }
});

router.get("/me", requireAuth, (request, response) => {
  response.json(request.user);
});

export default router;
