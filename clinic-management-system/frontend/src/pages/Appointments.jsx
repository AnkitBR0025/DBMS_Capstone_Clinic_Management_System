import { useEffect, useState } from "react";
import api from "../services/api";
import {
    downloadPatientMedicalReport,
    openPatientReportPrintWindow,
    printPatientMedicalReport
} from "../utils/downloads";
import paymentMethods from "../utils/paymentMethods";

const initialForm = {
    patient_id: "",
    doctor_id: "",
    appointment_date: "",
    appointment_time: "",
    payment_method: ""
};
const emptyPatient = {
    name: "",
    age: "",
    gender: "",
    contact: "",
    email: "",
    address: "",
    blood_group: "",
    emergency_contact: ""
};

function Appointments() {
    const [appointments, setAppointments] = useState([]);
    const [patients, setPatients] = useState([]);
    const [doctors, setDoctors] = useState([]);
    const [form, setForm] = useState(initialForm);
    const [newPatient, setNewPatient] = useState(emptyPatient);
    const [showNewPatient, setShowNewPatient] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [availableTimes, setAvailableTimes] = useState([]);
    const [filters, setFilters] = useState({
        date: "",
        patientId: "",
        doctorId: "",
        status: "",
        search: ""
    });
    const [message, setMessage] = useState("");
    const [loading, setLoading] = useState(true);
    const [recentlyBookedPatient, setRecentlyBookedPatient] = useState(null);

    const loadData = async () => {
        setLoading(true);
        try {
            const [appointmentResponse, patientResponse, doctorResponse] = await Promise.all([
                api.get("/appointments", { params: filters }),
                api.get("/patients"),
                api.get("/doctors")
            ]);
            setAppointments(appointmentResponse.data.data);
            setPatients(patientResponse.data.data);
            setDoctors(doctorResponse.data.data.filter((doctor) => doctor.is_active));
        } catch {
            setMessage("Unable to load appointment information.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, [filters]);

    useEffect(() => {
        if (!form.doctor_id || !form.appointment_date) {
            setAvailableTimes([]);
            return;
        }
        let active = true;
        const loadAvailableTimes = () => {
            api.get("/appointments/availability", {
                params: {
                    doctorId: form.doctor_id,
                    date: form.appointment_date,
                    appointmentId: editingId || undefined
                }
            })
                .then((response) => {
                    if (!active) return;
                    const times = response.data.data;
                    setAvailableTimes(times);
                    setForm((current) => (
                        !editingId && current.appointment_time && !times.includes(current.appointment_time)
                            ? { ...current, appointment_time: "" }
                            : current
                    ));
                })
                .catch((error) => {
                    if (active) {
                        setAvailableTimes([]);
                        setMessage(error.response?.data?.message || "Unable to check doctor availability.");
                    }
                });
        };
        loadAvailableTimes();
        const interval = window.setInterval(loadAvailableTimes, 10000);
        window.addEventListener("focus", loadAvailableTimes);
        return () => {
            active = false;
            window.clearInterval(interval);
            window.removeEventListener("focus", loadAvailableTimes);
        };
    }, [form.doctor_id, form.appointment_date, editingId]);

    const selectedPatient = patients.find((patient) =>
        String(patient.patient_id) === String(form.patient_id)
    );
    const selectedDoctor = doctors.find((doctor) =>
        String(doctor.doctor_id) === String(form.doctor_id)
    );

    const handleSubmit = async (event) => {
        event.preventDefault();
        try {
            if (editingId) {
                await api.put(`/appointments/${editingId}`, form);
                setMessage("Appointment rescheduled successfully.");
            } else {
                const response = await api.post("/appointments", form);
                setMessage(response.data.message || "Appointment booked successfully.");
                setRecentlyBookedPatient({
                    id: form.patient_id,
                    name: selectedPatient?.name || "patient"
                });
            }
            setForm(initialForm);
            setEditingId(null);
            await loadData();
        } catch (error) {
            setMessage(error.response?.data?.message || "Unable to save appointment.");
        }
    };

    const downloadPatientReport = async (patientId) => {
        try {
            const response = await api.get(`/patients/${patientId}/medical-history`);
            downloadPatientMedicalReport(response.data.data);
        } catch (error) {
            setMessage(error.response?.data?.message || "Unable to download patient report.");
        }
    };

    const printPatientReport = async (patientId) => {
        let printWindow;
        try {
            printWindow = openPatientReportPrintWindow();
            const response = await api.get(`/patients/${patientId}/medical-history`);
            printPatientMedicalReport(response.data.data, printWindow);
        } catch (error) {
            if (printWindow && !printWindow.closed) printWindow.close();
            setMessage(error.response?.data?.message || error.message || "Unable to print patient report.");
        }
    };

    const createPatient = async (event) => {
        event.preventDefault();
        try {
            const response = await api.post("/patients", newPatient);
            const patientResponse = await api.get("/patients");
            setPatients(patientResponse.data.data);
            setForm((current) => ({ ...current, patient_id: String(response.data.patientId) }));
            setNewPatient(emptyPatient);
            setShowNewPatient(false);
            setMessage("Patient added and selected for the appointment.");
        } catch (error) {
            setMessage(error.response?.data?.message || "Unable to add patient.");
        }
    };

    const updateStatus = async (appointment, status) => {
        try {
            await api.put(`/appointments/${appointment.appointment_id}`, {
                patient_id: appointment.patient_id,
                doctor_id: appointment.doctor_id,
                appointment_date: String(appointment.appointment_date).slice(0, 10),
                appointment_time: String(appointment.appointment_time).slice(0, 5),
                status
            });
            setMessage("Appointment status updated.");
            await loadData();
        } catch (error) {
            setMessage(error.response?.data?.message || "Unable to update appointment.");
        }
    };

    const startReschedule = (appointment) => {
        setEditingId(appointment.appointment_id);
        setForm({
            patient_id: String(appointment.patient_id),
            doctor_id: String(appointment.doctor_id),
            appointment_date: String(appointment.appointment_date).slice(0, 10),
            appointment_time: String(appointment.appointment_time).slice(0, 5)
        });
        window.scrollTo({ top: 0, behavior: "smooth" });
    };

    const deleteAppointment = async (id) => {
        if (!window.confirm("Delete this appointment? Billing or medical records may prevent deletion.")) return;
        try {
            await api.delete(`/appointments/${id}`);
            setMessage("Appointment deleted successfully.");
            await loadData();
        } catch (error) {
            setMessage(error.response?.data?.message || "Unable to delete appointment.");
        }
    };

    return (
        <div>
            <div className="page-heading">
                <div>
                    <h1>Appointments</h1>
                    <p>Book, search and manage patient appointments</p>
                </div>
            </div>
            {message && <p className="message" role="status">{message}</p>}
            {recentlyBookedPatient && (
                <div className="selection-summary">
                    <p>Appointment booked for {recentlyBookedPatient.name}.</p>
                    <div className="form-actions">
                        <button type="button" className="secondary-button"
                            onClick={() => downloadPatientReport(recentlyBookedPatient.id)}>
                            Download patient report
                        </button>
                        <button type="button"
                            onClick={() => printPatientReport(recentlyBookedPatient.id)}>
                            Print patient report
                        </button>
                    </div>
                </div>
            )}

            <section className="content-card">
                <h2>{editingId ? "Reschedule Appointment" : "Book Appointment"}</h2>
                <form onSubmit={handleSubmit} className="form-grid">
                    <select value={form.patient_id} required
                        onChange={(e) => setForm({ ...form, patient_id: e.target.value })}>
                        <option value="">Select patient</option>
                        {patients.map((patient) => (
                            <option key={patient.patient_id} value={patient.patient_id}>
                                {patient.name} (#{patient.patient_id})
                            </option>
                        ))}
                    </select>
                    <button type="button" className="secondary-button"
                        onClick={() => setShowNewPatient((current) => !current)}>
                        {showNewPatient ? "Close new patient form" : "Add a new patient"}
                    </button>
                    <select value={form.doctor_id} required
                        onChange={(e) => setForm({ ...form, doctor_id: e.target.value, appointment_time: "" })}>
                        <option value="">Select doctor</option>
                        {doctors.map((doctor) => (
                            <option key={doctor.doctor_id} value={doctor.doctor_id}>
                                {doctor.name} - {doctor.specialization}
                            </option>
                        ))}
                    </select>
                    <input type="date" value={form.appointment_date} required
                        onChange={(e) => setForm({ ...form, appointment_date: e.target.value, appointment_time: "" })} />
                    <select value={form.appointment_time} required
                        onChange={(e) => setForm({ ...form, appointment_time: e.target.value })}>
                        <option value="">Select available time</option>
                        {availableTimes.map((time) => <option key={time} value={time}>{time}</option>)}
                        {editingId && form.appointment_time && !availableTimes.includes(form.appointment_time) && (
                            <option value={form.appointment_time}>{form.appointment_time} (current)</option>
                        )}
                    </select>
                    {!editingId && selectedDoctor && (
                        <>
                            <label className="field-label">Consultation fee (paid at booking)
                                <input
                                    type="number"
                                    value={Number(selectedDoctor.consultation_fee).toFixed(2)}
                                    readOnly
                                />
                            </label>
                            {Number(selectedDoctor.consultation_fee) > 0 && (
                                <label className="field-label">Payment method
                                    <select value={form.payment_method} required
                                        onChange={(e) => setForm({ ...form, payment_method: e.target.value })}>
                                        <option value="">Select payment method</option>
                                        {paymentMethods.map((method) => <option key={method}>{method}</option>)}
                                    </select>
                                </label>
                            )}
                        </>
                    )}
                    {editingId && (
                        <p className="selection-summary">
                            The original consultation fee on this invoice will not change when rescheduling.
                        </p>
                    )}
                    {selectedPatient && (
                        <p className="selection-summary">
                            Patient: {selectedPatient.name} · {selectedPatient.contact || "No phone"} ·
                            {selectedPatient.email || " No email"}
                        </p>
                    )}
                    {selectedDoctor && !editingId && (
                        <p className="selection-summary">
                            {selectedDoctor.specialization}
                        </p>
                    )}
                    <div className="form-actions">
                        <button type="submit">{editingId ? "Save reschedule" : "Book Appointment"}</button>
                        {editingId && <button type="button" className="secondary-button" onClick={() => {
                            setEditingId(null);
                            setForm(initialForm);
                        }}>Cancel reschedule</button>}
                    </div>
                </form>

                {showNewPatient && (
                    <form onSubmit={createPatient} className="form-grid nested-form">
                        <h3>Add patient to database</h3>
                        <input placeholder="Full name" value={newPatient.name} required
                            onChange={(e) => setNewPatient({ ...newPatient, name: e.target.value })} />
                        <input type="number" min="0" max="130" placeholder="Age" value={newPatient.age}
                            onChange={(e) => setNewPatient({ ...newPatient, age: e.target.value })} />
                        <select value={newPatient.gender}
                            onChange={(e) => setNewPatient({ ...newPatient, gender: e.target.value })}>
                            <option value="">Select gender</option>
                            <option>Male</option><option>Female</option><option>Other</option>
                        </select>
                        <input placeholder="Contact number" value={newPatient.contact}
                            onChange={(e) => setNewPatient({ ...newPatient, contact: e.target.value })} />
                        <input type="email" placeholder="Email" value={newPatient.email}
                            onChange={(e) => setNewPatient({ ...newPatient, email: e.target.value })} />
                        <input placeholder="Address" value={newPatient.address}
                            onChange={(e) => setNewPatient({ ...newPatient, address: e.target.value })} />
                        <div className="form-actions">
                            <button type="submit">Save and select patient</button>
                        </div>
                    </form>
                )}
            </section>

            <section className="content-card">
                <h2>Appointment Records</h2>
                <div className="form-grid appointment-filters">
                    <input type="date" aria-label="Filter by date" value={filters.date}
                        onChange={(e) => setFilters({ ...filters, date: e.target.value })} />
                    <select aria-label="Filter by patient" value={filters.patientId}
                        onChange={(e) => setFilters({ ...filters, patientId: e.target.value })}>
                        <option value="">All patients</option>
                        {patients.map((patient) => <option key={patient.patient_id} value={patient.patient_id}>
                            {patient.name}
                        </option>)}
                    </select>
                    <select aria-label="Filter by doctor" value={filters.doctorId}
                        onChange={(e) => setFilters({ ...filters, doctorId: e.target.value })}>
                        <option value="">All doctors</option>
                        {doctors.map((doctor) => <option key={doctor.doctor_id} value={doctor.doctor_id}>
                            {doctor.name}
                        </option>)}
                    </select>
                    <select aria-label="Filter by status" value={filters.status}
                        onChange={(e) => setFilters({ ...filters, status: e.target.value })}>
                        <option value="">All statuses</option>
                        <option>Scheduled</option><option>Completed</option><option>Cancelled</option>
                    </select>
                    <input placeholder="Search patient, doctor or ID" value={filters.search}
                        onChange={(e) => setFilters({ ...filters, search: e.target.value })} />
                </div>
                <div className="table-wrapper">
                    <table>
                        <thead>
                            <tr>
                                <th>ID</th><th>Patient</th><th>Doctor</th><th>Date</th>
                                <th>Time</th><th>Status</th><th>Payment</th><th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {appointments.map((appointment) => (
                                <tr key={appointment.appointment_id}>
                                    <td>{appointment.appointment_id}</td>
                                    <td>{appointment.patient_name}</td>
                                    <td>{appointment.doctor_name}</td>
                                    <td>{String(appointment.appointment_date).slice(0, 10)}</td>
                                    <td>{String(appointment.appointment_time).slice(0, 5)}</td>
                                    <td>
                                        <select value={appointment.status}
                                            onChange={(e) => updateStatus(appointment, e.target.value)}>
                                            <option>Scheduled</option><option>Completed</option><option>Cancelled</option>
                                        </select>
                                    </td>
                                    <td>{appointment.payment_status || "Pending"}</td>
                                    <td className="actions">
                                        <button onClick={() => startReschedule(appointment)}>Reschedule</button>
                                        <button className="danger-button"
                                            onClick={() => deleteAppointment(appointment.appointment_id)}>
                                            Delete
                                        </button>
                                    </td>
                                </tr>
                            ))}
                            {!loading && appointments.length === 0 && (
                                <tr><td colSpan="8">No appointments found.</td></tr>
                            )}
                            {loading && <tr><td colSpan="8">Loading appointments...</td></tr>}
                        </tbody>
                    </table>
                </div>
            </section>
        </div>
    );
}

export default Appointments;
