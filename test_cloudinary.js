const { v2: cloudinary } = require('cloudinary');
require('dotenv').config({ path: '.env.local' });

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

async function test() {
  console.log('--- Cloudinary Connection Test ---');
  console.log('Cloud Name:', process.env.CLOUDINARY_CLOUD_NAME);
  
  try {
    // Upload a small 1x1 transparent pixel as a test
    const testImage = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==';
    
    console.log('Attempting test upload...');
    const result = await cloudinary.uploader.upload(testImage, {
      folder: 'kucet/test',
      public_id: 'connection_test'
    });
    
    console.log('✅ Success! Image uploaded to:', result.secure_url);
    console.log('Your Cloudinary connection is working perfectly.');
  } catch (error) {
    console.error('❌ Connection Failed:', error.message);
    if (error.message.includes('Must supply')) {
      console.log('Hint: Check if CLOUDINARY_CLOUD_NAME, API_KEY, and API_SECRET are set in .env.local');
    }
  }
}

test();
