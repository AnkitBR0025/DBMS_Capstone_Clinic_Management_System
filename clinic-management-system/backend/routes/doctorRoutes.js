const express = require("express");
const router = express.Router();
const { authenticate, authorizeRoles } = require("../middleware/authMiddleware");

const {
    getDoctors,
    getDoctorById,
    getDoctorAvailability,
    setDoctorAvailability,
    createDoctor,
    updateDoctor,
    deleteDoctor
} = require("../controllers/doctorController");

router.get("/", getDoctors);
router.get("/:id/availability", getDoctorAvailability);
router.put("/:id/availability", authenticate, authorizeRoles("Admin"), setDoctorAvailability);
router.get("/:id", getDoctorById);
router.post("/", authenticate, authorizeRoles("Admin"), createDoctor);
router.put("/:id", authenticate, authorizeRoles("Admin"), updateDoctor);
router.delete("/:id", authenticate, authorizeRoles("Admin"), deleteDoctor);

module.exports = router;
