const fs = require('fs');
const path = require('path');

function walkDir(dir, callback) {
  fs.readdirSync(dir).forEach(f => {
    let dirPath = path.join(dir, f);
    let isDirectory = fs.statSync(dirPath).isDirectory();
    isDirectory ? walkDir(dirPath, callback) : callback(path.join(dir, f));
  });
}

let imageFiles = [];
walkDir('./src', (filePath) => {
  if (!filePath.endsWith('.js') && !filePath.endsWith('.jsx')) return;
  let content = fs.readFileSync(filePath, 'utf8');
  let originalContent = content;

  // We find <Image ... /> tags that don't have onError
  // Using simple string replacement since regex can be tricky with newlines.
  
  if (content.includes('<Image') && !content.includes('onError={')) {
    // Just inject it blindly after <Image 
    content = content.replace(/<Image\s/g, '<Image onError={(e) => { e.currentTarget.style.display = \\\'none\\\'; }} ');
  }

  if (content.includes('<img') && !content.includes('onError={')) {
    // Just inject it blindly after <img 
    content = content.replace(/<img\s/g, '<img onError={(e) => { e.currentTarget.style.display = \\\'none\\\'; }} ');
  }

  if (content !== originalContent) {
    fs.writeFileSync(filePath, content.replace(/\\'/g, "'"), 'utf8');
    imageFiles.push(filePath);
  }
});
console.log('Fixed images in: ', imageFiles);
