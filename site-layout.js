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
                    // Remove any old ghost listeners before binding a fresh one
                    toggleBtn.replaceWith(toggleBtn.cloneNode(true));
                    const cleanToggleBtn = document.getElementById('mobile-menu-toggle');

                    // Consolidated click and touch event handler
                    const handleToggle = (e) => {
                        e.preventDefault();
                        const isHidden = menuPanel.classList.contains('hidden');
                        menuPanel.classList.toggle('hidden', !isHidden);
                        if (hbgIcon) hbgIcon.classList.toggle('hidden', isHidden);
                        if (clsIcon) clsIcon.classList.toggle('hidden', !isHidden);
                    };

                    // Bind both standard clicks and mobile touch starts for DevTools
                    cleanToggleBtn.addEventListener('click', handleToggle);
                    cleanToggleBtn.addEventListener('touchstart', handleToggle, { passive: true });
                    
                    return true; // Bound successfully
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