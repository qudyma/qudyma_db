/**
 * QUDYMA Publications Database - Main Entry Point
 * 
 * This module provides a simple API for generating the publications database.
 * Can be called directly from a website backend to generate fresh publication data.
 */

const PublicationFetcher = require('./PublicationFetcher');

/**
 * Main function to generate publications database
 * @param {Object} options - Configuration options
 * @param {string} options.configPath - Path to config directory (default: '../config')
 * @param {string} options.dataPath - Path to data directory (default: '../data')
 * @param {boolean} options.fetchArxiv - Whether to fetch from arXiv (default: true)
 * @param {boolean} options.fetchOrcid - Whether to fetch from ORCID (default: true)
 * @param {boolean} options.returnData - Return data instead of writing to file (default: false)
 * @returns {Promise<Object|void>} Publications object if returnData=true, otherwise void
 */
async function generatePublications(options = {}) {
    const {
        configPath = '../config',
        dataPath = '../data',
        fetchArxiv = true,
        fetchOrcid = true,
        returnData = false
    } = options;

    const fetcher = new PublicationFetcher(configPath, dataPath);

    try {
        console.log('=== QUDYMA Publications Database Generation ===\n');

        // Step 1: Fetch from arXiv if enabled
        if (fetchArxiv) {
            console.log('Step 1: Fetching from arXiv...');
            await fetcher.fetchArxiv();
        } else {
            console.log('Step 1: Skipping arXiv fetch (using cached data)');
        }

        // Step 2: Fetch from ORCID if enabled
        if (fetchOrcid) {
            console.log('\nStep 2: Fetching from ORCID...');
            await fetcher.fetchOrcid();
        } else {
            console.log('\nStep 2: Skipping ORCID fetch (using cached data)');
        }

        // Step 3: Merge and generate final database
        console.log('\nStep 3: Merging and standardizing...');
        const publications = await fetcher.mergePublications();

        if (returnData) {
            return publications;
        }

        console.log('\n=== Generation Complete ===');
        console.log(`Total publications: ${publications.entries.length}`);
        
    } catch (error) {
        console.error('Error generating publications:', error);
        throw error;
    }
}

/**
 * Express/Next.js compatible route handler
 * Usage: app.get('/api/publications', getPublicationsHandler);
 */
async function getPublicationsHandler(req, res) {
    try {
        const options = {
            configPath: process.env.QUDYMA_CONFIG_PATH || '../config',
            dataPath: process.env.QUDYMA_DATA_PATH || '../data',
            fetchArxiv: req.query.refresh === 'true',
            fetchOrcid: req.query.refresh === 'true',
            returnData: true
        };

        const publications = await generatePublications(options);
        
        res.json(publications);
    } catch (error) {
        console.error('Error in publications handler:', error);
        res.status(500).json({ error: 'Failed to generate publications' });
    }
}

/**
 * Get cached publications without fetching new data
 */
function getCachedPublications(dataPath = '../data') {
    const fs = require('fs');
    const path = require('path');
    
    // Handle both relative and absolute paths
    let publicationsPath;
    if (path.isAbsolute(dataPath)) {
        publicationsPath = path.join(dataPath, 'publications.json');
    } else {
        publicationsPath = path.join(__dirname, dataPath, 'publications.json');
    }
    
    if (!fs.existsSync(publicationsPath)) {
        return null;
    }
    
    return JSON.parse(fs.readFileSync(publicationsPath, 'utf8'));
}

module.exports = {
    generatePublications,
    getPublicationsHandler,
    getCachedPublications
};
