const express = require("express");
const {
    listInvoices,
    generateInvoice,
    listPayments,
    recordPayment
} = require("../controllers/billingController");

const router = express.Router();

router.get("/", listInvoices);
router.post("/", generateInvoice);
router.get("/:invoiceId/payments", listPayments);
router.post("/:invoiceId/payments", recordPayment);

module.exports = router;
