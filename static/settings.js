const panels = Array.from(document.querySelectorAll('[data-platform]'));
const toast = document.querySelector('#settings-toast');
const serviceStatus = document.querySelector('#settings-service-status');

panels.forEach((panel) => {
  panel.querySelector('[data-role="cookie-form"]').addEventListener('submit', (event) => saveCookie(event, panel));
  panel.querySelector('[data-role="phone-form"]').addEventListener('submit', (event) => loginByPhone(event, panel));
  panel.querySelector('[data-role="send"]').addEventListener('click', () => sendCaptcha(panel));
  panel.querySelector('[data-role="clear"]').addEventListener('click', () => clearCredential(panel));
});

function values(panel) {
  return {
    platform: panel.dataset.platform,
    api_url: panel.querySelector('[data-role="api"]').value.trim(),
    proxy_url: panel.querySelector('[data-role="proxy"]').value.trim(),
    cookie: panel.querySelector('[data-role="cookie"]').value.trim(),
    phone: panel.querySelector('[data-role="phone"]').value.trim(),
    code: panel.querySelector('[data-role="code"]').value.trim(),
    country_code: panel.querySelector('[data-role="country"]').value.trim() || '86',
  };
}

async function loadDefaults() {
  try {
    const defaults = await request('/api/config');
    panels.forEach((panel) => {
      const platform = panel.dataset.platform;
      const api = panel.querySelector('[data-role="api"]');
      const proxy = panel.querySelector('[data-role="proxy"]');
      if (!api.value && platform === 'netease') api.value = defaults.netease_api_url || '';
      if (!api.value && platform === 'kugou') api.value = defaults.kugou_api_url || '';
      if (!proxy.value) proxy.value = defaults.proxy_url || '';
    });
  } catch (error) { /* 默认值不可用时不提示 */ }
}

async function loadStatus(panel) {
  const platform = panel.dataset.platform;
  const state = panel.querySelector('[data-role="state"]');
  state.textContent = '检查中'; state.dataset.status = 'loading';
  try {
    const status = await request(`/api/${platform}/config`);
    if (status.api_url) panel.querySelector('[data-role="api"]').value = status.api_url;
    if (status.proxy_url !== undefined) panel.querySelector('[data-role="proxy"]').value = status.proxy_url;
    if (status.phone) panel.querySelector('[data-role="phone"]').value = status.phone;
    state.textContent = status.configured ? `已连接${status.uid || status.userid ? ` · UID ${status.uid || status.userid}` : ''}` : '未连接';
    state.dataset.status = status.configured ? 'online' : 'offline';
  } catch (error) {
    state.textContent = '状态读取失败'; state.dataset.status = 'offline';
    showToast(error.message);
  }
}

async function saveCookie(event, panel) {
  event.preventDefault();
  const data = values(panel);
  if (!data.api_url || !data.cookie) return showToast('请填写 API 地址和 Cookie');
  const button = event.currentTarget.querySelector('button[type="submit"]');
  button.disabled = true; button.textContent = '正在校验';
  try {
    await request(`/api/${data.platform}/config`, {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(data)});
    panel.querySelector('[data-role="cookie"]').value = '';
    showToast(`${platformName(data.platform)}凭据已加密保存`);
    await loadStatus(panel);
  } catch (error) { showToast(error.message); }
  finally { button.disabled = false; button.textContent = '校验并保存'; }
}

async function sendCaptcha(panel) {
  const data = values(panel);
  if (!data.api_url || !data.phone) return showToast('请填写 API 地址和手机号');
  const button = panel.querySelector('[data-role="send"]');
  button.disabled = true;
  try {
    await request(`/api/${data.platform}/captcha/send`, {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(data)});
    showToast(`验证码已发送至 ${maskPhone(data.phone)}`);
    countdown(button, 60);
  } catch (error) {
    button.disabled = false;
    showToast(error.message);
  }
}

async function loginByPhone(event, panel) {
  event.preventDefault();
  const data = values(panel);
  if (!data.api_url || !data.phone || !data.code) return showToast('请填写手机号和验证码');
  const button = event.currentTarget.querySelector('button[type="submit"]');
  button.disabled = true; button.textContent = '正在登录';
  try {
    await request(`/api/${data.platform}/captcha/login`, {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(data)});
    panel.querySelector('[data-role="code"]').value = '';
    showToast(`${platformName(data.platform)}登录成功，凭据已加密保存`);
    await loadStatus(panel);
  } catch (error) { showToast(error.message); }
  finally { button.disabled = false; button.textContent = '登录并保存'; }
}

async function clearCredential(panel) {
  const platform = panel.dataset.platform;
  if (!confirm(`确定清除当前用户的${platformName(platform)}凭据？`)) return;
  try {
    await request(`/api/${platform}/config`, {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({clear: true})});
    panel.querySelector('[data-role="cookie"]').value = '';
    showToast('凭据已清除');
    await loadStatus(panel);
  } catch (error) { showToast(error.message); }
}

function countdown(button, seconds) {
  let remaining = seconds;
  button.textContent = `${remaining}s`;
  const timer = setInterval(() => {
    remaining -= 1;
    button.textContent = remaining > 0 ? `${remaining}s` : '发送验证码';
    if (remaining <= 0) { clearInterval(timer); button.disabled = false; }
  }, 1000);
}

async function request(url, options = {}) {
  const response = await fetch(url, {...options, credentials: 'same-origin'});
  const data = await response.json().catch(() => ({}));
  if (response.status === 401) window.EmbeatAuth?.show();
  if (!response.ok) throw new Error(data.error || `请求失败 (${response.status})`);
  return data;
}

function showToast(message) {
  toast.textContent = message; toast.classList.remove('hidden');
  clearTimeout(showToast.timer); showToast.timer = setTimeout(() => toast.classList.add('hidden'), 5000);
}

function platformName(platform) { return platform === 'kugou' ? '酷狗音乐' : '网易云音乐'; }
function maskPhone(phone) { return phone.length >= 7 ? `${phone.slice(0, 3)}****${phone.slice(-4)}` : phone; }

async function checkHealth() {
  try {
    const health = await request('/api/health');
    serviceStatus.className = `service-status ${health.ready ? 'online' : ''}`;
    serviceStatus.querySelector('strong').textContent = health.ready ? '服务在线' : '数据库初始化中';
    serviceStatus.querySelector('small').textContent = health.ready ? `${new Intl.NumberFormat('zh-CN').format(health.points)} 首歌曲` : '请稍候';
  } catch (error) {
    serviceStatus.className = 'service-status offline'; serviceStatus.querySelector('strong').textContent = '服务离线';
  }
}

window.embeatAuthReady.then(() => { checkHealth(); loadDefaults(); panels.forEach(loadStatus); });
