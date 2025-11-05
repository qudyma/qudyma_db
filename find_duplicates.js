const fs = require('fs');
const data = JSON.parse(fs.readFileSync('data/publications.json', 'utf8'));

// Group by title to find duplicates
const titleMap = {};
data.entries.forEach(entry => {
  if (!titleMap[entry.title]) {
    titleMap[entry.title] = [];
  }
  titleMap[entry.title].push(entry);
});

// Find titles with duplicates
const duplicates = Object.entries(titleMap).filter(([_, entries]) => entries.length > 1);

console.log(`Found ${duplicates.length} duplicate titles out of ${data.entries.length} total\n`);
duplicates.forEach(([title, entries]) => {
  console.log(`\n=== Title: ${title} ===`);
  entries.forEach((e, i) => {
    console.log(`\n  Entry ${i+1}:`);
    console.log(`    ID: ${e.id}`);
    console.log(`    DOI: ${e.doi || 'N/A'}`);
    console.log(`    Journal Ref: ${e.journal_ref || 'null'}`);
    console.log(`    Has authors: ${!!e.authors}`);
    console.log(`    Has summary: ${!!e.summary}`);
    console.log(`    Has comment: ${!!e.comment}`);
    console.log(`    Has categories: ${e.categories ? e.categories.length : 0}`);
  });
});
