import fs from 'fs';
import lighthouse from 'lighthouse';
import chromeLauncher from 'chrome-launcher';

/**
 * Launch Chrome and run Lighthouse audit for the given URL.
 * This function primarily targets desktop users, as most of your website's traffic is from PC.
 */
async function runLighthouseAudit(url, isMobile = false) {
  try {
    // Launch a headless Chrome instance
    const chrome = await chromeLauncher.launch({chromeFlags: ['--headless']});

    // Define Lighthouse options
    const options = {
      logLevel: 'info',                  // Log level for detailed output
      output: 'html',                    // Output format (HTML report)
      port: chrome.port,                 // The Chrome port Lighthouse will use
      formFactor: isMobile ? 'mobile' : 'desktop',  // Default to 'desktop' for PC testing
      screenEmulation: isMobile 
        ? {                               // Mobile screen emulation settings
          mobile: true,                   
          width: 360,                    
          height: 640,                   
          deviceScaleFactor: 2,           
          disabled: false
        } 
        : {                               // Desktop screen emulation settings
          mobile: false,                  
          width: 1350,                    
          height: 940,                    
          deviceScaleFactor: 1,           
          disabled: false
        }
    };

    // Run the Lighthouse audit
    const runnerResult = await lighthouse(url, options);

    // Save the HTML report to a file
    const reportHtml = runnerResult.report;
    fs.writeFileSync('lighthouse-report.html', reportHtml);

    // Log performance results for desktop (or mobile if specified)
    console.log('Lighthouse audit completed for:', runnerResult.lhr.finalDisplayedUrl);
    console.log('Performance score:', runnerResult.lhr.categories.performance.score * 100);

    // Close Chrome instance
    await chrome.kill();

  } catch (error) {
    // Handle errors that occur during Lighthouse execution
    console.error('Error during Lighthouse audit:', error);
  }
}

// Run audit for your personal website, defaulting to desktop test
runLighthouseAudit('https://miever.net');  // 'isMobile' is false by default, so it targets desktop