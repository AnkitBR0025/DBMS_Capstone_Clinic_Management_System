const express = require("express");
const rateLimit = require("express-rate-limit");
const { login, getCurrentUser } = require("../controllers/authController");
const { authenticate, authorizeRoles } = require("../middleware/authMiddleware");

const router = express.Router();

router.post("/login", rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 10,
    standardHeaders: true,
    legacyHeaders: false
}), login);
router.get("/me", authenticate, authorizeRoles("Admin"), getCurrentUser);

module.exports = router;
