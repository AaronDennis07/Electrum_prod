// ============================================
// CONFIGURATION - Change only this section
// ============================================

// Set to your backend URL (without trailing slash)
// Examples:
//   Local development: "http://localhost:8000"
//   Production HTTP:   "http://your-server.com:8000"
//   Production HTTPS:  "https://your-server.com"
const BACKEND_URL = "http://localhost:8000";

// ============================================
// AUTO-GENERATED URLs - Don't modify below
// ============================================

// Parse the backend URL
const url = new URL(BACKEND_URL);
const isSecure = url.protocol === "https:";

// HTTP/HTTPS base URL
export const API_BASE = BACKEND_URL;

// WebSocket URL (automatically converts http->ws, https->wss)
export const WS_BASE = `${isSecure ? "wss:" : "ws:"}//${url.host}`;

// Helper function to get WebSocket URL for a specific endpoint
export const getWebSocketUrl = (path) => {
  // Remove leading slash if present
  const cleanPath = path.startsWith("/") ? path.slice(1) : path;
  return `${WS_BASE}/${cleanPath}`;
};

// For debugging - log config on load (remove in production)
if (import.meta.env.DEV) {
  console.log("🔧 Config loaded:");
  console.log("   API_BASE:", API_BASE);
  console.log("   WS_BASE:", WS_BASE);
}

