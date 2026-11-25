const express = require("express");
const rateLimit = require("express-rate-limit");
const { login, getCurrentUser, registerPatient } = require("../controllers/authController");
const { authenticate, authorizeRoles } = require("../middleware/authMiddleware");

const router = express.Router();

router.post("/login", rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 10,
    standardHeaders: true,
    legacyHeaders: false
}), login);
router.get("/me", authenticate, getCurrentUser);
router.post("/register-patient", registerPatient);

module.exports = router;
