import { Router } from "express";

const router = Router();

router.get("/", (_request, response) => {
  response.json({
    ok: true,
    service: "sunu-bus-backend",
    timestamp: new Date().toISOString()
  });
});

export default router;

