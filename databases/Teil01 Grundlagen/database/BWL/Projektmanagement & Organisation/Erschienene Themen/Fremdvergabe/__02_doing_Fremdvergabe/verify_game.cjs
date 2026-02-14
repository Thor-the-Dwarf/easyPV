const fs = require('fs');
const path = require('path');

function verifyGameFiles() {
    // Portable: resolve relative to this script file.
    const dir = __dirname;
    const files = [
        '_g01_fremdvergabe_lieferanten_check.json',
        '_gcss_fremdvergabe_lieferanten_check.css',
        '_ghtml_fremdvergabe_lieferanten_check.html',
        '_gjs_fremdvergabe_lieferanten_check.js'
    ];

    console.log('Starting File Verification...');

    for (const file of files) {
        const fullPath = path.join(dir, file);
        if (!fs.existsSync(fullPath)) {
            console.error(`MISSING: ${file}`);
            process.exit(1);
        }

        const stats = fs.statSync(fullPath);
        console.log(`FOUND: ${file} (${stats.size} bytes)`);

        if (file.endsWith('.json')) {
            try {
                JSON.parse(fs.readFileSync(fullPath, 'utf8'));
                console.log('  JSON Syntax: OK');
            } catch (e) {
                console.error('  JSON Syntax: FAILED!', e.message);
                process.exit(1);
            }
        }
    }

    console.log('\nBasic internal logic check (JS regex)...');
    const jsContent = fs.readFileSync(path.join(dir, '_gjs_fremdvergabe_lieferanten_check.js'), 'utf8');
    const requiredFuncs = ['initGame', 'updateAllocation', 'startSimulation', 'updateDashboard'];

    for (const func of requiredFuncs) {
        if (!jsContent.includes(`function ${func}`)) {
            console.error(`Function missing: ${func}`);
            process.exit(1);
        }
        console.log(`Function found: ${func}`);
    }

    console.log('\nVerification COMPLETE. All systems nominal.');
}

verifyGameFiles();
