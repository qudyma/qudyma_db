const fs = require('fs');
const data = JSON.parse(fs.readFileSync('data/publications.json', 'utf8'));

console.log('Sample of merged entries:\n');

// Entry with DOI and journal_ref
const withJournal = data.entries.filter(e => e.doi && e.journal_ref && e.authors)[0];
console.log('1. ArXiv with Journal Ref:');
console.log(`   Title: ${withJournal.title}`);
console.log(`   DOI: ${withJournal.doi}`);
console.log(`   Journal: ${withJournal.journal_ref}`);
console.log(`   Has authors: ${!!withJournal.authors}`);
console.log(`   Has summary: ${!!withJournal.summary}`);
console.log(`   Has arxiv_url: ${!!withJournal.arxiv_url}`);
console.log();

// Entry without DOI (ORCID only)
const orcidOnly = data.entries.filter(e => !e.doi && !e.authors)[0];
if (orcidOnly) {
  console.log('2. ORCID-only Entry:');
  console.log(`   Title: ${orcidOnly.title}`);
  console.log(`   DOI: ${orcidOnly.doi}`);
  console.log(`   Journal: ${orcidOnly.journal_ref}`);
  console.log(`   Has authors: ${!!orcidOnly.authors}`);
} else {
  console.log('2. No ORCID-only entries found (all have authors)');
}

console.log(`\nTotal entries: ${data.entries.length}`);
console.log(`Entries with authors: ${data.entries.filter(e => e.authors).length}`);
console.log(`Entries with journal_ref: ${data.entries.filter(e => e.journal_ref).length}`);
console.log(`Entries with DOI: ${data.entries.filter(e => e.doi).length}`);
console.log(`Coverage: ${((data.entries.filter(e => e.journal_ref).length / data.entries.length) * 100).toFixed(1)}%`);
