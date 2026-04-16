# VPN Setup for Aspekt API Access

## Overview
To access the Aspekt API from your local machine, you need to establish a VPN connection through FortiClient to reach the internal network where the API is hosted.

## Prerequisites
- FortiClient VPN software installed on your local machine
- VPN credentials provided by Finca
- Windows App (for remote desktop connection if needed)

## Network Details
- **API Base URL**: `https://10.35.10.238:447/api`
- **Username Header**: `test1234`
- **API Key Header**: `test1234!@#`

## Setup Steps

### 1. Install FortiClient VPN
Download and install FortiClient from Fortinet's official website.

### 2. Configure VPN Connection
1. Open FortiClient
2. Configure the VPN connection with credentials provided by Finca
3. Connect to the VPN

### 3. Verify Network Access
Once connected to the VPN, verify you can reach the internal network:
```bash
ping 10.35.10.238
```

### 4. Use Local API Proxy
Your local server now acts as a proxy to the Aspekt API. Use these endpoints:

#### Create Lead
- **Local Endpoint**: `POST http://localhost:3000/api/lead/create/898`
- **Proxies to**: `https://10.35.10.238:447/api/createLead/898`
- **Headers**: Automatically included (Username, ApiKey)

#### Example Request
```bash
curl -X POST http://localhost:3000/api/lead/create/898 \
  -H "Content-Type: application/json" \
  -d '{"leadData": "your data here"}'
```

## Environment Configuration
The following environment variables are configured in `.env`:
- `API_BASE_URL=https://10.35.10.238:447/api`
- `MERCHANT_USERNAME=test1234`
- `MERCHANT_API_KEY=test1234!@#`
- `USE_MOCK_API=false` (set to `true` for testing without VPN)

## Troubleshooting
1. **Connection Issues**: Ensure VPN is connected and can reach `10.35.10.238`
2. **SSL/TLS Issues**: The API uses HTTPS with self-signed certificates - your proxy handles this
3. **Authentication**: Headers are automatically added by the aspektClient middleware

## Mock Mode
For development without VPN access, set `USE_MOCK_API=true` in `.env` to use mock responses.