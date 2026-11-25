import { useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import healthDeskLogo from "../assets/healthdesk-logo.jpg";

function Login() {
    const { user, login } = useAuth();
    const navigate = useNavigate();
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [submitting, setSubmitting] = useState(false);

    if (user) {
        const destination = user.role === "Doctor" ? "/doctor" : user.role === "Patient" ? "/patient" : "/admin";
        return <Navigate to={destination} replace />;
    }

    const handleSubmit = async (event) => {
        event.preventDefault();
        setError("");
        setSubmitting(true);
        try {
            const signedInUser = await login(email, password);
            const destination = signedInUser.role === "Doctor"
                ? "/doctor"
                : signedInUser.role === "Patient"
                    ? "/patient"
                    : "/admin";
            navigate(destination, { replace: true });
        } catch (requestError) {
            setError(requestError.response?.data?.message || "Unable to sign in.");
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <main className="login-page">
            <section className="login-card">
                <img className="login-logo" src={healthDeskLogo} alt="HealthDesk" />
                <h1>Welcome to HealthDesk</h1>
                <p>Sign in with your HealthDesk account.</p>
                {error && <p className="error login-error" role="alert">{error}</p>}
                <form onSubmit={handleSubmit} className="login-form">
                    <label htmlFor="email">Email</label>
                    <input
                        id="email"
                        type="email"
                        autoComplete="username"
                        value={email}
                        onChange={(event) => setEmail(event.target.value)}
                        required
                    />
                    <label htmlFor="password">Password</label>
                    <input
                        id="password"
                        type="password"
                        autoComplete="current-password"
                        value={password}
                        onChange={(event) => setPassword(event.target.value)}
                        required
                    />
                    <button type="submit" disabled={submitting}>
                        {submitting ? "Signing in..." : "Sign in"}
                    </button>
                </form>
                <p>New patient? <Link to="/register">Create a patient account</Link></p>
            </section>
        </main>
    );
}

export default Login;
