import { jsPDF } from "jspdf";
import logoData from "../assets/healthdesk-logo.jpg?inline";
import logoUrl from "../assets/healthdesk-logo.jpg";

export function downloadPdf(title, rows, filename) {
    const pdf = new jsPDF();
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const margin = 14;
    const logoWidth = 40;
    const logoHeight = logoWidth * 384 / 1013;
    const titleX = margin + logoWidth + 5;
    const drawHeader = () => {
        pdf.addImage(logoData, "JPEG", margin, 10, logoWidth, logoHeight);
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(16);
        pdf.text(
            pdf.splitTextToSize(title, pageWidth - titleX - margin),
            titleX,
            18
        );
    };

    drawHeader();
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(10);
    let y = 34;

    for (const row of rows) {
        const lines = pdf.splitTextToSize(String(row ?? "-"), pageWidth - margin * 2);
        const height = lines.length * 5 + 3;
        if (y + height > pageHeight - margin) {
            pdf.addPage();
            drawHeader();
            pdf.setFont("helvetica", "normal");
            pdf.setFontSize(10);
            y = 34;
        }
        pdf.text(lines, margin, y);
        y += height;
    }

    pdf.save(filename);
}

export function downloadCsv(rows, filename) {
    if (!rows.length) return;
    const columns = [...new Set(rows.flatMap((row) => Object.keys(row)))];
    const escapeCell = (value) => {
        let text = String(value ?? "");
        if (/^[=+\-@]/.test(text)) text = `'${text}`;
        return `"${text.replace(/"/g, '""')}"`;
    };
    const csv = [
        columns.map(escapeCell).join(","),
        ...rows.map((row) => columns.map((column) => escapeCell(row[column])).join(","))
    ].join("\r\n");
    const url = URL.createObjectURL(new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(url);
}

export function downloadPatientMedicalReport(history) {
    const { patient, appointments, medicalRecords, prescriptions, payments } = history;
    const lines = [
        `Patient ID: ${patient.patient_id}`,
        `Name: ${patient.name}`,
        `Age / Gender: ${patient.age ?? "-"} / ${patient.gender || "-"}`,
        `Contact: ${patient.contact || "-"}`,
        `Email: ${patient.email || "-"}`,
        `Address: ${patient.address || "-"}`,
        `Blood group: ${patient.blood_group || "-"}`,
        `Emergency contact: ${patient.emergency_contact || "-"}`,
        `Registered: ${String(patient.created_at).slice(0, 10)}`,
        "",
        "Appointments:",
        ...appointments.map((item) =>
            `${String(item.appointment_date).slice(0, 10)} ${String(item.appointment_time).slice(0, 5)} | ${item.doctor_name} | ${item.status} | Invoice ${item.payment_status || "Pending"}`
        ),
        "",
        "Diagnoses and treatment:",
        ...medicalRecords.map((item) =>
            `${String(item.treatment_date).slice(0, 10)} | ${item.doctor_name} | Diagnosis: ${item.diagnosis || "-"} | Treatment: ${item.treatment_details || "-"} | Notes: ${item.doctor_notes || "-"} | Follow-up: ${item.follow_up_date || "-"}`
        ),
        "",
        "Prescriptions:",
        ...prescriptions.map((item) =>
            `${String(item.treatment_date).slice(0, 10)} | ${item.medicine} | ${item.dosage || "-"} | ${item.frequency || "-"} | ${item.duration || "-"} | ${item.instructions || "-"}`
        ),
        "",
        "Payments:",
        ...payments.map((item) =>
            `Invoice ${item.invoice_id} | Paid: ${item.amount ?? 0} ${item.payment_method || ""} | Balance: ${Number(item.total_amount) - Number(item.amount_paid)} | ${item.paid_at || item.payment_status}`
        )
    ];
    downloadPdf(
        `HealthDesk Medical History - ${patient.name}`,
        lines,
        `patient-${patient.patient_id}-history.pdf`
    );
}

const escapeHtml = (value) => String(value ?? "-").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#39;"
})[character]);

const renderTable = (headers, rows) => `
    <table>
        <thead><tr>${headers.map((header) => `<th>${escapeHtml(header)}</th>`).join("")}</tr></thead>
        <tbody>
            ${rows.length
                ? rows.map((row) => `<tr>${row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join("")}</tr>`).join("")
                : `<tr><td colspan="${headers.length}">No records.</td></tr>`}
        </tbody>
    </table>`;

export function openPatientReportPrintWindow() {
    const printWindow = window.open("", "_blank");
    if (!printWindow) throw new Error("Allow pop-ups to print the patient report.");
    return printWindow;
}

export function printPatientMedicalReport(history, printWindow) {
    const { patient, appointments, medicalRecords, prescriptions, payments } = history;
    const sections = [
        ["Patient information", ["Field", "Details"], [
            ["Patient ID", patient.patient_id],
            ["Name", patient.name],
            ["Age / Gender", `${patient.age ?? "-"} / ${patient.gender || "-"}`],
            ["Contact", patient.contact],
            ["Email", patient.email],
            ["Address", patient.address],
            ["Blood group", patient.blood_group],
            ["Emergency contact", patient.emergency_contact],
            ["Registered", String(patient.created_at).slice(0, 10)]
        ]],
        ["Appointment history", ["Date", "Time", "Doctor", "Status", "Payment"], appointments.map((item) => [
            String(item.appointment_date).slice(0, 10),
            String(item.appointment_time).slice(0, 5),
            item.doctor_name,
            item.status,
            item.payment_status || "Pending"
        ])],
        ["Diagnoses and treatment", ["Date", "Doctor", "Diagnosis", "Treatment", "Notes", "Follow-up"], medicalRecords.map((item) => [
            String(item.treatment_date).slice(0, 10),
            item.doctor_name,
            item.diagnosis,
            item.treatment_details,
            item.doctor_notes,
            item.follow_up_date
        ])],
        ["Prescriptions", ["Date", "Medicine", "Dosage", "Frequency", "Duration", "Instructions"], prescriptions.map((item) => [
            String(item.treatment_date).slice(0, 10),
            item.medicine,
            item.dosage,
            item.frequency,
            item.duration,
            item.instructions
        ])],
        ["Payments", ["Invoice", "Date", "Amount paid", "Method", "Balance", "Status"], payments.map((item) => [
            item.invoice_id,
            item.paid_at ? String(item.paid_at).slice(0, 10) : "-",
            item.amount ?? item.amount_paid,
            item.payment_method,
            Number(item.total_amount) - Number(item.amount_paid),
            item.payment_status
        ])]
    ];
    const html = `<!doctype html>
        <html lang="en">
        <head>
            <meta charset="utf-8">
            <title>${escapeHtml(`HealthDesk Medical History - ${patient.name}`)}</title>
            <style>
                @page { margin: 14mm; }
                body { color: #263247; font: 12px Arial, sans-serif; }
                header { display: flex; align-items: center; gap: 18px; border-bottom: 2px solid #087f9d; padding-bottom: 12px; }
                header img { width: 190px; height: auto; }
                h1 { font-size: 19px; margin: 0; }
                h2 { font-size: 15px; margin: 22px 0 8px; }
                table { border-collapse: collapse; width: 100%; }
                th, td { border: 1px solid #cbd5e1; padding: 6px; text-align: left; vertical-align: top; overflow-wrap: anywhere; }
                th { background: #eef4f8; }
                tr { break-inside: avoid; }
            </style>
        </head>
        <body>
            <header><img src="${logoUrl}" alt="HealthDesk"><h1>Patient Medical History</h1></header>
            ${sections.map(([title, headers, rows]) =>
                `<section><h2>${escapeHtml(title)}</h2>${renderTable(headers, rows)}</section>`
            ).join("")}
        </body>
        </html>`;

    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();

    let printScheduled = false;
    const print = () => {
        if (printScheduled) return;
        printScheduled = true;
        printWindow.setTimeout(() => {
            if (!printWindow.closed) {
                printWindow.focus();
                printWindow.print();
            }
        }, 0);
    };
    const logo = printWindow.document.querySelector("header img");
    if (!logo || logo.complete) print();
    else {
        logo.addEventListener("load", print, { once: true });
        logo.addEventListener("error", print, { once: true });
        if (logo.complete) print();
    }
}
