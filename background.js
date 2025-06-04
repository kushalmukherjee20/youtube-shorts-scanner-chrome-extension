// Background script for YouTube Shorts Safety Scanner

// Listen for messages from content script
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  if (request.action === 'sendEmail') {
    (async () => {
      try {
        const emailConfig = request.emailConfig;
        if (!emailConfig) {
          throw new Error('EmailJS configuration missing');
        }
        await sendEmail(request.emailData, emailConfig);
        sendResponse({ success: true });
      } catch (error) {
        console.error('Error sending email:', error);
        sendResponse({ success: false, error: error.message || error.toString() });
      }
    })();
    return true;
  }
});

// Function to send email using EmailJS REST API
async function sendEmail(emailData, emailConfig) {
  try {
    const templateParams = {
      video_title: emailData.video_title,
      video_url: emailData.video_url,
      safety_rating: emailData.safety_rating,
      analysis: emailData.analysis
    };
    const response = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        service_id: emailConfig.serviceID,
        template_id: emailConfig.templateID,
        user_id: emailConfig.userID,
        template_params: templateParams
      })
    });
    if (!response.ok) {
      const errorData = await response.text();
      console.error('EmailJS API error response:', errorData);
      throw new Error(`EmailJS API error: ${response.status} - ${errorData}`);
    }
  } catch (error) {
    console.error('Error in sendEmail:', error);
    throw error;
  }
}

// Helper function to load external scripts
function loadScript(src) {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = src;
    script.onload = resolve;
    script.onerror = reject;
    document.head.appendChild(script);
  });
} 