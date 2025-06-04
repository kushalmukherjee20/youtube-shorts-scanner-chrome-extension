// Popup script for YouTube Shorts Safety Scanner

document.addEventListener('DOMContentLoaded', () => {
  loadVideoInfo();
  
  // Listen for real-time updates from content script
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'videoInfoUpdated') {
      updateVideoInfo(request.data);
    }
  });
});

// Load video information from the content script
function loadVideoInfo() {
  chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
    if (!tabs || !tabs[0]) return;
    chrome.tabs.sendMessage(tabs[0].id, { action: 'getVideoInfo' }, function (response) {
      if (chrome.runtime.lastError) {
        showError('Unable to communicate with the content script.');
        return;
      }
      if (response && response.error) {
        showError(response.error);
        return;
      }
      updateVideoInfo(response);
    });
  });
}

// Update the popup UI with video information
function updateVideoInfo(data) {
  document.getElementById('title').textContent = data.title || '';
  document.getElementById('description').textContent = data.description || '';
  updateSection('comments', data.comments, 'No comments available.');
  updateSection('transcript', data.transcript, 'No transcript available.', true);
  updateScreenshots(data.screenshots);
  document.getElementById('lastUpdated').textContent = data.lastUpdated || '';
  if (data.contentAnalysis) {
    updateContentAnalysis(data.contentAnalysis);
  }
}

// Update comments or transcript section
function updateSection(sectionId, items, emptyMsg, isTranscript) {
  const container = document.getElementById(sectionId);
  if (!container) return;
  if (!items || items.length === 0) {
    container.innerHTML = `<div class="empty">${emptyMsg}</div>`;
    return;
  }
  if (isTranscript) {
    container.innerHTML = items.map(item => `<div><span class="timestamp">[${item.timestamp}s]</span> ${item.text}</div>`).join('');
  } else {
    container.innerHTML = items.map(item => `<div>${item}</div>`).join('');
  }
}

// Update screenshots section
function updateScreenshots(screenshots) {
  const container = document.getElementById('screenshotsContainer');
  if (!container) return;
  if (!screenshots || screenshots.length === 0) {
    container.innerHTML = '<div class="empty">No screenshots available.</div>';
    return;
  }
  container.innerHTML = screenshots.map(s =>
    `<div class="screenshot-item"><img src="${s.dataUrl}" alt="Screenshot"><div class="screenshot-timestamp">${Math.round(s.timestamp)}s</div></div>`
  ).join('');
}

// Update content analysis section
function updateContentAnalysis(analysis) {
  const container = document.getElementById('contentAnalysis');
  if (!container) return;
  let html = '';
  if (analysis.safetyRating) {
    html += `<div class="safety-rating">Safety Rating: <strong>${analysis.safetyRating}</strong></div>`;
  }
  if (analysis.explanation) {
    html += `<div class="explanation">${analysis.explanation.replace(/\n/g, '<br>')}</div>`;
  }
  container.innerHTML = html;
  container.className = 'content-analysis ' + (analysis.safetyRating ? analysis.safetyRating.toLowerCase() : '');
}

// Show error message in the popup
function showError(msg) {
  document.getElementById('main').innerHTML = `<div class="error">${msg}</div>`;
} 