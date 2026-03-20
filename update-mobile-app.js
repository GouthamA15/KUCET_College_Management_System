const fs = require('fs');
const { execSync } = require('child_process');

// --- CONFIGURATION ---
const NEW_URL = process.argv[2];
const NEW_APP_NAME = process.argv[3] || 'KUCET CMS'; 
// ---------------------

if (!NEW_URL) {
  console.log('Usage: node update-mobile-app.js <URL> ["App Name"]');
  console.log('Example: node update-mobile-app.js https://my-new-site.com "My College App"');
  process.exit(1);
}

console.log(`\n🚀 Updating App to: ${NEW_APP_NAME}`);
console.log(`🔗 Pointing to: ${NEW_URL}\n`);

try {
  // 1. Update capacitor.config.ts
  let configPath = './capacitor.config.ts';
  let configContent = fs.readFileSync(configPath, 'utf8');
  
  configContent = configContent.replace(/url: '.*'/, `url: '${NEW_URL}'`);
  configContent = configContent.replace(/appName: '.*'/, `appName: '${NEW_APP_NAME}'`);
  
  fs.writeFileSync(configPath, configContent);
  console.log('✅ Updated capacitor.config.ts');

  // 2. Update Android strings.xml (The label under the icon)
  let stringsPath = './android/app/src/main/res/values/strings.xml';
  if (fs.existsSync(stringsPath)) {
    let stringsContent = fs.readFileSync(stringsPath, 'utf8');
    stringsContent = stringsContent.replace(/<string name="app_name">.*<\/string>/, `<string name="app_name">${NEW_APP_NAME}</string>`);
    stringsContent = stringsContent.replace(/<string name="title_activity_main">.*<\/string>/, `<string name="title_activity_main">${NEW_APP_NAME}</string>`);
    fs.writeFileSync(stringsPath, stringsContent);
    console.log('✅ Updated Android app label');
  }

  // 3. Run Capacitor Sync
  console.log('⏳ Syncing Capacitor changes...');
  execSync('npx cap sync', { stdio: 'inherit' });
  
  console.log('\n✨ ALL DONE! Now just click "Play" in Android Studio to update your phone.');

} catch (error) {
  console.error('❌ Error updating app:', error.message);
}
