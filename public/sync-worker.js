/**
 * BAGJA EXAM - Web Worker for Background Token & Integrity Heartbeat Sync
 * Runs off main thread to guarantee 0-jank at 60 FPS in ExamPlayerPage
 */

let timerId = null;
let currentConfig = null;

self.onmessage = function (e) {
  const { action, payload } = e.data;

  if (action === 'START_SYNC') {
    currentConfig = payload;
    if (timerId) clearInterval(timerId);

    // Initial tick
    tickSync();

    // Poll every 2500ms
    timerId = setInterval(tickSync, 2500);
  } else if (action === 'STOP_SYNC') {
    if (timerId) {
      clearInterval(timerId);
      timerId = null;
    }
  } else if (action === 'UPDATE_PAYLOAD') {
    currentConfig = { ...currentConfig, ...payload };
  }
};

async function tickSync() {
  if (!currentConfig || !currentConfig.noPeserta) return;

  try {
    const url = `/api/heartbeat?_t=${Date.now()}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store, no-cache, must-revalidate',
        'Pragma': 'no-cache'
      },
      body: JSON.stringify({
        noPeserta: currentConfig.noPeserta,
        status: currentConfig.status,
        deviceType: currentConfig.deviceType,
        answersSummary: currentConfig.answersSummary
      })
    });

    if (response.ok) {
      const data = await response.json();
      self.postMessage({
        type: 'SYNC_SUCCESS',
        data
      });
    } else {
      self.postMessage({
        type: 'SYNC_ERROR',
        error: 'Heartbeat response status ' + response.status
      });
    }
  } catch (err) {
    self.postMessage({
      type: 'SYNC_OFFLINE',
      error: err.message
    });
  }
}
