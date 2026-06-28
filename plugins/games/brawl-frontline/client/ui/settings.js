/**
 * 设置面板：游戏速度 / 音频开关 / 音量 / 功成身退
 * 打开时游戏暂停（state.paused = true），关闭时恢复
 * 功成身退入口移到此面板底部（红色按钮 + 上方灰色小字提示）
 */
import { Game } from '../core/game.js';
import { Modals } from './modals.js';
import { Audio } from '../core/audio.js';

const SPEEDS = [0.5, 1, 2, 4];

export const Settings = {
  /** 打开设置面板（暂停游戏） */
  show() {
    if (Game.state.phase !== 'wave') return;
    Game.state.paused = true;
    this._render();
    document.getElementById('bf-modal').classList.remove('hidden');
  },

  /** 关闭设置面板（恢复游戏） */
  close() {
    Game.state.paused = false;
    document.getElementById('bf-modal').classList.add('hidden');
  },

  _render() {
    const st = Game.state;
    const curSpeed = st.speedMultiplier || 1;
    const audioOn = Audio.enabled;
    const vol = Math.round(Audio.volume * 100);
    const body = document.getElementById('bf-modal-body');
    let html = '<div class="bf-modal-title">设置</div>';
    // 游戏速度
    html += '<div class="bf-setting-label">游戏速度</div>';
    html += '<div class="bf-setting-speed-row">';
    SPEEDS.forEach(s => {
      const active = Math.abs(s - curSpeed) < 0.01;
      const label = s === 1 ? '原速' : `${s}倍`;
      html += `<button class="bf-speed-btn${active ? ' active' : ''}" data-speed="${s}">${label}</button>`;
    });
    html += '</div>';
    // 音频行：音频名 | 下一曲 | 开/关
    const hasTracks = Audio.hasTracks();
    const trackName = Audio.currentName();
    html += '<div class="bf-setting-row">';
    html += '<span class="bf-setting-name">音频</span>';
    html += `<button class="bf-next-btn" id="bf-audio-next" title="下一曲" ${hasTracks ? '' : 'disabled'}>下一曲</button>`;
    if (hasTracks) html += `<span class="bf-track-name" title="${trackName}">${trackName}</span>`;
    html += `<button class="bf-toggle-btn${audioOn ? ' on' : ' off'}" id="bf-audio-toggle" ${hasTracks ? '' : 'disabled'}>${audioOn ? '开' : '关'}</button>`;
    html += '</div>';
    // 音量滑块
    html += '<div class="bf-setting-row">';
    html += '<span class="bf-setting-name">音量</span>';
    html += `<input type="range" min="0" max="100" value="${vol}" class="bf-volume-slider" id="bf-volume-slider">`;
    html += '</div>';
    // 功成身退区
    html += '<div class="bf-setting-retire-tip">现在结算成绩？</div>';
    html += '<button class="bf-retire-danger-btn" id="bf-setting-retire">功成身退</button>';
    body.innerHTML = html;
    this._bind();
  },

  _bind() {
    // 速度按钮
    document.querySelectorAll('.bf-speed-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        Game.state.speedMultiplier = parseFloat(btn.dataset.speed);
        this._render();
      });
    });
    // 音频开关
    const toggleBtn = document.getElementById('bf-audio-toggle');
    if (toggleBtn) toggleBtn.addEventListener('click', () => {
      Audio.toggle();
      this._render();
    });
    // 下一曲
    const nextBtn = document.getElementById('bf-audio-next');
    if (nextBtn) nextBtn.addEventListener('click', () => {
      Audio.next();
      this._render();
    });
    // 音量滑块
    document.getElementById('bf-volume-slider').addEventListener('input', (e) => {
      Audio.setVolume(parseInt(e.target.value, 10) / 100);
    });
    // 功成身退
    document.getElementById('bf-setting-retire').addEventListener('click', () => {
      this.close();
      Modals.showRetireConfirm();
    });
    // 点击遮罩关闭（仅绑定一次，避免复用 #bf-modal 的强化/英雄选择弹窗被误关）
    if (!this._maskBound) {
      document.getElementById('bf-modal').addEventListener('click', this._onMaskClick);
      this._maskBound = true;
    }
  },

  _onMaskClick(e) {
    if (e.target !== e.currentTarget) return;
    // 仅设置面板/功成身退确认（wave + 暂停）响应遮罩关闭；
    // 强化选择(buff-select)/英雄选择(hero-select)/游戏结束(game-over)不响应，避免弹窗被误关后卡死
    if (Game.state.phase !== 'wave' || !Game.state.paused) return;
    Settings.close();
  }
};
