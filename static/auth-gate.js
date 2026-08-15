(function () {
  let currentUser = null;
  let resolver;
  window.embeatAuthReady = new Promise((resolve) => { resolver = resolve; });

  function gate() {
    let overlay = document.querySelector('#auth-gate');
    if (overlay) return overlay;
    overlay = document.createElement('div');
    overlay.id = 'auth-gate';
    overlay.className = 'auth-gate hidden';
    overlay.innerHTML = `
      <div class="auth-card">
        <div class="auth-brand"><img src="/logo.svg" width="42" height="42" alt=""><div><strong>Embeat</strong><small>私人音乐推荐空间</small></div></div>
        <div class="auth-tabs"><button type="button" data-auth-mode="login" class="active">登录</button><button type="button" data-auth-mode="register">注册</button></div>
        <form id="auth-form">
          <label>用户名<input name="username" autocomplete="username" required maxlength="80"></label>
          <label>密码<input name="password" type="password" autocomplete="current-password" required minlength="8"></label>
          <label class="invite-field hidden">邀请码<input name="invite_code" autocomplete="off"></label>
          <p class="auth-error" role="alert"></p>
          <button class="primary-button" type="submit">登录</button>
        </form>
      </div>`;
    document.body.appendChild(overlay);
    let mode = 'login';
    overlay.querySelector('.auth-tabs').addEventListener('click', (event) => {
      const button = event.target.closest('[data-auth-mode]');
      if (!button) return;
      mode = button.dataset.authMode;
      overlay.querySelectorAll('[data-auth-mode]').forEach((item) => item.classList.toggle('active', item === button));
      overlay.querySelector('.invite-field').classList.toggle('hidden', mode !== 'register');
      overlay.querySelector('button[type="submit"]').textContent = mode === 'register' ? '注册并登录' : '登录';
      overlay.querySelector('input[name="password"]').autocomplete = mode === 'register' ? 'new-password' : 'current-password';
      overlay.querySelector('.auth-error').textContent = '';
    });
    overlay.querySelector('#auth-form').addEventListener('submit', async (event) => {
      event.preventDefault();
      const form = new FormData(event.currentTarget);
      const submit = event.currentTarget.querySelector('button[type="submit"]');
      const error = overlay.querySelector('.auth-error');
      submit.disabled = true; error.textContent = '';
      try {
        const response = await fetch(`/api/auth/${mode}`, {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(Object.fromEntries(form))});
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.error || '认证失败');
        currentUser = data.user;
        overlay.classList.add('hidden');
        showAccount();
        window.dispatchEvent(new CustomEvent('embeat-authenticated', {detail: currentUser}));
        resolver(currentUser);
      } catch (reason) {
        error.textContent = reason.message;
      } finally {
        submit.disabled = false;
      }
    });
    return overlay;
  }

  function showAccount() {
    let account = document.querySelector('#auth-account');
    if (account) return;
    account = document.createElement('div');
    account.id = 'auth-account';
    account.className = 'auth-account';
    account.innerHTML = `<span>${currentUser ? currentUser.username : ''}</span><button type="button">退出</button>`;
    account.querySelector('button').addEventListener('click', () => window.EmbeatAuth.logout());
    (document.querySelector('.sidebar') || document.body).appendChild(account);
  }

  async function check() {
    try {
      const response = await fetch('/api/auth/me');
      if (!response.ok) throw new Error('not authenticated');
      currentUser = (await response.json()).user;
      showAccount();
      resolver(currentUser);
    } catch (error) {
      gate().classList.remove('hidden');
    }
  }

  window.EmbeatAuth = {
    show() { gate().classList.remove('hidden'); },
    user() { return currentUser; },
    async logout() {
      await fetch('/api/auth/logout', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: '{}'});
      location.reload();
    },
  };
  check();
})();
