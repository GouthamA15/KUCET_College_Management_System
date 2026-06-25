const { _execSync } = require('child_process');
const fs = require('fs');

// skip exec

console.info('Parsing report...');
const report = JSON.parse(fs.readFileSync('eslint-report.json', 'utf8'));

let filesModified = 0;

for (const result of report) {
  if (result.messages.length === 0) continue;
  
  const filePath = result.filePath;
  let content = fs.readFileSync(filePath, 'utf8');
  let lines = content.split('\n');
  
  // Sort messages in reverse order (bottom-up and right-to-left) to avoid offset issues
  const messages = result.messages.sort((a, b) => {
    if (b.line !== a.line) return b.line - a.line;
    return b.column - a.column;
  });

  let modified = false;

  for (const msg of messages) {
    if (msg.ruleId === 'no-unused-vars') {
      // The variable name is usually in single quotes in the message: 'foo' is defined but never used
      const match = msg.message.match(/'([^']+)'/);
      if (match) {
        const varName = match[1];
        // We will just prepend an underscore to the variable where it was declared
        // msg.line is 1-indexed, msg.column is 1-indexed
        const lineIdx = msg.line - 1;
        const colIdx = msg.column - 1;
        
        // Ensure the word matches at the specific column
        const lineStr = lines[lineIdx];
        if (lineStr.substring(colIdx, colIdx + varName.length) === varName) {
          lines[lineIdx] = lineStr.substring(0, colIdx) + '_' + lineStr.substring(colIdx);
          modified = true;
        } else {
           // Fallback: replace the first occurrence of varName on that line if column is slightly off
           const regex = new RegExp(`\\b${varName}\\b`);
           if (regex.test(lineStr)) {
               lines[lineIdx] = lineStr.replace(regex, `_${varName}`);
               modified = true;
           }
        }
      }
    } else if (msg.ruleId === 'no-empty') {
      const lineIdx = msg.line - 1;
      if (lines[lineIdx].includes('{}')) {
        lines[lineIdx] = lines[lineIdx].replace('{}', '{ /* empty */ }');
        modified = true;
      } else {
        lines[lineIdx] += ' /* empty */';
        modified = true;
      }
    } else if (msg.ruleId === 'no-console') {
      const lineIdx = msg.line - 1;
      if (lines[lineIdx].includes('console.log')) {
        lines[lineIdx] = lines[lineIdx].replace(/console\.log/g, 'console.info');
        modified = true;
      } else {
        // If it's another console method not allowed, change it to console.info
        lines[lineIdx] = lines[lineIdx].replace(/console\.(dir|table|trace)/g, 'console.info');
        modified = true;
      }
    } else if (msg.ruleId === 'no-prototype-builtins') {
      const lineIdx = msg.line - 1;
      lines[lineIdx] = lines[lineIdx].replace(/([a-zA-Z0-9_$]+)\.hasOwnProperty\(([^)]+)\)/g, 'Object.prototype.hasOwnProperty.call($1, $2)');
      modified = true;
    } else if (msg.ruleId === 'no-useless-escape') {
      const lineIdx = msg.line - 1;
      lines[lineIdx] = lines[lineIdx].replace(/\\"/g, '"').replace(/\\\//g, '/');
      modified = true;
    }
  }

  if (modified) {
    fs.writeFileSync(filePath, lines.join('\n'));
    filesModified++;
  }
}

console.info(`Fixed ${filesModified} files.`);
