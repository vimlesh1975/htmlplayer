/**
 * PURE HTML5 BROADCAST OUTPUT ENGINE
 * Renders 100% Native HTML DOM Elements (h1, h2, p, div, img) for 1080p Playout.
 */

(function () {
  'use strict';

  // DOM Layer Elements
  const layers = {
    htmlDom: document.getElementById('html-dom-surface'),
    lowerThird: document.getElementById('lowerThird-container'),
    ticker: document.getElementById('ticker-container'),
    scoreboard: document.getElementById('scoreboard-container'),
    bugClock: document.getElementById('bugClock-container'),
    infoCard: document.getElementById('infoCard-container'),
    lBar: document.getElementById('lBar-container')
  };

  const graphicsRoot = document.getElementById('graphics-root');
  const clockElement = document.getElementById('bug-clock');
  const htmlDomSurface = document.getElementById('html-dom-surface');

  let activeMode = 'fabric';
  let activeTemplate = 'lowerThird';
  let ws = null;

  // Convert Single Fabric Object to High-Fidelity Native HTML DOM Node (1:1 Style Match)
  function convertFabricObjectToDOMNode(obj, idx) {
    if (!obj) return null;

    let el = null;
    const scaleX = obj.scaleX !== undefined ? obj.scaleX : 1;
    const scaleY = obj.scaleY !== undefined ? obj.scaleY : 1;

    const left = Math.round(obj.left || 0);
    const top = Math.round(obj.top || 0);
    const width = Math.round((obj.width || 0) * scaleX);
    const height = Math.round((obj.height || 0) * scaleY);
    const opacity = obj.opacity !== undefined ? obj.opacity : 1;
    const angle = obj.angle || 0;
    
    // TransformOrigin matching Fabric origin
    const originX = obj.originX || 'left';
    const originY = obj.originY || 'top';
    const transformOrigin = `${originX} ${originY}`;
    const transform = `rotate(${angle}deg)`;

    // Common Shadow Handling (text-shadow for text, box-shadow for shapes)
    let shadowStyle = '';
    if (obj.shadow) {
      const s = typeof obj.shadow === 'string' ? { color: obj.shadow } : obj.shadow;
      const ox = Math.round((s.offsetX || 0) * scaleX);
      const oy = Math.round((s.offsetY || 0) * scaleY);
      const blur = Math.round(s.blur || 0);
      const color = s.color || 'rgba(0, 0, 0, 0.5)';
      shadowStyle = `${ox}px ${oy}px ${blur}px ${color}`;
    }

    if (obj.type === 'i-text' || obj.type === 'text' || obj.type === 'textbox') {
      const baseFontSize = obj.fontSize || 32;
      const fontSize = Math.round(baseFontSize * scaleY);

      if (fontSize >= 36) {
        el = document.createElement('h1');
      } else if (fontSize >= 24) {
        el = document.createElement('h2');
      } else {
        el = document.createElement('p');
      }

      el.className = 'html-dom-element html-text-node staggered-entry';
      el.textContent = obj.text || '';
      el.style.position = 'absolute';
      el.style.left = left + 'px';
      el.style.top = top + 'px';
      if (width > 0) el.style.width = width + 'px';
      
      el.style.fontFamily = `'${obj.fontFamily || 'Outfit'}', sans-serif`;
      el.style.fontSize = fontSize + 'px';
      el.style.fontWeight = obj.fontWeight || '700';
      el.style.fontStyle = obj.fontStyle || 'normal';
      el.style.textAlign = obj.textAlign || 'left';
      el.style.lineHeight = obj.lineHeight ? obj.lineHeight : '1.16';
      el.style.color = obj.fill || '#ffffff';

      // Character spacing (Fabric charSpacing is 1/1000 em unit)
      if (obj.charSpacing) {
        el.style.letterSpacing = (obj.charSpacing / 1000) + 'em';
      }

      // Underline / Linethrough
      if (obj.underline && obj.linethrough) {
        el.style.textDecoration = 'underline line-through';
      } else if (obj.underline) {
        el.style.textDecoration = 'underline';
      } else if (obj.linethrough) {
        el.style.textDecoration = 'line-through';
      }

      // Background color & padding
      if (obj.backgroundColor) {
        el.style.backgroundColor = obj.backgroundColor;
        const pad = Math.round((obj.padding || 4) * scaleY);
        el.style.padding = pad + 'px';
        el.style.borderRadius = '4px';
      }

      // Text stroke
      if (obj.stroke && obj.strokeWidth) {
        const strokeW = Math.max(1, Math.round(obj.strokeWidth * scaleY));
        el.style.webkitTextStroke = `${strokeW}px ${obj.stroke}`;
      }

      // Text Shadow
      if (shadowStyle) {
        el.style.textShadow = shadowStyle;
      }

      el.style.opacity = opacity;
      el.style.transformOrigin = transformOrigin;
      el.style.transform = transform;
    } else if (obj.type === 'rect') {
      el = document.createElement('div');
      el.className = 'html-dom-element html-rect-node staggered-entry';
      el.style.position = 'absolute';
      el.style.left = left + 'px';
      el.style.top = top + 'px';
      el.style.width = width + 'px';
      el.style.height = height + 'px';
      el.style.backgroundColor = obj.fill || 'transparent';

      if (obj.stroke && obj.strokeWidth) {
        const borderStyle = obj.strokeDashArray ? 'dashed' : 'solid';
        const borderWidth = Math.max(1, Math.round(obj.strokeWidth * scaleX));
        el.style.border = `${borderWidth}px ${borderStyle} ${obj.stroke}`;
      }

      if (obj.rx || obj.ry) {
        const rx = Math.round((obj.rx || 0) * scaleX);
        const ry = Math.round((obj.ry || 0) * scaleY);
        el.style.borderRadius = `${rx}px / ${ry}px`;
      }

      if (shadowStyle) {
        el.style.boxShadow = shadowStyle;
      }

      el.style.opacity = opacity;
      el.style.transformOrigin = transformOrigin;
      el.style.transform = transform;
    } else if (obj.type === 'circle') {
      el = document.createElement('div');
      el.className = 'html-dom-element html-rect-node staggered-entry';
      const diameterX = Math.round((obj.radius * 2 || 0) * scaleX);
      const diameterY = Math.round((obj.radius * 2 || 0) * scaleY);

      el.style.position = 'absolute';
      el.style.left = left + 'px';
      el.style.top = top + 'px';
      el.style.width = diameterX + 'px';
      el.style.height = diameterY + 'px';
      el.style.borderRadius = '50%';
      el.style.backgroundColor = obj.fill || 'transparent';

      if (obj.stroke && obj.strokeWidth) {
        const borderWidth = Math.max(1, Math.round(obj.strokeWidth * scaleX));
        el.style.border = `${borderWidth}px solid ${obj.stroke}`;
      }

      if (shadowStyle) {
        el.style.boxShadow = shadowStyle;
      }

      el.style.opacity = opacity;
      el.style.transformOrigin = transformOrigin;
      el.style.transform = transform;
    } else if (obj.type === 'image' && obj.src) {
      el = document.createElement('img');
      el.className = 'html-dom-element html-img-node staggered-entry';
      el.src = obj.src;
      el.style.position = 'absolute';
      el.style.left = left + 'px';
      el.style.top = top + 'px';
      el.style.width = width + 'px';
      el.style.height = height + 'px';
      el.style.objectFit = 'contain';

      if (shadowStyle) {
        el.style.boxShadow = shadowStyle;
      }

      el.style.opacity = opacity;
      el.style.transformOrigin = transformOrigin;
      el.style.transform = transform;
    } else if (obj.type === 'group' && Array.isArray(obj.objects)) {
      el = document.createElement('div');
      el.className = 'html-dom-element html-group-node staggered-entry';
      el.style.position = 'absolute';
      el.style.left = left + 'px';
      el.style.top = top + 'px';
      if (width > 0) el.style.width = width + 'px';
      if (height > 0) el.style.height = height + 'px';
      el.style.opacity = opacity;
      el.style.transformOrigin = transformOrigin;
      el.style.transform = transform;

      obj.objects.forEach((childObj, childIdx) => {
        const childNode = convertFabricObjectToDOMNode(childObj, childIdx);
        if (childNode) {
          el.appendChild(childNode);
        }
      });
    }

    if (el) {
      el.style.zIndex = idx + 1;
      el.style.animationDelay = (idx * 0.06) + 's';
    }

    return el;
  }

  // Convert Fabric Design Objects into Pure Native HTML DOM Surface
  function renderHtmlDOMSurface(designPayload) {
    if (!htmlDomSurface) return;
    htmlDomSurface.innerHTML = '';

    let parsed = designPayload;
    if (typeof designPayload === 'string') {
      try {
        parsed = JSON.parse(designPayload);
      } catch (e) {
        return;
      }
    }

    if (!parsed || !parsed.objects || !Array.isArray(parsed.objects)) return;

    parsed.objects.forEach((obj, idx) => {
      const node = convertFabricObjectToDOMNode(obj, idx);
      if (node) {
        htmlDomSurface.appendChild(node);
      }
    });

    if (layers.htmlDom) {
      activateLayer(layers.htmlDom);
    }
  }

  // Helper to trigger score pop pulse animation
  function triggerScorePop(element) {
    if (!element) return;
    element.classList.remove('score-pop');
    void element.offsetWidth; // Trigger reflow for keyframe reset
    element.classList.add('score-pop');
  }

  // Real-Time Clock Update Loop
  function updateClock() {
    if (!clockElement) return;
    const now = new Date();
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    clockElement.textContent = `${hours}:${minutes}:${seconds}`;
  }
  setInterval(updateClock, 1000);
  updateClock();

  // Update Graphic DOM Content for HTML Templates
  function updateData(dataMap) {
    if (!dataMap) return;

    if (dataMap.lowerThird) {
      const d = dataMap.lowerThird;
      if (d.title !== undefined) document.getElementById('lt-title').textContent = d.title;
      if (d.subtitle !== undefined) document.getElementById('lt-subtitle').textContent = d.subtitle;
      if (d.category !== undefined) document.getElementById('lt-category').textContent = d.category;
      
      if (d.theme) {
        layers.lowerThird.className = `gfx-layer lower-third-gfx lt-theme-${d.theme} ${layers.lowerThird.classList.contains('active') ? 'active' : ''}`;
      }
    }

    if (dataMap.ticker) {
      const d = dataMap.ticker;
      if (d.headline !== undefined) document.getElementById('ticker-headline').textContent = d.headline;
      if (d.text !== undefined) document.getElementById('ticker-text').textContent = d.text;
    }

    if (dataMap.scoreboard) {
      const d = dataMap.scoreboard;
      if (d.teamA !== undefined) document.getElementById('sb-teamA').textContent = d.teamA;
      
      const elScoreA = document.getElementById('sb-scoreA');
      if (d.scoreA !== undefined) {
        if (elScoreA.textContent !== String(d.scoreA)) {
          elScoreA.textContent = d.scoreA;
          triggerScorePop(elScoreA);
        }
      }
      
      if (d.teamB !== undefined) document.getElementById('sb-teamB').textContent = d.teamB;
      
      const elScoreB = document.getElementById('sb-scoreB');
      if (d.scoreB !== undefined) {
        if (elScoreB.textContent !== String(d.scoreB)) {
          elScoreB.textContent = d.scoreB;
          triggerScorePop(elScoreB);
        }
      }
      
      if (d.period !== undefined) document.getElementById('sb-period').textContent = d.period;
      if (d.timer !== undefined) document.getElementById('sb-timer').textContent = d.timer;
    }

    if (dataMap.bugClock) {
      const d = dataMap.bugClock;
      if (d.channelName !== undefined) document.getElementById('bug-channel').textContent = d.channelName;
    }

    if (dataMap.infoCard) {
      const d = dataMap.infoCard;
      if (d.title !== undefined) document.getElementById('info-title').textContent = d.title;
      if (d.name !== undefined) document.getElementById('info-name').textContent = d.name;
      if (d.role !== undefined) document.getElementById('info-role').textContent = d.role;
      if (d.details !== undefined) document.getElementById('info-details').textContent = d.details;
    }

    if (dataMap.lBar) {
      const d = dataMap.lBar;
      if (d.title !== undefined) document.getElementById('lbar-title').textContent = d.title;
      if (d.subtitle !== undefined) document.getElementById('lbar-subtitle').textContent = d.subtitle;
      if (d.bullet1 !== undefined) document.getElementById('lbar-b1').textContent = d.bullet1;
      if (d.bullet2 !== undefined) document.getElementById('lbar-b2').textContent = d.bullet2;
      if (d.bullet3 !== undefined) document.getElementById('lbar-b3').textContent = d.bullet3;
    }
  }

  // Set Background Mode (Locked to Transparent for SDI Broadcast Keyer)
  function setBackground() {
    if (!graphicsRoot) return;
    graphicsRoot.className = 'graphics-container transparent-bg';
  }

  // Helper to re-trigger layer entry animations
  function activateLayer(layerEl) {
    if (!layerEl) return;
    layerEl.classList.remove('active');
    void layerEl.offsetWidth; // Force reflow to restart CSS keyframes
    layerEl.classList.add('active');
  }

  // Execute State Transition
  function applyState(state) {
    if (!state) return;

    if (state.backgroundColor !== undefined) {
      setBackground(state.backgroundColor);
    }

    if (state.data) {
      updateData(state.data);
    }

    if (state.activeMode) {
      activeMode = state.activeMode;
    }

    if (state.activeTemplate) {
      activeTemplate = state.activeTemplate;
    }

    if (state.fabricDesign) {
      renderHtmlDOMSurface(state.fabricDesign);
    }

    if (state.status === 'playing') {
      if (activeMode === 'fabric') {
        Object.keys(layers).forEach(key => {
          if (key === 'htmlDom') {
            if (layers[key]) activateLayer(layers[key]);
          } else {
            if (layers[key]) layers[key].classList.remove('active');
          }
        });
      } else {
        Object.keys(layers).forEach(key => {
          if (key === activeTemplate) {
            if (layers[key]) activateLayer(layers[key]);
          } else {
            if (layers[key]) layers[key].classList.remove('active');
          }
        });
      }
    } else {
      // Stop / Hide all layers
      Object.keys(layers).forEach(key => {
        if (layers[key]) layers[key].classList.remove('active');
      });
    }
  }

  // Handle custom FX animation triggers from control studio
  function handleFxTrigger(fxType) {
    if (fxType === 'score-pop') {
      triggerScorePop(document.getElementById('sb-scoreA'));
      triggerScorePop(document.getElementById('sb-scoreB'));
    } else if (fxType === 'sheen-swipe') {
      const activePanel = document.querySelector('.gfx-layer.active');
      if (activePanel) {
        activePanel.classList.remove('active');
        void activePanel.offsetWidth;
        activePanel.classList.add('active');
      }
    }
  }

  // WebSocket Client Setup
  function connectWebSocket() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws`;

    ws = new WebSocket(wsUrl);

    ws.onopen = function () {
      console.log('[Broadcast Engine] Connected to WebSocket Server');
    };

    ws.onmessage = function (event) {
      try {
        const msg = JSON.parse(event.data);
        console.log('[Broadcast Engine] Received command:', msg.action);

        if (msg.fxType) {
          handleFxTrigger(msg.fxType);
        }

        if (msg.state) {
          applyState(msg.state);
        }
      } catch (err) {
        console.error('[Broadcast Engine] Error handling message:', err);
      }
    };

    ws.onclose = function () {
      console.warn('[Broadcast Engine] WebSocket closed. Retrying in 2 seconds...');
      setTimeout(connectWebSocket, 2000);
    };

    ws.onerror = function (err) {
      console.error('[Broadcast Engine] WebSocket error:', err);
      ws.close();
    };
  }

  connectWebSocket();

})();
