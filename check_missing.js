const fs = require('fs');
const data = JSON.parse(fs.readFileSync('data/publications.json', 'utf8'));

console.log('Entries missing key data:');
console.log('========================\n');

const missingAuthors = data.entries.filter(e => !e.authors || e.authors.trim() === '');
const missingSummary = data.entries.filter(e => !e.summary || e.summary.trim() === '');
const missingBoth = data.entries.filter(e => (!e.authors || e.authors.trim() === '') && (!e.summary || e.summary.trim() === ''));
const withDOI = missingBoth.filter(e => e.doi);

console.log(`Total entries: ${data.entries.length}`);
console.log(`Missing authors: ${missingAuthors.length}`);
console.log(`Missing summary: ${missingSummary.length}`);
console.log(`Missing both: ${missingBoth.length}`);
console.log(`Missing both but has DOI: ${withDOI.length}\n`);

console.log('Examples of entries missing both (with DOI):\n');
withDOI.slice(0, 5).forEach((e, i) => {
  console.log(`${i+1}. ${e.title}`);
  console.log(`   DOI: ${e.doi}`);
  console.log(`   ID: ${e.id}`);
  console.log();
});
