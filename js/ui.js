import {
  faNumber,
  escapeHtml,
  formatBytes,
  fullName,
  initials,
  genderLabel,
  userStatus,
  activeUsers,
  computeStats,
  countBy,
  ageGroups,
  genderShare,
} from "./logic.js";

export const $ = (selector, root = document) => root.querySelector(selector);
export const $$ = (selector, root = document) => [
  ...root.querySelectorAll(selector),
];

const icon = (id) => `<svg aria-hidden="true"><use href="#${id}"></use></svg>`;

function setText(selector, value) {
  const element = $(selector);
  if (element) element.textContent = value;
}

function emptyBox(text, iconId = "i-inbox") {
  return `<div class="empty-box">${icon(iconId)}<p>${escapeHtml(text)}</p></div>`;
}

/* =========================================================
   VIEW / BRAND / TOAST
   ========================================================= */

export function showView(view) {
  $$("[data-view]").forEach((section) => {
    section.hidden = section.dataset.view !== view;
  });

  $$("[data-nav]").forEach((link) => {
    if (link.dataset.nav === view) link.setAttribute("aria-current", "page");
    else link.removeAttribute("aria-current");
  });
}

export function setBrand(title) {
  setText("#site-name", title);
}

export function toast(message, type = "success") {
  const region = $("#toast-region");
  if (!region) return;

  const element = document.createElement("div");
  element.className = `toast toast-${type}`;
  element.textContent = message;
  region.appendChild(element);

  setTimeout(() => element.remove(), 4000);
}

const API_STATUS = {
  loading: { text: "در حال اتصال به DummyJSON...", className: "badge-warning" },
  ok: { text: "اتصال به DummyJSON برقرار است", className: "badge-success" },
  error: { text: "اتصال به DummyJSON برقرار نیست", className: "badge-danger" },
};

export function setApiStatus(status) {
  const info = API_STATUS[status] || API_STATUS.loading;
  const element = $("#api-status");
  if (!element) return;

  element.textContent = info.text;
  element.className = `badge ${info.className}`;
}

/* =========================================================
   FORM ERRORS
   ========================================================= */

export function setFormErrors(form, errors = {}) {
  $$("[data-error-for]", form).forEach((element) => {
    element.textContent = errors[element.dataset.errorFor] || "";
  });

  $$("input[name], select[name], textarea[name]", form).forEach((field) => {
    if (errors[field.name]) field.setAttribute("aria-invalid", "true");
    else field.removeAttribute("aria-invalid");
  });

  const firstInvalid = $('[aria-invalid="true"]', form);
  firstInvalid?.focus();
}

export function setSearchError(message) {
  setText("#search-error", message);

  const input = $("#search-input");
  if (!input) return;

  if (message) input.setAttribute("aria-invalid", "true");
  else input.removeAttribute("aria-invalid");
}

/* =========================================================
   USERS TABLE STATES
   ========================================================= */

export function showState(type) {
  const map = {
    "#state-loading": "loading",
    "#state-error": "error",
    "#state-empty": "empty",
    "#table-wrap": "table",
  };

  Object.entries(map).forEach(([selector, name]) => {
    const element = $(selector);
    if (element) element.hidden = type !== name;
  });
}

export function setError(message) {
  setText("#state-error-text", message);
}

export function setSortIndicator(sort) {
  const button = $("[data-sort='age']");
  if (!button) return;

  const direction =
    sort === "age-asc" ? "asc" : sort === "age-desc" ? "desc" : "none";
  button.dataset.dir = direction;

  button
    .closest("th")
    ?.setAttribute(
      "aria-sort",
      { asc: "ascending", desc: "descending", none: "none" }[direction],
    );
}

/* =========================================================
   STATS & TAB COUNTS
   ========================================================= */

export function renderStats(stats) {
  setText("#stat-total", faNumber(stats.total));
  setText("#stat-age", faNumber(stats.averageAge));
  setText("#stat-city", faNumber(stats.cities));
  setText("#stat-local", faNumber(stats.local));

  setText('[data-tab-count="all"]', faNumber(stats.total));
  setText('[data-tab-count="server"]', faNumber(stats.server));
  setText('[data-tab-count="local"]', faNumber(stats.local));
  setText('[data-tab-count="deleted"]', faNumber(stats.deleted));
}

/* =========================================================
   USERS TABLE
   ========================================================= */

function tableButton(action, id, label, iconId, variant = "") {
  return `
    <button type="button" class="icon-btn ${variant}"
      data-action="${action}" data-id="${escapeHtml(id)}"
      aria-label="${escapeHtml(label)}" title="${escapeHtml(label)}">
      ${icon(iconId)}
    </button>`;
}

export function renderUsers(users, deletedIds) {
  const tbody = $("#users-body");
  if (!tbody) return;

  tbody.innerHTML = users
    .map((user) => {
      const id = String(user.id);
      const deleted = deletedIds.has(id);
      const status = userStatus(user, deletedIds);

      const actions = deleted
        ? tableButton("restore", id, "بازیابی کاربر", "i-up")
        : tableButton("edit", id, "ویرایش کاربر", "i-edit") +
          tableButton("delete", id, "حذف کاربر", "i-trash", "danger");

      return `
        <tr class="${deleted ? "is-deleted" : ""}">
          <td class="cell-user" data-label="کاربر">
            <div class="user-cell">
              <span class="avatar" aria-hidden="true">${escapeHtml(initials(user))}</span>
              <span class="user-info">
                <strong class="user-name">${escapeHtml(fullName(user))}</strong>
                <span class="user-meta">${user.local ? "کاربر محلی" : `شناسه: ${escapeHtml(id)}`}</span>
              </span>
            </div>
          </td>
          <td data-label="ایمیل"><span dir="ltr">${escapeHtml(user.email || "-")}</span></td>
          <td data-label="شهر">${escapeHtml(user.city || "-")}</td>
          <td data-label="جنسیت">${escapeHtml(genderLabel(user.gender))}</td>
          <td data-label="سن">${faNumber(user.age)}</td>
          <td data-label="وضعیت"><span class="badge badge-${status.className}">${status.label}</span></td>
          <td class="cell-actions" data-label="عملیات">
            <div class="action-buttons">
              ${tableButton("detail", id, "مشاهده جزئیات", "i-eye")}
              ${actions}
            </div>
          </td>
        </tr>`;
    })
    .join("");
}

/* =========================================================
   CHARTS
   ========================================================= */

function renderDonut(ids, share) {
  const { male, female } = ids;

  setText(male.text, `${faNumber(share.malePercent)}٪`);
  setText(female.text, `${faNumber(share.femalePercent)}٪`);

  $(male.segment)?.setAttribute(
    "stroke-dasharray",
    `${share.malePercent} ${100 - share.malePercent}`,
  );

  const femaleSegment = $(female.segment);
  femaleSegment?.setAttribute(
    "stroke-dasharray",
    `${share.femalePercent} ${100 - share.femalePercent}`,
  );
  femaleSegment?.setAttribute(
    "stroke-dashoffset",
    String(25 - share.malePercent),
  );
}

function barRows(entries, emptyText) {
  if (!entries.length) return `<li class="chart-empty">${emptyText}</li>`;

  const max = Math.max(...entries.map(([, count]) => count));

  return entries
    .map(
      ([label, count]) => `
        <li>
          <div class="chart-label">
            <span>${escapeHtml(label)}</span>
            <strong>${faNumber(count)}</strong>
          </div>
          <div class="chart-bar"><span style="width:${(count / max) * 100}%"></span></div>
        </li>`,
    )
    .join("");
}

function renderAgeColumns(groups) {
  const max = Math.max(...groups.map((group) => group.count), 1);

  return `
    <div class="age-chart">
      ${groups
        .map(
          (group) => `
            <div class="age-column">
              <span class="age-value">${faNumber(group.count)}</span>
              <div class="age-bar"><span style="height:${Math.max((group.count / max) * 100, 3)}%"></span></div>
              <small dir="ltr">${group.label}</small>
            </div>`,
        )
        .join("")}
    </div>`;
}

export function renderCharts(users, deletedIds) {
  const active = activeUsers(users, deletedIds);
  const cities = countBy(active, (user) => user.city).slice(0, 8);

  const cityList = $("#chart-cities");
  if (cityList) cityList.innerHTML = barRows(cities, "اطلاعاتی وجود ندارد.");

  const ages = $("#chart-ages");
  if (ages) ages.innerHTML = renderAgeColumns(ageGroups(active));

  renderDonut(
    {
      male: { segment: "#seg-a", text: "#male-percent" },
      female: { segment: "#seg-b", text: "#female-percent" },
    },
    genderShare(active),
  );
}

/* =========================================================
   SEARCH CHIPS & FILTER CHIPS
   ========================================================= */

export function renderRecentSearches(searches) {
  const container = $("#recent-searches");
  if (!container) return;

  const values = searches.filter(Boolean).slice(0, 5);

  container.innerHTML = values.length
    ? `
      <div class="chip-row">
        <span class="chip-label">جستجوهای اخیر:</span>
        ${values
          .map(
            (search) =>
              `<button type="button" class="chip" data-recent-search="${escapeHtml(search)}">${escapeHtml(search)}</button>`,
          )
          .join("")}
        <button type="button" class="chip chip-clear" data-clear-recent>پاک کردن</button>
      </div>`
    : "";
}

const SORT_LABELS = {
  "age-asc": "سن: کم به زیاد",
  "age-desc": "سن: زیاد به کم",
  "name-asc": "نام: الفبایی",
};

export function renderActiveFilters(filters) {
  const container = $("#active-filters");
  if (!container) return;

  const items = [];

  if (filters.gender)
    items.push(["gender", `جنسیت: ${genderLabel(filters.gender)}`]);
  if (filters.ageMin)
    items.push(["ageMin", `حداقل سن: ${faNumber(filters.ageMin)}`]);
  if (filters.ageMax)
    items.push(["ageMax", `حداکثر سن: ${faNumber(filters.ageMax)}`]);
  if (filters.city) items.push(["city", `شهر: ${filters.city}`]);
  if (SORT_LABELS[filters.sort])
    items.push(["sort", SORT_LABELS[filters.sort]]);

  const count = $("#filter-count");
  if (count) {
    count.textContent = faNumber(items.length);
    count.hidden = items.length === 0;
  }

  container.innerHTML = items.length
    ? `<div class="chip-row">
        ${items
          .map(
            ([key, label]) => `
              <button type="button" class="chip chip-filter" data-remove-filter="${key}"
                aria-label="حذف فیلتر ${escapeHtml(label)}">
                ${escapeHtml(label)} ${icon("i-x")}
              </button>`,
          )
          .join("")}
      </div>`
    : "";
}

/* =========================================================
   PAGINATION
   ========================================================= */

function pageNumbers(current, total) {
  const pages = new Set([1, total, current - 1, current, current + 1]);
  const sorted = [...pages]
    .filter((page) => page >= 1 && page <= total)
    .sort((a, b) => a - b);

  const result = [];
  sorted.forEach((page, index) => {
    if (index && page - sorted[index - 1] > 1) result.push("…");
    result.push(page);
  });
  return result;
}

export function renderPagination(total, page, pageSize) {
  const info = $("#pager-info");
  const buttons = $("#pager-btns");
  if (!info || !buttons) return;

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const current = Math.min(Math.max(page, 1), totalPages);

  if (!total) {
    info.textContent = "۰ کاربر";
    buttons.innerHTML = "";
    return;
  }

  const from = (current - 1) * pageSize + 1;
  const to = Math.min(current * pageSize, total);
  info.textContent = `${faNumber(from)} تا ${faNumber(to)} از ${faNumber(total)} کاربر`;

  if (totalPages <= 1) {
    buttons.innerHTML = "";
    return;
  }

  const numbers = pageNumbers(current, totalPages)
    .map((item) =>
      item === "…"
        ? `<span class="pager-gap" aria-hidden="true">…</span>`
        : `<button type="button" data-page="${item}" class="${item === current ? "active" : ""}"
             ${item === current ? 'aria-current="page"' : ""} aria-label="صفحه ${faNumber(item)}">${faNumber(item)}</button>`,
    )
    .join("");

  buttons.innerHTML = `
    <button type="button" data-page="${current - 1}" aria-label="صفحه قبل" ${current === 1 ? "disabled" : ""}>${icon("i-chev-right")}</button>
    ${numbers}
    <button type="button" data-page="${current + 1}" aria-label="صفحه بعد" ${current === totalPages ? "disabled" : ""}>${icon("i-chev-left")}</button>`;
}

/* =========================================================
   USER DETAILS
   ========================================================= */

export function renderDetails(user, deleted = false) {
  if (!user) return;

  setText("#detail-avatar", initials(user));
  setText("#detail-title", fullName(user));

  const status = userStatus(
    user,
    deleted ? new Set([String(user.id)]) : new Set(),
  );
  const badge = $("#detail-status");
  if (badge) {
    badge.textContent = status.label;
    badge.className = `badge badge-${status.className}`;
  }

  const values = {
    email: user.email || "-",
    phone: user.phone || "-",
    age: user.age ? faNumber(user.age) : "-",
    gender: genderLabel(user.gender),
    city: user.city || "-",
    id: user.id || "-",
  };

  $$("[data-detail]").forEach((element) => {
    element.textContent = values[element.dataset.detail] ?? "-";
  });
}

/* =========================================================
   REPORTS
   ========================================================= */

export function renderReports(users, deletedIds) {
  const stats = computeStats(users, deletedIds);
  const active = activeUsers(users, deletedIds);

  setText("#report-total", faNumber(stats.total));
  setText("#report-server", faNumber(stats.server));
  setText("#report-local", faNumber(stats.local));
  setText("#report-deleted", faNumber(stats.deleted));

  setText("#report-status-server", faNumber(stats.server));
  setText("#report-status-local", faNumber(stats.local));
  setText("#report-status-deleted", faNumber(stats.deleted));

  renderDonut(
    {
      male: { segment: "#report-male-seg", text: "#report-male" },
      female: { segment: "#report-female-seg", text: "#report-female" },
    },
    genderShare(active),
  );

  const cities = $("#report-cities");
  if (cities) {
    cities.innerHTML = countBy(active, (user) => user.city)
      .slice(0, 8)
      .map(
        ([city, count]) =>
          `<div class="report-row"><span>${escapeHtml(city)}</span><strong>${faNumber(count)}</strong></div>`,
      )
      .join("");
  }

  const ages = $("#report-ages");
  if (ages) {
    ages.innerHTML = ageGroups(active)
      .map(
        (group) =>
          `<div class="report-row"><span dir="ltr">${group.label}</span><strong>${faNumber(group.count)}</strong></div>`,
      )
      .join("");
  }

  setText(
    "#report-summary-text",
    `در حال حاضر ${faNumber(stats.total)} کاربر فعال در سیستم وجود دارد؛ ` +
      `${faNumber(stats.server)} کاربر از سرور و ${faNumber(stats.local)} کاربر به‌صورت محلی مدیریت می‌شوند. ` +
      `میانگین سنی کاربران ${faNumber(stats.averageAge)} سال و پراکندگی آن‌ها در ${faNumber(stats.cities)} شهر است.`,
  );
}

/* =========================================================
   COMMENTS
   ========================================================= */

const COMMENT_STATUS = {
  pending: { label: "در انتظار تأیید", className: "warning" },
  approved: { label: "تأیید شده", className: "success" },
  spam: { label: "هرزنامه", className: "danger" },
};

function commentButton(action, id, label, variant = "") {
  return `<button type="button" class="btn btn-sm ${variant}" data-comment-action="${action}" data-id="${escapeHtml(id)}">${label}</button>`;
}

function commentActions(comment) {
  const id = comment.id;
  if (comment.status === "pending") {
    return (
      commentButton("approve", id, "تأیید", "btn-primary") +
      commentButton("reply", id, "پاسخ") +
      commentButton("spam", id, "هرزنامه") +
      commentButton("delete", id, "حذف", "btn-danger")
    );
  }
  if (comment.status === "approved") {
    return (
      commentButton("reply", id, "پاسخ") +
      commentButton("delete", id, "حذف", "btn-danger")
    );
  }
  return (
    commentButton("approve", id, "این هرزنامه نیست") +
    commentButton("delete", id, "حذف", "btn-danger")
  );
}

export function renderComments(allComments, filter) {
  const counts = { all: allComments.length, pending: 0, approved: 0, spam: 0 };
  allComments.forEach((comment) => {
    if (counts[comment.status] !== undefined) counts[comment.status]++;
  });

  Object.entries(counts).forEach(([key, value]) => {
    setText(`[data-comment-count="${key}"]`, faNumber(value));
  });

  const badge = $("#nav-comments-badge");
  if (badge) {
    badge.textContent = faNumber(counts.pending);
    badge.hidden = counts.pending === 0;
  }

  $$("[data-comment-filter]").forEach((button) => {
    const active = button.dataset.commentFilter === filter;
    button.setAttribute("aria-selected", String(active));
  });

  const container = $("#comments-list");
  if (!container) return;

  const comments = allComments.filter(
    (comment) => filter === "all" || comment.status === filter,
  );

  if (!comments.length) {
    container.innerHTML = emptyBox("نظری با این وضعیت پیدا نشد.", "i-comments");
    return;
  }

  container.innerHTML = comments
    .map((comment) => {
      const status = COMMENT_STATUS[comment.status] || COMMENT_STATUS.pending;
      const replies = (comment.replies || [])
        .map(
          (reply) => `
            <div class="comment-reply">
              <div class="comment-head">
                <strong>پاسخ شما</strong>
                <span class="comment-date">${escapeHtml(reply.date)}</span>
              </div>
              <p>${escapeHtml(reply.text)}</p>
            </div>`,
        )
        .join("");

      return `
        <article class="comment-item" data-status="${comment.status}">
          <div class="comment-avatar" aria-hidden="true">${escapeHtml(comment.name.charAt(0) || "؟")}</div>
          <div class="comment-body">
            <div class="comment-head">
              <strong>${escapeHtml(comment.name)}</strong>
              <time class="comment-date" dir="ltr">${escapeHtml(comment.date)}</time>
              <span class="badge badge-${status.className}">${status.label}</span>
            </div>
            <p>${escapeHtml(comment.text)}</p>
            ${replies}
            <div class="comment-actions">${commentActions(comment)}</div>
          </div>
        </article>`;
    })
    .join("");
}

/* =========================================================
   POSTS / PAGES / MEDIA
   ========================================================= */

export function renderPosts(posts, filtered) {
  const container = $("#posts-list");
  if (!container) return;

  if (!posts.length) {
    container.innerHTML = emptyBox(
      filtered
        ? "نوشته‌ای با این مشخصات پیدا نشد."
        : "هنوز نوشته‌ای ندارید. اولین نوشته را اضافه کنید.",
      "i-posts",
    );
    return;
  }

  container.innerHTML = posts
    .map((post) => {
      const published = post.status === "published";

      return `
        <article class="list-item">
          <div class="list-main">
            <h3>${escapeHtml(post.title)}</h3>
            <p>${escapeHtml(post.excerpt || "بدون توضیح")}</p>
          </div>
          <div class="list-side">
            <span class="badge ${published ? "badge-success" : "badge-warning"}">${published ? "منتشر شده" : "پیش‌نویس"}</span>
            <div class="action-buttons">
              <button type="button" class="btn btn-sm" data-post-action="toggle" data-id="${escapeHtml(post.id)}">
                ${published ? "بازگشت به پیش‌نویس" : "انتشار"}
              </button>
              <button type="button" class="icon-btn" data-post-action="edit" data-id="${escapeHtml(post.id)}" aria-label="ویرایش نوشته" title="ویرایش نوشته">${icon("i-edit")}</button>
              <button type="button" class="icon-btn danger" data-post-action="delete" data-id="${escapeHtml(post.id)}" aria-label="حذف نوشته" title="حذف نوشته">${icon("i-trash")}</button>
            </div>
          </div>
        </article>`;
    })
    .join("");
}

export function renderPages(pages) {
  const container = $("#pages-list");
  if (!container) return;

  if (!pages.length) {
    container.innerHTML = emptyBox(
      "هنوز برگه‌ای ندارید. اولین برگه را اضافه کنید.",
      "i-pages",
    );
    return;
  }

  container.innerHTML = pages
    .map(
      (page) => `
        <article class="list-item">
          <div class="list-main">
            <h3>${escapeHtml(page.title)}</h3>
            <p>${escapeHtml(page.desc || "بدون توضیح")}</p>
          </div>
          <div class="action-buttons">
            <button type="button" class="icon-btn" data-page-action="edit" data-id="${escapeHtml(page.id)}" aria-label="ویرایش ${escapeHtml(page.title)}" title="ویرایش">${icon("i-edit")}</button>
            <button type="button" class="icon-btn danger" data-page-action="delete" data-id="${escapeHtml(page.id)}" aria-label="حذف ${escapeHtml(page.title)}" title="حذف">${icon("i-trash")}</button>
          </div>
        </article>`,
    )
    .join("");
}

export function renderMedia(items, previews) {
  const container = $("#media-grid");
  if (!container) return;

  if (!items.length) {
    container.innerHTML = emptyBox("پرونده‌ای آپلود نشده است.", "i-media");
    return;
  }

  container.innerHTML = items
    .map((item) => {
      const preview = previews.get(item.id);
      const ext = (item.name.split(".").pop() || "FILE").toUpperCase();

      return `
        <article class="media-item">
          <div class="media-preview">
            ${preview ? `<img src="${escapeHtml(preview)}" alt="${escapeHtml(item.name)}" loading="lazy" />` : `<span dir="ltr">${escapeHtml(ext)}</span>`}
          </div>
          <div class="media-meta">
            <div>
              <strong dir="ltr">${escapeHtml(item.name)}</strong>
              <span>${formatBytes(item.size)}</span>
            </div>
            <button type="button" class="icon-btn danger" data-media-action="delete" data-id="${escapeHtml(item.id)}" aria-label="حذف ${escapeHtml(item.name)}" title="حذف">${icon("i-trash")}</button>
          </div>
        </article>`;
    })
    .join("");
}

/* =========================================================
   DASHBOARD 
   ========================================================= */

export function renderDashboard({
  stats,
  posts,
  pages,
  comments,
  recentUsers,
  apiStatus,
  lastSync,
}) {
  const pending = comments.filter(
    (comment) => comment.status === "pending",
  ).length;

  const glance = $("#glance-list");
  if (glance) {
    glance.innerHTML = [
      ["i-users", "users", stats.total, "کاربر"],
      ["i-posts", "posts", posts.length, "نوشته"],
      ["i-pages", "pages", pages.length, "برگه"],
      ["i-comments", "comments", comments.length, "نظر"],
    ]
      .map(
        ([iconId, view, count, label]) =>
          `<li><a href="#${view}">${icon(iconId)}<span><strong>${faNumber(count)}</strong> ${label}</span></a></li>`,
      )
      .join("");
  }

  const note = $("#glance-note");
  if (note) {
    note.innerHTML = pending
      ? `<a href="#comments"><strong>${faNumber(pending)}</strong> نظر در انتظار تأیید شماست.</a>`
      : "همه‌ی نظرها بررسی شده‌اند.";
  }

  const activity = $("#activity-list");
  if (activity) {
    const latestPosts = posts.slice(0, 3);
    const latestComments = comments.slice(0, 3);

    activity.innerHTML = `
      <h3 class="activity-title">آخرین نوشته‌ها</h3>
      ${
        latestPosts.length
          ? `<ul class="mini-list">${latestPosts
              .map(
                (post) => `
                  <li>
                    <span class="mini-main">${escapeHtml(post.title)}</span>
                    <span class="badge ${post.status === "published" ? "badge-success" : "badge-warning"}">${post.status === "published" ? "منتشر شده" : "پیش‌نویس"}</span>
                  </li>`,
              )
              .join("")}</ul>`
          : `<p class="muted">نوشته‌ای وجود ندارد.</p>`
      }
      <h3 class="activity-title">آخرین نظرها</h3>
      ${
        latestComments.length
          ? `<ul class="mini-list">${latestComments
              .map(
                (comment) => `
                  <li>
                    <span class="mini-main"><strong>${escapeHtml(comment.name)}</strong> — ${escapeHtml(comment.text.slice(0, 48))}${comment.text.length > 48 ? "…" : ""}</span>
                  </li>`,
              )
              .join("")}</ul>`
          : `<p class="muted">نظری وجود ندارد.</p>`
      }`;
  }

  const recent = $("#recent-users");
  if (recent) {
    recent.innerHTML = recentUsers.length
      ? recentUsers
          .map(
            (user) => `
              <li>
                <span class="avatar" aria-hidden="true">${escapeHtml(initials(user))}</span>
                <span class="mini-main">
                  <strong>${escapeHtml(fullName(user))}</strong>
                  <small dir="ltr">${escapeHtml(user.email)}</small>
                </span>
                <button type="button" class="icon-btn" data-action="detail" data-id="${escapeHtml(user.id)}" aria-label="مشاهده جزئیات ${escapeHtml(fullName(user))}">${icon("i-eye")}</button>
              </li>`,
          )
          .join("")
      : `<li class="muted">کاربری وجود ندارد.</li>`;
  }

  const system = $("#system-status");
  if (system) {
    const info = API_STATUS[apiStatus] || API_STATUS.loading;
    const syncText = lastSync ? lastSync.toLocaleTimeString("fa-IR") : "—";

    system.innerHTML = `
      <dl class="status-list">
        <div><dt>اتصال به API</dt><dd><span class="badge ${info.className}">${apiStatus === "ok" ? "برقرار" : apiStatus === "error" ? "قطع" : "در حال اتصال"}</span></dd></div>
        <div><dt>آخرین همگام‌سازی</dt><dd>${syncText}</dd></div>
        <div><dt>کاربران سرور</dt><dd>${faNumber(stats.server)}</dd></div>
        <div><dt>کاربران محلی</dt><dd>${faNumber(stats.local)}</dd></div>
        <div><dt>حذف‌شده‌ها</dt><dd>${faNumber(stats.deleted)}</dd></div>
      </dl>
      <button type="button" class="btn btn-sm" data-action="refresh">${icon("i-up")} همگام‌سازی مجدد</button>`;
  }
}
