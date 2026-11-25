import { useEffect, useState } from "react";
import api from "../services/api";

const emptyForm = {
    name: "",
    specialization: "",
    contact: "",
    email: "",
    address: "",
    consultation_fee: "",
    password: "",
    is_active: true
};
const weekDays = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const emptySlot = { day_of_week: "1", start_time: "09:00", end_time: "17:00", slot_minutes: "30" };

function Doctors() {
    const [doctors, setDoctors] = useState([]);
    const [form, setForm] = useState(emptyForm);
    const [editingId, setEditingId] = useState(null);
    const [search, setSearch] = useState("");
    const [message, setMessage] = useState("");
    const [scheduleDoctor, setScheduleDoctor] = useState(null);
    const [availability, setAvailability] = useState([]);
    const [slot, setSlot] = useState(emptySlot);

    const loadDoctors = async () => {
        try {
            const response = await api.get("/doctors", { params: { search } });
            setDoctors(response.data.data);
        } catch {
            setMessage("Unable to load doctors.");
        }
    };

    useEffect(() => {
        loadDoctors();
    }, [search]);

    const handleSubmit = async (event) => {
        event.preventDefault();
        try {
            const body = { ...form, consultation_fee: Number(form.consultation_fee) };
            if (editingId) {
                await api.put(`/doctors/${editingId}`, body);
                setMessage("Doctor updated successfully.");
            } else {
                const response = await api.post("/doctors", body);
                setMessage(response.data.temporaryPassword
                    ? `Doctor added successfully. Temporary password: ${response.data.temporaryPassword}`
                    : "Doctor added successfully.");
            }
            setForm(emptyForm);
            setEditingId(null);
            await loadDoctors();
        } catch (error) {
            setMessage(error.response?.data?.message || "Unable to save doctor.");
        }
    };

    const editDoctor = (doctor) => {
        setEditingId(doctor.doctor_id);
        setForm({
            name: doctor.name || "",
            specialization: doctor.specialization || "",
            contact: doctor.contact || "",
            email: doctor.email || "",
            address: doctor.address || "",
            consultation_fee: doctor.consultation_fee ?? "",
            password: "",
            is_active: doctor.is_active !== false
        });
        window.scrollTo({ top: 0, behavior: "smooth" });
    };

    const deleteDoctor = async (id) => {
        if (!window.confirm("Deactivate this doctor account?")) return;
        try {
            await api.delete(`/doctors/${id}`);
            setMessage("Doctor account deactivated successfully.");
            await loadDoctors();
        } catch (error) {
            setMessage(error.response?.data?.message || "Unable to delete doctor.");
        }
    };

    const openSchedule = async (doctor) => {
        setScheduleDoctor(doctor);
        setMessage("");
        try {
            const response = await api.get(`/doctors/${doctor.doctor_id}/availability`);
            setAvailability(response.data.data.map((item) => ({
                day_of_week: String(item.day_of_week),
                start_time: String(item.start_time).slice(0, 5),
                end_time: String(item.end_time).slice(0, 5),
                slot_minutes: String(item.slot_minutes)
            })));
        } catch (error) {
            setMessage(error.response?.data?.message || "Unable to load working schedule.");
            setScheduleDoctor(null);
        }
    };

    const addSchedule = () => {
        setAvailability((current) => [...current, { ...slot }]);
    };

    const saveSchedule = async () => {
        try {
            await api.put(`/doctors/${scheduleDoctor.doctor_id}/availability`, {
                availability: availability.map((item) => ({
                    ...item,
                    day_of_week: Number(item.day_of_week),
                    slot_minutes: Number(item.slot_minutes)
                }))
            });
            setMessage("Doctor working schedule saved.");
            setScheduleDoctor(null);
        } catch (error) {
            setMessage(error.response?.data?.message || "Unable to save working schedule.");
        }
    };

    return (
        <div>
            <div className="page-heading">
                <div>
                    <h1>Doctors</h1>
                    <p>Manage clinic doctors and their working schedules</p>
                </div>
            </div>
            {message && <p className="message" role="status">{message}</p>}

            <section className="content-card">
                <h2>{editingId ? "Update Doctor" : "Add New Doctor"}</h2>
                <form onSubmit={handleSubmit} className="form-grid">
                    <input placeholder="Doctor name" value={form.name} required
                        onChange={(e) => setForm({ ...form, name: e.target.value })} />
                    <input placeholder="Specialization" value={form.specialization} required
                        onChange={(e) => setForm({ ...form, specialization: e.target.value })} />
                    <input placeholder="Contact" value={form.contact}
                        onChange={(e) => setForm({ ...form, contact: e.target.value })} />
                    <input type="email" placeholder="Email" value={form.email}
                        onChange={(e) => setForm({ ...form, email: e.target.value })} />
                    <input placeholder="Address" value={form.address}
                        onChange={(e) => setForm({ ...form, address: e.target.value })} />
                    <input type="number" min="0" step="0.01" placeholder="Consultation fee"
                        value={form.consultation_fee} required
                        onChange={(e) => setForm({ ...form, consultation_fee: e.target.value })} />
                    <input type="password" minLength="8" placeholder={editingId ? "New password (optional)" : "Initial password (optional)"}
                        value={form.password}
                        onChange={(e) => setForm({ ...form, password: e.target.value })} />
                    {editingId && (
                        <select value={form.is_active ? "true" : "false"}
                            onChange={(e) => setForm({ ...form, is_active: e.target.value === "true" })}>
                            <option value="true">Active</option>
                            <option value="false">Inactive</option>
                        </select>
                    )}
                    <div className="form-actions">
                        <button type="submit">{editingId ? "Update Doctor" : "Add Doctor"}</button>
                        {editingId && <button type="button" className="secondary-button" onClick={() => {
                            setEditingId(null);
                            setForm(emptyForm);
                        }}>Cancel</button>}
                    </div>
                </form>
            </section>

            {scheduleDoctor && (
                <section className="content-card">
                    <h2>Working hours: {scheduleDoctor.name}</h2>
                    <div className="form-grid">
                        <select value={slot.day_of_week}
                            onChange={(e) => setSlot({ ...slot, day_of_week: e.target.value })}>
                            {weekDays.map((day, index) => <option key={day} value={index}>{day}</option>)}
                        </select>
                        <input aria-label="Schedule start time" type="time" value={slot.start_time}
                            onChange={(e) => setSlot({ ...slot, start_time: e.target.value })} />
                        <input aria-label="Schedule end time" type="time" value={slot.end_time}
                            onChange={(e) => setSlot({ ...slot, end_time: e.target.value })} />
                        <input aria-label="Appointment slot minutes" type="number" min="5" max="480"
                            value={slot.slot_minutes}
                            onChange={(e) => setSlot({ ...slot, slot_minutes: e.target.value })} />
                        <button type="button" onClick={addSchedule}>Add time range</button>
                    </div>
                    <ul className="schedule-list">
                        {availability.map((item, index) => (
                            <li key={`${item.day_of_week}-${item.start_time}-${index}`}>
                                {weekDays[Number(item.day_of_week)]}: {item.start_time}-{item.end_time} ({item.slot_minutes} min)
                                <button type="button" className="danger-button" onClick={() =>
                                    setAvailability((items) => items.filter((_, itemIndex) => itemIndex !== index))
                                }>Remove</button>
                            </li>
                        ))}
                    </ul>
                    <div className="form-actions">
                        <button type="button" onClick={saveSchedule}>Save schedule</button>
                        <button type="button" className="secondary-button" onClick={() => setScheduleDoctor(null)}>
                            Close
                        </button>
                    </div>
                </section>
            )}

            <section className="content-card">
                <div className="section-heading">
                    <h2>Doctor Records</h2>
                    <input className="search-input" placeholder="Search name or specialization..."
                        value={search} onChange={(event) => setSearch(event.target.value)} />
                </div>
                <div className="table-wrapper">
                    <table>
                        <thead>
                            <tr>
                                <th>ID</th><th>Name</th><th>Specialization</th><th>Contact</th>
                                <th>Consultation Fee</th><th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {doctors.map((doctor) => (
                                <tr key={doctor.doctor_id}>
                                    <td>{doctor.doctor_id}</td>
                                    <td>{doctor.name}</td>
                                    <td>{doctor.specialization}</td>
                                    <td>{doctor.contact || "-"}</td>
                                    <td>₹{Number(doctor.consultation_fee).toFixed(2)}</td>
                                    <td className="actions">
                                        <button onClick={() => editDoctor(doctor)}>Edit</button>
                                        <button onClick={() => openSchedule(doctor)}>Schedule</button>
                                        <button className="danger-button" onClick={() => deleteDoctor(doctor.doctor_id)}>
                                            Delete
                                        </button>
                                    </td>
                                </tr>
                            ))}
                            {doctors.length === 0 && <tr><td colSpan="6">No doctors found.</td></tr>}
                        </tbody>
                    </table>
                </div>
            </section>
        </div>
    );
}

export default Doctors;
