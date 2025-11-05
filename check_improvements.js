const fs = require('fs');
const data = JSON.parse(fs.readFileSync('data/publications.json', 'utf8'));

console.log('Entries still missing metadata:\n');

// Find entries missing authors
const missingAuthors = data.entries.filter(e => !e.authors || e.authors.trim() === '');
console.log(`Missing authors (${missingAuthors.length}):`);
missingAuthors.slice(0, 5).forEach((e, i) => {
  console.log(`  ${i+1}. ${e.title.substring(0, 60)}...`);
  console.log(`     DOI: ${e.doi ? 'Yes' : 'No'}`);
  console.log(`     Has summary: ${e.summary && e.summary.trim() ? 'Yes' : 'No'}`);
});

console.log(`\n\nMissing summary (${data.entries.filter(e => !e.summary || e.summary.trim() === '').length}):`);
const missingSummary = data.entries.filter(e => !e.summary || e.summary.trim() === '');
missingSummary.slice(0, 5).forEach((e, i) => {
  console.log(`  ${i+1}. ${e.title.substring(0, 60)}...`);
  console.log(`     DOI: ${e.doi ? 'Yes' : 'No'}`);
  console.log(`     Has authors: ${e.authors && e.authors.trim() ? 'Yes' : 'No'}`);
});

console.log(`\n\nStatistics:`);
console.log(`Total: ${data.entries.length}`);
console.log(`With authors: ${data.entries.filter(e => e.authors && e.authors.trim()).length}`);
console.log(`With summary: ${data.entries.filter(e => e.summary && e.summary.trim()).length}`);
console.log(`With both: ${data.entries.filter(e => (e.authors && e.authors.trim()) && (e.summary && e.summary.trim())).length}`);
console.log(`With DOI: ${data.entries.filter(e => e.doi).length}`);
