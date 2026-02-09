/**
 * Webhook Listener for Deployment Triggers
 * 
 * This server listens for deployment webhooks and automatically
 * triggers the test suite when a deployment is completed.
 * 
 * Supports:
 * - Vercel
 * - Netlify
 * - Custom webhooks
 */

const http = require('http');
const { exec } = require('child_process');
const crypto = require('crypto');

const PORT = process.env.PORT || 3000;
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || 'your-secret-key';

// Verify webhook signature (for security)
function verifySignature(payload, signature, secret) {
  const hmac = crypto.createHmac('sha256', secret);
  const digest = 'sha256=' + hmac.update(payload).digest('hex');
  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(digest));
}

// Handle deployment webhook
function handleDeployment(payload) {
  console.log('🚀 Deployment detected!');
  console.log('Payload:', JSON.stringify(payload, null, 2));
  
  // Wait a bit for deployment to stabilize
  setTimeout(() => {
    console.log('▶️  Starting automated tests...');
    
    const testProcess = exec('npm run test:ci', (error, stdout, stderr) => {
      if (error) {
        console.error('❌ Test execution failed:', error);
        return;
      }
      console.log('✅ Tests completed!');
      console.log(stdout);
    });
    
    testProcess.stdout.pipe(process.stdout);
    testProcess.stderr.pipe(process.stderr);
  }, 30000); // Wait 30 seconds
}

// Create HTTP server
const server = http.createServer((req, res) => {
  if (req.method === 'POST' && req.url === '/webhook/deployment') {
    let body = '';
    
    req.on('data', chunk => {
      body += chunk.toString();
    });
    
    req.on('end', () => {
      try {
        // Verify signature if provided
        const signature = req.headers['x-hub-signature-256'] || req.headers['x-webhook-signature'];
        
        if (signature && WEBHOOK_SECRET !== 'your-secret-key') {
          if (!verifySignature(body, signature, WEBHOOK_SECRET)) {
            res.writeHead(401);
            res.end('Unauthorized: Invalid signature');
            return;
          }
        }
        
        const payload = JSON.parse(body);
        
        // Check if deployment is successful
        const isSuccess = 
          payload.state === 'success' || 
          payload.deployment_status === 'success' ||
          payload.status === 'ready' ||
          payload.build_status === 'success';
        
        if (isSuccess) {
          handleDeployment(payload);
          res.writeHead(200);
          res.end('Tests triggered successfully');
        } else {
          res.writeHead(200);
          res.end('Deployment not successful, skipping tests');
        }
        
      } catch (error) {
        console.error('Error processing webhook:', error);
        res.writeHead(400);
        res.end('Bad Request');
      }
    });
  } else if (req.method === 'GET' && req.url === '/health') {
    res.writeHead(200);
    res.end('Webhook listener is running');
  } else {
    res.writeHead(404);
    res.end('Not Found');
  }
});

server.listen(PORT, () => {
  console.log(`🎧 Webhook listener running on port ${PORT}`);
  console.log(`📍 Endpoint: http://localhost:${PORT}/webhook/deployment`);
  console.log(`🏥 Health check: http://localhost:${PORT}/health`);
});

// Handle graceful shutdown
process.on('SIGTERM', () => {
  console.log('Shutting down webhook listener...');
  server.close();
});
