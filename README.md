# QUDyMa Publications Database

This repository contains a complete system to fetch, merge, and manage publication data from arXiv and ORCID for the QUDyMa research group. It can be integrated into websites as an API or used standalone via CLI.

## Quick Start

### Using the CLI

```bash
# Generate publications database
./cli.js generate

# Show statistics
./cli.js stats

# Or use npm scripts
npm run generate
npm run stats
```

### For Website Integration

See **[INTEGRATION.md](INTEGRATION.md)** for complete integration guide including:
- Express.js example
- Next.js example (Pages Router & App Router)
- React component examples
- Deployment strategies

Quick example:

```javascript
const { getCachedPublications } = require('./qudyma_db/src/index');

// Fast - returns cached data
const publications = getCachedPublications('./qudyma_db/data');
```

## Directory Structure

```
qudyma_db/
├── config/                         # ✏️ Edit these files
│   ├── basics.json                 # Researcher information
│   ├── highlights.json             # Featured publications
│   ├── journal_abbreviations.json  # Journal name mappings
│   ├── journal_normalization_patterns.json
│   └── orcid_oauth.json           # ORCID API credentials
│
├── data/                          # 🤖 Auto-generated
│   ├── arxiv_publications.json
│   ├── orcid_publications.json
│   └── publications.json          # ← Use this in your website
│
├── src/                           # Source code
│   ├── index.js                   # Main API
│   └── PublicationFetcher.js      # Core logic
│
├── examples/                      # Integration examples
│   ├── express-integration.js
│   └── nextjs-integration.js
│
├── cli.js                         # Command-line tool
├── INTEGRATION.md                 # 📘 Website integration guide
└── README.md                      # This file
```

## Overview

The system fetches publications from arXiv and ORCID, merges them, standardizes journal references, normalizes author names, and adds highlights (coverage/awards).

## Editable Configuration Files

### 1. `basics.json` - Researcher Information

This file contains the core information for all researchers in the group.

**Structure:**
```json
{
    "0001": {
        "name": "Full Name",
        "name_variants": ["Name variants for normalization"],
        "arxiv_authorid": "arxiv_author_id",
        "orcid": "0000-0000-0000-0000",
        "date_in": "YYYY-MM-DD",
        "date_out": "YYYY-MM-DD or null"
    }
}
```

**Fields:**
- `name` (required): Canonical full name of the researcher
- `name_variants` (optional): Array of alternative spellings/formats of the name
  - Include variants without accents (e.g., "Picon" for "Picón")
  - Include different hyphenation (e.g., "San Jose" for "San-Jose")
  - Include reversed order (e.g., "Surname, Name")
  - Include initial versions (e.g., "A. Smith")
  - Used to normalize author names across publications
- `arxiv_authorid` (optional): arXiv author identifier (e.g., "smith_j_1")
  - Can be null if researcher has no arXiv public id.
- `orcid` (required): ORCID identifier in format "0000-0000-0000-0000"
  - Can be null if not available
- `date_in` (optional): Date when researcher joined the group (ISO format: YYYY-MM-DD)
  - null if not applicable
- `date_out` (optional): Date when researcher left the group (ISO format: YYYY-MM-DD)
  - null if still active

**Example:**
```json
{
    "0001": {
        "name": "Pablo San-Jose",
        "name_variants": ["Pablo San Jose", "Pablo Sanjose", "San-Jose, Pablo", "San Jose, Pablo", "P. San-Jose"],
        "arxiv_authorid": "sanjose_p_1",
        "orcid": "0000-0002-7920-5273",
        "date_in": "2020-01-01",
        "date_out": null
    }
}
```

**Notes:**
- Entry keys ("0001", "0002", etc.) should be sequential
- Order in the file determines the display order
- All name variants will be normalized to the canonical `name` in publications

---

### 2. `highlights.json` - Featured Publications

This file marks specific publications for special recognition with coverage information and awards.

**Structure:**
```json
{
    "entries": [
        {
            "doi": "10.1234/example.doi",
            "coverage": [
                {
                    "source": "Publication/Website Name",
                    "title": "Article Title",
                    "url": "https://example.com/article"
                }
            ],
            "awards": [
                {
                    "type": "Award Type/Name",
                    "url": "https://example.com/award"
                }
            ]
        }
    ]
}
```

**Fields:**
- `doi`: Digital Object Identifier of the publication
  - Used to match with publications in the database
  - Case-insensitive matching
- `coverage`: Array of media coverage or featured articles
  - `source`: Name of the publication/website
  - `title`: Title of the coverage article
  - `url`: Link to the coverage
- `awards`: Array of awards received
  - `type`: Name/description of the award
  - `url`: Link to award information (optional)

**Example:**
```json
{
    "entries": [
        {
            "doi": "10.1038/s41586-024-07037-4",
            "coverage": [
                {
                    "source": "Nature News",
                    "title": "Breakthrough in quantum physics",
                    "url": "https://www.nature.com/articles/example"
                },
                {
                    "source": "Physics World",
                    "title": "New discovery changes field",
                    "url": "https://physicsworld.com/example"
                }
            ],
            "awards": [
                {
                    "type": "Best Paper Award 2024",
                    "url": "https://example.com/awards"
                }
            ]
        }
    ]
}
```

**Notes:**
- Coverage and awards are added to matching publications in `publications.json`
- DOI matching is case-insensitive
- Both `coverage` and `awards` arrays are optional
- Multiple coverage items and awards can be added per publication

---

### 3. `journal_abbreviations.json` - Journal Name Standardization

This file maps full journal names to their standard ISO/ISSN abbreviations.

**Structure:**
```json
{
    "Full Journal Name": "Standard Abbrev.",
    "Another Journal Name": "Another Abbrev."
}
```

**Fields:**
- Key: Full journal name (case-insensitive matching)
- Value: Standard ISO/ISSN abbreviation

**Example:**
```json
{
    "Physical Review B": "Phys. Rev. B",
    "Physical Review Letters": "Phys. Rev. Lett.",
    "Nature Communications": "Nat. Commun.",
    "Science Advances": "Sci. Adv.",
    "Journal of Physics: Condensed Matter": "J. Phys.: Condens. Matter"
}
```

**Notes:**
- Currently includes 166+ journal abbreviations
- Covers all APS journals, Nature Portfolio, Science family, and major condensed matter physics journals
- Used in first pass of journal name standardization
- Matching is case-insensitive
- Longer/more specific names should be listed before shorter ones to avoid partial matches

**Common Journal Families Included:**
- Physical Review (A, B, C, D, E, X, Applied, Fluids, Materials, Research, etc.)
- Nature (Nature, Communications, Physics, Materials, Nanotechnology, etc.)
- Science (Science, Advances, Robotics, Translational Medicine, etc.)
- Communications (Biology, Chemistry, Earth & Environment, Engineering, Materials, Medicine, Physics, Psychology)
- Applied Physics (Letters, Reviews, Express)
- Quantum journals
- Materials science journals
- Optics journals

---

### 4. `journal_normalization_patterns.json` - Abbreviation Variants

This file normalizes variant abbreviations to standard forms using regex patterns.

**Structure:**
```json
{
    "Regex\\s+Pattern": "Standard Form",
    "Another\\s+Pattern": "Another Standard"
}
```

**Fields:**
- Key: Regular expression pattern to match variant abbreviations
  - Use `\\s+` for flexible whitespace matching
  - Use `\\.` for literal periods
  - Pattern will be matched with word boundaries (`\b`)
- Value: Standard abbreviation form to replace with

**Example:**
```json
{
    "Phys\\.?\\s*Rev\\.?\\s*B": "Phys. Rev. B",
    "Phys\\.?\\s*Rev\\.?\\s*Lett\\.?": "Phys. Rev. Lett.",
    "Nat\\.?\\s*Commun\\.?": "Nat. Commun.",
    "Nature\\s+Comm\\.?": "Nat. Commun.",
    "J\\.?\\s*Phys\\.?\\s*Condens\\.?\\s*Matter": "J. Phys.: Condens. Matter"
}
```

**Notes:**
- Currently includes 145+ normalization patterns
- Used in second pass after full name replacement
- Patterns are applied with case-insensitive matching
- Handles common variations like:
  - Missing or extra periods
  - Different spacing
  - Shortened forms (e.g., "Comm." vs "Commun.")
  - Alternative abbreviations (e.g., "Nature Comm." → "Nat. Commun.")

**Common Pattern Types:**
- Flexible period matching: `\\.?` (period optional)
- Flexible spacing: `\\s+` (one or more spaces) or `\\s*` (zero or more spaces)
- Alternative forms: Use multiple patterns for same journal
- Volume/issue info: Preserve in normalized output

---

## Workflow

### 1. Initial Setup
Add researcher information to `basics.json`:
```bash
# Edit basics.json to add new researchers
```

### 2. Fetch Publications
```bash
# Fetch from arXiv
node fetch_arxiv.js

# Fetch from ORCID (requires orcid_oauth.json with credentials)
node fetch_orcid.js
```

### 3. Merge and Standardize
```bash
# Merge sources, standardize journals, normalize names, add highlights
node merge_publications.js
```

This produces `publications.json` with:
- Deduplicated publications
- Standardized journal abbreviations
- Normalized author names using variants
- arXiv and journal URLs
- Coverage and awards from highlights

### 4. Add Highlights (Optional)
Edit `highlights.json` to add coverage/awards for specific publications, then re-run:
```bash
node merge_publications.js
```

### 5. Maintain Journal Standards (As Needed)
When encountering new journals or inconsistent abbreviations:
1. Add full name mapping to `journal_abbreviations.json`
2. Add variant patterns to `journal_normalization_patterns.json`
3. Re-run merge script

---

## Output Files

### `publications.json`
Unified publication database with structure:
```json
{
    "entries": [
        {
            "id": "http://arxiv.org/abs/1234.5678",
            "published": "2024-01-15",
            "updated": "2024-01-15",
            "title": "Publication Title",
            "summary": "Abstract text...",
            "authors": "Author1, Author2, Author3",
            "categories": ["cond-mat.mes-hall", "quant-ph"],
            "doi": "10.1234/example",
            "journal_ref": "Phys. Rev. B 109, 123456 (2024)",
            "arxiv_url": "https://arxiv.org/abs/1234.5678",
            "journal_url": "https://doi.org/10.1234/example",
            "coverage": [...],
            "awards": [...],
            "formats": {
                "html": "http://arxiv.org/abs/1234.5678",
                "pdf": "http://arxiv.org/pdf/1234.5678"
            }
        }
    ]
}
```

**Key Features:**
- Author names normalized to canonical forms from `basics.json`
- Journal references standardized using abbreviation configs
- URLs automatically generated for arXiv and DOI
- Coverage and awards merged from `highlights.json`
- Duplicates removed (based on DOI and arXiv ID)

---

## Tips and Best Practices

### Name Variants
- Always include common misspellings (especially for names with accents)
- Include both "Firstname Lastname" and "Lastname, Firstname" formats
- Include initial-based versions for all researchers
- Consider middle initials with and without periods

### Journal Abbreviations
- Follow ISO 4 and ISSN abbreviation standards
- Be consistent with period placement
- Include major journals in your field
- Test with actual publication data to find missing journals

### Highlights
- DOI is the most reliable identifier for matching
- Add highlights after initial merge to see coverage in final output
- Multiple coverage items can highlight media reach
- Awards can be institutional or external

### Troubleshooting
- **Missing publications**: Check researcher ORCID and arXiv author IDs
- **Wrong journal abbreviations**: Add to `journal_abbreviations.json` or patterns
- **Name mismatches**: Add variant to `name_variants` array
- **Duplicates**: System deduplicates by DOI and arXiv ID automatically

---

## File Dependencies

```
basics.json ─────────┬───→ fetch_arxiv.js ──→ arxiv_publications.json ─┐
                     │                                                  │
orcid_oauth.json ────┼───→ fetch_orcid.js ──→ orcid_publications.json ─┤
                     │                                                  │
                     └───────────────────────────────────┐              │
                                                         │              │
journal_abbreviations.json ──────────────────┐           │              │
                                              │           │              │
journal_normalization_patterns.json ──────────┼──→ merge_publications.js
                                              │           │              │
highlights.json ──────────────────────────────┘           │              │
                                                           │              │
                                                           └──────────────┘
                                                                   │
                                                                   ↓
                                                          publications.json
```

---

## Maintenance

### Adding a New Researcher
1. Add entry to `basics.json` with sequential ID
2. Include name variants for common misspellings
3. Add arXiv author ID if available
4. Add ORCID if available
5. Run fetch scripts and merge

### Adding a New Journal
1. Find ISO/ISSN standard abbreviation
2. Add to `journal_abbreviations.json`
3. Add common variants to `journal_normalization_patterns.json`
4. Re-run merge script

### Highlighting a Publication
1. Find the publication's DOI in `publications.json`
2. Add entry to `highlights.json` with coverage/awards
3. Re-run merge script

---

## Version Information

- **Node.js**: Scripts use built-in modules (fs, http, https, child_process)
- **External Dependencies**: wget (for arXiv .js file downloads)
- **API Versions**:
  - arXiv API: http://export.arxiv.org/api/query
  - ORCID API: v3.0

---

## Support

For issues or questions about the configuration files, refer to the examples above or check existing entries in each JSON file for reference patterns.
