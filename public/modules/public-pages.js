import {state,names} from './state.js';
import {escape} from './dom.js';
import {brand} from './ui.js';
import {themeButton} from './theme.js';
import {clubArt} from './club-art.js';

export function publicPage() {
  const p = state.public || {};
  const current = (p.tariffs || []).filter(t => Date.parse(t.valid_from) <= Date.parse(p.now) && (!t.valid_to || Date.parse(t.valid_to) > Date.parse(p.now)));
  const rateFor = cid => Math.min(...current.filter(t=>t.category_id===cid).map(t=>Number(t.hourly_rate)));
  const categories = [...new Map(current.map(t => [t.category_id,t.category_name])).entries()].sort((a,b)=>rateFor(a[0])-rateFor(b[0]));
  return `<div class="page-width">
    <header class="public-header">${brand()}<nav><a href="#tariffs">Тарифы</a><a href="#how">Как забронировать</a>${themeButton()}<a class="btn secondary" href="#/${state.user?'dashboard':'login'}">${state.user?'Личный кабинет':'Вход для сотрудников'} ↗</a></nav></header>
    <main>
      <section class="hero">
        <div class="hero-copy"><div class="hero-tag"><span class="dot"></span>КОМПЬЮТЕРНЫЙ КЛУБ / 049</div>
          <h1>Твоё место.<br>Твоё время.<br><em>Твоя игра.</em></h1>
          <p>Собирай команду или заходи соло. Выбери рабочее место, согласуй время с администратором — и погружайся в игру.</p>
          <div class="hero-actions"><a class="btn" href="#tariffs">Выбрать формат <span>↗</span></a><a class="btn secondary" href="#how">Как забронировать</a></div>
          <div class="hero-note"><span><b>${p.workplaces?.length||0}</b> рабочих мест</span><i></i><span><b>${categories.length}</b> категории</span><i></i><span>Оплата по времени</span></div>
        </div>
        <div class="gaming-stage"><div class="stage-top"><span>PLAY YOUR WAY</span><span class="live-label"><span class="dot"></span> CLUB 049</span></div>${clubArt()}<div class="stage-bottom"><span>ТВОЯ ИГРА НАЧИНАЕТСЯ ЗДЕСЬ</span><span>↗</span></div></div>
      </section>
      <div class="club-strip"><span>SOLO / SQUAD / TEAM</span><span>БРОНИРОВАНИЕ МЕСТ</span><span>УЧЁТ ПО МИНУТАМ</span><span>ТВОЙ РИТМ ИГРЫ ↗</span></div>
      <section class="section" id="tariffs"><div class="section-head"><div><span class="eyebrow">01 / Выбери свой сетап</span><h2>Место для твоей игры<span class="accent">.</span></h2></div><p>Без оплаты лишнего часа. Неполная минута округляется вверх, итоговая сумма — до копеек.</p></div>
        <div class="pricing">${categories.map(([cid,name],i)=>{
          const ts=current.filter(t=>t.category_id===cid),rate=Math.min(...ts.map(t=>Number(t.hourly_rate)));
          const team=name.toLowerCase().includes('команд'),vip=name.toLowerCase().includes('vip');
          return `<article class="price-card"><div class="price-top"><span class="eyebrow">0${i+1} / ${team?'SQUAD':vip?'LEVEL UP':'SOLO'}</span><span class="mini-monitor" aria-hidden="true">▱</span></div><h3>${escape(name)}</h3><p>${team?'Для совместной игры и командных встреч.':vip?'Отдельный формат для тех, кто хочет большего.':'Для повседневной игры и любимых тайтлов.'}</p><div class="price">от ${rate} ₽ <span>/ час</span></div><div class="price-rule"><span class="dot"></span>Поминутный расчёт</div><a href="#how" class="btn ${i===1?'':'secondary'}">Как забронировать ↗</a></article>`;
        }).join('')||'<p>Действующих тарифов пока нет. Уточни у администратора.</p>'}</div>
      </section>
      <section class="section" id="how"><div class="section-head"><div><span class="eyebrow">02 / От плана к игре</span><h2>Меньше ожидания.<br>Больше игры<span class="accent">.</span></h2></div><p>Бронь оформляет администратор клуба. Он проверит свободное время и поможет выбрать место.</p></div>
        <div class="process-grid">${[['Согласуй время','Сообщи администратору дату, длительность и категорию места. Бронь подтверждается после проверки доступности.'],['Приходи в клуб','Администратор проверит бронь и запустит посещение. Ожидание — до 15 минут от начала, в пределах забронированного интервала.'],['Играй и оплачивай','Стоимость рассчитывается по фактической длительности. После завершения кассир принимает полную оплату наличными или картой.']].map(([h,t],i)=>`<article><span class="step-number">0${i+1}<span>↗</span></span><h3>${h}</h3><p>${t}</p></article>`).join('')}</div>
      </section>
      <section class="team-banner"><div><span class="eyebrow">Сотрудникам клуба</span><h2>Вся смена.<br>В одном кабинете.</h2><p>Бронирования, сеансы, касса, ремонт и отчёты.<br>Каждому сотруднику — его задачи и права доступа.</p></div><a href="#/${state.user?'dashboard':'login'}" class="btn">Перейти в кабинет ↗</a></section>
    </main>
    <footer class="public-footer">${brand()}<span>© 2026 · Учебный проект<br>Добрынин Даниил Александрович · ИСП-049</span><a href="#/login">Кабинет сотрудников ↗</a></footer>
  </div>`;
}

export function loginPage() {
  return `<div class="page-width"><header class="public-header">${brand()}<div class="header-actions">${themeButton()}<a href="#/home" class="muted">← На главную</a></div></header>
    <main class="login-layout"><div class="login-intro"><span class="eyebrow">049 / Команда клуба</span><h1>Твоя смена.<br><em>Всё под контролем.</em></h1><p>Администратор, кассир, техник, бухгалтер и управляющий — у каждого свой кабинет и свои задачи.</p><div class="login-art">${clubArt()}</div></div>
    <section class="login-card"><span class="eyebrow">Доступ сотрудникам</span><h2>Вход в кабинет</h2><p class="muted">Продолжи работу клуба</p><form id="login-form" class="form-stack"><div class="error" role="alert"></div><label>Логин<input name="login" required maxlength="64" autocomplete="username" placeholder="Например, admin"></label><label>Пароль<input name="password" type="password" required maxlength="128" autocomplete="current-password" placeholder="Введи пароль"></label><button class="btn" type="submit">Войти в кабинет →</button><p class="help">Новую учётную запись создаёт управляющий клуба.</p></form><details class="demo-info"><summary>Учебные учётные записи</summary><div class="demo-list">${Object.entries(names).map(([role,name])=>`<button type="button" data-action="demo" data-id="${role}">${name}</button>`).join('')}</div><p class="help">Общий учебный пароль: <code>Club_Demo_2026!</code></p></details></section></main></div>`;
}
