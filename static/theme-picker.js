(function () {
  const STORAGE_KEY = 'embeat_ui_theme_v1';
  const ACCENT_KEY = 'embeat_ui_accent_hue_v1';
  const themes = [
    {id: 'auto', name: '跟随系统', group: 'auto', colors: ['#f3f2ee', '#15191d'], hue: 8},
    {id: 'studio', name: '录音室浅色', group: 'light', colors: ['#202124', '#e84b35'], hue: 8},
    {id: 'ocean', name: '海风蓝调', group: 'light', colors: ['#18363e', '#147d8f'], hue: 188},
    {id: 'forest', name: '林间唱片', group: 'light', colors: ['#24382f', '#d6533c'], hue: 8},
    {id: 'graphite', name: '石墨工作台', group: 'light', colors: ['#303438', '#3477b5'], hue: 210},
    {id: 'solar', name: '日光放映室', group: 'light', colors: ['#20292b', '#d79a22'], hue: 40},
    {id: 'night', name: '深夜黑胶', group: 'dark', colors: ['#0d1013', '#ff6d58'], hue: 8},
    {id: 'berry', name: '莓果夜色', group: 'dark', colors: ['#211e22', '#df5d7c'], hue: 345},
    {id: 'contrast', name: '高对比', group: 'contrast', colors: ['#000000', '#b00020'], hue: 349},
  ];
  const groups = [
    {id: 'auto', name: '自动'},
    {id: 'light', name: '浅色'},
    {id: 'dark', name: '深色'},
    {id: 'contrast', name: '高对比'},
  ];
  const ids = new Set(themes.map((theme) => theme.id));
  const root = document.documentElement;
  const darkScheme = window.matchMedia('(prefers-color-scheme: dark)');
  let currentTheme = normalizeTheme(root.dataset.theme || readStorage(STORAGE_KEY) || 'auto');
  let currentHue = normalizeHue(readStorage(ACCENT_KEY));
  let accountReady = false;
  let pendingPreferences = {};
  let preferenceTimer = 0;

  function readStorage(key) {
    try { return localStorage.getItem(key); } catch (error) { return null; }
  }

  function writeStorage(key, value) {
    try {
      if (value === null) localStorage.removeItem(key);
      else localStorage.setItem(key, String(value));
    } catch (error) { /* Storage may be disabled. */ }
  }

  function normalizeTheme(value) {
    const normalized = String(value || '').toLowerCase();
    return ids.has(normalized) ? normalized : 'auto';
  }

  function normalizeHue(value) {
    if (value === null || value === undefined || value === '') return null;
    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) ? Math.max(0, Math.min(359, parsed)) : null;
  }

  function isDarkTheme(themeId = currentTheme) {
    return themeId === 'night' || themeId === 'berry' || (themeId === 'auto' && darkScheme.matches);
  }

  function clearAccentStyles() {
    ['--accent', '--accent-hover', '--accent-dark', '--focus-ring', '--accent-ring', '--record-label'].forEach((name) => root.style.removeProperty(name));
    delete root.dataset.customAccent;
  }

  function applyAccentStyles(hue) {
    clearAccentStyles();
    if (hue === null) return;
    const dark = isDarkTheme();
    const accentLightness = dark ? 66 : 43;
    const hoverLightness = dark ? 72 : 49;
    const darkLightness = dark ? 82 : 34;
    const focusLightness = dark ? 78 : 32;
    root.style.setProperty('--accent', `hsl(${hue} 72% ${accentLightness}%)`);
    root.style.setProperty('--accent-hover', `hsl(${hue} 76% ${hoverLightness}%)`);
    root.style.setProperty('--accent-dark', `hsl(${hue} 68% ${darkLightness}%)`);
    root.style.setProperty('--focus-ring', `hsl(${hue} 82% ${focusLightness}%)`);
    root.style.setProperty('--accent-ring', `hsl(${hue} 76% 50% / 22%)`);
    root.style.setProperty('--record-label', 'var(--accent)');
    root.dataset.customAccent = 'true';
  }

  function updateControls() {
    const activeTheme = themes.find((theme) => theme.id === currentTheme) || themes[0];
    document.querySelectorAll('[data-theme-option]').forEach((option) => {
      const active = option.dataset.themeOption === currentTheme;
      option.classList.toggle('active', active);
      option.setAttribute('aria-checked', String(active));
    });
    document.querySelectorAll('.theme-picker-button').forEach((button) => {
      button.setAttribute('aria-label', `切换界面主题，当前：${activeTheme.name}`);
      button.title = `切换界面主题，当前：${activeTheme.name}`;
    });
    document.querySelectorAll('[data-theme-hue]').forEach((slider) => {
      slider.value = String(currentHue ?? activeTheme.hue);
    });
    document.querySelectorAll('[data-theme-accent-reset]').forEach((button) => { button.disabled = currentHue === null; });
  }

  function queuePreferenceSave(patch) {
    pendingPreferences = {...pendingPreferences, ...patch};
    if (!accountReady) return;
    window.clearTimeout(preferenceTimer);
    preferenceTimer = window.setTimeout(async () => {
      const payload = pendingPreferences;
      pendingPreferences = {};
      try {
        await fetch('/api/preferences', {
          method: 'POST',
          credentials: 'same-origin',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify(payload),
        });
      } catch (error) { /* Local preference remains available when the server is offline. */ }
    }, 180);
  }

  function applyTheme(themeId, options = {}) {
    currentTheme = normalizeTheme(themeId);
    root.dataset.theme = currentTheme;
    if (options.local !== false) writeStorage(STORAGE_KEY, currentTheme);
    applyAccentStyles(currentHue);
    updateControls();
    updateCurrentAudit();
    if (options.account) queuePreferenceSave({theme: currentTheme});
  }

  function applyAccent(hue, options = {}) {
    currentHue = normalizeHue(hue);
    if (options.local !== false) writeStorage(ACCENT_KEY, currentHue);
    applyAccentStyles(currentHue);
    updateControls();
    updateCurrentAudit();
    if (options.account) queuePreferenceSave({accent_hue: currentHue});
  }

  function closeAll(except) {
    document.querySelectorAll('[data-theme-picker]').forEach((picker) => {
      if (picker === except) return;
      picker.querySelector('.theme-menu')?.classList.add('hidden');
      picker.querySelector('.theme-picker-button')?.setAttribute('aria-expanded', 'false');
    });
  }

  function positionMenu(picker, menu) {
    const sidebar = picker.closest('.sidebar');
    if (!sidebar) return;
    const sidebarRect = sidebar.getBoundingClientRect();
    const pickerRect = picker.getBoundingClientRect();
    const sidebarStyle = getComputedStyle(sidebar);
    const paddingLeft = Number.parseFloat(sidebarStyle.paddingLeft) || 0;
    const paddingRight = Number.parseFloat(sidebarStyle.paddingRight) || 0;
    const menuWidth = menu.getBoundingClientRect().width;
    const minLeft = sidebarRect.left + paddingLeft - pickerRect.left;
    const maxLeft = sidebarRect.right - paddingRight - menuWidth - pickerRect.left;
    menu.style.left = `${Math.max(minLeft, maxLeft)}px`;
    menu.style.right = 'auto';
  }

  function menuMarkup(index) {
    const themeGroups = groups.map((group) => {
      const options = themes.filter((theme) => theme.group === group.id).map((theme) => `
        <button class="theme-option" type="button" role="menuitemradio" aria-checked="false" data-theme-option="${theme.id}">
          <span class="theme-swatches" aria-hidden="true"><i style="background:${theme.colors[0]}"></i><i style="background:${theme.colors[1]}"></i></span>
          <span>${theme.name}</span><b aria-hidden="true">✓</b><em class="theme-option-warning" aria-label="对比度未通过"></em>
        </button>`).join('');
      return `<section class="theme-group"><p class="theme-group-title">${group.name}</p>${options}</section>`;
    }).join('');
    return `${themeGroups}
      <section class="theme-custom">
        <div class="theme-custom-head"><label for="theme-hue-${index}">自定义强调色</label><button type="button" data-theme-accent-reset>恢复默认</button></div>
        <div class="theme-custom-row"><input id="theme-hue-${index}" data-theme-hue type="range" min="0" max="359" step="1"><span class="theme-accent-preview" aria-hidden="true"></span></div>
        <p class="theme-audit" data-theme-audit aria-live="polite"></p>
      </section>`;
  }

  function parseRgb(value) {
    const numbers = String(value).match(/[\d.]+/g);
    return numbers && numbers.length >= 3 ? numbers.slice(0, 3).map(Number) : null;
  }

  function resolveColor(variable) {
    const probe = document.createElement('span');
    probe.style.cssText = `position:fixed;visibility:hidden;color:var(${variable})`;
    document.body.appendChild(probe);
    const color = parseRgb(getComputedStyle(probe).color);
    probe.remove();
    return color;
  }

  function luminance(color) {
    const values = color.map((item) => {
      const channel = item / 255;
      return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
    });
    return (0.2126 * values[0]) + (0.7152 * values[1]) + (0.0722 * values[2]);
  }

  function contrastRatio(left, right) {
    const a = luminance(left);
    const b = luminance(right);
    return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
  }

  function auditCurrentTheme() {
    const checks = [
      ['正文/画布', '--ink', '--canvas'],
      ['正文/面板', '--ink', '--surface'],
      ['表单文字', '--control-ink', '--control-bg'],
      ['侧栏文字', '--sidebar-ink', '--sidebar-bg'],
      ['侧栏次要文字', '--sidebar-muted', '--sidebar-bg'],
    ];
    return checks.map(([label, foreground, background]) => {
      const left = resolveColor(foreground);
      const right = resolveColor(background);
      const ratio = left && right ? contrastRatio(left, right) : 0;
      return {label, ratio, ok: ratio >= 4.5};
    });
  }

  function updateCurrentAudit() {
    if (!document.body) return;
    const failures = auditCurrentTheme().filter((check) => !check.ok);
    document.querySelectorAll('[data-theme-audit]').forEach((node) => {
      node.classList.toggle('warning', failures.length > 0);
      node.textContent = failures.length
        ? `AA 注意：${failures.map((item) => `${item.label} ${item.ratio.toFixed(1)}:1`).join('、')}`
        : 'WCAG AA 核心文字对比度通过';
    });
  }

  function auditThemeOptions() {
    const savedTheme = currentTheme;
    const savedHue = currentHue;
    clearAccentStyles();
    themes.forEach((theme) => {
      root.dataset.theme = theme.id;
      const failures = auditCurrentTheme().filter((check) => !check.ok);
      document.querySelectorAll(`[data-theme-option="${theme.id}"] .theme-option-warning`).forEach((node) => {
        node.textContent = failures.length ? '!' : '';
        node.title = failures.length ? failures.map((item) => `${item.label} ${item.ratio.toFixed(1)}:1`).join('；') : '';
      });
    });
    root.dataset.theme = savedTheme;
    currentTheme = savedTheme;
    currentHue = savedHue;
    applyAccentStyles(savedHue);
    updateCurrentAudit();
  }

  document.querySelectorAll('[data-theme-picker]').forEach((picker, index) => {
    const button = picker.querySelector('.theme-picker-button');
    const menu = picker.querySelector('.theme-menu');
    menu.innerHTML = menuMarkup(index);
    button.addEventListener('click', (event) => {
      event.stopPropagation();
      const opening = menu.classList.contains('hidden');
      closeAll(opening ? picker : null);
      if (opening) {
        menu.classList.remove('hidden');
        positionMenu(picker, menu);
      } else {
        menu.classList.add('hidden');
      }
      button.setAttribute('aria-expanded', String(opening));
    });
    menu.addEventListener('click', (event) => {
      event.stopPropagation();
      const option = event.target.closest('[data-theme-option]');
      if (option) {
        applyTheme(option.dataset.themeOption, {account: true});
        menu.classList.add('hidden');
        button.setAttribute('aria-expanded', 'false');
        button.focus();
        return;
      }
      if (event.target.closest('[data-theme-accent-reset]')) applyAccent(null, {account: true});
    });
    menu.querySelector('[data-theme-hue]').addEventListener('input', (event) => applyAccent(event.target.value, {account: true}));
  });

  async function loadAccountPreferences() {
    try {
      const response = await fetch('/api/preferences', {credentials: 'same-origin'});
      if (!response.ok) return;
      const preferences = await response.json();
      accountReady = true;
      if (ids.has(preferences.theme)) applyTheme(preferences.theme);
      else queuePreferenceSave({theme: currentTheme});
      if (preferences.accent_hue !== null && preferences.accent_hue !== undefined) applyAccent(preferences.accent_hue);
      else if (currentHue !== null) queuePreferenceSave({accent_hue: currentHue});
    } catch (error) { /* Browser-local preferences remain active. */ }
  }

  document.addEventListener('click', () => closeAll());
  document.addEventListener('keydown', (event) => { if (event.key === 'Escape') closeAll(); });
  window.addEventListener('resize', () => {
    document.querySelectorAll('[data-theme-picker]').forEach((picker) => {
      const menu = picker.querySelector('.theme-menu');
      if (menu && !menu.classList.contains('hidden')) positionMenu(picker, menu);
    });
  });
  window.addEventListener('storage', (event) => {
    if (event.key === STORAGE_KEY) applyTheme(event.newValue || 'auto', {local: false});
    if (event.key === ACCENT_KEY) applyAccent(event.newValue, {local: false});
  });
  darkScheme.addEventListener?.('change', () => {
    if (currentTheme === 'auto') {
      applyAccentStyles(currentHue);
      auditThemeOptions();
    }
  });

  applyTheme(currentTheme, {local: false});
  applyAccent(currentHue, {local: false});
  auditThemeOptions();
  if (window.embeatAuthReady) window.embeatAuthReady.then(loadAccountPreferences);
  window.EmbeatTheme = {apply: (theme) => applyTheme(theme, {account: true}), current: () => currentTheme};
})();
