import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../services/api";

function MedicalHistory() {
    const [patients, setPatients] = useState([]);
    const [search, setSearch] = useState("");
    const [error, setError] = useState("");

    useEffect(() => {
        api.get("/patients", { params: { search } })
            .then((response) => setPatients(response.data.data))
            .catch((requestError) => setError(
                requestError.response?.data?.message || "Unable to load patients."
            ));
    }, [search]);

    return (
        <div>
            <div className="page-heading">
                <div><h1>Medical History</h1><p>Choose a patient to view their clinical record</p></div>
            </div>
            {error && <p className="error">{error}</p>}
            <section className="content-card">
                <div className="section-heading">
                    <h2>Patients</h2>
                    <input className="search-input" placeholder="Search patient name, ID or contact"
                        value={search} onChange={(event) => setSearch(event.target.value)} />
                </div>
                <div className="table-wrapper">
                    <table>
                        <thead><tr><th>ID</th><th>Patient</th><th>Contact</th><th>Registered</th><th>Record</th></tr></thead>
                        <tbody>
                            {patients.map((patient) => (
                                <tr key={patient.patient_id}>
                                    <td>{patient.patient_id}</td><td>{patient.name}</td>
                                    <td>{patient.contact || "-"}</td>
                                    <td>{String(patient.created_at).slice(0, 10)}</td>
                                    <td><Link to={`/patients/${patient.patient_id}`}>View medical history</Link></td>
                                </tr>
                            ))}
                            {patients.length === 0 && <tr><td colSpan="5">No patients found.</td></tr>}
                        </tbody>
                    </table>
                </div>
            </section>
        </div>
    );
}

export default MedicalHistory;
