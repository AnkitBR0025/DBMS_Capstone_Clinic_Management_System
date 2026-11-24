import { useEffect, useState } from "react";
import api from "../services/api";
import { downloadPdf } from "../utils/downloads";

const blankMedicine = { medicine: "", dosage: "", frequency: "", duration: "", instructions: "" };

function Prescriptions() {
    const [prescriptions, setPrescriptions] = useState([]);
    const [appointments, setAppointments] = useState([]);
    const [form, setForm] = useState({
        appointment_id: "",
        diagnosis: "",
        treatment_details: "",
        doctor_notes: "",
        follow_up_date: "",
        medicines: [{ ...blankMedicine }]
    });
    const [search, setSearch] = useState("");
    const [message, setMessage] = useState("");
    const [loading, setLoading] = useState(true);

    const loadData = async () => {
        setLoading(true);
        try {
            const [prescriptionResponse, appointmentResponse] = await Promise.all([
                api.get("/prescriptions", { params: { search } }),
                api.get("/appointments", { params: { status: "Completed" } })
            ]);
            setPrescriptions(prescriptionResponse.data.data);
            setAppointments(appointmentResponse.data.data);
        } catch (error) {
            setMessage(error.response?.data?.message || "Unable to load prescription information.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, [search]);

    const updateMedicine = (index, field, value) => {
        setForm((current) => ({
            ...current,
            medicines: current.medicines.map((item, itemIndex) =>
                itemIndex === index ? { ...item, [field]: value } : item
            )
        }));
    };

    const submit = async (event) => {
        event.preventDefault();
        try {
            await api.post("/prescriptions", form);
            setMessage("Diagnosis and prescription saved.");
            setForm({
                appointment_id: "",
                diagnosis: "",
                treatment_details: "",
                doctor_notes: "",
                follow_up_date: "",
                medicines: [{ ...blankMedicine }]
            });
            await loadData();
        } catch (error) {
            setMessage(error.response?.data?.message || "Unable to save prescription.");
        }
    };

    const printPrescription = async (treatmentId) => {
        try {
            const response = await api.get(`/prescriptions/treatment/${treatmentId}`);
            const items = response.data.data;
            const first = items[0];
            downloadPdf(`HealthDesk Prescription - ${first.patient_name}`, [
                `Patient: ${first.patient_name} (ID ${first.patient_id})`,
                `Doctor: ${first.doctor_name}`,
                `Appointment: ${String(first.appointment_date).slice(0, 10)}`,
                `Diagnosis: ${first.diagnosis || "-"}`,
                `Treatment: ${first.treatment_details || "-"}`,
                `Doctor notes: ${first.doctor_notes || "-"}`,
                `Follow-up: ${first.follow_up_date || "-"}`,
                "",
                "Medicines:",
                ...items.map((item, index) =>
                    `${index + 1}. ${item.medicine} | Dosage: ${item.dosage || "-"} | Frequency: ${item.frequency || "-"} | Duration: ${item.duration || "-"} | Instructions: ${item.instructions || "-"}`
                )
            ], `prescription-${treatmentId}.pdf`);
        } catch (error) {
            setMessage(error.response?.data?.message || "Unable to generate prescription PDF.");
        }
    };

    return (
        <div>
            <div className="page-heading">
                <div><h1>Prescriptions</h1><p>Document diagnoses, treatments and medicines</p></div>
            </div>
            {message && <p className="message" role="status">{message}</p>}

            <section className="content-card">
                <h2>New clinical record</h2>
                <form onSubmit={submit} className="form-grid">
                    <select value={form.appointment_id} required
                        onChange={(e) => setForm({ ...form, appointment_id: e.target.value })}>
                        <option value="">Select completed appointment</option>
                        {appointments.map((appointment) => (
                            <option key={appointment.appointment_id} value={appointment.appointment_id}>
                                #{appointment.appointment_id} · {appointment.patient_name} · {appointment.doctor_name} ·
                                {String(appointment.appointment_date).slice(0, 10)}
                            </option>
                        ))}
                    </select>
                    <input placeholder="Diagnosis" value={form.diagnosis}
                        onChange={(e) => setForm({ ...form, diagnosis: e.target.value })} />
                    <input placeholder="Treatment provided" value={form.treatment_details}
                        onChange={(e) => setForm({ ...form, treatment_details: e.target.value })} />
                    <textarea placeholder="Doctor notes" value={form.doctor_notes}
                        onChange={(e) => setForm({ ...form, doctor_notes: e.target.value })} />
                    <label className="field-label">Follow-up date
                        <input type="date" value={form.follow_up_date}
                            onChange={(e) => setForm({ ...form, follow_up_date: e.target.value })} />
                    </label>

                    <div className="medicine-editor">
                        <h3>Medicines</h3>
                        {form.medicines.map((medicine, index) => (
                            <div className="medicine-row" key={index}>
                                <input aria-label="Medicine name" placeholder="Medicine name" required
                                    value={medicine.medicine} onChange={(e) => updateMedicine(index, "medicine", e.target.value)} />
                                <input aria-label="Dosage" placeholder="Dosage" value={medicine.dosage}
                                    onChange={(e) => updateMedicine(index, "dosage", e.target.value)} />
                                <input aria-label="Frequency" placeholder="Frequency" value={medicine.frequency}
                                    onChange={(e) => updateMedicine(index, "frequency", e.target.value)} />
                                <input aria-label="Duration" placeholder="Duration" value={medicine.duration}
                                    onChange={(e) => updateMedicine(index, "duration", e.target.value)} />
                                <input aria-label="Instructions" placeholder="Instructions" value={medicine.instructions}
                                    onChange={(e) => updateMedicine(index, "instructions", e.target.value)} />
                                {form.medicines.length > 1 && <button type="button" className="danger-button"
                                    onClick={() => setForm((current) => ({
                                        ...current,
                                        medicines: current.medicines.filter((_, itemIndex) => itemIndex !== index)
                                    }))}>Remove</button>}
                            </div>
                        ))}
                        <button type="button" className="secondary-button"
                            onClick={() => setForm((current) => ({
                                ...current,
                                medicines: [...current.medicines, { ...blankMedicine }]
                            }))}>Add medicine</button>
                    </div>
                    <div className="form-actions"><button type="submit">Save medical record</button></div>
                </form>
            </section>

            <section className="content-card">
                <div className="section-heading">
                    <h2>Previous prescriptions</h2>
                    <input className="search-input" placeholder="Search patient, doctor or medicine"
                        value={search} onChange={(e) => setSearch(e.target.value)} />
                </div>
                <div className="table-wrapper">
                    <table>
                        <thead><tr><th>Date</th><th>Patient</th><th>Doctor</th><th>Diagnosis</th>
                            <th>Medicine</th><th>Dosage</th><th>Frequency</th><th>Duration</th><th>PDF</th></tr></thead>
                        <tbody>
                            {prescriptions.map((item) => (
                                <tr key={item.prescription_id}>
                                    <td>{String(item.treatment_date).slice(0, 10)}</td>
                                    <td>{item.patient_name}</td><td>{item.doctor_name}</td>
                                    <td>{item.diagnosis || "-"}</td><td>{item.medicine}</td>
                                    <td>{item.dosage || "-"}</td><td>{item.frequency || "-"}</td>
                                    <td>{item.duration || "-"}</td>
                                    <td><button onClick={() => printPrescription(item.treatment_id)}>Download</button></td>
                                </tr>
                            ))}
                            {!loading && prescriptions.length === 0 && <tr><td colSpan="9">No prescriptions found.</td></tr>}
                            {loading && <tr><td colSpan="9">Loading prescriptions...</td></tr>}
                        </tbody>
                    </table>
                </div>
            </section>
        </div>
    );
}

export default Prescriptions;
