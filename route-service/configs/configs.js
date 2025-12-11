// axiosConfig.js
const axios = require('axios');
const axiosRetry = require('axios-retry').default;

// Create dedicated instance
const api = axios.create({
    timeout: 60000, // 60s timeout — prevents hanging forever
    headers: {
        'Content-Type': 'application/json',
    },
});

// Configure retries
axiosRetry(api, {
    retries: 3,
    retryDelay: axiosRetry.exponentialDelay, // True exponential: 1s → 2s → 4s
    retryCondition: (error) => {
        return (
            axiosRetry.isNetworkError(error) ||
            axiosRetry.isRetryableError(error) // includes 5xx + idempotent 4xx (like 429)
        );
    },
    onRetry: (retryCount, error) => {
        console.warn(`[API Retry #${retryCount}] ${error.code || error.message} | ${error.config?.url}`);
    },
});

// Optional: Global error handling (centralized)
// api.interceptors.response.use(
//     (response) => response,
//     (error) => {
//         // Log all errors in one place
//         console.error('API Error:', {
//             url: error.config?.url,
//             method: error.config?.method,
//             status: error.response?.status,
//             message: error.message,
//         });
//         return Promise.reject(error);
//     }
// );

module.exports = api;