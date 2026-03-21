// axiosConfig.js
const axios = require('axios');
const INTERNAL_SECRET_KEY = process.env.INTERNAL_SECRET_KEY;
const axiosRetry = require('axios-retry').default;

// Create dedicated instance
const internalApi = axios.create({
    timeout: 60000, // Short timeout for internal cluster communication
    headers: {
        'Content-Type': 'application/json',
    },
});

// Interceptor to inject the internal security header on every request
internalApi.interceptors.request.use((config) => {
    if (INTERNAL_SECRET_KEY) {
        // CRUCIAL: Inject the secret key for internal service-to-service authentication
        config.headers['x-internal-secret'] = INTERNAL_SECRET_KEY;
    } else {
        console.error("Internal API Error: INTERNAL_SECRET_KEY is missing!");
    }
    return config;
});


// Configure simple retries (internal network errors are rare but should be handled)
axiosRetry(internalApi, {
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



module.exports = internalApi;