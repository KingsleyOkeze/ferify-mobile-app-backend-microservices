const redis = require("redis");

// Connect to redis
const client = redis.createClient({
    url: process.env.REDIS_URL || 'redis://localhost:6379'
});
client.on('error', (err) => console.error('Redis Client Error', err));
client.connect()
    .then(() => console.log("Connected to Redis"))
    .catch(err => console.error("Redis connection error:", err));


module.exports = client;