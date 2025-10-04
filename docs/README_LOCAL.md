
# OYO.PLUS — Fixed Build (Local Preview)

This package was patched to:
- Make asset links relative (so it opens via VS Code **Live Server** or any static server)
- Ensure a proper mobile viewport and responsive layout
- Add a lightweight mobile menu toggle
- Wrap wide tables to prevent horizontal overflow

## How to run locally

### Option A — VS Code Live Server
1. Open the folder in VS Code.
2. Right–click `index.html` → **Open with Live Server**.

### Option B — Python (no installs needed on most systems)
```bash
# From project root:
python3 -m http.server 5500
# Then open:
#   http://localhost:5500/index.html
```

If you previously used root-absolute paths like `/assets/...`, they are now relative (`assets/...`) so both **GitHub Pages** and **Live Server** work.

## Notes
- Extra responsive overrides live at `assets/css/responsive.css` (safe to customize).
- If you add new pages, make sure they include the `<meta name="viewport">` and a link to `responsive.css`.
