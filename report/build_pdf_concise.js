const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer-core');

const REPORT_MD = path.join(__dirname, 'draft/report_concise.md');
const PDF_OUT = path.join(__dirname, 'final/enhanced_sw_project_report_concise.pdf');
const HTML_OUT = path.join(__dirname, 'final/report_concise.html');
const BASE_DIR = path.resolve(__dirname, '..');

function cleanMath(text) {
  let res = text;
  
  // Handle LaTeX fractions: \frac{num}{den} -> (num / den)
  res = res.replace(/\\frac\{([^}]+)\}\{([^}]+)\}/g, '($1 / $2)');
  res = res.replace(/\\left\(/g, '(').replace(/\\right\)/g, ')');
  res = res.replace(/\\sqrt\{([^}]+)\}/g, 'sqrt($1)');

  // Handle common LaTeX symbols and commands
  res = res
    .replace(/\\Delta/g, 'Δ')
    .replace(/\\neq/g, '≠')
    .replace(/\\ne\b/g, '≠')
    .replace(/\\equiv/g, '≡')
    .replace(/\\times/g, '×')
    .replace(/\\cdot/g, ' · ')
    .replace(/\\log/g, 'log')
    .replace(/\\implies/g, ' ⟹ ')
    .replace(/\\le\b/g, '≤')
    .replace(/\\ge\b/g, '≥')
    .replace(/\\leq/g, '≤')
    .replace(/\\geq/g, '≥')
    .replace(/\\sum/g, '∑')
    .replace(/\\mu/g, 'μ')
    .replace(/\\sigma/g, 'σ')
    .replace(/\\epsilon/g, 'ε')
    .replace(/\\in\b/g, '∈')
    .replace(/\\to\b/g, '→')
    .replace(/\\xrightarrow\{([^}]+)\}/g, ' ──($1)──> ')
    .replace(/\\hat\{y\}/g, 'ŷ')
    .replace(/\\text\{([^}]+)\}/g, '$1')
    .replace(/\\mathrm\{([^}]+)\}/g, '$1')
    .replace(/\\mathbb\{Q\}\^\+/g, 'ℚ⁺')
    .replace(/\\mathbb\{R\}/g, 'ℝ')
    .replace(/\\mathbb\{Z\}/g, 'ℤ')
    .replace(/\\dots/g, '…')
    .replace(/\\quad/g, '   ')
    .replace(/\\sim/g, '~')
    .replace(/\\max\b/g, 'max')
    .replace(/\\min\b/g, 'min')
    .replace(/\\mathcal\{N\}/g, '𝒩')
    .replace(/\\boldsymbol\{a\}/g, 'a')
    .replace(/\\boldsymbol\{\\delta\}/g, 'δ')
    .replace(/\\boldsymbol\{\\gamma\}/g, 'γ')
    .replace(/\\setminus/g, ' \\ ')
    .replace(/\\%/g, '%')
    .replace(/\\{/g, '{')
    .replace(/\\}/g, '}')
    .replace(/_\{([^}]+)\}/g, '_$1');

  return res;
}

function markdownToHtml(md) {
  const lines = md.split('\n');
  let html = '';
  let inCodeBlock = false;
  let codeLang = '';
  let codeBuffer = [];
  let inTable = false;
  let tableBuffer = [];
  let inList = false;

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];

    // Code blocks
    if (line.startsWith('```')) {
      if (inCodeBlock) {
        html += `<pre class="code-block"><code>${escapeHtml(codeBuffer.join('\n'))}</code></pre>\n`;
        inCodeBlock = false;
        codeBuffer = [];
      } else {
        inCodeBlock = true;
        codeLang = line.slice(3).trim();
        codeBuffer = [];
      }
      continue;
    }

    if (inCodeBlock) {
      codeBuffer.push(line);
      continue;
    }

    // Tables
    if (line.trim().startsWith('|') && line.includes('|')) {
      if (!inTable) {
        inTable = true;
        tableBuffer = [];
      }
      tableBuffer.push(line.trim());
      continue;
    } else if (inTable) {
      html += renderTable(tableBuffer);
      inTable = false;
      tableBuffer = [];
    }

    // Images: ![caption](path)
    const imgMatch = line.match(/^!\[(.*?)\]\((.*?)\)/);
    if (imgMatch) {
      const caption = imgMatch[1];
      const imgPath = imgMatch[2];
      const absImgPath = path.isAbsolute(imgPath) ? imgPath : path.join(BASE_DIR, imgPath);
      
      let explicitCaption = caption;
      if (i + 1 < lines.length && lines[i + 1].trim().startsWith('*') && lines[i + 1].trim().endsWith('*')) {
        explicitCaption = lines[i + 1].trim().replace(/^\*|\*$/g, '');
        i++; // consume caption line
      }

      if (fs.existsSync(absImgPath)) {
        const ext = path.extname(absImgPath).toLowerCase();
        const mime = ext === '.png' ? 'image/png' : 'image/jpeg';
        const b64 = fs.readFileSync(absImgPath).toString('base64');
        html += `
          <div class="figure-container">
            <img src="data:${mime};base64,${b64}" class="report-image" />
            <div class="figure-caption">${formatInline(explicitCaption)}</div>
          </div>\n`;
      }
      continue;
    }

    // Headings
    if (line.startsWith('# ')) {
      html += `<h1 class="doc-title">${formatInline(line.slice(2))}</h1>\n`;
    } else if (line.startsWith('## ')) {
      html += `<h2 class="section-title">${formatInline(line.slice(3))}</h2>\n`;
    } else if (line.startsWith('### ')) {
      html += `<h3 class="subsection-title">${formatInline(line.slice(4))}</h3>\n`;
    } else if (line.startsWith('#### ')) {
      html += `<h4 class="subsubsection-title">${formatInline(line.slice(5))}</h4>\n`;
    } else if (line.startsWith('---')) {
      html += `<hr class="divider"/>\n`;
    } else if (line.trim() === '') {
      if (inList) {
        html += inList === 'ol' ? '</ol>\n' : '</ul>\n';
        inList = false;
      }
    } else {
      // Bullet list
      if (line.trim().startsWith('- ') || line.trim().startsWith('* ')) {
        if (inList !== 'ul') {
          if (inList) html += inList === 'ol' ? '</ol>\n' : '</ul>\n';
          html += '<ul class="report-ul">\n';
          inList = 'ul';
        }
        html += `<li class="list-item">${formatInline(line.trim().slice(2))}</li>\n`;
      } else if (/^\d+\.\s/.test(line.trim())) {
        if (inList !== 'ol') {
          if (inList) html += inList === 'ol' ? '</ol>\n' : '</ul>\n';
          html += '<ol class="report-ol">\n';
          inList = 'ol';
        }
        const itemText = line.trim().replace(/^\d+\.\s/, '');
        html += `<li class="num-list-item">${formatInline(itemText)}</li>\n`;
      } else {
        if (inList) {
          html += inList === 'ol' ? '</ol>\n' : '</ul>\n';
          inList = false;
        }
        html += `<p class="paragraph">${formatInline(line)}</p>\n`;
      }
    }
  }

  if (inList) {
    html += inList === 'ol' ? '</ol>\n' : '</ul>\n';
    inList = false;
  }

  if (inTable) {
    html += renderTable(tableBuffer);
  }

  return html;
}

function renderTable(tableLines) {
  if (tableLines.length < 2) return '';
  const headers = tableLines[0].split('|').slice(1, -1).map(h => h.trim());
  const rows = [];

  for (let i = 2; i < tableLines.length; i++) {
    const cells = tableLines[i].split('|').slice(1, -1).map(c => c.trim());
    if (cells.length > 0) {
      rows.push(cells);
    }
  }

  let tableHtml = '<div class="table-wrapper"><table class="academic-table">\n<thead><tr>';
  headers.forEach(h => {
    tableHtml += `<th>${formatInline(h)}</th>`;
  });
  tableHtml += '</tr></thead>\n<tbody>';

  rows.forEach((row, rIdx) => {
    const rowClass = rIdx % 2 === 0 ? 'even-row' : 'odd-row';
    tableHtml += `<tr class="${rowClass}">`;
    headers.forEach((_, cIdx) => {
      const cellVal = row[cIdx] || '';
      tableHtml += `<td>${formatInline(cellVal)}</td>`;
    });
    tableHtml += '</tr>\n';
  });

  tableHtml += '</tbody></table></div>\n';
  return tableHtml;
}

function escapeHtml(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function formatInline(text) {
  let cleaned = cleanMath(text);
  return cleaned
    .replace(/&/g, '&amp;')
    .replace(/<(?!\/?br\b)/gi, '&lt;')
    .replace(/(?<!br)>/gi, '&gt;')
    .replace(/\$\$(.*?)\$\$/g, '<div class="math-block"><i>$1</i></div>')
    .replace(/\$(.*?)\$/g, '<span class="math-inline"><i>$1</i></span>')
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/`([^`]+)`/g, '<code class="inline-code">$1</code>');
}

async function buildPdf() {
  console.log('Reading concise report markdown...');
  const mdContent = fs.readFileSync(REPORT_MD, 'utf8');
  const bodyHtml = markdownToHtml(mdContent);

  const fullHtml = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Enhanced Splitwise - Academic Project Report (Concise Edition)</title>
  <style>
    @page {
      size: A4;
      margin: 18mm 14mm 18mm 14mm;
    }

    body {
      font-family: 'Georgia', 'Times New Roman', serif;
      font-size: 9.5pt;
      line-height: 1.5;
      color: #1e293b;
      background-color: #ffffff;
      margin: 0;
      padding: 0;
    }

    .doc-title {
      font-family: 'Helvetica Neue', Arial, sans-serif;
      font-size: 16pt;
      font-weight: 800;
      color: #0f172a;
      text-align: center;
      margin-top: 10px;
      margin-bottom: 8px;
      line-height: 1.25;
      letter-spacing: -0.01em;
    }

    .section-title {
      font-family: 'Helvetica Neue', Arial, sans-serif;
      font-size: 12pt;
      font-weight: 700;
      color: #1e3a8a;
      border-bottom: 1.5px solid #cbd5e1;
      padding-bottom: 4px;
      margin-top: 20px;
      margin-bottom: 10px;
      page-break-after: avoid;
    }

    .subsection-title {
      font-family: 'Helvetica Neue', Arial, sans-serif;
      font-size: 10.5pt;
      font-weight: 600;
      color: #334155;
      margin-top: 14px;
      margin-bottom: 6px;
      page-break-after: avoid;
    }

    .subsubsection-title {
      font-family: 'Helvetica Neue', Arial, sans-serif;
      font-size: 9.5pt;
      font-weight: 600;
      color: #475569;
      margin-top: 10px;
      margin-bottom: 4px;
      page-break-after: avoid;
    }

    .paragraph {
      text-align: justify;
      margin-top: 0;
      margin-bottom: 8px;
    }

    .report-ul, .report-ol {
      margin-top: 2px;
      margin-bottom: 8px;
      padding-left: 20px;
    }

    .list-item {
      margin-bottom: 3px;
      text-align: justify;
      list-style-type: disc;
    }

    .num-list-item {
      margin-bottom: 3px;
      text-align: justify;
      list-style-type: decimal;
    }

    .divider {
      border: 0;
      height: 1px;
      background: #e2e8f0;
      margin: 16px 0;
    }

    .figure-container {
      margin: 12px 0;
      text-align: center;
      page-break-inside: avoid;
    }

    .report-image {
      max-width: 92%;
      max-height: 380px;
      height: auto;
      border-radius: 4px;
      border: 1px solid #cbd5e1;
      box-shadow: 0 1px 3px rgba(0,0,0,0.08);
    }

    .figure-caption {
      font-family: 'Helvetica Neue', Arial, sans-serif;
      font-size: 8pt;
      color: #64748b;
      margin-top: 5px;
      font-style: italic;
    }

    .code-block {
      background-color: #f8fafc;
      border: 1px solid #e2e8f0;
      border-left: 3px solid #3b82f6;
      border-radius: 3px;
      padding: 6px 10px;
      font-family: 'Consolas', 'Courier New', monospace;
      font-size: 7.8pt;
      line-height: 1.35;
      color: #0f172a;
      overflow-x: hidden;
      white-space: pre-wrap;
      word-wrap: break-word;
      margin: 8px 0;
      page-break-inside: avoid;
    }

    .inline-code {
      font-family: 'Consolas', 'Courier New', monospace;
      font-size: 8.5pt;
      background-color: #f1f5f9;
      padding: 1px 4px;
      border-radius: 3px;
      color: #0f172a;
    }

    .math-block {
      text-align: center;
      margin: 8px 0;
      font-family: 'Georgia', serif;
      font-size: 9.5pt;
      color: #1e293b;
    }

    .math-inline {
      font-family: 'Georgia', serif;
    }

    .table-wrapper {
      margin: 10px 0;
      page-break-inside: avoid;
      overflow-x: auto;
    }

    .academic-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 7.2pt;
      font-family: 'Helvetica Neue', Arial, sans-serif;
    }

    .academic-table th {
      background-color: #1e293b;
      color: #ffffff;
      font-weight: 700;
      text-align: left;
      padding: 4px 5px;
      border: 1px solid #cbd5e1;
    }

    .academic-table td {
      padding: 3.5px 5px;
      border: 1px solid #cbd5e1;
      vertical-align: top;
      color: #334155;
    }

    .academic-table .even-row {
      background-color: #ffffff;
    }

    .academic-table .odd-row {
      background-color: #f8fafc;
    }
  </style>
</head>
<body>
  ${bodyHtml}
</body>
</html>
  `;

  fs.writeFileSync(HTML_OUT, fullHtml, 'utf8');

  console.log('Rendering concise PDF via Headless Chrome...');
  const browser = await puppeteer.launch({
    executablePath: '/usr/bin/google-chrome',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu']
  });

  const page = await browser.newPage();
  await page.setContent(fullHtml, { waitUntil: 'networkidle0' });

  await page.pdf({
    path: PDF_OUT,
    format: 'A4',
    margin: {
      top: '18mm',
      bottom: '18mm',
      left: '14mm',
      right: '14mm'
    },
    printBackground: true,
    displayHeaderFooter: true,
    headerTemplate: `<div></div>`,
    footerTemplate: `<div style="font-family: 'Helvetica Neue', Arial, sans-serif; font-size: 7pt; color: #94a3b8; width: 100%; text-align: center;">Page <span class="pageNumber"></span> of <span class="totalPages"></span></div>`
  });

  await browser.close();
  console.log(`Generated perfected concise PDF report: ${PDF_OUT}`);
}

buildPdf().catch(err => {
  console.error('Failed to build concise PDF:', err);
  process.exit(1);
});
