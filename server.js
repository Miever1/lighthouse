import fs from 'fs';
import lighthouse from 'lighthouse';
import chromeLauncher from 'chrome-launcher';
import express from 'express';
import path from 'path';

// 允许的域名白名单
const ALLOWED_DOMAINS = [
  'https://miever.net',
];

async function runLighthouseAudit(url) {
  try {
    const chrome = await chromeLauncher.launch({chromeFlags: ['--headless']});

    const options = {
      logLevel: 'info',
      output: 'html',
      port: chrome.port,
      formFactor: 'desktop',
      screenEmulation: {
        mobile: false,
        width: 1350,
        height: 940,
        deviceScaleFactor: 1,
        disabled: false
      },
      throttling: {
        rttMs: 20,
        throughputKbps: 300000,
        uploadThroughputKbps: 50000,
        cpuSlowdownMultiplier: 1,
      }
    };

    const runnerResult = await lighthouse(url, options);
    let reportHtml = runnerResult.report;

    // 修改HTML以添加域名验证
    reportHtml = addDomainValidation(reportHtml);
    
    fs.writeFileSync('lighthouse-dark-report.html', reportHtml);

    console.log('Lighthouse audit completed for:', runnerResult.lhr.finalDisplayedUrl);
    console.log('Performance score:', runnerResult.lhr.categories.performance.score * 100);

    await chrome.kill();

  } catch (error) {
    console.error('Error during Lighthouse audit:', error);
  }
}

function addDomainValidation(html) {
  const validationScript = `
    <script>
      // 检查父窗口域名
      function validateParentDomain() {
        try {
          const allowedDomains = ${JSON.stringify(ALLOWED_DOMAINS)};
          
          // 如果不在iframe中，允许直接访问
          if (window === window.top) {
            return true;
          }
          
          // 检查父窗口的域名
          const parentOrigin = document.referrer;
          const isAllowed = allowedDomains.some(domain => 
            parentOrigin.startsWith(domain)
          );
          
          if (!isAllowed) {
            document.body.innerHTML = '<h1>访问被拒绝</h1><p>此页面只能从授权域名访问。</p>';
            return false;
          }
          
          return true;
        } catch (error) {
          console.error('Domain validation error:', error);
          return false;
        }
      }
      
      // 页面加载时验证
      window.addEventListener('load', validateParentDomain);
    </script>
  `;

  return html.replace('</head>', validationScript + '</head>');
}

// Express服务器配置
const app = express();

app.get('/lighthouse-report', (req, res) => {
  // 构建CSP头部，只允许特定域名嵌入
  const frameAncestors = ALLOWED_DOMAINS.join(' ');
  const cspHeader = `frame-ancestors 'self' ${frameAncestors}`;
  
  res.setHeader('Content-Security-Policy', cspHeader);
  res.setHeader('X-Frame-Options', 'SAMEORIGIN'); // 兼容老浏览器
  
  res.sendFile(path.join(__dirname, 'lighthouse-dark-report.html'));
});

app.listen(3000, () => {
  console.log('Server running on port 3000');
});

runLighthouseAudit('https://miever.net');
