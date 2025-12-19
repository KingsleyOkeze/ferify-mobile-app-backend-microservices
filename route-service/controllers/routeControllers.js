const internalApi = require("../configs/internalApi");
const googleMapsApi = require("../configs/googleMapApi");
const redis = require("redis");

const client = redis.createClient();
client.connect()
    .then(() => console.log("✅ Connected to Redis"))
    .catch(err => console.error("Redis connection error:", err));

const GOOGLE_PLACES_API_KEY = process.env.GOOGLE_PLACES_API_KEY; 
const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;
const googleAutocompleteUrl = "https://maps.googleapis.com/maps/api/place/autocomplete/json";


const placeSearchFunction = async (req, res) => {
    // 1. INPUT VALIDATION
    // Normalize and retrieve the search query from the request parameters.
    const query = req.query.query?.trim().toLowerCase();
    console.log("User search", query);
    if (!query) {
        return res.status(400).json({ error: "Query is required" });
    }

    try {
        // 2. CHECK CACHE FIRST
        const cachedSuggestions = await client.get(query);
        if (cachedSuggestions) {
            console.log("♻️ Serving from cache:", query);
            console.log("♻️ Serving from cache result:", cachedSuggestions);
            return res.status(200).json({result: JSON.parse(cachedSuggestions)});
        }

        // --- GOOGLE API CALL ---
        
        // 3. FETCH FROM GOOGLE PLACES AUTOCOMPLETE
        const response = await googleMapsApi.get(googleAutocompleteUrl, {
            params: {
                // The user's text input
                input: query, 
                // Your Places API Key
                key: GOOGLE_PLACES_API_KEY,
                // Optional: Restrict results to Nigeria for relevance
                components: 'country:ng', 
                // Optional: Focus on addresses and geographic places
                types: 'geocode', 
            },
            timeout: 2500, // Prevent hanging on slow Google response
        });
        
        // 4. HANDLE API STATUS AND ERRORS
        if (response.data.status !== 'OK' && response.data.status !== 'ZERO_RESULTS') {
            // Throw an error if the API call itself failed for reasons other than no results.
            throw new Error(`Google Places API returned status: ${response.data.status}`);
        }

        // 5. MAP AND CLEAN THE RESULTS
        // Extract the array of predictions.
        const predictions = response.data.predictions || []; 

        const result = predictions.map((prediction) => ({
            // The full suggested address/name
            name: prediction.description, 
            // The unique identifier needed for a follow-up Geocoding or Directions API call
            place_id: prediction.place_id, 
            // Lat/Lon is not directly available in Autocomplete and must be fetched separately.
        }));

        // 6. CACHE THE RESULT
        // Cache the result for 1 hour (3600 seconds) to reduce future API costs and latency.
        await client.setEx(query, 3600, JSON.stringify(result));

        // 7. SEND FINAL RESPONSE
        return res.status(200).json(result);

    } catch (error) {
        // 8. GENERAL ERROR HANDLING
        console.error("Error fetching Google Autocomplete suggestions:", error.message);
        return res.status(500).json({ error: "Failed to get suggestions" });
    }
};

const getDistanceOfThisTwoLocationInKm = async (req, res) => {
    const {startPlaceId, endPlaceId} = req.query;
    // Check if inputs are valid Place IDs (or addresses)
    if (!startPlaceId || !endPlaceId) {
        throw new Error("Missing start or end location ID.");
    }

    // --- CACHING LOGIC (Remains the same) ---
    const key = `${startPlaceId}->${endPlaceId}`;
    const reverseKey = `${endPlaceId}->${startPlaceId}`;
    const cached = (await client.get(key)) || (await client.get(reverseKey));

    if (cached) {
        console.log("Returning cached distance");
        return parseFloat(cached);
    }

    try {
        // --- SINGLE STEP: GET DISTANCE (Google Directions API) ---
        const directionsUrl = "https://maps.googleapis.com/maps/api/directions/json";

        // 💡 OPTIMIZATION: Use the 'place_id:' prefix to pass Place IDs directly.
        const originString = `place_id:${startPlaceId}`;
        const destinationString = `place_id:${endPlaceId}`;

        const routeResponse = await googleMapsApi.get(
            directionsUrl,
            {
                params: {
                    origin: originString,
                    destination: destinationString,
                    mode: 'driving', 
                    // key: GOOGLE_API_KEY,
                }
            }
        );

        if (routeResponse.data.status !== 'OK' || routeResponse.data.routes.length === 0) {
            throw new Error(`Directions failed: ${routeResponse.data.status}`);
        }

        const distanceMeters = routeResponse.data.routes[0].legs[0].distance.value;
        const distanceKm = (distanceMeters / 1000).toFixed(2);

        console.log(`Google Maps distance for ${startPlaceId} → ${endPlaceId}: ${distanceKm} km`);

        // --- CACHING STORAGE (Remains the same) ---
        const expirySeconds = 86400; // 24 hours
        await client.set(key, distanceKm, { EX: expirySeconds });
        await client.set(reverseKey, distanceKm, { EX: expirySeconds });

        return parseFloat(distanceKm);
    } catch (error) {
        console.error("Error fetching distance from Google Maps:", error.message);
        return null;
    }
}

const routeBreakdownFunction = async (req, res) => {
    // 1. INPUT VALIDATION & PARAMETER DESTRUCTURING
    // Safely extract required parameters (origin, destination) and set a default for optional 'mode'.
    const { origin, destination, mode = 'transit' } = req.body;
    console.log('received routes for break down', origin, destination, mode);

    // IMPORTANT: Basic check to ensure parameters were received
    if (!origin || !destination) {
        return res.status(400).json({ error: "Origin and Destination place_ids are required." });
    }

    // 2. CONSTRUCT API URL
    // Build the complete Google Directions API URL using the user inputs and the secret API key.
    // The API_KEY must be stored securely as an environment variable (not shown here, but assumed).
    const googleApiUrl = `https://maps.googleapis.com/maps/api/directions/json?origin=place_id:${origin}&destination=place_id:${destination}&mode=${mode}&key=${GOOGLE_API_KEY}`;

    try {
        // --- CACHING LOGIC (REDIS) ---
        // 3. DEFINE CACHE KEYS
        // Create standard and reverse lookup keys to check the cache for both directions (A->B and B->A).
        const key = `${origin}->${destination}`;
        const reverseKey = `${destination}->${origin}`;

        // 4. CHECK CACHE FOR ROUTE DATA
        // Attempt to retrieve pre-calculated route data from the Redis cache using both keys.
        const cached =
            (await client.get(key)) || (await client.get(reverseKey));

        if (cached) {
            // 5. RETURN CACHED DATA
            // If cached data is found, log the action and immediately return the parsed JSON response,
            // bypassing the costly Google API call.
            console.log("Returning cached route breakdown data.");
            return res.status(200).json({ route: JSON.parse(cached) });
        }
        console.log("not found route break down in cache", cached)
        // --- GOOGLE API CALL ---

        // 6. FETCH DATA FROM GOOGLE API
        // If no cache hit, execute the external HTTP GET request to the Google Directions API.
        const response = await googleMapsApi.get(googleApiUrl);
        const data = response.data;

        // 7. HANDLE API ERRORS/NO ROUTES
        // Check the API status field ('OK' is success) and verify that at least one route was returned.
        if (data.status !== 'OK' || data.routes.length === 0) {
            // Return a 404 status if the API indicates failure or cannot find a route.
            return res.status(404).json({ error: 'No route found.' });
        }

        // 8. EXTRACT STEP-BY-STEP INSTRUCTIONS
        // Focus on the first (most recommended) route, and the first (and usually only) leg.
        // The 'steps' array contains the detailed directions (the route breakdown).
        const steps = data.routes[0].legs[0].steps;

        // 9. MAP AND CLEAN/FORMAT THE DATA
        // Iterate over the raw steps array to create a simplified, custom JSON structure for the frontend.
        const cleanRoute = steps.map(step => ({
            // The main direction/landmark instruction (e.g., "Take the bus to Agege").
            instruction: step.html_instructions, 
            distance: step.distance.text,
            duration: step.duration.text,
            travelMode: step.travel_mode,
            // Include public transit specific details (line name, stop name) if the step is a transit step.
            transit: step.transit_details ? {
                line: step.transit_details.line.name,
                departureStop: step.transit_details.departure_stop.name
            } : null
        }));

        // --- CACHING STORAGE ---

        // 10. CACHE THE RESULT
        // Define cache expiration time (Time-To-Live, TTL) for efficient caching (e.g., 30 days).
        const expiresIn = 30 * 60; // 30 minutes for traffic/transit sensitive data
        
        // Store the result using both the forward and reverse keys to enable cache hits in both directions.
        await client.setEx(key, expiresIn, JSON.stringify(cleanRoute));
        await client.setEx(reverseKey, expiresIn, JSON.stringify(cleanRoute));

        // 11. SEND FINAL RESPONSE
        // Return the cleaned and formatted route breakdown data to the client (React Native app).
        console.log("route break down result", cleanRoute)
        return res.status(200).json({ route: cleanRoute });

    } catch (error) {
        // 12. GENERAL ERROR HANDLING
        // Log the internal error and send a generic 500 status back to the client.
        console.error("Google API Error:", error.message, error);
        return res.status(500).json({ error: 'Internal Server Error (Check logs for details).' });
    }
};

module.exports = {
    placeSearchFunction,
    routeBreakdownFunction
}