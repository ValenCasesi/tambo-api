import { Router } from "express";
import { createUserHandler } from "../controller/user.controller.js";
const router = Router();
router.post("/", createUserHandler);
export default router;
