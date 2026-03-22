/**
 * CombinedServer.js - Modular Monolith Orchestrator
 * 
 * This script allows all 5 microservices to run in a single Node.js instance.
 * Each service runs in its own child process using child_process.fork(),
 * ensuring they remain isolated while sharing the same server resources.
 */

/**
 * We're using this strategy to by pass paying for private services
 * networking on the hosting platform that require payment, 
 * since this isn't going live to the public, 
 * it's just for a portfolio project where not so much people would use.
 * 
 */

const { fork } = require('child_process');
const path = require('path');

// Configuration for all sub-services
const services = [
    { 
        name: 'USER_SERVICE        ', 
        script: './user-service/server.js', 
        port: 5001 
    },
    { 
        name: 'FARE_SERVICE        ', 
        script: './fare-service/server.js', 
        port: 5002 
    },
    { 
        name: 'ROUTE_SERVICE       ', 
        script: './route-service/server.js', 
        port: 5003 
    },
    { 
        name: 'NOTIFICATION_SERVICE', 
        script: './notification-service/server.js', 
        port: 5004 
    },
    { 
        name: 'API_GATEWAY         ', 
        script: './api-gateway/index.js', 
        port: process.env.PORT || 5000 // Gateway uses the main platform port
    }
];

console.log('--- STARTING FERIFY MODULAR MONOLITH ---');

services.forEach(service => {
    const servicePath = path.resolve(__dirname, service.script);
    
    // Fork the process
    const child = fork(servicePath, {
        cwd: path.dirname(servicePath), // CRITICAL: Ensures sub-services find their own .env and node_modules
        env: { 
            ...process.env, 
            PORT: service.port 
        },
        stdio: 'inherit' // Inherit stdout/stderr to see sub-service logs in the same console
    });

    child.on('error', (err) => {
        console.error(`[${service.name}] CRITICAL ERROR:`, err);
    });

    child.on('exit', (code) => {
        console.log(`[${service.name}] Process exited with code ${code}`);
    });

    console.log(`[${service.name}] Initializing on port ${service.port}...`);
});

console.log('--- ORCHESTRATOR ACTIVE ---');
