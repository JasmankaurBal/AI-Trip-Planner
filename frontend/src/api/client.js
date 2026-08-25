import axios from "axios";

const BASE = process.env.REACT_APP_BACKEND_URL || "http://localhost:8001";

export const api = axios.create({
  baseURL: `${BASE}/api`,
  withCredentials: true,
  headers: { "Content-Type": "application/json" },
});

// Attach bearer token as a resilient fallback to cookies
let token = localStorage.getItem("coco_token") || null;
export const setToken = (t) => {
  token = t;
  if (t) localStorage.setItem("coco_token", t);
  else localStorage.removeItem("coco_token");
};

api.interceptors.request.use((config) => {
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export function apiError(err, fallback = "Something went wrong. Please try again.") {
  const detail = err?.response?.data?.detail;
  if (detail == null) return err?.message || fallback;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail))
    return detail.map((e) => (e && typeof e.msg === "string" ? e.msg : JSON.stringify(e))).join(" ");
  if (detail && typeof detail.msg === "string") return detail.msg;
  return String(detail);
}

export const API_BASE = BASE;
