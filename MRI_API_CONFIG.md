# MRI Analysis API Configuration Guide

## Overview
The Pulse AI application needs to know where to send MRI analysis requests. In development, it uses `localhost:5000`, but in production, you must configure it to point to your production API server.

## Environment Variables

### Development (`.env`)
```
VITE_MRI_ANALYSIS_API_URL="http://127.0.0.1:5000"
```

### Production (`.env.production`)
Update this to match where your Flask MRI analysis service is deployed:

```
VITE_MRI_ANALYSIS_API_URL="https://your-production-domain.com"
```

## Multiple Production Domains

If you have multiple production domains (e.g., different servers, regions, or load balancers), you have several options:

### Option 1: Different servers per domain
Create separate `.env.production` files for each domain and switch them during build:

```bash
# For domain 1
cp .env.production.domain1 .env.production
npm run build

# For domain 2
cp .env.production.domain2 .env.production
npm run build
```

### Option 2: Environment variable at runtime
Pass the API URL as an environment variable during build:

```bash
VITE_MRI_ANALYSIS_API_URL="https://mri-api-1.yourdomain.com" npm run build
VITE_MRI_ANALYSIS_API_URL="https://mri-api-2.yourdomain.com" npm run build
```

### Option 3: Load balancer / Reverse proxy
Set up a single endpoint that routes to multiple backend servers:

```
VITE_MRI_ANALYSIS_API_URL="https://mri-api.yourdomain.com"
```

Then configure your reverse proxy (nginx, CloudFlare, AWS ALB) to route requests to different servers.

### Option 4: Auto-detection based on current domain
Modify `src/lib/mriAnalysis.ts` to auto-detect the API domain:

```typescript
const getAPIUrl = () => {
  if (import.meta.env.VITE_MRI_ANALYSIS_API_URL) {
    return import.meta.env.VITE_MRI_ANALYSIS_API_URL;
  }
  
  const currentHost = window.location.host;
  const domainMap: Record<string, string> = {
    'app1.yourdomain.com': 'https://mri-api-1.yourdomain.com',
    'app2.yourdomain.com': 'https://mri-api-2.yourdomain.com',
  };
  
  return domainMap[currentHost] || 'http://127.0.0.1:5000';
};
```

## How the Configuration Works

1. **Build Time**: The `VITE_MRI_ANALYSIS_API_URL` is embedded into the built JavaScript during `npm run build`
2. **Runtime**: The frontend reads this URL and sends MRI analysis requests to it
3. **Cross-Origin**: Make sure your Flask API has CORS configured to accept requests from your frontend domain

## Checking Your Configuration

After building for production, you can verify the endpoint is correct by:

1. Opening browser DevTools (F12)
2. Going to Network tab
3. Uploading an MRI image
4. Looking for the POST request to `/analyze`
5. Check the "Request URL" - it should point to your production API

## Flask API Deployment

Make sure your Flask MRI analysis service is running on your production domain:

```bash
# Example using Flask with Gunicorn on production
gunicorn -w 4 -b 0.0.0.0:5000 services.mri_analysis.app:app
```

Or deploy to a cloud service (AWS, Google Cloud, Azure, etc.) and use its public URL.

## Common Issues

### Issue: Still using localhost:5000 in production
**Solution**: Ensure `VITE_MRI_ANALYSIS_API_URL` is set in `.env.production` and rebuild:
```bash
npm run build
```

### Issue: CORS errors in browser console
**Solution**: The Flask API needs to allow your frontend domain. Update [services/mri_analysis/app.py]:
```python
CORS(app, origins=["https://yourdomain.com", "https://api.yourdomain.com"])
```

### Issue: Network request blocked
**Solution**: Ensure your API URL uses HTTPS in production (not HTTP)
