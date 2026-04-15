
const https = require('https');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const API_KEY = process.env.ANTHROPIC_API_KEY || process.env.OPENROUTER_API_KEY || '';

if (!API_KEY) {
  console.error('❌ No API key found in .env');
  process.exit(1);
}

console.log('🔑 Key prefix:', API_KEY.substring(0, 20) + '...');

function httpsGet(url, headers) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(data) }); }
        catch(e) { resolve({ status: res.statusCode, body: data }); }
      });
    });
    req.on('error', reject);
  });
}

function httpsPost(hostname, path, headers, body) {
  return new Promise((resolve, reject) => {
    const bodyStr = JSON.stringify(body);
    const options = {
      hostname, path, method: 'POST',
      headers: { ...headers, 'Content-Length': Buffer.byteLength(bodyStr) }
    };
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(data) }); }
        catch(e) { resolve({ status: res.statusCode, body: data }); }
      });
    });
    req.on('error', reject);
    req.write(bodyStr);
    req.end();
  });
}

async function main() {
  // 1. List available Claude models
  console.log('\n📋 Fetching available Claude models from OpenRouter...');
  const modelsRes = await httpsGet('https://openrouter.ai/api/v1/models', {
    'Authorization': `Bearer ${API_KEY}`
  });

  if (modelsRes.status === 200 && modelsRes.body.data) {
    const claudeModels = modelsRes.body.data
      .filter(m => m.id.toLowerCase().includes('claude'))
      .map(m => m.id);
    console.log('✅ Available Claude models:');
    claudeModels.forEach(id => console.log('  -', id));

    // 2. Test with first available Claude model
    if (claudeModels.length > 0) {
      const testModel = claudeModels[0];
      console.log(`\n🤖 Testing live chat with model: ${testModel}`);

      const chatRes = await httpsPost('openrouter.ai', '/api/v1/chat/completions', {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`,
        'HTTP-Referer': 'https://marketingwithkimani.co.ke',
        'X-Title': 'Marketing with Kimani'
      }, {
        model: testModel,
        max_tokens: 200,
        messages: [
          { role: 'system', content: 'You are a helpful assistant.' },
          { role: 'user', content: 'Say hello in one sentence.' }
        ]
      });

      console.log('  Response status:', chatRes.status);
      if (chatRes.body.choices) {
        console.log('  ✅ AI RESPONSE:', chatRes.body.choices[0].message.content);
        console.log('\n  ✅ CORRECT MODEL ID TO USE:', testModel);
      } else {
        console.log('  ❌ Error:', JSON.stringify(chatRes.body.error || chatRes.body, null, 2));
      }
    }
  } else {
    console.log('❌ Could not fetch models. Status:', modelsRes.status);
    console.log('Error:', JSON.stringify(modelsRes.body, null, 2));
  }

  // 3. Also check account credits
  console.log('\n💳 Checking account credits...');
  const creditsRes = await httpsGet('https://openrouter.ai/api/v1/auth/key', {
    'Authorization': `Bearer ${API_KEY}`
  });
  if (creditsRes.status === 200) {
    const info = creditsRes.body.data || creditsRes.body;
    console.log('  Credits remaining:', info.limit_remaining ?? info.usage ?? 'N/A');
    console.log('  Usage:', info.usage ?? 'N/A');
    console.log('  Is free tier:', info.is_free_tier ?? 'N/A');
  } else {
    console.log('  Status:', creditsRes.status, JSON.stringify(creditsRes.body));
  }
}

main().catch(console.error);
