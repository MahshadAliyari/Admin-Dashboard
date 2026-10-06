const usersBody = document.querySelector("#users-body");
const tableWrap = document.querySelector("#table-wrap");

const stateLoading = document.querySelector("#state-loading");
const stateError = document.querySelector("#state-error");
const stateEmpty = document.querySelector("#state-empty");
const stateErrorText = document.querySelector("#state-error-text");

const statTotal = document.querySelector("#stat-total");
const statAge = document.querySelector("#stat-age");
const statCity = document.querySelector("#stat-city");
const statLocal = document.querySelector("#stat-local");

const chartCities = document.querySelector("#chart-cities");
const chartAges = document.querySelector("#chart-ages");
const segA = document.querySelector(".seg-a");
const segB = document.querySelector(".seg-b");
const legendValues = document.querySelectorAll(".legend strong");

const pagerInfo = document.querySelector("#pager-info");
const filterCount = document.querySelector("#filter-count");
const activeFilters = document.querySelector("#active-filters");
const recentSearches = document.querySelector("#recent-searches");
const cityFilter = document.querySelector("#flt-city");

/* -----------------------------
   ابزارها
----------------------------- */

/* تبدیل عدد انگلیسی به فارسی */
export function toFa(value) {
  return String(value).replace(/\d/g, (digit) => "۰۱۲۳۴۵۶۷۸۹"[digit]);
}

/* جلوگیری از XSS */
export function escapeHtml(value) {
  return String(value ?? "").replace(
    /[&<>"']/g,
    (char) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[char],
  );
}

export function fullName(user) {
  return `${user.firstName} ${user.lastName}`;
}

export function initials(user) {
  const first = user.firstName?.[0] ?? "";
  const last = user.lastName?.[0] ?? "";

  return `${first}${last}`.toUpperCase();
}

/* -----------------------------
   حالت‌ها (Loading / Error / Empty)
----------------------------- */

export function showLoading() {
  stateLoading.hidden = false;
  stateError.hidden = true;
  stateEmpty.hidden = true;
  tableWrap.hidden = true;
}

export function showError(message) {
  stateLoading.hidden = true;
  stateEmpty.hidden = true;
  tableWrap.hidden = true;

  stateErrorText.textContent = message;
  stateError.hidden = false;
}

export function showEmpty() {
  stateLoading.hidden = true;
  stateError.hidden = true;
  stateEmpty.hidden = false;
  tableWrap.hidden = true;
}

export function hideStates() {
  stateLoading.hidden = true;
  stateError.hidden = true;
  stateEmpty.hidden = true;
  tableWrap.hidden = false;
}

/* -----------------------------
   جدول کاربران
----------------------------- */

function actionButton(action, id, label, icon, extraClass = "") {
  return `
    <button class="icon-btn ${extraClass}" type="button"
      data-action="${action}" data-id="${escapeHtml(id)}"
      aria-label="${label}">
      <svg class="icon" aria-hidden="true"><use href="#${icon}"></use></svg>
    </button>`;
}

/* mode: "all" | "server" | "local" | "deleted" */
export function renderUsers(users, mode = "all") {
  usersBody.innerHTML = "";

  users.forEach((user, index) => {
    const row = document.createElement("tr");
    row.dataset.id = user.id;

    const avatarClass = `a${(index % 3) + 1}`;

    const badge = user.local
      ? '<span class="badge badge-local">محلی</span>'
      : '<span class="badge badge-ok">سرور</span>';

    const actions =
      mode === "deleted"
        ? actionButton("restore", user.id, "بازگردانی", "i-up")
        : actionButton("view", user.id, "مشاهده جزئیات", "i-eye") +
          actionButton("edit", user.id, "ویرایش", "i-edit") +
          actionButton("delete", user.id, "حذف", "i-trash", "danger");

    row.innerHTML = `
      <td data-label="کاربر">
        <div class="user">
          <span class="avatar ${avatarClass}" aria-hidden="true">${escapeHtml(initials(user))}</span>
          <div>
            <div class="user-name" dir="ltr">${escapeHtml(fullName(user))}</div>
            <div class="user-mail" dir="ltr">${escapeHtml(user.email)}</div>
          </div>
        </div>
      </td>
      <td data-label="سن">${toFa(user.age)}</td>
      <td dir="ltr" data-label="شهر">${escapeHtml(user.address?.city ?? "نامشخص")}</td>
      <td data-label="وضعیت">${badge}</td>
      <td class="actions">${actions}</td>
    `;

    usersBody.append(row);
  });
}

/* -----------------------------
   آمار و نمودارها (از داده واقعی)
----------------------------- */

export function renderStats(users) {
  statLocal.textContent = toFa(users.filter((user) => user.local).length);

  if (!users.length) {
    statTotal.textContent = "۰";
    statAge.textContent = "۰";
    statCity.textContent = "-";
    return;
  }

  const total = users.length;
  const averageAge = users.reduce((sum, user) => sum + user.age, 0) / total;

  statTotal.textContent = toFa(total);
  statAge.textContent = toFa(averageAge.toFixed(1)).replace(".", "٫");
  statCity.textContent = topCities(users, 1)[0]?.[0] ?? "-";
}

function topCities(users, limit) {
  const counts = {};

  users.forEach((user) => {
    const city = user.address?.city ?? "نامشخص";
    counts[city] = (counts[city] ?? 0) + 1;
  });

  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit);
}

export function renderCharts(users) {
  /* شهرها */
  const cities = topCities(users, 5);
  const maxCity = Math.max(...cities.map(([, n]) => n), 1);

  chartCities.innerHTML = cities
    .map(
      ([city, count]) => `
      <li class="bar-row" style="--v: ${Math.round((count / maxCity) * 100)}">
        <span class="bar-label" dir="ltr">${escapeHtml(city)}</span>
        <span class="bar-track"><span class="bar-fill"></span></span>
        <span class="bar-num">${toFa(count)}</span>
      </li>`,
    )
    .join("");

  /* گروه‌های سنی */
  const groups = [
    { label: "۱۸–۲۴", test: (age) => age <= 24 },
    { label: "۲۵–۳۴", test: (age) => age >= 25 && age <= 34 },
    { label: "۳۵–۴۴", test: (age) => age >= 35 && age <= 44 },
    { label: "۴۵–۵۴", test: (age) => age >= 45 && age <= 54 },
    { label: "۵۵+", test: (age) => age >= 55 },
  ].map((group) => ({
    ...group,
    count: users.filter((user) => group.test(user.age)).length,
  }));

  const maxGroup = Math.max(...groups.map((group) => group.count), 1);

  chartAges.innerHTML = groups
    .map(
      (group) => `
      <div class="col" style="--v: ${Math.round((group.count / maxGroup) * 100)}">
        <span class="col-num">${toFa(group.count)}</span>
        <span class="col-bar"></span>
        <span class="col-label">${group.label}</span>
      </div>`,
    )
    .join("");

  /* جنسیت */
  const total = users.length;
  const male = total
    ? Math.round(
        (users.filter((user) => user.gender === "male").length / total) * 100,
      )
    : 0;
  const female = total ? 100 - male : 0;

  segA.setAttribute("stroke-dasharray", `${male} ${100 - male}`);
  segA.setAttribute("stroke-dashoffset", "25");
  segB.setAttribute("stroke-dasharray", `${female} ${100 - female}`);
  segB.setAttribute("stroke-dashoffset", String(25 - male));

  legendValues[0].textContent = `${toFa(male)}٪`;
  legendValues[1].textContent = `${toFa(female)}٪`;
}

/* شمارنده روی تب‌ها */
export function renderTabCounts(counts) {
  Object.entries(counts).forEach(([tab, value]) => {
    const element = document.querySelector(`[data-tab="${tab}"] .tab-count`);

    if (element) {
      element.textContent = toFa(value);
    }
  });
}

/* گزینه‌های شهر در فیلتر از روی داده واقعی */
export function renderCityOptions(cities) {
  const current = cityFilter.value;

  cityFilter.innerHTML = '<option value="">همه شهرها</option>';

  cities.forEach((city) => {
    const option = document.createElement("option");

    option.value = city;
    option.textContent = city;

    cityFilter.append(option);
  });

  cityFilter.value = current;
}

/* -----------------------------
   صفحه‌بندی
----------------------------- */

export function renderPager(total, currentPage, pageSize) {
  const start = total === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const end = Math.min(currentPage * pageSize, total);

  pagerInfo.textContent = `نمایش ${toFa(start)} تا ${toFa(end)} از ${toFa(total)}`;
}

/* -----------------------------
   جستجوهای اخیر و فیلترها
----------------------------- */

export function renderRecentSearches(searches) {
  const label = document.createElement("span");

  label.className = "muted";
  label.textContent = "جستجوهای اخیر";

  recentSearches.innerHTML = "";
  recentSearches.append(label);

  searches.forEach((search) => {
    const button = document.createElement("button");

    button.className = "chip";
    button.type = "button";
    button.textContent = search;
    button.dataset.search = search;

    recentSearches.append(button);
  });

  recentSearches.hidden = searches.length === 0;
}

export function renderFilterCount(count) {
  filterCount.textContent = toFa(count);
  filterCount.hidden = count === 0;
}

function filterChip(type, text) {
  const button = document.createElement("button");

  button.className = "chip chip-x";
  button.type = "button";
  button.dataset.remove = type;
  button.innerHTML = `${escapeHtml(text)}
    <svg class="icon" aria-hidden="true"><use href="#i-x"></use></svg>`;

  return button;
}

export function renderActiveFilters(filters) {
  activeFilters.innerHTML = "";

  const chips = [];

  if (filters.gender) {
    chips.push(
      filterChip(
        "gender",
        `جنسیت: ${filters.gender === "male" ? "مرد" : "زن"}`,
      ),
    );
  }

  if (filters.ageMin !== null || filters.ageMax !== null) {
    chips.push(
      filterChip(
        "age",
        `سن: ${toFa(filters.ageMin ?? 0)} تا ${filters.ageMax === null ? "∞" : toFa(filters.ageMax)}`,
      ),
    );
  }

  if (filters.city) {
    chips.push(filterChip("city", `شهر: ${filters.city}`));
  }

  activeFilters.hidden = chips.length === 0;

  if (!chips.length) {
    return;
  }

  const title = document.createElement("span");

  title.className = "muted";
  title.textContent = "فیلترهای فعال";

  const clearButton = document.createElement("button");

  clearButton.className = "chip-clear";
  clearButton.type = "button";
  clearButton.id = "clear-filters";
  clearButton.textContent = "پاک‌کردن همه";

  activeFilters.append(title, ...chips, clearButton);
}

/* -----------------------------
   جزئیات کاربر
----------------------------- */

export function renderDetails(user) {
  const dialog = document.querySelector("#detail-dialog");

  document.querySelector("#detail-title").textContent = fullName(user);

  const avatar = dialog.querySelector(".avatar");
  avatar.textContent = initials(user);

  const badge = dialog.querySelector(".detail-title .badge");
  badge.className = user.local ? "badge badge-local" : "badge badge-ok";
  badge.textContent = user.local ? "محلی" : "سرور";

  const id = String(user.id);
  const idText = /^\d+$/.test(id) ? toFa(id) : id;

  dialog.querySelector(".detail-list").innerHTML = `
    <div><dt>ایمیل</dt><dd dir="ltr">${escapeHtml(user.email)}</dd></div>
    <div><dt>تلفن</dt><dd dir="ltr">${escapeHtml(user.phone ?? "-")}</dd></div>
    <div><dt>سن</dt><dd>${toFa(user.age)}</dd></div>
    <div><dt>جنسیت</dt><dd>${user.gender === "female" ? "زن" : "مرد"}</dd></div>
    <div><dt>شهر</dt><dd dir="ltr">${escapeHtml(user.address?.city ?? "-")}</dd></div>
    <div><dt>شناسه</dt><dd dir="ltr">${escapeHtml(idText)}</dd></div>
  `;
}
