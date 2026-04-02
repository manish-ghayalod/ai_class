// In development, VITE_API_URL is not set and the Vite proxy handles /api/* → localhost:5000.
// In production, set VITE_API_URL to your deployed backend URL (e.g. https://your-app.railway.app).
export const API_BASE = import.meta.env.VITE_API_URL ?? ''
