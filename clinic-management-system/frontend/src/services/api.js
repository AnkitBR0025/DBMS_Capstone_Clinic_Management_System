import axios from "axios";

const api = axios.create({
    baseURL: "http://localhost:5000/api"
});

api.interceptors.request.use((config) => {
    const token = sessionStorage.getItem("healthdesk_token");
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
});

api.interceptors.response.use(
    (response) => response,
    (error) => {
        if (
            error.response?.status === 401 &&
            !window.location.pathname.endsWith("/login")
        ) {
            sessionStorage.removeItem("healthdesk_token");
            window.location.assign("/login");
        }
        return Promise.reject(error);
    }
);

export default api;
