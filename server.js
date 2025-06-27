import fs from 'fs';
import lighthouse from 'lighthouse';
import chromeLauncher from 'chrome-launcher';

/**
 * Launch Chrome and run Lighthouse audit for the given URL.
 * This function simulates network conditions similar to developed countries' broadband speed.
 */
async function runLighthouseAudit(url, allowedDomains = []) {
  try {
    // Launch a headless Chrome instance
    const chrome = await chromeLauncher.launch({chromeFlags: ['--headless']});

    // Define Lighthouse options
    const options = {
      logLevel: 'info',                  // Log level for detailed output
      output: 'html',                    // Output format (HTML report)
      port: chrome.port,                 // The Chrome port Lighthouse will use
      formFactor: 'desktop',             // Desktop as the primary testing environment
      screenEmulation: {                 // Desktop screen emulation settings
        mobile: false,                  
        width: 1350,                    
        height: 940,                    
        deviceScaleFactor: 1,           
        disabled: false
      },
      // Custom throttling to match developed countries' network conditions
      throttling: {
        rttMs: 20,                       // Network latency: 20 ms (similar to broadband networks)
        throughputKbps: 300000,          // Download speed: 300 Mbps
        uploadThroughputKbps: 50000,     // Upload speed: 50 Mbps
        cpuSlowdownMultiplier: 1,        // No CPU slowdown
      }
    };

    // Run the Lighthouse audit
    const runnerResult = await lighthouse(url, options);

    // Get the original HTML report
    let reportHtml = runnerResult.report;

    // Add domain restriction to the HTML report
    reportHtml = addDomainRestriction(reportHtml, allowedDomains);

    // Save the modified HTML report to a file
    fs.writeFileSync('lighthouse-dark-report.html', reportHtml);

    // Log performance results for desktop
    console.log('Lighthouse audit completed for:', runnerResult.lhr.finalDisplayedUrl);
    console.log('Performance score:', runnerResult.lhr.categories.performance.score * 100);
    console.log('Domain restrictions applied for:', allowedDomains.join(', '));

    // Close Chrome instance
    await chrome.kill();

  } catch (error) {
    // Handle errors that occur during Lighthouse execution
    console.error('Error during Lighthouse audit:', error);
  }
}

/**
 * Add domain restriction to the HTML report
 */
function addDomainRestriction(htmlContent, allowedDomains) {
  // Create frame-ancestors CSP directive
  const frameAncestors = allowedDomains.length > 0 
    ? allowedDomains.join(' ') 
    : "'none'";

  // Create domain validation script
  const domainValidationScript = `
    <script>
      (function() {
        const allowedDomains = ${JSON.stringify(allowedDomains)};
        
        function validateDomain() {
          try {
            // Check if running in iframe
            if (window !== window.top) {
              const parentHost = window.top.location.host;
              const isAllowed = allowedDomains.some(domain => {
                // Remove protocol and trailing slash from domain
                const cleanDomain = domain.replace(/^https?:\\/\\//, '').replace(/\\/$/, '');
                return parentHost === cleanDomain || parentHost.endsWith('.' + cleanDomain);
              });
              
              if (!isAllowed) {
                document.body.innerHTML = \`
                  <div style="display: flex; justify-content: center; align-items: center; height: 100vh; font-family: Arial, sans-serif;">
                    <div style="text-align: center; padding: 40px; border: 2px solid #ff4444; border-radius: 10px; background-color: #fff5f5;">
                      <h2 style="color: #cc0000; margin-bottom: 20px;">访问被拒绝</h2>
                      <p style="color: #666; margin-bottom: 10px;">此报告只能从以下授权域名访问：</p>
                      <ul style="color: #333; text-align: left; display: inline-block;">
                        \${allowedDomains.map(domain => '<li>' + domain + '</li>').join('')}
                      </ul>
                      <p style="color: #999; font-size: 12px; margin-top: 20px;">当前访问域名未在白名单中</p>
                    </div>
                  </div>
                \`;
                return;
              }
            }
          } catch (e) {
            // Cross-origin access blocked - this is expected for iframe from different domain
            if (window !== window.top && allowedDomains.length > 0) {
              // If we can't access parent location and domains are restricted, block access
              document.body.innerHTML = \`
                <div style="display: flex; justify-content: center; align-items: center; height: 100vh; font-family: Arial, sans-serif;">
                  <div style="text-align: center; padding: 40px; border: 2px solid #ff4444; border-radius: 10px; background-color: #fff5f5;">
                    <h2 style="color: #cc0000; margin-bottom: 20px;">访问被拒绝</h2>
                    <p style="color: #666;">此报告仅限授权域名访问</p>
                  </div>
                </div>
              \`;
            }
          }
        }
        
        // Validate domain on load
        if (document.readyState === 'loading') {
          document.addEventListener('DOMContentLoaded', validateDomain);
        } else {
          validateDomain();
        }
      })();
    </script>
  `;

  // Add CSP meta tag and domain validation script to head
  const securityHeaders = `
    <meta http-equiv="Content-Security-Policy" content="frame-ancestors ${frameAncestors};">
    <meta http-equiv="X-Frame-Options" content="${allowedDomains.length > 0 ? 'SAMEORIGIN' : 'DENY'}">
    ${domainValidationScript}
  `;

  // Insert security headers after the opening <head> tag
  const modifiedHtml = htmlContent.replace(
    '<head>',
    `<head>${securityHeaders}`
  );

  return modifiedHtml;
}

// 配置允许访问的域名列表
const allowedDomains = [
  'https://miever.net',
  'https://www.miever.com',
  'http://localhost:8000',
  'http://127.0.0.1:8000'
];

// Run audit for your personal website with domain restrictions
runLighthouseAudit('https://miever.net', allowedDomains);
