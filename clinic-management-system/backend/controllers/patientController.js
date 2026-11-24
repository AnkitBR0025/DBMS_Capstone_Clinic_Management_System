const db = require("../config/db");
const asyncHandler = require("../middleware/asyncHandler");

const validatePatient = (patient) => {
    const errors = [];
    if (typeof patient.name !== "string" || !patient.name.trim()) {
        errors.push("Patient name is required");
    } else if (patient.name.trim().length > 100) {
        errors.push("Patient name must be 100 characters or fewer");
    }

    if (patient.age !== undefined && patient.age !== "" && patient.age !== null) {
        const age = Number(patient.age);
        if (!Number.isInteger(age) || age < 0 || age > 130) errors.push("Enter a valid age");
    }

    if (patient.gender && !["Male", "Female", "Other"].includes(patient.gender)) {
        errors.push("Select a valid gender");
    }

    if (patient.email && (
        typeof patient.email !== "string" ||
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(patient.email) ||
        patient.email.length > 254
    )) {
        errors.push("Enter a valid email address");
    }

    for (const [field, label, maxLength] of [
        ["contact", "Contact number", 15],
        ["emergency_contact", "Emergency contact", 20],
        ["blood_group", "Blood group", 3],
        ["address", "Address", 255]
    ]) {
        if (patient[field] && String(patient[field]).length > maxLength) {
            errors.push(`${label} must be ${maxLength} characters or fewer`);
        }
    }

    if (patient.blood_group && !["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"].includes(patient.blood_group)) {
        errors.push("Select a valid blood group");
    }
    return errors;
};

const patientValues = (patient) => [
    patient.name.trim(),
    patient.age || null,
    patient.gender || null,
    patient.contact || null,
    patient.address || null,
    patient.email?.trim().toLowerCase() || null,
    patient.blood_group || null,
    patient.emergency_contact || null
];

const getPatients = asyncHandler(async (req, res) => {
    const { search } = req.query;

    let sql = "SELECT * FROM patients";
    let values = [];

    if (search) {
        const numericId = /^\d+$/.test(search) ? Number(search) : null;
        sql += " WHERE name LIKE ? OR contact LIKE ? OR patient_id = ?";
        values.push(`%${search}%`, `%${search}%`, numericId);
    }

    sql += " ORDER BY patient_id DESC";

    const [patients] = await db.query(sql, values);

    res.json({
        success: true,
        count: patients.length,
        data: patients
    });
});

// GET patient by ID
const getPatientById = asyncHandler(async (req, res) => {
    const [patients] = await db.query(
        "SELECT * FROM patients WHERE patient_id = ?",
        [req.params.id]
    );

    if (patients.length === 0) {
        return res.status(404).json({ message: "Patient not found" });
    }

    res.json({ success: true, data: patients[0] });
});

const getPatientMedicalHistory = asyncHandler(async (req, res) => {
    const [patients] = await db.query(
        "SELECT * FROM patients WHERE patient_id = ?",
        [req.params.id]
    );
    if (!patients.length) return res.status(404).json({ message: "Patient not found" });

    const [appointments] = await db.query(
        `SELECT a.appointment_id, a.appointment_date, a.appointment_time, a.status,
                d.doctor_id, d.name AS doctor_name, d.specialization,
                i.invoice_id, i.total_amount, i.amount_paid, i.payment_status
         FROM appointments a
         JOIN doctors d ON d.doctor_id = a.doctor_id
         LEFT JOIN invoices i ON i.appointment_id = a.appointment_id
         WHERE a.patient_id = ?
         ORDER BY a.appointment_id DESC`,
        [req.params.id]
    );
    const [medicalRecords] = await db.query(
        `SELECT t.treatment_id, t.appointment_id, t.diagnosis, t.treatment_date,
                t.treatment_details, t.doctor_notes, t.follow_up_date,
                d.name AS doctor_name
         FROM treatments t
         JOIN appointments a ON a.appointment_id = t.appointment_id
         JOIN doctors d ON d.doctor_id = a.doctor_id
         WHERE a.patient_id = ?
         ORDER BY t.treatment_date DESC, t.treatment_id DESC`,
        [req.params.id]
    );
    const [prescriptions] = await db.query(
        `SELECT p.prescription_id, p.treatment_id, p.medicine, p.dosage,
                p.frequency, p.duration, p.instructions, p.created_at,
                t.diagnosis, t.treatment_date, a.appointment_id
         FROM prescriptions p
         JOIN treatments t ON t.treatment_id = p.treatment_id
         JOIN appointments a ON a.appointment_id = t.appointment_id
         WHERE a.patient_id = ?
         ORDER BY t.treatment_date DESC, p.prescription_id DESC`,
        [req.params.id]
    );
    const [payments] = await db.query(
        `SELECT i.invoice_id, i.appointment_id, i.total_amount, i.amount_paid,
                i.payment_status, t.transaction_id, t.amount, t.payment_method, t.paid_at
         FROM invoices i
         JOIN appointments a ON a.appointment_id = i.appointment_id
         LEFT JOIN payment_transactions t ON t.invoice_id = i.invoice_id
         WHERE a.patient_id = ?
         ORDER BY i.created_at DESC, t.paid_at DESC`,
        [req.params.id]
    );

    res.json({
        success: true,
        data: { patient: patients[0], appointments, medicalRecords, prescriptions, payments }
    });
});

// ADD patient
const createPatient = asyncHandler(async (req, res) => {
    const errors = validatePatient(req.body);
    if (errors.length) {
        return res.status(400).json({ message: errors.join(". ") });
    }

    const [result] = await db.query(
        `INSERT INTO patients
         (name, age, gender, contact, address, email, blood_group, emergency_contact)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        patientValues(req.body)
    );

    res.status(201).json({
        success: true,
        message: "Patient added successfully",
        patientId: result.insertId
    });
});

// UPDATE patient
const updatePatient = asyncHandler(async (req, res) => {
    const errors = validatePatient(req.body);
    if (errors.length) {
        return res.status(400).json({ message: errors.join(". ") });
    }

    const [result] = await db.query(
        `UPDATE patients
         SET name = ?, age = ?, gender = ?, contact = ?, address = ?,
             email = ?, blood_group = ?, emergency_contact = ?
         WHERE patient_id = ?`,
        [...patientValues(req.body), req.params.id]
    );

    if (result.affectedRows === 0) {
        return res.status(404).json({ message: "Patient not found" });
    }

    res.json({ success: true, message: "Patient updated successfully" });
});

// DELETE patient
const deletePatient = asyncHandler(async (req, res) => {
    const [result] = await db.query(
        "DELETE FROM patients WHERE patient_id = ?",
        [req.params.id]
    );

    if (result.affectedRows === 0) {
        return res.status(404).json({ message: "Patient not found" });
    }

    res.json({ success: true, message: "Patient deleted successfully" });
});

module.exports = {
    getPatients,
    getPatientById,
    getPatientMedicalHistory,
    createPatient,
    updatePatient,
    deletePatient
};
