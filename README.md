# QUDYMA Publications Database

Automated system to fetch, merge, and manage research publications from arXiv and ORCID APIs with intelligent deduplication and metadata enrichment.

## Features

- **Multi-source fetching**: Aggregates publications from arXiv and ORCID APIs
- **Smart deduplication**: Normalizes DOIs and merges entries by DOI, arXiv ID, and title similarity
- **Metadata enrichment**: Automatically fills missing data via CrossRef API
- **Date filtering**: Respects researcher join/leave dates with co-authorship support
- **Author normalization**: Handles name variants and identifies QUDYMA authors
- **Modular architecture**: Clean separation of concerns for maintainability
- **Zero duplicates**: Post-enrichment duplicate detection ensures data quality

## Quick Start

```bash
git clone https://github.com/qudyma/qudyma_db.git
cd qudyma_db
npm install
npm run generate
```

## Commands

```bash
npm run generate    # Full pipeline: fetch + merge
npm run stats       # Show database statistics
npm run refresh     # Re-fetch all sources
npm run arxiv       # Fetch arXiv only
npm run orcid       # Fetch ORCID only
npm run merge       # Merge cached data only

# Direct CLI access
node src/index.js all      # Same as npm run generate
node src/index.js arxiv    # Fetch from arXiv
node src/index.js orcid    # Fetch from ORCID
node src/index.js merge    # Merge existing data
```

## Configuration

All configuration files are in the `config/` directory.

### 1. Researchers (`config/members.json`)

```json
{
  "0001": {
    "name": "Researcher Name",
    "name_variants": ["Name Variant 1", "Name Variant 2"],
    "arxiv_authorid": "lastname_f_1",
    "orcid": "0000-0000-0000-0000",
    "date_in": "2020-01-01",
    "date_out": null
  }
}
```

- `name`: Canonical name
- `name_variants`: Alternative spellings for normalization
- `arxiv_authorid`: arXiv author ID or empty string
- `orcid`: ORCID identifier
- `date_in/date_out`: Join/leave dates (ISO format or null)
- `category`: Researcher category (e.g., "Postdoc", "PhD", "Visiting PhD")

**Date Filtering Rules:**
- Non-visiting members with `date_out: null` get ALL publications
- Visiting members are filtered by date range
- Publications after `date_out` are included if co-authored with active members

### 2. ORCID Credentials (`config/orcid_oauth.json`)

```json
{
  "client_id": "APP-XXXXX",
  "client_secret": "xxxxx-xxxx-xxxx",
  "token_url": "https://orcid.org/oauth/token"
}
```

Get credentials at: https://orcid.org/developer-tools

### 3. Featured Publications (`config/highlights.json`)

```json
{
  "entries": [
    {
      "doi": "10.xxxx/xxxxx",
      "coverage": [
        {
          "source": "News Outlet",
          "title": "Article Title",
          "url": "https://..."
        }
      ],
      "awards": [
        {
          "type": "Award Name",
          "url": "https://..."
        }
      ]
    }
  ]
}
```

### 4. Journal Abbreviations (`config/journal_abbreviations.json`)

```json
{
  "Physical Review B": "Phys. Rev. B",
  "Nature Communications": "Nat. Commun."
}
```

### 5. Normalization Patterns (`config/journal_normalization_patterns.json`)

```json
{
  "Phys\\.?\\s*Rev\\.?\\s*B": "Phys. Rev. B",
  "Nat\\.?\\s*Commun\\.?": "Nat. Commun."
}
```

## GitHub Actions Automation

Enable automatic weekly updates:

1. **Add ORCID credentials as secret:**
   - Go to: Repository → Settings → Secrets → Actions
   - Create secret: `ORCID_OAUTH_JSON`
   - Paste contents of `config/orcid_oauth.json`

2. **Enable write permissions:**
   - Go to: Settings → Actions → General
   - Set "Workflow permissions" to "Read and write"

The workflow runs every Sunday at 00:00 UTC.

## Output

The generated database is saved in `data/publications.json`:

```json
{
  "entries": [
    {
      "id": "http://arxiv.org/abs/xxxx.xxxxx",
      "title": "Publication Title",
      "authors": "Author1, Author2",
      "summary": "Abstract...",
      "journal_ref": "Phys. Rev. B 109, 123456 (2024)",
      "doi": "10.xxxx/xxxxx",
      "published": "2024-01-15T12:00:00Z",
      "categories": ["cond-mat.mes-hall"],
      "arxiv_url": "https://arxiv.org/abs/xxxx.xxxxx",
      "journal_url": "https://doi.org/10.xxxx/xxxxx",
      "coverage": [],
      "awards": []
    }
  ]
}
```

## Usage in Code

```javascript
const { getCachedPublications } = require('./src/index');

const publications = getCachedPublications('./data');
console.log(`Total: ${publications.entries.length}`);
```

## How It Works

1. **Fetch** publications from arXiv and ORCID APIs with date filtering
2. **Cache** raw data in `data/arxiv_publications.json` and `data/orcid_publications.json`
3. **Merge** and deduplicate by normalized DOI, arXiv ID, and title similarity
4. **Normalize** DOIs by removing URL prefixes (http/https/doi.org)
5. **Identify** QUDYMA authors using name variants
6. **Standardize** journal references using abbreviation mappings
7. **Enrich** missing metadata via CrossRef API
8. **Re-check** for duplicates after enrichment (some publications gain DOIs)
9. **Output** final database to `data/publications.json`

### Duplicate Detection

The system prevents duplicates through multiple strategies:

- **DOI normalization**: Strips `http://`, `https://`, `doi.org/` prefixes before comparison
- **Title similarity**: Uses normalized titles (lowercase, punctuation-stripped) to catch near-matches
- **arXiv ID matching**: Treats same arXiv ID as same publication
- **Post-enrichment check**: Conference papers that gain DOIs matching journal versions are filtered

This ensures zero duplicates even when different sources provide inconsistent formats.

## Directory Structure

```
qudyma_db/
├── config/                          # Configuration files
│   ├── members.json                 # Researcher metadata
│   ├── orcid_oauth.json            # ORCID API credentials
│   ├── highlights.json             # Featured publications
│   ├── journal_abbreviations.json  # Journal name mappings
│   └── journal_normalization_patterns.json
├── data/                            # Generated data
│   ├── publications.json           # Final merged database
│   ├── arxiv_publications.json     # arXiv cache
│   └── orcid_publications.json     # ORCID cache
├── src/
│   ├── PublicationFetcher.js       # Main orchestrator (157 lines)
│   ├── index.js                    # API entry point + CLI
│   ├── fetchers/                   # Data source fetchers
│   │   ├── ArxivFetcher.js        # arXiv API client (181 lines)
│   │   ├── OrcidFetcher.js        # ORCID API client (151 lines)
│   │   └── CrossRefFetcher.js     # CrossRef enrichment (263 lines)
│   ├── parsers/                    # Data parsers
│   │   ├── CitationParser.js      # BibTeX & RIS parser (154 lines)
│   │   └── XmlParser.js           # XML field extractor (37 lines)
│   ├── utils/                      # Helper utilities
│   │   ├── AuthorUtils.js         # Name normalization (59 lines)
│   │   ├── DateUtils.js           # Date filtering logic (49 lines)
│   │   └── UrlBuilder.js          # URL construction (22 lines)
│   └── merger/                     # Merge & dedupe logic
│       └── PublicationMerger.js   # Main merger (505 lines)
├── .github/workflows/
│   └── update-publications.yml
└── package.json
```

## Architecture

The codebase was refactored from a single 1,258-line monolithic file into 10 modular components:

### Core Modules

- **PublicationFetcher**: Orchestrates the entire pipeline
- **Fetchers**: Handle API communication with rate limiting and error handling
- **Parsers**: Extract structured data from various formats (XML, BibTeX, RIS)
- **Utils**: Provide reusable logic for dates, authors, and URLs
- **Merger**: Implements sophisticated deduplication and enrichment logic

### Key Improvements

1. **Separation of concerns**: Each module has a single responsibility
2. **Testability**: Modules can be tested independently
3. **Maintainability**: Clear interfaces between components
4. **Scalability**: Easy to add new data sources or parsers

## License

This project is licensed under the GNU General Public License v3.0 - see the [LICENSE.md](LICENSE.md) file for details.