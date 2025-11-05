const fs = require('fs');
const data = JSON.parse(fs.readFileSync('data/publications.json', 'utf8'));

console.log('Sample of CrossRef-enriched entries:\n');

// Find entries that were enriched (have authors and summary)
const enrichedEntries = data.entries.filter(e => 
  e.doi && 
  e.authors && e.authors.trim() && 
  e.summary && e.summary.trim()
);

console.log(`Total enriched entries (with DOI, authors, and summary): ${enrichedEntries.length}\n`);

// Show a few examples
enrichedEntries.slice(0, 3).forEach((e, i) => {
  console.log(`${i+1}. ${e.title}`);
  console.log(`   DOI: ${e.doi}`);
  console.log(`   Journal: ${e.journal_ref || 'N/A'}`);
  console.log(`   Authors (first 100 chars): ${e.authors.substring(0, 100)}...`);
  console.log(`   Summary (first 150 chars): ${e.summary.substring(0, 150)}...`);
  console.log();
});
