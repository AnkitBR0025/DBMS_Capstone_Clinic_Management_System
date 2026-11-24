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

    res.json({
        success: true,
        data: {
            token,
            user: {
                id: user.user_id,
                email: user.email,
                role: user.role
            }
        }
    });
});

const getCurrentUser = asyncHandler(async (req, res) => {
    res.json({ success: true, data: { user: req.user } });
});

module.exports = { login, getCurrentUser };
