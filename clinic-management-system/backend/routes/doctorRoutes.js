const express = require("express");
const router = express.Router();

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
router.put("/:id/availability", setDoctorAvailability);
router.get("/:id", getDoctorById);
router.post("/", createDoctor);
router.put("/:id", updateDoctor);
router.delete("/:id", deleteDoctor);

module.exports = router;
