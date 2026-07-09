// assets/js/stats-engine.js
document.addEventListener("DOMContentLoaded", () => {
    // 1. READ URL PARAMETERS FOR SELECTED SEASON & DISCIPLINE
    const urlParams = new URLSearchParams(window.location.search);
    const rawSeasonParam = urlParams.get('season'); 
    const disciplineParam = urlParams.get('discipline') || 'xc'; // Default to xc if omitted
    
    let selectedSeason = "2025/2026"; 
    if (rawSeasonParam) {
        selectedSeason = rawSeasonParam.replace('_', '/');
    }

    // 2. FILTER MASTER RECORDS TO THE EXACT CAMPAIGN SERIES
    const allRecords = window.glclResults || [];
    let records = allRecords.filter(row => 
        row.season === selectedSeason && 
        row.discipline.toLowerCase() === disciplineParam.toLowerCase()
    );
    
    console.log(`Stats Engine loaded. Filtered to ${selectedSeason} (${disciplineParam.toUpperCase()}). Processing ${records.length} records.`);
    
    // Dynamically update headings and hero banner photography paths
    const dashboardTitle = document.getElementById('dashboard-title');
    const dashboardHeroBg = document.getElementById('dashboard-hero-bg');
    
    if (dashboardTitle) {
        const displayDiscipline = disciplineParam.toLowerCase() === 'xc' ? 'CROSS COUNTRY' : 'ROAD';
        dashboardTitle.textContent = `${selectedSeason} ${displayDiscipline} SEASON`;
        
        // Match path configuration variables to your folder assets:
        if (dashboardHeroBg) {
            const cleanSeason = selectedSeason.replace('/', '_'); // e.g., "2025_2026"
            const disciplineType = disciplineParam.toLowerCase(); // e.g., "xc" or "road"
            
            // Expected folder lookup: assets/images/banners/2025_2026_xc.jpg
            dashboardHeroBg.src = `assets/images/banners/${cleanSeason}_${disciplineType}.jpg`;
            
            // Graceful fallback if a specific image file isn't uploaded yet
            dashboardHeroBg.onerror = () => {
                dashboardHeroBg.src = 'assets/images/banners/default.jpg';
            };
        }
    }
    
    // Elements
    const fixtureGrid = document.getElementById('fixture-matrix-grid');
    const winnersContainer = document.getElementById('dominators-rows');
    const clubContainer = document.getElementById('club-stats-rows');
    const podiumsContainer = document.getElementById('category-podiums-grid');

    // Safe clear function for UI elements
    const clearUIContainers = () => {
        if (fixtureGrid) fixtureGrid.innerHTML = '';
        if (winnersContainer) winnersContainer.innerHTML = '';
        if (clubContainer) clubContainer.innerHTML = '';
        if (podiumsContainer) podiumsContainer.innerHTML = '';
    };

    // Handle an empty campaign year cleanly without breaking or rewriting URLs
    if (records.length === 0) {
        clearUIContainers();
        if (fixtureGrid) {
            fixtureGrid.innerHTML = `
                <div class="col-span-full stat-card p-8 rounded-xl border border-slate-800 text-center space-y-2">
                    <p class="text-sm font-bold text-slate-400 uppercase tracking-wide">No Fixture Results Found</p>
                    <p class="text-xs text-slate-500 font-medium max-w-md mx-auto">
                        There are currently no recorded ${disciplineParam.toUpperCase()} fixtures or results compiled for the ${selectedSeason} campaign.
                    </p>
                </div>
            `;
        }
        return;
    }

    // 1. GENERATE FIXTURE NAVIGATION MATRIX & PER-RACE TURNOUT
    const fixturesMap = {};
    records.forEach(row => {
        if (!row.discipline || !row.race_number) return;
        const key = `${row.discipline}_${row.race_number}`;
        
        if (!fixturesMap[key]) {
            fixturesMap[key] = {
                venue: row.venue || 'Unknown Venue',
                date: row.date || '',
                discipline: row.discipline,
                race_number: row.race_number,
                distance: row.distance || 'Unknown Distance',
                runnersCount: 0,
                menCount: 0,
                womenCount: 0,
                menWinner: 'N/A',
                womenWinner: 'N/A',
                status: row.status || 'Confirmed',
                clubTurnout: {}
            };
        }
        
        if (fixturesMap[key].status !== 'Cancelled' && row.pos > 0) {
            fixturesMap[key].runnersCount++;
            
            if (row.sex === 'M') fixturesMap[key].menCount++;
            if (row.sex === 'F') fixturesMap[key].womenCount++;
            
            if (row.club) {
                fixturesMap[key].clubTurnout[row.club] = (fixturesMap[key].clubTurnout[row.club] || 0) + 1;
            }
            
            if (parseInt(row.gender_pos, 10) === 1) {
                if (row.sex === 'M') fixturesMap[key].menWinner = row.name;
                if (row.sex === 'F') fixturesMap[key].womenWinner = row.name;
            }
        }
    });

    // Render Matrix Cards
    if (fixtureGrid) {
        fixtureGrid.innerHTML = '';
        Object.values(fixturesMap).forEach(fix => {
            let formattedDate = fix.date;
            if (fix.date && fix.date.includes('-')) {
                const parts = fix.date.split('-');
                const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
                if (parts.length === 3) {
                    formattedDate = `${parseInt(parts[2], 10)} ${months[parseInt(parts[1], 10) - 1]} ${parts[0]}`;
                }
            }

            if (fix.status === 'Cancelled') {
                const cancelledHtml = `
                    <div class="stat-card p-5 rounded-xl shadow-md flex flex-col justify-between border border-red-900/30 bg-red-950/5 relative overflow-hidden opacity-60">
                        <div>
                            <div class="flex justify-between items-start mb-2">
                                <span class="text-[10px] font-black tracking-widest text-slate-500 uppercase">Fixture ${fix.race_number}</span>
                                <span class="text-xs font-mono font-bold text-red-400 bg-red-500/10 px-2 py-0.5 rounded">CANCELLED</span>
                            </div>
                            <h4 class="text-base font-black text-slate-400 tracking-tight uppercase line-through">${fix.venue}</h4>
                            <p class="text-xs font-medium text-slate-600 mt-0.5">${formattedDate}</p>
                        </div>
                        <div class="mt-8 mb-4 text-center py-4 border border-dashed border-red-900/20 rounded-lg">
                            <span class="text-[11px] font-bold text-red-400/80 uppercase tracking-wider block">Fixture Cancelled</span>
                        </div>
                        <div class="pt-2 font-mono text-[11px] text-slate-600 border-t border-slate-900/20 flex justify-between">
                            <span>Total Field</span>
                            <span class="font-bold">0 Finishers</span>
                        </div>
                    </div>
                `;
                fixtureGrid.insertAdjacentHTML('beforeend', cancelledHtml);
            } else {
                let topClubStr = 'None';
                let maxClubCount = 0;
                Object.entries(fix.clubTurnout).forEach(([clubName, count]) => {
                    if (count > maxClubCount) {
                        maxClubCount = count;
                        topClubStr = `${clubName} (${count})`;
                    }
                });

                let menDistance = fix.distance;
                let womenDistance = fix.distance;
                
                if (fix.distance.toUpperCase().includes('MEN:') || fix.distance.toUpperCase().includes('WOMEN:')) {
                    const distParts = fix.distance.split(',');
                    distParts.forEach(part => {
                        if (part.toUpperCase().includes('MEN:')) {
                            menDistance = part.replace(/MEN\s*:/i, '').trim();
                        }
                        if (part.toUpperCase().includes('WOMEN:')) {
                            womenDistance = part.replace(/WOMEN\s*:/i, '').trim();
                        }
                    });
                }

                const cardHtml = `
                   <a href="results.html?season=${selectedSeason.replace('/', '_')}&discipline=${disciplineParam.toLowerCase()}&race=${fix.race_number}" class="stat-card p-5 rounded-xl shadow-md flex flex-col justify-between border border-slate-800 hover:border-brand-500 hover:scale-[1.01] transition-all block group">
                        <div>
                            <div class="flex justify-between items-start mb-2">
                                <span class="text-[10px] font-black tracking-widest text-slate-400 uppercase">Fixture ${fix.race_number}</span>
                                <span class="text-xs font-mono font-bold text-brand-500 bg-brand-500/10 px-2 py-0.5 rounded group-hover:bg-brand-500 group-hover:text-white transition-all">${fix.discipline.toUpperCase()}</span>
                            </div>
                            <h4 class="text-base font-black text-slate-100 tracking-tight uppercase group-hover:text-brand-500 transition-colors">${fix.venue}</h4>
                            <p class="text-xs font-medium text-slate-500 mt-0.5">${formattedDate}</p>
                        </div>
                        
                        <div class="mt-4 pt-3 border-t border-slate-800/60 space-y-3">
                            <div>
                                <span class="block text-[10px] font-black uppercase tracking-wider text-slate-500">Top Turnout</span>
                                <span class="text-xs font-bold text-slate-200 block mt-0.5">${topClubStr}</span>
                            </div>
                            <div>
                                <span class="block text-[10px] font-black uppercase tracking-wider text-slate-500">Men's Winner</span>
                                <span class="text-xs font-bold text-slate-200 block mt-0.5">${fix.menWinner}</span>
                            </div>
                            <div>
                                <span class="block text-[10px] font-black uppercase tracking-wider text-slate-500">Women's Winner</span>
                                <span class="text-xs font-bold text-slate-200 block mt-0.5">${fix.womenWinner}</span>
                            </div>
                            <div class="pt-2 border-t border-slate-800/40 font-mono text-[10px] text-slate-400 space-y-0.5">
                                <div class="flex justify-between text-[11px] text-slate-300 font-bold mb-1">
                                    <span>Total Field</span>
                                    <span>${fix.runnersCount} Finishers</span>
                                </div>
                            </div>
                        </div>
                    </a>
                `;
                fixtureGrid.insertAdjacentHTML('beforeend', cardHtml);
            }
        });
    }

    // 2. COMPILE INDIVIDUAL WINS (HALL OF FAME)
    const individualWins = {};
    records.forEach(row => {
        if (row.status === 'Cancelled') return;
        if (parseInt(row.gender_pos, 10) === 1 && row.pos > 0) {
            if (!individualWins[row.name]) {
                individualWins[row.name] = { name: row.name, club: row.club, wins: 0, sex: row.sex };
            }
            individualWins[row.name].wins++;
        }
    });

    const topWinners = Object.values(individualWins).sort((a, b) => b.wins - a.wins);
    if (winnersContainer) {
        winnersContainer.innerHTML = '';
        topWinners.forEach(runner => {
            winnersContainer.insertAdjacentHTML('beforeend', `
                <tr class="hover:bg-slate-900/20 transition-colors">
                    <td class="py-3 px-4 font-bold text-slate-100">
                        <a href="athlete.html?name=${encodeURIComponent(runner.name)}" class="hover:text-brand-500 transition-colors">
                            ${runner.name}
                        </a>
                    </td>
                    <td class="py-3 px-4 text-slate-400 text-xs font-semibold">${runner.club}</td>
                    <td class="py-3 px-4 text-right font-mono font-bold text-brand-500">${runner.wins}</td>
                </tr>
            `);
        });
    }

    // 3. AGGREGATE CLUB MOBILISATION STATS
    const clubStats = {};
    records.forEach(row => {
        if (!row.club || row.status === 'Cancelled' || row.pos === 0) return;
        if (!clubStats[row.club]) {
            clubStats[row.club] = { name: row.club, totalTurnout: 0, topTenFinishes: 0 };
        }
        clubStats[row.club].totalTurnout++;
        if (parseInt(row.gender_pos, 10) <= 10) {
            clubStats[row.club].topTenFinishes++;
        }
    });

    const rankedClubs = Object.values(clubStats).sort((a, b) => b.totalTurnout - a.totalTurnout);
    if (clubContainer) {
        clubContainer.innerHTML = '';
        rankedClubs.forEach(club => {
            clubContainer.insertAdjacentHTML('beforeend', `
                <tr class="hover:bg-slate-900/20 transition-colors">
                    <td class="py-3 px-4 font-bold text-slate-100">
                        <a href="club.html?name=${encodeURIComponent(club.name)}" class="hover:text-brand-500 transition-colors">
                            ${club.name}
                        </a>
                    </td>
                    <td class="py-3 px-4 text-center font-mono text-slate-300">${club.totalTurnout}</td>
                    <td class="py-3 px-4 text-right font-mono font-bold text-slate-400">${club.topTenFinishes}</td>
                </tr>
            `);
        });
    }

    // 4. CALCULATE AGE CATEGORY SEASON AWARDS
    const categoryGroups = {};
    records.forEach(row => {
        if (!row.age_cat || !row.cat_pos || !row.sex || row.status === 'Cancelled' || row.pos === 0) return;
        
        const catKey = `${row.sex.toUpperCase()}_${row.age_cat.toUpperCase()}`;
        if (!categoryGroups[catKey]) {
            categoryGroups[catKey] = {
                displayCat: row.age_cat.toUpperCase(),
                gender: row.sex.toUpperCase() === 'M' ? 'Men' : 'Women',
                runners: {}
            };
        }
        
        const currentPos = parseInt(row.cat_pos, 10);
        if (!categoryGroups[catKey].runners[row.name]) {
            categoryGroups[catKey].runners[row.name] = {
                name: row.name,
                club: row.club,
                bestPos: currentPos,
                posHistory: [currentPos]
            };
        } else {
            categoryGroups[catKey].runners[row.name].posHistory.push(currentPos);
            if (currentPos < categoryGroups[catKey].runners[row.name].bestPos) {
                categoryGroups[catKey].runners[row.name].bestPos = currentPos;
            }
        }
    });

    if (podiumsContainer) {
        podiumsContainer.innerHTML = '';
        Object.keys(categoryGroups).sort().forEach(key => {
            const group = categoryGroups[key];
            const runnersInCat = Object.values(group.runners)
                .sort((a, b) => {
                    if (a.bestPos !== b.bestPos) return a.bestPos - b.bestPos;
                    return b.posHistory.length - a.posHistory.length;
                })
                .slice(0, 3);

            let rowsHtml = '';
            runnersInCat.forEach((runner, idx) => {
                const medals = ['🥇', '🥈', '🥉'];
                rowsHtml += `
                    <div class="flex justify-between items-center text-xs py-1.5 ${idx !== 2 ? 'border-b border-slate-800/30' : ''}">
                        <div class="truncate pr-2">
                            <span class="mr-1.5">${medals[idx]}</span>
                            <!-- LINK ADDED HERE FOR DEEP-LINKING BACK TO ATHLETE PROFILES -->
                            <a href="athlete.html?name=${encodeURIComponent(runner.name)}" class="font-bold text-slate-200 hover:text-brand-500 transition-colors">
                                ${runner.name}
                            </a>
                        </div>
                        <span class="font-mono text-slate-400 text-[11px] shrink-0">Pos ${idx + 1}</span>
                    </div>
                `;
            });

            const genderBadgeColor = group.gender === 'Men' ? 'text-sky-400 bg-sky-500/10' : 'text-pink-400 bg-pink-500/10';
            const blockHtml = `
                <div class="leaderboard-box p-4 rounded-xl shadow-md border border-slate-800 flex flex-col justify-between">
                    <div>
                        <div class="flex justify-between items-center border-b border-slate-800 pb-2 mb-2">
                            <h4 class="text-xs font-black text-brand-500 uppercase tracking-widest">Category ${group.displayCat}</h4>
                            <span class="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded ${genderBadgeColor}">${group.gender}</span>
                        </div>
                        <div class="space-y-1">${rowsHtml}</div>
                    </div>
                </div>
            `;
            podiumsContainer.insertAdjacentHTML('beforeend', blockHtml);
        });
    }
});