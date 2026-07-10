const fs = require('fs');
const path = require('path');

function generateLegacyJson() {
    const jsonFolder = path.join(__dirname, '..', 'backend_tools', 'processed_json');
    const outputPath = path.join(__dirname, '..', 'legacy-combined.json');

    if (!fs.existsSync(jsonFolder)) {
        console.error(`Error: The folder ${jsonFolder} does not exist yet.`);
        return;
    }

    const files = fs.readdirSync(jsonFolder).filter(file => file.endsWith('.json'));
    let allResults = [];

    files.forEach(file => {
        const filePath = path.join(jsonFolder, file);
        try {
            const fileData = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
            if (Array.isArray(fileData)) {
                allResults = allResults.concat(fileData);
            }
        } catch (error) {
            console.error(`Error reading or parsing ${file}:`, error);
        }
    });

    // Sort legacy entries by season cleanly
    allResults.sort((a, b) => {
        if (a.season !== b.season) return a.season.localeCompare(b.season);
        if (a.discipline !== b.discipline) return a.discipline.localeCompare(b.discipline);
        return a.race_number - b.race_number;
    });

    // Writes safely to a side-file, leaving your main data.js completely untouched
    fs.writeFileSync(outputPath, JSON.stringify(allResults, null, 2), 'utf-8');
    console.log(`Success! Combined ${allResults.length} legacy records into legacy-combined.json`);
}

generateLegacyJson();