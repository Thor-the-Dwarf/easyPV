const fs = require('fs');
const path = require('path');

const gameName = "risk_finder_das_kleingedruckte";
const htmlFile = `_ghtml_${gameName}.html`;
const jsonFile = `data/_gg01_${gameName}.json`;
const enginePath = "../../../../../../../game_pages/FindingGame/index.html";

console.log(`Verifying ${gameName}...`);

// 1. Check HTML Redirect
if (fs.existsSync(path.join(__dirname, htmlFile))) {
    const content = fs.readFileSync(path.join(__dirname, htmlFile), 'utf8');
    if (content.includes("window.location.replace") && content.includes("FindingGame")) {
        console.log("✅ HTML Redirect wrapper exists and points to Engine.");
    } else {
        console.error("❌ HTML file exists but does not seem to act as a redirect to FindingGame.");
        process.exit(1);
    }
} else {
    console.error(`❌ HTML file ${htmlFile} missing.`);
    process.exit(1);
}

// 2. Check JSON Config
if (fs.existsSync(path.join(__dirname, jsonFile))) {
    try {
        JSON.parse(fs.readFileSync(path.join(__dirname, jsonFile), 'utf8'));
        console.log("✅ JSON Config exists and is valid.");
    } catch (e) {
        console.error(`❌ JSON Config ${jsonFile} is invalid: ${e.message}`);
        process.exit(1);
    }
} else {
    console.error(`❌ JSON Config ${jsonFile} missing.`);
    process.exit(1);
}

// 3. Check Engine Existence
const resolvedEnginePath = path.resolve(__dirname, enginePath);
if (fs.existsSync(resolvedEnginePath)) {
    console.log("✅ FindingGame Engine found.");
} else {
    console.error(`❌ FindingGame Engine NOT found at ${resolvedEnginePath}`);
    process.exit(1);
}

console.log("🎉 Verification Successful!");
