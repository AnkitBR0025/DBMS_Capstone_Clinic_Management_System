const express = require("express");
const { authenticate, authorizeRoles } = require("../middleware/authMiddleware");
const roleController = require("../controllers/roleController");

const router = express.Router();

const doctorOnly = [authenticate, authorizeRoles("Doctor")];
router.get("/doctor/dashboard", ...doctorOnly, roleController.getDoctorDashboard);
router.get("/doctor/appointments", ...doctorOnly, roleController.getDoctorAppointments);
router.put("/doctor/appointments/:id/status", ...doctorOnly, roleController.updateDoctorAppointmentStatus);
router.put("/doctor/appointments/:id/treatment", ...doctorOnly, roleController.recordTreatment);
router.get("/doctor/availability", ...doctorOnly, roleController.getDoctorAvailability);
router.put("/doctor/availability", ...doctorOnly, roleController.setDoctorAvailability);
router.post("/doctor/blocked-slots", ...doctorOnly, roleController.blockDoctorSlot);

const patientOnly = [authenticate, authorizeRoles("Patient")];
router.get("/patient/dashboard", ...patientOnly, roleController.getPatientDashboard);
router.get("/patient/profile", ...patientOnly, roleController.getPatientDashboard);
router.get("/patient/appointments", ...patientOnly, roleController.getPatientAppointments);
router.put("/patient/appointments/:id/cancel", ...patientOnly, roleController.cancelPatientAppointment);
router.get("/patient/medical-history", ...patientOnly, roleController.getPatientMedicalHistory);
router.get("/patient/available-slots", ...patientOnly, roleController.getAvailableSlots);
router.post("/patient/appointments", ...patientOnly, roleController.bookPatientAppointment);

module.exports = router;
