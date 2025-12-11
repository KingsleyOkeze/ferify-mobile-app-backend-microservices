// ============================================================================
// NIGERIAN TRANSPORT PRICE ESTIMATOR - BACKEND API
// ============================================================================
// This is a complete Node.js backend for estimating Okada/Keke/Bus prices
// Built for MVP with detailed comments for beginners
// ============================================================================


// ============================================================================
// IN-MEMORY DATABASE (For MVP - Replace with MongoDB/PostgreSQL later)
// ============================================================================
// Think of this as a simple Excel sheet in your computer's memory
// It disappears when you restart the server, but perfect for testing!

let priceSubmissions = [];
// Example: [{id: 1, from: "Ishaga", to: "Okearo", vehicle: "Keke", price: 350, date: "2025-10-27"}]

let routeCache = {};
// Example: {"Ishaga->Okearo->Keke": {minPrice: 300, typical: 350, maxPrice: 400}}


// ============================================================================
// CONFIGURATION: Vehicle Types & Their Rates
// ============================================================================
// These are average prices per kilometer for each vehicle type in Lagos
// You can adjust these based on your research

const VEHICLE_RATES = {
  'Okada': {
    ratePerKm: 125,        // Motorcycles charge more because they're faster
    minRate: 100,
    maxRate: 150
  },
  'Keke': {
    ratePerKm: 100,        // Tricycles are mid-range
    minRate: 80,
    maxRate: 120
  },
  'Bus': {
    ratePerKm: 80,         // Buses are cheapest per km
    minRate: 60,
    maxRate: 100
  }
};

// How long should we remember old prices?
const PRICE_EXPIRY_DAYS = 30;  // Forget prices older than 30 days

// How many recent high-price reports means "surge pricing"?
const SURGE_THRESHOLD = 5;     // If 5+ people report high prices in 48hrs


// ============================================================================
// HELPER FUNCTION 1: Calculate Distance Between Two Locations
// ============================================================================
// In real MVP, you'd use Google Maps Distance Matrix API
// For now, this is a MOCK function that returns fake distances

async function calculateDistance(fromLocation, toLocation) {
  // WHAT THIS DOES:
  // Takes two location names and returns distance in kilometers
  
  // WHY WE NEED THIS:
  // When someone searches for a route we don't have data for yet,
  // we need to estimate the price based on how far it is
  
  // FOR MVP: Replace this with actual Google Maps API call
  // Example: https://maps.googleapis.com/maps/api/distancematrix/json
  
  console.log(`📍 Calculating distance from ${fromLocation} to ${toLocation}`);
  
  // MOCK DISTANCES (in kilometers)
  // In real app, this would be a real API call
  const mockDistances = {
    'Ishaga->Okearo': 5.2,
    'Yaba->Ikeja': 12.5,
    'Lekki->VI': 8.3,
    'Surulere->Festac': 15.0
  };
  
  const key = `${fromLocation}->${toLocation}`;
  const reverseKey = `${toLocation}->${fromLocation}`;
  
  // Check if we have this route in our mock data
  if (mockDistances[key]) {
    return mockDistances[key];
  } else if (mockDistances[reverseKey]) {
    return mockDistances[reverseKey];  // Distance is same both ways
  } else {
    // Default: assume 10km for unknown routes
    return 10.0;
  }
}


// ============================================================================
// HELPER FUNCTION 2: Round Price to Nearest 50 Naira
// ============================================================================
// Nigerian transport fares are usually in multiples of 50 or 100

function roundToNearest50(price) {
  // WHAT THIS DOES:
  // Takes any price (e.g., 347) and rounds it to nearest 50 (350)
  
  // WHY WE NEED THIS:
  // In Nigeria, drivers rarely charge ₦347 or ₦423
  // They charge ₦350, ₦400, ₦450, etc.
  // This makes our estimates realistic
  
  // HOW IT WORKS:
  // 347 ÷ 50 = 6.94 → rounds to 7 → 7 × 50 = 350
  return Math.round(price / 50) * 50;
}


// ============================================================================
// HELPER FUNCTION 3: Calculate Percentile from Array of Numbers
// ============================================================================
// Percentiles help us understand the spread of prices

function calculatePercentile(sortedArray, percentile) {
  // WHAT THIS DOES:
  // Finds the value at a specific position in a sorted list
  // E.g., 50th percentile (median) = middle value
  
  // WHY WE NEED THIS:
  // Instead of just averaging prices, we want to know:
  // - 25th percentile = cheap prices
  // - 50th percentile = typical prices
  // - 75th percentile = expensive prices
  
  // EXAMPLE:
  // Prices: [300, 300, 350, 350, 400, 450, 500]
  // 25th percentile = 300 (cheap end)
  // 50th percentile = 350 (typical)
  // 75th percentile = 450 (expensive end)
  
  if (sortedArray.length === 0) return 0;
  
  const index = (percentile / 100) * (sortedArray.length - 1);
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  const weight = index - lower;
  
  // If exact match, return that value
  if (lower === upper) {
    return sortedArray[lower];
  }
  
  // Otherwise, interpolate between two values
  return sortedArray[lower] * (1 - weight) + sortedArray[upper] * weight;
}


// ============================================================================
// HELPER FUNCTION 4: Get Days Ago from a Date
// ============================================================================

function getDaysAgo(dateString) {
  // WHAT THIS DOES:
  // Calculates how many days ago a price was submitted
  
  // WHY WE NEED THIS:
  // We want recent prices to matter more than old prices
  // A price from yesterday is more accurate than a price from 20 days ago
  
  const submittedDate = new Date(dateString);
  const today = new Date();
  const diffTime = today - submittedDate;
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
}


// ============================================================================
// CORE FUNCTION 1: Distance-Based Estimate (For New Routes)
// ============================================================================

async function calculateDistanceBasedEstimate(fromLocation, toLocation, vehicleType) {
  // WHAT THIS DOES:
  // When we have NO user-submitted prices for a route,
  // we estimate the price based on distance
  
  // WHY WE NEED THIS:
  // On Day 1 of your MVP, you have zero user data
  // But users still need some estimate to start with
  
  // HOW IT WORKS:
  // 1. Get distance between locations (e.g., 5km)
  // 2. Multiply by vehicle rate (e.g., Keke = ₦100/km)
  // 3. Result: 5km × ₦100 = ₦500
  
  console.log('\n🔄 Using DISTANCE-BASED estimate (no user data yet)');
  
  // Step 1: Get the distance
  const distanceKm = await calculateDistance(fromLocation, toLocation);
  console.log(`   Distance: ${distanceKm} km`);
  
  // Step 2: Get the rate for this vehicle type
  const rates = VEHICLE_RATES[vehicleType];
  if (!rates) {
    throw new Error(`Unknown vehicle type: ${vehicleType}`);
  }
  
  // Step 3: Calculate estimated price
  const estimatedPrice = distanceKm * rates.ratePerKm;
  console.log(`   Raw estimate: ₦${estimatedPrice} (${distanceKm}km × ₦${rates.ratePerKm}/km)`);
  
  // Step 4: Round to realistic price
  const typical = roundToNearest50(estimatedPrice);
  const min = roundToNearest50(estimatedPrice - 50);  // A bit cheaper
  const max = roundToNearest50(estimatedPrice + 50);  // A bit more expensive
  
  console.log(`   Final estimate: ₦${min} - ₦${max} (Typical: ₦${typical})`);
  
  return {
    minPrice: min,
    typicalPrice: typical,
    maxPrice: max,
    confidence: 'LOW',  // We're not very confident since it's just a guess
    dataPoints: 0,      // Zero user submissions
    message: '📍 Estimated based on distance. Be the first to report actual price!',
    method: 'distance-based'
  };
}


// ============================================================================
// CORE FUNCTION 2: Statistical Estimate (From User Data)
// ============================================================================

function calculateStatisticalEstimate(submissions, vehicleType) {
  // WHAT THIS DOES:
  // When we HAVE user-submitted prices, we use smart math
  // to calculate the most accurate price range
  
  // WHY WE NEED THIS:
  // Different people report different prices (₦300, ₦350, ₦400)
  // We need to handle variations, outliers, and changing conditions
  
  // THE MAGIC:
  // - Recent prices matter more than old prices
  // - Outliers are detected and handled intelligently
  // - Surge pricing is automatically detected
  
  console.log('\n📊 Using STATISTICAL estimate (from user data)');
  console.log(`   Total submissions: ${submissions.length}`);
  
  // -------------------------
  // STEP 1: Filter Recent Prices (Last 30 Days)
  // -------------------------
  // WHY: Prices from 2 months ago are not relevant today
  
  const recentSubmissions = submissions.filter(sub => {
    const daysAgo = getDaysAgo(sub.timestamp);
    return daysAgo <= PRICE_EXPIRY_DAYS;
  });
  
  console.log(`   Recent submissions (last ${PRICE_EXPIRY_DAYS} days): ${recentSubmissions.length}`);
  
  if (recentSubmissions.length === 0) {
    console.log('   ⚠️ No recent data, falling back to distance-based');
    return null;  // Signal to use distance-based instead
  }
  
  
  // -------------------------
  // STEP 2: Apply Time-Based Weights
  // -------------------------
  // WHY: A price from yesterday is more accurate than a price from 20 days ago
  // HOW: We "duplicate" recent prices so they count more in our calculation
  
  const weightedPrices = [];
  
  recentSubmissions.forEach(sub => {
    const daysAgo = getDaysAgo(sub.timestamp);
    
    // Determine weight based on age
    let weight;
    if (daysAgo <= 7) {
      weight = 1.0;   // Last week: 100% weight (full importance)
    } else if (daysAgo <= 14) {
      weight = 0.7;   // 1-2 weeks ago: 70% weight
    } else {
      weight = 0.4;   // 2-4 weeks ago: 40% weight
    }
    
    // Add this price multiple times based on weight
    // E.g., weight 0.7 means add it 7 times (out of 10)
    const repeatCount = Math.round(weight * 10);
    for (let i = 0; i < repeatCount; i++) {
      weightedPrices.push(sub.price);
    }
  });
  
  console.log(`   Weighted prices array size: ${weightedPrices.length}`);
  
  
  // -------------------------
  // STEP 3: Sort Prices (Required for Percentile Calculations)
  // -------------------------
  weightedPrices.sort((a, b) => a - b);  // Ascending order: [300, 300, 350, 400, ...]
  
  
  // -------------------------
  // STEP 4: Detect Outliers Using IQR Method
  // -------------------------
  // THIS IS THE KEY TO HANDLING YOUR ₦1000 vs ₦350 PROBLEM!
  
  // WHAT IS IQR (Interquartile Range)?
  // It's a statistical method to find values that are "too different"
  // from the majority of the data
  
  // HOW IT WORKS:
  // Imagine prices: [300, 300, 350, 350, 400, 1000]
  // Q1 (25th percentile) = 300
  // Q3 (75th percentile) = 400
  // IQR = 400 - 300 = 100
  // Lower bound = 300 - (1.5 × 100) = 150
  // Upper bound = 400 + (1.5 × 100) = 550
  // So ₦1000 is WAY outside 550, it's an outlier!
  
  const Q1 = calculatePercentile(weightedPrices, 25);
  const Q3 = calculatePercentile(weightedPrices, 75);
  const IQR = Q3 - Q1;
  
  const lowerBound = Q1 - (1.5 * IQR);
  const upperBound = Q3 + (1.5 * IQR);
  
  console.log(`   Q1 (25th): ₦${Q1}, Q3 (75th): ₦${Q3}`);
  console.log(`   IQR: ₦${IQR}`);
  console.log(`   Outlier bounds: ₦${lowerBound.toFixed(0)} - ₦${upperBound.toFixed(0)}`);
  
  // Separate normal prices from outliers
  const normalPrices = [];
  const outlierPrices = [];
  
  weightedPrices.forEach(price => {
    if (price >= lowerBound && price <= upperBound) {
      normalPrices.push(price);
    } else {
      outlierPrices.push(price);
    }
  });
  
  console.log(`   Normal prices: ${normalPrices.length}, Outliers: ${outlierPrices.length}`);
  
  
  // -------------------------
  // STEP 5: Detect Surge Pricing
  // -------------------------
  // CRITICAL QUESTION: Is the "outlier" actually an error, or is it real surge?
  
  // SCENARIO A: One person reports ₦1000 when everyone else says ₦350
  // → Probably a mistake or someone trying to cheat
  // → We EXCLUDE this from our estimate
  
  // SCENARIO B: Five people report ₦800-₦1000 in the last 2 days
  // → Probably real surge (fuel price increase, weather, etc.)
  // → We INCLUDE this in our estimate and warn users
  
  const last48Hours = recentSubmissions.filter(sub => {
    return getDaysAgo(sub.timestamp) <= 2;
  });
  
  const recentOutliers = last48Hours.filter(sub => {
    return sub.price > upperBound || sub.price < lowerBound;
  });
  
  const surgeDetected = recentOutliers.length >= SURGE_THRESHOLD;
  
  console.log(`   Recent outliers (48hrs): ${recentOutliers.length}`);
  console.log(`   Surge detected: ${surgeDetected ? 'YES ⚠️' : 'NO ✓'}`);
  
  // Decide which prices to use for final calculation
  let finalPrices;
  if (surgeDetected) {
    // Use ALL prices (including outliers) because surge is real
    finalPrices = weightedPrices;
  } else {
    // Use only normal prices (exclude outliers as errors)
    finalPrices = normalPrices;
  }
  
  
  // -------------------------
  // STEP 6: Calculate Final Price Range
  // -------------------------
  finalPrices.sort((a, b) => a - b);
  
  const minPrice = roundToNearest50(calculatePercentile(finalPrices, 25));
  const typicalPrice = roundToNearest50(calculatePercentile(finalPrices, 50));
  const maxPrice = roundToNearest50(calculatePercentile(finalPrices, 75));
  
  console.log(`   Final range: ₦${minPrice} - ₦${maxPrice} (Typical: ₦${typicalPrice})`);
  
  
  // -------------------------
  // STEP 7: Calculate Confidence Level
  // -------------------------
  // MORE data points = MORE confidence in our estimate
  
  const dataPoints = recentSubmissions.length;
  let confidence;
  if (dataPoints >= 20) {
    confidence = 'HIGH';     // Lots of data, very confident
  } else if (dataPoints >= 10) {
    confidence = 'MEDIUM';   // Decent amount of data
  } else {
    confidence = 'LOW';      // Not much data yet
  }
  
  
  // -------------------------
  // STEP 8: Build User-Friendly Message
  // -------------------------
  let message = `Based on ${dataPoints} recent report${dataPoints > 1 ? 's' : ''}`;
  
  if (surgeDetected) {
    message += ' ⚠️ Prices may be higher than usual right now';
  }
  
  
  // -------------------------
  // STEP 9: Return Complete Result
  // -------------------------
  return {
    minPrice,
    typicalPrice,
    maxPrice,
    confidence,
    dataPoints,
    message,
    method: 'statistical',
    surgeDetected
  };
}


// ============================================================================
// MAIN API ENDPOINT 1: GET PRICE ESTIMATE
// ============================================================================
// This is what the user's phone app calls to get a price estimate

const getFareEstimateFunction = async (req, res) => {
  // WHAT THIS DOES:
  // User enters "From: Ishaga, To: Okearo, Vehicle: Keke"
  // We return "₦300 - ₦400 (Typical: ₦350)"
  
  try {
    // Get parameters from the request
    const { from, to, vehicle } = req.query;
    
    // Validate inputs
    if (!from || !to || !vehicle) {
      return res.status(400).json({
        error: 'Missing required parameters: from, to, vehicle'
      });
    }
    
    if (!VEHICLE_RATES[vehicle]) {
      return res.status(400).json({
        error: `Invalid vehicle type. Must be one of: ${Object.keys(VEHICLE_RATES).join(', ')}`
      });
    }
    
    console.log('\n' + '='.repeat(70));
    console.log(`📱 NEW PRICE ESTIMATE REQUEST`);
    console.log(`   From: ${from}`);
    console.log(`   To: ${to}`);
    console.log(`   Vehicle: ${vehicle}`);
    console.log('='.repeat(70));
    
    
    // -------------------------
    // STEP 1: Check Cache First (For Speed)
    // -------------------------
    // If we calculated this route 5 minutes ago, just return the cached result
    
    const cacheKey = `${from}->${to}->${vehicle}`;
    const cached = routeCache[cacheKey];
    
    if (cached && (Date.now() - cached.timestamp < 5 * 60 * 1000)) {
      // Cache is less than 5 minutes old, use it!
      console.log('✓ Returning CACHED result');
      return res.json(cached.data);
    }
    
    
    // -------------------------
    // STEP 2: Find Relevant Price Submissions
    // -------------------------
    // Look in our database for prices people have submitted for this route
    
    const relevantSubmissions = priceSubmissions.filter(sub => {
      // Match both directions (Ishaga→Okearo OR Okearo→Ishaga)
      const matchesRoute = (
        (sub.from === from && sub.to === to) ||
        (sub.from === to && sub.to === from)
      );
      return matchesRoute && sub.vehicle === vehicle;
    });
    
    console.log(`💾 Found ${relevantSubmissions.length} price submission(s) in database`);
    
    
    // -------------------------
    // STEP 3: Calculate Estimate
    // -------------------------
    let estimate;
    
    if (relevantSubmissions.length === 0) {
      // NO DATA: Use distance-based estimate
      estimate = await calculateDistanceBasedEstimate(from, to, vehicle);
    } else {
      // WE HAVE DATA: Use statistical estimate
      estimate = calculateStatisticalEstimate(relevantSubmissions, vehicle);
      
      // If statistical method fails (e.g., all data too old), fall back to distance
      if (!estimate) {
        estimate = await calculateDistanceBasedEstimate(from, to, vehicle);
      }
    }
    
    
    // -------------------------
    // STEP 4: Cache the Result
    // -------------------------
    routeCache[cacheKey] = {
      data: estimate,
      timestamp: Date.now()
    };
    
    
    // -------------------------
    // STEP 5: Return to User
    // -------------------------
    console.log('✅ Estimate calculated successfully!\n');
    res.json(estimate);
    
  } catch (error) {
    console.error('❌ Error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
};


// ============================================================================
// MAIN API ENDPOINT 2: SUBMIT A PRICE
// ============================================================================
// This is what users call to report the actual price they paid

const submitFarePriceFunction = async (req, res) => {
  // WHAT THIS DOES:
  // User reports "I just paid ₦350 for Ishaga to Okearo on a Keke"
  // We save it to our database and recalculate the estimate
  
  try {
    const { from, to, vehicle, price, userId } = req.body;
    
    // Validate inputs
    if (!from || !to || !vehicle || !price) {
      return res.status(400).json({
        error: 'Missing required fields: from, to, vehicle, price'
      });
    }
    
    if (!VEHICLE_RATES[vehicle]) {
      return res.status(400).json({
        error: `Invalid vehicle type. Must be one of: ${Object.keys(VEHICLE_RATES).join(', ')}`
      });
    }
    
    if (typeof price !== 'number' || price <= 0) {
      return res.status(400).json({
        error: 'Price must be a positive number'
      });
    }
    
    console.log('\n' + '='.repeat(70));
    console.log(`💰 NEW PRICE SUBMISSION`);
    console.log(`   From: ${from}`);
    console.log(`   To: ${to}`);
    console.log(`   Vehicle: ${vehicle}`);
    console.log(`   Price: ₦${price}`);
    console.log(`   User: ${userId || 'anonymous'}`);
    console.log('='.repeat(70));
    
    
    // -------------------------
    // STEP 1: Save to Database
    // -------------------------
    const submission = {
      id: priceSubmissions.length + 1,
      from,
      to,
      vehicle,
      price,
      userId: userId || 'anonymous',
      timestamp: new Date().toISOString()
    };
    
    priceSubmissions.push(submission);
    console.log(`✓ Saved to database (Total submissions: ${priceSubmissions.length})`);
    
    
    // -------------------------
    // STEP 2: Invalidate Cache
    // -------------------------
    // We need to recalculate the estimate now that we have new data
    const cacheKey = `${from}->${to}->${vehicle}`;
    delete routeCache[cacheKey];
    console.log(`✓ Cache cleared for this route`);
    
    
    // -------------------------
    // STEP 3: Return Success
    // -------------------------
    console.log('✅ Price submitted successfully!\n');
    res.json({
      success: true,
      message: 'Thank you! Your price report helps others.',
      submission
    });
    
  } catch (error) {
    console.error('❌ Error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
}


// ============================================================================
// HELPER ENDPOINT: Get All Submissions (For Testing/Admin)
// ============================================================================

// app.get('/api/submissions', (req, res) => {
//   // Returns all price submissions in the database
//   // Useful for debugging and seeing what data you have
  
//   res.json({
//     total: priceSubmissions.length,
//     submissions: priceSubmissions
//   });
// });


// ============================================================================
// HELPER ENDPOINT: Clear All Data (For Testing)
// ============================================================================

// app.post('/api/clear-data', (req, res) => {
//   // Deletes all data - useful when testing
//   // WARNING: Don't expose this in production!
  
//   priceSubmissions = [];
//   routeCache = {};
  
//   res.json({
//     success: true,
//     message: 'All data cleared'
//   });
// });


// ============================================================================
// START THE SERVER
// ============================================================================

// const PORT = process.env.PORT || 3000;

// app.listen(PORT, () => {
//   console.log('\n' + '='.repeat(70));
//   console.log('🚀 NIGERIAN TRANSPORT PRICE ESTIMATOR API');
//   console.log('='.repeat(70));
//   console.log(`✓ Server running on http://localhost:${PORT}`);
//   console.log('\n📚 Available Endpoints:');
//   console.log(`   GET  /api/estimate?from=Ishaga&to=Okearo&vehicle=Keke`);
//   console.log(`   POST /api/submit-price (body: {from, to, vehicle, price})`);
//   console.log(`   GET  /api/submissions (view all data)`);
//   console.log(`   POST /api/clear-data (reset database)`);
//   console.log('\n💡 Supported Vehicles:', Object.keys(VEHICLE_RATES).join(', '));
//   console.log('='.repeat(70) + '\n');
// });


// ============================================================================
// EXAMPLE USAGE (For Testing)
// ============================================================================

// 1. Get estimate with NO data (will use distance-based):
//    curl "http://localhost:3000/api/estimate?from=Ishaga&to=Okearo&vehicle=Keke"

// 2. Submit some prices:
//    curl -X POST http://localhost:3000/api/submit-price \
//      -H "Content-Type: application/json" \
//      -d '{"from":"Ishaga","to":"Okearo","vehicle":"Keke","price":350}'

// 3. Get estimate WITH data (will use statistical method):
//    curl "http://localhost:3000/api/estimate?from=Ishaga&to=Okearo&vehicle=Keke"

// 4. View all submissions:
//    curl "http://localhost:3000/api/submissions"

module.export = {
  getFareEstimateFunction,
  submitFarePriceFunction
}