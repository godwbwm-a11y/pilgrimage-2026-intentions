"use strict";

/* ---------- 유틸 ---------- */
const $ = (sel, el = document) => el.querySelector(sel);
const $$ = (sel, el = document) => Array.from(el.querySelectorAll(sel));

const dayByDate = Object.fromEntries(SCHEDULE.map(d => [d.date, d]));

function fmtDate(dateStr) {
  const [, m, d] = dateStr.split("-");
  return `${parseInt(m, 10)}월 ${parseInt(d, 10)}일`;
}
function fmtShort(dateStr) {
  const [, m, d] = dateStr.split("-");
  return `${parseInt(m, 10)}/${parseInt(d, 10)}`;
}
function escapeHtml(s) {
  return s.replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

// 미사 지향: 해당 날짜에 봉헌되는 지향
function massForDate(date) {
  return INTENTIONS.filter(i => i.massDate === date);
}
// 묵주기도 지향: 해당 날짜에 봉헌되는 지향
function rosaryForDate(date) {
  return INTENTIONS.filter(i => i.rosary.includes(date));
}

/* ---------- 날짜별 상세 렌더 ---------- */
function renderDay(date) {
  const day = dayByDate[date];
  const detail = $("#day-detail");

  const massList = massForDate(date);
  const rosaryList = rosaryForDate(date);

  const massBlock = day.mass
    ? `
      <div class="block mass ${day.mass === "파티마" ? "fatima" : "lourdes"}">
        <p class="block-title">미사 지향 <span class="tag badge-mass">${day.mass}</span></p>
        <p class="block-meta">${escapeHtml(day.place)} · ${day.time} · ${massList.length}건 봉헌</p>
        ${renderIntentionList(massList)}
      </div>`
    : `
      <div class="block mass">
        <p class="block-title">미사 <span class="tag badge-mass">${escapeHtml(day.region)}</span></p>
        <p class="block-meta">${escapeHtml(day.place)} · ${day.time}</p>
        <p class="empty-note">이날 미사는 순례단 공동 지향으로 봉헌됩니다. (개별 미사 지향은 파티마 · 루르드 미사에 봉헌)</p>
      </div>`;

  const rosaryBlock = `
    <div class="block rosary">
      <p class="block-title">묵주기도 지향 <span class="tag">${rosaryList.length}건</span></p>
      <p class="block-meta">${escapeHtml(day.theme)}</p>
      ${renderIntentionList(rosaryList)}
    </div>`;

  detail.innerHTML = `
    <div class="day-head">
      <h2>${fmtDate(date)} <span class="weekday">(${day.weekday})</span></h2>
    </div>
    <p class="day-theme">📍 ${escapeHtml(day.region)} — ${escapeHtml(day.theme)}</p>
    ${massBlock}
    ${rosaryBlock}
  `;

  $$(".day-tab").forEach(t => t.classList.toggle("active", t.dataset.date === date));
}

function renderIntentionList(list, term) {
  if (!list.length) return `<p class="empty-note">봉헌된 지향이 없습니다.</p>`;
  const items = list.map(i => `
    <li class="intention">
      <div class="offerer">${highlight(i.offerer, term)}</div>
      <div class="text">${highlight(i.text, term)}</div>
    </li>`).join("");
  return `<ul class="intentions">${items}</ul>`;
}

function highlight(text, term) {
  const safe = escapeHtml(text);
  if (!term) return safe;
  const t = term.trim();
  if (!t) return safe;
  try {
    const re = new RegExp("(" + t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + ")", "gi");
    return safe.replace(re, "<mark>$1</mark>");
  } catch (e) { return safe; }
}

/* ---------- 날짜 탭 ---------- */
function buildTabs(todayStr) {
  const tabs = $("#day-tabs");
  tabs.innerHTML = SCHEDULE.map(d => `
    <button class="day-tab ${d.date === todayStr ? "is-today" : ""}" data-date="${d.date}">
      <span class="d-date">${fmtShort(d.date)}</span>
      <span class="d-region">${escapeHtml(d.region)}</span>
    </button>`).join("");
  $$(".day-tab", tabs).forEach(tab => {
    tab.addEventListener("click", () => {
      clearSearch();
      renderDay(tab.dataset.date);
      tab.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
    });
  });
}

/* ---------- 오늘의 지향 ---------- */
function renderToday(todayStr) {
  const el = $("#today");
  const day = dayByDate[todayStr];
  if (!day) { el.hidden = true; return; }
  const massList = massForDate(todayStr);
  const rosaryList = rosaryForDate(todayStr);
  el.hidden = false;
  el.innerHTML = `
    <span class="today-label">오늘의 지향 · ${fmtDate(todayStr)} (${day.weekday})</span>
    <div class="day-head"><h2 style="font-size:20px">📍 ${escapeHtml(day.region)}</h2></div>
    <p class="day-theme" style="margin-bottom:12px">${escapeHtml(day.place)} · ${day.time} · ${escapeHtml(day.theme)}</p>
    <div class="block ${day.mass ? "mass " + (day.mass === "파티마" ? "fatima" : "lourdes") : "mass"}" style="box-shadow:none;margin-bottom:12px">
      <p class="block-title">미사 지향 ${day.mass ? `<span class="tag badge-mass">${day.mass}</span>` : ""}</p>
      ${day.mass ? renderIntentionList(massList) : `<p class="empty-note">순례단 공동 지향으로 봉헌</p>`}
    </div>
    <div class="block rosary" style="box-shadow:none;margin-bottom:6px">
      <p class="block-title">묵주기도 지향 <span class="tag">${rosaryList.length}건</span></p>
      ${renderIntentionList(rosaryList)}
    </div>
  `;
}

/* ---------- 검색 ---------- */
function search(term) {
  const t = term.trim().toLowerCase();
  const results = $("#search-results");
  const today = $("#today");
  const tabsWrap = $(".day-tabs-wrap");
  const detail = $("#day-detail");

  if (!t) { clearSearch(); return; }

  today.hidden = true;
  tabsWrap.style.display = "none";
  detail.style.display = "none";
  results.hidden = false;

  const matches = INTENTIONS.filter(i => {
    const hay = (i.offerer + " " + i.names.join(" ") + " " + i.text).toLowerCase();
    return hay.includes(t);
  });

  if (!matches.length) {
    results.innerHTML = `
      <h2>검색 결과</h2>
      <p class="no-results">"${escapeHtml(term)}"에 해당하는 지향을 찾지 못했습니다.<br />봉헌자 이름이나 지향에 적힌 이름으로 검색해 보세요.</p>`;
    return;
  }

  const cards = matches.map(i => {
    const massChip = `<button class="sched-chip mass" data-date="${i.massDate}">
        <span class="lbl">미사</span> ${i.mass} · ${fmtShort(i.massDate)} (${dayByDate[i.massDate].weekday}) ${dayByDate[i.massDate].time}
      </button>`;
    const rosaryChips = i.rosary.map(r =>
      `<button class="sched-chip rosary" data-date="${r}">
        <span class="lbl">묵주</span> ${fmtShort(r)} (${dayByDate[r].weekday})
      </button>`).join("");
    return `
      <div class="result-card">
        <p class="r-offerer">${highlight(i.offerer, term)}</p>
        <p class="r-text">${highlight(i.text, term)}</p>
        <div class="sched-line">${massChip}${rosaryChips}</div>
      </div>`;
  }).join("");

  results.innerHTML = `
    <h2>검색 결과</h2>
    <p class="result-count">"${escapeHtml(term)}" — ${matches.length}건의 지향</p>
    ${cards}`;

  $$(".sched-chip", results).forEach(chip => {
    chip.addEventListener("click", () => {
      $("#search").value = "";
      $("#search-clear").hidden = true;
      clearSearch();
      renderDay(chip.dataset.date);
      $(".day-tabs-wrap").scrollIntoView({ behavior: "smooth", block: "start" });
    });
  });
}

function clearSearch() {
  $("#search-results").hidden = true;
  $("#search-results").innerHTML = "";
  $(".day-tabs-wrap").style.display = "";
  $("#day-detail").style.display = "";
  const t = getToday();
  $("#today").hidden = !dayByDate[t];
}

/* ---------- 오늘 날짜 결정 ---------- */
function getToday() {
  const now = new Date();
  const local = now.getFullYear() + "-" +
    String(now.getMonth() + 1).padStart(2, "0") + "-" +
    String(now.getDate()).padStart(2, "0");
  // 순례 기간 내이면 오늘, 기간 전이면 첫날, 기간 후이면 마지막날
  const dates = SCHEDULE.map(d => d.date);
  if (dates.includes(local)) return local;
  if (local < dates[0]) return dates[0];
  if (local > dates[dates.length - 1]) return dates[dates.length - 1];
  // 기간 내이지만 정확히 일치하는 날이 없는 경우(없음) 첫날
  return dates[0];
}

/* ---------- 초기화 ---------- */
function init() {
  const now = new Date();
  const local = now.getFullYear() + "-" +
    String(now.getMonth() + 1).padStart(2, "0") + "-" +
    String(now.getDate()).padStart(2, "0");
  const todayStr = getToday();
  const isInPeriod = !!dayByDate[local];

  buildTabs(local);
  if (isInPeriod) renderToday(local); else $("#today").hidden = true;
  renderDay(todayStr);

  const input = $("#search");
  const clearBtn = $("#search-clear");
  let timer;
  input.addEventListener("input", () => {
    clearBtn.hidden = !input.value;
    clearTimeout(timer);
    timer = setTimeout(() => search(input.value), 120);
  });
  clearBtn.addEventListener("click", () => {
    input.value = "";
    clearBtn.hidden = true;
    clearSearch();
    input.focus();
  });
}

document.addEventListener("DOMContentLoaded", init);
