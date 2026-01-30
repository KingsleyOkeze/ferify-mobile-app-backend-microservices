/**
 * Algorithm Test Scenarios for Ferify Fare Estimation
 */

const filterOutliersIQR = (data) => {
    if (data.length < 4) return data;
    const sorted = [...data].sort((a, b) => a - b);
    const q1 = sorted[Math.floor((sorted.length / 4))];
    const q3 = sorted[Math.floor((sorted.length * (3 / 4)))];
    const iqr = q3 - q1;
    const lowerBound = q1 - 1.5 * iqr;
    const upperBound = q3 + 1.5 * iqr;
    return data.filter(x => x >= lowerBound && x <= upperBound);
};

const runTests = () => {
    console.log("--- STARTING ALGORITHM VALIDATION ---\n");

    // Scenario 1: Stable Market with Fraudulent Outlier
    const scenario1 = [300, 350, 320, 300, 10000]; // ₦10k is a clear scam
    const filtered1 = filterOutliersIQR(scenario1);
    console.log("Scenario 1 (Stable + Scam):", scenario1);
    console.log("Filtered result:", filtered1);
    console.log(filtered1.includes(10000) ? "❌ FAILED: Outlier not detected" : "✅ PASSED: Scam filtered out");
    console.log("");

    // Scenario 2: Real Crisis (Price Shift)
    // 50 reports of ₦300-350, then 1 of ₦1000. 
    // Is it fraud or crisis? 
    // In our algorithm, 1 report won't shift the mean due to IQR, but as more come in...
    const scenario2Data = Array(10).fill(300).concat([1000]);
    const filtered2 = filterOutliersIQR(scenario2Data);
    console.log("Scenario 2 (Crisis Start - 1 report):", scenario2Data.length, "reports");
    console.log("Filtered length:", filtered2.length);
    console.log(filtered2.includes(1000) ? "❌ FAILED: Premature crisis shift" : "✅ PASSED: Waiting for more data before shifting");
    console.log("");

    // Scenario 3: Real Crisis (Confirmed)
    // Now we have 5 reports of ₦1000+
    const scenario3Data = [300, 300, 300, 300, 1000, 1050, 1100, 950, 1000];
    const filtered3 = filterOutliersIQR(scenario3Data);
    console.log("Scenario 3 (Confirmed Crisis):", scenario3Data);
    console.log("Filtered result:", filtered3);
    console.log(filtered3.length > 5 ? "✅ PASSED: Algorithm adapted to new range" : "❌ FAILED: Stuck on old prices");
    console.log("");

    console.log("--- VALIDATION COMPLETE ---");
};

runTests();
