// googleMapsApi.js
const axios = require('axios');
const axiosRetry = require('axios-retry').default;
const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;

const googleMapsApi = axios.create({
    timeout: 60000, // 60 seconds
    // You could set the baseURL here if all calls start with the same path:
    // baseURL: 'https://maps.googleapis.com/maps/api/', 
});

// Interceptor: Adds the API key as a query parameter
googleMapsApi.interceptors.request.use((config) => {
    if (GOOGLE_API_KEY) {
        config.params = {
            ...config.params,
            key: GOOGLE_API_KEY,
        };
    }
    return config;
});

// Retry configuration (essential for external service reliability)
axiosRetry(googleMapsApi, {
    retries: 5,
    retryDelay: axiosRetry.exponentialDelay,
    retryCondition: (error) => axiosRetry.isNetworkError(error) || axiosRetry.isRetryableError(error),
    onRetry: (retryCount, error) => {
        // Log a warning every time a retry is attempted
        console.warn(`[Google Maps Retry #${retryCount}] Failed URL: ${error.config?.url}. Error: ${error.message}`);
    },
});

module.exports = googleMapsApi;