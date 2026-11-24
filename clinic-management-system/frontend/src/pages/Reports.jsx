import { useEffect, useState } from "react";
import api from "../services/api";
import {
    downloadCsv,
    downloadPdf,
    downloadPatientMedicalReport,
    openPatientReportPrintWindow,
    printPatientMedicalReport
} from "../utils/downloads";

const reportTypes = [
    ["appointments", "Appointment report"],
    ["completed", "Completed appointments"],
    ["cancelled", "Cancelled appointments"],
    ["doctor-wise", "Doctor-wise report"],
    ["revenue", "Revenue report"],
    ["pending-payments", "Pending payments"]
];

const formatDate = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
};

function Reports() {
    const [type, setType] = useState("appointments");
    const [from, setFrom] = useState("");
    const [to, setTo] = useState("");
    const [doctorId, setDoctorId] = useState("");
    const [patientId, setPatientId] = useState("");
    const [doctors, setDoctors] = useState([]);
    const [patients, setPatients] = useState([]);
    const [rows, setRows] = useState([]);
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        Promise.all([api.get("/doctors"), api.get("/patients")])
            .then(([doctorResponse, patientResponse]) => {
                setDoctors(doctorResponse.data.data);
                setPatients(patientResponse.data.data);
            })
            .catch((requestError) => setError(
                requestError.response?.data?.message || "Unable to load report filters."
            ));
    }, []);

    const runReport = async () => {
        setError("");
        setLoading(true);
        try {
            const response = await api.get("/reports", {
                params: { type, from, to, doctorId, patientId }
            });
            setRows(response.data.data);
        } catch (requestError) {
            setError(requestError.response?.data?.message || "Unable to create report.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        runReport();
    }, []);

    const choosePeriod = (period) => {
        const now = new Date();
        const today = formatDate(now);
        if (period === "day") {
            setFrom(today);
            setTo(today);
        } else if (period === "week") {
            const start = new Date(now);
            start.setDate(now.getDate() - ((now.getDay() + 6) % 7));
            setFrom(formatDate(start));
            setTo(today);
        } else {
            setFrom(`${today.slice(0, 7)}-01`);
            setTo(today);
        }
    };

    const exportPdf = () => {
        const lines = rows.map((row) =>
            Object.entries(row).map(([key, value]) => `${key.replaceAll("_", " ")}: ${value ?? "-"}`).join(" | ")
        );
        downloadPdf(`HealthDesk ${reportTypes.find(([value]) => value === type)?.[1]}`, [
            `Date range: ${from || "All"} to ${to || "All"}`,
            ...lines
        ], `healthdesk-${type}-report.pdf`);
    };

    const downloadPatientReport = async (patientId) => {
        try {
            const response = await api.get(`/patients/${patientId}/medical-history`);
            downloadPatientMedicalReport(response.data.data);
        } catch (requestError) {
            setError(requestError.response?.data?.message || "Unable to download patient report.");
        }
    };

    const printPatientReport = async (patientId) => {
        let printWindow;
        try {
            printWindow = openPatientReportPrintWindow();
            const response = await api.get(`/patients/${patientId}/medical-history`);
            printPatientMedicalReport(response.data.data, printWindow);
        } catch (requestError) {
            if (printWindow && !printWindow.closed) printWindow.close();
            setError(
                requestError.response?.data?.message ||
                requestError.message ||
                "Unable to print patient report."
            );
        }
    };

    const hasPatientReports = rows.some((row) => row.patient_id);

    return (
        <div>
            <div className="page-heading no-print">
                <div><h1>Reports</h1><p>Filter and export clinic reports</p></div>
            </div>
            {error && <p className="error">{error}</p>}
            <section className="content-card no-print">
                <h2>Report filters</h2>
                <div className="form-grid">
                    <select value={type} onChange={(e) => setType(e.target.value)}>
                        {reportTypes.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                    </select>
                    <label className="field-label">From date
                        <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
                    </label>
                    <label className="field-label">To date
                        <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
                    </label>
                    <select value={doctorId} onChange={(e) => setDoctorId(e.target.value)}>
                        <option value="">All doctors</option>
                        {doctors.map((doctor) => <option key={doctor.doctor_id} value={doctor.doctor_id}>{doctor.name}</option>)}
                    </select>
                    <select value={patientId} onChange={(e) => setPatientId(e.target.value)}>
                        <option value="">All patients</option>
                        {patients.map((patient) => <option key={patient.patient_id} value={patient.patient_id}>{patient.name}</option>)}
                    </select>
                    <div className="form-actions">
                        <button type="button" className="secondary-button" onClick={() => choosePeriod("day")}>Today</button>
                        <button type="button" className="secondary-button" onClick={() => choosePeriod("week")}>This week</button>
                        <button type="button" className="secondary-button" onClick={() => choosePeriod("month")}>This month</button>
                    </div>
                    <button type="button" onClick={runReport} disabled={loading}>
                        {loading ? "Loading..." : "Run report"}
                    </button>
                </div>
            </section>

            <section className="content-card">
                <div className="section-heading">
                    <h2>{reportTypes.find(([value]) => value === type)?.[1]}</h2>
                    <div className="form-actions">
                        <button type="button" onClick={() => downloadCsv(rows, `healthdesk-${type}-report.csv`)}
                            disabled={!rows.length}>Export CSV</button>
                        <button type="button" className="secondary-button" onClick={exportPdf}
                            disabled={!rows.length}>Download PDF</button>
                        <button type="button" onClick={() => window.print()}
                            disabled={!rows.length || loading}>Print report</button>
                    </div>
                </div>
                {rows.length === 0 && !loading ? <p>No report data for the selected filters.</p> : (
                    rows.length > 0 && (
                        <div className="table-wrapper"><table>
                            <thead><tr>
                                {Object.keys(rows[0]).map((key) => <th key={key}>{key.replaceAll("_", " ")}</th>)}
                                {hasPatientReports && <th>Patient report</th>}
                            </tr></thead>
                            <tbody>{rows.map((row, index) => (
                                <tr key={row.appointment_id || row.invoice_id || row.transaction_id || row.doctor_id || index}>
                                    {Object.keys(rows[0]).map((key) => <td key={key}>{String(row[key] ?? "-")}</td>)}
                                    {hasPatientReports && (
                                        <td>
                                            {row.patient_id ? (
                                                <div className="patient-report-actions">
                                                    <button type="button" className="secondary-button"
                                                        onClick={() => downloadPatientReport(row.patient_id)}>
                                                        Download patient report
                                                    </button>
                                                    <button type="button"
                                                        onClick={() => printPatientReport(row.patient_id)}>
                                                        Print patient report
                                                    </button>
                                                </div>
                                            ) : "-"}
                                        </td>
                                    )}
                                </tr>
                            ))}</tbody>
                        </table></div>
                    )
                )}
            </section>
        </div>
    );
}

export default Reports;
