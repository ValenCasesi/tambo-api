import { Router } from "express";
import { createUserHandler, updateUserHandler, getAllUsersHandler, deleteUserHandler } from "../controller/user.controller.js";
import { upload } from "../middlewares/upload.middleware.js";
const router = Router();
router.get("/", getAllUsersHandler);
router.post("/", upload.single("image"), createUserHandler);
router.put("/:id", upload.single("image"), updateUserHandler);
router.delete("/:id", deleteUserHandler);
export default router;
