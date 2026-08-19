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

  // Convert Fabric Design Objects into Pure Native HTML DOM Nodes (h1, p, div, img)
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
      let el = null;
      const left = Math.round(obj.left || 0);
      const top = Math.round(obj.top || 0);
      const width = Math.round((obj.width || 0) * (obj.scaleX || 1));
      const height = Math.round((obj.height || 0) * (obj.scaleY || 1));
      const opacity = obj.opacity !== undefined ? obj.opacity : 1;
      const angle = obj.angle || 0;
      const transform = `rotate(${angle}deg)`;

      if (obj.type === 'i-text' || obj.type === 'text' || obj.type === 'textbox') {
        const fontSize = obj.fontSize || 32;
        // Map large text to H1/H2 tags, small text to P/SPAN for clean semantic HTML inspection
        if (fontSize >= 36) {
          el = document.createElement('h1');
        } else if (fontSize >= 24) {
          el = document.createElement('h2');
        } else {
          el = document.createElement('p');
        }
        el.className = 'html-dom-element html-text-node';
        el.textContent = obj.text || '';
        el.style.position = 'absolute';
        el.style.left = left + 'px';
        el.style.top = top + 'px';
        if (width > 0) el.style.width = width + 'px';
        el.style.fontFamily = `'${obj.fontFamily || 'Outfit'}', sans-serif`;
        el.style.fontSize = fontSize + 'px';
        el.style.fontWeight = obj.fontWeight || '700';
        el.style.color = obj.fill || '#ffffff';
        if (obj.backgroundColor) {
          el.style.backgroundColor = obj.backgroundColor;
          el.style.padding = (obj.padding || 4) + 'px';
          el.style.borderRadius = '4px';
        }
        el.style.opacity = opacity;
        el.style.transform = transform;
        el.style.lineHeight = '1.2';
      } else if (obj.type === 'rect') {
        el = document.createElement('div');
        el.className = 'html-dom-element html-rect-node';
        el.style.position = 'absolute';
        el.style.left = left + 'px';
        el.style.top = top + 'px';
        el.style.width = width + 'px';
        el.style.height = height + 'px';
        el.style.backgroundColor = obj.fill || 'transparent';
        if (obj.stroke && obj.strokeWidth) {
          el.style.border = `${obj.strokeWidth}px solid ${obj.stroke}`;
        }
        if (obj.rx || obj.ry) {
          el.style.borderRadius = `${obj.rx || obj.ry}px`;
        }
        el.style.opacity = opacity;
        el.style.transform = transform;
      } else if (obj.type === 'image' && obj.src) {
        el = document.createElement('img');
        el.className = 'html-dom-element html-img-node';
        el.src = obj.src;
        el.style.position = 'absolute';
        el.style.left = left + 'px';
        el.style.top = top + 'px';
        el.style.width = width + 'px';
        el.style.height = height + 'px';
        el.style.opacity = opacity;
        el.style.transform = transform;
      }

      if (el) {
        el.style.zIndex = idx + 1;
        htmlDomSurface.appendChild(el);
      }
    });

    if (layers.htmlDom) {
      layers.htmlDom.classList.add('active');
    }
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
      if (d.scoreA !== undefined) document.getElementById('sb-scoreA').textContent = d.scoreA;
      if (d.teamB !== undefined) document.getElementById('sb-teamB').textContent = d.teamB;
      if (d.scoreB !== undefined) document.getElementById('sb-scoreB').textContent = d.scoreB;
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

  // Set Background Mode
  function setBackground(bgColor) {
    if (!graphicsRoot) return;
    graphicsRoot.className = 'graphics-container';
    if (bgColor === 'green') {
      graphicsRoot.classList.add('green-screen');
    } else if (bgColor === 'blue') {
      graphicsRoot.classList.add('blue-screen');
    } else if (bgColor === 'dark') {
      graphicsRoot.classList.add('dark-preview');
    } else {
      graphicsRoot.classList.add('transparent-bg');
    }
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
            if (layers[key]) layers[key].classList.add('active');
          } else {
            if (layers[key]) layers[key].classList.remove('active');
          }
        });
      } else {
        Object.keys(layers).forEach(key => {
          if (key === activeTemplate) {
            if (layers[key]) layers[key].classList.add('active');
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
