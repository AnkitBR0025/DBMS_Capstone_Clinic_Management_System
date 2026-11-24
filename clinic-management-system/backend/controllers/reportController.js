const db = require("../config/db");
const asyncHandler = require("../middleware/asyncHandler");

const validDate = (value) => (
    typeof value === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    !Number.isNaN(Date.parse(`${value}T00:00:00Z`)) &&
    new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value
);

const getReport = asyncHandler(async (req, res) => {
    const type = req.query.type || "appointments";
    const { from, to } = req.query;
    const supported = ["appointments", "completed", "cancelled", "doctor-wise", "revenue", "pending-payments"];
    if (!supported.includes(type)) return res.status(400).json({ message: "Unsupported report type" });
    if ((from && !validDate(from)) || (to && !validDate(to))) {
        return res.status(400).json({ message: "Enter valid report dates" });
    }
    if (from && to && from > to) return res.status(400).json({ message: "Start date must not be after end date" });

    const conditions = [];
    const values = [];
    if (from) {
        conditions.push("a.appointment_date >= ?");
        values.push(from);
    }
    if (to) {
        conditions.push("a.appointment_date <= ?");
        values.push(to);
    }
    if (req.query.patientId) {
        conditions.push("a.patient_id = ?");
        values.push(req.query.patientId);
    }
    if (req.query.doctorId) {
        conditions.push("a.doctor_id = ?");
        values.push(req.query.doctorId);
    }
    if (["completed", "cancelled"].includes(type)) {
        conditions.push("a.status = ?");
        values.push(type === "completed" ? "Completed" : "Cancelled");
    }
    if (type === "pending-payments") conditions.push("i.payment_status <> 'Paid'");
    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

    let sql;
    if (type === "revenue") {
        sql = `SELECT t.transaction_id, t.paid_at, t.amount, t.payment_method,
                      i.invoice_id, a.appointment_id, p.name AS patient_name, d.name AS doctor_name
               FROM payment_transactions t
               JOIN invoices i ON i.invoice_id = t.invoice_id
               JOIN appointments a ON a.appointment_id = i.appointment_id
               JOIN patients p ON p.patient_id = a.patient_id
               JOIN doctors d ON d.doctor_id = a.doctor_id
               ${where.replaceAll("a.appointment_date", "DATE(t.paid_at)") || ""} 
               ORDER BY t.paid_at DESC`;
    } else if (type === "doctor-wise") {
        sql = `SELECT d.doctor_id, d.name AS doctor_name, d.specialization,
                      COUNT(a.appointment_id) AS appointment_count,
                      SUM(a.status = 'Completed') AS completed_count,
                      SUM(a.status = 'Cancelled') AS cancelled_count
               FROM doctors d
               LEFT JOIN appointments a ON a.doctor_id = d.doctor_id
               ${where ? `WHERE ${where.slice(6).replaceAll("a.", "a.")}` : ""}
               GROUP BY d.doctor_id, d.name, d.specialization
               ORDER BY appointment_count DESC, d.name`;
    } else {
        sql = `SELECT a.appointment_id, a.appointment_date, a.appointment_time, a.status,
                      p.patient_id, p.name AS patient_name,
                      d.doctor_id, d.name AS doctor_name, d.specialization,
                      i.total_amount, i.amount_paid, i.payment_status
               FROM appointments a
               JOIN patients p ON p.patient_id = a.patient_id
               JOIN doctors d ON d.doctor_id = a.doctor_id
               LEFT JOIN invoices i ON i.appointment_id = a.appointment_id
               ${where}
               ORDER BY a.appointment_id DESC`;
    }
    const [rows] = await db.query(sql, values);
    res.json({ success: true, data: rows });
});

module.exports = { getReport };
