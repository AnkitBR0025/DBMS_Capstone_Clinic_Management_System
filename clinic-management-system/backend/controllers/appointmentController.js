const db = require("../config/db");
const asyncHandler = require("../middleware/asyncHandler");
const paymentMethods = require("../constants/paymentMethods");

const allowedStatuses = ["Scheduled", "Completed", "Cancelled"];
const validDate = (value) => (
    typeof value === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    !Number.isNaN(Date.parse(`${value}T00:00:00Z`)) &&
    new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value
);
const validTime = (value) => typeof value === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(value);

const getAppointments = asyncHandler(async (req, res) => {
    const { date, from, to, patientId, doctorId, status, search } = req.query;
    const conditions = [];
    const values = [];

    if (date && !validDate(date)) return res.status(400).json({ message: "Invalid appointment date" });
    if (from && !validDate(from)) return res.status(400).json({ message: "Invalid start date" });
    if (to && !validDate(to)) return res.status(400).json({ message: "Invalid end date" });
    if (from && to && from > to) return res.status(400).json({ message: "Start date must not be after end date" });
    if (date) {
        conditions.push("a.appointment_date = ?");
        values.push(date);
    } else {
        if (from) {
            conditions.push("a.appointment_date >= ?");
            values.push(from);
        }
        if (to) {
            conditions.push("a.appointment_date <= ?");
            values.push(to);
        }
    }
    if (patientId) {
        conditions.push("a.patient_id = ?");
        values.push(patientId);
    }
    if (doctorId) {
        conditions.push("a.doctor_id = ?");
        values.push(doctorId);
    }
    if (status) {
        if (!allowedStatuses.includes(status)) return res.status(400).json({ message: "Invalid appointment status" });
        conditions.push("a.status = ?");
        values.push(status);
    }
    if (typeof search === "string" && search.trim()) {
        conditions.push("(p.name LIKE ? OR d.name LIKE ? OR CAST(a.appointment_id AS CHAR) = ?)");
        values.push(`%${search.trim()}%`, `%${search.trim()}%`, search.trim());
    }

    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
    const [appointments] = await db.query(`
        SELECT a.*, p.name AS patient_name, p.contact AS patient_contact,
               p.email AS patient_email, d.name AS doctor_name,
               d.specialization, d.consultation_fee, i.payment_status
        FROM appointments a
        JOIN patients p ON a.patient_id = p.patient_id
        JOIN doctors d ON a.doctor_id = d.doctor_id
        LEFT JOIN invoices i ON i.appointment_id = a.appointment_id
        ${where}
        ORDER BY a.appointment_id DESC
    `, values);

    res.json({ success: true, count: appointments.length, data: appointments });
});

const getAppointmentAvailability = asyncHandler(async (req, res) => {
    const { doctorId, date, appointmentId } = req.query;
    if (!doctorId || !validDate(date)) {
        return res.status(400).json({ message: "Doctor and a valid date are required" });
    }

    const [schedules] = await db.query(
        `SELECT start_time, end_time, slot_minutes
         FROM doctor_availability
         WHERE doctor_id = ? AND day_of_week = DAYOFWEEK(?) - 1 AND is_available = TRUE
         ORDER BY start_time`,
        [doctorId, date]
    );
    const [booked] = await db.query(
        `SELECT appointment_time
         FROM appointments
         WHERE doctor_id = ? AND appointment_date = ? AND status <> 'Cancelled'
           AND appointment_id <> ?`,
        [doctorId, date, appointmentId || 0]
    );
    const occupied = new Set(booked.map((item) => String(item.appointment_time).slice(0, 5)));
    const times = [];

    for (const schedule of schedules) {
        const [startHour, startMinute] = String(schedule.start_time).slice(0, 5).split(":").map(Number);
        const [endHour, endMinute] = String(schedule.end_time).slice(0, 5).split(":").map(Number);
        const start = startHour * 60 + startMinute;
        const end = endHour * 60 + endMinute;
        const duration = Number(schedule.slot_minutes);
        for (let minute = start; minute + duration <= end; minute += duration) {
            const time = `${String(Math.floor(minute / 60)).padStart(2, "0")}:${String(minute % 60).padStart(2, "0")}`;
            if (!occupied.has(time)) times.push(time);
        }
    }

    res.json({ success: true, data: times });
});

const assertBookable = async (connection, { doctorId, date, time, appointmentId }) => {
    const [schedules] = await connection.query(
        `SELECT availability_id
         FROM doctor_availability
         WHERE doctor_id = ? AND day_of_week = DAYOFWEEK(?) - 1
           AND is_available = TRUE
           AND start_time <= ?
           AND ADDTIME(?, SEC_TO_TIME(slot_minutes * 60)) <= end_time
           AND MOD(TIME_TO_SEC(TIMEDIFF(?, start_time)), slot_minutes * 60) = 0
         LIMIT 1`,
        [doctorId, date, `${time}:00`, `${time}:00`, `${time}:00`]
    );
    if (!schedules.length) {
        const error = new Error("The selected time is outside the doctor's available schedule");
        error.statusCode = 409;
        throw error;
    }

    const [conflicts] = await connection.query(
        `SELECT appointment_id
         FROM appointments
         WHERE doctor_id = ? AND appointment_date = ? AND appointment_time = ?
           AND status <> 'Cancelled' AND appointment_id <> ?
         LIMIT 1
         FOR UPDATE`,
        [doctorId, date, `${time}:00`, appointmentId || 0]
    );
    if (conflicts.length) {
        const error = new Error("This doctor already has an appointment at that date and time");
        error.statusCode = 409;
        throw error;
    }
};

const lockDoctor = async (connection, doctorId) => {
    const [doctors] = await connection.query(
        "SELECT doctor_id, consultation_fee FROM doctors WHERE doctor_id = ? AND is_active = TRUE FOR UPDATE",
        [doctorId]
    );
    if (!doctors.length) {
        const error = new Error("Doctor not found or inactive");
        error.statusCode = 404;
        throw error;
    }
    return doctors[0];
};

const validateAppointment = (body) => (
    body.patient_id &&
    body.doctor_id &&
    validDate(body.appointment_date) &&
    validTime(body.appointment_time) &&
    (!body.status || allowedStatuses.includes(body.status))
);

const createAppointment = asyncHandler(async (req, res) => {
    if (!validateAppointment(req.body)) {
        return res.status(400).json({
            message: "Patient, doctor, valid date and time are required; status must be valid"
        });
    }
    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();
        const doctor = await lockDoctor(connection, req.body.doctor_id);
        if (Number(doctor.consultation_fee) > 0 && !paymentMethods.includes(req.body.payment_method)) {
            await connection.rollback();
            return res.status(400).json({ message: "Select a valid payment method" });
        }
        await assertBookable(connection, {
            doctorId: req.body.doctor_id,
            date: req.body.appointment_date,
            time: req.body.appointment_time
        });

        const [result] = await connection.query(
            `INSERT INTO appointments
             (patient_id, doctor_id, appointment_date, appointment_time, status)
             VALUES (?, ?, ?, ?, 'Scheduled')`,
            [req.body.patient_id, req.body.doctor_id, req.body.appointment_date, `${req.body.appointment_time}:00`]
        );
        const [invoice] = await connection.query(
            `INSERT INTO invoices
             (appointment_id, consultation_fee, additional_charges, total_amount, payment_status)
             VALUES (?, ?, 0, ?, ?)`,
            [
                result.insertId,
                doctor.consultation_fee,
                doctor.consultation_fee,
                Number(doctor.consultation_fee) === 0 ? "Paid" : "Pending"
            ]
        );
        if (Number(doctor.consultation_fee) > 0) {
            await connection.query(
                `INSERT INTO payment_transactions
                 (invoice_id, amount, payment_method)
                 VALUES (?, ?, ?)`,
                [invoice.insertId, doctor.consultation_fee, req.body.payment_method]
            );
        }
        await connection.commit();
        const message = Number(doctor.consultation_fee) > 0
            ? "Appointment booked and consultation fee payment recorded"
            : "Appointment booked; no consultation fee is due";
        res.status(201).json({
            success: true,
            message,
            appointmentId: result.insertId
        });
    } catch (error) {
        await connection.rollback();
        throw error;
    } finally {
        connection.release();
    }
});

const getAppointmentById = asyncHandler(async (req, res) => {
    const [appointments] = await db.query(
        `SELECT a.*, p.name AS patient_name, d.name AS doctor_name, d.specialization
         FROM appointments a
         JOIN patients p ON a.patient_id = p.patient_id
         JOIN doctors d ON a.doctor_id = d.doctor_id
         WHERE a.appointment_id = ?`,
        [req.params.id]
    );
    if (!appointments.length) return res.status(404).json({ message: "Appointment not found" });
    res.json({ success: true, data: appointments[0] });
});

const updateAppointment = asyncHandler(async (req, res) => {
    if (!validateAppointment(req.body)) {
        return res.status(400).json({
            message: "Patient, doctor, valid date and time are required; status must be valid"
        });
    }

    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();
        const [existingRows] = await connection.query(
            `SELECT appointment_id, doctor_id, appointment_date, appointment_time, status
             FROM appointments WHERE appointment_id = ? FOR UPDATE`,
            [req.params.id]
        );
        if (!existingRows.length) {
            await connection.rollback();
            return res.status(404).json({ message: "Appointment not found" });
        }
        const existing = existingRows[0];
        const status = req.body.status || "Scheduled";
        await lockDoctor(connection, req.body.doctor_id);
        const changedSlot =
            Number(existing.doctor_id) !== Number(req.body.doctor_id) ||
            String(existing.appointment_date).slice(0, 10) !== req.body.appointment_date ||
            String(existing.appointment_time).slice(0, 5) !== req.body.appointment_time;
        if (status !== "Cancelled" && (changedSlot || existing.status === "Cancelled")) {
            await assertBookable(connection, {
                doctorId: req.body.doctor_id,
                date: req.body.appointment_date,
                time: req.body.appointment_time,
                appointmentId: Number(req.params.id)
            });
        }
        await connection.query(
            `UPDATE appointments
             SET patient_id = ?, doctor_id = ?, appointment_date = ?,
                 appointment_time = ?, status = ?
             WHERE appointment_id = ?`,
            [
                req.body.patient_id,
                req.body.doctor_id,
                req.body.appointment_date,
                `${req.body.appointment_time}:00`,
                status,
                req.params.id
            ]
        );
        await connection.commit();
        res.json({ success: true, message: "Appointment updated successfully" });
    } catch (error) {
        await connection.rollback();
        throw error;
    } finally {
        connection.release();
    }
});

const deleteAppointment = asyncHandler(async (req, res) => {
    const [result] = await db.query(
        "DELETE FROM appointments WHERE appointment_id = ?",
        [req.params.id]
    );
    if (!result.affectedRows) return res.status(404).json({ message: "Appointment not found" });
    res.json({ success: true, message: "Appointment deleted successfully" });
});

module.exports = {
    getAppointments,
    getAppointmentAvailability,
    getAppointmentById,
    createAppointment,
    updateAppointment,
    deleteAppointment
};
