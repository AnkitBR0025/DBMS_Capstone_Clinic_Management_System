const db = require("../config/db");
const asyncHandler = require("../middleware/asyncHandler");

const validDate = (value) => typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
const validTime = (value) => typeof value === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(value);

const getDoctorDashboard = asyncHandler(async (req, res) => {
    if (!req.user.doctorId) return res.status(403).json({ message: "Doctor profile is not linked to this account" });
    const doctorId = req.user.doctorId;
    const [[total], [today], [upcoming], [completed], [cancelled], [appointments]] = await Promise.all([
        db.query("SELECT COUNT(*) AS total FROM appointments WHERE doctor_id = ?", [doctorId]),
        db.query("SELECT COUNT(*) AS total FROM appointments WHERE doctor_id = ? AND appointment_date = CURDATE()", [doctorId]),
        db.query("SELECT COUNT(*) AS total FROM appointments WHERE doctor_id = ? AND status = 'Scheduled' AND appointment_date >= CURDATE()", [doctorId]),
        db.query("SELECT COUNT(*) AS total FROM appointments WHERE doctor_id = ? AND status = 'Completed'", [doctorId]),
        db.query("SELECT COUNT(*) AS total FROM appointments WHERE doctor_id = ? AND status = 'Cancelled'", [doctorId]),
        db.query(`SELECT a.appointment_id, a.appointment_date, a.appointment_time, a.status,
                         p.patient_id, p.name AS patient_name, p.contact AS patient_contact, p.age
                  FROM appointments a JOIN patients p ON p.patient_id = a.patient_id
                  WHERE a.doctor_id = ? ORDER BY a.appointment_date DESC, a.appointment_time DESC LIMIT 20`,
            [doctorId])
    ]);
    res.json({
        success: true,
        data: {
            totalAppointments: total[0].total,
            todayAppointments: today[0].total,
            upcomingAppointments: upcoming[0].total,
            completedAppointments: completed[0].total,
            cancelledAppointments: cancelled[0].total,
            appointments
        }
    });
});

const getDoctorAppointments = asyncHandler(async (req, res) => {
    if (!req.user.doctorId) return res.status(403).json({ message: "Doctor profile is not linked to this account" });
    const [appointments] = await db.query(
        `SELECT a.appointment_id, a.patient_id, a.appointment_date, a.appointment_time, a.status,
                a.reason_for_visit, p.name AS patient_name, p.age, p.gender,
                p.contact AS patient_contact, p.address, p.email AS patient_email
         FROM appointments a JOIN patients p ON p.patient_id = a.patient_id
         WHERE a.doctor_id = ? ORDER BY a.appointment_date DESC, a.appointment_time DESC`,
        [req.user.doctorId]
    );
    res.json({ success: true, data: appointments });
});

const updateDoctorAppointmentStatus = asyncHandler(async (req, res) => {
    const status = req.body.status;
    if (!["Scheduled", "Completed", "Cancelled"].includes(status)) {
        return res.status(400).json({ message: "Invalid appointment status" });
    }
    const [result] = await db.query(
        "UPDATE appointments SET status = ? WHERE appointment_id = ? AND doctor_id = ?",
        [status, req.params.id, req.user.doctorId]
    );
    if (!result.affectedRows) return res.status(404).json({ message: "Appointment not found" });
    res.json({ success: true, message: "Appointment status updated" });
});

const recordTreatment = asyncHandler(async (req, res) => {
    const { diagnosis, treatment_details, doctor_notes, follow_up_date } = req.body;
    const [appointments] = await db.query(
        "SELECT appointment_id FROM appointments WHERE appointment_id = ? AND doctor_id = ? LIMIT 1",
        [req.params.id, req.user.doctorId]
    );
    if (!appointments.length) return res.status(404).json({ message: "Appointment not found" });

    const [existing] = await db.query(
        "SELECT treatment_id FROM treatments WHERE appointment_id = ? LIMIT 1",
        [req.params.id]
    );
    if (existing.length) {
        await db.query(
            `UPDATE treatments SET diagnosis = ?, treatment_details = ?, doctor_notes = ?,
             follow_up_date = ?, treatment_date = CURDATE() WHERE treatment_id = ?`,
            [diagnosis || null, treatment_details || null, doctor_notes || null, follow_up_date || null, existing[0].treatment_id]
        );
    } else {
        await db.query(
            `INSERT INTO treatments
             (appointment_id, diagnosis, treatment_details, doctor_notes, treatment_date, follow_up_date)
             VALUES (?, ?, ?, ?, CURDATE(), ?)`,
            [req.params.id, diagnosis || null, treatment_details || null, doctor_notes || null, follow_up_date || null]
        );
    }
    res.json({ success: true, message: "Diagnosis and treatment details saved" });
});

const getDoctorAvailability = asyncHandler(async (req, res) => {
    const [availability] = await db.query(
        `SELECT * FROM doctor_availability WHERE doctor_id = ?
         ORDER BY day_of_week, start_time`,
        [req.user.doctorId]
    );
    const [blockedSlots] = await db.query(
        `SELECT * FROM doctor_blocked_slots WHERE doctor_id = ? AND blocked_date >= CURDATE()
         ORDER BY blocked_date, start_time`,
        [req.user.doctorId]
    );
    res.json({ success: true, data: { availability, blockedSlots } });
});

const setDoctorAvailability = asyncHandler(async (req, res) => {
    if (!Array.isArray(req.body.availability)) {
        return res.status(400).json({ message: "Availability must be an array" });
    }
    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();
        await connection.query("DELETE FROM doctor_availability WHERE doctor_id = ?", [req.user.doctorId]);
        for (const item of req.body.availability) {
            const day = Number(item.day_of_week);
            const slot = Number(item.slot_minutes);
            if (!Number.isInteger(day) || day < 0 || day > 6 ||
                !validTime(item.start_time) || !validTime(item.end_time) ||
                item.start_time >= item.end_time || ![15, 20, 30, 60].includes(slot)) {
                await connection.rollback();
                return res.status(400).json({ message: "Enter valid schedule days, times and slot lengths" });
            }
            await connection.query(
                `INSERT INTO doctor_availability
                 (doctor_id, day_of_week, start_time, end_time, slot_minutes, is_available)
                 VALUES (?, ?, ?, ?, ?, TRUE)`,
                [req.user.doctorId, day, `${item.start_time}:00`, `${item.end_time}:00`, slot]
            );
        }
        await connection.commit();
        res.json({ success: true, message: "Availability updated" });
    } catch (error) {
        await connection.rollback();
        throw error;
    } finally {
        connection.release();
    }
});

const blockDoctorSlot = asyncHandler(async (req, res) => {
    const { blocked_date, start_time, end_time, reason } = req.body;
    if (!validDate(blocked_date) || !validTime(start_time) || !validTime(end_time) || start_time >= end_time) {
        return res.status(400).json({ message: "Enter a valid blocked date and time range" });
    }
    await db.query(
        `INSERT INTO doctor_blocked_slots
         (doctor_id, blocked_date, start_time, end_time, reason)
         VALUES (?, ?, ?, ?, ?)`,
        [req.user.doctorId, blocked_date, `${start_time}:00`, `${end_time}:00`, reason || null]
    );
    res.status(201).json({ success: true, message: "Time slot blocked" });
});

const getPatientDashboard = asyncHandler(async (req, res) => {
    if (!req.user.patientId) return res.status(403).json({ message: "Patient profile is not linked to this account" });
    const patientId = req.user.patientId;
    const [[profile], [total], [upcoming], [completed], [cancelled], [next]] = await Promise.all([
        db.query("SELECT * FROM patients WHERE patient_id = ?", [patientId]),
        db.query("SELECT COUNT(*) AS total FROM appointments WHERE patient_id = ?", [patientId]),
        db.query("SELECT COUNT(*) AS total FROM appointments WHERE patient_id = ? AND status = 'Scheduled' AND appointment_date >= CURDATE()", [patientId]),
        db.query("SELECT COUNT(*) AS total FROM appointments WHERE patient_id = ? AND status = 'Completed'", [patientId]),
        db.query("SELECT COUNT(*) AS total FROM appointments WHERE patient_id = ? AND status = 'Cancelled'", [patientId]),
        db.query(`SELECT a.appointment_id, a.appointment_date, a.appointment_time, a.status,
                         d.name AS doctor_name, d.specialization
                  FROM appointments a JOIN doctors d ON d.doctor_id = a.doctor_id
                  WHERE a.patient_id = ? AND a.status = 'Scheduled' AND
                        (a.appointment_date > CURDATE() OR
                         (a.appointment_date = CURDATE() AND a.appointment_time >= CURTIME()))
                  ORDER BY a.appointment_date, a.appointment_time LIMIT 1`, [patientId])
    ]);
    res.json({
        success: true,
        data: {
            patient: profile[0],
            totalAppointments: total[0].total,
            upcomingAppointments: upcoming[0].total,
            completedAppointments: completed[0].total,
            cancelledAppointments: cancelled[0].total,
            nextAppointment: next[0] || null
        }
    });
});

const getPatientAppointments = asyncHandler(async (req, res) => {
    const [appointments] = await db.query(
        `SELECT a.*, d.name AS doctor_name, d.specialization, d.contact AS doctor_contact,
                d.consultation_fee
         FROM appointments a JOIN doctors d ON d.doctor_id = a.doctor_id
         WHERE a.patient_id = ? ORDER BY a.appointment_date DESC, a.appointment_time DESC`,
        [req.user.patientId]
    );
    res.json({ success: true, data: appointments });
});

const getAvailableSlots = asyncHandler(async (req, res) => {
    const { doctorId, date } = req.query;
    if (!doctorId || !validDate(date)) return res.status(400).json({ message: "Doctor and date are required" });
    const [doctorRows] = await db.query(
        "SELECT doctor_id FROM doctors WHERE doctor_id = ? AND is_active = TRUE LIMIT 1",
        [doctorId]
    );
    if (!doctorRows.length) return res.status(404).json({ message: "Doctor not found or inactive" });
    const [schedules] = await db.query(
        `SELECT start_time, end_time, slot_minutes FROM doctor_availability
         WHERE doctor_id = ? AND day_of_week = DAYOFWEEK(?) - 1 AND is_available = TRUE`,
        [doctorId, date]
    );
    const [blocked] = await db.query(
        `SELECT start_time, end_time FROM doctor_blocked_slots
         WHERE doctor_id = ? AND blocked_date = ?`,
        [doctorId, date]
    );
    const [booked] = await db.query(
        `SELECT appointment_time FROM appointments
         WHERE doctor_id = ? AND appointment_date = ? AND status <> 'Cancelled'`,
        [doctorId, date]
    );
    const bookedTimes = new Set(booked.map((row) => String(row.appointment_time).slice(0, 5)));
    const slots = [];
    for (const schedule of schedules) {
        let start = String(schedule.start_time).slice(0, 5);
        let end = String(schedule.end_time).slice(0, 5);
        const [sh, sm] = start.split(":").map(Number);
        const [eh, em] = end.split(":").map(Number);
        for (let minute = sh * 60 + sm; minute + Number(schedule.slot_minutes) <= eh * 60 + em; minute += Number(schedule.slot_minutes)) {
            const time = `${String(Math.floor(minute / 60)).padStart(2, "0")}:${String(minute % 60).padStart(2, "0")}`;
            const overlapsBlock = blocked.some((row) =>
                time >= String(row.start_time).slice(0, 5) &&
                time < String(row.end_time).slice(0, 5)
            );
            if (!bookedTimes.has(time) && !overlapsBlock) slots.push(time);
        }
    }
    res.json({ success: true, data: [...new Set(slots)].sort() });
});

const bookPatientAppointment = asyncHandler(async (req, res) => {
    const { doctor_id, appointment_date, appointment_time, reason_for_visit } = req.body;
    if (!doctor_id || !validDate(appointment_date) || !validTime(appointment_time)) {
        return res.status(400).json({ message: "Doctor, valid date and time are required" });
    }
    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();
        const [doctors] = await connection.query(
            "SELECT doctor_id, consultation_fee FROM doctors WHERE doctor_id = ? AND is_active = TRUE FOR UPDATE",
            [doctor_id]
        );
        if (!doctors.length) {
            await connection.rollback();
            return res.status(404).json({ message: "Doctor not found or inactive" });
        }
        const [schedule] = await connection.query(
            `SELECT availability_id FROM doctor_availability
             WHERE doctor_id = ? AND day_of_week = DAYOFWEEK(?) - 1 AND is_available = TRUE
               AND start_time <= ? AND ADDTIME(?, SEC_TO_TIME(slot_minutes * 60)) <= end_time
               AND MOD(TIME_TO_SEC(TIMEDIFF(?, start_time)), slot_minutes * 60) = 0 LIMIT 1`,
            [doctor_id, appointment_date, `${appointment_time}:00`, `${appointment_time}:00`, `${appointment_time}:00`]
        );
        if (!schedule.length) {
            await connection.rollback();
            return res.status(409).json({ message: "The selected time is outside the doctor's schedule" });
        }
        const [blocked] = await connection.query(
            `SELECT block_id FROM doctor_blocked_slots
             WHERE doctor_id = ? AND blocked_date = ? AND start_time <= ? AND end_time > ? LIMIT 1`,
            [doctor_id, appointment_date, `${appointment_time}:00`, `${appointment_time}:00`]
        );
        if (blocked.length) {
            await connection.rollback();
            return res.status(409).json({ message: "This time slot is blocked" });
        }
        const [conflicts] = await connection.query(
            `SELECT appointment_id FROM appointments
             WHERE doctor_id = ? AND appointment_date = ? AND appointment_time = ? AND status <> 'Cancelled'
             LIMIT 1 FOR UPDATE`,
            [doctor_id, appointment_date, `${appointment_time}:00`]
        );
        if (conflicts.length) {
            await connection.rollback();
            return res.status(409).json({ message: "This time slot is already booked" });
        }
        const [patientConflicts] = await connection.query(
            `SELECT appointment_id FROM appointments
             WHERE patient_id = ? AND appointment_date = ? AND appointment_time = ? AND status <> 'Cancelled'
             LIMIT 1 FOR UPDATE`,
            [req.user.patientId, appointment_date, `${appointment_time}:00`]
        );
        if (patientConflicts.length) {
            await connection.rollback();
            return res.status(409).json({ message: "You already have an appointment at this time" });
        }
        const [appointment] = await connection.query(
            `INSERT INTO appointments
             (patient_id, doctor_id, appointment_date, appointment_time, status, reason_for_visit)
             VALUES (?, ?, ?, ?, 'Scheduled', ?)`,
            [req.user.patientId, doctor_id, appointment_date, `${appointment_time}:00`, reason_for_visit || null]
        );
        await connection.query(
            `INSERT INTO invoices
             (appointment_id, consultation_fee, additional_charges, total_amount, amount_paid, payment_status)
             VALUES (?, ?, 0, ?, 0, ?)`,
            [
                appointment.insertId,
                doctors[0].consultation_fee,
                doctors[0].consultation_fee,
                Number(doctors[0].consultation_fee) === 0 ? "Paid" : "Pending"
            ]
        );
        await connection.commit();
        res.status(201).json({ success: true, message: "Appointment booked successfully", appointmentId: appointment.insertId });
    } catch (error) {
        await connection.rollback();
        throw error;
    } finally {
        connection.release();
    }
});

const cancelPatientAppointment = asyncHandler(async (req, res) => {
    const [result] = await db.query(
        "UPDATE appointments SET status = 'Cancelled' WHERE appointment_id = ? AND patient_id = ?",
        [req.params.id, req.user.patientId]
    );
    if (!result.affectedRows) return res.status(404).json({ message: "Appointment not found" });
    res.json({ success: true, message: "Appointment cancelled" });
});

const getPatientMedicalHistory = asyncHandler(async (req, res) => {
    const [appointments] = await db.query(
        `SELECT a.appointment_id, a.appointment_date, a.appointment_time, a.status,
                d.name AS doctor_name, d.specialization
         FROM appointments a JOIN doctors d ON d.doctor_id = a.doctor_id
         WHERE a.patient_id = ? ORDER BY a.appointment_date DESC`,
        [req.user.patientId]
    );
    const [medicalRecords] = await db.query(
        `SELECT t.* FROM treatments t JOIN appointments a ON a.appointment_id = t.appointment_id
         WHERE a.patient_id = ? ORDER BY t.treatment_date DESC`,
        [req.user.patientId]
    );
    const [prescriptions] = await db.query(
        `SELECT p.* FROM prescriptions p JOIN treatments t ON t.treatment_id = p.treatment_id
         JOIN appointments a ON a.appointment_id = t.appointment_id
         WHERE a.patient_id = ? ORDER BY p.prescription_id DESC`,
        [req.user.patientId]
    );
    const [payments] = await db.query(
        `SELECT i.*, t.transaction_id, t.amount, t.payment_method, t.paid_at
         FROM invoices i JOIN appointments a ON a.appointment_id = i.appointment_id
         LEFT JOIN payment_transactions t ON t.invoice_id = i.invoice_id
         WHERE a.patient_id = ?`,
        [req.user.patientId]
    );
    res.json({ success: true, data: { appointments, medicalRecords, prescriptions, payments } });
});

module.exports = {
    getDoctorDashboard,
    getDoctorAppointments,
    updateDoctorAppointmentStatus,
    recordTreatment,
    getDoctorAvailability,
    setDoctorAvailability,
    blockDoctorSlot,
    getPatientDashboard,
    getPatientAppointments,
    getAvailableSlots,
    bookPatientAppointment,
    cancelPatientAppointment,
    getPatientMedicalHistory
};
