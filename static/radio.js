const NETEASE_STORAGE_KEY = 'embeat_ui_netease_config_v1';
const RADIO_HANDOFF_KEY = 'embeat_ui_radio_handoff_v1';

const elements = {
  platform: document.querySelector('#radio-platform'),
  accountStatus: document.querySelector('#radio-account-status'),
  statusRefresh: document.querySelector('#radio-status-refresh'),
  auth: document.querySelector('#radio-auth'),
  api: document.querySelector('#radio-api'),
  proxy: document.querySelector('#radio-proxy'),
  cookie: document.querySelector('#radio-cookie'),
  cookieLabel: document.querySelector('#radio-cookie-label'),
  authNote: document.querySelector('#radio-auth-note'),
  connect: document.querySelector('#radio-connect'),
  playlist: document.querySelector('#radio-playlist'),
  playlistRefresh: document.querySelector('#radio-playlist-refresh'),
  seedLimit: document.querySelector('#radio-seed-limit'),
  resultLimit: document.querySelector('#radio-result-limit'),
  generate: document.querySelector('#radio-generate'),
  progress: document.querySelector('#radio-progress'),
  progressPhase: document.querySelector('#radio-progress-phase'),
  progressPercent: document.querySelector('#radio-progress-percent'),
  progressBar: document.querySelector('#radio-progress-bar'),
  progressDetail: document.querySelector('#radio-progress-detail'),
  result: document.querySelector('#radio-result'),
  resultSummary: document.querySelector('#radio-result-summary'),
  seedSummary: document.querySelector('#radio-seed-summary'),
  unmatchedDetails: document.querySelector('#radio-unmatched-details'),
  unmatchedSummary: document.querySelector('#radio-unmatched-summary'),
  unmatchedList: document.querySelector('#radio-unmatched-list'),
  resultList: document.querySelector('#radio-result-list'),
  openMain: document.querySelector('#radio-open-main'),
  overviewTitle: document.querySelector('#radio-overview-title'),
  overviewPlatform: document.querySelector('#radio-overview-platform'),
  overviewPlaylist: document.querySelector('#radio-overview-playlist'),
  overviewSeeds: document.querySelector('#radio-overview-seeds'),
  overviewResults: document.querySelector('#radio-overview-results'),
  serviceStatus: document.querySelector('#radio-service-status'),
  toast: document.querySelector('#radio-toast'),
};

const platformNames = { netease: '网易云音乐', kugou: '酷狗音乐' };
const platformDefaults = {
  netease: {
    api: '',
    proxy: '',
    placeholder: 'MUSIC_U=...; __csrf=...',
    note: '网易云 Cookie 会保存在当前浏览器中，UI 服务重启后本页会自动恢复登录。',
  },
  kugou: {
    api: '',
    proxy: '',
    placeholder: 'token=...; userid=...; dfid=...',
    note: '酷狗凭据校验成功后写入本机凭据文件，浏览器不会额外保存 Cookie。',
  },
};
const sourceNames = {
  similar: '声学相似', popular: '流派热门', same_artist: '同艺人',
  related_artist: '相似艺人', related_track: '歌单关联',
};

let currentPlatform = 'netease';
let currentPlaylists = [];
let currentHandoff = null;
let statusRequestId = 0;
const platformReady = { netease: false, kugou: false };
const platformStatus = { netease: null, kugou: null };

elements.platform.addEventListener('change', () => {
  currentPlatform = elements.platform.querySelector('input:checked')?.value || 'netease';
  currentPlaylists = [];
  currentHandoff = null;
  elements.result.classList.add('hidden');
  renderAuthFields();
  updateOverview();
  refreshPlatformStatus(true);
});
elements.statusRefresh.addEventListener('click', () => refreshPlatformStatus(true));
elements.connect.addEventListener('click', connectCurrentPlatform);
elements.playlistRefresh.addEventListener('click', loadPlaylists);
elements.playlist.addEventListener('change', updateGenerateState);
elements.seedLimit.addEventListener('change', updateOverview);
elements.resultLimit.addEventListener('change', updateOverview);
elements.generate.addEventListener('click', generateRadio);
elements.openMain.addEventListener('click', openInMainPage);

function savedNeteaseConfig() {
  return null;
}

async function prefillPlatformDefaults() {
  try {
    const defaults = await request('/api/config');
    if (defaults.netease_api_url) platformDefaults.netease.api = defaults.netease_api_url;
    if (defaults.kugou_api_url) platformDefaults.kugou.api = defaults.kugou_api_url;
    if (defaults.proxy_url) {
      platformDefaults.netease.proxy = defaults.proxy_url;
      platformDefaults.kugou.proxy = defaults.proxy_url;
    }
  } catch (error) { /* 默认值不可用时不提示 */ }
}

function renderAuthFields() {
  const defaults = platformDefaults[currentPlatform];
  const status = platformStatus[currentPlatform] || {};
  const saved = currentPlatform === 'netease' ? savedNeteaseConfig() : null;
  elements.api.value = status.api_url || saved?.api_url || defaults.api;
  elements.proxy.value = status.proxy_url ?? saved?.proxy_url ?? defaults.proxy;
  elements.cookie.value = '';
  elements.cookie.placeholder = defaults.placeholder;
  elements.cookieLabel.textContent = `${platformNames[currentPlatform]} Cookie`;
  elements.authNote.textContent = defaults.note;
  elements.connect.textContent = platformReady[currentPlatform] ? '重新校验并连接' : '校验并连接';
  elements.auth.classList.remove('hidden');
}

async function refreshPlatformStatus(tryRestore = false) {
  const requestId = ++statusRequestId;
  setAccountStatus('loading', `正在检查${platformNames[currentPlatform]}`, '读取登录状态与歌单权限');
  disablePlaylist();
  try {
    let status = await request(`/api/${currentPlatform}/status`);
    if (requestId !== statusRequestId) return;
    platformStatus[currentPlatform] = status;
    platformReady[currentPlatform] = Boolean(status.configured);
    renderAuthFields();
    if (!status.configured) {
      setAccountStatus('offline', `${platformNames[currentPlatform]}未连接`, '展开下方凭据区域完成连接');
      elements.auth.open = true;
      return;
    }
    const accountId = status.uid || status.userid || '';
    setAccountStatus('online', `${platformNames[currentPlatform]}已连接`, accountId ? `UID ${accountId}` : '可以读取歌单');
    elements.auth.open = false;
    await loadPlaylists();
  } catch (error) {
    if (requestId !== statusRequestId) return;
    platformReady[currentPlatform] = false;
    renderAuthFields();
    elements.auth.open = true;
    setAccountStatus('offline', `${platformNames[currentPlatform]}连接失败`, error.message);
  }
}

async function connectCurrentPlatform() {
  const apiUrl = elements.api.value.trim();
  const proxyUrl = elements.proxy.value.trim();
  const cookie = elements.cookie.value.trim();
  if (!apiUrl || !cookie) return showToast('请填写 API 地址和 Cookie');
  elements.connect.disabled = true;
  elements.connect.textContent = '正在校验…';
  try {
    const status = await request(`/api/${currentPlatform}/config`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ api_url: apiUrl, proxy_url: proxyUrl, cookie }),
    });
    elements.cookie.value = '';
    platformStatus[currentPlatform] = { configured: true, api_url: apiUrl, proxy_url: proxyUrl, ...status };
    platformReady[currentPlatform] = true;
    renderAuthFields();
    elements.auth.open = false;
    const accountId = status.uid || status.userid || '';
    setAccountStatus('online', `${platformNames[currentPlatform]}已连接`, accountId ? `UID ${accountId}` : '可以读取歌单');
    await loadPlaylists();
  } catch (error) {
    platformReady[currentPlatform] = false;
    setAccountStatus('offline', `${platformNames[currentPlatform]}连接失败`, error.message);
    showToast(error.message);
  } finally {
    elements.connect.disabled = false;
    elements.connect.textContent = platformReady[currentPlatform] ? '重新校验并连接' : '校验并连接';
  }
}

async function loadPlaylists() {
  if (!platformReady[currentPlatform]) return disablePlaylist();
  elements.playlist.disabled = true;
  elements.playlistRefresh.disabled = true;
  elements.playlist.innerHTML = '<option value="">正在读取歌单…</option>';
  try {
    const result = await request(`/api/${currentPlatform}/playlists`);
    currentPlaylists = (result.playlists || []).filter((playlist) => Number(playlist.trackCount) > 0);
    elements.playlist.innerHTML = '<option value="">选择一个源歌单</option>' + currentPlaylists.map((playlist) =>
      `<option value="${escapeHtml(playlist.id)}">${escapeHtml(playlist.name)} (${Number(playlist.trackCount) || 0} 首)</option>`
    ).join('');
    if (!currentPlaylists.length) elements.playlist.innerHTML = '<option value="">账号下没有非空歌单</option>';
    elements.playlist.disabled = !currentPlaylists.length;
    elements.playlistRefresh.disabled = false;
  } catch (error) {
    currentPlaylists = [];
    elements.playlist.innerHTML = '<option value="">读取歌单失败</option>';
    elements.playlistRefresh.disabled = false;
    showToast(error.message);
  }
  updateGenerateState();
}

function disablePlaylist() {
  currentPlaylists = [];
  elements.playlist.disabled = true;
  elements.playlistRefresh.disabled = true;
  elements.playlist.innerHTML = '<option value="">请先连接平台</option>';
  updateGenerateState();
}

function updateGenerateState() {
  elements.generate.disabled = !platformReady[currentPlatform] || !elements.playlist.value;
  updateOverview();
}

function updateOverview() {
  const playlist = currentPlaylists.find((item) => String(item.id) === elements.playlist.value);
  elements.overviewPlatform.textContent = platformNames[currentPlatform];
  elements.overviewPlaylist.textContent = playlist?.name || '未选择';
  elements.overviewSeeds.textContent = `${elements.seedLimit.value} 首`;
  elements.overviewResults.textContent = `${elements.resultLimit.value} 首`;
  elements.overviewTitle.textContent = playlist?.name || '等待选择歌单';
}

async function generateRadio() {
  const playlistId = elements.playlist.value;
  const playlist = currentPlaylists.find((item) => String(item.id) === playlistId);
  if (!playlistId || !playlist) return showToast('请选择源歌单');
  elements.generate.disabled = true;
  elements.result.classList.add('hidden');
  currentHandoff = null;
  setProgress(12, '读取源歌单', `正在从${platformNames[currentPlatform]}读取《${playlist.name}》`);
  try {
    const params = new URLSearchParams({
      platform: currentPlatform,
      id: playlistId,
      max_seeds: elements.seedLimit.value,
    });
    const seedData = await request(`/api/playlist/seeds?${params}`);
    if (!seedData.seeds?.length) throw new Error('抽取的歌曲均未能映射到 Embeat 数据库');
    setProgress(62, '融合多曲种子', `成功映射 ${seedData.seeds.length} 首，正在生成推荐`);
    const recommendation = await request('/api/recommend/multi', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        track_ids: seedData.seeds.map((seed) => seed.track_id),
        limit: Number(elements.resultLimit.value) || 50,
        history_title: `${platformNames[currentPlatform]}歌单电台 · ${playlist.name}`,
      }),
    });
    setProgress(100, '电台生成完成', `已生成 ${recommendation.tracks.length} 首推荐歌曲`);
    currentHandoff = {
      data: recommendation,
      context: {
        platform: currentPlatform,
        platform_name: platformNames[currentPlatform],
        playlist_id: playlistId,
        playlist_name: playlist.name,
        playlist_total: seedData.playlist_total,
        sampled: seedData.sampled,
        matched: seedData.seeds.length,
        unmatched: seedData.unmatched || [],
      },
    };
    try { sessionStorage.setItem(RADIO_HANDOFF_KEY, JSON.stringify(currentHandoff)); } catch (error) { /* optional handoff */ }
    renderRadioResult(currentHandoff);
  } catch (error) {
    setProgress(0, '生成失败', error.message, true);
    showToast(error.message);
  } finally {
    elements.generate.disabled = false;
    updateGenerateState();
  }
}

function renderRadioResult(payload) {
  const { data, context } = payload;
  elements.result.classList.remove('hidden');
  elements.resultSummary.textContent = `《${context.playlist_name}》共 ${context.playlist_total} 首，抽取 ${context.sampled} 首并成功映射 ${context.matched} 首；生成 ${data.tracks.length} 首推荐。`;
  elements.seedSummary.innerHTML = data.seeds.map((seed) => `
    <span class="radio-seed-chip"><strong>${escapeHtml(seed.track_name_zh || seed.track_name)}</strong><small>${escapeHtml(seed.artist_name_zh || seed.artist_name)}</small></span>
  `).join('');
  const unmatched = context.unmatched || [];
  elements.unmatchedDetails.classList.toggle('hidden', !unmatched.length);
  elements.unmatchedSummary.textContent = `未映射歌曲（${unmatched.length}）`;
  elements.unmatchedList.innerHTML = unmatched.map((item) => `${escapeHtml(item.name)} - ${escapeHtml(item.artist)}`).join('<br>');
  elements.resultList.innerHTML = data.tracks.map((track, index) => `
    <article class="radio-result-item">
      <span class="radio-result-index">${index + 1}</span>
      <div class="radio-result-copy">
        <strong>${escapeHtml(track.track_name_zh || track.track_name)}</strong>
        <span>${escapeHtml(track.artist_name_zh || track.artist_name)}</span>
        <small>${escapeHtml(track.track_name)} · ${escapeHtml(track.artist_name)}</small>
      </div>
      <div class="radio-result-meta">
        <strong>${Math.round(Number(track.score || 0) * 100)}%</strong>
        <span>${(track.sources || []).map((source) => sourceNames[source] || source).join(' · ')}</span>
      </div>
    </article>
  `).join('');
  elements.result.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function openInMainPage() {
  if (!currentHandoff) return showToast('请先生成电台');
  try {
    sessionStorage.setItem(RADIO_HANDOFF_KEY, JSON.stringify(currentHandoff));
  } catch (error) {
    return showToast('浏览器无法暂存推荐结果');
  }
  window.location.href = '/?from=playlist-radio';
}

function setProgress(percent, phase, detail, failed = false) {
  elements.progress.classList.remove('hidden');
  elements.progress.dataset.status = failed ? 'failed' : percent >= 100 ? 'completed' : 'running';
  elements.progressBar.style.width = `${Math.max(0, Math.min(100, percent))}%`;
  elements.progressPercent.textContent = `${percent}%`;
  elements.progressPhase.textContent = phase;
  elements.progressDetail.textContent = detail;
}

function setAccountStatus(status, title, detail) {
  elements.accountStatus.dataset.status = status;
  elements.accountStatus.querySelector('strong').textContent = title;
  elements.accountStatus.querySelector('small').textContent = detail;
}

async function checkHealth() {
  try {
    const health = await request('/api/health');
    if (!health.ready) {
      elements.serviceStatus.className = 'service-status';
      elements.serviceStatus.querySelector('strong').textContent = '数据库初始化中';
      elements.serviceStatus.querySelector('small').textContent = '请稍候';
    } else {
      elements.serviceStatus.className = 'service-status online';
      elements.serviceStatus.querySelector('strong').textContent = '数据库在线';
      elements.serviceStatus.querySelector('small').textContent = `${formatNumber(health.points)} 首歌曲`;
    }
  } catch (error) {
    elements.serviceStatus.className = 'service-status offline';
    elements.serviceStatus.querySelector('strong').textContent = '数据库离线';
    elements.serviceStatus.querySelector('small').textContent = '检查 Qdrant';
  } finally {
    setTimeout(checkHealth, 5000);
  }
}

async function request(url, options = {}) {
  const response = await fetch(url, {...options, credentials: 'same-origin'});
  const data = await response.json().catch(() => ({}));
  if (response.status === 401) window.EmbeatAuth?.show();
  if (!response.ok) throw new Error(data.error || `请求失败 (${response.status})`);
  return data;
}

let toastTimer;
function showToast(message) {
  clearTimeout(toastTimer);
  elements.toast.textContent = message;
  elements.toast.classList.remove('hidden');
  toastTimer = setTimeout(() => elements.toast.classList.add('hidden'), 5000);
}

function formatNumber(value) {
  return new Intl.NumberFormat('zh-CN').format(value);
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>'"]/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;',
  })[char]);
}

window.embeatAuthReady.then(async () => {
  try { localStorage.removeItem(NETEASE_STORAGE_KEY); } catch (error) { /* storage may be unavailable */ }
  await prefillPlatformDefaults();
  renderAuthFields();
  updateOverview();
  checkHealth();
  refreshPlatformStatus(true);
});
