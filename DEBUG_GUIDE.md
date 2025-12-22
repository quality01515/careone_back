# IIS Deployment Debugging Guide

## How to Check if the Server is Working

### 1. Check IIS Log Files

The Node.js stdout logs are written to:
```
.\logs\node-stdout.log
```

**Check the log file:**
- Navigate to your application directory
- Open `logs\node-stdout.log`
- Look for error messages or startup messages

### 2. Check Windows Event Viewer

1. Open **Event Viewer** (Windows Key + R, type `eventvwr.msc`)
2. Navigate to: **Windows Logs** → **Application**
3. Look for errors related to:
   - `httpPlatformHandler`
   - `node.exe`
   - Your application name

### 3. Test Health Check Endpoints

Once the server is running, test these endpoints:

**Root endpoint:**
```
https://careone-health.com/careone-journey-api/
```

**Health check:**
```
https://careone-health.com/careone-journey-api/health
```

**Test endpoint:**
```
https://careone-health.com/careone-journey-api/api/test
```

### 4. Check IIS Application Pool

1. Open **IIS Manager**
2. Navigate to your site → **Application Pools**
3. Check if the application pool is:
   - **Started** (not Stopped)
   - **Running** (not in Error state)
4. Check the **Identity** of the application pool:
   - Right-click → **Advanced Settings** → **Identity**
   - Ensure it has permissions to:
     - Read the application directory
     - Write to the `logs` directory
     - Execute Node.js

### 5. Verify Node.js Installation

**Check if Node.js is installed:**
```powershell
node --version
```

**Check if Node.js is in the expected location:**
```powershell
Test-Path "C:\Program Files\nodejs\node.exe"
```

If Node.js is in a different location, update `web.config`:
```xml
<httpPlatform processPath="C:\Your\Node\Path\node.exe" ... />
```

### 6. Check File Permissions

Ensure the IIS application pool identity has:
- **Read & Execute** on the application folder
- **Write** permission on the `logs` folder
- **Read** permission on `node_modules` folder

### 7. Enable Failed Request Tracing (Optional)

1. In IIS Manager, select your site
2. Double-click **Failed Request Tracing Rules**
3. Click **Add** in the Actions pane
4. Configure to trace:
   - Status codes: 200-999
   - Event severity: Errors, Warnings, Critical Errors
5. Check the trace files in: `%SystemDrive%\inetpub\logs\FailedReqLogFiles\`

### 8. Test Locally First

Before deploying to IIS, test the application locally:

```powershell
# Navigate to your application directory
cd "D:\Work\CareONE\work\CareONE_Journey\CareONE Journey API"

# Set environment variables
$env:NODE_ENV="production"
$env:PORT="3001"

# Run the application
node app.js
```

If it works locally but not in IIS, the issue is with IIS configuration.

### 9. Common Issues and Solutions

#### Issue: Port already in use
**Solution:** The port might be in use. IIS should handle this automatically, but check if another process is using the port.

#### Issue: Module not found
**Solution:** Ensure `node_modules` is present and all dependencies are installed:
```powershell
npm install
```

#### Issue: Database connection fails
**Solution:** 
- Check database connection string in `database.js`
- Ensure SQL Server is accessible from the IIS server
- Check firewall rules
- Verify SQL Server authentication

#### Issue: Path issues
**Solution:** Use relative paths in `web.config`. The current config uses `app.js` which should work.

### 10. Enable Detailed Error Messages

The `web.config` already has:
```xml
<httpErrors errorMode="Detailed" existingResponse="PassThrough" />
```

This should show detailed errors. If you still see generic 500 errors, check:
- IIS Manager → Your Site → **Error Pages** → Ensure custom errors are disabled
- Check the actual error in the log files

## Quick Diagnostic Commands

```powershell
# Check if Node.js is accessible
& "C:\Program Files\nodejs\node.exe" --version

# Check if the app.js file exists
Test-Path "app.js"

# Check if logs directory exists
Test-Path "logs"

# Check application pool status
Get-WebAppPoolState -Name "YourAppPoolName"

# Restart application pool
Restart-WebAppPool -Name "YourAppPoolName"
```

## Next Steps

1. Check the `logs\node-stdout.log` file for errors
2. Test the `/health` endpoint
3. Check Windows Event Viewer for detailed errors
4. Verify Node.js path and permissions
5. Test the application locally first

