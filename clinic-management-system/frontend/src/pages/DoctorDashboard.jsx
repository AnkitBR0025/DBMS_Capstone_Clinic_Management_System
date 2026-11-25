import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import api from "../services/api";
import StatCard from "../components/StatCard";

function DoctorDashboard() {
    const location = useLocation();
    const [data, setData] = useState(null);
    const [availability, setAvailability] = useState([]);
    const [blockedSlots, setBlockedSlots] = useState([]);
    const [blockForm, setBlockForm] = useState({ blocked_date: "", start_time: "", end_time: "", reason: "" });
    const [newSchedule, setNewSchedule] = useState({ day_of_week: "1", start_time: "09:00", end_time: "17:00", slot_minutes: 30 });
    const [message, setMessage] = useState("");

    const loadDashboard = async () => {
        try {
            const dashboardResponse = await api.get("/doctor/dashboard");
            setData(dashboardResponse.data.data);
        } catch (error) {
            setMessage(error.response?.data?.message || "Unable to load doctor dashboard.");
        }
    };

    const loadSchedule = async () => {
        try {
            const response = await api.get("/doctor/availability");
            setAvailability(response.data.data.availability);
            setBlockedSlots(response.data.data.blockedSlots);
        } catch (error) {
            setMessage(error.response?.data?.message || "Unable to load schedule.");
        }
    };

    useEffect(() => {
        loadDashboard();
        if (location.pathname === "/doctor/schedule") loadSchedule();
    }, [location.pathname]);

    const updateStatus = async (appointmentId, status) => {
        try {
            await api.put(`/doctor/appointments/${appointmentId}/status`, { status });
            await loadDashboard();
            setMessage("Appointment status updated.");
        } catch (error) {
            setMessage(error.response?.data?.message || "Unable to update appointment.");
        }
    };

    const saveTreatment = async (appointmentId) => {
        const diagnosis = window.prompt("Diagnosis:");
        if (diagnosis === null) return;
        const treatmentDetails = window.prompt("Treatment details:", "") || "";
        const doctorNotes = window.prompt("Doctor notes:", "") || "";
        try {
            await api.put(`/doctor/appointments/${appointmentId}/treatment`, {
                diagnosis,
                treatment_details: treatmentDetails,
                doctor_notes: doctorNotes
            });
            setMessage("Diagnosis and treatment details saved.");
        } catch (error) {
            setMessage(error.response?.data?.message || "Unable to save treatment.");
        }
    };

    const saveSchedule = async (event) => {
        event.preventDefault();
        const rows = availability.map((item) => ({
            day_of_week: item.day_of_week,
            start_time: String(item.start_time).slice(0, 5),
            end_time: String(item.end_time).slice(0, 5),
            slot_minutes: item.slot_minutes
        }));
        try {
            await api.put("/doctor/availability", { availability: rows });
            setMessage("Availability updated.");
            await loadSchedule();
        } catch (error) {
            setMessage(error.response?.data?.message || "Unable to update availability.");
        }
    };

    const addScheduleRange = () => {
        setAvailability((rows) => [
            ...rows,
            {
                availability_id: `new-${Date.now()}`,
                day_of_week: Number(newSchedule.day_of_week),
                start_time: newSchedule.start_time,
                end_time: newSchedule.end_time,
                slot_minutes: Number(newSchedule.slot_minutes)
            }
        ]);
    };

    const blockSlot = async (event) => {
        event.preventDefault();
        try {
            await api.post("/doctor/blocked-slots", blockForm);
            setBlockForm({ blocked_date: "", start_time: "", end_time: "", reason: "" });
            await loadSchedule();
            setMessage("Time slot blocked.");
        } catch (error) {
            setMessage(error.response?.data?.message || "Unable to block time.");
        }
    };

    if (location.pathname === "/doctor/schedule") {
        return (
            <div>
                <div className="page-heading"><div><h1>Schedule</h1><p>Manage working hours and blocked slots</p></div></div>
                {message && <p className="message">{message}</p>}
                <section className="content-card">
                    <h2>Weekly availability</h2>
                    <form onSubmit={saveSchedule} className="form-grid">
                        <select value={newSchedule.day_of_week} onChange={(e) => setNewSchedule({ ...newSchedule, day_of_week: e.target.value })}>
                            {["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"].map((day, index) =>
                                <option key={day} value={index}>{day}</option>
                            )}
                        </select>
                        <input type="time" value={newSchedule.start_time} onChange={(e) => setNewSchedule({ ...newSchedule, start_time: e.target.value })} />
                        <input type="time" value={newSchedule.end_time} onChange={(e) => setNewSchedule({ ...newSchedule, end_time: e.target.value })} />
                        <select value={newSchedule.slot_minutes} onChange={(e) => setNewSchedule({ ...newSchedule, slot_minutes: Number(e.target.value) })}>
                            {[15, 20, 30, 60].map((slot) => <option key={slot} value={slot}>{slot} minutes</option>)}
                        </select>
                        <button type="button" onClick={addScheduleRange}>Add time range</button>
                        {availability.map((item, index) => (
                            <div key={item.availability_id || index} className="selection-summary">
                                <strong>Day {item.day_of_week}</strong>
                                <input type="time" value={String(item.start_time).slice(0, 5)}
                                    onChange={(e) => setAvailability((rows) => rows.map((row, i) => i === index ? { ...row, start_time: e.target.value } : row))} />
                                <input type="time" value={String(item.end_time).slice(0, 5)}
                                    onChange={(e) => setAvailability((rows) => rows.map((row, i) => i === index ? { ...row, end_time: e.target.value } : row))} />
                                <select value={item.slot_minutes} onChange={(e) => setAvailability((rows) => rows.map((row, i) => i === index ? { ...row, slot_minutes: Number(e.target.value) } : row))}>
                                    {[15, 20, 30, 60].map((slot) => <option key={slot} value={slot}>{slot} minutes</option>)}
                                </select>
                            </div>
                        ))}
                        {availability.length === 0 && <p>No weekly schedule configured.</p>}
                        <div className="form-actions"><button type="submit">Save availability</button></div>
                    </form>
                </section>
                <section className="content-card">
                    <h2>Block a date and time</h2>
                    <form onSubmit={blockSlot} className="form-grid">
                        <input type="date" value={blockForm.blocked_date} onChange={(e) => setBlockForm({ ...blockForm, blocked_date: e.target.value })} required />
                        <input type="time" value={blockForm.start_time} onChange={(e) => setBlockForm({ ...blockForm, start_time: e.target.value })} required />
                        <input type="time" value={blockForm.end_time} onChange={(e) => setBlockForm({ ...blockForm, end_time: e.target.value })} required />
                        <input placeholder="Reason" value={blockForm.reason} onChange={(e) => setBlockForm({ ...blockForm, reason: e.target.value })} />
                        <div className="form-actions"><button type="submit">Block slot</button></div>
                    </form>
                    {blockedSlots.map((slot) => (
                        <p key={slot.block_id}>{String(slot.blocked_date).slice(0, 10)} · {String(slot.start_time).slice(0, 5)}-{String(slot.end_time).slice(0, 5)} · {slot.reason || "Unavailable"}</p>
                    ))}
                </section>
            </div>
        );
    }

    if (!data) return <p className="loading">Loading doctor dashboard...</p>;
    const appointmentsOnly = location.pathname === "/doctor/appointments";
    return (
        <div>
            <div className="page-heading"><div><h1>{appointmentsOnly ? "My Appointments" : "Doctor Dashboard"}</h1><p>Manage your own patients and appointments</p></div></div>
            {message && <p className="message">{message}</p>}
            {!appointmentsOnly && (
                <div className="stats-grid">
                    <StatCard title="Total Appointments" value={data.totalAppointments} />
                    <StatCard title="Today's Appointments" value={data.todayAppointments} />
                    <StatCard title="Upcoming" value={data.upcomingAppointments} />
                    <StatCard title="Completed" value={data.completedAppointments} />
                    <StatCard title="Cancelled" value={data.cancelledAppointments} />
                </div>
            )}
            <section className="content-card">
                <h2>Appointments</h2>
                <div className="table-wrapper">
                    <table><thead><tr><th>Patient</th><th>Date</th><th>Time</th><th>Status</th><th>Actions</th></tr></thead>
                        <tbody>{data.appointments.map((appointment) => (
                            <tr key={appointment.appointment_id}>
                                <td>{appointment.patient_name}<br /><small>{appointment.patient_contact}</small></td>
                                <td>{String(appointment.appointment_date).slice(0, 10)}</td>
                                <td>{String(appointment.appointment_time).slice(0, 5)}</td>
                                <td><span className={`status ${appointment.status.toLowerCase()}`}>{appointment.status}</span></td>
                                <td className="actions">
                                    <button onClick={() => updateStatus(appointment.appointment_id, "Completed")}>Complete</button>
                                    <button className="danger-button" onClick={() => updateStatus(appointment.appointment_id, "Cancelled")}>Cancel</button>
                                    <button onClick={() => saveTreatment(appointment.appointment_id)}>Treatment</button>
                                </td>
                            </tr>
                        ))}</tbody>
                    </table>
                </div>
            </section>
        </div>
    );
}

export default DoctorDashboard;
