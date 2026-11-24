const jwt = require("jsonwebtoken");
const db = require("../config/db");

const getJwtSecret = () => {
    const secret = process.env.JWT_SECRET;
    if (!secret || secret.length < 32) {
        throw new Error("JWT_SECRET must be configured with at least 32 characters");
    }
    return secret;
};

const authenticate = async (req, res, next) => {
    try {
        const authorization = req.get("authorization") || "";
        const [scheme, token] = authorization.split(" ");

        if (scheme !== "Bearer" || !token) {
            return res.status(401).json({
                success: false,
                message: "Authentication required"
            });
        }

        let payload;
        try {
            payload = jwt.verify(token, getJwtSecret(), {
                issuer: "healthdesk-api",
                audience: "healthdesk-web"
            });
        } catch (error) {
            if (error instanceof jwt.JsonWebTokenError || error instanceof jwt.TokenExpiredError) {
                return res.status(401).json({
                    success: false,
                    message: "Invalid or expired authentication token"
                });
            }
            throw error;
        }

        const [users] = await db.query(
            "SELECT user_id, email, role, is_active FROM users WHERE user_id = ? LIMIT 1",
            [payload.sub]
        );
        const user = users[0];

        if (!user || !user.is_active) {
            return res.status(401).json({
                success: false,
                message: "Account is inactive or no longer available"
            });
        }

        req.user = {
            id: user.user_id,
            email: user.email,
            role: user.role
        };
        return next();
    } catch (error) {
        return next(error);
    }
};

const authorizeRoles = (...roles) => (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
        return res.status(403).json({
            success: false,
            message: "You do not have permission to access this resource"
        });
    }
    return next();
};

module.exports = { authenticate, authorizeRoles };
