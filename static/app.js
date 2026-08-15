const elements = {
  searchForm: document.querySelector('#search-form'),
  idForm: document.querySelector('#id-form'),
  trackName: document.querySelector('#track-name'),
  artistName: document.querySelector('#artist-name'),
  trackId: document.querySelector('#track-id'),
  empty: document.querySelector('#empty-state'),
  candidates: document.querySelector('#candidate-view'),
  recommendations: document.querySelector('#recommend-view'),
  loading: document.querySelector('#loading-state'),
  loadingTitle: document.querySelector('#loading-title'),
  loadingDetail: document.querySelector('#loading-detail'),
  candidateList: document.querySelector('#candidate-list'),
  candidateSummary: document.querySelector('#candidate-summary'),
  candidatePageSize: document.querySelector('#candidate-page-size'),
  candidatePagination: document.querySelector('#candidate-pagination'),
  resultList: document.querySelector('#result-list'),
  seedPanel: document.querySelector('#seed-panel'),
  recommendSummary: document.querySelector('#recommend-summary'),
  title: document.querySelector('#view-title'),
  eyebrow: document.querySelector('#view-eyebrow'),
  meta: document.querySelector('#topbar-meta'),
  status: document.querySelector('#service-status'),
  toast: document.querySelector('#toast'),
  selectAll: document.querySelector('#select-all'),
  neteaseOpen: document.querySelector('#netease-open'),
  neteaseModal: document.querySelector('#netease-modal'),
  neteaseAuth: document.querySelector('#netease-auth'),
  neteaseExport: document.querySelector('#netease-export'),
  neteaseProgress: document.querySelector('#netease-progress'),
  neteaseResult: document.querySelector('#netease-result'),
  neteaseApi: document.querySelector('#netease-api'),
  neteaseProxy: document.querySelector('#netease-proxy'),
  neteaseCookie: document.querySelector('#netease-cookie'),
  neteaseConnect: document.querySelector('#netease-connect'),
  neteasePlaylist: document.querySelector('#netease-playlist'),
  neteaseNewName: document.querySelector('#netease-new-name'),
  neteaseRefresh: document.querySelector('#netease-refresh'),
  neteaseSubmit: document.querySelector('#netease-submit'),
  neteaseUid: document.querySelector('#netease-uid'),
  selectedCount: document.querySelector('#selected-count'),
  neteaseProgressPhase: document.querySelector('#netease-progress-phase'),
  neteaseProgressBar: document.querySelector('#netease-progress-bar'),
  neteaseProgressCount: document.querySelector('#netease-progress-count'),
  neteaseProgressPercent: document.querySelector('#netease-progress-percent'),
  neteaseProgressCurrent: document.querySelector('#netease-progress-current'),
  neteasePlatformProgress: document.querySelector('#netease-platform-progress'),
  kugouPlatformProgress: document.querySelector('#kugou-platform-progress'),
  kugouProgressPhase: document.querySelector('#kugou-progress-phase'),
  kugouProgressBar: document.querySelector('#kugou-progress-bar'),
  kugouProgressCount: document.querySelector('#kugou-progress-count'),
  kugouProgressPercent: document.querySelector('#kugou-progress-percent'),
  kugouProgressCurrent: document.querySelector('#kugou-progress-current'),
  neteaseForget: document.querySelector('#netease-forget'),
  exportTarget: document.querySelector('#export-target'),
  exportControls: document.querySelector('#export-controls'),
  kugouAuth: document.querySelector('#kugou-auth'),
  kugouExport: document.querySelector('#kugou-export'),
  kugouApi: document.querySelector('#kugou-api'),
  kugouProxy: document.querySelector('#kugou-proxy'),
  kugouCookie: document.querySelector('#kugou-cookie'),
  kugouConnect: document.querySelector('#kugou-connect'),
  kugouPlaylist: document.querySelector('#kugou-playlist'),
  kugouNewName: document.querySelector('#kugou-new-name'),
  kugouRefresh: document.querySelector('#kugou-refresh'),
  kugouUid: document.querySelector('#kugou-uid'),
  multiSeedButton: document.querySelector('#multi-seed-button'),
  resultLimit: document.querySelector('#result-limit'),
  resultPageSize: document.querySelector('#result-page-size'),
  resultSort: document.querySelector('#result-sort'),
  sourceFilters: document.querySelector('#source-filters'),
  genreFilters: document.querySelector('#genre-filters'),
  popularityMin: document.querySelector('#popularity-min'),
  popularityValue: document.querySelector('#popularity-value'),
  pagination: document.querySelector('#pagination'),
  historyOpen: document.querySelector('#history-open'),
  historyExport: document.querySelector('#history-export'),
  historyView: document.querySelector('#history-view'),
  historyList: document.querySelector('#history-list'),
  resultCards: document.querySelector('#result-cards'),
  weeklyDiscover: document.querySelector('#weekly-discover'),
  genreSelect: document.querySelector('#genre-select'),
  genreBrowse: document.querySelector('#genre-browse'),
};

let currentTracks = [];
let currentCandidateTracks = [];
let currentCandidatePage = 1;
let selectedCandidateIds = new Set();
let currentSeeds = [];
let currentPage = 1;
let activeSources = new Set();
let activeGenres = new Set();
let selectedTrackIds = new Set();
let currentDiscovery = null;
let genreOptionsLoaded = false;
const platformReady = { netease: false, kugou: false };
const NETEASE_STORAGE_KEY = 'embeat_ui_netease_config_v1'; // migration cleanup only
const HISTORY_STORAGE_KEY = 'embeat_ui_history_v1';
const RADIO_HANDOFF_KEY = 'embeat_ui_radio_handoff_v1';

const sourceNames = {
  similar: '声学相似',
  popular: '流派热门',
  same_artist: '同艺人',
  related_artist: '相似艺人',
  related_track: '歌单关联',
};

elements.searchForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const name = elements.trackName.value.trim();
  const artist = elements.artistName.value.trim();
  if (!name) return;
  setLoading('正在搜索歌曲', '匹配数据库中的曲名与版本');
  try {
    const params = new URLSearchParams({ name, artist, limit: '50' });
    const data = await request(`/api/search?${params}`);
    renderCandidates(data.tracks, name, artist);
  } catch (error) {
    showEmpty();
    showToast(error.message);
  }
});

elements.idForm.addEventListener('submit', (event) => {
  event.preventDefault();
  const id = elements.trackId.value.trim();
  if (id) loadRecommendations(id);
});

elements.candidateList.addEventListener('click', (event) => {
  const button = event.target.closest('[data-track-id]');
  if (button && !event.target.matches('.candidate-check')) loadRecommendations(button.dataset.trackId);
});
elements.candidateList.addEventListener('change', (event) => {
  if (!event.target.matches('.candidate-check')) return;
  event.target.checked ? selectedCandidateIds.add(event.target.value) : selectedCandidateIds.delete(event.target.value);
});
elements.candidatePageSize.addEventListener('change', () => { currentCandidatePage = 1; renderCandidatePage(); });
elements.candidatePagination.addEventListener('click', (event) => {
  const page = Number(event.target.dataset.page);
  if (page) { currentCandidatePage = page; renderCandidatePage(); }
});

elements.resultList.addEventListener('click', (event) => {
  const button = event.target.closest('[data-track-id]');
  if (button) loadRecommendations(button.dataset.trackId);
});

elements.selectAll.addEventListener('change', () => {
  filteredTracks().forEach((track) => elements.selectAll.checked ? selectedTrackIds.add(track.track_id) : selectedTrackIds.delete(track.track_id));
  document.querySelectorAll('.track-check').forEach((checkbox) => { checkbox.checked = elements.selectAll.checked; });
  updateSelectedCount();
});
elements.resultList.addEventListener('change', (event) => {
  if (event.target.matches('.track-check')) {
    event.target.checked ? selectedTrackIds.add(event.target.value) : selectedTrackIds.delete(event.target.value);
    updateSelectedCount();
  }
});
elements.neteaseOpen.addEventListener('click', openNeteaseModal);
elements.neteaseModal.addEventListener('click', (event) => {
  if (event.target.hasAttribute('data-close-modal')) elements.neteaseModal.classList.add('hidden');
});
elements.neteaseConnect.addEventListener('click', connectNetease);
elements.neteaseRefresh.addEventListener('click', loadNeteasePlaylists);
elements.neteasePlaylist.addEventListener('change', () => {
  elements.neteaseNewName.classList.toggle('hidden', elements.neteasePlaylist.value !== 'NEW');
});
elements.neteaseSubmit.addEventListener('click', exportToNetease);
elements.neteaseForget.addEventListener('click', forgetNeteaseCredentials);
elements.exportTarget.addEventListener('change', prepareSelectedExportPlatforms);
elements.kugouConnect.addEventListener('click', connectKugou);
elements.kugouRefresh.addEventListener('click', loadKugouPlaylists);
elements.kugouPlaylist.addEventListener('change', () => {
  elements.kugouNewName.classList.toggle('hidden', elements.kugouPlaylist.value !== 'NEW');
});
elements.multiSeedButton.addEventListener('click', loadMultiSeedRecommendations);
elements.resultLimit.addEventListener('change', () => {
  if (currentDiscovery?.type === 'weekly') return loadWeeklyDiscovery();
  if (currentDiscovery?.type === 'genre') return loadGenreDiscovery(currentDiscovery.genre);
  return currentSeeds.length > 1
    ? loadRecommendationsForSeeds(currentSeeds.map((seed) => seed.track_id))
    : loadRecommendations(currentSeeds[0]?.track_id);
});
elements.resultPageSize.addEventListener('change', () => { currentPage = 1; renderResultRows(); });
elements.resultSort.addEventListener('change', () => { currentPage = 1; renderResultRows(); });
elements.popularityMin.addEventListener('input', () => { elements.popularityValue.textContent = elements.popularityMin.value; currentPage = 1; renderResultRows(); });
elements.sourceFilters.addEventListener('click', handleFilterClick);
elements.genreFilters.addEventListener('click', handleFilterClick);
elements.pagination.addEventListener('click', (event) => {
  const page = Number(event.target.dataset.page);
  if (page) { currentPage = page; renderResultRows(); }
});
elements.historyOpen.addEventListener('click', renderHistory);
elements.historyExport.addEventListener('click', exportHistory);
elements.historyList.addEventListener('click', restoreHistoryItem);
elements.weeklyDiscover.addEventListener('click', loadWeeklyDiscovery);
elements.genreBrowse.addEventListener('click', () => loadGenreDiscovery());
elements.resultCards.addEventListener('click', (event) => {
  const button = event.target.closest('[data-track-id]');
  if (button && !event.target.matches('.track-check')) loadRecommendations(button.dataset.trackId);
});
elements.resultCards.addEventListener('change', (event) => {
  if (event.target.matches('.track-check')) {
    event.target.checked ? selectedTrackIds.add(event.target.value) : selectedTrackIds.delete(event.target.value);
    updateSelectedCount();
  }
});

async function loadRecommendations(trackId) {
  if (!trackId) return;
  setLoading('正在生成推荐', '执行多路召回与融合排序');
  try {
    const data = await request('/api/recommend', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ track_id: trackId, limit: Number(elements.resultLimit.value) || 20 }),
    });
    renderRecommendations(data);
  } catch (error) {
    showEmpty();
    showToast(error.message);
  }
}

async function loadRecommendationsForSeeds(trackIds, title = '') {
  const ids = Array.from(new Set(trackIds.filter(Boolean)));
  if (!ids.length) return showToast('请至少选择一首种子歌曲');
  if (ids.length === 1) return loadRecommendations(ids[0]);
  setLoading('正在生成多曲电台', `融合 ${ids.length} 首种子的推荐结果`);
  try {
    const data = await request('/api/recommend/multi', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ track_ids: ids, limit: Number(elements.resultLimit.value) || 50, history_title: title || `${ids.length} 首种子电台` }),
    });
    renderRecommendations(data);
  } catch (error) {
    showEmpty(); showToast(error.message);
  }
}

function loadMultiSeedRecommendations() {
  loadRecommendationsForSeeds(Array.from(selectedCandidateIds));
}

function renderCandidates(tracks, name, artist) {
  showView('candidates');
  elements.eyebrow.textContent = '歌曲搜索';
  elements.title.textContent = artist ? `${name} · ${artist}` : name;
  elements.meta.innerHTML = `<strong>${tracks.length}</strong> 个候选版本`;
  elements.candidateSummary.textContent = tracks.length ? '选择准确的歌曲版本' : '没有找到匹配歌曲，可尝试繁体曲名、英文艺人名或 Spotify ID';
  currentCandidateTracks = tracks;
  currentCandidatePage = 1;
  selectedCandidateIds = new Set();
  renderCandidatePage();
}

function renderCandidatePage() {
  const pageSize = Number(elements.candidatePageSize.value) || 10;
  const pages = Math.max(1, Math.ceil(currentCandidateTracks.length / pageSize));
  currentCandidatePage = Math.min(currentCandidatePage, pages);
  const pageTracks = currentCandidateTracks.slice((currentCandidatePage - 1) * pageSize, currentCandidatePage * pageSize);
  elements.candidateList.innerHTML = pageTracks.map((track) => `
    <button class="candidate" type="button" data-track-id="${escapeHtml(track.track_id)}">
      <input class="candidate-check" type="checkbox" value="${escapeHtml(track.track_id)}" ${selectedCandidateIds.has(track.track_id) ? 'checked' : ''} aria-label="选择为电台种子">
      <span class="track-art"><span>${escapeHtml(initial(track.track_name))}</span></span>
      <span class="track-copy">
        <strong>${escapeHtml(track.track_name)}</strong>
        <span>${escapeHtml(track.artist_name)} · ${escapeHtml(track.album_name)}</span>
        <small>${escapeHtml(track.track_id)}</small>
      </span>
      <span class="arrow" aria-hidden="true">›</span>
    </button>
  `).join('');
  elements.candidatePagination.innerHTML = paginationButtons(currentCandidatePage, pages);
}

function renderRecommendations(data) {
  const seeds = Array.isArray(data?.seeds) ? data.seeds : (data?.seed ? [data.seed] : []);
  if (!Array.isArray(data?.tracks) || !seeds.length) {
    showToast('该历史记录缺少完整推荐结果，无法恢复');
    return false;
  }
  const tracks = data.tracks;
  const elapsed = Number(data.elapsed_ms || 0);
  const seed = seeds[0];
  currentSeeds = seeds;
  currentDiscovery = null;
  currentTracks = tracks;
  selectedTrackIds = new Set(tracks.map((track) => track.track_id));
  currentPage = 1; activeSources = new Set(); activeGenres = new Set();
  showView('recommendations');
  elements.eyebrow.textContent = '推荐结果';
  elements.title.textContent = seeds.length > 1 ? `${seeds.length} 首种子电台` : seed.track_name;
  elements.meta.innerHTML = `<strong>${tracks.length}</strong> 首 · ${elapsed} ms`;
  elements.recommendSummary.textContent = seeds.length > 1 ? `融合 ${seeds.map((item) => item.track_name_zh).slice(0, 4).join('、')}${seeds.length > 4 ? '…' : ''}` : `基于 ${seed.artist_name} · ${seed.album_name}`;
  elements.seedPanel.innerHTML = `
    <div class="track-art"><span>${escapeHtml(initial(seed.track_name))}</span></div>
    <div>
      <h2>${seeds.length > 1 ? escapeHtml(`${seeds.length} 首歌曲共同作为种子`) : escapeHtml(seed.track_name)}</h2>
      <p>${seeds.length > 1 ? escapeHtml(seeds.map((item) => `${item.track_name_zh} - ${item.artist_name_zh}`).slice(0, 5).join(' · ')) : `${escapeHtml(seed.artist_name)} · ${escapeHtml(seed.album_name)}`}</p>
      <small>${seeds.length > 1 ? 'Multi-seed radio' : escapeHtml(seed.track_id)}</small>
    </div>
  `;
  elements.selectAll.checked = true;
  buildFilters();
  renderResultRows();
  return true;
}

function restorePlaylistRadioHandoff() {
  let payload = null;
  try {
    payload = JSON.parse(sessionStorage.getItem(RADIO_HANDOFF_KEY) || 'null');
    sessionStorage.removeItem(RADIO_HANDOFF_KEY);
  } catch (error) {
    payload = null;
  }
  if (!payload?.data?.tracks?.length) return false;
  renderRecommendations(payload.data);
  const context = payload.context || {};
  const platformName = context.platform_name || (context.platform === 'kugou' ? '酷狗音乐' : '网易云音乐');
  const playlistName = context.playlist_name || '歌单';
  elements.title.textContent = `${playlistName} · 电台`;
  elements.recommendSummary.textContent = `${platformName}《${playlistName}》共 ${context.playlist_total || 0} 首，抽取 ${context.sampled || 0} 首并成功映射 ${context.matched || payload.data.seeds?.length || 0} 首种子。`;
  const unmatched = Array.isArray(context.unmatched) ? context.unmatched.length : 0;
  showToast(`已载入歌单电台：${payload.data.tracks.length} 首推荐${unmatched ? `，${unmatched} 首抽样歌曲未映射` : ''}`);
  return true;
}

function filteredTracks() {
  const minimumPopularity = Number(elements.popularityMin.value) / 100;
  let tracks = currentTracks.filter((track) => {
    const sourceOk = !activeSources.size || track.sources.some((source) => activeSources.has(source));
    const genres = splitGenres(track.artist_genres);
    const genreOk = !activeGenres.size || genres.some((genre) => activeGenres.has(genre));
    return sourceOk && genreOk && track.popularity >= minimumPopularity;
  });
  const sort = elements.resultSort.value;
  tracks = [...tracks].sort((a, b) => {
    if (sort === 'popularity') return b.popularity - a.popularity || b.score - a.score;
    if (sort === 'seed_hits') return (b.seed_hits || 1) - (a.seed_hits || 1) || b.score - a.score;
    return b.score - a.score || b.popularity - a.popularity;
  });
  return tracks;
}

function renderResultRows() {
  const tracks = filteredTracks();
  const pageSize = Number(elements.resultPageSize.value) || 10;
  const pages = Math.max(1, Math.ceil(tracks.length / pageSize));
  currentPage = Math.min(currentPage, pages);
  const pageTracks = tracks.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  elements.resultList.innerHTML = pageTracks.map((track) => `
    <tr>
      <td><input class="track-check" type="checkbox" value="${escapeHtml(track.track_id)}" ${selectedTrackIds.has(track.track_id) ? 'checked' : ''} aria-label="选择 ${escapeHtml(track.track_name)}"></td>
      <td class="song-cell"><strong>${escapeHtml(track.track_name)}</strong><span>${escapeHtml(track.artist_name)}</span></td>
      <td class="song-cell"><strong>${escapeHtml(track.track_name_zh)}</strong><span>${escapeHtml(track.artist_name_zh)}</span></td>
      <td class="album-cell" title="${escapeHtml(track.album_name)}">${escapeHtml(track.album_name)}</td>
      <td><div class="source-list">${track.sources.map((source) => `<span class="source">${escapeHtml(sourceNames[source] || source)}</span>`).join('')}</div></td>
      <td class="score">${Math.round(track.score * 100)}%</td>
      <td><button class="recommend-again" type="button" data-track-id="${escapeHtml(track.track_id)}" title="以此歌曲继续推荐">›</button></td>
    </tr>
  `).join('');
  elements.resultCards.innerHTML = pageTracks.map((track) => `
    <article class="result-card">
      <div class="result-card-head">
        <input class="track-check" type="checkbox" value="${escapeHtml(track.track_id)}" ${selectedTrackIds.has(track.track_id) ? 'checked' : ''} aria-label="选择 ${escapeHtml(track.track_name)}">
        <div class="result-card-title"><strong>${escapeHtml(track.track_name)}</strong><span>${escapeHtml(track.artist_name)}</span></div>
        <span class="result-card-score">${Math.round(track.score * 100)}%</span>
      </div>
      <div class="result-card-zh"><strong>${escapeHtml(track.track_name_zh)}</strong> · ${escapeHtml(track.artist_name_zh)}</div>
      <div class="result-card-meta"><span>热度 ${Math.round(track.popularity * 100)}</span><span>${escapeHtml(track.album_name)}</span>${splitGenres(track.artist_genres).slice(0, 2).map((genre) => `<span>${escapeHtml(genre)}</span>`).join('')}</div>
      <div class="result-card-actions"><div class="source-list">${track.sources.map((source) => `<span class="source">${escapeHtml(sourceNames[source] || source)}</span>`).join('')}</div><button class="recommend-again" type="button" data-track-id="${escapeHtml(track.track_id)}">›</button></div>
    </article>`).join('');
  elements.meta.innerHTML = `<strong>${tracks.length}</strong> 首 · 第 ${currentPage}/${pages} 页`;
  elements.pagination.innerHTML = paginationButtons(currentPage, pages);
  updateSelectedCount();
}

function paginationButtons(current, pages) {
  return Array.from({ length: pages }, (_, index) => `<button type="button" data-page="${index + 1}" class="${index + 1 === current ? 'active' : ''}">${index + 1}</button>`).join('');
}

async function loadWeeklyDiscovery() {
  setLoading('每周新发现', '生成本周轮换发现榜');
  try {
    const data = await request(`/api/discover/weekly?limit=${Number(elements.resultLimit.value) || 50}`);
    renderDiscovery(data.tracks, `每周新发现 · ${data.week}`, data.note, { type: 'weekly' });
  } catch (error) { showEmpty(); showToast(error.message); }
}

async function loadGenreDiscovery(requestedGenre = '') {
  const genre = requestedGenre || elements.genreSelect.value;
  if (!genre) return showToast('请选择流派');
  elements.genreSelect.value = genre;
  setLoading('按流派找歌', `正在读取 ${genre}`);
  try {
    const data = await request(`/api/discover/genre?genre=${encodeURIComponent(genre)}&limit=${Number(elements.resultLimit.value) || 50}`);
    renderDiscovery(data.tracks, data.genre, '按热度浏览该流派', { type: 'genre', genre: data.genre });
  } catch (error) { showEmpty(); showToast(error.message); }
}

function renderDiscovery(tracks, title, note, discovery = null) {
  currentSeeds = [];
  currentDiscovery = discovery;
  currentTracks = tracks;
  selectedTrackIds = new Set(tracks.map((track) => track.track_id));
  currentPage = 1; activeSources = new Set(); activeGenres = new Set();
  showView('recommendations');
  elements.eyebrow.textContent = 'Discover'; elements.title.textContent = title;
  elements.recommendSummary.textContent = note || '';
  elements.seedPanel.innerHTML = `<div class="track-art"><span>✦</span></div><div><h2>${escapeHtml(title)}</h2><p>${escapeHtml(note || '')}</p><small>Discovery collection</small></div>`;
  buildFilters(); renderResultRows();
}

async function loadGenreOptions() {
  if (genreOptionsLoaded) return;
  try {
    const data = await request('/api/discover/genres?limit=300');
    elements.genreSelect.innerHTML = '<option value="">按流派找歌</option>' + data.genres.map((genre) => `<option value="${escapeHtml(genre)}">${escapeHtml(genre)}</option>`).join('');
    genreOptionsLoaded = true;
  } catch (error) { /* health polling will surface database errors */ }
}

function buildFilters() {
  const sources = Array.from(new Set(currentTracks.flatMap((track) => track.sources))).sort();
  const genreCounts = new Map();
  currentTracks.flatMap((track) => splitGenres(track.artist_genres)).forEach((genre) => genreCounts.set(genre, (genreCounts.get(genre) || 0) + 1));
  const genres = Array.from(genreCounts.entries()).sort((a, b) => b[1] - a[1]).slice(0, 12).map(([genre]) => genre);
  elements.sourceFilters.innerHTML = sources.map((source) => `<button class="filter-chip" type="button" data-filter="source" data-value="${escapeHtml(source)}">${escapeHtml(sourceNames[source] || source)}</button>`).join('');
  elements.genreFilters.innerHTML = genres.map((genre) => `<button class="filter-chip" type="button" data-filter="genre" data-value="${escapeHtml(genre)}">${escapeHtml(genre)}</button>`).join('') || '<small>无流派数据</small>';
}

function handleFilterClick(event) {
  const button = event.target.closest('.filter-chip');
  if (!button) return;
  const set = button.dataset.filter === 'source' ? activeSources : activeGenres;
  set.has(button.dataset.value) ? set.delete(button.dataset.value) : set.add(button.dataset.value);
  button.classList.toggle('active'); currentPage = 1; renderResultRows();
}

function splitGenres(value) {
  return String(value || '').split(',').map((item) => item.trim()).filter(Boolean);
}

function selectedTracks() {
  return currentTracks.filter((track) => selectedTrackIds.has(track.track_id));
}

function updateSelectedCount() {
  const count = selectedTracks().length;
  elements.selectedCount.textContent = count;
  const filtered = filteredTracks();
  const filteredSelected = filtered.filter((track) => selectedTrackIds.has(track.track_id)).length;
  elements.selectAll.checked = filtered.length > 0 && filteredSelected === filtered.length;
  elements.selectAll.indeterminate = filteredSelected > 0 && filteredSelected < filtered.length;
}

async function openNeteaseModal() {
  if (!selectedTracks().length) return showToast('请先选择至少一首推荐歌曲');
  elements.neteaseModal.classList.remove('hidden');
  elements.neteaseResult.classList.add('hidden');
  elements.neteaseProgress.classList.add('hidden');
  elements.exportControls.classList.remove('hidden');
  updateSelectedCount();
  updateExportTargetVisibility();
  await prepareSelectedExportPlatforms();
}

function selectedExportTarget() {
  return elements.exportTarget.querySelector('input[name="export-target"]:checked')?.value || 'netease';
}

function requestedPlatforms() {
  const target = selectedExportTarget();
  return target === 'both' ? ['netease', 'kugou'] : [target];
}

function updateExportTargetVisibility() {
  const selected = new Set(requestedPlatforms());
  document.querySelectorAll('[data-export-platform]').forEach((panel) => {
    const platform = panel.dataset.exportPlatform;
    const isAuth = panel.id.endsWith('-auth');
    panel.classList.toggle('hidden', !selected.has(platform) || (isAuth ? platformReady[platform] : !platformReady[platform]));
  });
}

async function prepareSelectedExportPlatforms() {
  updateExportTargetVisibility();
  const loaders = requestedPlatforms()
    .filter((platform) => !platformReady[platform])
    .map((platform) => platform === 'netease' ? prepareNetease() : prepareKugou());
  const results = await Promise.allSettled(loaders);
  results.filter((result) => result.status === 'rejected').forEach((result) => showToast(result.reason.message));
  updateExportTargetVisibility();
}

async function prepareNetease() {
  try {
    const status = await request('/api/netease/status');
    if (status.configured) {
      platformReady.netease = true;
      elements.neteaseUid.textContent = status.uid;
      await loadNeteasePlaylists();
      return;
    }
    platformReady.netease = await restoreNeteaseConnection();
  } catch (error) {
    platformReady.netease = false;
    throw error;
  }
}

async function connectNetease() {
  const apiUrl = elements.neteaseApi.value.trim();
  const cookie = elements.neteaseCookie.value.trim();
  const proxyUrl = elements.neteaseProxy.value.trim();
  if (!apiUrl || !cookie) return showToast('请填写 API 地址和 Cookie');
  elements.neteaseConnect.disabled = true;
  elements.neteaseConnect.textContent = '正在校验…';
  try {
    const result = await request('/api/netease/config', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ api_url: apiUrl, cookie, proxy_url: proxyUrl }),
    });
    elements.neteaseCookie.value = '';
    elements.neteaseUid.textContent = result.uid;
    platformReady.netease = true;
    await loadNeteasePlaylists();
    updateExportTargetVisibility();
  } catch (error) {
    showToast(error.message);
  } finally {
    elements.neteaseConnect.disabled = false;
    elements.neteaseConnect.textContent = '校验并连接';
  }
}

function savedNeteaseConfig() {
  return null;
}

async function restoreNeteaseConnection() {
  return false;
}

async function forgetNeteaseCredentials() {
  await request('/api/netease/config', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({clear: true})});
  platformReady.netease = false;
  elements.neteaseCookie.value = '';
  updateExportTargetVisibility();
  showToast('已清除当前用户的网易云凭据');
}

async function loadNeteasePlaylists() {
  elements.neteaseRefresh.disabled = true;
  try {
    const result = await request('/api/netease/playlists');
    elements.neteasePlaylist.innerHTML = '<option value="NEW">＋ 新建歌单</option>' + result.playlists.map((playlist) =>
      `<option value="${escapeHtml(playlist.id)}">${escapeHtml(playlist.name)} (${playlist.trackCount} 首)</option>`
    ).join('');
    elements.neteaseNewName.classList.remove('hidden');
  } catch (error) {
    showToast(error.message);
  } finally {
    elements.neteaseRefresh.disabled = false;
  }
}

async function prepareKugou() {
  try {
    const status = await request('/api/kugou/status');
    platformReady.kugou = Boolean(status.configured);
    if (!platformReady.kugou) return;
    elements.kugouUid.textContent = status.userid || '';
    elements.kugouApi.value = status.api_url || elements.kugouApi.value;
    elements.kugouProxy.value = status.proxy_url || '';
    await loadKugouPlaylists();
  } catch (error) {
    platformReady.kugou = false;
    throw error;
  }
}

async function connectKugou() {
  const apiUrl = elements.kugouApi.value.trim();
  const proxyUrl = elements.kugouProxy.value.trim();
  const cookie = elements.kugouCookie.value.trim();
  if (!apiUrl || !cookie) return showToast('请填写酷狗 API 地址和 Cookie');
  elements.kugouConnect.disabled = true;
  elements.kugouConnect.textContent = '正在校验…';
  try {
    const result = await request('/api/kugou/config', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ api_url: apiUrl, proxy_url: proxyUrl, cookie }),
    });
    platformReady.kugou = true;
    elements.kugouCookie.value = '';
    elements.kugouUid.textContent = result.userid || '';
    await loadKugouPlaylists();
    updateExportTargetVisibility();
  } catch (error) {
    showToast(error.message);
  } finally {
    elements.kugouConnect.disabled = false;
    elements.kugouConnect.textContent = '校验并保存';
  }
}

async function loadKugouPlaylists() {
  elements.kugouRefresh.disabled = true;
  try {
    const result = await request('/api/kugou/playlists');
    elements.kugouPlaylist.innerHTML = '<option value="NEW">＋ 新建歌单</option>' + result.playlists.map((playlist) =>
      `<option value="${escapeHtml(playlist.id)}">${escapeHtml(playlist.name)} (${playlist.trackCount} 首)</option>`
    ).join('');
    elements.kugouNewName.classList.remove('hidden');
  } finally {
    elements.kugouRefresh.disabled = false;
  }
}

async function exportToNetease() {
  const tracks = selectedTracks();
  if (!tracks.length) return showToast('请至少选择一首歌曲');
  const target = selectedExportTarget();
  const missing = requestedPlatforms().filter((platform) => !platformReady[platform]);
  if (missing.length) return showToast(`请先连接${missing.map((platform) => platform === 'netease' ? '网易云' : '酷狗').join('和')}`);
  if (requestedPlatforms().includes('netease') && elements.neteasePlaylist.value === 'NEW' && !elements.neteaseNewName.value.trim()) return showToast('请填写网易云新歌单名称');
  if (requestedPlatforms().includes('kugou') && elements.kugouPlaylist.value === 'NEW' && !elements.kugouNewName.value.trim()) return showToast('请填写酷狗新歌单名称');
  document.querySelectorAll('[data-export-platform]').forEach((panel) => panel.classList.add('hidden'));
  elements.exportControls.classList.add('hidden');
  elements.neteaseProgress.classList.remove('hidden');
  try {
    resetExportProgress(tracks.length);
    const started = await request('/api/export/start', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        target,
        netease: { playlist_id: elements.neteasePlaylist.value, playlist_name: elements.neteaseNewName.value.trim() },
        kugou: { playlist_id: elements.kugouPlaylist.value, playlist_name: elements.kugouNewName.value.trim() },
        tracks: tracks.map(({ track_name, artist_name, track_name_zh, artist_name_zh }) => ({ track_name, artist_name, track_name_zh, artist_name_zh })),
      }),
    });
    const result = await waitForExport(started.job_id);
    elements.neteaseProgress.classList.add('hidden');
    elements.neteaseResult.classList.remove('hidden');
    elements.neteaseResult.innerHTML = `${Object.entries(result.targets || {}).map(([platform, platformResult]) => renderPlatformExportResult(platform, platformResult)).join('')}<button class="secondary-button" type="button" data-close-modal>关闭</button>`;
  } catch (error) {
    elements.neteaseProgress.classList.add('hidden');
    elements.exportControls.classList.remove('hidden');
    updateExportTargetVisibility();
    showToast(error.message);
  }
}

function renderPlatformExportResult(platform, result) {
  const platformName = platform === 'netease' ? '网易云音乐' : '酷狗音乐';
  if (!result.ok) return `<div class="result-failure"><h3>${platformName}保存失败</h3><p>${escapeHtml(result.error || '未知错误')}</p></div>`;
  const failures = result.failed || [];
  const matched = result.matched || [];
  const skippedExisting = result.skipped_existing || [];
  const nameKey = platform === 'netease' ? 'netease_name' : 'kugou_name';
  const artistKey = platform === 'netease' ? 'netease_artist' : 'kugou_artist';
  return `
    <div class="platform-result">
      <div class="result-success"><h3>${platformName}保存完成</h3><p>新增 ${result.added} 首，目标歌单原有重复 ${result.skipped} 首，匹配失败 ${failures.length} 首。</p><p>目标歌单 ID：${escapeHtml(result.playlist_id)}</p></div>
      ${matched.length ? `<details class="mapping-details" open><summary>新增匹配明细（${matched.length}）</summary><div class="mapping-list">${matched.map((item) => `${escapeHtml(item.track_name)} - ${escapeHtml(item.artist_name)} → <strong>${escapeHtml(item[nameKey])}</strong> - ${escapeHtml(item[artistKey])} <em>${Math.round(Number(item.match_score || 0) * 100)}%</em>`).join('<br>')}</div></details>` : ''}
      ${skippedExisting.length ? `<details class="mapping-details"><summary>歌单已有歌曲（${skippedExisting.length}）</summary><div class="mapping-list">${skippedExisting.map((item) => `${escapeHtml(item.track_name)} - ${escapeHtml(item.artist_name)} → ${escapeHtml(item[nameKey])} - ${escapeHtml(item[artistKey])}`).join('<br>')}</div></details>` : ''}
      ${failures.length ? `<div class="failed-list">${failures.map((item) => `${escapeHtml(item.track_name)} - ${escapeHtml(item.artist_name)}：${escapeHtml(item.reason)}`).join('<br>')}</div>` : ''}
    </div>`;
}

function resetExportProgress(total) {
  const selected = new Set(requestedPlatforms());
  for (const platform of ['netease', 'kugou']) {
    const ui = platformProgressUi(platform);
    ui.container.classList.toggle('hidden', !selected.has(platform));
    ui.container.dataset.status = 'queued';
    ui.bar.style.width = '0%';
    ui.percent.textContent = '0%';
    ui.count.textContent = `0 / ${total}`;
    ui.phase.textContent = '等待开始';
    ui.current.textContent = '正在创建任务';
  }
}

function platformProgressUi(platform) {
  return platform === 'netease' ? {
    container: elements.neteasePlatformProgress,
    phase: elements.neteaseProgressPhase,
    bar: elements.neteaseProgressBar,
    count: elements.neteaseProgressCount,
    percent: elements.neteaseProgressPercent,
    current: elements.neteaseProgressCurrent,
  } : {
    container: elements.kugouPlatformProgress,
    phase: elements.kugouProgressPhase,
    bar: elements.kugouProgressBar,
    count: elements.kugouProgressCount,
    percent: elements.kugouProgressPercent,
    current: elements.kugouProgressCurrent,
  };
}

function updatePlatformProgress(platform, progress) {
  const ui = platformProgressUi(platform);
  const percent = Math.max(0, Math.min(100, Number(progress.percent) || 0));
  ui.container.dataset.status = progress.status || 'running';
  ui.bar.style.width = `${percent}%`;
  ui.percent.textContent = `${percent}%`;
  ui.count.textContent = `${progress.processed || 0} / ${progress.total || 0}`;
  ui.phase.textContent = progress.phase || '处理中';
  ui.current.textContent = progress.current || (progress.status === 'queued' ? '等待前一个平台完成' : '请稍候');
}

async function waitForExport(jobId) {
  while (true) {
    await delay(500);
    const job = await request(`/api/export/status?id=${encodeURIComponent(jobId)}`);
    Object.entries(job.platforms || {}).forEach(([platform, progress]) => updatePlatformProgress(platform, progress));
    if (job.status === 'completed') return job.result;
    if (job.status === 'failed') throw new Error(job.error || '导入任务失败');
  }
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

let historyCache = [];
function readHistory() { return historyCache; }

async function renderHistory() {
  showView('history');
  elements.eyebrow.textContent = 'Account History';
  elements.title.textContent = '最近搜索与推荐';
  const result = await request('/api/history?page_size=100');
  const history = result.items.map((item) => {
    const summary = item.summary || {};
    return {...item, type: item.kind, data: {...summary, tracks: Array.isArray(item.tracks) ? item.tracks : summary.tracks}};
  });
  historyCache = history;
  elements.meta.innerHTML = `<strong>${history.length}</strong> 条记录`;
  elements.historyList.innerHTML = history.length ? history.map((item) => `
    <article class="history-item">
      <div><strong>${escapeHtml(item.title)}</strong><span>${historyKindLabel(item.type)} · ${new Date(item.created_at).toLocaleString('zh-CN')}</span></div>
      <button type="button" data-history-id="${escapeHtml(item.id)}">恢复</button>
    </article>`).join('') : '<p>暂无历史记录。</p>';
}

function restoreHistoryItem(event) {
  const button = event.target.closest('[data-history-id]');
  const id = button?.dataset.historyId;
  if (!id) return;
  const item = readHistory().find((entry) => String(entry.id) === String(id));
  if (!item) return showToast('历史记录不存在');
  if (!Array.isArray(item.data?.tracks)) return showToast('该旧历史记录没有保存完整结果，无法恢复');
  if (item.type === 'search') return renderCandidates(item.data.tracks, item.data.name || item.title, item.data.artist || '');
  if (item.type === 'genre' || item.type === 'weekly' || item.type === 'discover') {
    return renderDiscovery(item.data.tracks, item.data.discoveryTitle || item.title, item.data.note || '');
  }
  if (item.type === 'recommend' || item.type === 'radio') return renderRecommendations(item.data);
  showToast('该类型的历史记录暂不支持恢复');
}

function historyKindLabel(kind) {
  return ({search: '搜索', recommend: '单曲推荐', radio: '多曲电台', genre: '流派浏览', weekly: '每周发现', discover: '发现'})[kind] || '记录';
}

function exportHistory() {
  const history = readHistory();
  const blob = new Blob([JSON.stringify(history, null, 2)], { type: 'application/json;charset=utf-8' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `embeat-history-${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 1000);
}

function setLoading(title, detail) {
  showView('loading');
  elements.loadingTitle.textContent = title;
  elements.loadingDetail.textContent = detail;
  elements.eyebrow.textContent = 'Embeat';
  elements.title.textContent = title;
  elements.meta.textContent = '';
}

function showEmpty() {
  showView('empty');
  elements.eyebrow.textContent = '歌曲搜索';
  elements.title.textContent = '选择一首歌';
  elements.meta.textContent = '';
}

function showView(name) {
  elements.empty.classList.toggle('hidden', name !== 'empty');
  elements.candidates.classList.toggle('hidden', name !== 'candidates');
  elements.recommendations.classList.toggle('hidden', name !== 'recommendations');
  elements.loading.classList.toggle('hidden', name !== 'loading');
  elements.historyView.classList.toggle('hidden', name !== 'history');
}

async function request(url, options = {}) {
  const response = await fetch(url, {...options, credentials: 'same-origin'});
  const data = await response.json().catch(() => ({}));
  if (response.status === 401) window.EmbeatAuth?.show();
  if (!response.ok) throw new Error(data.error || `请求失败 (${response.status})`);
  return data;
}

async function checkHealth() {
  try {
    const health = await request('/api/health');
    if (!health.ready) {
      elements.status.className = 'service-status';
      elements.status.querySelector('strong').textContent = '数据库初始化中';
      elements.status.querySelector('small').textContent = '首次启动约需一分钟';
      return;
    }
    elements.status.className = 'service-status online';
    elements.status.querySelector('strong').textContent = '数据库在线';
    elements.status.querySelector('small').textContent = `${formatNumber(health.points)} 首歌曲`;
    loadGenreOptions();
  } catch (error) {
    elements.status.className = 'service-status offline';
    elements.status.querySelector('strong').textContent = '数据库离线';
    elements.status.querySelector('small').textContent = '检查 Qdrant';
  } finally {
    setTimeout(checkHealth, 5000);
  }
}

let toastTimer;
function showToast(message) {
  clearTimeout(toastTimer);
  elements.toast.textContent = message;
  elements.toast.classList.remove('hidden');
  toastTimer = setTimeout(() => elements.toast.classList.add('hidden'), 5000);
}

function initial(value) {
  return Array.from(value || '?')[0].toUpperCase();
}

function formatNumber(value) {
  return new Intl.NumberFormat('zh-CN').format(value);
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>'"]/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;',
  })[char]);
}

async function prefillPlatformDefaults() {
  try {
    const defaults = await request('/api/config');
    if (!elements.neteaseApi.value) elements.neteaseApi.value = defaults.netease_api_url || '';
    if (!elements.neteaseProxy.value) elements.neteaseProxy.value = defaults.proxy_url || '';
    if (!elements.kugouApi.value) elements.kugouApi.value = defaults.kugou_api_url || '';
    if (!elements.kugouProxy.value) elements.kugouProxy.value = defaults.proxy_url || '';
  } catch (error) { /* 默认值不可用时不提示 */ }
}

async function migrateLegacyStorage() {
  try {
    localStorage.removeItem(NETEASE_STORAGE_KEY);
    const legacy = JSON.parse(localStorage.getItem(HISTORY_STORAGE_KEY) || '[]');
    for (const item of legacy.slice(0, 100)) {
      const summary = {...(item.data || {})};
      const tracks = Array.isArray(summary.tracks) ? summary.tracks : null;
      delete summary.tracks;
      await request('/api/history', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({kind: item.type || 'search', title: item.title || '旧记录', summary, tracks})});
    }
    if (legacy.length) localStorage.removeItem(HISTORY_STORAGE_KEY);
  } catch (error) { /* migration retries after the next login */ }
}

window.embeatAuthReady.then(async () => {
  await migrateLegacyStorage();
  checkHealth();
  loadGenreOptions();
  prefillPlatformDefaults();
  restorePlaylistRadioHandoff();
});
