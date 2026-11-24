import { useAuth } from "../context/AuthContext";

function Settings() {
    const { user, logout } = useAuth();
    return (
        <div>
            <div className="page-heading">
                <div><h1>Settings</h1><p>Administrator account and session</p></div>
            </div>
            <section className="content-card settings-card">
                <h2>Signed-in account</h2>
                <p><strong>Email:</strong> {user?.email}</p>
                <p><strong>Role:</strong> {user?.role}</p>
                <p>Admin account creation is disabled after the first administrator is set up.</p>
                <button className="danger-button" onClick={logout}>Sign out</button>
            </section>
        </div>
    );
}

export default Settings;
