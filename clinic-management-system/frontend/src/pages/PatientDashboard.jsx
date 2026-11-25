import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import api from "../services/api";
import StatCard from "../components/StatCard";

function PatientDashboard() {
    const location = useLocation();
    const [data, setData] = useState(null);
    const [appointments, setAppointments] = useState([]);
    const [history, setHistory] = useState(null);
    const [doctors, setDoctors] = useState([]);
    const [specialization, setSpecialization] = useState("");
    const [doctorId, setDoctorId] = useState("");
    const [date, setDate] = useState("");
    const [slots, setSlots] = useState([]);
    const [time, setTime] = useState("");
    const [message, setMessage] = useState("");

    const loadBase = async () => {
        try {
            const [dashboard, appointmentResponse, doctorResponse] = await Promise.all([
                api.get("/patient/dashboard"),
                api.get("/patient/appointments"),
                api.get("/doctors")
            ]);
            setData(dashboard.data.data);
            setAppointments(appointmentResponse.data.data);
            setDoctors(doctorResponse.data.data.filter((doctor) => doctor.is_active));
        } catch (error) {
            setMessage(error.response?.data?.message || "Unable to load patient information.");
        }
    };

    const loadHistory = async () => {
        try {
            const response = await api.get("/patient/medical-history");
            setHistory(response.data.data);
        } catch (error) {
            setMessage(error.response?.data?.message || "Unable to load medical history.");
        }
    };

    useEffect(() => {
        loadBase();
        if (location.pathname === "/patient/medical-history") loadHistory();
    }, [location.pathname]);

    useEffect(() => {
        if (!doctorId || !date) {
            setSlots([]);
            setTime("");
            return;
        }
        api.get("/patient/available-slots", { params: { doctorId, date } })
            .then((response) => setSlots(response.data.data))
            .catch((error) => setMessage(error.response?.data?.message || "Unable to load available times."));
    }, [doctorId, date]);

    const cancelAppointment = async (appointmentId) => {
        if (!window.confirm("Cancel this appointment?")) return;
        try {
            await api.put(`/patient/appointments/${appointmentId}/cancel`);
            setMessage("Appointment cancelled.");
            await loadBase();
        } catch (error) {
            setMessage(error.response?.data?.message || "Unable to cancel appointment.");
        }
    };

    const bookAppointment = async (event) => {
        event.preventDefault();
        try {
            await api.post("/patient/appointments", {
                doctor_id: doctorId,
                appointment_date: date,
                appointment_time: time
            });
            setMessage("Appointment booked successfully.");
            setTime("");
            await loadBase();
        } catch (error) {
            setMessage(error.response?.data?.message || "Unable to book appointment.");
        }
    };

    if (!data) return <p className="loading">Loading patient dashboard...</p>;

    if (location.pathname === "/patient/medical-history") {
        return (
            <div>
                <div className="page-heading"><div><h1>Medical History</h1><p>Your diagnoses, prescriptions and payments</p></div></div>
                {message && <p className="message">{message}</p>}
                {history && (
                    <>
                        <section className="content-card"><h2>Medical records</h2>
                            {history.medicalRecords.length ? history.medicalRecords.map((record) => (
                                <div key={record.treatment_id} className="selection-summary">
                                    <strong>{record.diagnosis || "No diagnosis"}</strong>
                                    <p>{record.treatment_details}</p>
                                    <small>{record.doctor_notes}</small>
                                </div>
                            )) : <p>No medical records found.</p>}
                        </section>
                        <section className="content-card"><h2>Prescriptions</h2>
                            {history.prescriptions.length ? history.prescriptions.map((item) => (
                                <p key={item.prescription_id}>{item.medicine} · {item.dosage} · {item.frequency} · {item.duration}</p>
                            )) : <p>No prescriptions found.</p>}
                        </section>
                        <section className="content-card"><h2>Payments</h2>
                            {history.payments.length ? history.payments.map((item) => (
                                <p key={item.invoice_id}>{item.payment_status} · ₹{Number(item.total_amount).toFixed(2)} paid · ₹{Number(item.amount_paid).toFixed(2)}</p>
                            )) : <p>No payment records found.</p>}
                        </section>
                    </>
                )}
            </div>
        );
    }

    if (location.pathname === "/patient/book") {
        const specializations = [...new Set(doctors.map((doctor) => doctor.specialization))];
        const filteredDoctors = specialization ? doctors.filter((doctor) => doctor.specialization === specialization) : doctors;
        return (
            <div>
                <div className="page-heading"><div><h1>Book an Appointment</h1><p>Select a doctor and available time</p></div></div>
                {message && <p className="message">{message}</p>}
                <section className="content-card">
                    <form onSubmit={bookAppointment} className="form-grid">
                        <select value={specialization} onChange={(e) => { setSpecialization(e.target.value); setDoctorId(""); }} required>
                            <option value="">Select specialization</option>
                            {specializations.map((item) => <option key={item} value={item}>{item}</option>)}
                        </select>
                        <select value={doctorId} onChange={(e) => setDoctorId(e.target.value)} required>
                            <option value="">Select doctor</option>
                            {filteredDoctors.map((doctor) => (
                                <option key={doctor.doctor_id} value={doctor.doctor_id}>{doctor.name} · ₹{Number(doctor.consultation_fee).toFixed(2)}</option>
                            ))}
                        </select>
                        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
                        <select value={time} onChange={(e) => setTime(e.target.value)} required>
                            <option value="">Select available time</option>
                            {slots.map((slot) => <option key={slot} value={slot}>{slot}</option>)}
                        </select>
                        <div className="form-actions"><button type="submit" disabled={!time}>Confirm appointment</button></div>
                    </form>
                </section>
            </div>
        );
    }

    if (location.pathname === "/patient/appointments") {
        return (
            <div>
                <div className="page-heading"><div><h1>My Appointments</h1><p>Your upcoming and previous appointments</p></div></div>
                {message && <p className="message">{message}</p>}
                <section className="content-card">
                    <div className="table-wrapper">
                        <table><thead><tr><th>Doctor</th><th>Date</th><th>Time</th><th>Status</th><th>Action</th></tr></thead>
                            <tbody>{appointments.map((appointment) => (
                                <tr key={appointment.appointment_id}>
                                    <td>{appointment.doctor_name}<br /><small>{appointment.specialization}</small></td>
                                    <td>{String(appointment.appointment_date).slice(0, 10)}</td>
                                    <td>{String(appointment.appointment_time).slice(0, 5)}</td>
                                    <td><span className={`status ${appointment.status.toLowerCase()}`}>{appointment.status}</span></td>
                                    <td>{appointment.status === "Scheduled" && <button className="danger-button" onClick={() => cancelAppointment(appointment.appointment_id)}>Cancel</button>}</td>
                                </tr>
                            ))}</tbody>
                        </table>
                    </div>
                </section>
            </div>
        );
    }

    return (
        <div>
            <div className="page-heading"><div><h1>Patient Dashboard</h1><p>{data.patient.name} · Patient #{data.patient.patient_id}</p></div></div>
            {message && <p className="message">{message}</p>}
            <div className="stats-grid">
                <StatCard title="Total Appointments" value={data.totalAppointments} />
                <StatCard title="Upcoming" value={data.upcomingAppointments} />
                <StatCard title="Completed" value={data.completedAppointments} />
                <StatCard title="Cancelled" value={data.cancelledAppointments} />
            </div>
            <section className="content-card"><h2>Next appointment</h2>
                {data.nextAppointment
                    ? <p><strong>{data.nextAppointment.doctor_name}</strong> · {data.nextAppointment.specialization}<br />{String(data.nextAppointment.appointment_date).slice(0, 10)} at {String(data.nextAppointment.appointment_time).slice(0, 5)}</p>
                    : <p>No upcoming appointment.</p>}
            </section>
        </div>
    );
}

export default PatientDashboard;
