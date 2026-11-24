import { useEffect, useState } from "react";
import api from "../services/api";
import StatCard from "../components/StatCard";

function MonthlyChart({ title, data, currency = false }) {
    const maxValue = Math.max(...data.map((item) => Number(item.total)), 1);
    return (
        <section className="content-card">
            <h2>{title}</h2>
            {data.length === 0 ? <p>No data available for this period.</p> : (
                <div className="chart-bars">
                    {data.map((item) => {
                        const value = Number(item.total);
                        return (
                            <div className="chart-bar-item" key={item.month}>
                                <span className="chart-value">
                                    {currency ? `₹${value.toFixed(0)}` : value}
                                </span>
                                <div className="chart-track">
                                    <div className="chart-bar" style={{ width: `${Math.max((value / maxValue) * 100, 2)}%` }} />
                                </div>
                                <span className="chart-label">{item.month}</span>
                            </div>
                        );
                    })}
                </div>
            )}
        </section>
    );
}

function Dashboard() {
    const [data, setData] = useState(null);
    const [error, setError] = useState("");

    useEffect(() => {
        api.get("/dashboard")
            .then((response) => setData(response.data.data))
            .catch((requestError) => setError(
                requestError.response?.data?.message || "Unable to load dashboard data."
            ));
    }, []);

    if (error) return <p className="error">{error}</p>;
    if (!data) return <p className="loading">Loading dashboard...</p>;

    return (
        <div>
            <div className="page-heading">
                <div>
                    <h1>Dashboard</h1>
                    <p>Live overview of your clinic activity</p>
                </div>
            </div>

            <div className="stats-grid">
                <StatCard title="Total Patients" value={data.totalPatients} description="Registered patients" />
                <StatCard title="Total Doctors" value={data.totalDoctors} description="Active doctors" />
                <StatCard title="Today's Appointments" value={data.todayAppointments} description="Scheduled today" />
                <StatCard title="Completed Appointments" value={data.completedAppointments} description="All-time completed" />
                <StatCard title="Cancelled Appointments" value={data.cancelledAppointments} description="All-time cancelled" />
                <StatCard title="Pending Payments" value={`₹${Number(data.pendingPayments).toFixed(2)}`} description="Outstanding balance" />
                <StatCard title="Total Revenue" value={`₹${Number(data.totalRevenue).toFixed(2)}`} description="Recorded payments" />
            </div>

            <div className="chart-grid">
                <MonthlyChart title="Monthly appointments" data={data.monthlyAppointments} />
                <MonthlyChart title="Monthly revenue" data={data.monthlyRevenue} currency />
            </div>

            <div className="chart-grid">
                <section className="content-card">
                    <h2>Appointment status</h2>
                    {data.statusDistribution.length === 0 ? <p>No appointments found.</p> : (
                        <ul className="status-list">
                            {data.statusDistribution.map((item) => (
                                <li key={item.status}>
                                    <span className={`status ${item.status.toLowerCase()}`}>{item.status}</span>
                                    <strong>{item.total}</strong>
                                </li>
                            ))}
                        </ul>
                    )}
                </section>
                <section className="content-card">
                    <h2>Upcoming appointments</h2>
                    {data.upcomingAppointments.length === 0 ? <p>No upcoming appointments.</p> : (
                        <ul className="upcoming-list">
                            {data.upcomingAppointments.map((item) => (
                                <li key={item.appointment_id}>
                                    <strong>{item.patient_name}</strong> with {item.doctor_name}
                                    <span>{String(item.appointment_date).slice(0, 10)} · {String(item.appointment_time).slice(0, 5)}</span>
                                </li>
                            ))}
                        </ul>
                    )}
                </section>
            </div>

            <section className="content-card">
                <h2>Recent appointments</h2>
                {data.recentAppointments.length === 0 ? <p>No appointments found.</p> : (
                    <div className="table-wrapper">
                        <table>
                            <thead>
                                <tr><th>Patient</th><th>Doctor</th><th>Date</th><th>Time</th><th>Status</th></tr>
                            </thead>
                            <tbody>
                                {data.recentAppointments.map((item) => (
                                    <tr key={item.appointment_id}>
                                        <td>{item.patient_name}</td>
                                        <td>{item.doctor_name}</td>
                                        <td>{String(item.appointment_date).slice(0, 10)}</td>
                                        <td>{String(item.appointment_time).slice(0, 5)}</td>
                                        <td><span className={`status ${item.status.toLowerCase()}`}>{item.status}</span></td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </section>
        </div>
    );
}

export default Dashboard;
