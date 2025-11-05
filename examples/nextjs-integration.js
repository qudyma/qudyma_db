/**
 * Next.js API Route Integration Example
 * 
 * Place this file in: pages/api/publications.js
 * or for App Router: app/api/publications/route.js
 */

// For Pages Router (pages/api/publications.js):
import { generatePublications, getCachedPublications } from '@/qudyma_db/src/index';
import path from 'path';

const CONFIG_PATH = path.join(process.cwd(), 'qudyma_db', 'config');
const DATA_PATH = path.join(process.cwd(), 'qudyma_db', 'data');

export default async function handler(req, res) {
    if (req.method === 'GET') {
        try {
            const refresh = req.query.refresh === 'true';
            
            if (refresh) {
                // Generate fresh data
                const publications = await generatePublications({
                    configPath: CONFIG_PATH,
                    dataPath: DATA_PATH,
                    fetchArxiv: true,
                    fetchOrcid: true,
                    returnData: true
                });
                
                res.status(200).json({
                    success: true,
                    cached: false,
                    timestamp: new Date().toISOString(),
                    count: publications.entries.length,
                    data: publications
                });
            } else {
                // Return cached data
                const publications = getCachedPublications(DATA_PATH);
                
                if (!publications) {
                    return res.status(404).json({
                        success: false,
                        error: 'No cached data available'
                    });
                }
                
                res.status(200).json({
                    success: true,
                    cached: true,
                    count: publications.entries.length,
                    data: publications
                });
            }
        } catch (error) {
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    } else {
        res.status(405).json({ error: 'Method not allowed' });
    }
}

// For App Router (app/api/publications/route.js):
/*
import { NextResponse } from 'next/server';
import { generatePublications, getCachedPublications } from '@/qudyma_db/src/index';
import path from 'path';

const CONFIG_PATH = path.join(process.cwd(), 'qudyma_db', 'config');
const DATA_PATH = path.join(process.cwd(), 'qudyma_db', 'data');

export async function GET(request) {
    try {
        const { searchParams } = new URL(request.url);
        const refresh = searchParams.get('refresh') === 'true';
        
        if (refresh) {
            const publications = await generatePublications({
                configPath: CONFIG_PATH,
                dataPath: DATA_PATH,
                fetchArxiv: true,
                fetchOrcid: true,
                returnData: true
            });
            
            return NextResponse.json({
                success: true,
                cached: false,
                timestamp: new Date().toISOString(),
                count: publications.entries.length,
                data: publications
            });
        } else {
            const publications = getCachedPublications(DATA_PATH);
            
            if (!publications) {
                return NextResponse.json({
                    success: false,
                    error: 'No cached data available'
                }, { status: 404 });
            }
            
            return NextResponse.json({
                success: true,
                cached: true,
                count: publications.entries.length,
                data: publications
            });
        }
    } catch (error) {
        return NextResponse.json({
            success: false,
            error: error.message
        }, { status: 500 });
    }
}
*/

// Client-side usage example (React component):
/*
import { useState, useEffect } from 'react';

export default function PublicationsList() {
    const [publications, setPublications] = useState([]);
    const [loading, setLoading] = useState(true);
    
    useEffect(() => {
        fetch('/api/publications')
            .then(res => res.json())
            .then(data => {
                if (data.success) {
                    setPublications(data.data.entries);
                }
                setLoading(false);
            });
    }, []);
    
    if (loading) return <div>Loading publications...</div>;
    
    return (
        <div>
            <h1>Publications ({publications.length})</h1>
            {publications.map((pub, i) => (
                <div key={i}>
                    <h3>{pub.title}</h3>
                    <p>{pub.authors}</p>
                    {pub.journal_ref && <p>{pub.journal_ref}</p>}
                    {pub.arxiv_url && <a href={pub.arxiv_url}>arXiv</a>}
                    {pub.journal_url && <a href={pub.journal_url}>Journal</a>}
                </div>
            ))}
        </div>
    );
}
*/
