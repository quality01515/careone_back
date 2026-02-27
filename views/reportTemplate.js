// Utility to escape HTML special characters
function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function fmtDate(value) {
  try {
    const d = value ? new Date(value) : new Date();
    if (isNaN(d.getTime())) return '';
    return d.toDateString();
  } catch {
    return '';
  }
}

function fullName(patient) {
  if (!patient) return '';
  const parts = [patient.FirstName, patient.LastName].filter(Boolean);
  return escapeHtml(parts.join(' '));
}

// Build the HTML document for the Patient Journey Report
// params: { patient, categories, generatedAt }
function renderReportHTML(params) {
  const { patient, categories = [], generatedAt = new Date(), header_info } = params || {};
  const patientId = patient && patient.Patient_ID ? String(patient.Patient_ID) : '';


  const categoriesRows = categories.map(cat => {
    const comps = (cat.components || []).map((comp, idx) => {
      const selected = Number(comp.Hidden) == 0; // 0 means selected per existing schema
      const icon = selected ? '♥' : '♡';
      return `<div class="comp-item">
                <span class="icon" style="color:#0e82fd;font-size:14px;" aria-hidden="true">${icon}</span>
                <span class="txt">${escapeHtml(comp.PortalComponentsName)}</span>
              </div>`;
    }).join('');

    return `
      <tr class="category-row" style="font-size:13.5px;">
        <td class="category-name" style="border:1px solid; border-top: none; padding-top:5px; padding-bottom:5px; padding-left: 5px;">${escapeHtml(cat.PortalCategoriesName)}</td>
        <td class="components" style="border:1px solid; border-left: none; border-top: none; padding-top:5px; padding-bottom:5px; padding-left: 5px;">${comps}</td>
      </tr>`;
  }).join('');

  const html = `<!DOCTYPE html>
  <html>
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <title>Patient Journey Report</title>
      <link rel="stylesheet" href="/stylesheets/report.css" />
    </head>
    <body>
      <div class="header">
        <h1 style="color:#35A7CF;margin:0 0 8px 0">Patient Journey Report</h1>

        <table cellpadding="2" cellspacing="0" style="width:100%;border-collapse:separate;table-layout:fixed;">
          <tr>
            <td style="vertical-align:top;text-align:left;width:50%;">
              <table cellpadding="1" cellspacing="0">
                <tr>
                  <td style="font-size:13.5px;">Patient Name: <b>${fullName(patient)}</b></td>
                </tr>
                <tr>
                  <td style="font-size:13.5px;">Date: <b>${fmtDate(patient && patient.DOB ? patient.DOB : generatedAt)}</b></td>
                </tr>
                <tr>
                  <td style="font-size:13.5px;">Healthcare Provider: <b>${header_info && escapeHtml(header_info.ProviderFirstName) + " " + escapeHtml(header_info.ProviderMiddleName) + " " + escapeHtml(header_info.ProviderLastName)}${header_info?.ProviderSuffix != '' && ", " + header_info.ProviderSuffix}</b></td>
                </tr>
              </table>
            </td>
            <td style="vertical-align:top;text-align:right;width:50%;" align="right">
              <table cellpadding="1" cellspacing="0" style="width:100%;" align="right">
                <tr>
                  <td style="font-size:13.5px;" align="right">MRN:</td>
                  <td style="font-size:13.5px;" align="left"><strong>${header_info && header_info.MRN ? escapeHtml(header_info.MRN) : ''}</strong></td>
                </tr>
                <tr>
                  <td style="font-size:13.5px;" align="right">Practice:</td>
                  <td style="font-size:13.5px;" align="left"><strong>${header_info && header_info.Practice ? escapeHtml(header_info.Practice) : ''}</strong></td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td colspan="2" style="padding-top:6px;">
              <hr style="border:0;height:8px;background:#35A7CF;margin:4px 0;" />
            </td>
          </tr>
          <tr>
            <td colspan="2" style="background-color:#DDEEF3;padding:8px;">
              <strong style="font-size:13.5px;font-style:italic;color:#35A7CF;font-family:sans-serif;display:block;">
                Your personalized Patient Journey is shown below based 
                upon your choices.  You may change these items at any time by modifying the items in 
                your Patient Journey application.  Your clinical team will begin working with you to help 
                you accomplish the goals shown below.
              </strong>
            </td>
          </tr>
          <tr>
            <td colspan="2" style="padding-top:6px;">
              <hr style="border:0;height:1px;background:#35A7CF;margin:4px 0;" />
            </td>
          </tr>
        </table>
      </div>

      <div class="content" style="margin-top:2px;">
        <table class="report-table" style="width:100%; margin:0 auto; border:1px solid; border-collapse:collapse; border-bottom: none; border-spacing:2px;" cellpadding="0" cellspacing="0">
          <thead style="background-color:#f2f2f2;">
            <tr><th style="border:1px solid; border-collapse:collapse; border-bottom: none; border-top: none; border-left: none; text-align:left; padding-left: 5px; padding-bottom:10px; padding-top:10px;">Category</th><th style="text-align:left; padding-left: 5px;">Component parts of each Category</th></tr>
          </thead>
          <tbody style="border:1px solid; border-collapse:collapse; border-bottom: none; border-left: none; border-right: none; border-spacing:2px;">
            ${categoriesRows}
          </tbody>
        </table>
      </div>
    </body>
  </html>`;

  return html;
}

module.exports = {
  renderReportHTML,
};
