const db = require("../config/db");
const asyncHandler = require("../middleware/asyncHandler");

const getDashboard = asyncHandler(async (req, res) => {
    const [
        [[patientCount]],
        [[doctorCount]],
        [[todayCount]],
        [[completedCount]],
        [[cancelledCount]],
        [[pendingPayments]],
        [[totalRevenue]],
        [recentAppointments],
        [upcomingAppointments],
        [monthlyAppointments],
        [monthlyRevenue],
        [statusDistribution]
    ] = await Promise.all([
        db.query("SELECT COUNT(*) AS total FROM patients"),
        db.query("SELECT COUNT(*) AS total FROM doctors WHERE is_active = TRUE"),
        db.query("SELECT COUNT(*) AS total FROM appointments WHERE appointment_date = CURDATE()"),
        db.query("SELECT COUNT(*) AS total FROM appointments WHERE status = 'Completed'"),
        db.query("SELECT COUNT(*) AS total FROM appointments WHERE status = 'Cancelled'"),
        db.query(`SELECT COALESCE(SUM(total_amount - amount_paid), 0) AS total
                  FROM invoices WHERE payment_status <> 'Paid'`),
        db.query("SELECT COALESCE(SUM(amount), 0) AS total FROM payment_transactions"),
        db.query(`SELECT appointment_id, patient_name, doctor_name, appointment_date,
                         appointment_time, status, payment_status
                  FROM v_appointment_details
                  ORDER BY appointment_id DESC
                  LIMIT 5`),
        db.query(`SELECT appointment_id, patient_name, doctor_name, appointment_date,
                         appointment_time, status
                  FROM v_appointment_details
                  WHERE status = 'Scheduled' AND appointment_date >= CURDATE()
                  ORDER BY appointment_date, appointment_time
                  LIMIT 5`),
        db.query(`SELECT DATE_FORMAT(appointment_date, '%Y-%m') AS month,
                         COUNT(*) AS total
                  FROM appointments
                  WHERE appointment_date >= DATE_SUB(CURDATE(), INTERVAL 11 MONTH)
                  GROUP BY DATE_FORMAT(appointment_date, '%Y-%m')
                  ORDER BY month`),
        db.query(`SELECT DATE_FORMAT(paid_at, '%Y-%m') AS month, SUM(amount) AS total
                  FROM payment_transactions
                  WHERE paid_at >= DATE_SUB(CURDATE(), INTERVAL 11 MONTH)
                  GROUP BY DATE_FORMAT(paid_at, '%Y-%m')
                  ORDER BY month`),
        db.query("SELECT status, COUNT(*) AS total FROM appointments GROUP BY status")
    ]);

    res.json({
        success: true,
        data: {
            totalPatients: patientCount.total,
            totalDoctors: doctorCount.total,
            todayAppointments: todayCount.total,
            completedAppointments: completedCount.total,
            cancelledAppointments: cancelledCount.total,
            pendingPayments: pendingPayments.total,
            totalRevenue: totalRevenue.total,
            recentAppointments,
            upcomingAppointments,
            monthlyAppointments,
            monthlyRevenue,
            statusDistribution
        }
    });
});

module.exports = { getDashboard };
