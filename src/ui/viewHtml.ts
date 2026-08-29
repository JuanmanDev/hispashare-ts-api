export const viewHtml = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>HispaShare Details</title>
    <style>
        :root {
            --bg-color: #0f172a;
            --surface-color: rgba(30, 41, 59, 0.7);
            --text-main: #f8fafc;
            --text-muted: #94a3b8;
            --accent: #3b82f6;
            --accent-hover: #2563eb;
            --border: rgba(255,255,255,0.1);
            --font: 'Inter', system-ui, -apple-system, sans-serif;
        }

        body {
            background-color: var(--bg-color);
            color: var(--text-main);
            font-family: var(--font);
            margin: 0;
            padding: 20px;
            box-sizing: border-box;
            min-height: 100vh;
        }

        .container {
            max-width: 800px;
            margin: 0 auto;
        }

        .glass-panel {
            background: var(--surface-color);
            backdrop-filter: blur(12px);
            -webkit-backdrop-filter: blur(12px);
            border: 1px solid var(--border);
            border-radius: 16px;
            padding: 24px;
            margin-bottom: 24px;
            box-shadow: 0 4px 30px rgba(0, 0, 0, 0.1);
        }

        .header-section {
            display: flex;
            gap: 24px;
            align-items: flex-start;
        }

        .poster {
            width: 200px;
            border-radius: 12px;
            box-shadow: 0 8px 16px rgba(0,0,0,0.3);
            border: 1px solid var(--border);
        }

        .info h1 {
            margin: 0 0 12px 0;
            font-size: 28px;
            background: linear-gradient(to right, #60a5fa, #3b82f6);
            -webkit-background-clip: text;
            color: transparent;
        }

        .meta-grid {
            display: grid;
            grid-template-columns: auto 1fr;
            gap: 8px 16px;
            font-size: 14px;
        }

        .meta-label {
            color: var(--text-muted);
            font-weight: 600;
        }

        .synopsis {
            margin-top: 16px;
            line-height: 1.6;
            color: #cbd5e1;
            font-size: 15px;
            border-left: 3px solid var(--accent);
            padding-left: 12px;
        }

        .links-table {
            width: 100%;
            border-collapse: collapse;
            font-size: 14px;
            margin-top: 16px;
        }

        .links-table th {
            text-align: left;
            padding: 12px;
            border-bottom: 2px solid var(--border);
            color: var(--text-muted);
        }

        .links-table td {
            padding: 12px;
            border-bottom: 1px solid var(--border);
        }

        .links-table tr:hover {
            background-color: rgba(255,255,255,0.02);
        }

        .btn {
            background-color: var(--accent);
            color: white;
            border: none;
            padding: 8px 16px;
            border-radius: 6px;
            cursor: pointer;
            font-weight: 600;
            font-size: 14px;
            transition: background-color 0.2s, transform 0.1s;
            display: inline-flex;
            align-items: center;
            gap: 8px;
            text-decoration: none;
        }

        .btn:hover {
            background-color: var(--accent-hover);
            transform: translateY(-1px);
        }
        
        .btn:active {
            transform: translateY(0);
        }

        .comments-section h3 {
            margin-top: 0;
            border-bottom: 1px solid var(--border);
            padding-bottom: 8px;
        }

        .comment {
            margin-bottom: 16px;
        }
        
        .comment-author {
            font-weight: bold;
            color: #e2e8f0;
            margin-bottom: 4px;
        }
        
        .comment-date {
            color: var(--text-muted);
            font-size: 12px;
        }

        .comment-text {
            color: #cbd5e1;
            font-size: 14px;
            line-height: 1.5;
        }

        #loading {
            text-align: center;
            padding: 40px;
            color: var(--text-muted);
            font-size: 18px;
        }

        .hidden {
            display: none !important;
        }
    </style>
</head>
<body>
    <div class="container">
        <div id="loading">Initializing HispaShare UI...</div>
        
        <div id="content" class="hidden">
            <!-- Header Section -->
            <div class="glass-panel header-section">
                <img id="poster" class="poster" src="" alt="Poster" />
                <div class="info">
                    <h1 id="title">Loading...</h1>
                    <div class="meta-grid">
                        <div class="meta-label">Original:</div><div id="originalTitle"></div>
                        <div class="meta-label">Director:</div><div id="director"></div>
                        <div class="meta-label">Actors:</div><div id="actors"></div>
                        <div class="meta-label">Genres:</div><div id="genres"></div>
                        <div class="meta-label">IMDB:</div><div id="imdbRating"></div>
                        <div class="meta-label">Users:</div><div id="userRating"></div>
                    </div>
                    <div class="synopsis" id="synopsis"></div>
                </div>
            </div>

            <!-- Links Section -->
            <div class="glass-panel">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <h2 style="margin: 0;">Downloads</h2>
                    <button id="copyAllBtn" class="btn">Copy All ED2K Links</button>
                </div>
                <div style="overflow-x: auto;">
                    <table class="links-table">
                        <thead>
                            <tr>
                                <th>File</th>
                                <th>Size</th>
                                <th>DLs</th>
                                <th>Audio</th>
                                <th>Subs</th>
                                <th>Action</th>
                            </tr>
                        </thead>
                        <tbody id="linksBody"></tbody>
                    </table>
                </div>
            </div>

            <!-- Comments Section -->
            <div class="glass-panel comments-section" id="commentsSection">
                <h3>Comments</h3>
                <div id="commentsList"></div>
            </div>
        </div>
    </div>

    <!-- Load standard schema and MCP apps SDK -->
    <script type="module">
        import { App, PostMessageTransport } from 'https://esm.sh/@modelcontextprotocol/ext-apps@1.7.5';

        const loadingEl = document.getElementById('loading');
        const contentEl = document.getElementById('content');
        
        // Setup MCP App Transport
        const transport = new PostMessageTransport(window.parent);
        const app = new App(transport);
        
        let currentLinks = [];

        async function init() {
            await app.connect();
            
            // Listen for data from the host
            // When the tool finishes, the host sends an update to the UI
            app.on("update", (context) => {
                loadingEl.classList.add('hidden');
                contentEl.classList.remove('hidden');
                
                try {
                    // Extract data sent from the tool's return value
                    // The SDK structure usually places it in context.content (or similar)
                    // If it's a JSON string in a text block:
                    let rawData = null;
                    if (context && context.data) {
                        rawData = context.data;
                    } else if (context && context.content) {
                        const textBlock = context.content.find(b => b.type === 'text');
                        if (textBlock && textBlock.text) {
                            try {
                                rawData = JSON.parse(textBlock.text);
                            } catch (e) {
                                // Not JSON
                            }
                        }
                    }

                    if (rawData) {
                        renderData(rawData);
                    } else {
                        loadingEl.textContent = 'Waiting for data...';
                        loadingEl.classList.remove('hidden');
                        contentEl.classList.add('hidden');
                    }
                } catch(e) {
                    console.error("Failed to parse data", e);
                    loadingEl.textContent = 'Error parsing data.';
                    loadingEl.classList.remove('hidden');
                }
            });
        }

        function renderData(data) {
            // Handle array of links OR TitleDetails object
            const isArray = Array.isArray(data);
            const details = isArray ? null : data;
            
            if (details && details.title) {
                // Populate TitleDetails
                document.getElementById('title').textContent = details.title;
                document.getElementById('originalTitle').textContent = details.originalTitle || '-';
                document.getElementById('director').textContent = details.director || '-';
                document.getElementById('actors').textContent = details.actors || '-';
                document.getElementById('genres').textContent = details.genres || '-';
                document.getElementById('imdbRating').textContent = details.imdbRating || '-';
                document.getElementById('userRating').textContent = details.userRating || '-';
                document.getElementById('synopsis').textContent = details.synopsis || '';
                
                if (details.posterUrl) {
                    document.getElementById('poster').src = details.posterUrl;
                } else {
                    document.getElementById('poster').style.display = 'none';
                }

                currentLinks = details.links || [];
                
                // Render Comments
                const commentsList = document.getElementById('commentsList');
                commentsList.innerHTML = '';
                if (details.comments && details.comments.length > 0) {
                    details.comments.slice(0, 5).forEach(c => {
                        const div = document.createElement('div');
                        div.className = 'comment';
                        div.innerHTML = \`
                            <div class="comment-author">\${c.author} <span class="comment-date">\${c.date ? '('+c.date+')' : ''}</span></div>
                            <div class="comment-text">\${c.text}</div>
                        \`;
                        commentsList.appendChild(div);
                    });
                } else {
                    document.getElementById('commentsSection').style.display = 'none';
                }
            } else if (isArray) {
                // Fallback for just links
                currentLinks = data;
                document.querySelector('.header-section').style.display = 'none';
                document.getElementById('commentsSection').style.display = 'none';
            }

            // Render Links Table
            const tbody = document.getElementById('linksBody');
            tbody.innerHTML = '';
            
            if (currentLinks.length === 0) {
                tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;">No links found</td></tr>';
            } else {
                currentLinks.forEach(l => {
                    const tr = document.createElement('tr');
                    const audio = (l.audio || []).join(', ') || '-';
                    const subs = (l.subtitles || []).join(', ') || '-';
                    
                    tr.innerHTML = \`
                        <td style="max-width: 250px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="\${l.title}">\${l.title}</td>
                        <td>\${l.size}</td>
                        <td>\${l.downloads}</td>
                        <td>\${audio}</td>
                        <td>\${subs}</td>
                        <td><a href="\${l.url}" class="btn" style="padding: 4px 8px; font-size: 12px;">Get</a></td>
                    \`;
                    tbody.appendChild(tr);
                });
            }
        }

        // Copy All Handler
        document.getElementById('copyAllBtn').addEventListener('click', () => {
            if (currentLinks.length > 0) {
                const urls = currentLinks.map(l => l.url).join('\\n');
                navigator.clipboard.writeText(urls).then(() => {
                    const btn = document.getElementById('copyAllBtn');
                    const original = btn.textContent;
                    btn.textContent = 'Copied!';
                    setTimeout(() => { btn.textContent = original; }, 2000);
                });
            }
        });

        init().catch(console.error);
    </script>
</body>
</html>`;
