const defaultApiBaseUrl = "https://api.techoceanhub.com";

export const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || defaultApiBaseUrl;

export const WS_BASE_URL =
  import.meta.env.VITE_WS_BASE_URL || API_BASE_URL;
