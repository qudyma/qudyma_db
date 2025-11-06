/**
 * PublicationFetcher - Orchestrates fetching and merging publications
 */

const fs = require('fs');
const path = require('path');
const ArxivFetcher = require('./fetchers/ArxivFetcher');
const OrcidFetcher = require('./fetchers/OrcidFetcher');
const PublicationMerger = require('./merger/PublicationMerger');

class PublicationFetcher {
    constructor(configPath = '../config', dataPath = '../data') {
        // Handle both relative and absolute paths
        if (path.isAbsolute(configPath)) {
            this.configPath = configPath;
        } else {
            this.configPath = path.join(__dirname, configPath);
        }
        
        if (path.isAbsolute(dataPath)) {
            this.dataPath = dataPath;
        } else {
            this.dataPath = path.join(__dirname, dataPath);
        }
        
        // Load configuration files
        this.loadConfig();
        
        // Initialize fetchers
        this.arxivFetcher = new ArxivFetcher();
        this.orcidFetcher = this.orcidOAuth ? new OrcidFetcher(this.orcidOAuth) : null;
    }

    loadConfig() {
        this.basics = this.loadJSON(path.join(this.configPath, 'basics.json'));
        this.journalAbbreviations = this.loadJSON(path.join(this.configPath, 'journal_abbreviations.json'));
        this.normalizationPatterns = this.loadJSON(path.join(this.configPath, 'journal_normalization_patterns.json'));
        
        // Load highlights if exists
        try {
            this.highlights = this.loadJSON(path.join(this.configPath, 'highlights.json'));
        } catch (err) {
            this.highlights = { entries: [] };
        }
        
        // Load ORCID credentials if exists
        try {
            this.orcidOAuth = this.loadJSON(path.join(this.configPath, 'orcid_oauth.json'));
        } catch (err) {
            this.orcidOAuth = null;
        }
    }

    loadJSON(filePath) {
        return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    }

    // ==================== arXiv Fetching ====================

    async fetchArxiv() {
        const publications = {};
        
        for (const [id, researcher] of Object.entries(this.basics)) {
            console.log(`  Processing ${researcher.name} (ID: ${id})...`);
            
            if (!researcher.date_in) {
                console.log(`    Skipping: date_in is null`);
                continue;
            }
            
            if (!researcher.arxiv_authorid && !researcher.orcid) {
                console.log(`    Skipping: no arXiv author ID or ORCID`);
                continue;
            }
            
            publications[id] = {
                name: researcher.name,
                arxiv_authorid: researcher.arxiv_authorid,
                orcid: researcher.orcid,
                date_in: researcher.date_in,
                date_out: researcher.date_out,
                entries: []
            };
            
            const entries = await this.arxivFetcher.fetchForResearcher(researcher);
            publications[id].entries = entries;
            console.log(`    Fetched ${entries.length} publications`);
        }
        
        // Save to data directory
        const outputPath = path.join(this.dataPath, 'arxiv_publications.json');
        fs.writeFileSync(outputPath, JSON.stringify(publications, null, 4));
        console.log(`  Saved to ${outputPath}`);
        
        return publications;
    }

    // ==================== ORCID Fetching ====================

    async fetchOrcid() {
        if (!this.orcidFetcher) {
            console.log('  ORCID OAuth credentials not found, skipping ORCID fetch');
            return {};
        }

        const publications = {};

        for (const [id, researcher] of Object.entries(this.basics)) {
            console.log(`  Processing ${researcher.name} (ID: ${id})...`);
            
            if (!researcher.date_in) {
                console.log(`    Skipping: date_in is null`);
                continue;
            }
            
            if (!researcher.orcid) {
                console.log(`    Skipping: no ORCID`);
                continue;
            }

            publications[id] = {
                name: researcher.name,
                orcid: researcher.orcid,
                date_in: researcher.date_in,
                date_out: researcher.date_out,
                entries: []
            };

            const entries = await this.orcidFetcher.fetchForResearcher(researcher);
            publications[id].entries = entries;
            console.log(`    Fetched ${entries.length} publications`);
        }

        // Save to data directory
        const outputPath = path.join(this.dataPath, 'orcid_publications.json');
        fs.writeFileSync(outputPath, JSON.stringify(publications, null, 4));
        console.log(`  Saved to ${outputPath}`);

        return publications;
    }

    // ==================== Merging and Processing ====================

    async mergePublications() {
        const merger = new PublicationMerger(
            this.dataPath,
            this.basics,
            this.journalAbbreviations,
            this.normalizationPatterns,
            this.highlights
        );
        
        return await merger.mergePublications();
    }
}

module.exports = PublicationFetcher;
