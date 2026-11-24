import { NavLink } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import healthDeskLogo from "../assets/healthdesk-logo.jpg";

function Sidebar() {
    const { logout, user } = useAuth();
    const links = [
        { name: "Dashboard", path: "/" },
        { name: "Patients", path: "/patients" },
        { name: "Doctors", path: "/doctors" },
        { name: "Appointments", path: "/appointments" },
        { name: "Medical History", path: "/medical-history" },
        { name: "Prescriptions", path: "/prescriptions" },
        { name: "Billing and Payments", path: "/billing" },
        { name: "Reports", path: "/reports" },
        { name: "Settings", path: "/settings" }
    ];

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
