# QUDyMa Publications Database

Automated system to fetch, merge, and manage research publications from arXiv and ORCID APIs.

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
```

## Configuration

All configuration files are in the `config/` directory.

### 1. Researchers (`config/basics.json`)

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

1. **Fetch** publications from arXiv and ORCID APIs
2. **Cache** raw data in `data/arxiv_publications.json` and `data/orcid_publications.json`
3. **Merge** and deduplicate by DOI, arXiv ID, and title
4. **Normalize** author names using researcher variants
5. **Standardize** journal references using abbreviation mappings
6. **Enrich** missing metadata via CrossRef API
7. **Output** final database to `data/publications.json`

## Directory Structure

```
qudyma_db/
├── config/
│   ├── basics.json
│   ├── orcid_oauth.json
│   ├── highlights.json
│   ├── journal_abbreviations.json
│   └── journal_normalization_patterns.json
├── data/
│   ├── publications.json
│   ├── arxiv_publications.json
│   └── orcid_publications.json
├── src/
│   ├── PublicationFetcher.js
│   ├── fetch_arxiv.js
│   ├── fetch_orcid.js
│   ├── merge_publications.js
│   └── index.js
├── .github/workflows/
│   └── update-publications.yml
├── cli.js
└── package.json
```

## License

This project is licensed under the GNU General Public License v3.0 - see the [LICENSE.md](LICENSE.md) file for details.