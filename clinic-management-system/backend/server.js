
require("dotenv").config();

const express = require("express");
const cors = require("cors");

const db = require("./config/db");

const patientRoutes = require("./routes/patientRoutes");
const doctorRoutes = require("./routes/doctorRoutes");
const appointmentRoutes = require("./routes/appointmentRoutes");
const dashboardRoutes = require("./routes/dashboardRoutes");
const authRoutes = require("./routes/authRoutes");
const prescriptionRoutes = require("./routes/prescriptionRoutes");
const billingRoutes = require("./routes/billingRoutes");
const reportRoutes = require("./routes/reportRoutes");

const notFound = require("./middleware/notFound");
const errorMiddleware = require("./middleware/errorMiddleware");
const { authenticate, authorizeRoles } = require("./middleware/authMiddleware");

const app = express();

// Built-in middleware
app.use(cors());
app.use(express.json());

// Test route
app.get("/", (req, res) => {
    res.json({
        success: true,
        message: "HealthDesk Clinic Management API is running"
    });
});

app.use("/api/auth", authRoutes);
app.use("/api", authenticate, authorizeRoles("Admin"));

// Database connection test
app.get("/api/test-db", async (req, res, next) => {
    try {
        const [result] = await db.query("SELECT 1 AS connection_status");

        res.json({
            success: true,
            message: "MySQL database connected successfully",
            data: result[0]
        });
    } catch (error) {
        next(error);
    }
});

// API routes
app.use("/api/patients", patientRoutes);
app.use("/api/doctors", doctorRoutes);
app.use("/api/appointments", appointmentRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/prescriptions", prescriptionRoutes);
app.use("/api/invoices", billingRoutes);
app.use("/api/reports", reportRoutes);

// Error handling middleware (keep these at the end)
app.use(notFound);
app.use(errorMiddleware);

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
