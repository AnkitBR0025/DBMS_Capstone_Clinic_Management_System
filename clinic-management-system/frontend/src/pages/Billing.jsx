import { useEffect, useState } from "react";
import api from "../services/api";
import { downloadPdf } from "../utils/downloads";
import paymentMethods from "../utils/paymentMethods";

function Billing() {
    const [invoices, setInvoices] = useState([]);
    const [selected, setSelected] = useState(null);
    const [payments, setPayments] = useState([]);
    const [additionalCharges, setAdditionalCharges] = useState("");
    const [payment, setPayment] = useState({ amount: "", payment_method: "Cash", reference_number: "" });
    const [status, setStatus] = useState("");
    const [search, setSearch] = useState("");
    const [message, setMessage] = useState("");
    const [loading, setLoading] = useState(true);

    const loadInvoices = async () => {
        setLoading(true);
        try {
            const response = await api.get("/invoices", { params: { status, search } });
            setInvoices(response.data.data);
        } catch (error) {
            setMessage(error.response?.data?.message || "Unable to load invoices.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadInvoices();
    }, [status, search]);

    const openInvoice = async (invoice) => {
        setSelected(invoice);
        setAdditionalCharges(String(invoice.additional_charges || 0));
        setPayment({ amount: "", payment_method: "Cash", reference_number: "" });
        try {
            const response = await api.get(`/invoices/${invoice.invoice_id}/payments`);
            setPayments(response.data.data.payments);
        } catch (error) {
            setMessage(error.response?.data?.message || "Unable to load payment history.");
        }
    };

    const saveInvoice = async () => {
        try {
            await api.post("/invoices", {
                appointment_id: selected.appointment_id,
                additional_charges: Number(additionalCharges)
            });
            setMessage("Invoice saved.");
            const response = await api.get("/invoices", { params: { status, search } });
            setInvoices(response.data.data);
            const updated = response.data.data.find((item) => item.invoice_id === selected.invoice_id);
            if (updated) setSelected(updated);
        } catch (error) {
            setMessage(error.response?.data?.message || "Unable to save invoice.");
        }
    };

    const recordPayment = async (event) => {
        event.preventDefault();
        try {
            const response = await api.post(`/invoices/${selected.invoice_id}/payments`, {
                ...payment,
                amount: Number(payment.amount)
            });
            setMessage("Payment recorded.");
            await openInvoice({ ...selected, ...response.data.data });
            await loadInvoices();
        } catch (error) {
            setMessage(error.response?.data?.message || "Unable to record payment.");
        }
    };

    const downloadReceipt = () => {
        if (!selected) return;
        const remaining = Number(selected.total_amount) - Number(selected.amount_paid);
        downloadPdf(`HealthDesk Payment Receipt - Invoice ${selected.invoice_id}`, [
            `Patient: ${selected.patient_name} (ID ${selected.patient_id})`,
            `Doctor: ${selected.doctor_name}`,
            `Appointment: ${String(selected.appointment_date).slice(0, 10)} ${String(selected.appointment_time).slice(0, 5)}`,
            `Invoice total: INR ${Number(selected.total_amount).toFixed(2)}`,
            `Paid: INR ${Number(selected.amount_paid).toFixed(2)}`,
            `Outstanding: INR ${remaining.toFixed(2)}`,
            `Status: ${selected.payment_status}`,
            "",
            "Payment history:",
            ...payments.map((item) =>
                `${String(item.paid_at).slice(0, 19)} | INR ${Number(item.amount).toFixed(2)} | ${item.payment_method} | ${item.reference_number || "-"}`
            )
        ], `healthdesk-receipt-${selected.invoice_id}.pdf`);
    };

    const outstandingBalance = selected
        ? Math.max(0, Number(selected.total_amount) - Number(selected.amount_paid))
        : 0;

    return (
        <div>
            <div className="page-heading">
                <div><h1>Billing and Payments</h1><p>Invoices, balances and payment history</p></div>
            </div>
            {message && <p className="message" role="status">{message}</p>}
            <section className="content-card">
                <div className="section-heading">
                    <h2>Invoices</h2>
                    <div className="filter-row">
                        <select value={status} onChange={(e) => setStatus(e.target.value)}>
                            <option value="">All statuses</option>
                            <option>Paid</option><option>Pending</option><option>Partially Paid</option>
                        </select>
                        <input className="search-input" placeholder="Search patient, doctor or invoice"
                            value={search} onChange={(e) => setSearch(e.target.value)} />
                    </div>
                </div>
                <div className="table-wrapper">
                    <table>
                        <thead><tr><th>Invoice</th><th>Patient</th><th>Doctor</th><th>Appointment</th>
                            <th>Consultation</th><th>Additional</th><th>Total</th><th>Paid</th><th>Balance</th><th>Status</th></tr></thead>
                        <tbody>
                            {invoices.map((invoice) => (
                                <tr key={invoice.invoice_id} className="clickable-row" onClick={() => openInvoice(invoice)}>
                                    <td>{invoice.invoice_id}</td><td>{invoice.patient_name}</td><td>{invoice.doctor_name}</td>
                                    <td>{String(invoice.appointment_date).slice(0, 10)}</td>
                                    <td>{Number(invoice.consultation_fee).toFixed(2)}</td>
                                    <td>{Number(invoice.additional_charges).toFixed(2)}</td>
                                    <td>{Number(invoice.total_amount).toFixed(2)}</td>
                                    <td>{Number(invoice.amount_paid).toFixed(2)}</td>
                                    <td>{(Number(invoice.total_amount) - Number(invoice.amount_paid)).toFixed(2)}</td>
                                    <td>{invoice.payment_status}</td>
                                </tr>
                            ))}
                            {!loading && invoices.length === 0 && <tr><td colSpan="10">No invoices found.</td></tr>}
                            {loading && <tr><td colSpan="10">Loading invoices...</td></tr>}
                        </tbody>
                    </table>
                </div>
            </section>

            {selected && (
                <section className="content-card">
                    <div className="section-heading">
                        <div>
                            <h2>Invoice #{selected.invoice_id}</h2>
                            <p>{selected.patient_name} · {selected.doctor_name} · {String(selected.appointment_date).slice(0, 10)}</p>
                        </div>
                        <button className="secondary-button" onClick={downloadReceipt}>Download receipt PDF</button>
                    </div>
                    <div className="form-grid">
                        <label className="field-label">Consultation fee
                            <input value={Number(selected.consultation_fee).toFixed(2)} readOnly />
                        </label>
                        <label className="field-label">Additional treatment charges
                            <input type="number" min="0" step="0.01" value={additionalCharges}
                                onChange={(e) => setAdditionalCharges(e.target.value)} />
                        </label>
                        <p>Total: INR {(Number(selected.consultation_fee) + Number(additionalCharges || 0)).toFixed(2)}</p>
                        <button onClick={saveInvoice}>Save invoice</button>
                    </div>
                    {outstandingBalance > 0 ? (
                        <>
                            <h3 className="subheading">Record a payment</h3>
                            <form className="form-grid" onSubmit={recordPayment}>
                                <input type="number" min="0.01" max={outstandingBalance} step="0.01" placeholder="Amount"
                                    value={payment.amount} required
                                    onChange={(e) => setPayment({ ...payment, amount: e.target.value })} />
                                <select value={payment.payment_method}
                                    onChange={(e) => setPayment({ ...payment, payment_method: e.target.value })}>
                                    {paymentMethods.map((method) => <option key={method}>{method}</option>)}
                                </select>
                                <input placeholder="Reference number (optional)" value={payment.reference_number}
                                    onChange={(e) => setPayment({ ...payment, reference_number: e.target.value })} />
                                <button type="submit">Record payment</button>
                            </form>
                        </>
                    ) : <p>Invoice is paid in full; no payment is due.</p>}
                    <h3 className="subheading">Payment history</h3>
                    {payments.length === 0 ? <p>No payments recorded yet.</p> : (
                        <div className="table-wrapper"><table>
                            <thead><tr><th>Date</th><th>Amount</th><th>Method</th><th>Reference</th></tr></thead>
                            <tbody>{payments.map((item) => (
                                <tr key={item.transaction_id}>
                                    <td>{String(item.paid_at).slice(0, 19)}</td>
                                    <td>{Number(item.amount).toFixed(2)}</td>
                                    <td>{item.payment_method}</td>
                                    <td>{item.reference_number || "-"}</td>
                                </tr>
                            ))}</tbody>
                        </table></div>
                    )}
                </section>
            )}
        </div>
    );
}

export default Billing;
