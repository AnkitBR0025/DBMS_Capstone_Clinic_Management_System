const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const db = require("../config/db");
const asyncHandler = require("../middleware/asyncHandler");

const getJwtSecret = () => {
    const secret = process.env.JWT_SECRET;
    if (!secret || secret.length < 32) {
        const error = new Error("JWT_SECRET must be configured with at least 32 characters");
        error.statusCode = 500;
        throw error;
    }
    return secret;
};

const login = asyncHandler(async (req, res) => {
    const { email, password } = req.body;

    if (typeof email !== "string" || typeof password !== "string" || !email.trim() || !password) {
        return res.status(400).json({
            success: false,
            message: "Email and password are required"
        });
    }

    const [users] = await db.query(
        "SELECT user_id, email, password_hash, role, is_active FROM users WHERE email = ? LIMIT 1",
        [email.trim().toLowerCase()]
    );
    const user = users[0];

    if (!user || !user.is_active || !(await bcrypt.compare(password, user.password_hash))) {
        return res.status(401).json({
            success: false,
            message: "Invalid email or password"
        });
    }

    const token = jwt.sign(
        { sub: String(user.user_id), role: user.role },
        getJwtSecret(),
        { expiresIn: "8h", issuer: "healthdesk-api", audience: "healthdesk-web" }
    );

    let profile = null;
    if (user.role === "Doctor") {
        const [doctors] = await db.query(
            "SELECT doctor_id, name FROM doctors WHERE user_id = ? LIMIT 1",
            [user.user_id]
        );
        profile = doctors[0] || null;
    } else if (user.role === "Patient") {
        const [patients] = await db.query(
            "SELECT patient_id, name FROM patients WHERE user_id = ? LIMIT 1",
            [user.user_id]
        );
        profile = patients[0] || null;
    }

    res.json({
        success: true,
        data: {
            token,
            user: {
                id: user.user_id,
                email: user.email,
                role: user.role,
                doctorId: profile?.doctor_id || null,
                patientId: profile?.patient_id || null,
                name: profile?.name || null
            }
        }
    });
});

const getCurrentUser = asyncHandler(async (req, res) => {
    let name = null;
    if (req.user.role === "Doctor" && req.user.doctorId) {
        const [rows] = await db.query("SELECT name FROM doctors WHERE doctor_id = ? LIMIT 1", [req.user.doctorId]);
        name = rows[0]?.name || null;
    } else if (req.user.role === "Patient" && req.user.patientId) {
        const [rows] = await db.query("SELECT name FROM patients WHERE patient_id = ? LIMIT 1", [req.user.patientId]);
        name = rows[0]?.name || null;
    }
    res.json({ success: true, data: { user: { ...req.user, name } } });
});

const registerPatient = asyncHandler(async (req, res) => {
    const {
        name, email, password, confirmPassword, mobile, address,
        date_of_birth, gender
    } = req.body;

    if (!name?.trim() || !email?.trim() || !password || !confirmPassword ||
        !mobile?.trim() || !address?.trim() || !date_of_birth || !gender) {
        return res.status(400).json({ message: "All patient registration fields are required" });
    }
    if (password !== confirmPassword) {
        return res.status(400).json({ message: "Password and confirm password do not match" });
    }
    if (password.length < 8) {
        return res.status(400).json({ message: "Password must be at least 8 characters" });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) ||
        !/^[0-9+\-\s]{7,15}$/.test(mobile.trim())) {
        return res.status(400).json({ message: "Enter a valid email and mobile number" });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();
        const [existing] = await connection.query(
            "SELECT user_id FROM users WHERE email = ? LIMIT 1",
            [normalizedEmail]
        );
        if (existing.length) {
            await connection.rollback();
            return res.status(409).json({ message: "An account with this email already exists" });
        }

        const passwordHash = await bcrypt.hash(password, 12);
        const [userResult] = await connection.query(
            `INSERT INTO users (email, password_hash, role, is_active)
             VALUES (?, ?, 'Patient', TRUE)`,
            [normalizedEmail, passwordHash]
        );
        const [patientResult] = await connection.query(
            `INSERT INTO patients
             (user_id, name, mobile, contact, address, date_of_birth, gender, email)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                userResult.insertId,
                name.trim(),
                mobile.trim(),
                mobile.trim(),
                address.trim(),
                date_of_birth,
                gender,
                normalizedEmail
            ]
        );
        await connection.commit();
        res.status(201).json({
            success: true,
            message: "Patient account created successfully",
            patientId: patientResult.insertId
        });
    } catch (error) {
        await connection.rollback();
        throw error;
    } finally {
        connection.release();
    }
});

module.exports = { login, getCurrentUser, registerPatient };
