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

function App() {
    return (
        <AuthProvider>
            <BrowserRouter>
                <Routes>
                    <Route path="/login" element={<Login />} />
                    <Route element={<ProtectedLayout />}>
                        <Route path="/" element={<Dashboard />} />
                        <Route path="/patients" element={<Patients />} />
                        <Route path="/patients/:id" element={<PatientProfile />} />
                        <Route path="/doctors" element={<Doctors />} />
                        <Route path="/appointments" element={<Appointments />} />
                        <Route path="/medical-history" element={<MedicalHistory />} />
                        <Route path="/prescriptions" element={<Prescriptions />} />
                        <Route path="/billing" element={<Billing />} />
                        <Route path="/reports" element={<Reports />} />
                        <Route path="/settings" element={<Settings />} />
                    </Route>
                    <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
            </BrowserRouter>
        </AuthProvider>
    );
}

export default App;
