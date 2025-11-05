# Website Integration Guide

This guide shows how to integrate the QUDyMa publications database into your website.

## Quick Start

### Option 1: As a Node.js Module

```javascript
const { generatePublications, getCachedPublications } = require('./qudyma_db/src/index');

// Generate fresh data
const publications = await generatePublications({
    configPath: './qudyma_db/config',
    dataPath: './qudyma_db/data',
    fetchArxiv: true,
    fetchOrcid: true,
    returnData: true
});

// Or use cached data (much faster)
const cached = getCachedPublications('./qudyma_db/data');
```

### Option 2: As a CLI Tool

```bash
# Install and run
cd qudyma_db
chmod +x cli.js

# Generate publications
./cli.js generate

# Show stats
./cli.js stats
```

### Option 3: npm Scripts

```bash
npm run generate  # Full refresh
npm run stats     # Show statistics
npm run merge     # Re-merge with config changes
```

## Integration Examples

### Express.js

See `examples/express-integration.js` for a complete Express.js API server example.

```javascript
const express = require('express');
const { getCachedPublications } = require('./qudyma_db/src/index');

app.get('/api/publications', (req, res) => {
    const publications = getCachedPublications('./qudyma_db/data');
    res.json(publications);
});
```

### Next.js

See `examples/nextjs-integration.js` for complete Next.js integration examples (both Pages Router and App Router).

**Pages Router** (`pages/api/publications.js`):
```javascript
import { getCachedPublications } from '@/qudyma_db/src/index';

export default function handler(req, res) {
    const publications = getCachedPublications('./qudyma_db/data');
    res.status(200).json(publications);
}
```

**App Router** (`app/api/publications/route.js`):
```javascript
import { NextResponse } from 'next/server';
import { getCachedPublications } from '@/qudyma_db/src/index';

export async function GET() {
    const publications = getCachedPublications('./qudyma_db/data');
    return NextResponse.json(publications);
}
```

### React Component Example

```jsx
import { useState, useEffect } from 'react';

function PublicationsList() {
    const [publications, setPublications] = useState([]);
    const [loading, setLoading] = useState(true);
    
    useEffect(() => {
        fetch('/api/publications')
            .then(res => res.json())
            .then(data => {
                setPublications(data.entries);
                setLoading(false);
            });
    }, []);
    
    if (loading) return <div>Loading...</div>;
    
    return (
        <div>
            {publications.map((pub, i) => (
                <article key={i}>
                    <h3>{pub.title}</h3>
                    <p className="authors">{pub.authors}</p>
                    {pub.journal_ref && <p className="journal">{pub.journal_ref}</p>}
                    <div className="links">
                        {pub.arxiv_url && (
                            <a href={pub.arxiv_url} target="_blank" rel="noopener">
                                arXiv
                            </a>
                        )}
                        {pub.journal_url && (
                            <a href={pub.journal_url} target="_blank" rel="noopener">
                                Journal
                            </a>
                        )}
                    </div>
                    {pub.coverage && (
                        <div className="coverage">
                            <h4>Media Coverage:</h4>
                            {pub.coverage.map((c, j) => (
                                <a key={j} href={c.url} target="_blank" rel="noopener">
                                    {c.source}: {c.title}
                                </a>
                            ))}
                        </div>
                    )}
                    {pub.awards && (
                        <div className="awards">
                            {pub.awards.map((a, j) => (
                                <span key={j} className="award">{a.type}</span>
                            ))}
                        </div>
                    )}
                </article>
            ))}
        </div>
    );
}
```

## Directory Structure

```
qudyma_db/
├── config/                         # Editable configuration files
│   ├── basics.json                 # Researcher information
│   ├── highlights.json             # Featured publications
│   ├── journal_abbreviations.json  # Journal name mappings
│   ├── journal_normalization_patterns.json
│   └── orcid_oauth.json           # ORCID API credentials
│
├── data/                          # Generated data (auto-created)
│   ├── arxiv_publications.json    # Cached arXiv data
│   ├── orcid_publications.json    # Cached ORCID data
│   └── publications.json          # Final merged database
│
├── src/                           # Source code
│   ├── index.js                   # Main entry point
│   ├── PublicationFetcher.js      # Core logic
│   ├── fetch_arxiv.js             # (legacy, kept for reference)
│   ├── fetch_orcid.js             # (legacy, kept for reference)
│   └── merge_publications.js      # (legacy, kept for reference)
│
├── examples/                      # Integration examples
│   ├── express-integration.js     # Express.js example
│   └── nextjs-integration.js      # Next.js example
│
├── cli.js                         # Command-line interface
├── package.json                   # npm configuration
└── README.md                      # Main documentation
```

## Deployment Strategies

### Strategy 1: Pre-generate on Build (Recommended)

Generate publications during your website's build process:

```json
{
  "scripts": {
    "prebuild": "cd qudyma_db && node cli.js generate",
    "build": "next build"
  }
}
```

**Pros:**
- Fast page loads (data is pre-generated)
- No API calls during runtime
- Works with static site generation

**Cons:**
- Data only updates when you rebuild
- Requires rebuild to add new publications

### Strategy 2: On-Demand Generation

Generate publications when the page is accessed:

```javascript
// In your API route
export default async function handler(req, res) {
    const publications = await generatePublications({
        returnData: true
    });
    res.json(publications);
}
```

**Pros:**
- Always fresh data
- No build step needed

**Cons:**
- Slow first load (fetching from arXiv/ORCID takes time)
- Requires server-side rendering

### Strategy 3: Hybrid (Best of Both)

Use cached data by default, refresh in background:

```javascript
export default async function handler(req, res) {
    // Return cached data immediately
    const cached = getCachedPublications('./qudyma_db/data');
    res.json(cached);
    
    // Refresh in background if old
    if (shouldRefresh(cached)) {
        generatePublications({ returnData: false })
            .catch(err => console.error('Background refresh failed:', err));
    }
}
```

**Pros:**
- Fast page loads
- Periodic updates
- Best user experience

**Cons:**
- More complex logic
- Requires background job management

### Strategy 4: Scheduled Updates (Production)

Use a cron job or scheduled task:

```bash
# Add to crontab (update every night at 2 AM)
0 2 * * * cd /path/to/qudyma_db && ./cli.js generate
```

**Pros:**
- Predictable updates
- No impact on user experience
- Simple to maintain

**Cons:**
- Requires server access
- Data not real-time

## API Reference

### `generatePublications(options)`

Generates the publications database by fetching and merging data.

**Parameters:**
- `options.configPath` (string): Path to config directory (default: `'../config'`)
- `options.dataPath` (string): Path to data directory (default: `'../data'`)
- `options.fetchArxiv` (boolean): Fetch from arXiv (default: `true`)
- `options.fetchOrcid` (boolean): Fetch from ORCID (default: `true`)
- `options.returnData` (boolean): Return data instead of writing file (default: `false`)

**Returns:** `Promise<Object|void>`

**Example:**
```javascript
const pubs = await generatePublications({
    configPath: './config',
    dataPath: './data',
    returnData: true
});
```

### `getCachedPublications(dataPath)`

Loads cached publications from file.

**Parameters:**
- `dataPath` (string): Path to data directory (default: `'../data'`)

**Returns:** `Object|null`

**Example:**
```javascript
const pubs = getCachedPublications('./qudyma_db/data');
if (pubs) {
    console.log(`Found ${pubs.entries.length} publications`);
}
```

### `getPublicationsHandler(req, res)`

Express/Next.js compatible route handler.

**Example:**
```javascript
app.get('/api/publications', getPublicationsHandler);
```

## Environment Variables

You can configure paths using environment variables:

```bash
export QUDYMA_CONFIG_PATH=/path/to/config
export QUDYMA_DATA_PATH=/path/to/data
```

## Performance Considerations

### Caching

- **arXiv/ORCID fetching**: 30-60 seconds per run (depends on number of researchers)
- **Merge only**: < 1 second
- **Cached read**: < 10ms

### Optimization Tips

1. **Use cached data for regular page loads**
   ```javascript
   const pubs = getCachedPublications('./data');
   ```

2. **Refresh only when needed**
   - On schedule (cron)
   - On manual trigger (admin panel)
   - On config file changes

3. **Cache in memory** (for high-traffic sites)
   ```javascript
   let cachedPubs = null;
   function getPublications() {
       if (!cachedPubs) {
           cachedPubs = getCachedPublications('./data');
       }
       return cachedPubs;
   }
   ```

4. **Enable compression** for API responses
   ```javascript
   app.use(compression());
   ```

## Troubleshooting

### "No cached data available"
Run `./cli.js generate` to create initial data.

### "ORCID OAuth credentials not found"
Add `orcid_oauth.json` to `config/` directory with your credentials.

### Slow generation
- Use `arxiv-only` if ORCID is slow
- Use `merge-only` to test config changes without refetching

### Data not updating
- Check file permissions on `data/` directory
- Verify config files are in `config/` directory
- Check console logs for error messages

## Security Notes

1. **Keep `orcid_oauth.json` secure** - don't commit to public repos
2. **Rate limiting** - arXiv and ORCID have rate limits, avoid frequent requests
3. **Input validation** - validate any user input before using in queries
4. **CORS** - Configure CORS properly if exposing API publicly

## Next Steps

1. Choose your integration strategy
2. Copy the appropriate example from `examples/`
3. Adjust paths to match your project structure
4. Test with cached data first
5. Set up scheduled updates for production

For more details, see the main [README.md](../README.md).
