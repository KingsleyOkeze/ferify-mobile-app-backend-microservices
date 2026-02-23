# Ferify Backend

The Ferify backend is built on a scalable, modular microservices architecture designed to handle high-traffic transport and community data. It utilizes Node.js, Express, and WebSockets to provide real-time updates and secure data handling.

## Architecture Overview

The system is composed of an API Gateway and several independent microservices:

### 1. API Gateway
The unified entry point for all client requests.
- Handles centralized authentication (JWT).
- Proxies requests to downstream microservices.
- Manages WebSocket upgrades for real-time services.
- Rate limits inbound traffic to prevent abuse.

### 2. User Service
Handles core user-related functionality.
- User authentication and authorization.
- Profiles, achievements, and account management.
- Contribution history and reward tracking.

### 3. Fare Service
The core business logic engine for transport fares.
- Manages fare verification and community data contributions.
- Handles location-based fare lookups.
- Core logic for validating user-submitted fare data.

### 4. Route Service
Optimizes transport route selection.
- Calculates optimal routes based on community data.
- Integrates with external mapping APIs.

### 5. Notification Service
Powers real-time engagement.
- Manages real-time alerts and updates via Socket.io.
- Sends instant notifications for fare verifications and earned points.

## Technology Stack

- **Runtime**: Node.js (LTS)
- **Framework**: Express.js
- **Database**: MongoDB (Mongoose)
- **Real-time**: Socket.io
- **Security**: JWT, CORS, Internal Secret Headers
- **Cloud Storage**: Cloudinary (Image uploads)

## Getting Started

### Prerequisites

- Node.js (LTS)
- MongoDB Instance (Atlas or Local)
- Cloudinary Account (for image uploads)

### Installation

1. Clone the repository and navigate to the backend directory:
   ```bash
   cd backend
   ```

2. Each service has its own `package.json`. You can install dependencies for all services or for a specific one:
   ```bash
   # Example: Installing user-service dependencies
   cd user-service && npm install
   ```

3. **Configure Environment Variables**:
   Each service requires a `.env` file. You can find example keys in the `api-gateway/index.js` and service server files. Key variables include:
   - `PORT`: Service port
   - `MONGO_URI`: MongoDB connection string
   - `JWT_SECRET`: Secret key for authentication
   - `INTERNAL_SECRET_KEY`: Security key for inter-service communication

### Running the Services

You must start the API Gateway first, followed by the services you wish to use.

```bash
# In api-gateway
node index.js

# In user-service
node server.js
```

## Internal Communication

Services communicate securely through the API Gateway or directly using `x-internal-secret` headers to verify that requests originate from within the trusted network.

## Monitoring & Logging

Each service logs inbound requests and errors to the console. The API Gateway provides a high-level view of system traffic and routing.
