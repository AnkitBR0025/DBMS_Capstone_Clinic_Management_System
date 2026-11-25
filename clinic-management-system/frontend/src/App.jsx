import { BrowserRouter, Navigate, Outlet, Route, Routes } from "react-router-dom";

import Sidebar from "./components/Sidebar";
import Dashboard from "./pages/Dashboard";
import Patients from "./pages/Patients";
import Doctors from "./pages/Doctors";
import Appointments from "./pages/Appointments";
import Login from "./pages/Login";
import { AuthProvider, useAuth } from "./context/AuthContext";
import PatientProfile from "./pages/PatientProfile";
import MedicalHistory from "./pages/MedicalHistory";
import Prescriptions from "./pages/Prescriptions";
import Billing from "./pages/Billing";
import Reports from "./pages/Reports";
import Settings from "./pages/Settings";
import Register from "./pages/Register";
import DoctorDashboard from "./pages/DoctorDashboard";
import PatientDashboard from "./pages/PatientDashboard";

function ProtectedLayout() {
    const { user, loading } = useAuth();

    if (loading) return <p className="loading">Checking your session...</p>;
    if (!user) return <Navigate to="/login" replace />;

    return (
        <div className="app-layout">
            <Sidebar />
            <main className="main-content">
                <Outlet />
            </main>
        </div>
    );
}

function RoleRoute({ roles, children }) {
    const { user, loading } = useAuth();
    if (loading) return <p className="loading">Checking your session...</p>;
    if (!user) return <Navigate to="/login" replace />;
    if (!roles.includes(user.role)) {
        const destination = user.role === "Doctor" ? "/doctor" : user.role === "Patient" ? "/patient" : "/admin";
        return <Navigate to={destination} replace />;
    }
    return children;
}

function RoleRedirect() {
    const { user, loading } = useAuth();
    if (loading) return <p className="loading">Checking your session...</p>;
    if (!user) return <Navigate to="/login" replace />;
    if (user.role === "Doctor") return <Navigate to="/doctor" replace />;
    if (user.role === "Patient") return <Navigate to="/patient" replace />;
    return <Navigate to="/admin" replace />;
}

function App() {
    return (
        <AuthProvider>
            <BrowserRouter>
                <Routes>
                    <Route path="/login" element={<Login />} />
                    <Route path="/register" element={<Register />} />
                    <Route element={<ProtectedLayout />}>
                        <Route path="/" element={<RoleRedirect />} />
                        <Route path="/admin" element={<RoleRoute roles={["Admin"]}><Dashboard /></RoleRoute>} />
                        <Route path="/patients" element={<RoleRoute roles={["Admin"]}><Patients /></RoleRoute>} />
                        <Route path="/patients/:id" element={<RoleRoute roles={["Admin"]}><PatientProfile /></RoleRoute>} />
                        <Route path="/doctors" element={<RoleRoute roles={["Admin"]}><Doctors /></RoleRoute>} />
                        <Route path="/appointments" element={<RoleRoute roles={["Admin"]}><Appointments /></RoleRoute>} />
                        <Route path="/medical-history" element={<RoleRoute roles={["Admin"]}><MedicalHistory /></RoleRoute>} />
                        <Route path="/prescriptions" element={<RoleRoute roles={["Admin", "Doctor"]}><Prescriptions /></RoleRoute>} />
                        <Route path="/billing" element={<RoleRoute roles={["Admin"]}><Billing /></RoleRoute>} />
                        <Route path="/reports" element={<RoleRoute roles={["Admin"]}><Reports /></RoleRoute>} />
                        <Route path="/settings" element={<RoleRoute roles={["Admin"]}><Settings /></RoleRoute>} />
                        <Route path="/doctor" element={<RoleRoute roles={["Doctor"]}><DoctorDashboard /></RoleRoute>} />
                        <Route path="/doctor/appointments" element={<RoleRoute roles={["Doctor"]}><DoctorDashboard /></RoleRoute>} />
                        <Route path="/doctor/schedule" element={<RoleRoute roles={["Doctor"]}><DoctorDashboard /></RoleRoute>} />
                        <Route path="/patient" element={<RoleRoute roles={["Patient"]}><PatientDashboard /></RoleRoute>} />
                        <Route path="/patient/book" element={<RoleRoute roles={["Patient"]}><PatientDashboard /></RoleRoute>} />
                        <Route path="/patient/appointments" element={<RoleRoute roles={["Patient"]}><PatientDashboard /></RoleRoute>} />
                        <Route path="/patient/medical-history" element={<RoleRoute roles={["Patient"]}><PatientDashboard /></RoleRoute>} />
                    </Route>
                    <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
            </BrowserRouter>
        </AuthProvider>
    );
}

export default App;
