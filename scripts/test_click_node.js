// Simulate click node on canvas
import fs from 'fs';

const midasSrc = fs.readFileSync('src/engine/midas.js', 'utf8');

// Let's check for any unsafe property accesses on doc.world() in midas.js
const lines = midasSrc.split('\n');
console.log("Checking doc.world() usage in midas.js:");
lines.forEach((line, idx) => {
    if (line.includes('doc.world(')) {
        console.log(`Line ${idx + 1}: ${line.trim()}`);
    }
});
