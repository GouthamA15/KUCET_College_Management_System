const fs = require('fs');
const path = require('path');

function walkDir(dir, callback) {
  fs.readdirSync(dir).forEach(f => {
    let dirPath = path.join(dir, f);
    let isDirectory = fs.statSync(dirPath).isDirectory();
    isDirectory ? walkDir(dirPath, callback) : callback(path.join(dir, f));
  });
}

let changedFiles = 0;
walkDir('./src', (filePath) => {
  if (!filePath.endsWith('.js') && !filePath.endsWith('.jsx')) return;
  let content = fs.readFileSync(filePath, 'utf8');
  let originalContent = content;
  
  // Replace absolute padding
  content = content.replace(/(?<=[\s\"\'\`])(p-8)(?=[\s\"\'\`])/g, 'p-4 sm:p-8');
  content = content.replace(/(?<=[\s\"\'\`])(p-10)(?=[\s\"\'\`])/g, 'p-4 sm:p-10');
  content = content.replace(/(?<=[\s\"\'\`])(px-8)(?=[\s\"\'\`])/g, 'px-4 sm:px-8');
  content = content.replace(/(?<=[\s\"\'\`])(px-10)(?=[\s\"\'\`])/g, 'px-4 sm:px-10');
  
  // Replace absolute w-screen
  content = content.replace(/(?<=[\s\"\'\`])(w-screen)(?=[\s\"\'\`])/g, 'w-full');
  
  // Replace min-w-screen
  content = content.replace(/(?<=[\s\"\'\`])(min-w-screen)(?=[\s\"\'\`])/g, 'w-full');

  if (content !== originalContent) {
    fs.writeFileSync(filePath, content, 'utf8');
    changedFiles++;
    console.log('Fixed padding/width in:', filePath);
  }
});
console.log('Total files fixed:', changedFiles);
