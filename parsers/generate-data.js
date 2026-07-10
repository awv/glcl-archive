const fs = require('fs');
const path = require('path');

function generateDataJs() {
    const jsonFolder = path.join(__dirname, '..', 'backend_tools', 'processed_json');
    const outputPath = path.join(__dirname, '..', 'data.js');

    if (!fs.existsSync(jsonFolder)) {
        console.error(`Error: The folder ${jsonFolder} does not exist yet.`);
        return;
    }

    // 1. Read all processed JSON files
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

    // 2. Sort by Season (e.g., "2014/2015" before "2019/2020")
    // If seasons match, it sub-sorts by discipline and race number to keep it clean.
    allResults.sort((a, b) => {
        if (a.season !== b.season) {
            return a.season.localeCompare(b.season);
        }
        if (a.discipline !== b.discipline) {
            return a.discipline.localeCompare(b.discipline);
        }
        return a.race_number - b.race_number;
    });

    // 3. Write out to the root data.js file
    // Using a standard global variable assignment compatible with plain HTML templates
    const fileContent = `// Auto-generated database file. Do not edit directly.\nconst GCL_DATA = ${JSON.stringify(allResults, null, 2)};\n`;

    fs.writeFileSync(outputPath, fileContent, 'utf-8');
    console.log(`Success! Combined and sorted ${allResults.length} records into root data.js`);
}

generateDataJs();