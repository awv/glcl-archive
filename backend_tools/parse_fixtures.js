// backend_tools/parse_fixtures.js
const fs = require('fs');
const path = require('path');

const sourceDir = path.join(__dirname, 'results_source');
const rootDataPath = path.join(__dirname, '../data.js');

// --- MASTER CLUB ALIAS MAPPER ---
const clubAliases = {
    "pontypool": "Pont-Y-Pwl & District Runners",
    "pont-y-pwl": "Pont-Y-Pwl & District Runners",
    "pont-y-pwl & district runners": "Pont-Y-Pwl & District Runners",
    "pont-y-pwl rc": "Pont-Y-Pwl & District Runners",

    "caldicot": "Caldicot Running Club",
    "caldicot running club": "Caldicot Running Club",

    "usk": "Usk Runners",
    "usk runners": "Usk Runners",

    "parc bryn bach": "Parc Bryn Bach RC",
    "parc bryn bach rc": "Parc Bryn Bach RC",
    "pbb": "Parc Bryn Bach RC",
    "parcbrynbach": "Parc Bryn Bach RC",

    "lliswerry": "Lliswerry Runners",
    "lliswerry runners": "Lliswerry Runners",

    "chepstow": "Chepstow Harriers",
    "chepstow harriers": "Chepstow Harriers",

    "fairwater": "Fairwater Runners",
    "fairwater runners": "Fairwater Runners",

    "monmouth": "Spirit of Monmouth RC",
    "monmouth harriers": "Spirit of Monmouth RC",
    "spirit of monmouth": "Spirit of Monmouth RC",
    "spirit of monmouth rc": "Spirit of Monmouth RC",

    "caerleon": "Caerleon RC",
    "caerleon running club": "Caerleon RC",

    "islwyn": "Islwyn RC",
    "islwyn rc": "Islwyn RC",

    "abertillery": "Abertillery AC",
    "abertillery ac": "Abertillery AC",

    "gfiffithstown": "Griffithstown Harriers",

    "club 69": "Club 69",
    "club69": "Club 69",
    "69": "Club 69"
};

function normalizeClub(rawClub) {
    if (!rawClub) return "Unattached";
    const clean = rawClub.trim();
    if (/^(M|F|MEN|LADIES|WOMEN|MAN)$/i.test(clean)) {
        return "Unattached";
    }
    const key = clean.toLowerCase();
    return clubAliases[key] || clean;
}

function extractNameAndClub(rawStr) {
    let cleanStr = rawStr.replace(/,/g, '').trim();

    // Rejoin hyphenated surnames
    cleanStr = cleanStr.replace(/([a-zA-Z]+)\s*[-–]\s*([a-zA-Z]+)/g, '$1-$2');

    let rawClub = "";
    let name = cleanStr;

    // Restore embedded club pattern checks
    if (cleanStr.includes("Parc Bryn Bach") || cleanStr.includes("Parcbrynbach")) { rawClub = "Parc Bryn Bach RC"; name = cleanStr.replace(/Parc Bryn Bach|Parcbrynbach/gi, "").trim(); }
    else if (cleanStr.includes("Pont-y-Pwl") || cleanStr.includes("Pont-Y-Pwl")) { rawClub = "Pont-Y-Pwl & District Runners"; name = cleanStr.replace(/Pont-[yY]-Pwl/gi, "").trim(); }
    else if (cleanStr.includes("Lliswerry")) { rawClub = "Lliswerry Runners"; name = cleanStr.replace(/Lliswerry/gi, "").trim(); }
    else if (cleanStr.includes("Chepstow")) { rawClub = "Chepstow Harriers"; name = cleanStr.replace(/Chepstow/gi, "").trim(); }
    else if (cleanStr.includes("Spirit of Monmouth") || cleanStr.includes("Monmouth")) { rawClub = "Spirit of Monmouth RC"; name = cleanStr.replace(/Spirit of Monmouth|Monmouth/gi, "").trim(); }
    else if (cleanStr.includes("Caerleon")) { rawClub = "Caerleon RC"; name = cleanStr.replace(/Caerleon/gi, "").trim(); }
    else if (cleanStr.includes("Fairwater")) { rawClub = "Fairwater Runners"; name = cleanStr.replace(/Fairwater/gi, "").trim(); }
    else if (cleanStr.includes("Griffithstown") || cleanStr.includes("Gfiffithstown")) { rawClub = "Griffithstown Harriers"; name = cleanStr.replace(/Gf?iffithstown/gi, "").trim(); }
    else if (cleanStr.includes("Islwyn")) { rawClub = "Islwyn RC"; name = cleanStr.replace(/Islwyn/gi, "").trim(); }
    else if (cleanStr.includes("Abertillery")) { rawClub = "Abertillery AC"; name = cleanStr.replace(/Abertillery/gi, "").trim(); }
    else if (cleanStr.includes("Caldicot")) { rawClub = "Caldicot Running Club"; name = cleanStr.replace(/Caldicot/gi, "").trim(); }
    else if (cleanStr.includes("Usk")) { rawClub = "Usk Runners"; name = cleanStr.replace(/Usk/gi, "").trim(); }
    else if (/\bClub\s*69\b/i.test(cleanStr)) { rawClub = "Club 69"; name = cleanStr.replace(/\bClub\s*69\b/gi, "").trim(); }
    else {
        const words = cleanStr.split(/\s+/);
        const lastWord = words[words.length - 1] || "";
        if (/^(M|F|MEN|LADIES|WOMEN|MAN)$/i.test(lastWord)) {
            rawClub = "Unattached";
            name = words.slice(0, -1).join(' ');
        } else {
            rawClub = lastWord;
            name = words.slice(0, -1).join(' ');
        }
    }

    // Clean extraneous metadata leftover in name
    name = name
        .replace(/\b(MEN|LADIES|WOMEN|MAN|M|F)\b/gi, '')
        .replace(/\b(O\/?\d+|V\d+|Senior|SEN)\b/gi, '')
        .replace(/\d+/g, '')
        .replace(/\s+/g, ' ')
        .trim();

    return { name, rawClub: normalizeClub(rawClub) };
}

// REGEX MATCHERS
// 1a. Standard timed format (With age)
const standardRowRegex = /^(\d+)\s+([A-Z0-9]+)\s+(.+?)\s+(\d+)\s+([MF])\s+(Senior|V\d+\+?)\s+(.+?)\s+(\d{2}:\d{2}:\d{2})\s+(\d+)\s+(\d+)/i;

// 1b. Timed format without explicit age column
const noAgeTimedRegex = /^(\d+)\s+([A-Z0-9]+)\s+(.+?)\s+([MF])\s+(Senior|V\d+\+?)\s+(.+?)\s+(\d{2}:\d{2}:\d{2})\s+(\d+)\s+(\d+)/i;

// 1c. Legacy format with Club before Category
const clubBeforeCatRegex = /^(\d+)\s+([A-Z0-9]+)\s+(.+?)\s+([MF])\s+([A-Za-z\s&-]+?)\s+(O\/?\d+|V\d+|Senior|SEN)\s+(\d+)/i;

// 2. Legacy pre-COVID format regex
const legacyRowRegex = /^(\d+)\s+([A-Z0-9]+)\s+(.+?)\s+([MF]\d{4}|[MF]\d+)\s+(MEN|LADIES)\s+(\d+)\s+(\d+)/i;

// 3. Legacy format with Points at end
const legacyPointsRegex = /^(\d+)\s+(\d+)\s+([A-Z0-9]+)\s+(.+?)\s+([MF]\d{4}|[MF]\d+|\b[MF]\b)\s+(\d+)(?:\s+\d+)+/i;

const unknownRowRegex = /^\s*(\d+)\s+([A-Z0-9]+)?\s*(UNKNOWN|GUEST|ANON)\b/i;

let allCompiledResults = [];

if (!fs.existsSync(sourceDir)) {
    console.error(`Error: Source directory ${sourceDir} does not exist.`);
    process.exit(1);
}

const files = fs.readdirSync(sourceDir);

files.forEach(filename => {
    if (!filename.endsWith('.txt')) return;

    const parts = filename.replace('.txt', '').split('_');
    if (parts.length < 4) return;

    const discipline = parts[0];
    const season = `${parts[1]}/${parts[2]}`;
    const race_number = parseInt(parts[3], 10);

    const filePath = path.join(sourceDir, filename);
    const fileContent = fs.readFileSync(filePath, 'utf8');
    const lines = fileContent.split('\n');

    let venue = "Unknown Venue";
    let date = "";
    let distance = "";
    let status = "Confirmed";
    let notes = "";
    let race_section = "Main";

    const parsedResults = [];

    let maleCount = 0;
    let femaleCount = 0;

    lines.forEach((line) => {
        let cleanLine = line.trim();
        if (!cleanLine) return;

        if (cleanLine.startsWith('#')) {
            if (cleanLine.toUpperCase().startsWith('# VENUE:')) venue = cleanLine.split(':')[1].trim();
            if (cleanLine.toUpperCase().startsWith('# DATE:')) date = cleanLine.split(':')[1].trim();
            if (cleanLine.toUpperCase().startsWith('# DISTANCE:')) distance = cleanLine.split(':')[1].trim();
            if (cleanLine.toUpperCase().startsWith('# STATUS:')) status = cleanLine.split(':')[1].trim();
            if (cleanLine.toUpperCase().startsWith('# NOTES:')) notes = cleanLine.split(':').slice(1).join(':').trim();
            if (cleanLine.toUpperCase().startsWith('# SECTION:')) {
                race_section = cleanLine.split(':')[1].trim();
                maleCount = 0;
                femaleCount = 0;
            }
            return;
        }

        let record = null;

        // RULE 0: UNKNOWN ATHLETES
        const unknownMatch = cleanLine.match(unknownRowRegex);
        if (unknownMatch) {
            record = {
                pos: parseInt(unknownMatch[1], 10),
                bib: unknownMatch[2] || '-',
                name: 'Unknown Runner',
                age: 0,
                sex: 'N/A',
                age_cat: 'N/A',
                club: 'Unknown',
                time: 'N/A',
                gender_pos: 0,
                cat_pos: 0,
                race_number, discipline, season, venue, date, distance, status, notes, race_section
            };
        }

        // RULE 1a: STANDARD TIMED FORMAT (WITH AGE)
        if (!record) {
            const standardMatch = cleanLine.match(standardRowRegex);
            if (standardMatch) {
                record = {
                    pos: parseInt(standardMatch[1], 10),
                    bib: standardMatch[2],
                    name: standardMatch[3].replace(/,/g, '').trim(),
                    age: parseInt(standardMatch[4], 10),
                    sex: standardMatch[5],
                    age_cat: standardMatch[6],
                    club: normalizeClub(standardMatch[7]),
                    time: standardMatch[8],
                    gender_pos: parseInt(standardMatch[9], 10),
                    cat_pos: parseInt(standardMatch[10], 10),
                    race_number, discipline, season, venue, date, distance, status, notes, race_section
                };
            }
        }

        // RULE 1b: TIMED FORMAT WITHOUT EXPLICIT AGE COLUMN
        if (!record) {
            const noAgeMatch = cleanLine.match(noAgeTimedRegex);
            if (noAgeMatch) {
                record = {
                    pos: parseInt(noAgeMatch[1], 10),
                    bib: noAgeMatch[2],
                    name: noAgeMatch[3].replace(/,/g, '').trim(),
                    age: 0,
                    sex: noAgeMatch[4],
                    age_cat: noAgeMatch[5],
                    club: normalizeClub(noAgeMatch[6]),
                    time: noAgeMatch[7],
                    gender_pos: parseInt(noAgeMatch[8], 10),
                    cat_pos: parseInt(noAgeMatch[9], 10),
                    race_number, discipline, season, venue, date, distance, status, notes, race_section
                };
            }
        }

        // RULE 1c: LEGACY FORMAT WITH CLUB BEFORE CATEGORY
        if (!record) {
            const clubBeforeCatMatch = cleanLine.match(clubBeforeCatRegex);
            if (clubBeforeCatMatch) {
                let ageCat = clubBeforeCatMatch[6].toUpperCase();
                if (/^O\/?\d+/.test(ageCat)) {
                    ageCat = ageCat.replace(/^O\/?/, 'V');
                }

                const sex = clubBeforeCatMatch[4].toUpperCase();
                const computedGenderPos = (sex === 'F') ? ++femaleCount : ++maleCount;

                record = {
                    pos: parseInt(clubBeforeCatMatch[1], 10),
                    bib: clubBeforeCatMatch[2],
                    name: clubBeforeCatMatch[3].replace(/,/g, '').trim(),
                    age: 0,
                    sex: sex,
                    age_cat: ageCat,
                    club: normalizeClub(clubBeforeCatMatch[5]),
                    time: "N/A",
                    gender_pos: computedGenderPos,
                    cat_pos: parseInt(clubBeforeCatMatch[7], 10) || 0,
                    race_number, discipline, season, venue, date, distance, status, notes, race_section
                };
            }
        }

        // RULE 2: LEGACY FORMAT WITH EXPLICIT GENDER PLACE
        if (!record) {
            const legacyMatch = cleanLine.match(legacyRowRegex);
            if (legacyMatch) {
                const [_, overallPos, rawBib, rawNameAndClub, rawCat, rawGender, genderPos, catPos] = legacyMatch;
                const { name, rawClub } = extractNameAndClub(rawNameAndClub);

                let ageCat = "Senior";
                const catDigits = rawCat.match(/\d+/);
                if (catDigits && catDigits[0].substring(0, 2) !== '17' && catDigits[0].substring(0, 2) !== '14') {
                    ageCat = `V${catDigits[0].substring(0, 2)}`;
                }

                record = {
                    pos: parseInt(overallPos, 10),
                    bib: rawBib,
                    name: name,
                    age: 0,
                    sex: rawGender.toUpperCase() === 'MEN' ? 'M' : 'F',
                    age_cat: ageCat,
                    club: normalizeClub(rawClub),
                    time: "N/A",
                    gender_pos: parseInt(genderPos, 10),
                    cat_pos: parseInt(catPos, 10),
                    race_number, discipline, season, venue, date, distance, status, notes, race_section
                };
            }
        }

        // RULE 3: LEGACY WITH SCORE/POINTS AT END
        if (!record) {
            const pointsMatch = cleanLine.match(legacyPointsRegex);
            if (pointsMatch) {
                const [_, overallPos, finishToken, realBib, rawNameAndClub, rawCat, rawCatPos] = pointsMatch;
                const { name, rawClub } = extractNameAndClub(rawNameAndClub);

                const isFemale = rawCat.toUpperCase().startsWith('F');
                const sex = isFemale ? 'F' : 'M';
                let computedGenderPos = isFemale ? ++femaleCount : ++maleCount;

                let ageCat = "Senior";
                const catDigits = rawCat.match(/\d+/);
                if (catDigits && catDigits[0].substring(0, 2) !== '17' && catDigits[0].substring(0, 2) !== '14') {
                    ageCat = `V${catDigits[0].substring(0, 2)}`;
                }

                record = {
                    pos: parseInt(overallPos, 10),
                    bib: realBib,
                    name: name,
                    age: 0,
                    sex: sex,
                    age_cat: ageCat,
                    club: normalizeClub(rawClub),
                    time: "N/A",
                    gender_pos: computedGenderPos,
                    cat_pos: parseInt(rawCatPos, 10) || 0,
                    race_number, discipline, season, venue, date, distance, status, notes, race_section
                };
            }
        }

        // RULE 4: GENERAL TOKEN-BASED FALLBACK
        if (!record) {
            const tokenSplit = cleanLine.split(/\s+/);
            if (tokenSplit.length >= 4 && !isNaN(tokenSplit[0])) {
                const overallPos = parseInt(tokenSplit[0], 10);
                
                let realBib = tokenSplit[1];
                let nameClubStartIdx = 2;

                if (tokenSplit.length >= 5 && !isNaN(tokenSplit[1]) && !isNaN(tokenSplit[2])) {
                    realBib = tokenSplit[2];
                    nameClubStartIdx = 3;
                }

                let catIndex = -1;
                for (let i = tokenSplit.length - 1; i >= nameClubStartIdx; i--) {
                    if (/^([MF]\d+|\b[MF]\b|Senior|V\d+)/i.test(tokenSplit[i])) {
                        catIndex = i;
                        break;
                    }
                }

                let rawCat = "Senior";
                let rawCatPos = "0";
                let nameClubEndIdx = tokenSplit.length;

                if (catIndex !== -1) {
                    rawCat = tokenSplit[catIndex];
                    nameClubEndIdx = catIndex;
                    if (catIndex + 1 < tokenSplit.length && !isNaN(tokenSplit[catIndex + 1])) {
                        rawCatPos = tokenSplit[catIndex + 1];
                    }
                }

                const rawNameAndClub = tokenSplit.slice(nameClubStartIdx, nameClubEndIdx).join(' ');
                const { name, rawClub } = extractNameAndClub(rawNameAndClub);

                const isFemale = rawCat.toUpperCase().startsWith('F');
                const sex = isFemale ? 'F' : 'M';

                let computedGenderPos = isFemale ? ++femaleCount : ++maleCount;

                let ageCat = "Senior";
                const catDigits = rawCat.match(/\d+/);
                if (catDigits && catDigits[0].substring(0, 2) !== '17' && catDigits[0].substring(0, 2) !== '14') {
                    ageCat = `V${catDigits[0].substring(0, 2)}`;
                }

                record = {
                    pos: overallPos,
                    bib: realBib,
                    name: name || "Unknown Runner",
                    age: 0,
                    sex: sex,
                    age_cat: ageCat,
                    club: normalizeClub(rawClub),
                    time: "N/A",
                    gender_pos: computedGenderPos,
                    cat_pos: parseInt(rawCatPos, 10) || 0,
                    race_number, discipline, season, venue, date, distance, status, notes, race_section
                };
            }
        }

        if (record) {
            parsedResults.push(record);
        }
    });

    const statusLower = status.toLowerCase();
    if ((statusLower === 'cancelled' || statusLower === 'results missing') && parsedResults.length === 0) {
        parsedResults.push({
            race_number, discipline, season, venue, date, distance,
            status: statusLower === 'results missing' ? 'Results Missing' : 'Cancelled',
            notes, pos: 0, club: "N/A", name: "", sex: "", age_cat: "", cat_pos: 0, gender_pos: 0, race_section
        });
    }

    let logStatus = 'Found ' + parsedResults.length + ' finishers';
    if (statusLower === 'cancelled') logStatus = 'CANCELLED';
    if (statusLower === 'results missing') logStatus = 'RESULTS MISSING';

    console.log(`Parsed ${filename}: ${logStatus} at ${venue}`);
    allCompiledResults = allCompiledResults.concat(parsedResults);
});

allCompiledResults.sort((a, b) => {
    if (a.season !== b.season) return b.season.localeCompare(a.season);
    if (a.discipline !== b.discipline) return a.discipline.localeCompare(a.discipline);
    if (a.race_number !== b.race_number) return a.race_number - b.race_number;
    return a.pos - b.pos;
});

const jsContent = `// Auto-generated by backend_tools/parse_fixtures.js\nwindow.glclResults = ${JSON.stringify(allCompiledResults, null, 4)};\n`;
fs.writeFileSync(rootDataPath, jsContent, 'utf8');

console.log(`\nAutomated Build Success: Compiled ${allCompiledResults.length} total rows into root 'data.js'.`);