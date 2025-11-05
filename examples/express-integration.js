/**
 * Express.js Integration Example
 * 
 * This example shows how to integrate the QUDyMa publications database
 * into an Express.js application.
 */

const express = require('express');
const path = require('path');
const { generatePublications, getCachedPublications } = require('../src/index');

const app = express();
const PORT = process.env.PORT || 3000;

// Configure paths (adjust based on your project structure)
const CONFIG_PATH = path.join(__dirname, '../config');
const DATA_PATH = path.join(__dirname, '../data');

/**
 * GET /api/publications
 * Returns publications data
 * 
 * Query parameters:
 * - refresh: 'true' to fetch fresh data from arXiv/ORCID (slow)
 * - cached: 'true' to only return cached data (fast, default)
 */
app.get('/api/publications', async (req, res) => {
    try {
        const refresh = req.query.refresh === 'true';
        
        if (refresh) {
            // Generate fresh data (this will take time)
            console.log('Generating fresh publications data...');
            const publications = await generatePublications({
                configPath: CONFIG_PATH,
                dataPath: DATA_PATH,
                fetchArxiv: true,
                fetchOrcid: true,
                returnData: true
            });
            
            res.json({
                success: true,
                cached: false,
                timestamp: new Date().toISOString(),
                count: publications.entries.length,
                data: publications
            });
        } else {
            // Return cached data (fast)
            const publications = getCachedPublications(DATA_PATH);
            
            if (!publications) {
                return res.status(404).json({
                    success: false,
                    error: 'No cached data available. Use ?refresh=true to generate.'
                });
            }
            
            res.json({
                success: true,
                cached: true,
                count: publications.entries.length,
                data: publications
            });
        }
    } catch (error) {
        console.error('Error fetching publications:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * POST /api/publications/refresh
 * Triggers a background refresh of publications data
 */
app.post('/api/publications/refresh', async (req, res) => {
    // Send immediate response
    res.json({
        success: true,
        message: 'Refresh started in background'
    });
    
    // Refresh in background
    try {
        await generatePublications({
            configPath: CONFIG_PATH,
            dataPath: DATA_PATH,
            fetchArxiv: true,
            fetchOrcid: true,
            returnData: false
        });
        console.log('Background refresh completed');
    } catch (error) {
        console.error('Background refresh failed:', error);
    }
});

/**
 * GET /api/publications/stats
 * Returns statistics about the publications database
 */
app.get('/api/publications/stats', (req, res) => {
    try {
        const publications = getCachedPublications(DATA_PATH);
        
        if (!publications) {
            return res.status(404).json({
                success: false,
                error: 'No data available'
            });
        }
        
        // Calculate statistics
        const stats = {
            total: publications.entries.length,
            withDOI: publications.entries.filter(p => p.doi).length,
            withJournalRef: publications.entries.filter(p => p.journal_ref).length,
            withCoverage: publications.entries.filter(p => p.coverage).length,
            withAwards: publications.entries.filter(p => p.awards).length,
            categories: {}
        };
        
        // Count by category
        publications.entries.forEach(pub => {
            if (pub.categories) {
                pub.categories.forEach(cat => {
                    stats.categories[cat] = (stats.categories[cat] || 0) + 1;
                });
            }
        });
        
        res.json({
            success: true,
            stats
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

app.listen(PORT, () => {
    console.log(`QUDyMa Publications API running on port ${PORT}`);
    console.log(`\nEndpoints:`);
    console.log(`  GET  /api/publications          - Get publications (cached)`);
    console.log(`  GET  /api/publications?refresh=true - Refresh and get publications`);
    console.log(`  POST /api/publications/refresh  - Trigger background refresh`);
    console.log(`  GET  /api/publications/stats    - Get database statistics`);
});
