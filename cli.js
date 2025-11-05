#!/usr/bin/env node

/**
 * QUDyMa Publications Database CLI
 * 
 * Command-line interface for generating publications database
 */

const { generatePublications, getCachedPublications } = require('./src/index');
const path = require('path');

const args = process.argv.slice(2);
const command = args[0];

const CONFIG_PATH = path.join(__dirname, 'config');
const DATA_PATH = path.join(__dirname, 'data');

async function main() {
    switch (command) {
        case 'generate':
        case 'refresh':
            console.log('Generating publications database...\n');
            await generatePublications({
                configPath: CONFIG_PATH,
                dataPath: DATA_PATH,
                fetchArxiv: true,
                fetchOrcid: true,
                returnData: false
            });
            break;
            
        case 'arxiv-only':
            console.log('Fetching only from arXiv...\n');
            await generatePublications({
                configPath: CONFIG_PATH,
                dataPath: DATA_PATH,
                fetchArxiv: true,
                fetchOrcid: false,
                returnData: false
            });
            break;
            
        case 'orcid-only':
            console.log('Fetching only from ORCID...\n');
            await generatePublications({
                configPath: CONFIG_PATH,
                dataPath: DATA_PATH,
                fetchArxiv: false,
                fetchOrcid: true,
                returnData: false
            });
            break;
            
        case 'merge-only':
            console.log('Merging cached data only...\n');
            await generatePublications({
                configPath: CONFIG_PATH,
                dataPath: DATA_PATH,
                fetchArxiv: false,
                fetchOrcid: false,
                returnData: false
            });
            break;
            
        case 'show':
        case 'stats':
            const pubs = getCachedPublications(DATA_PATH);
            if (!pubs) {
                console.error('No cached data found. Run "generate" first.');
                process.exit(1);
            }
            
            console.log('\n=== Publications Database Statistics ===\n');
            console.log(`Total publications: ${pubs.entries.length}`);
            console.log(`Publications with DOI: ${pubs.entries.filter(p => p.doi).length}`);
            console.log(`Publications with journal ref: ${pubs.entries.filter(p => p.journal_ref).length}`);
            console.log(`Publications with coverage: ${pubs.entries.filter(p => p.coverage).length}`);
            console.log(`Publications with awards: ${pubs.entries.filter(p => p.awards).length}`);
            
            // Categories breakdown
            const categories = {};
            pubs.entries.forEach(pub => {
                if (pub.categories) {
                    pub.categories.forEach(cat => {
                        categories[cat] = (categories[cat] || 0) + 1;
                    });
                }
            });
            
            console.log('\nTop categories:');
            Object.entries(categories)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 10)
                .forEach(([cat, count]) => {
                    console.log(`  ${cat}: ${count}`);
                });
            
            console.log();
            break;
            
        case 'help':
        case '--help':
        case '-h':
        default:
            console.log(`
QUDyMa Publications Database CLI

Usage:
  qudyma <command>

Commands:
  generate       Fetch from arXiv and ORCID, then merge (default)
  refresh        Alias for generate
  
  arxiv-only     Fetch only from arXiv, then merge
  orcid-only     Fetch only from ORCID, then merge
  merge-only     Merge cached data without fetching
  
  show           Show statistics about cached data
  stats          Alias for show
  
  help           Show this help message

Examples:
  qudyma generate          # Full refresh
  qudyma arxiv-only        # Only update arXiv data
  qudyma merge-only        # Re-merge with new config changes
  qudyma show              # Show current stats

File Locations:
  Config:  ${CONFIG_PATH}
  Data:    ${DATA_PATH}
`);
            break;
    }
}

main().catch(error => {
    console.error('Error:', error.message);
    process.exit(1);
});
