const axios = require('axios');
const axiosRetry = require('axios-retry').default;
const INTERNAL_SECRET_KEY = process.env.INTERNAL_SECRET_KEY;

const internalApi = axios.create({
    timeout: 50000,
    headers: {
        'Content-Type': 'application/json',
    },
});

internalApi.interceptors.request.use((config) => {
    if (INTERNAL_SECRET_KEY) {
        config.headers['x-internal-secret'] = INTERNAL_SECRET_KEY;
    } else {
        console.error("Internal API Error: INTERNAL_SECRET_KEY is missing!");
    }
    return config;
});

axiosRetry(internalApi, {
    retries: 3,
    retryDelay: axiosRetry.exponentialDelay,
    retryCondition: (error) => {
        return (
            axiosRetry.isNetworkError(error) ||
            axiosRetry.isRetryableError(error)
        );
    },
    onRetry: (retryCount, error) => {
        console.warn(`[API Retry #${retryCount}] ${error.code || error.message} | ${error.config?.url}`);
    },
});

module.exports = internalApi;
