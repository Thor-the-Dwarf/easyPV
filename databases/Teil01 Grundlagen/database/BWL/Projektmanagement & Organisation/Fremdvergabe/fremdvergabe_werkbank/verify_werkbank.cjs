const fs = require('fs');
const path = require('path');

async function verifyWerkbank() {
    const dir = __dirname;
    const files = [
        'data/_g01_fremdvergabe_werkbank.json',
        '_gcss_fremdvergabe_werkbank.css',
        '_ghtml_fremdvergabe_werkbank.html',
        '_gjs_fremdvergabe_werkbank.js'
    ];

    console.log("Starting Werkbank Verification...");

    for (const file of files) {
        const fullPath = path.join(dir, file);
        if (fs.existsSync(fullPath)) {
            console.log(`✅ FOUND: ${file}`);
            if (file.endsWith('.json')) {
                JSON.parse(fs.readFileSync(fullPath, 'utf8'));
                console.log(`   └─ JSON: Valid`);
            }
        } else {
            console.error(`❌ MISSING: ${file}`);
            process.exit(1);
        }
    }

    const jsContent = fs.readFileSync(path.join(dir, '_gjs_fremdvergabe_werkbank.js'), 'utf8');
    const required = ['spawnProduct', 'gameLoop', 'handleProductClick', 'updateStats'];
    required.forEach(fn => {
        if (!jsContent.includes(`function ${fn}`)) {
            console.error(`❌ Function missing in JS: ${fn}`);
            process.exit(1);
        }
        console.log(`✅ Function found: ${fn}`);
    });

    console.log("\nVerification SUCCESSFUL.");
}

verifyWerkbank();
