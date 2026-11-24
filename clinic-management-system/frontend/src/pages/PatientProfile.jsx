import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import api from "../services/api";
import { downloadPatientMedicalReport } from "../utils/downloads";

function PatientProfile() {
    const { id } = useParams();
    const [history, setHistory] = useState(null);
    const [error, setError] = useState("");

    useEffect(() => {
        api.get(`/patients/${id}/medical-history`)
            .then((response) => setHistory(response.data.data))
            .catch((requestError) => setError(
                requestError.response?.data?.message || "Unable to load patient history."
            ));
    }, [id]);

    const exportPdf = () => {
        downloadPatientMedicalReport(history);
    };

    if (error) return <p className="error">{error}</p>;
    if (!history) return <p className="loading">Loading medical history...</p>;

    const { patient, appointments, medicalRecords, prescriptions, payments } = history;
    return (
        <div className="printable-page">
            <div className="page-heading">
                <div>
                    <h1>Patient Medical History</h1>
                    <p>Patient ID #{patient.patient_id}</p>
                </div>
                <div className="form-actions no-print">
                    <button onClick={exportPdf}>Download PDF</button>
                    <button onClick={() => window.print()}>Print patient report</button>
                    <Link className="button-link" to="/patients">Back to patients</Link>
                </div>
            </div>

            <section className="content-card">
                <h2>{patient.name}</h2>
                <div className="detail-grid">
                    <p><strong>Age:</strong> {patient.age ?? "-"}</p>
                    <p><strong>Gender:</strong> {patient.gender || "-"}</p>
                    <p><strong>Contact:</strong> {patient.contact || "-"}</p>
                    <p><strong>Email:</strong> {patient.email || "-"}</p>
                    <p><strong>Address:</strong> {patient.address || "-"}</p>
                    <p><strong>Blood group:</strong> {patient.blood_group || "-"}</p>
                    <p><strong>Emergency contact:</strong> {patient.emergency_contact || "-"}</p>
                    <p><strong>Registered:</strong> {String(patient.created_at).slice(0, 10)}</p>
                </div>
            </section>

            <section className="content-card">
                <h2>Appointment history</h2>
                {appointments.length === 0 ? <p>No appointments recorded.</p> : (
                    <div className="table-wrapper"><table>
                        <thead><tr><th>Date</th><th>Doctor</th><th>Specialization</th><th>Status</th><th>Bill</th></tr></thead>
                        <tbody>{appointments.map((item) => (
                            <tr key={item.appointment_id}>
                                <td>{String(item.appointment_date).slice(0, 10)} {String(item.appointment_time).slice(0, 5)}</td>
                                <td>{item.doctor_name}</td><td>{item.specialization}</td><td>{item.status}</td>
                                <td>{item.payment_status || "Pending"} · {item.total_amount ?? 0}</td>
                            </tr>
                        ))}</tbody>
                    </table></div>
                )}
            </section>

            <section className="content-card">
                <h2>Diagnoses and treatment</h2>
                {medicalRecords.length === 0 ? <p>No clinical notes recorded.</p> : medicalRecords.map((item) => (
                    <article className="history-entry" key={item.treatment_id}>
                        <h3>{String(item.treatment_date).slice(0, 10)} · {item.doctor_name}</h3>
                        <p><strong>Diagnosis:</strong> {item.diagnosis || "-"}</p>
                        <p><strong>Treatment:</strong> {item.treatment_details || "-"}</p>
                        <p><strong>Doctor notes:</strong> {item.doctor_notes || "-"}</p>
                        <p><strong>Follow-up:</strong> {item.follow_up_date || "-"}</p>
                    </article>
                ))}
            </section>

            <section className="content-card">
                <h2>Prescriptions</h2>
                {prescriptions.length === 0 ? <p>No prescriptions recorded.</p> : (
                    <div className="table-wrapper"><table>
                        <thead><tr><th>Date</th><th>Medicine</th><th>Dosage</th><th>Frequency</th><th>Duration</th><th>Instructions</th></tr></thead>
                        <tbody>{prescriptions.map((item) => (
                            <tr key={item.prescription_id}>
                                <td>{String(item.treatment_date).slice(0, 10)}</td><td>{item.medicine}</td>
                                <td>{item.dosage || "-"}</td><td>{item.frequency || "-"}</td>
                                <td>{item.duration || "-"}</td><td>{item.instructions || "-"}</td>
                            </tr>
                        ))}</tbody>
                    </table></div>
                )}
            </section>

            <section className="content-card">
                <h2>Payments and balances</h2>
                {payments.length === 0 ? <p>No invoices or payments recorded.</p> : (
                    <div className="table-wrapper"><table>
                        <thead><tr><th>Invoice</th><th>Payment date</th><th>Amount paid</th><th>Method</th><th>Total</th><th>Balance</th><th>Status</th></tr></thead>
                        <tbody>{payments.map((item, index) => (
                            <tr key={`${item.invoice_id}-${item.transaction_id || index}`}>
                                <td>{item.invoice_id}</td><td>{item.paid_at ? String(item.paid_at).slice(0, 10) : "-"}</td>
                                <td>{item.amount ?? item.amount_paid}</td><td>{item.payment_method || "-"}</td>
                                <td>{item.total_amount}</td>
                                <td>{Number(item.total_amount) - Number(item.amount_paid)}</td>
                                <td>{item.payment_status}</td>
                            </tr>
                        ))}</tbody>
                    </table></div>
                )}
            </section>
        </div>
    );
}

export default PatientProfile;
