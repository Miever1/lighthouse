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

    // Save the HTML report to a file
    const reportHtml = runnerResult.report;
    fs.writeFileSync('lighthouse-dark-report.html', reportHtml);

    // Log performance results for desktop
    console.log('Lighthouse audit completed for:', runnerResult.lhr.finalDisplayedUrl);
    console.log('Performance score:', runnerResult.lhr.categories.performance.score * 100);

    // Close Chrome instance
    await chrome.kill();

  } catch (error) {
    // Handle errors that occur during Lighthouse execution
    console.error('Error during Lighthouse audit:', error);
  }
}

// Run audit for your personal website with broadband network conditions
runLighthouseAudit('https://miever.net');