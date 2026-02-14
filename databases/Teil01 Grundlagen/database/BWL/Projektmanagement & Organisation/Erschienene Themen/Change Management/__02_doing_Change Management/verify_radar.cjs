const fs = require('fs');
const path = require('path');

async function verifyRadar() {
    const dir = '/Users/thor/WebstormProjects/easyPV/databases/Teil01 Grundlagen/database/BWL/Projektmanagement & Organisation/Erschienene Themen/Change Management/__02_doing_Change Management';
    const files = [
        '_g01_widerstands_radar.json',
        '_gcss_widerstands_radar.css',
        '_ghtml_widerstands_radar.html',
        '_gjs_widerstands_radar.js'
    ];

    console.log("Starting Radar Verification...");

    for (const file of files) {
        const fullPath = path.join(dir, file);
        if (fs.existsSync(fullPath)) {
            console.log(`✅ FOUND: ${file}`);
            if (file.endsWith('.json')) {
                const data = JSON.parse(fs.readFileSync(fullPath, 'utf8'));
                const resistances = data.participants.filter(p => p.isResistance).length;
                if (resistances !== 3) {
                    console.error(`❌ Data error: Expected 3 resistance participants, found ${resistances}`);
                    process.exit(1);
                }
                console.log(`   └─ JSON Content: OK (3 resistance participants)`);
            }
        } else {
            console.error(`❌ MISSING: ${file}`);
            process.exit(1);
        }
    }

    const jsContent = fs.readFileSync(path.join(dir, '_gjs_widerstands_radar.js'), 'utf8');
    const required = ['handleParticipantClick', 'renderParticipants', 'finishMeeting'];
    required.forEach(fn => {
        if (!jsContent.includes(`function ${fn}`)) {
            console.error(`❌ Function missing in JS: ${fn}`);
            process.exit(1);
        }
        console.log(`✅ Function found: ${fn}`);
    });

    console.log("\nVerification SUCCESSFUL.");
}

verifyRadar();
