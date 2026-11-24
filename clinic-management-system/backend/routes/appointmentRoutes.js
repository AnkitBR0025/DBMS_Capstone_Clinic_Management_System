const express = require("express");
const router = express.Router();

const {
    getAppointments,
    getAppointmentAvailability,
    getAppointmentById,
    createAppointment,
    updateAppointment,
    deleteAppointment
} = require("../controllers/appointmentController");

router.get("/", getAppointments);
router.get("/availability", getAppointmentAvailability);
router.get("/:id", getAppointmentById);
router.post("/", createAppointment);
router.put("/:id", updateAppointment);
router.delete("/:id", deleteAppointment);

module.exports = router;