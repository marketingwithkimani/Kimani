
const http = require('http');

const data = JSON.stringify({
  sessionId: 'verify-123',
  message: 'Hello, I want to grow my business'
});

const options = {
  hostname: 'localhost',
  port: 3010,
  path: '/kimani-ai-core/chat',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': data.length
  }
};

console.log('🚀 Sending test chat request to server...');

const req = http.request(options, (res) => {
  let responseData = '';
  console.log(`📡 Status Code: ${res.statusCode}`);

  res.on('data', (chunk) => {
    responseData += chunk;
  });

  res.on('end', () => {
    try {
      const parsed = JSON.parse(responseData);
      console.log('✅ Response from AI:');
      console.log('--------------------');
      console.log(parsed.response);
      console.log('--------------------');
      console.log('📊 Intent Score:', parsed.intent.score);
      console.log('📈 Stage:', parsed.intent.stage);
    } catch (e) {
      console.log('❌ Failed to parse response:', responseData);
    }
  });
});

req.on('error', (error) => {
  console.error('❌ Request error:', error);
});

req.write(data);
req.end();
