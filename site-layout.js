// site-layout.js (Located in root)
document.addEventListener("DOMContentLoaded", () => {
    const headerEl = document.getElementById('global-header');
    const footerEl = document.getElementById('global-footer');

    if (headerEl) {
        headerEl.innerHTML = `
            <header class="bg-slate-900 border-b border-slate-800 py-5 shadow-lg">
                <div class="max-w-[1400px] mx-auto px-4 flex flex-col sm:flex-row justify-between items-center gap-4">
                    <div class="flex items-center gap-3">
                        <div class="h-10 w-10 rounded-lg flex items-center justify-center font-black text-white text-xl shadow-md" style="background-color: #1F6C93;">
                            G
                        </div>
                        <div>
                            <h1 class="text-xl font-black text-slate-100 tracking-tight uppercase">GLCL Archive</h1>
                            <p class="text-xs text-slate-400 font-medium tracking-wider uppercase">Gwent League Cross Country & Road</p>
                        </div>
                    </div>
                </div>
            </header>
        `;
    }

    if (footerEl) {
        // Determine the correct relative path baseline depending on page depth
        // If the current window path includes a deeper slash, step back to the root baseline
        const isSubFolderPage = window.location.pathname.split('/').filter(Boolean).length > 1;
        const componentPath = isSubFolderPage ? '../components/footer.html' : 'components/footer.html';

        console.log(`Site-Layout: Attempting footer fetch from target path: ${componentPath}`);

        fetch(componentPath)
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