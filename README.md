# YouTube Shorts Safety Scanner Chrome Extension

A Chrome extension that helps users analyze YouTube Shorts videos for potential safety concerns by scanning comments and video content.

## Features

- Scans YouTube Shorts videos for potentially harmful content
- Analyzes video comments using AI
- Provides safety ratings and warnings
- User-friendly interface integrated into YouTube
- Real-time email alerts for potentially unsafe content
- Automatic screenshot capture and analysis
- Detailed safety ratings and explanations

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

### Setting up EmailJS

1. Create an account at [EmailJS](https://www.emailjs.com/)
2. Create an email service (Gmail, Outlook, etc.)
3. Create an email template with the following variables:
   - `video_title`
   - `video_url`
   - `safety_rating`
   - `analysis`

   Here's a sample template you can use:
   ```
   Subject: Your Child's Screen Just Crossed a Line

   Dear [Parent's name],

   Your child just viewed a YouTube Short that raised a red flag.

   🔍 Video Title: {{video_title}}
   🔗 Watch it here: {{video_url}}
   🔒 Safety Rating: {{safety_rating}}

   Our Analysis:
   {{analysis}}

   Best Regards,
   YouTube Shorts Safety Scanner
   ```

4. Note down your Service ID, Template ID, and User ID
5. Update the `EMAIL_CONFIG` in `config.js` with these values

3. Load the extension in Chrome:
   - Open Chrome and go to `chrome://extensions/`
   - Enable "Developer mode"
   - Click "Load unpacked" and select the extension directory

## Usage

1. Navigate to any YouTube Shorts video
2. Click the extension icon in your Chrome toolbar
3. The extension will automatically:
   - Analyze the current video
   - Capture and analyze screenshots
   - Display safety information in the popup
   - Send email alerts if unsafe content is detected

## Email Alerts

The extension sends real-time email alerts when:
- Potentially unsafe content is detected
- The safety rating falls below acceptable thresholds
- Age-restricted content is identified

Each email includes:
- Video title and URL
- Safety rating
- Detailed analysis of concerns
- Timestamps of potentially problematic content

## Requirements

- Chrome browser
- YouTube Data API key
- OpenAI API key
- Email service configuration (for notifications)

## Limitations

- Currently only works with YouTube Shorts videos
- Requires active internet connection
- Depends on API rate limits of YouTube Data API and OpenAI
- Email alerts require valid EmailJS configuration

## Contributing

Feel free to submit issues and enhancement requests! When contributing:
1. Fork the repository
2. Create a feature branch
3. Submit a pull request

## License

MIT License

## Author

Kushal Mukherjee 