const db = require("../config/db");
const asyncHandler = require("../middleware/asyncHandler");
const bcrypt = require("bcryptjs");

const getDoctorAvailability = asyncHandler(async (req, res) => {
    const [availability] = await db.query(
        `SELECT availability_id, doctor_id, day_of_week, start_time, end_time,
                slot_minutes, is_available
         FROM doctor_availability
         WHERE doctor_id = ?
         ORDER BY day_of_week, start_time`,
        [req.params.id]
    );
    res.json({ success: true, data: availability });
});

const setDoctorAvailability = asyncHandler(async (req, res) => {
    const { availability } = req.body;
    if (!Array.isArray(availability) || availability.length > 21) {
        return res.status(400).json({ message: "Availability must be a list of at most 21 schedules" });
    }

    const validTime = (value) => typeof value === "string" && /^\d{2}:\d{2}$/.test(value);
    for (const slot of availability) {
        if (
            !Number.isInteger(Number(slot.day_of_week)) ||
            Number(slot.day_of_week) < 0 ||
            Number(slot.day_of_week) > 6 ||
            !validTime(slot.start_time) ||
            !validTime(slot.end_time) ||
            slot.start_time >= slot.end_time ||
            !Number.isInteger(Number(slot.slot_minutes)) ||
            Number(slot.slot_minutes) < 5 ||
            Number(slot.slot_minutes) > 480
        ) {
            return res.status(400).json({ message: "Enter valid days, times and slot lengths" });
        }
    }

    const sorted = [...availability].sort((a, b) =>
        Number(a.day_of_week) - Number(b.day_of_week) ||
        a.start_time.localeCompare(b.start_time)
    );
    for (let index = 1; index < sorted.length; index += 1) {
        const previous = sorted[index - 1];
        const current = sorted[index];
        if (
            Number(previous.day_of_week) === Number(current.day_of_week) &&
            current.start_time < previous.end_time
        ) {
            return res.status(400).json({ message: "Working schedule time ranges cannot overlap" });
        }
    }

    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();
        const [doctors] = await connection.query(
            "SELECT doctor_id FROM doctors WHERE doctor_id = ? FOR UPDATE",
            [req.params.id]
        );
        if (!doctors.length) {
            await connection.rollback();
            return res.status(404).json({ message: "Doctor not found" });
        }

        await connection.query(
            "DELETE FROM doctor_availability WHERE doctor_id = ?",
            [req.params.id]
        );
        for (const slot of availability) {
            await connection.query(
                `INSERT INTO doctor_availability
                 (doctor_id, day_of_week, start_time, end_time, slot_minutes, is_available)
                 VALUES (?, ?, ?, ?, ?, ?)`,
                [
                    req.params.id,
                    Number(slot.day_of_week),
                    `${slot.start_time}:00`,
                    `${slot.end_time}:00`,
                    Number(slot.slot_minutes),
                    slot.is_available !== false
                ]
            );
        }
        await connection.commit();
        res.json({ success: true, message: "Doctor availability updated" });
    } catch (error) {
        await connection.rollback();
        throw error;
    } finally {
        connection.release();
    }
});

// GET all doctors
const getDoctors = asyncHandler(async (req, res) => {
    const search = typeof req.query.search === "string" ? req.query.search.trim() : "";
    const [doctors] = await db.query(
        `SELECT * FROM doctors
         WHERE (? = '' OR name LIKE ? OR specialization LIKE ? OR contact LIKE ?)
         ORDER BY doctor_id DESC`,
        [search, `%${search}%`, `%${search}%`, `%${search}%`]
    );

    res.json({
        success: true,
        count: doctors.length,
        data: doctors
    });
});

// GET doctor by ID
const getDoctorById = asyncHandler(async (req, res) => {
    const [doctors] = await db.query(
        "SELECT * FROM doctors WHERE doctor_id = ?",
        [req.params.id]
    );

    if (doctors.length === 0) {
        return res.status(404).json({ message: "Doctor not found" });
    }

    res.json({ success: true, data: doctors[0] });
});

// ADD doctor
const createDoctor = asyncHandler(async (req, res) => {
    const { name, specialization, contact, consultation_fee, email, address, password, is_active } = req.body;

    if (!name || !name.trim() || !specialization || !specialization.trim() || !email) {
        return res.status(400).json({
            message: "Doctor name, email and specialization are required"
        });
    }

    const fee = consultation_fee === undefined ? 0 : Number(consultation_fee);

    if (!Number.isFinite(fee) || fee < 0) {
        return res.status(400).json({
            message: "Enter a valid consultation fee"
        });
    }

    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return res.status(400).json({ message: "Enter a valid email address" });
    }

    if (password && password.length < 8) {
        return res.status(400).json({ message: "Password must be at least 8 characters" });
    }

    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();
        const normalizedEmail = email.trim().toLowerCase();
        const [existing] = await connection.query(
            "SELECT user_id FROM users WHERE email = ? LIMIT 1",
            [normalizedEmail]
        );
        if (existing.length) {
            await connection.rollback();
            return res.status(409).json({ message: "A login account with this email already exists" });
        }
        const temporaryPassword = password || Math.random().toString(36).slice(-10) + "A1!";
        const passwordHash = await bcrypt.hash(temporaryPassword, 12);
        const [userResult] = await connection.query(
            `INSERT INTO users (email, password_hash, role, is_active)
             VALUES (?, ?, 'Doctor', ?)`,
            [normalizedEmail, passwordHash, is_active !== false]
        );
        const [doctorResult] = await connection.query(
            `INSERT INTO doctors
             (user_id, name, specialization, contact, consultation_fee, email, address, is_active)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                userResult.insertId,
                name.trim(),
                specialization.trim(),
                contact || null,
                fee,
                normalizedEmail,
                address || null,
                is_active !== false
            ]
        );
        await connection.commit();
        res.status(201).json({
            success: true,
            message: "Doctor account created successfully",
            doctorId: doctorResult.insertId,
            temporaryPassword: password ? undefined : temporaryPassword
        });
    } catch (error) {
        await connection.rollback();
        throw error;
    } finally {
        connection.release();
    }
});

// UPDATE doctor
const updateDoctor = asyncHandler(async (req, res) => {
    const { name, specialization, contact, consultation_fee, email, address, is_active, password } = req.body;

    if (!name || !name.trim() || !specialization || !specialization.trim()) {
        return res.status(400).json({
            message: "Doctor name and specialization are required"
        });
    }

    const fee = consultation_fee === undefined ? 0 : Number(consultation_fee);

    if (!Number.isFinite(fee) || fee < 0) {
        return res.status(400).json({
            message: "Enter a valid consultation fee"
        });
    }

    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return res.status(400).json({ message: "Enter a valid email address" });
    }

    if (password && password.length < 8) {
        return res.status(400).json({ message: "Password must be at least 8 characters" });
    }

    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();
        const [rows] = await connection.query(
            "SELECT user_id FROM doctors WHERE doctor_id = ? LIMIT 1 FOR UPDATE",
            [req.params.id]
        );
        if (!rows.length) {
            await connection.rollback();
            return res.status(404).json({ message: "Doctor not found" });
        }
        await connection.query(
            `UPDATE doctors
             SET name = ?, specialization = ?, contact = ?, consultation_fee = ?,
                 email = ?, address = ?, is_active = ?
             WHERE doctor_id = ?`,
            [
                name.trim(),
                specialization.trim(),
                contact || null,
                fee,
                email?.trim().toLowerCase() || null,
                address || null,
                is_active !== false,
                req.params.id
            ]
        );
        if (rows[0].user_id) {
            const updates = ["is_active = ?"];
            const values = [is_active !== false];
            if (email) {
                updates.push("email = ?");
                values.push(email.trim().toLowerCase());
            }
            if (password) {
                updates.push("password_hash = ?");
                values.push(await bcrypt.hash(password, 12));
            }
            values.push(rows[0].user_id);
            await connection.query(
                `UPDATE users SET ${updates.join(", ")} WHERE user_id = ?`,
                values
            );
        }
        await connection.commit();
        res.json({ success: true, message: "Doctor updated successfully" });
    } catch (error) {
        await connection.rollback();
        throw error;
    } finally {
        connection.release();
    }
});

// DELETE doctor
const deleteDoctor = asyncHandler(async (req, res) => {
    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();
        const [rows] = await connection.query(
            "SELECT user_id FROM doctors WHERE doctor_id = ? LIMIT 1 FOR UPDATE",
            [req.params.id]
        );
        if (!rows.length) {
            await connection.rollback();
            return res.status(404).json({ message: "Doctor not found" });
        }
        await connection.query("UPDATE doctors SET is_active = FALSE WHERE doctor_id = ?", [req.params.id]);
        if (rows[0].user_id) {
            await connection.query("UPDATE users SET is_active = FALSE WHERE user_id = ?", [rows[0].user_id]);
        }
        await connection.commit();
        res.json({ success: true, message: "Doctor account deactivated successfully" });
    } catch (error) {
        await connection.rollback();
        throw error;
    } finally {
        connection.release();
    }
});

module.exports = {
    getDoctors,
    getDoctorById,
    getDoctorAvailability,
    setDoctorAvailability,
    createDoctor,
    updateDoctor,
    deleteDoctor
};
