import fs from 'fs';
import lighthouse from 'lighthouse';
import chromeLauncher from 'chrome-launcher';

/**
 * Launch Chrome and run Lighthouse audit for the given URL.
 * This function simulates network conditions similar to developed countries' broadband speed.
 */
async function runLighthouseAudit(url) {
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
    const reportHtml = runnerResult.report;
    let darkModeReport = reportHtml;
  
    // Inject JavaScript code into HTML
    const customScript = `
      <script>
        (function() {
          function addLhDarkClass() {
            const article = document.querySelector('article');
            if (article && !article.classList.contains('lh-dark')) {
              article.classList.add('lh-dark');
              return true;
            }
            return false;
          }
          
          if (addLhDarkClass()) return;
          
          const observer = new MutationObserver(function(mutations) {
            if (addLhDarkClass()) {
              observer.disconnect();
            }
          });
          
          observer.observe(document.documentElement, {
            childList: true,
            subtree: true
          });
          
          const timeouts = [0, 100, 500, 1000];
          timeouts.forEach(delay => {
            setTimeout(() => {
              if (addLhDarkClass()) {
                observer.disconnect();
              }
            }, delay);
          });
        })();
      </script>
    `;

    // Insert script into HTML head section
    darkModeReport = reportHtml.replace('</head>', customScript + '</head>');
    
    fs.writeFileSync('lighthouse-report.html', reportHtml);
    fs.writeFileSync('lighthouse-dark-report.html', darkModeReport);

    // Close Chrome instance
    await chrome.kill();

  } catch (error) {
    // Handle errors that occur during Lighthouse execution
    console.error('Error during Lighthouse audit:', error);
  }
}

// Run audit for your personal website with broadband network conditions
runLighthouseAudit('https://miever.net');