import { createContext, useContext, useEffect, useMemo, useState } from "react";
import api from "../services/api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let active = true;
        const token = sessionStorage.getItem("healthdesk_token");

        if (!token) {
            setLoading(false);
            return () => {
                active = false;
            };
        }

        api.get("/auth/me")
            .then((response) => {
                if (active) setUser(response.data.data.user);
            })
            .catch(() => {
                sessionStorage.removeItem("healthdesk_token");
                if (active) setUser(null);
            })
            .finally(() => {
                if (active) setLoading(false);
            });

        return () => {
            active = false;
        };
    }, []);

    const value = useMemo(() => ({
        user,
        loading,
        login: async (email, password) => {
            const response = await api.post("/auth/login", { email, password });
            sessionStorage.setItem("healthdesk_token", response.data.data.token);
            setUser(response.data.data.user);
        },
        logout: () => {
            sessionStorage.removeItem("healthdesk_token");
            setUser(null);
        }
    }), [user, loading]);

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (!context) throw new Error("useAuth must be used within AuthProvider");
    return context;
}
