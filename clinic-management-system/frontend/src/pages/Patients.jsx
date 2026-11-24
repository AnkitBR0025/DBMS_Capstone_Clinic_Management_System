import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../services/api";

const emptyForm = {
    name: "",
    age: "",
    gender: "",
    contact: "",
    address: "",
    email: "",
    blood_group: "",
    emergency_contact: ""
};

function Patients() {
    const [patients, setPatients] = useState([]);
    const [form, setForm] = useState(emptyForm);
    const [editingId, setEditingId] = useState(null);
    const [search, setSearch] = useState("");
    const [message, setMessage] = useState("");

    const loadPatients = async () => {
        try {
            const response = await api.get("/patients");
            setPatients(response.data.data);
        } catch {
            setMessage("Unable to load patients.");
        }
    };

    useEffect(() => {
        loadPatients();
    }, []);

    const handleChange = (event) => {
        setForm({
            ...form,
            [event.target.name]: event.target.value
        });
    };

    const handleSubmit = async (event) => {
        event.preventDefault();

        try {
            if (editingId) {
                await api.put(`/patients/${editingId}`, form);
                setMessage("Patient updated successfully.");
            } else {
                await api.post("/patients", form);
                setMessage("Patient added successfully.");
            }

            setForm(emptyForm);
            setEditingId(null);
            loadPatients();
        } catch (error) {
            setMessage(error.response?.data?.message || "Operation failed.");
        }
    };

    const editPatient = (patient) => {
        setEditingId(patient.patient_id);
        setForm({
            name: patient.name || "",
            age: patient.age ?? "",
            gender: patient.gender || "",
            contact: patient.contact || "",
            address: patient.address || "",
            email: patient.email || "",
            blood_group: patient.blood_group || "",
            emergency_contact: patient.emergency_contact || ""
        });

        window.scrollTo({ top: 0, behavior: "smooth" });
    };

    const deletePatient = async (id) => {
        if (!window.confirm("Are you sure you want to delete this patient?")) {
            return;
        }

        try {
            await api.delete(`/patients/${id}`);
            setMessage("Patient deleted successfully.");
            loadPatients();
        } catch (error) {
            setMessage(error.response?.data?.message || "Unable to delete patient.");
        }
    };

    const filteredPatients = patients.filter((patient) =>
        patient.name.toLowerCase().includes(search.toLowerCase()) ||
        String(patient.contact || "").includes(search)
    );

    return (
        <div>
            <div className="page-heading">
                <div>
                    <h1>Patients</h1>
                    <p>Manage registered patient information</p>
                </div>
            </div>

            {message && <p className="message">{message}</p>}

            <section className="content-card">
                <h2>{editingId ? "Update Patient" : "Add New Patient"}</h2>

                <form onSubmit={handleSubmit} className="form-grid">
                    <input
                        name="name"
                        placeholder="Patient name"
                        value={form.name}
                        onChange={handleChange}
                        required
                    />

                    <input
                        name="age"
                        type="number"
                        min="0"
                        placeholder="Age"
                        value={form.age}
                        onChange={handleChange}
                    />

                    <select
                        name="gender"
                        value={form.gender}
                        onChange={handleChange}
                    >
                        <option value="">Select gender</option>
                        <option value="Male">Male</option>
                        <option value="Female">Female</option>
                        <option value="Other">Other</option>
                    </select>

                    <input
                        name="contact"
                        placeholder="Contact number"
                        value={form.contact}
                        onChange={handleChange}
                    />

                    <input
                        name="address"
                        placeholder="Address"
                        value={form.address}
                        onChange={handleChange}
                    />

                    <input
                        name="email"
                        type="email"
                        placeholder="Email"
                        value={form.email}
                        onChange={handleChange}
                    />

                    <select name="blood_group" value={form.blood_group} onChange={handleChange}>
                        <option value="">Select blood group</option>
                        {["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"].map((group) => (
                            <option key={group} value={group}>{group}</option>
                        ))}
                    </select>

                    <input
                        name="emergency_contact"
                        placeholder="Emergency contact"
                        value={form.emergency_contact}
                        onChange={handleChange}
                    />

                    <div className="form-actions">
                        <button type="submit">
                            {editingId ? "Update Patient" : "Add Patient"}
                        </button>

                        {editingId && (
                            <button
                                type="button"
                                className="secondary-button"
                                onClick={() => {
                                    setEditingId(null);
                                    setForm(emptyForm);
                                }}
                            >
                                Cancel
                            </button>
                        )}
                    </div>
                </form>
            </section>

            <section className="content-card">
                <div className="section-heading">
                    <h2>Patient Records</h2>
                    <input
                        className="search-input"
                        placeholder="Search name or contact..."
                        value={search}
                        onChange={(event) => setSearch(event.target.value)}
                    />
                </div>

                <div className="table-wrapper">
                    <table>
                        <thead>
                            <tr>
                                <th>ID</th>
                                <th>Name</th>
                                <th>Age</th>
                                <th>Gender</th>
                                <th>Contact</th>
                                <th>Address</th>
                                <th>Email</th>
                                <th>Blood group</th>
                                <th>Emergency contact</th>
                                <th>Actions</th>
                            </tr>
                        </thead>

                        <tbody>
                            {filteredPatients.map((patient) => (
                                <tr key={patient.patient_id}>
                                    <td>{patient.patient_id}</td>
                                    <td>{patient.name}</td>
                                    <td>{patient.age ?? "-"}</td>
                                    <td>{patient.gender || "-"}</td>
                                    <td>{patient.contact || "-"}</td>
                                    <td>{patient.address || "-"}</td>
                                    <td>{patient.email || "-"}</td>
                                    <td>{patient.blood_group || "-"}</td>
                                    <td>{patient.emergency_contact || "-"}</td>
                                    <td className="actions">
                                        <Link className="button-link" to={`/patients/${patient.patient_id}`}>
                                            Profile
                                        </Link>
                                        <button onClick={() => editPatient(patient)}>
                                            Edit
                                        </button>
                                        <button
                                            className="danger-button"
                                            onClick={() => deletePatient(patient.patient_id)}
                                        >
                                            Delete
                                        </button>
                                    </td>
                                </tr>
                            ))}

                            {filteredPatients.length === 0 && (
                                <tr>
                                    <td colSpan="10">No patients found.</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </section>
        </div>
    );
}

export default Patients;
