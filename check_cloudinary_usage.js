const { v2: cloudinary } = require('cloudinary');
require('dotenv').config({ path: '.env.local' });

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

async function checkUsage() {
  try {
    const result = await cloudinary.api.usage();
    
    // Cloudinary can return data in different structures. Let's find storage safely.
    const storage = result.storage || {};
    
    const usage = storage.usage || 0;
    const limit = storage.limit || (25 * 1024 * 1024 * 1024); // Default to 25GB if limit is missing
    
    const storageUsedGB = usage / (1024 * 1024 * 1024);
    const storageLimitGB = limit / (1024 * 1024 * 1024);
    const percent = (usage / limit) * 100;

    console.log('--- Cloudinary Storage Status ---');
    console.log(`Used:  ${storageUsedGB.toFixed(3)} GB`);
    console.log(`Limit: ${storageLimitGB.toFixed(1)} GB`);
    console.log(`Usage: ${percent.toFixed(2)}%`);

    if (storageUsedGB > 20) {
      console.log('\n⚠️ WARNING: You have reached the 20GB threshold!');
    } else {
      console.log(`\n✅ Safe: You have ${(storageLimitGB - storageUsedGB).toFixed(3)} GB remaining.`);
    }

  } catch (error) {
    console.error('\n❌ Error:', error.message);
  }
}

checkUsage();
