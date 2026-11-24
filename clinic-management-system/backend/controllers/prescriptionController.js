const db = require("../config/db");
const asyncHandler = require("../middleware/asyncHandler");
const validDate = (value) => (
    typeof value === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    !Number.isNaN(Date.parse(`${value}T00:00:00Z`)) &&
    new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value
);

const listPrescriptions = asyncHandler(async (req, res) => {
    const conditions = [];
    const values = [];
    if (req.query.patientId) {
        conditions.push("p.patient_id = ?");
        values.push(req.query.patientId);
    }
    if (req.query.search && String(req.query.search).trim()) {
        conditions.push("(p.patient_name LIKE ? OR p.doctor_name LIKE ? OR p.medicine LIKE ?)");
        const search = `%${String(req.query.search).trim()}%`;
        values.push(search, search, search);
    }
    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
    const [prescriptions] = await db.query(`
        SELECT pr.prescription_id, pr.medicine, pr.dosage, pr.frequency,
               pr.duration, pr.instructions, pr.created_at,
               t.treatment_id, t.diagnosis, t.treatment_date, t.treatment_details,
               t.doctor_notes, t.follow_up_date,
               a.appointment_id, a.appointment_date, a.patient_id,
               pt.name AS patient_name, d.name AS doctor_name
        FROM prescriptions pr
        JOIN treatments t ON t.treatment_id = pr.treatment_id
        JOIN appointments a ON a.appointment_id = t.appointment_id
        JOIN patients pt ON pt.patient_id = a.patient_id
        JOIN doctors d ON d.doctor_id = a.doctor_id
        ${where}
        ORDER BY t.treatment_date DESC, pr.prescription_id DESC
    `, values);
    res.json({ success: true, data: prescriptions });
});

const getTreatmentPrescription = asyncHandler(async (req, res) => {
    const [prescriptions] = await db.query(
        `SELECT pr.prescription_id, pr.medicine, pr.dosage, pr.frequency,
                pr.duration, pr.instructions, pr.created_at,
                t.treatment_id, t.diagnosis, t.treatment_date, t.treatment_details,
                t.doctor_notes, t.follow_up_date, a.appointment_id, a.appointment_date,
                pt.patient_id, pt.name AS patient_name, d.name AS doctor_name
         FROM prescriptions pr
         JOIN treatments t ON t.treatment_id = pr.treatment_id
         JOIN appointments a ON a.appointment_id = t.appointment_id
         JOIN patients pt ON pt.patient_id = a.patient_id
         JOIN doctors d ON d.doctor_id = a.doctor_id
         WHERE t.treatment_id = ?
         ORDER BY pr.prescription_id`,
        [req.params.treatmentId]
    );
    if (!prescriptions.length) return res.status(404).json({ message: "Prescription not found" });
    res.json({ success: true, data: prescriptions });
});

const createPrescription = asyncHandler(async (req, res) => {
    const { appointment_id, diagnosis, treatment_details, doctor_notes, follow_up_date, medicines } = req.body;
    if (!appointment_id || !Array.isArray(medicines) || medicines.length === 0 || medicines.length > 50) {
        return res.status(400).json({ message: "A completed appointment and at least one medicine are required" });
    }
    const optionalTextFields = ["dosage", "frequency", "duration", "instructions"];
    if (medicines.some((item) =>
        !item || typeof item.medicine !== "string" || !item.medicine.trim() ||
        item.medicine.length > 100 ||
        optionalTextFields.some((field) =>
            item[field] !== undefined && item[field] !== null &&
            (typeof item[field] !== "string" || item[field].length > (field === "instructions" ? 2000 : 100))
        )
    )) {
        return res.status(400).json({ message: "Enter valid medicine and dosage details" });
    }
    if (
        (diagnosis && typeof diagnosis !== "string") ||
        (treatment_details && typeof treatment_details !== "string") ||
        (doctor_notes && typeof doctor_notes !== "string") ||
        (typeof diagnosis === "string" && diagnosis.length > 200) ||
        (typeof treatment_details === "string" && treatment_details.length > 10000) ||
        (typeof doctor_notes === "string" && doctor_notes.length > 10000)
    ) {
        return res.status(400).json({ message: "Diagnosis, treatment and notes must be text" });
    }
    if (follow_up_date && !validDate(follow_up_date)) {
        return res.status(400).json({ message: "Enter a valid follow-up date" });
    }

    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();
        const [appointments] = await connection.query(
            "SELECT status FROM appointments WHERE appointment_id = ? FOR UPDATE",
            [appointment_id]
        );
        if (!appointments.length) {
            await connection.rollback();
            return res.status(404).json({ message: "Appointment not found" });
        }
        if (appointments[0].status !== "Completed") {
            await connection.rollback();
            return res.status(409).json({ message: "Prescriptions can only be added to completed appointments" });
        }
        const [treatment] = await connection.query(
            `INSERT INTO treatments
             (appointment_id, diagnosis, treatment_date, treatment_details, doctor_notes, follow_up_date)
             VALUES (?, ?, CURDATE(), ?, ?, ?)`,
            [
                appointment_id,
                diagnosis?.trim() || null,
                treatment_details?.trim() || null,
                doctor_notes?.trim() || null,
                follow_up_date || null
            ]
        );
        for (const medicine of medicines) {
            await connection.query(
                `INSERT INTO prescriptions
                 (treatment_id, medicine, dosage, frequency, duration, instructions)
                 VALUES (?, ?, ?, ?, ?, ?)`,
                [
                    treatment.insertId,
                    medicine.medicine.trim(),
                    medicine.dosage?.trim() || null,
                    medicine.frequency?.trim() || null,
                    medicine.duration?.trim() || null,
                    medicine.instructions?.trim() || null
                ]
            );
        }
        await connection.commit();
        res.status(201).json({
            success: true,
            message: "Medical record and prescription saved",
            treatmentId: treatment.insertId
        });
    } catch (error) {
        await connection.rollback();
        throw error;
    } finally {
        connection.release();
    }
});

module.exports = { listPrescriptions, getTreatmentPrescription, createPrescription };
