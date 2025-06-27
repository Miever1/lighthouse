import fs from 'fs';
import lighthouse from 'lighthouse';
import chromeLauncher from 'chrome-launcher';

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
      },
      // 关键配置：禁用X-Frame-Options限制
      onlyCategories: null,
      skipAudits: null,
      // 添加自定义配置以支持iframe嵌入
      extraHeaders: {
        'X-Frame-Options': 'ALLOWALL'
      }
    };

    const runnerResult = await lighthouse(url, options);
    
    // 修改HTML报告以支持iframe访问
    let reportHtml = runnerResult.report;
    
    // 移除可能阻止iframe嵌入的安全头
    reportHtml = reportHtml.replace(
      /<meta http-equiv="X-Frame-Options"[^>]*>/gi, 
      ''
    );
    
    // 添加允许iframe嵌入的meta标签
    reportHtml = reportHtml.replace(
      '<head>',
      `<head>
        <meta http-equiv="Content-Security-Policy" content="frame-ancestors *;">
        <script>
          // 允许父窗口访问iframe内容
          document.domain = document.domain;
        </script>`
    );

    fs.writeFileSync('lighthouse-iframe-report.html', reportHtml);

    console.log('Lighthouse audit completed for:', runnerResult.lhr.finalDisplayedUrl);
    console.log('Performance score:', runnerResult.lhr.categories.performance.score * 100);

    await chrome.kill();

  } catch (error) {
    console.error('Error during Lighthouse audit:', error);
  }
}

runLighthouseAudit('https://miever.net');
