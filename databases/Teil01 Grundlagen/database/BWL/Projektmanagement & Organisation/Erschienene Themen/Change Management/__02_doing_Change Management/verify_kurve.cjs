const fs = require('fs');
const path = require('path');

async function verifyChangeKurve() {
    const dir = '/Users/thor/WebstormProjects/easyPV/databases/Teil01 Grundlagen/database/BWL/Projektmanagement & Organisation/Erschienene Themen/Change Management/__02_doing_Change Management';
    const files = [
        '_g01_change_kurve.json',
        '_gcss_change_kurve.css',
        '_ghtml_change_kurve.html',
        '_gjs_change_kurve.js'
    ];

    console.log("Starting Change Kurve Verification...");

    for (const file of files) {
        const fullPath = path.join(dir, file);
        if (fs.existsSync(fullPath)) {
            console.log(`✅ FOUND: ${file}`);
            if (file.endsWith('.json')) {
                try {
                    const data = JSON.parse(fs.readFileSync(fullPath, 'utf8'));
                    if (data.phases.length !== 7 || data.statements.length !== 7) {
                        console.error(`❌ Data mismatch: Expected 7 phases/statements, found ${data.phases.length}/${data.statements.length}`);
                        process.exit(1);
                    }
                    console.log(`   └─ JSON Content: OK (7 phases/statements)`);
                } catch (e) {
                    console.error(`   └─ JSON Error:`, e.message);
                    process.exit(1);
                }
            }
        } else {
            console.error(`❌ MISSING: ${file}`);
            process.exit(1);
        }
    }

    const jsContent = fs.readFileSync(path.join(dir, '_gjs_change_kurve.js'), 'utf8');
    const requiredFuncs = ['renderPhases', 'renderPool', 'handleDropPointClick', 'checkSolution'];
    requiredFuncs.forEach(fn => {
        if (jsContent.includes(`function ${fn}`)) {
            console.log(`✅ Function: ${fn}`);
        } else {
            console.error(`❌ Missing Function: ${fn}`);
            process.exit(1);
        }
    });

    console.log("\nVerification SUCCESSFUL.");
}

verifyChangeKurve();
