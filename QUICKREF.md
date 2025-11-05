# QUDyMa Publications - Quick Reference

## For Website Developers

### Get Publications (Fast - Recommended)
```javascript
const { getCachedPublications } = require('./qudyma_db/src/index');
const publications = getCachedPublications('./qudyma_db/data');
// Returns: { entries: [...] } in < 10ms
```

### Refresh Publications (Slow)
```javascript
const { generatePublications } = require('./qudyma_db/src/index');
const publications = await generatePublications({ returnData: true });
// Takes: 30-60 seconds
```

### Example API Route (Express)
```javascript
app.get('/api/publications', (req, res) => {
    const pubs = getCachedPublications('./qudyma_db/data');
    res.json(pubs);
});
```

### Example API Route (Next.js)
```javascript
export default function handler(req, res) {
    const pubs = getCachedPublications('./qudyma_db/data');
    res.status(200).json(pubs);
}
```

## For Content Managers

### Update Publications
```bash
cd qudyma_db
node cli.js generate
```

### View Statistics
```bash
node cli.js stats
```

### Add New Researcher
1. Edit `config/basics.json`
2. Add entry with name, orcid, arxiv_authorid
3. Run `node cli.js generate`

### Highlight Publication
1. Edit `config/highlights.json`
2. Add DOI with coverage/awards
3. Run `node cli.js merge-only`

### Add New Journal
1. Edit `config/journal_abbreviations.json`
2. Add full name → abbreviation
3. Run `node cli.js merge-only`

## File Locations

- **Config**: `config/` (edit these)
- **Data**: `data/` (generated automatically)
- **Use in website**: `data/publications.json`

## Publication Object Structure

```javascript
{
    entries: [
        {
            id: "http://arxiv.org/abs/1234.5678",
            title: "Publication Title",
            authors: "Author1, Author2",
            published: "2024-01-15",
            journal_ref: "Phys. Rev. B 109, 123456 (2024)",
            doi: "10.1103/PhysRevB.109.123456",
            arxiv_url: "https://arxiv.org/abs/1234.5678",
            journal_url: "https://doi.org/10.1103/...",
            categories: ["cond-mat.mes-hall"],
            summary: "Abstract text...",
            coverage: [...],  // if highlighted
            awards: [...]     // if highlighted
        }
    ]
}
```

## Common Tasks

| Task | Command |
|------|---------|
| Generate fresh data | `node cli.js generate` |
| Show stats | `node cli.js stats` |
| Re-merge after config edit | `node cli.js merge-only` |
| Fetch only from arXiv | `node cli.js arxiv-only` |
| Fetch only from ORCID | `node cli.js orcid-only` |

## Documentation

- **README.md**: Configuration file formats
- **INTEGRATION.md**: Website integration guide
- **examples/**: Integration code samples

## Quick Start

```bash
# 1. Generate publications
cd qudyma_db
node cli.js generate

# 2. In your website code
const { getCachedPublications } = require('./qudyma_db/src/index');
const pubs = getCachedPublications('./qudyma_db/data');

# 3. Use pubs.entries in your UI
```

## Support

See `INTEGRATION.md` for complete integration guide with examples.
