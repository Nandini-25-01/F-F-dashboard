/**
 * Google Apps Script for F&F Settlement Dashboard
 * 
 * Instructions:
 * 1. Open your Google Sheet.
 * 2. Click Extensions > Apps Script.
 * 3. Clear any existing code in Code.gs and paste this script.
 * 4. Replace the DEFAULT_BACKEND_URL variable below with your actual backend server URL (e.g., http://localhost:8005 or your ngrok/tunnel URL).
 *    Note: Google Apps Script runs in the cloud. If your backend is running on localhost, 
 *    you will need to expose it using a tool like ngrok (e.g., `ngrok http 8005`) and use that public URL.
 * 5. Save (Ctrl+S or Cmd+S) and refresh your Google Sheet.
 * 6. You will see a new menu item "Dashboard Sync" next to Help.
 */

// Set this to your exposed backend URL (e.g. ngrok tunnel URL or public IP)
var DEFAULT_BACKEND_URL = "https://your-ngrok-tunnel-url.ngrok-free.app";

/**
 * Creates a custom menu in the Google Sheet on open.
 */
function onOpen() {
  var ui = SpreadsheetApp.getUi();
  ui.createMenu('Dashboard Sync')
    .addItem('Trigger Sync Now', 'triggerDashboardSync')
    .addItem('Configure Backend URL', 'configureBackendUrl')
    .addToUi();
}

/**
 * Sends a POST request to the dashboard backend to sync data.
 */
function triggerDashboardSync() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet();
  var sheetUrl = sheet.getUrl();
  var ui = SpreadsheetApp.getUi();
  
  // Get backend URL from properties or fallback to default
  var userProperties = PropertiesService.getUserProperties();
  var backendUrl = userProperties.getProperty('BACKEND_URL') || DEFAULT_BACKEND_URL;
  
  if (!backendUrl || backendUrl.indexOf("your-ngrok-tunnel-url") !== -1) {
    ui.alert(
      'Configuration Required', 
      'Please configure a valid dashboard backend URL first by going to:\nDashboard Sync > Configure Backend URL.\n\nNote: Because Google Apps Script runs in the Google Cloud, localhost URLs cannot be reached directly without an ngrok tunnel.', 
      ui.ButtonSet.OK
    );
    return;
  }

  // Ensure trailing slash is removed
  backendUrl = backendUrl.replace(/\/$/, "");
  
  sheet.toast('Sending synchronization request to backend...', 'Sync Started', 5);
  
  var payload = {
    "url": sheetUrl
  };
  
  var options = {
    "method": "post",
    "contentType": "application/json",
    "payload": JSON.stringify(payload),
    "muteHttpExceptions": true
  };
  
  try {
    var response = UrlFetchApp.fetch(backendUrl + "/api/sync", options);
    var responseCode = response.getResponseCode();
    var responseBody = response.getContentText();
    
    if (responseCode === 200) {
      sheet.toast('Data sync completed successfully!', 'Sync Success 🟢', 8);
    } else {
      var errDetail = "HTTP Status: " + responseCode + "\nResponse: " + responseBody;
      Logger.log(errDetail);
      ui.alert(
        'Synchronization Failed', 
        'The backend server returned an error:\n\n' + errDetail, 
        ui.ButtonSet.OK
      );
    }
  } catch (e) {
    Logger.log(e.toString());
    ui.alert(
      'Network Connection Error', 
      'Could not connect to the backend server at ' + backendUrl + '.\n\nPlease check:\n1. Is your uvicorn backend server running?\n2. Is your ngrok/tunnel tunnel active?\n3. Is your configured backend URL correct?', 
      ui.ButtonSet.OK
    );
  }
}

/**
 * Prompt to configure custom backend URL stored in UserProperties.
 */
function configureBackendUrl() {
  var ui = SpreadsheetApp.getUi();
  var userProperties = PropertiesService.getUserProperties();
  var currentUrl = userProperties.getProperty('BACKEND_URL') || DEFAULT_BACKEND_URL;
  
  var response = ui.prompt(
    'Configure Dashboard Backend',
    'Enter your public backend server URL (e.g. your ngrok url):\n\nCurrently set to:',
    ui.ButtonSet.OK_CANCEL
  );
  
  // Process the user's response.
  if (response.getSelectedButton() == ui.Button.OK) {
    var newUrl = response.getResponseText().trim();
    if (newUrl) {
      userProperties.setProperty('BACKEND_URL', newUrl);
      ui.alert('Success', 'Backend URL updated to:\n' + newUrl, ui.ButtonSet.OK);
    }
  }
}

/**
 * Optional Trigger: Sync data on edit.
 * To enable this, go to Triggers (clock icon) in Apps Script and add a trigger:
 * - Choose function to run: onEditTrigger
 * - Select event source: From spreadsheet
 * - Select event type: On edit
 */
function onEditTrigger(e) {
  // We debounce the sync request slightly or check edit scopes to avoid spamming the backend
  var userProperties = PropertiesService.getUserProperties();
  var isEnabled = userProperties.getProperty('AUTO_SYNC_ON_EDIT') === 'true';
  
  if (isEnabled) {
    triggerDashboardSync();
  }
}
