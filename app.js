'use strict';

// ===== 定数 =====
const CLUBS = ['1W', '3W', '5W', '4U', '5I', '6I', '7I', '8I', '9I', 'PW', 'AW', 'SW', 'LW', 'PT'];
const STORAGE_KEY = 'golfLog.records.v1';
const MAX = 3;
// CSV / スプレッドシートの列(この順番を崩さない)
const CSV_HEADER = ['日付時刻', 'クラブ', '飛距離', '出だし', '曲がり', '高さ'];

// ===== 保存 =====
function loadRecords() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}
function saveRecords(list) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
}

// ===== 状態 =====
const state = {
  club: '7I',
  start: 0,   // -3..+3 右(プッシュ)がプラス
  curve: 0,   // -3..+3 右(スライス)がプラス
  height: 0,  // -3..+3 高いがプラス
  editingId: null,
};
let records = loadRecords();

function clamp(v) { return Math.max(-MAX, Math.min(MAX, v)); }

// 押した側へ1つ進める。反対側に強さがあれば1つ戻す(結果的に同じ計算)
function press(axis, dir) {
  state[axis] = clamp(state[axis] + dir);
}

// ===== 日付 =====
function pad(n) { return String(n).padStart(2, '0'); }
function nowString() {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

// ===== 球筋の日本語 =====
const LEVEL = ['', '弱', '中', '強'];
function shapeText(start, curve, height) {
  const sName = start > 0 ? 'プッシュ' : start < 0 ? 'プル' : '';
  const cName = curve > 0 ? 'スライス' : curve < 0 ? 'フック' : '';
  const s = Math.abs(start), c = Math.abs(curve);
  let dir;
  if (!sName && !cName) dir = 'ストレート';
  else if (sName && cName) {
    dir = s === c
      ? `${sName}${cName}(${LEVEL[s]})`
      : `${sName}(${LEVEL[s]})${cName}(${LEVEL[c]})`;
  } else if (sName) dir = `${sName}(${LEVEL[s]})`;
  else dir = `${cName}(${LEVEL[c]})`;

  const hWord = height > 0 ? '高め' : '低め';
  const hPrefix = ['', 'やや', '', 'かなり'][Math.abs(height)];
  return height === 0 ? dir : `${dir}・${hPrefix}${hWord}`;
}

// ===== 弾道の描画 =====
// 軌道の形の調整値(放物線3)
// 遠近法の正確さより「見てどんな球かわかること」を優先して、画面上で直接描いている
const TRAJ = {
  levels: [0, 1, 2, 3], // 弱・中・強の効き(等間隔)
  sRoot: 0.045,   // 出だし: 根元で角度をつける分(打ち出し直後に効き切る)
  sStart: 0.125,  // 出だし: 飛んでいる間ずっと同じ割合で進む分(放物線に見える)
  sCurve: 0.17,   // 曲がり。sRoot+sStartと同じにして、同じ強さ同士でターゲットに戻る
  curvePow: 2.6,  // 曲がりの効き始め(大きいほど後半から曲がる)
  fitMax: 0.512,  // 横のずれの上限(画面幅に対する割合)。強+強の組み合わせで端まで届く
  fitSoft: 0.7,   // 縮め方のゆるさ。単体の強は端の手前(約2/3)で止まる
  landS: 0.12,    // 落下地点の位置(0=地平線、1=ボールの位置)
  gPow: 1.15,     // 奥へ進む速さの変化(大きいほど手前で速く奥で遅い=遠近感)
  hScale: 0.7,    // 高さの大きさ
  apexT: 0.5,     // 頂点の位置(0=ボール、1=落下地点)。小さいほど頂点が手前
};

// ゴルファーがボールの後ろから目標方向を見た景色
function drawTrajectory(canvas, shot, opts = {}) {
  const dpr = window.devicePixelRatio || 1;
  const cssW = canvas.clientWidth || opts.width || 320;
  const cssH = canvas.clientHeight || opts.height || 240;
  if (canvas.width !== Math.round(cssW * dpr) || canvas.height !== Math.round(cssH * dpr)) {
    canvas.width = Math.round(cssW * dpr);
    canvas.height = Math.round(cssH * dpr);
  }
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const W = cssW, H = cssH;
  const small = !!opts.small;

  const horizonY = H * 0.5;
  const ballY = H * 0.93;
  const cx = W / 2;

  // --- 背景: 空 ---
  const sky = ctx.createLinearGradient(0, 0, 0, horizonY);
  sky.addColorStop(0, '#a9d4f0');
  sky.addColorStop(1, '#e4f2fa');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, horizonY);

  // --- 丘(薄く) ---
  ctx.fillStyle = 'rgba(120,160,120,0.35)';
  ctx.beginPath();
  ctx.moveTo(0, horizonY);
  ctx.quadraticCurveTo(W * 0.18, horizonY - H * 0.07, W * 0.38, horizonY);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = 'rgba(110,150,115,0.28)';
  ctx.beginPath();
  ctx.moveTo(W * 0.55, horizonY);
  ctx.quadraticCurveTo(W * 0.8, horizonY - H * 0.1, W * 1.05, horizonY);
  ctx.closePath();
  ctx.fill();

  // --- 地面 ---
  const ground = ctx.createLinearGradient(0, horizonY, 0, H);
  ground.addColorStop(0, '#9cc79a');
  ground.addColorStop(1, '#5f9f5c');
  ctx.fillStyle = ground;
  ctx.fillRect(0, horizonY, W, H - horizonY);

  // 地平線
  ctx.strokeStyle = 'rgba(60,90,60,0.35)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, horizonY);
  ctx.lineTo(W, horizonY);
  ctx.stroke();

  const landY = horizonY + (ballY - horizonY) * TRAJ.landS;

  // ターゲットライン(真っすぐの目安)
  ctx.strokeStyle = 'rgba(255,255,255,0.45)';
  ctx.setLineDash(small ? [2, 3] : [5, 6]);
  ctx.beginPath();
  ctx.moveTo(cx, ballY);
  ctx.lineTo(cx, horizonY);
  ctx.stroke();
  ctx.setLineDash([]);

  // --- 軌道モデル ---
  const { start, curve, height } = shot;
  const lv = (v) => Math.sign(v) * TRAJ.levels[Math.abs(v)];
  // 地面上の位置(=影)。t: 0=ボール、1=落下地点
  const rawLat = (t) =>
    lv(start) * (TRAJ.sStart * t + TRAJ.sRoot * (1 - Math.pow(1 - t, 3)))
    + lv(curve) * TRAJ.sCurve * Math.pow(t, TRAJ.curvePow);
  // 横に大きくずれる球ほど、形を保ったまま軌道全体の横幅を少しずつ縮める
  // 単体の強は端の手前、強+強の組み合わせでちょうど端に届く
  let maxLat = 0;
  for (let i = 0; i <= 40; i++) maxLat = Math.max(maxLat, Math.abs(rawLat(i / 40)));
  const fit = maxLat > 0 ? (TRAJ.fitMax * Math.tanh(maxLat / TRAJ.fitSoft)) / maxLat : 1;
  const groundAt = (t) => {
    return {
      x: cx + rawLat(t) * fit * W,
      y: ballY + (landY - ballY) * (1 - Math.pow(1 - t, TRAJ.gPow)),
    };
  };
  // 高さ: 高いほど頂点が高く早め、低いほど低く遅め
  const apex = 0.5 * (1 + 0.2 * height);
  const tp = TRAJ.apexT - 0.035 * height;
  const heightAt = (t) => {
    if (t <= tp) { const u = t / tp; return apex * (1 - (1 - u) * (1 - u)); } // 上昇
    const u = (t - tp) / (1 - tp); return apex * (1 - u * u);               // 下降
  };

  const pts = [];
  const N = 60;
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    const g = groundAt(t);
    pts.push({ x: g.x, y: g.y - heightAt(t) * H * TRAJ.hScale });
  }
  const land = pts[pts.length - 1];

  // 影(地面上の軌道)
  if (!small) {
    ctx.strokeStyle = 'rgba(0,0,0,0.12)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i <= N; i++) {
      const t = i / N;
      const p = groundAt(t);
      if (i === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y);
    }
    ctx.stroke();
  }

  // 軌道(手前ほど太く)
  ctx.strokeStyle = '#e53935';
  ctx.lineCap = 'round';
  for (let i = 1; i < pts.length; i++) {
    const t = i / N;
    const s = 0.6 / (0.6 + t);
    ctx.lineWidth = (small ? 1.2 : 2) + (small ? 1.8 : 4) * s;
    ctx.beginPath();
    ctx.moveTo(pts[i - 1].x, pts[i - 1].y);
    ctx.lineTo(pts[i].x, pts[i].y);
    ctx.stroke();
  }

  // 落下地点
  ctx.fillStyle = '#e53935';
  ctx.beginPath();
  ctx.arc(land.x, land.y, small ? 1.8 : 3, 0, Math.PI * 2);
  ctx.fill();

  // ボール
  ctx.fillStyle = '#fff';
  ctx.strokeStyle = '#888';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(cx, ballY, small ? 3 : 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
}

// ===== 入力画面 =====
const $ = (sel) => document.querySelector(sel);
const canvas = $('#traj');

function renderClubs() {
  const grid = $('#club-grid');
  grid.innerHTML = '';
  for (const c of CLUBS) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'club-btn' + (c === state.club ? ' selected' : '');
    b.textContent = c;
    b.addEventListener('click', () => { state.club = c; renderClubs(); });
    grid.appendChild(b);
  }
}

function renderControls() {
  document.querySelectorAll('.axis-btn').forEach((btn) => {
    const axis = btn.dataset.axis;
    const dir = Number(btn.dataset.dir);
    const v = state[axis];
    const count = Math.sign(v) === dir ? Math.abs(v) : 0;
    btn.classList.toggle('on', count > 0);
    btn.querySelector('.dots').textContent = '●'.repeat(count) + '○'.repeat(MAX - count);
  });
  $('#shape-text').textContent = shapeText(state.start, state.curve, state.height);
  drawTrajectory(canvas, state);
}

function resetShot() {
  state.start = 0; state.curve = 0; state.height = 0;
  renderControls();
}

let toastTimer = null;
function toast(msg) {
  const el = $('#toast');
  el.textContent = msg;
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.hidden = true; }, 1600);
}

function onSave() {
  const distRaw = $('#distance').value.trim();
  const dist = Number(distRaw);
  if (distRaw === '' || !Number.isFinite(dist) || dist < 0) {
    toast('飛距離を入れてください');
    $('#distance').focus();
    return;
  }
  const shot = {
    club: state.club,
    distance: Math.round(dist),
    start: state.start,
    curve: state.curve,
    height: state.height,
  };

  if (state.editingId) {
    const r = records.find((x) => x.id === state.editingId);
    if (r) Object.assign(r, shot);
    saveRecords(records);
    exitEdit();
    toast('修正しました');
    showView('list');
  } else {
    records.push({ id: String(Date.now()) + Math.random().toString(36).slice(2, 6), datetime: nowString(), ...shot });
    saveRecords(records);
    toast(`保存: ${shot.club} ${shot.distance}yd`);
    // 同じクラブで続けて打つことが多いので、クラブはそのまま。飛距離と弾道は戻す
    $('#distance').value = '';
    resetShot();
  }
}

function startEdit(id) {
  const r = records.find((x) => x.id === id);
  if (!r) return;
  state.editingId = id;
  state.club = r.club;
  state.start = r.start;
  state.curve = r.curve;
  state.height = r.height;
  $('#distance').value = r.distance;
  $('#edit-banner').hidden = false;
  $('#edit-label').textContent = `修正中: ${r.datetime}`;
  $('#btn-save').textContent = '更新';
  renderClubs();
  showView('input');
}

function exitEdit() {
  state.editingId = null;
  $('#edit-banner').hidden = true;
  $('#btn-save').textContent = '保存';
  $('#distance').value = '';
  resetShot();
}

// ===== 一覧画面 =====
function renderList() {
  const ul = $('#record-list');
  ul.innerHTML = '';
  const sorted = [...records].reverse(); // 保存した順に並んでいるので、逆順=新しい順
  $('#list-count').textContent = `${records.length}球`;
  $('#list-empty').hidden = records.length > 0;

  for (const r of sorted) {
    const li = document.createElement('li');
    li.className = 'record';
    const cv = document.createElement('canvas');
    li.appendChild(cv);

    const info = document.createElement('div');
    info.innerHTML = `
      <div class="rec-date"></div>
      <div class="rec-top"><span class="rec-club"></span><span class="rec-dist"></span></div>
      <div class="rec-shape"></div>
      <div class="rec-actions">
        <button type="button" class="edit">修正</button>
        <button type="button" class="del">削除</button>
      </div>`;
    info.querySelector('.rec-date').textContent = r.datetime;
    info.querySelector('.rec-club').textContent = r.club;
    info.querySelector('.rec-dist').textContent = `${r.distance}yd`;
    info.querySelector('.rec-shape').textContent = shapeText(r.start, r.curve, r.height);
    info.querySelector('.edit').addEventListener('click', () => startEdit(r.id));
    info.querySelector('.del').addEventListener('click', () => {
      if (!confirm(`${r.datetime} ${r.club} ${r.distance}yd を削除しますか?`)) return;
      records = records.filter((x) => x.id !== r.id);
      saveRecords(records);
      if (state.editingId === r.id) exitEdit();
      renderList();
    });
    li.appendChild(info);
    ul.appendChild(li);
    drawTrajectory(cv, r, { small: true, width: 96, height: 72 });
  }
}

// ===== CSV =====
function csvCell(v) {
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
function exportCsv() {
  const sorted = records; // 保存した順=古い順
  const lines = [CSV_HEADER.join(',')];
  for (const r of sorted) {
    lines.push([r.datetime, r.club, r.distance, r.start, r.curve, r.height].map(csvCell).join(','));
  }
  const blob = new Blob(['﻿' + lines.join('\r\n') + '\r\n'], { type: 'text/csv;charset=utf-8' });
  const d = new Date();
  const name = `golf-log-${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}.csv`;
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

// ===== 画面切り替え =====
function showView(name) {
  document.querySelectorAll('.view').forEach((v) => v.classList.toggle('active', v.id === `view-${name}`));
  document.querySelectorAll('.tab').forEach((t) => t.classList.toggle('active', t.dataset.view === name));
  if (name === 'list') renderList();
  if (name === 'input') { renderControls(); }
  window.scrollTo(0, 0);
}

// ===== 初期化 =====
function init() {
  renderClubs();
  renderControls();

  document.querySelectorAll('.axis-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      press(btn.dataset.axis, Number(btn.dataset.dir));
      renderControls();
    });
  });
  $('#btn-reset').addEventListener('click', resetShot);
  $('#btn-save').addEventListener('click', onSave);
  $('#btn-cancel-edit').addEventListener('click', () => { exitEdit(); showView('list'); });
  $('#btn-csv').addEventListener('click', exportCsv);
  document.querySelectorAll('.tab').forEach((t) => t.addEventListener('click', () => showView(t.dataset.view)));
  window.addEventListener('resize', () => drawTrajectory(canvas, state));

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
}

// テスト用に公開
window.__golf = { state, press, shapeText, drawTrajectory, TRAJ };

init();
