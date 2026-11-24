const db = require("../config/db");
const asyncHandler = require("../middleware/asyncHandler");
const paymentMethods = require("../constants/paymentMethods");
const validDate = (value) => (
    typeof value === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    !Number.isNaN(Date.parse(`${value}T00:00:00Z`)) &&
    new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value
);

const listInvoices = asyncHandler(async (req, res) => {
    const conditions = [];
    const values = [];
    if ((req.query.from && !validDate(req.query.from)) || (req.query.to && !validDate(req.query.to))) {
        return res.status(400).json({ message: "Enter valid invoice date filters" });
    }
    if (req.query.from && req.query.to && req.query.from > req.query.to) {
        return res.status(400).json({ message: "Start date must not be after end date" });
    }
    if (req.query.status) {
        if (!["Paid", "Pending", "Partially Paid"].includes(req.query.status)) {
            return res.status(400).json({ message: "Invalid payment status" });
        }
        conditions.push("i.payment_status = ?");
        values.push(req.query.status);
    }
    if (req.query.patientId) {
        conditions.push("a.patient_id = ?");
        values.push(req.query.patientId);
    }
    if (req.query.from) {
        conditions.push("a.appointment_date >= ?");
        values.push(req.query.from);
    }
    if (req.query.to) {
        conditions.push("a.appointment_date <= ?");
        values.push(req.query.to);
    }
    if (req.query.search && String(req.query.search).trim()) {
        const search = `%${String(req.query.search).trim()}%`;
        conditions.push("(p.name LIKE ? OR d.name LIKE ? OR CAST(i.invoice_id AS CHAR) = ?)");
        values.push(search, search, String(req.query.search).trim());
    }
    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
    const [invoices] = await db.query(`
        SELECT i.*, a.appointment_date, a.appointment_time, a.status AS appointment_status,
               a.patient_id, p.name AS patient_name, d.name AS doctor_name,
               d.specialization
        FROM invoices i
        JOIN appointments a ON a.appointment_id = i.appointment_id
        JOIN patients p ON p.patient_id = a.patient_id
        JOIN doctors d ON d.doctor_id = a.doctor_id
        ${where}
        ORDER BY i.created_at DESC
    `, values);
    res.json({ success: true, data: invoices });
});

const generateInvoice = asyncHandler(async (req, res) => {
    const appointmentId = Number(req.body.appointment_id);
    const additionalCharges = Number(req.body.additional_charges || 0);
    if (!Number.isInteger(appointmentId) || appointmentId < 1 ||
        !Number.isFinite(additionalCharges) || additionalCharges < 0) {
        return res.status(400).json({ message: "Enter a valid appointment and additional charge" });
    }

    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();
        const [appointments] = await connection.query(
            `SELECT a.appointment_id, d.consultation_fee
             FROM appointments a
             JOIN doctors d ON d.doctor_id = a.doctor_id
             WHERE a.appointment_id = ? FOR UPDATE`,
            [appointmentId]
        );
        if (!appointments.length) {
            await connection.rollback();
            return res.status(404).json({ message: "Appointment not found" });
        }

        const [existing] = await connection.query(
            "SELECT invoice_id, amount_paid, consultation_fee FROM invoices WHERE appointment_id = ? FOR UPDATE",
            [appointmentId]
        );
        const consultationFee = existing.length
            ? Number(existing[0].consultation_fee)
            : Number(appointments[0].consultation_fee);
        const total = consultationFee + additionalCharges;
        if (existing.length && total < Number(existing[0].amount_paid)) {
            await connection.rollback();
            return res.status(409).json({ message: "Bill total cannot be lower than the amount already paid" });
        }

        let response;
        if (existing.length) {
            await connection.query(
                `UPDATE invoices
                 SET consultation_fee = ?, additional_charges = ?, total_amount = ?,
                     payment_status = CASE
                         WHEN amount_paid >= ? THEN 'Paid'
                         WHEN amount_paid > 0 THEN 'Partially Paid'
                         ELSE 'Pending'
                     END
                 WHERE invoice_id = ?`,
                [consultationFee, additionalCharges, total, total, existing[0].invoice_id]
            );
            response = {
                status: 200,
                body: { success: true, message: "Invoice updated", invoiceId: existing[0].invoice_id }
            };
        } else {
            const [result] = await connection.query(
                `INSERT INTO invoices
                 (appointment_id, consultation_fee, additional_charges, total_amount)
                 VALUES (?, ?, ?, ?)`,
                [appointmentId, consultationFee, additionalCharges, total]
            );
            response = {
                status: 201,
                body: { success: true, message: "Invoice created", invoiceId: result.insertId }
            };
        }
        await connection.commit();
        res.status(response.status).json(response.body);
    } catch (error) {
        await connection.rollback();
        throw error;
    } finally {
        connection.release();
    }
});

const listPayments = asyncHandler(async (req, res) => {
    const [invoice] = await db.query(
        `SELECT invoice_id, appointment_id, total_amount, amount_paid, payment_status
         FROM invoices WHERE invoice_id = ?`,
        [req.params.invoiceId]
    );
    if (!invoice.length) return res.status(404).json({ message: "Invoice not found" });

    const [payments] = await db.query(
        `SELECT transaction_id, amount, payment_method, paid_at, reference_number
         FROM payment_transactions
         WHERE invoice_id = ?
         ORDER BY paid_at DESC, transaction_id DESC`,
        [req.params.invoiceId]
    );
    res.json({ success: true, data: { invoice: invoice[0], payments } });
});

const recordPayment = asyncHandler(async (req, res) => {
    const amount = Number(req.body.amount);
    const { payment_method, reference_number } = req.body;
    if (!Number.isFinite(amount) || amount <= 0 ||
        !paymentMethods.includes(payment_method) ||
        (reference_number && (typeof reference_number !== "string" || reference_number.length > 100))) {
        return res.status(400).json({ message: "Enter a valid amount, payment method and reference" });
    }

    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();
        const [invoices] = await connection.query(
            "SELECT invoice_id, total_amount, amount_paid FROM invoices WHERE invoice_id = ? FOR UPDATE",
            [req.params.invoiceId]
        );
        if (!invoices.length) {
            await connection.rollback();
            return res.status(404).json({ message: "Invoice not found" });
        }
        const remaining = Number(invoices[0].total_amount) - Number(invoices[0].amount_paid);
        if (amount > remaining) {
            await connection.rollback();
            return res.status(409).json({ message: "Payment exceeds the outstanding balance" });
        }

        const [result] = await connection.query(
            `INSERT INTO payment_transactions (invoice_id, amount, payment_method, reference_number)
             VALUES (?, ?, ?, ?)`,
            [req.params.invoiceId, amount, payment_method, reference_number?.trim() || null]
        );
        const [updated] = await connection.query(
            "SELECT amount_paid, total_amount, payment_status FROM invoices WHERE invoice_id = ?",
            [req.params.invoiceId]
        );
        await connection.commit();
        res.status(201).json({
            success: true,
            message: "Payment recorded",
            data: {
                transactionId: result.insertId,
                ...updated[0]
            }
        });
    } catch (error) {
        await connection.rollback();
        throw error;
    } finally {
        connection.release();
    }
});

module.exports = { listInvoices, generateInvoice, listPayments, recordPayment };
