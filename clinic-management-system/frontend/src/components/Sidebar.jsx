import { NavLink } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import healthDeskLogo from "../assets/healthdesk-logo.jpg";

function Sidebar() {
    const { logout, user } = useAuth();
    const roleLinks = {
        Admin: [
            { name: "Dashboard", path: "/admin" },
            { name: "Patients", path: "/patients" },
            { name: "Doctors", path: "/doctors" },
            { name: "Appointments", path: "/appointments" },
            { name: "Medical History", path: "/medical-history" },
            { name: "Prescriptions", path: "/prescriptions" },
            { name: "Billing and Payments", path: "/billing" },
            { name: "Reports", path: "/reports" },
            { name: "Settings", path: "/settings" }
        ],
        Doctor: [
            { name: "Dashboard", path: "/doctor" },
            { name: "Appointments", path: "/doctor/appointments" },
            { name: "Schedule", path: "/doctor/schedule" }
        ],
        Patient: [
            { name: "Dashboard", path: "/patient" },
            { name: "Book Appointment", path: "/patient/book" },
            { name: "My Appointments", path: "/patient/appointments" },
            { name: "Medical History", path: "/patient/medical-history" }
        ]
    };
    const links = roleLinks[user?.role] || [];

    return (
        <aside className="sidebar">
            <div className="brand">
                <img className="brand-logo" src={healthDeskLogo} alt="HealthDesk Clinic Management" />
            </div>

            <p className="menu-label">HEALTHDESK</p>

            <nav>
                {links.map((link) => (
                    <NavLink
                        key={link.path}
                        to={link.path}
                        end={link.path === "/"}
                        className={({ isActive }) =>
                            isActive ? "nav-link active" : "nav-link"
                        }
                    >
                        {link.name}
                    </NavLink>
                ))}
            </nav>

            <div className="sidebar-footer">
                <span>{user?.email}</span>
                <button className="logout-button" onClick={logout}>Logout</button>
            </div>
        </aside>
    );
}

export default Sidebar;
