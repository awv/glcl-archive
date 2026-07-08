// assets/js/stats-engine.js
document.addEventListener("DOMContentLoaded", () => {
    const records = window.glclResults || [];
    console.log(`Stats Engine loaded. Processing ${records.length} records.`);
    
    // Elements
    const fixtureGrid = document.getElementById('fixture-matrix-grid');
    const winnersContainer = document.getElementById('dominators-rows');
    const clubContainer = document.getElementById('club-stats-rows');
    const podiumsContainer = document.getElementById('category-podiums-grid');

    if (records.length === 0) {
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
                runnersCount: 0,
                menWinner: 'N/A',
                womenWinner: 'N/A',
                status: row.status || 'Confirmed',
                clubTurnout: {}
            };
        }
        
        // Only count fields and stats if the fixture actually went ahead
        if (fixturesMap[key].status !== 'Cancelled' && row.pos > 0) {
            fixturesMap[key].runnersCount++;
            
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

            // Render logic based on cancellation state
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
                            <span class="text-[10px] text-slate-500 block mt-0.5 font-medium">Weather / Safety conditions</span>
                        </div>
                        
                        <div class="pt-2 font-mono text-[11px] text-slate-600 border-t border-slate-900/20 flex justify-between">
                            <span>Total Field</span>
                            <span class="font-bold">0 Finishers</span>
                        </div>
                    </div>
                `;
                fixtureGrid.insertAdjacentHTML('beforeend', cancelledHtml);
            } else {
                // Standard Confirmed Card Output
                let topClubStr = 'None';
                let maxClubCount = 0;
                Object.entries(fix.clubTurnout).forEach(([clubName, count]) => {
                    if (count > maxClubCount) {
                        maxClubCount = count;
                        topClubStr = `${clubName} (${count})`;
                    }
                });

                const cardHtml = `
                    <div class="stat-card p-5 rounded-xl shadow-md flex flex-col justify-between border border-slate-800 hover:border-brand-500 transition-all">
                        <div>
                            <div class="flex justify-between items-start mb-2">
                                <span class="text-[10px] font-black tracking-widest text-slate-400 uppercase">Fixture ${fix.race_number}</span>
                                <span class="text-xs font-mono font-bold text-brand-500 bg-brand-500/10 px-2 py-0.5 rounded">${fix.discipline.toUpperCase()}</span>
                            </div>
                            <h4 class="text-base font-black text-slate-100 tracking-tight uppercase">${fix.venue}</h4>
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
                            <div class="flex justify-between pt-2 font-mono text-[11px] text-slate-400 border-t border-slate-800/40">
                                <span>Total Field</span>
                                <span class="font-bold text-slate-300">${fix.runnersCount} Finishers</span>
                            </div>
                        </div>
                    </div>
                `;
                fixtureGrid.insertAdjacentHTML('beforeend', cardHtml);
            }
        });
    }

    // 2. COMPILE INDIVIDUAL WINS (HALL OF FAME)
    const individualWins = {};
    records.forEach(row => {
        if (parseInt(row.gender_pos, 10) === 1) {
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
                    <td class="py-3 px-4 font-bold text-slate-100">${runner.name} <span class="text-xs font-mono text-slate-500 ml-1">(${runner.sex})</span></td>
                    <td class="py-3 px-4 text-slate-400 text-xs font-semibold">${runner.club}</td>
                    <td class="py-3 px-4 text-right font-mono font-bold text-brand-500">${runner.wins}</td>
                </tr>
            `);
        });
    }

    // 3. AGGREGATE CLUB MOBILISATION STATS
    const clubStats = {};
    records.forEach(row => {
        if (!row.club) return;
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
                    <td class="py-3 px-4 font-bold text-slate-100">${club.name}</td>
                    <td class="py-3 px-4 text-center font-mono text-slate-300">${club.totalTurnout}</td>
                    <td class="py-3 px-4 text-right font-mono font-bold text-slate-400">${club.topTenFinishes}</td>
                </tr>
            `);
        });
    }

// 4. CALCULATE AGE CATEGORY SEASON AWARDS (TOP 3) - SEPARATED BY GENDER
    const categoryGroups = {};
    records.forEach(row => {
        if (!row.age_cat || !row.cat_pos || !row.sex || row.status === 'Cancelled') return;
        
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
                posHistory: [currentPos] // Track all finishes to break ties
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
        const sortedKeys = Object.keys(categoryGroups).sort((a, b) => a.localeCompare(b));

        sortedKeys.forEach(key => {
            const group = categoryGroups[key];
            
            const runnersInCat = Object.values(group.runners)
                .sort((a, b) => {
                    // 1. Sort primarily by best position achieved
                    if (a.bestPos !== b.bestPos) return a.bestPos - b.bestPos;
                    
                    // 2. Tie-breaker: Count how many times they achieved that best position
                    const aCount = a.posHistory.filter(p => p === a.bestPos).length;
                    const bCount = b.posHistory.filter(p => p === b.bestPos).length;
                    if (aCount !== bCount) return bCount - aCount; // More wins wins
                    
                    // 3. Second tie-breaker: Total races completed (reward consistency)
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
                            <span class="font-bold text-slate-200">${runner.name}</span>
                            <span class="block text-[10px] text-slate-500 truncate font-semibold">${runner.club}</span>
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
                            <h4 class="text-xs font-black text-brand-500 uppercase tracking-widest">
                                Category ${group.displayCat}
                            </h4>
                            <span class="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded ${genderBadgeColor}">
                                ${group.gender}
                            </span>
                        </div>
                        <div class="space-y-1">
                            ${rowsHtml}
                        </div>
                    </div>
                </div>
            `;
            podiumsContainer.insertAdjacentHTML('beforeend', blockHtml);
        });
    }
});