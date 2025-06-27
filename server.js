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
  // 创建改进的域名验证脚本
  const domainValidationScript = `
    <script>
      (function() {
        const allowedDomains = ${JSON.stringify(allowedDomains)};
        
        function normalizeUrl(url) {
          try {
            const urlObj = new URL(url);
            return {
              protocol: urlObj.protocol,
              hostname: urlObj.hostname,
              port: urlObj.port || (urlObj.protocol === 'https:' ? '443' : '80'),
              host: urlObj.host,
              origin: urlObj.origin
            };
          } catch (e) {
            return null;
          }
        }
        
        function isAllowedDomain(testUrl) {
          if (!testUrl) return false;
          
          const test = normalizeUrl(testUrl);
          if (!test) return false;
          
          return allowedDomains.some(allowedDomain => {
            const allowed = normalizeUrl(allowedDomain);
            if (!allowed) return false;
            
            // 精确匹配
            if (test.origin === allowed.origin) {
              return true;
            }
            
            // 处理localhost和127.0.0.1的等价性
            const isLocalhost = (hostname) => 
              hostname === 'localhost' || hostname === '127.0.0.1';
            
            if (isLocalhost(test.hostname) && isLocalhost(allowed.hostname)) {
              return test.port === allowed.port && test.protocol === allowed.protocol;
            }
            
            return false;
          });
        }
        
        function validateDomain() {
          let parentUrl = null;
          let isInIframe = window !== window.top;
          
          try {
            if (isInIframe) {
              // 尝试获取父窗口URL
              parentUrl = window.top.location.href;
              console.log('Parent URL detected:', parentUrl);
            } else {
              // 直接访问时检查当前URL
              parentUrl = window.location.href;
              console.log('Direct access URL:', parentUrl);
            }
          } catch (e) {
            // 跨域访问被阻止，尝试使用document.referrer
            if (isInIframe) {
              parentUrl = document.referrer;
              console.log('Using referrer as parent URL:', parentUrl);
            }
          }
          
          // 如果没有域名限制，允许访问
          if (allowedDomains.length === 0) {
            console.log('No domain restrictions, access allowed');
            return;
          }
          
          // 检查是否允许访问
          if (parentUrl && isAllowedDomain(parentUrl)) {
            console.log('Access granted for:', parentUrl);
            return;
          }
          
          // 如果无法确定父URL但在iframe中，且有域名限制，则拒绝访问
          if (isInIframe && !parentUrl) {
            console.log('Cannot determine parent URL, access denied');
            showAccessDenied('无法验证父窗口域名');
            return;
          }
          
          // 明确拒绝访问
          console.log('Access denied for:', parentUrl);
          showAccessDenied(parentUrl);
        }
        
        function showAccessDenied(attemptedUrl) {
          document.body.innerHTML = \`
            <div style="display: flex; justify-content: center; align-items: center; height: 100vh; font-family: Arial, sans-serif; background-color: #f7fafc;">
              <div style="text-align: center; padding: 40px; border: 2px solid #e53e3e; border-radius: 12px; background-color: #fed7d7; max-width: 700px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
                <h2 style="color: #c53030; margin-bottom: 20px; font-size: 24px;">🚫 访问被拒绝</h2>
                <p style="color: #2d3748; margin-bottom: 15px; font-size: 16px;">此 Lighthouse 报告只能从以下授权域名访问：</p>
                
                <div style="background-color: #edf2f7; padding: 20px; border-radius: 8px; margin: 20px 0; text-align: left;">
                  <h4 style="margin-top: 0; color: #2d3748; font-size: 16px;">✅ 允许的域名:</h4>
                  <ul style="color: #4a5568; margin: 10px 0; padding-left: 20px; line-height: 1.8;">
                    \${allowedDomains.map(domain => \`
                      <li style="margin: 8px 0;">
                        <code style="background-color: #e2e8f0; padding: 4px 8px; border-radius: 4px; font-size: 14px; font-family: 'Courier New', monospace;">
                          \${domain}
                        </code>
                      </li>
                    \`).join('')}
                  </ul>
                </div>
                
                \${attemptedUrl ? \`
                  <div style="background-color: #fef5e7; padding: 15px; border-radius: 8px; border-left: 4px solid #ed8936; margin: 15px 0;">
                    <p style="color: #744210; font-size: 14px; margin: 0;">
                      <strong>🔍 尝试访问的地址:</strong><br>
                      <code style="background-color: #fed7d7; padding: 2px 6px; border-radius: 4px; font-size: 12px; word-break: break-all;">
                        \${attemptedUrl}
                      </code>
                    </p>
                  </div>
                \` : ''}
                
                <div style="background-color: #e6fffa; padding: 15px; border-radius: 8px; border-left: 4px solid #38b2ac; margin: 15px 0;">
                  <p style="color: #234e52; font-size: 14px; margin: 0;">
                    <strong>💡 解决方案:</strong><br>
                    • 确保从正确的域名访问此报告<br>
                    • 检查端口号是否匹配（如 :8000）<br>
                    • 如果是开发环境，请更新 allowedDomains 配置
                  </p>
                </div>
                
                <p style="color: #718096; font-size: 12px; margin-top: 20px;">
                  如果问题持续存在，请联系系统管理员或检查域名配置。
                </p>
              </div>
            </div>
          \`;
        }
        
        // 页面加载完成后验证域名
        if (document.readyState === 'loading') {
          document.addEventListener('DOMContentLoaded', validateDomain);
        } else {
          validateDomain();
        }
        
        // 也在窗口加载完成后再次验证（确保所有资源加载完毕）
        window.addEventListener('load', validateDomain);
      })();
    </script>
  `;

  // 只添加X-Frame-Options和验证脚本，移除无效的CSP meta标签
  const securityHeaders = `
    <meta http-equiv="X-Frame-Options" content="${allowedDomains.length > 0 ? 'SAMEORIGIN' : 'DENY'}">
    ${domainValidationScript}
  `;

  return htmlContent.replace('<head>', `<head>${securityHeaders}`);
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
