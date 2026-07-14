// site-layout.js (Located in root)
document.addEventListener("DOMContentLoaded", () => {
    // Look for the new global-nav ID (fallback to global-header just in case)
    const navEl = document.getElementById('global-nav') || document.getElementById('global-header');
    const footerEl = document.getElementById('global-footer');

    // Determine the correct relative path baseline depending on page depth
    const isSubFolderPage = window.location.pathname.split('/').filter(Boolean).length > 1;

    // --- NAVIGATION LOGIC ---
    if (navEl) {
        const navComponentPath = isSubFolderPage ? '../components/nav.html' : 'components/nav.html';

        console.log(`Site-Layout: Attempting nav fetch from target path: ${navComponentPath}`);

        fetch(navComponentPath)
            .then(response => {
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                return response.text();
            })
            .then(data => {
                navEl.innerHTML = data;
                console.log("Global navigation rendered successfully.");

                // Dedicated function to bind the toggle once the elements are guaranteed to exist
                const bindMobileMenu = () => {
                    const toggleBtn = document.getElementById('mobile-menu-toggle');
                    const menuPanel = document.getElementById('mobile-menu-panel');
                    const hbgIcon = document.getElementById('hamburger-icon');
                    const clsIcon = document.getElementById('close-icon');

                    if (toggleBtn && menuPanel) {
                        // If we already marked this button as active, exit immediately
                        if (toggleBtn.dataset.menuBound === "true") return true;

                        // Unified clean click handler
                        const handleToggle = (e) => {
                            e.preventDefault();
                            e.stopPropagation(); // Prevents the event from bubbling up
                            
                            const isHidden = menuPanel.classList.contains('hidden');
                            menuPanel.classList.toggle('hidden', !isHidden);
                            
                            if (hbgIcon) hbgIcon.classList.toggle('hidden', isHidden);
                            if (clsIcon) clsIcon.classList.toggle('hidden', !isHidden);
                        };

                        // Use standard click but explicitly flag it to prevent dual attachments
                        toggleBtn.addEventListener('click', handleToggle);
                        toggleBtn.dataset.menuBound = "true";
                        
                        return true; 
                    }
                    return false;
                };

                // Run immediately, fallback to a brief retry loop if DevTools layout is lagging
                if (!bindMobileMenu()) {
                    const retryInterval = setInterval(() => {
                        if (bindMobileMenu()) clearInterval(retryInterval);
                    }, 50);
                    setTimeout(() => clearInterval(retryInterval), 2000); // Guard timeout
                }

                // Notify individual pages that the navigation is ready
                window.dispatchEvent(new Event('navLoaded'));
            })
            .catch(err => {
                console.error('Error loading global navigation component:', err);
            });
    }

    // --- FOOTER LOGIC ---
    if (footerEl) {
        const footerComponentPath = isSubFolderPage ? '../components/footer.html' : 'components/footer.html';

        console.log(`Site-Layout: Attempting footer fetch from target path: ${footerComponentPath}`);

        fetch(footerComponentPath)
            .then(response => {
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                return response.text();
            })
            .then(data => { 
                footerEl.innerHTML = data; 
                console.log("Global footer rendered successfully.");
            })
            .catch(err => {
                console.error('Error loading global footer component:', err);
                // Fallback direct rendering if the asset fetch breaks
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

    // 1. Inject the search markup context dynamically directly into the document body 
    const injectSearchModalMarkup = () => {
        if (document.getElementById('global-search-modal')) return;

        const modalDiv = document.createElement('div');
        modalDiv.id = 'global-search-modal';
        modalDiv.className = 'hidden fixed inset-0 z-[9999] flex items-start justify-center pt-[10vh] px-4';
        modalDiv.innerHTML = `
            <!-- Backdrop Blur -->
            <div id="search-modal-backdrop" class="absolute inset-0 bg-slate-950/80 backdrop-blur-sm"></div>

            <!-- Search Panel Box -->
            <div class="relative w-full max-w-xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[70vh] z-10" id="search-modal-panel">
                
                <!-- Search Field Header -->
                <div class="flex items-center px-4 border-b border-slate-800">
                    <svg class="w-5 h-5 text-slate-500 shrink-0" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                    <input type="text" id="modal-search-input" placeholder="Search runners, clubs, or categories..." autocomplete="off" class="w-full bg-transparent border-0 text-slate-100 placeholder-slate-600 px-3 py-4 text-base focus:outline-none focus:ring-0 font-medium">
                    
                    <!-- Close Button -->
                    <button id="nav-search-close" class="text-[10px] font-mono font-bold bg-slate-800 hover:bg-slate-700 text-slate-400 px-2 py-1 rounded transition-colors shrink-0">
                        ESC
                    </button>
                </div>

                <!-- Scrollable Results Tray -->
                <div id="modal-search-results" class="overflow-y-auto divide-y divide-slate-950 max-h-[50vh] p-2 empty:hidden"></div>

                <!-- Hotkey Hint Footer -->
                <div class="bg-slate-950/60 px-4 py-2 border-t border-slate-800/60 flex justify-between items-center text-[9px] font-mono font-bold text-slate-500 tracking-wider">
                    <span>TIP: SELECT AN ATHLETE TO BROWSE PROFILE</span>
                    <span>ESC TO CLOSE</span>
                </div>
            </div>
        `;
        document.body.appendChild(modalDiv);
    };

    const initDataset = () => {
        if (uniqueAthletes.length > 0) return;
        const dataset = window.glclResults || window.glclData || [];
        if (Array.isArray(dataset) && dataset.length > 0) {
            const runnersMap = new Map();
            dataset.forEach(item => {
                if (item && item.name) {
                    const cleanName = item.name.trim();
                    if (!runnersMap.has(cleanName)) {
                        runnersMap.set(cleanName, {
                            name: cleanName,
                            club: item.club || 'Independent',
                            sex: item.sex || '—',
                            age_cat: item.age_cat || '—'
                        });
                    }
                }
            });
            uniqueAthletes = Array.from(runnersMap.values());
        }
    };

    const openSearch = () => {
        injectSearchModalMarkup();
        initDataset();
        
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

    // 2. Document-wide click delegation loops
    document.addEventListener('click', (e) => {
        if (e.target.closest('#nav-search-trigger')) {
            e.preventDefault();
            openSearch();
        } else if (e.target.closest('#nav-search-close') || e.target.id === 'search-modal-backdrop') {
            e.preventDefault();
            closeSearch();
        }
    });

    // 3. Document-wide input typing listener
    document.addEventListener('input', (e) => {
        if (e.target && e.target.id === 'modal-search-input') {
            const resultsContainer = document.getElementById('modal-search-results');
            if (!resultsContainer) return;

            const query = e.target.value.toLowerCase().trim();
            resultsContainer.innerHTML = '';

            if (query.length < 2) return;
            if (uniqueAthletes.length === 0) initDataset();

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
                item.href = `athlete.html?name=${encodeURIComponent(athlete.name)}`;
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

    // 4. Hotkey selection event listeners
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

    // Initial injection setup on clean load entry
    if (document.body) {
        injectSearchModalMarkup();
    } else {
        document.addEventListener('DOMContentLoaded', injectSearchModalMarkup);
    }
    // Add this inside the IIFE or at the bottom of site-layout.js:
    document.addEventListener('glclOpenSearch', () => {
        if (typeof openSearch === 'function') {
            openSearch();
        }
    });
})();

