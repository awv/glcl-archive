// site-layout.js
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
        footerEl.innerHTML = `
            <footer class="bg-slate-900 border-t border-slate-800 py-6 mt-16 text-center text-xs font-medium text-slate-500 tracking-wider uppercase">
                &copy; 2026 GLCL Archive. Built sleekly with structured data.
            </footer>
        `;
    }
});