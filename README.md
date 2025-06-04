# YouTube Shorts Safety Scanner Chrome Extension

A Chrome extension that helps users analyze YouTube Shorts videos for potential safety concerns by scanning comments and video content.

## Features

- Scans YouTube Shorts videos for potentially harmful content
- Analyzes video comments using AI
- Provides safety ratings and warnings
- User-friendly interface integrated into YouTube

## Setup

1. Clone this repository
2. Create a `config.js` file in the root directory with your API keys:
   ```javascript
   window.ytVideoConfig = {
     YOUTUBE_API_KEY: 'YOUR_YOUTUBE_API_KEY_HERE',
     OPENAI_API_KEY: 'YOUR_OPENAI_API_KEY_HERE',
     EMAIL_CONFIG: {
       serviceID: 'YOUR_SERVICE_ID_HERE',
       templateID: 'YOUR_TEMPLATE_ID_HERE',
       userID: 'YOUR_USER_ID_HERE',
       recipientEmail: 'your.email@example.com'
     },
     MAX_COMMENTS: 5
   };
   ```
3. Load the extension in Chrome:
   - Open Chrome and go to `chrome://extensions/`
   - Enable "Developer mode"
   - Click "Load unpacked" and select the extension directory

## Requirements

- Chrome browser
- YouTube Data API key
- OpenAI API key
- Email service configuration (for notifications)

## License

MIT License

## Author

Kushal Mukherjee 