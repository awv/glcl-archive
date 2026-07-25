// ==========================================
// 📊 GOOGLE ANALYTICS GLOBAL INJECTION
// ==========================================
(function() {
    const TRACKING_ID = 'G-L5RC85ZX8G';

    const gaScript = document.createElement('script');
    gaScript.async = true;
    gaScript.src = `https://www.googletagmanager.com/gtag/js?id=${TRACKING_ID}`;
    document.head.appendChild(gaScript);

    const gaInitScript = document.createElement('script');
    gaInitScript.text = `
        window.dataLayer = window.dataLayer || [];
        function gtag(){dataLayer.push(arguments);}
        gtag('js', new Date());
        gtag('config', '${TRACKING_ID}', { 'anonymize_ip': true });
    `;
    document.head.appendChild(gaInitScript);
})();

document.addEventListener("DOMContentLoaded", () => {
    const navEl = document.getElementById('global-nav') || document.getElementById('global-header');
    const footerEl = document.getElementById('global-footer');

    const isSubFolderPage = window.location.pathname.split('/').filter(Boolean).length > 1;

    if (navEl) {
        const navComponentPath = isSubFolderPage ? '../components/nav.html' : 'components/nav.html';

        fetch(navComponentPath)
            .then(response => {
                if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
                return response.text();
            })
            .then(data => {
                navEl.innerHTML = data;

                const bindMobileMenu = () => {
                    const toggleBtn = document.getElementById('mobile-menu-toggle');
                    const menuPanel = document.getElementById('mobile-menu-panel');
                    const hbgIcon = document.getElementById('hamburger-icon');
                    const clsIcon = document.getElementById('close-icon');

                    if (toggleBtn && menuPanel) {
                        if (toggleBtn.dataset.menuBound === "true") return true;

                        const handleToggle = (e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            
                            const isHidden = menuPanel.classList.contains('hidden');
                            menuPanel.classList.toggle('hidden', !isHidden);
                            
                            if (hbgIcon) hbgIcon.classList.toggle('hidden', isHidden);
                            if (clsIcon) clsIcon.classList.toggle('hidden', !isHidden);
                        };

                        toggleBtn.addEventListener('click', handleToggle);
                        toggleBtn.dataset.menuBound = "true";
                        return true; 
                    }
                    return false;
                };

                if (!bindMobileMenu()) {
                    const retryInterval = setInterval(() => {
                        if (bindMobileMenu()) clearInterval(retryInterval);
                    }, 50);
                    setTimeout(() => clearInterval(retryInterval), 2000);
                }

                window.dispatchEvent(new Event('navLoaded'));
            })
            .catch(err => console.error('Error loading global navigation component:', err));
    }

    if (footerEl) {
        const footerComponentPath = isSubFolderPage ? '../components/footer.html' : 'components/footer.html';

        fetch(footerComponentPath)
            .then(response => {
                if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
                return response.text();
            })
            .then(data => { 
                footerEl.innerHTML = data; 
            })
            .catch(err => {
                footerEl.innerHTML = `
                    <footer class="border-t border-slate-900 bg-slate-950/40 font-sans mt-auto">
                        <div class="max-w-7xl mx-auto px-6 py-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
                            <p class="text-[11px] leading-relaxed font-medium text-slate-500 max-w-2xl uppercase tracking-wider font-mono">
                                <span class="text-slate-400 font-bold block mb-1 font-sans">Archive Disclaimer:</span> 
                                Raw dataset metrics are parsed programmatically from historical results documentation. If you discover an error, misaligned registration, or missing club tracking code, please file a correction with Robert Gale.
                            </p>
                            <div class="text-right shrink-0 font-mono text-[11px] font-bold text-slate-400 uppercase tracking-widest md:self-end">
                                Built by <span class="text-brand-500">Robert Gale</span> <span class="text-slate-700">(Parc Bryn Bach)</span>
                            </div>
                        </div>
                    </footer>`;
            });
    }
});

// GLOBAL COMMAND PALETTE SYSTEM INTERCEPTOR
(() => {
    let uniqueAthletes = [];
    let isDatasetInitialized = false;

    const parseSeasonYear = (seasonStr) => {
        if (!seasonStr) return 0;
        const clean = String(seasonStr).replace(/[^0-9/_-]/g, '');
        const parts = clean.split(/[/_-]/);
        let yr = parseInt(parts[0], 10);
        if (isNaN(yr)) return 0;
        if (yr < 100) yr += 2000;
        return yr;
    };

    const getNameKey = (str) => {
        if (!str) return '';
        return str.replace(/,/g, '')
                  .toLowerCase()
                  .split(/\s+/)
                  .filter(Boolean)
                  .sort()
                  .join(' ');
    };

    // Helper to format string into proper Titlecase (e.g. "Niki MORGAN")
    const toProperCase = (word) => {
        if (!word) return '';
        return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    };

    // Robust Name Formatter & Reversal Normaliser
    const normalizeNameFormat = (str) => {
        if (!str) return '';
        let clean = str.replace(/,/g, '').trim();
        const parts = clean.split(/\s+/).filter(Boolean);

        if (parts.length === 2) {
            const [p1, p2] = parts;

            // Pattern: SURNAME Forename (e.g., MORGAN Niki or MORGAN NIKI)
            if (p1 === p1.toUpperCase() && p1.length > 1) {
                return `${toProperCase(p2)} ${p1.toUpperCase()}`;
            }
        }
        
        return clean;
    };

    const resolveAthleteName = (rawName) => {
        if (!rawName) return '';
        const corrections = window.glclCorrections || {};
        const nameChanges = corrections.nameChanges || {};
        const key = getNameKey(rawName);

        let resolved = '';
        Object.entries(nameChanges).forEach(([legacyName, data]) => {
            if (data && data.primaryName && (getNameKey(legacyName) === key || getNameKey(data.primaryName) === key)) {
                resolved = data.primaryName;
            }
        });

        return resolved || normalizeNameFormat(rawName);
    };

    const resolveCurrentClub = (athleteName, latestRecordClub) => {
        const corrections = window.glclCorrections || {};
        const clubHistory = corrections.clubHistory || {};
        const key = getNameKey(athleteName);
        const clubHistoryKey = Object.keys(clubHistory).find(k => getNameKey(k) === key);
        
        if (clubHistoryKey && clubHistory[clubHistoryKey]) {
            const presentEntry = clubHistory[clubHistoryKey].find(h => h.seasons && h.seasons.toLowerCase().includes('present'));
            if (presentEntry && presentEntry.club) {
                return window.getCanonicalClub ? window.getCanonicalClub(presentEntry.club) : presentEntry.club;
            }
        }
        
        const fallback = latestRecordClub || "Unattached";
        return window.getCanonicalClub ? window.getCanonicalClub(fallback) : fallback;
    };

    const injectSearchModalMarkup = () => {
        if (document.getElementById('global-search-modal')) return;

        const modalDiv = document.createElement('div');
        modalDiv.id = 'global-search-modal';
        modalDiv.className = 'hidden fixed inset-0 z-[9999] flex items-start justify-center pt-[10vh] px-4';
        modalDiv.innerHTML = `
            <div id="search-modal-backdrop" class="absolute inset-0 bg-slate-950/80 backdrop-blur-sm"></div>

            <div class="relative w-full max-w-xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[70vh] z-10" id="search-modal-panel">
                
                <div class="flex items-center px-4 border-b border-slate-800">
                    <svg class="w-5 h-5 text-slate-500 shrink-0" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                    <input type="text" id="modal-search-input" placeholder="Search runners, clubs, or categories..." autocomplete="off" class="w-full bg-transparent border-0 text-slate-100 placeholder-slate-600 px-3 py-4 text-base focus:outline-none focus:ring-0 font-medium">
                    
                    <button id="nav-search-close" class="text-[10px] font-mono font-bold bg-slate-800 hover:bg-slate-700 text-slate-400 px-2 py-1 rounded transition-colors shrink-0">
                        ESC
                    </button>
                </div>

                <div id="modal-search-results" class="overflow-y-auto divide-y divide-slate-950 max-h-[50vh] p-2 empty:hidden"></div>

                <div class="bg-slate-950/60 px-4 py-2 border-t border-slate-800/60 flex justify-between items-center text-[9px] font-mono font-bold text-slate-500 tracking-wider">
                    <span>TIP: SELECT AN ATHLETE TO BROWSE PROFILE</span>
                    <span>ESC TO CLOSE</span>
                </div>
            </div>
        `;
        document.body.appendChild(modalDiv);
    };

    const initDataset = (forceRebuild = false) => {
        if (isDatasetInitialized && !forceRebuild) return;
        
        const dataset = window.glclResults || window.glclData || [];
        if (Array.isArray(dataset) && dataset.length > 0) {
            const runnersMap = new Map();

            dataset.forEach(item => {
                if (item && item.name && item.pos > 0) {
                    const canonicalName = resolveAthleteName(item.name);
                    const key = getNameKey(canonicalName);
                    const rawClub = item.club ? item.club.trim() : 'Unattached';
                    const seasonYr = parseSeasonYear(item.season);

                    if (!runnersMap.has(key)) {
                        runnersMap.set(key, {
                            name: canonicalName,
                            rawClub: rawClub,
                            latestYear: seasonYr,
                            sex: item.sex || '—',
                            age_cat: item.age_cat || '—'
                        });
                    } else {
                        const existing = runnersMap.get(key);
                        if (seasonYr >= existing.latestYear) {
                            existing.latestYear = seasonYr;
                            existing.rawClub = rawClub;
                            existing.sex = item.sex || existing.sex;
                            existing.age_cat = item.age_cat || existing.age_cat;
                        }
                    }
                }
            });

            uniqueAthletes = Array.from(runnersMap.values()).map(a => ({
                name: a.name,
                club: resolveCurrentClub(a.name, a.rawClub),
                sex: a.sex,
                age_cat: a.age_cat
            }));

            isDatasetInitialized = true;
        }
    };

    const openSearch = () => {
        injectSearchModalMarkup();
        // Force dataset rebuild if corrections loaded after layout init
        initDataset(!isDatasetInitialized || !window.glclCorrections);
        
        const modal = document.getElementById('global-search-modal');
        const input = document.getElementById('modal-search-input');
        
        if (!modal) return;

        modal.classList.remove('hidden');
        if (input) {
            input.value = '';
            input.focus();
        }
        document.body.classList.add('overflow-hidden');
    };

    const closeSearch = () => {
        const modal = document.getElementById('global-search-modal');
        const input = document.getElementById('modal-search-input');
        const resultsContainer = document.getElementById('modal-search-results');

        if (!modal) return;

        modal.classList.add('hidden');
        if (input) input.value = '';
        if (resultsContainer) resultsContainer.innerHTML = '';
        document.body.classList.remove('overflow-hidden');
    };

    document.addEventListener('click', (e) => {
        if (e.target.closest('#nav-search-trigger')) {
            e.preventDefault();
            openSearch();
        } else if (e.target.closest('#nav-search-close') || e.target.id === 'search-modal-backdrop') {
            e.preventDefault();
            closeSearch();
        }

        if (e.target.closest('#mobile-burger-btn')) {
            e.preventDefault();
            
            const tray = document.getElementById('mobile-menu-tray');
            const openIcon = document.getElementById('burger-icon');
            const closeIcon = document.getElementById('burger-close-icon');

            if (tray && openIcon && closeIcon) {
                const isHidden = tray.classList.contains('hidden');
                if (isHidden) {
                    tray.classList.remove('hidden');
                    openIcon.classList.add('hidden');
                    closeIcon.classList.remove('hidden');
                } else {
                    tray.classList.add('hidden');
                    openIcon.classList.remove('hidden');
                    closeIcon.classList.add('hidden');
                }
            }
        }
    });

    document.addEventListener('input', (e) => {
        if (e.target && e.target.id === 'modal-search-input') {
            const resultsContainer = document.getElementById('modal-search-results');
            if (!resultsContainer) return;

            const query = e.target.value.toLowerCase().trim();
            resultsContainer.innerHTML = '';

            if (query.length < 2) return;
            initDataset();

            const filtered = uniqueAthletes.filter(athlete => 
                athlete.name.toLowerCase().includes(query) ||
                athlete.club.toLowerCase().includes(query)
            ).slice(0, 15);

            if (filtered.length === 0) {
                resultsContainer.innerHTML = `
                    <div class="px-4 py-3.5 text-slate-500 font-mono text-[10px] text-center tracking-wider">
                        NO ATHLETES FOUND MATCHING "${query.toUpperCase()}"
                    </div>
                `;
                return;
            }

            filtered.forEach(athlete => {
                const item = document.createElement('a');
                item.href = `athlete.html?name=${encodeURIComponent(athlete.name)}&club=${encodeURIComponent(athlete.club)}`;
                item.className = 'flex justify-between items-center px-4 py-3 hover:bg-slate-800/40 rounded-xl transition-all cursor-pointer group';
                item.innerHTML = `
                    <div class="space-y-0.5 text-left">
                        <span class="text-sm font-bold text-slate-200 group-hover:text-brand-400 transition-colors block">${athlete.name}</span>
                        <span class="text-[10px] font-mono font-bold text-slate-500 group-hover:text-slate-400 transition-colors uppercase block">${athlete.club}</span>
                    </div>
                    <span class="text-[9px] font-mono font-bold bg-slate-950 text-slate-400 px-2.5 py-1 rounded-md border border-slate-800 uppercase tracking-wider">
                        ${athlete.sex} / ${athlete.age_cat}
                    </span>
                `;
                resultsContainer.appendChild(item);
            });
        }
    });

    document.addEventListener('keydown', (e) => {
        const modal = document.getElementById('global-search-modal');
        if (e.key === 'Escape' && modal && !modal.classList.contains('hidden')) {
            closeSearch();
        }
        if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
            e.preventDefault();
            openSearch();
        }
    });

    if (document.body) {
        injectSearchModalMarkup();
    } else {
        document.addEventListener('DOMContentLoaded', injectSearchModalMarkup);
    }

    document.addEventListener('glclOpenSearch', () => {
        if (typeof openSearch === 'function') {
            openSearch();
        }
    });
})();