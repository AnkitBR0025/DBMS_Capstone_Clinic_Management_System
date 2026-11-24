const express = require("express");
const {
    listPrescriptions,
    getTreatmentPrescription,
    createPrescription
} = require("../controllers/prescriptionController");

const router = express.Router();

router.get("/", listPrescriptions);
router.get("/treatment/:treatmentId", getTreatmentPrescription);
router.post("/", createPrescription);

module.exports = router;
