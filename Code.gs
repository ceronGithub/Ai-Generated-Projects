// ╔══════════════════════════════════════════════════════════════╗
// ║          MailVault — Google Apps Script Backend              ║
// ║  Runs entirely inside your Google Account. No Cloud setup.  ║
// ╚══════════════════════════════════════════════════════════════╝

function doGet() {
  return HtmlService.createHtmlOutputFromFile('index')
    .setTitle('MailVault — Gmail Exporter')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

// ─────────────────────────────────────────────────────────────────
// getUserEmail()
// Called on page load to show signed-in email in the hero pill.
// ─────────────────────────────────────────────────────────────────
function getUserEmail() {
  try {
    return { email: Session.getActiveUser().getEmail() || '' };
  } catch (e) {
    return { email: '' };
  }
}

// ─────────────────────────────────────────────────────────────────
// checkPermissions()
// Probes whether the user still has valid OAuth permissions.
// Called on page load — shows reconnect banner BEFORE fetch fails.
//
// Revocation is detected by:
//   1. ScriptApp.getOAuthToken() throws/returns null  → revoked
//   2. A minimal GmailApp.search() throws an auth error → revoked
//
// Returns:
//   { status:'connected', email:string }
//   { status:'revoked',   email:string, reconnectUrl:string }
//   { status:'error',     email:string, message:string }
// ─────────────────────────────────────────────────────────────────
function checkPermissions() {
  var email = '';
  try { email = Session.getActiveUser().getEmail() || ''; } catch(e) {}

  // Step 1: probe OAuth token
  var token = null;
  try {
    token = ScriptApp.getOAuthToken();
  } catch (e) {
    return { status:'revoked', email:email, reconnectUrl:_reconnectUrl() };
  }
  if (!token) {
    return { status:'revoked', email:email, reconnectUrl:_reconnectUrl() };
  }

  // Step 2: probe Gmail scope
  try {
    GmailApp.search('label:inbox', 0, 1);
  } catch (e) {
    var m = (e.message || '').toLowerCase();
    if (m.indexOf('authorization')!==-1 || m.indexOf('permission')!==-1 ||
        m.indexOf('access')!=-1 || m.indexOf('scope')!==-1 ||
        m.indexOf('token')!==-1 || m.indexOf('oauth')!==-1) {
      return { status:'revoked', email:email, reconnectUrl:_reconnectUrl() };
    }
    // non-auth Gmail error — permissions fine
  }

  return { status:'connected', email:email };
}

function _reconnectUrl() {
  try {
    // Cache-busting param forces a fresh request so Apps Script
    // re-evaluates auth state and re-prompts consent if needed.
    return ScriptApp.getService().getUrl() + '?reconnect=1&t=' + Date.now();
  } catch(e) { return ''; }
}

// ─────────────────────────────────────────────────────────────────
// fetchEmailsByDateRange()
// Also detects mid-session revocation via errorType:'permissions_revoked'
// ─────────────────────────────────────────────────────────────────
function fetchEmailsByDateRange(dateFrom, dateTo) {
  try {
    var after  = dateFrom.replace(/-/g, '/');
    var before = _addOneDay(dateTo).replace(/-/g, '/');
    var query  = 'after:' + after + ' before:' + before;

    var emails  = [];
    var start   = 0;
    var perPage = 500;

    while (true) {
      var threads = GmailApp.search(query, start, perPage);
      if (!threads || threads.length === 0) break;

      threads.forEach(function(thread) {
        thread.getMessages().forEach(function(msg) {
          var msgDate = msg.getDate();
          var from    = new Date(dateFrom + 'T00:00:00');
          var to      = new Date(dateTo   + 'T23:59:59');
          if (msgDate >= from && msgDate <= to) {
            emails.push({
              id:        msg.getId(),
              threadId:  thread.getId(),
              date:      Utilities.formatDate(msgDate, Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss'),
              from:      msg.getFrom(),
              to:        msg.getTo(),
              cc:        msg.getCc(),
              bcc:       msg.getBcc(),
              subject:   msg.getSubject() || '(no subject)',
              snippet:   msg.getPlainBody().substring(0, 200).replace(/\n/g, ' '),
              labels:    thread.getLabels().map(function(l){ return l.getName(); }).join(', '),
              isRead:    !msg.isUnread(),
              isStarred: msg.isStarred(),
            });
          }
        });
      });

      if (threads.length < perPage) break;
      start += perPage;
    }

    return { emails:emails, total:emails.length, error:null, errorType:null };

  } catch (e) {
    var msg = (e.message || '').toLowerCase();
    var isAuth = msg.indexOf('authorization')!==-1 || msg.indexOf('permission')!==-1 ||
                 msg.indexOf('access')!==-1 || msg.indexOf('oauth')!==-1;
    return {
      emails:[], total:0,
      error: e.message,
      errorType: isAuth ? 'permissions_revoked' : 'general'
    };
  }
}

function exportToSheet(emails, dateFrom, dateTo) {
  try {
    var sheetName = 'MailVault Export ' + dateFrom + (dateFrom !== dateTo ? ' to ' + dateTo : '');
    var ss        = SpreadsheetApp.create(sheetName);

    var emailSheet = ss.getActiveSheet();
    emailSheet.setName('Emails');

    var headers = ['#','Date','From','To','CC','BCC','Subject','Preview (200 chars)','Labels','Read','Starred','Message ID','Thread ID'];
    emailSheet.appendRow(headers);
    emailSheet.getRange(1,1,1,headers.length)
      .setBackground('#0a0a0f').setFontColor('#00e5ff')
      .setFontWeight('bold').setFontFamily('Courier New').setFontSize(9);

    emails.forEach(function(e, i) {
      emailSheet.appendRow([i+1,e.date,e.from,e.to,e.cc,e.bcc,e.subject,
        e.snippet,e.labels,e.isRead?'Yes':'No',e.isStarred?'Yes':'No',
        e.id,e.threadId]);
    });

    [40,160,220,220,160,160,300,400,140,60,70,160,160].forEach(function(w,i){
      emailSheet.setColumnWidth(i+1, w);
    });
    emailSheet.setFrozenRows(1);
    emailSheet.getRange(1,1,emailSheet.getLastRow(),headers.length).createFilter();

    for (var r=2; r<=emails.length+1; r++) {
      emailSheet.getRange(r,1,1,headers.length)
        .setBackground(r%2===0?'#0f0f1a':'#13131f').setFontColor('#c8c8d8');
    }

    var summarySheet = ss.insertSheet('Summary');
    [
      ['MailVault \u2014 Gmail Export Summary'],[],
      ['Account',   Session.getActiveUser().getEmail()],
      ['From',      dateFrom],['To', dateTo],
      ['Total',     emails.length],
      ['Read',      emails.filter(function(e){return  e.isRead;}).length],
      ['Unread',    emails.filter(function(e){return !e.isRead;}).length],
      ['Starred',   emails.filter(function(e){return  e.isStarred;}).length],
      ['Generated', Utilities.formatDate(new Date(),Session.getScriptTimeZone(),'yyyy-MM-dd HH:mm:ss')],
    ].forEach(function(row){ summarySheet.appendRow(row); });

    summarySheet.getRange('A1').setFontSize(14).setFontWeight('bold').setFontColor('#00e5ff').setBackground('#0a0a0f');
    summarySheet.getRange('A3:A10').setFontWeight('bold').setFontColor('#7c3aed');
    summarySheet.getRange('B3:B10').setFontColor('#e8e8f0');
    summarySheet.setColumnWidth(1,200); summarySheet.setColumnWidth(2,280);

    var labelCounts={};
    emails.forEach(function(e){
      e.labels.split(', ').filter(Boolean).forEach(function(l){
        labelCounts[l]=(labelCounts[l]||0)+1;
      });
    });
    summarySheet.appendRow([]); summarySheet.appendRow(['Label','Count']);
    summarySheet.getRange(summarySheet.getLastRow(),1,1,2)
      .setFontWeight('bold').setFontColor('#00e5ff').setBackground('#0a0a0f');
    Object.entries(labelCounts).sort(function(a,b){return b[1]-a[1];})
      .forEach(function(entry){ summarySheet.appendRow(entry); });

    ss.setActiveSheet(summarySheet); ss.moveActiveSheet(1);
    return { url:ss.getUrl(), error:null };

  } catch(e) {
    return { url:null, error:e.message };
  }
}

function _addOneDay(dateStr) {
  var d = new Date(dateStr + 'T12:00:00');
  d.setDate(d.getDate() + 1);
  return d.toISOString().split('T')[0];
}

// ─────────────────────────────────────────────────────────────────
// getAppUrl()
// Returns the deployed web app URL so the frontend can build the
// Google logout redirect URL: accounts.google.com/logout?continue=<appUrl>
// ─────────────────────────────────────────────────────────────────
function getAppUrl() {
  try {
    return ScriptApp.getService().getUrl();
  } catch(e) {
    return '';
  }
}
