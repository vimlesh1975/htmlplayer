/**
 * STUDIO CONTROL & FABRIC DESIGN STUDIO SCRIPT
 * Interactive Fabric.js Canvas Editor & Live Broadcast Playout Controller.
 * Perfectly tuned for 1920 x 1080 Broadcast Output.
 */

(function () {
  'use strict';

  let ws = null;
  let canvas = null;
  let activeObject = null;

  let state = {
    activeMode: 'fabric',
    status: 'playing',
    backgroundColor: 'transparent',
    fabricDesign: null
  };

  // DOM Handles
  const statusContainer = document.getElementById('connection-status');
  const statusText = statusContainer.querySelector('.status-text');
  const wrapper = document.querySelector('.canvas-viewport-wrapper');

  // Inspector Elements
  const selectedTypeTag = document.getElementById('selected-obj-type');
  const inspText = document.getElementById('insp-text');
  const inspFontSize = document.getElementById('insp-font-size');
  const inspFontFamily = document.getElementById('insp-font-family');
  const inspColor = document.getElementById('insp-color');
  const inspBgColor = document.getElementById('insp-bg-color');
  const inspOpacity = document.getElementById('insp-opacity');

  // Buttons
  const btnPushDesign = document.getElementById('btn-push-design');
  const btnStop = document.getElementById('btn-stop');
  const btnClear = document.getElementById('btn-clear');

  // Initialize Fabric Interactive Canvas (Strict 1920 x 1080)
  function initFabricCanvas() {
    canvas = new fabric.Canvas('design-canvas', {
      width: 1920,
      height: 1080,
      preserveObjectStacking: true,
      selection: true
    });

    scaleCanvasViewport();
    window.addEventListener('resize', scaleCanvasViewport);

    // Canvas Selection Listeners
    canvas.on('selection:created', onObjectSelected);
    canvas.on('selection:updated', onObjectSelected);
    canvas.on('selection:cleared', onSelectionCleared);
    canvas.on('object:modified', onObjectModified);

    // Load initial 1920x1080 sample lower third preset into canvas
    loadPresetLowerThird();
  }

  // Scale Canvas Viewport Container to Maintain 16:9 Aspect Ratio (1920x1080)
  function scaleCanvasViewport() {
    if (!wrapper || !canvas) return;
    const containerWidth = wrapper.clientWidth;
    const scale = containerWidth / 1920;
    const targetHeight = Math.round(containerWidth * (1080 / 1920));

    wrapper.style.height = targetHeight + 'px';

    const containerEl = wrapper.querySelector('.canvas-container');
    if (containerEl) {
      containerEl.style.transform = `scale(${scale})`;
      containerEl.style.transformOrigin = '0 0';
    }
  }

  // Handle Object Selection
  function onObjectSelected(e) {
    activeObject = canvas.getActiveObject();
    if (!activeObject) {
      onSelectionCleared();
      return;
    }

    selectedTypeTag.textContent = activeObject.type ? activeObject.type.toUpperCase() : 'OBJECT';

    if (activeObject.type === 'i-text' || activeObject.type === 'text' || activeObject.type === 'textbox') {
      inspText.value = activeObject.text || '';
      inspFontSize.value = activeObject.fontSize || 32;
      inspFontFamily.value = activeObject.fontFamily || 'Outfit';
      inspColor.value = activeObject.fill || '#ffffff';
      document.getElementById('grp-text-content').style.display = 'flex';
    } else {
      inspText.value = '';
      document.getElementById('grp-text-content').style.display = 'none';
      if (activeObject.fill && typeof activeObject.fill === 'string') {
        inspColor.value = activeObject.fill;
      }
    }

    if (activeObject.backgroundColor && typeof activeObject.backgroundColor === 'string') {
      inspBgColor.value = activeObject.backgroundColor;
    }

    inspOpacity.value = activeObject.opacity || 1;
  }

  function onSelectionCleared() {
    activeObject = null;
    selectedTypeTag.textContent = 'No Object Selected';
    inspText.value = '';
    document.getElementById('grp-text-content').style.display = 'flex';
  }

  function onObjectModified() {
    // Canvas updated
  }

  // Inspector Input Event Listeners
  inspText.addEventListener('input', (e) => {
    if (activeObject && (activeObject.type === 'i-text' || activeObject.type === 'textbox')) {
      activeObject.set('text', e.target.value);
      canvas.renderAll();
    }
  });

  inspFontSize.addEventListener('input', (e) => {
    if (activeObject && activeObject.set) {
      activeObject.set('fontSize', parseInt(e.target.value, 10));
      canvas.renderAll();
    }
  });

  inspFontFamily.addEventListener('change', (e) => {
    if (activeObject && activeObject.set) {
      activeObject.set('fontFamily', e.target.value);
      canvas.renderAll();
    }
  });

  inspColor.addEventListener('input', (e) => {
    if (activeObject && activeObject.set) {
      activeObject.set('fill', e.target.value);
      canvas.renderAll();
    }
  });

  inspBgColor.addEventListener('input', (e) => {
    if (activeObject && activeObject.set) {
      activeObject.set('backgroundColor', e.target.value);
      canvas.renderAll();
    }
  });

  inspOpacity.addEventListener('input', (e) => {
    if (activeObject && activeObject.set) {
      activeObject.set('opacity', parseFloat(e.target.value));
      canvas.renderAll();
    }
  });

  // Layer Ordering & Action Controls
  document.getElementById('btn-layer-up').addEventListener('click', () => {
    if (activeObject) {
      canvas.bringForward(activeObject);
      canvas.renderAll();
    }
  });

  document.getElementById('btn-layer-down').addEventListener('click', () => {
    if (activeObject) {
      canvas.sendBackwards(activeObject);
      canvas.renderAll();
    }
  });

  document.getElementById('btn-delete-obj').addEventListener('click', () => {
    if (activeObject) {
      canvas.remove(activeObject);
      canvas.discardActiveObject();
      canvas.renderAll();
      onSelectionCleared();
    }
  });

  document.getElementById('btn-clear-canvas').addEventListener('click', () => {
    canvas.clear();
    onSelectionCleared();
  });

  // Designer Tools Event Listeners (Precise 1920x1080 Title Safe Coordinates)
  document.getElementById('tool-add-headline').addEventListener('click', () => {
    const text = new fabric.IText('LIVE BROADCAST HEADLINE', {
      left: 140,
      top: 860,
      fontFamily: 'Outfit',
      fontSize: 44,
      fontWeight: '800',
      fill: '#ffffff'
    });
    canvas.add(text);
    canvas.setActiveObject(text);
    canvas.renderAll();
  });

  document.getElementById('tool-add-subtitle').addEventListener('click', () => {
    const text = new fabric.IText('Renders 1080i50 offscreen frames to DeckLink SDI output', {
      left: 140,
      top: 920,
      fontFamily: 'Inter',
      fontSize: 22,
      fontWeight: '500',
      fill: '#94a3b8'
    });
    canvas.add(text);
    canvas.setActiveObject(text);
    canvas.renderAll();
  });

  document.getElementById('tool-add-badge').addEventListener('click', () => {
    const text = new fabric.IText(' BREAKING NEWS ', {
      left: 140,
      top: 800,
      fontFamily: 'Outfit',
      fontSize: 18,
      fontWeight: '800',
      fill: '#ffffff',
      backgroundColor: '#ef4444',
      padding: 6
    });
    canvas.add(text);
    canvas.setActiveObject(text);
    canvas.renderAll();
  });

  document.getElementById('tool-add-box').addEventListener('click', () => {
    const rect = new fabric.Rect({
      left: 100,
      top: 840,
      width: 920,
      height: 140,
      fill: 'rgba(15, 23, 42, 0.94)',
      stroke: 'rgba(255, 255, 255, 0.15)',
      strokeWidth: 2,
      rx: 12,
      ry: 12
    });
    canvas.add(rect);
    canvas.sendToBack(rect);
    canvas.setActiveObject(rect);
    canvas.renderAll();
  });

  document.getElementById('tool-add-rect').addEventListener('click', () => {
    const rect = new fabric.Rect({
      left: 100,
      top: 840,
      width: 10,
      height: 140,
      fill: '#38bdf8',
      rx: 2,
      ry: 2
    });
    canvas.add(rect);
    canvas.setActiveObject(rect);
    canvas.renderAll();
  });

  // Image Upload Tool (Downscales large images for fast WebSocket playout)
  document.getElementById('image-upload').addEventListener('change', function (e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function (f) {
      const rawData = f.target.result;
      const imgObj = new Image();
      imgObj.onload = function () {
        const maxDim = 800;
        let w = imgObj.width;
        let h = imgObj.height;

        if (w > maxDim || h > maxDim) {
          if (w > h) {
            h = Math.round((h * maxDim) / w);
            w = maxDim;
          } else {
            w = Math.round((w * maxDim) / h);
            h = maxDim;
          }
        }

        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = w;
        tempCanvas.height = h;
        const ctx = tempCanvas.getContext('2d');
        ctx.drawImage(imgObj, 0, 0, w, h);
        const optimizedDataUrl = tempCanvas.toDataURL('image/png');

        fabric.Image.fromURL(optimizedDataUrl, function (img) {
          img.scaleToWidth(220);
          img.set({ left: 1600, top: 80 });
          canvas.add(img);
          canvas.setActiveObject(img);
          canvas.renderAll();
        });
      };
      imgObj.src = rawData;
    };
    reader.readAsDataURL(file);
    this.value = '';
  });

  // Preset Loaders (1920x1080 Layouts)
  function loadPresetLowerThird() {
    canvas.clear();

    const box = new fabric.Rect({
      left: 100,
      top: 840,
      width: 920,
      height: 140,
      fill: 'rgba(15, 23, 42, 0.94)',
      stroke: 'rgba(255, 255, 255, 0.12)',
      strokeWidth: 2,
      rx: 12,
      ry: 12
    });

    const accent = new fabric.Rect({
      left: 100,
      top: 840,
      width: 10,
      height: 140,
      fill: '#38bdf8'
    });

    const badge = new fabric.IText(' BREAKING NEWS ', {
      left: 140,
      top: 800,
      fontFamily: 'Outfit',
      fontSize: 18,
      fontWeight: '800',
      fill: '#ffffff',
      backgroundColor: '#ef4444',
      padding: 6
    });

    const title = new fabric.IText('FABRIC.JS DESIGN SURFACE ENGINE', {
      left: 140,
      top: 860,
      fontFamily: 'Outfit',
      fontSize: 40,
      fontWeight: '800',
      fill: '#ffffff'
    });

    const subtitle = new fabric.IText('Visual graphics studio designed for CeftoDecklink SDI output', {
      left: 140,
      top: 920,
      fontFamily: 'Inter',
      fontSize: 22,
      fontWeight: '500',
      fill: '#94a3b8'
    });

    canvas.add(box, accent, badge, title, subtitle);
    canvas.renderAll();
  }

  function loadPresetNewsBanner() {
    canvas.clear();

    const bar = new fabric.Rect({
      left: 0,
      top: 1016,
      width: 1920,
      height: 64,
      fill: 'rgba(15, 23, 42, 0.95)',
      stroke: '#ef4444',
      strokeWidth: 3
    });

    const badge = new fabric.IText(' LIVE COVERAGE ', {
      left: 0,
      top: 1016,
      fontFamily: 'Outfit',
      fontSize: 22,
      fontWeight: '900',
      fill: '#ffffff',
      backgroundColor: '#dc2626',
      padding: 18
    });

    const tickerText = new fabric.IText('CEF Offscreen rendering streaming Fabric.js canvas graphics directly to DeckLink SDI output', {
      left: 300,
      top: 1030,
      fontFamily: 'Inter',
      fontSize: 26,
      fontWeight: '600',
      fill: '#f1f5f9'
    });

    canvas.add(bar, badge, tickerText);
    canvas.renderAll();
  }

  function loadPresetSpeakerBadge() {
    canvas.clear();

    const card = new fabric.Rect({
      left: 100,
      top: 200,
      width: 600,
      height: 360,
      fill: 'rgba(15, 23, 42, 0.94)',
      stroke: 'rgba(255, 255, 255, 0.15)',
      strokeWidth: 2,
      rx: 16,
      ry: 16
    });

    const badge = new fabric.IText(' KEYNOTE SPEAKER ', {
      left: 140,
      top: 240,
      fontFamily: 'Outfit',
      fontSize: 14,
      fontWeight: '800',
      fill: '#ffffff',
      backgroundColor: '#0284c7',
      padding: 6
    });

    const name = new fabric.IText('VIMLESH KUMAR', {
      left: 140,
      top: 290,
      fontFamily: 'Outfit',
      fontSize: 42,
      fontWeight: '900',
      fill: '#ffffff'
    });

    const role = new fabric.IText('Lead Broadcast Systems Engineer', {
      left: 140,
      top: 350,
      fontFamily: 'Inter',
      fontSize: 22,
      fontWeight: '600',
      fill: '#38bdf8'
    });

    const desc = new fabric.IText('Demonstrating live Fabric.js vector canvas playout on 1080i50 DeckLink SDI output.', {
      left: 140,
      top: 410,
      fontFamily: 'Inter',
      fontSize: 18,
      fill: '#cbd5e1'
    });

    canvas.add(card, badge, name, role, desc);
    canvas.renderAll();
  }

  document.getElementById('preset-lower-third').addEventListener('click', loadPresetLowerThird);
  document.getElementById('preset-news-banner').addEventListener('click', loadPresetNewsBanner);
  document.getElementById('preset-badge').addEventListener('click', loadPresetSpeakerBadge);

  // Send Push / Take Command to Server
  function pushDesignToOutput() {
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      console.warn('WebSocket not connected');
      return;
    }

    const designJSON = canvas.toJSON();

    const payload = {
      action: 'push-design',
      activeMode: 'fabric',
      fabricDesign: designJSON,
      backgroundColor: state.backgroundColor
    };

    ws.send(JSON.stringify(payload));
  }

  btnPushDesign.addEventListener('click', pushDesignToOutput);

  btnStop.addEventListener('click', () => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ action: 'stop' }));
    }
  });

  btnClear.addEventListener('click', () => {
    canvas.clear();
    onSelectionCleared();
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ action: 'clear' }));
    }
  });

  // Background Selector Buttons
  bgButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const bg = btn.getAttribute('data-bg');
      bgButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.backgroundColor = bg;

      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ action: 'update', backgroundColor: bg }));
      }
    });
  });

  // Hotkey Listeners
  window.addEventListener('keydown', (e) => {
    if (['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName)) {
      return;
    }

    if (e.code === 'Space') {
      e.preventDefault();
      pushDesignToOutput();
    } else if (e.code === 'Escape') {
      e.preventDefault();
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ action: 'clear' }));
      }
    } else if (e.code === 'Delete' || e.code === 'Backspace') {
      if (activeObject && !activeObject.isEditing) {
        e.preventDefault();
        canvas.remove(activeObject);
        canvas.discardActiveObject();
        canvas.renderAll();
        onSelectionCleared();
      }
    }
  });

  // WebSocket Client Setup
  function connectWebSocket() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws`;

    ws = new WebSocket(wsUrl);

    ws.onopen = function () {
      statusContainer.className = 'connection-status online';
      statusText.textContent = 'SERVER ONLINE';
    };

    ws.onmessage = function (event) {
      try {
        const msg = JSON.parse(event.data);
        if (msg.state) {
          state = msg.state;
        }
      } catch (err) {
        console.error('WS Error:', err);
      }
    };

    ws.onclose = function () {
      statusContainer.className = 'connection-status offline';
      statusText.textContent = 'OFFLINE (RETRYING)';
      setTimeout(connectWebSocket, 2000);
    };

    ws.onerror = function (err) {
      ws.close();
    };
  }

  // FX Trigger Button Listeners
  const btnFxScorePop = document.getElementById('btn-fx-score-pop');
  const btnFxSheen = document.getElementById('btn-fx-sheen');

  if (btnFxScorePop) {
    btnFxScorePop.addEventListener('click', () => {
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ action: 'trigger-fx', fxType: 'score-pop' }));
      }
    });
  }

  if (btnFxSheen) {
    btnFxSheen.addEventListener('click', () => {
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ action: 'trigger-fx', fxType: 'sheen-swipe' }));
      }
    });
  }

  // Template Play Button Listeners
  document.querySelectorAll('.btn-template-play').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const templateName = e.currentTarget.getAttribute('data-template');
      if (ws && ws.readyState === WebSocket.OPEN && templateName) {
        ws.send(JSON.stringify({
          action: 'play',
          template: templateName
        }));
      }
    });
  });

  // Score Modifier Buttons
  let currentScoreA = 3;
  let currentScoreB = 2;

  function updateLiveScore(changeA, changeB) {
    currentScoreA = Math.max(0, currentScoreA + changeA);
    currentScoreB = Math.max(0, currentScoreB + changeB);

    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        action: 'play',
        template: 'scoreboard',
        data: {
          scoreA: String(currentScoreA),
          scoreB: String(currentScoreB)
        }
      }));
    }
  }

  const btnScoreHomePlus = document.getElementById('btn-score-home-plus');
  const btnScoreHomeMinus = document.getElementById('btn-score-home-minus');
  const btnScoreAwayPlus = document.getElementById('btn-score-away-plus');
  const btnScoreAwayMinus = document.getElementById('btn-score-away-minus');

  if (btnScoreHomePlus) btnScoreHomePlus.addEventListener('click', () => updateLiveScore(1, 0));
  if (btnScoreHomeMinus) btnScoreHomeMinus.addEventListener('click', () => updateLiveScore(-1, 0));
  if (btnScoreAwayPlus) btnScoreAwayPlus.addEventListener('click', () => updateLiveScore(0, 1));
  if (btnScoreAwayMinus) btnScoreAwayMinus.addEventListener('click', () => updateLiveScore(0, -1));

  // Initialize Canvas & Connection
  initFabricCanvas();
  connectWebSocket();

})();
