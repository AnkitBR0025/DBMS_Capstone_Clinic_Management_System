import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import api from "../services/api";

const initialForm = {
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
    mobile: "",
    address: "",
    date_of_birth: "",
    gender: ""
};

function Register() {
    const navigate = useNavigate();
    const [form, setForm] = useState(initialForm);
    const [message, setMessage] = useState("");
    const [submitting, setSubmitting] = useState(false);

    const handleSubmit = async (event) => {
        event.preventDefault();
        setMessage("");
        setSubmitting(true);
        try {
            await api.post("/auth/register-patient", form);
            navigate("/login", { replace: true, state: { registered: true } });
        } catch (error) {
            setMessage(error.response?.data?.message || "Unable to create account.");
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <main className="login-page">
            <section className="login-card register-card">
                <h1>Patient Registration</h1>
                <p>Create your HealthDesk patient account.</p>
                {message && <p className="error login-error" role="alert">{message}</p>}
                <form onSubmit={handleSubmit} className="login-form">
                    <input placeholder="Full name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
                    <input type="email" placeholder="Email address" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
                    <input type="password" minLength="8" placeholder="Password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required />
                    <input type="password" minLength="8" placeholder="Confirm password" value={form.confirmPassword} onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })} required />
                    <input placeholder="Mobile number" value={form.mobile} onChange={(e) => setForm({ ...form, mobile: e.target.value })} required />
                    <input placeholder="Complete address" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} required />
                    <label htmlFor="date_of_birth">Date of birth</label>
                    <input id="date_of_birth" type="date" value={form.date_of_birth} onChange={(e) => setForm({ ...form, date_of_birth: e.target.value })} required />
                    <select value={form.gender} onChange={(e) => setForm({ ...form, gender: e.target.value })} required>
                        <option value="">Select gender</option>
                        <option>Male</option>
                        <option>Female</option>
                        <option>Other</option>
                    </select>
                    <button type="submit" disabled={submitting}>{submitting ? "Creating account..." : "Create account"}</button>
                </form>
                <p><Link to="/login">Already have an account? Sign in</Link></p>
            </section>
        </main>
    );
}

export default Register;
