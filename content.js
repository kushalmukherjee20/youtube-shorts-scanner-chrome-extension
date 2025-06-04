// Content script for YouTube Shorts Safety Scanner

// Track the last processed URL for Shorts
let lastProcessedUrl = window.location.href;
let lastProcessedTime = Date.now();
const DEBOUNCE_TIME = 100;

// Check if URL has changed
function hasUrlChanged() {
  const currentUrl = window.location.href;
  const currentTime = Date.now();
  if (currentUrl !== lastProcessedUrl) {
    if (currentTime - lastProcessedTime > DEBOUNCE_TIME) {
      lastProcessedUrl = currentUrl;
      lastProcessedTime = currentTime;
      return true;
    }
  }
  return false;
}

// Cache for video info
let cachedVideoInfo = null;
let lastCacheTime = 0;
const CACHE_DURATION = 5 * 60 * 1000;

function isCacheValid() {
  if (!cachedVideoInfo) return false;
  const currentTime = Date.now();
  const cacheAge = currentTime - lastCacheTime;
  return cacheAge < CACHE_DURATION;
}

// Notify popup of content update
function notifyPopupUpdate(videoInfo) {
  try {
    if (!videoInfo) return;
    if (!chrome.runtime?.id) return;
    const essentialInfo = {
      title: videoInfo.title || 'Unknown Title',
      description: videoInfo.description || 'No description available',
      contentAnalysis: videoInfo.contentAnalysis || null,
      comments: videoInfo.comments || [],
      transcript: videoInfo.transcript || [],
      screenshots: (videoInfo.screenshots || []).slice(0, 3),
      lastUpdated: new Date().toLocaleTimeString(),
      isFromCache: isCacheValid()
    };
    chrome.runtime.sendMessage({
      action: 'videoInfoUpdated',
      data: essentialInfo
    });
  } catch (error) {
    console.error('Error in notifyPopupUpdate:', error);
  }
}

// Listen for messages from the popup
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  if (request.action === 'getVideoInfo') {
    if (!window.location.pathname.includes('/shorts/')) {
      sendResponse({
        error: 'This extension is designed specifically for YouTube Shorts. Please navigate to a Shorts video to use this extension.',
        isRegularVideo: true
      });
      return true;
    }
    getVideoInformation()
      .then(response => sendResponse(response))
      .catch(error => sendResponse({ error: 'Error fetching video information: ' + error.message }));
    return true;
  }
});

// YouTube Data API key
const YOUTUBE_API_KEY = window.ytVideoConfig?.YOUTUBE_API_KEY || '';

// Fetch video details from YouTube Data API
async function fetchVideoDetails(videoId) {
  try {
    const response = await fetch(
      `https://www.googleapis.com/youtube/v3/videos?part=snippet,contentDetails&id=${videoId}&key=${YOUTUBE_API_KEY}`
    );
    if (!response.ok) throw new Error(`API request failed with status ${response.status}`);
    const data = await response.json();
    if (!data.items || data.items.length === 0) return null;
    const duration = data.items[0]?.contentDetails?.duration;
    let durationInSeconds = 0;
    if (duration) {
      const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
      if (match) {
        const hours = parseInt(match[1] || 0);
        const minutes = parseInt(match[2] || 0);
        const seconds = parseInt(match[3] || 0);
        durationInSeconds = hours * 3600 + minutes * 60 + seconds;
      }
    }
    return {
      snippet: data.items[0]?.snippet || null,
      duration: durationInSeconds
    };
  } catch (error) {
    console.error('Error fetching video details:', error);
    return null;
  }
}

// Fetch comments from YouTube Data API
async function fetchVideoComments(videoId, maxComments = 5) {
  try {
    const response = await fetch(
      `https://www.googleapis.com/youtube/v3/commentThreads?part=snippet&videoId=${videoId}&maxResults=${maxComments}&key=${YOUTUBE_API_KEY}`
    );
    if (!response.ok) throw new Error(`API request failed with status ${response.status}`);
    const data = await response.json();
    if (!data.items) return [];
    return data.items.map(item => item.snippet.topLevelComment.snippet.textDisplay);
  } catch (error) {
    console.error('Error fetching comments:', error);
    return [];
  }
}

// Extract Shorts metadata from DOM or page source
async function getShortsMetadata() {
  try {
    const selectors = {
      title: [
        'ytd-reel-video-renderer h2',
        'ytd-reel-video-renderer #title',
        'ytd-reel-video-renderer yt-formatted-string#title',
        'ytd-reel-video-renderer #video-title',
        '#title h1',
        '#title yt-formatted-string',
        'h1.title',
        'ytd-shorts yt-formatted-string#video-title',
        'ytd-shorts h2',
        'ytd-shorts #title',
        'ytd-shorts yt-formatted-string.ytd-reel-video-renderer',
        'ytd-reel-video-renderer[is-active] h2',
        'ytd-reel-video-renderer[is-active] #title',
        'ytd-reel-video-renderer[is-active] yt-formatted-string#title'
      ],
      description: [
        'ytd-reel-video-renderer yt-formatted-string#description',
        'ytd-reel-video-renderer #description',
        'ytd-reel-video-renderer yt-formatted-string',
        '#description',
        '#description-inline-expander',
        'ytd-expander#description',
        'ytd-shorts yt-formatted-string#description',
        'ytd-shorts #description',
        'ytd-shorts yt-formatted-string.ytd-reel-video-renderer',
        'ytd-reel-video-renderer[is-active] yt-formatted-string#description',
        'ytd-reel-video-renderer[is-active] #description',
        'ytd-reel-video-renderer[is-active] yt-formatted-string'
      ]
    };
    let title = '';
    let description = '';
    for (const selector of selectors.title) {
      const elements = document.querySelectorAll(selector);
      if (elements.length > 0) {
        title = elements[0].textContent.trim();
        break;
      }
    }
    for (const selector of selectors.description) {
      const elements = document.querySelectorAll(selector);
      if (elements.length > 0) {
        description = elements[0].textContent.trim();
        break;
      }
    }
    if (!title || !description) {
      const pageSource = document.documentElement.innerHTML;
      const titlePatterns = [
        /"title":"([^"]+)"/,
        /"videoTitle":"([^"]+)"/,
        /<title>([^<]+)<\/title>/,
        /"text":"([^"]+)"[^}]*"runs":\[[^\]]*"navigationEndpoint"[^}]*"videoId"/
      ];
      const descPatterns = [
        /"description":"([^"]+)"/,
        /"videoDescription":"([^"]+)"/,
        /"descriptionText":"([^"]+)"/,
        /"descriptionText":\{"simpleText":"([^"]+)"\}/
      ];
      for (const pattern of titlePatterns) {
        const match = pageSource.match(pattern);
        if (match) {
          title = match[1].replace(/\\"/g, '"').replace(/\\u([0-9a-fA-F]{4})/g, (_, code) => String.fromCharCode(parseInt(code, 16)));
          break;
        }
      }
      for (const pattern of descPatterns) {
        const match = pageSource.match(pattern);
        if (match) {
          description = match[1].replace(/\\"/g, '"').replace(/\\u([0-9a-fA-F]{4})/g, (_, code) => String.fromCharCode(parseInt(code, 16)));
          break;
        }
      }
    }
    if (!description) {
      const shortsDescription = document.querySelector('ytd-shorts yt-formatted-string.ytd-reel-video-renderer');
      if (shortsDescription) {
        description = shortsDescription.textContent.trim();
      }
    }
    if (!description) {
      const activeReel = document.querySelector('ytd-reel-video-renderer[is-active]');
      if (activeReel) {
        const descElement = activeReel.querySelector('yt-formatted-string');
        if (descElement) {
          description = descElement.textContent.trim();
        }
      }
    }
    return {
      title: title || 'Unknown Title',
      description: description || 'No description available'
    };
  } catch (error) {
    console.error('Error getting Shorts metadata:', error);
    return { title: 'Unknown Title', description: 'No description available' };
  }
}

// Capture screenshots at specific timestamps
async function captureVideoScreenshots(timestamps) {
  const videoElement = document.querySelector('video') || 
                      document.querySelector('ytd-reel-video-renderer video') ||
                      document.querySelector('ytd-shorts video') ||
                      document.querySelector('ytd-reel-video-renderer[is-active] video');
  if (!videoElement) return [];
  const screenshots = [];
  const originalTime = videoElement.currentTime;
  const originalPlaybackRate = videoElement.playbackRate;
  const originalPaused = videoElement.paused;
  try {
    const wasPaused = videoElement.paused;
    const currentTime = videoElement.currentTime;
    const currentRate = videoElement.playbackRate;
    if (wasPaused) {
      try { await videoElement.play(); } catch (error) {}
    }
    videoElement.playbackRate = 1;
    for (const time of timestamps) {
      try {
        videoElement.currentTime = time;
        await Promise.race([
          new Promise(resolve => {
            const timeout = setTimeout(resolve, 1000);
            videoElement.addEventListener('seeked', () => clearTimeout(timeout) || resolve(), { once: true });
          }),
          new Promise(resolve => setTimeout(resolve, 1000))
        ]);
        await new Promise(resolve => setTimeout(resolve, 100));
        const canvas = document.createElement('canvas');
        canvas.width = videoElement.videoWidth || 1280;
        canvas.height = videoElement.videoHeight || 720;
        const ctx = canvas.getContext('2d');
        if (videoElement.readyState >= 2) {
          ctx.drawImage(videoElement, 0, 0, canvas.width, canvas.height);
          screenshots.push({
            timestamp: time,
            dataUrl: canvas.toDataURL('image/jpeg', 0.8)
          });
        }
        await new Promise(resolve => setTimeout(resolve, 50));
      } catch (error) {
        continue;
      }
    }
    try {
      videoElement.currentTime = currentTime;
      videoElement.playbackRate = currentRate;
      if (wasPaused) videoElement.pause();
    } catch (error) {}
  } catch (error) {
    console.error('Error in screenshot capture:', error.message);
  }
  return screenshots;
}

// Send email notification for unsafe content
async function sendEmailNotification(videoInfo, analysis) {
  try {
    const emailConfig = window.ytVideoConfig?.EMAIL_CONFIG;
    if (!emailConfig?.userID || !emailConfig?.serviceID || !emailConfig?.templateID) {
      console.error('EmailJS configuration missing');
      return;
    }
    const emailContent = {
      to: emailConfig.recipientEmail,
      video_title: videoInfo.title,
      video_url: videoInfo.url,
      safety_rating: analysis.safetyRating,
      analysis: analysis.explanation
    };
    chrome.runtime.sendMessage({
      action: 'sendEmail',
      emailData: emailContent,
      emailConfig: emailConfig
    }, function(response) {
      if (chrome.runtime.lastError) {
        console.error('Error sending email:', chrome.runtime.lastError);
      }
    });
  } catch (error) {
    console.error('Error in sendEmailNotification:', error);
  }
}

// Analyze video content for child safety
async function analyzeVideoContent(videoInfo) {
  try {
    const screenshots = videoInfo.screenshots.slice(0, 3).map(s => s.dataUrl);
    const prompt = `Analyze this YouTube Shorts video content for child safety (age < 10). Consider:\n1. Visual content (from screenshots)\n2. Title and description\n3. Transcript content\n4. Overall theme and messaging\n\nProvide a safety rating (SAFE, CAUTION, or UNSAFE) and a brief explanation.\nFocus on:\n- Violence or scary content. Any mention of gun, knife, sword, death, blood, etc. should not be allowed for children\n- Inappropriate language. Any mention or depiction of sex, drugs, alcohol, gun, death, knife, mafia, etc. should not be allowed for children\n- Adult themes. Any mention of adult themes, pornography, nudity, intimacy, etc. in text and images should not be allowed for children\n- Any depiction of accident, accidental death, road rage, argument, fight, etc. should not be allowed for children\n- Any depiction of dangerous stunt should not be allowed for children\n- Educational value. Check if the content has any educational value\n- Age-appropriate messaging. Any mention of age-appropriate messaging, etc. should not be allowed for children\n\nOutput Format:\n- Keep your response very brief and concise.\n- Provide only 2-3 key reasons for your safety analysis in a bulleted list.\n- At the top, provide a one-sentence summary of your decision.\n\nIMPORTANT: \n1. End your response with a clear "SAFETY RATING: X" where X is either SAFE, CAUTION, or UNSAFE.\n2. Keep your explanation very brief and to the point.\n3. Do not exceed 3 bullet points in your explanation.`;
    const messages = [
      {
        role: "user",
        content: [
          { type: "text", text: prompt },
          ...screenshots.map(url => ({ type: "image_url", image_url: { url } }))
        ]
      }
    ];
    messages[0].content.push(
      { type: "text", text: `Title: ${videoInfo.title}` },
      { type: "text", text: `Description: ${videoInfo.description}` }
    );
    if (videoInfo.transcript) {
      messages[0].content.push({
        type: "text",
        text: `Transcript: ${videoInfo.transcript.map(t => t.text).join(' ')}`
      });
    }
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${window.ytVideoConfig?.OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: "gpt-4.1",
        messages: messages,
        max_tokens: 2000,
        temperature: 0,
        presence_penalty: 0.2,
        frequency_penalty: 0.3
      })
    });
    if (!response.ok) {
      throw new Error(`API request failed with status ${response.status}`);
    }
    const data = await response.json();
    const analysis = data.choices[0].message.content;
    const safetyRatingMatch = analysis.match(/SAFETY RATING:\s*(SAFE|CAUTION|UNSAFE)/i);
    const safetyRating = safetyRatingMatch ? safetyRatingMatch[1].toUpperCase() : 'UNKNOWN';
    const explanation = analysis.split(/SAFETY RATING:\s*(?:SAFE|CAUTION|UNSAFE)/i)[0].trim();
    if (safetyRating === 'UNSAFE') {
      await sendEmailNotification(videoInfo, {
        safetyRating,
        explanation,
        fullAnalysis: analysis
      });
    }
    return {
      safetyRating,
      explanation,
      fullAnalysis: analysis
    };
  } catch (error) {
    console.error('Error analyzing video content:', error);
    return {
      safetyRating: 'ERROR',
      explanation: 'Unable to analyze content at this time.',
      fullAnalysis: null
    };
  }
}

// Get video information and analyze content
async function getVideoInformation() {
  if (!window.location.pathname.includes('/shorts/')) {
    throw new Error('This extension is designed specifically for YouTube Shorts');
  }
  if (hasUrlChanged()) {
    cachedVideoInfo = null;
    lastCacheTime = 0;
  } else if (isCacheValid()) {
    return cachedVideoInfo;
  }
  try {
    const videoId = getVideoId(window.location.href);
    if (!videoId) {
      throw new Error('Could not extract video ID');
    }
    const currentUrl = window.location.href;
    let title = '';
    let description = '';
    let comments = [];
    let duration = 60;
    const [apiData, apiComments] = await Promise.all([
      fetchVideoDetails(videoId),
      fetchVideoComments(videoId, window.ytVideoConfig?.MAX_COMMENTS || 5)
    ]);
    if (apiData?.snippet) {
      title = apiData.snippet.title;
      description = apiData.snippet.description;
    }
    if (apiData?.duration) {
      duration = apiData.duration;
    }
    if (apiComments && apiComments.length > 0) {
      comments = apiComments;
    }
    if (!title || !description) {
      const shortsMetadata = await getShortsMetadata();
      title = title || shortsMetadata.title;
      description = description || shortsMetadata.description;
    }
    if (comments.length === 0) {
      const commentElements = document.querySelectorAll('ytd-comment-renderer');
      comments = Array.from(commentElements).map(comment => {
        const textElement = comment.querySelector('#content-text');
        return textElement ? textElement.textContent.trim() : '';
      }).filter(text => text);
    }
    const timestamps = [];
    for (let i = 0; i < 5; i++) {
      timestamps.push((duration * i) / 4);
    }
    const [transcript, screenshots] = await Promise.all([
      getTranscript(),
      captureVideoScreenshots(timestamps)
    ]);
    const contentAnalysis = await analyzeVideoContent({
      title,
      description,
      transcript,
      screenshots,
      url: currentUrl
    });
    cachedVideoInfo = {
      title: title || 'Unknown Title',
      description: description || 'No description available',
      comments: comments || [],
      transcript: transcript || null,
      screenshots: screenshots || [],
      videoId: videoId,
      url: currentUrl,
      isShorts: true,
      contentAnalysis: contentAnalysis
    };
    lastCacheTime = Date.now();
    notifyPopupUpdate(cachedVideoInfo);
    return cachedVideoInfo;
  } catch (error) {
    console.error('Error in getVideoInformation:', error);
    throw error;
  }
}

// Get transcript from YouTube's internal player response
async function getTranscript() {
  try {
    const response = await fetch(window.location.href);
    const html = await response.text();
    const match = html.match(/ytInitialPlayerResponse\s*=\s*({.+?})\s*;\s*(?:var\s+(?:meta|head)|<\/script|\n)/);
    if (!match) return null;
    const playerResponse = JSON.parse(match[1]);
    const tracks = playerResponse.captions?.playerCaptionsTracklistRenderer?.captionTracks;
    if (!tracks || tracks.length === 0) return null;
    const track = tracks.find(t => t.languageCode === 'en') || tracks[0];
    const transcriptResponse = await fetch(track.baseUrl + '&fmt=json3');
    const transcriptData = await transcriptResponse.json();
    return transcriptData.events
      .filter(event => event.segs)
      .map(event => ({
        timestamp: Math.floor(event.tStartMs / 1000),
        text: event.segs.map(seg => seg.utf8).join(' ').trim()
      }))
      .filter(segment => segment.text);
  } catch (error) {
    return null;
  }
}

// Extract video ID from URL
function getVideoId(url) {
  try {
    if (url.includes('/shorts/')) {
      const shortsId = url.split('/shorts/')[1].split('?')[0];
      return shortsId;
    }
    const urlParams = new URLSearchParams(new URL(url).search);
    const videoId = urlParams.get('v');
    return videoId;
  } catch (error) {
    return null;
  }
}

// MutationObserver config for URL changes
const observerConfig = {
  subtree: true,
  childList: true,
  attributes: true,
  attributeFilter: ['href', 'src']
};

// Observe URL changes for Shorts
const observer = new MutationObserver((mutations) => {
  if (!window.location.pathname.includes('/shorts/')) return;
  const hasRelevantMutation = mutations.some(mutation => {
    return mutation.type === 'attributes' || 
           (mutation.type === 'childList' && mutation.addedNodes.length > 0);
  });
  if (hasRelevantMutation) {
    handleUrlChange();
  }
});
observer.observe(document, observerConfig);

// Debounce URL change handler
const debouncedHandleUrlChange = debounce(handleUrlChange, DEBOUNCE_TIME);
window.addEventListener('popstate', debouncedHandleUrlChange);
window.addEventListener('yt-navigate-finish', debouncedHandleUrlChange);
window.addEventListener('yt-page-data-updated', debouncedHandleUrlChange);

function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

// Handle URL changes and update content
async function handleUrlChange() {
  if (hasUrlChanged()) {
    try {
      cachedVideoInfo = null;
      lastCacheTime = 0;
      const newInfo = await getVideoInformation();
      if (!newInfo.comments || newInfo.comments.length === 0) {
        const videoId = getVideoId(window.location.href);
        newInfo.comments = await fetchVideoComments(videoId, window.ytVideoConfig?.MAX_COMMENTS || 5);
      }
      if (!newInfo.transcript || newInfo.transcript.length === 0) {
        newInfo.transcript = await getTranscript();
      }
      cachedVideoInfo = newInfo;
      lastCacheTime = Date.now();
      notifyPopupUpdate(newInfo);
    } catch (error) {
      // Only log critical errors
      console.error('Error updating content:', error);
    }
  }
} 