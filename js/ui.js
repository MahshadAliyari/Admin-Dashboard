import { GENDER_LABLES, fullName, initials, toFa, toPercent } from "./listu.js";

const SVG_NS = "http://www.w3.org/2000/svg";
const AVATAR_CLASSES = ["a1", "a2", "a3"];
const ROLE_LABELS = { admin: "مدیر سیستم", moderator: "ناظر", user: "کاربر" };

const $ = (selector, root = document) => root.querySelector(selector);

// ---------- ساختن المان‌ها ----------

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function icon(name) {
  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("class", "icon");
  svg.setAttribute("aria-hidden", "true");
  const use = document.createElementNS(SVG_NS, "use");
  use.setAttribute("href", `#i-${name}`);
  svg.append(use);
  return svg;
}

function avatarClass(user) {
  const sum = [...String(user.id)].reduce((s, ch) => s + ch.charCodeAt(0), 0);
  return AVATAR_CLASSES[sum % AVATAR_CLASSES.length];
}

// -------- حالت‌های Loading / Error / Empty / Table ----------

function setView(view) {
  $("#state-loading").hidden = view !== "loading";
  $("#state-error").hidden = view !== "error";
  $("#state-empty").hidden = view !== "empty";
  $("#table-wrap").hidden = view !== "table";
  $(".pager").hidden = view !== "table";
}

export function showLoading() {
  setView("loading");
}
export function hideLoading() {
  $("state-loading").hidden = true;
}
export function showEmpty() {
  setView("empty");
}
export function showTable() {
  setView("table");
}

export function showError(message) {
  $("#state-error-text").textContent = message;
  setView("error");
}

// --------- جدول ----------

function createCell(label, content, dir) {
  const td = el("td");
  td.dataset.label = label;
  if (dir) td.dir = dir;
  td.append(content);
  return td;
}

function createUserCell(user) {
  const name = el("div", "user-name", fullName(user));
  const mail = el("div", "user-mail", user.email);
  name.dir = "ltr";
  mail.dir = "ltr";
  const avatar = el("span", `avatar ${avatarClass(user)}`, initials(user));
  avatar.setAttribute("aria-hidden", "true");
  const info = el("div");
  info.append(name, mail);
  const wrap = el("div", "user");
  wrap.append(avatar, info);
  return createCell("کاربر", wrap);
}

function createBadge(user) {
  const isLocal = user.source === "local";
  return el(
    "span",
    isLocal ? "badge badge-local" : "badge badge-ok",
    isLocal ? "محلی" : "سرور",
  );
}

function createIconButton(action, label, iconName, extraClass = "") {
  const btn = el("button", `icon-btn ${extraClass}`.trim());
  btn.type = "button";
  btn.dataset.action = action;
  btn.setAttribute("aria-label", label);
  btn.append(icon(iconName));
  return btn;
}

function createActionsCell(user, isDeleted) {
  const td = el("td", "actions");
  const name = fullName(user);
  td.append(createIconButton("view", `جزئیات ${name}`, "eye"));
  if (isDeleted) {
    const restore = el("button", "btn btn-sm", "بازیابی");
    restore.type = "button";
    restore.dataset.action = "restore";
    td.append(restore);
  } else {
    td.append(
      createIconButton("edit", `ویرایش ${name}`, "edit"),
      createIconButton("delete", `حذف ${name}`, "trash", "danger"),
    );
  }
  return td;
}

function createRow(user, isDeleted) {
  const tr = el("tr");
  tr.dataset.id = user.id;
  tr.append(
    createUserCell(user),
    createCell("سن", toFa(user.age)),
    createCell("شهر", user.city || "—", "ltr"),
    createCell("وضعیت", createBadge(user)),
    createActionsCell(user, isDeleted),
  );
  return tr;
}

export function renderTable(users, isDeleted) {
  $("#users-body").replaceChildren(
    ...users.map((u) => createRow(u, isDeleted)),
  );
}

// ---------- صفحه‌بندی ----------

function pageButton(label, page, disabled, current = false) {
  const btn = el(
    "button",
    current ? "btn btn-sm is-current" : "btn btn-sm",
    label,
  );
  btn.type = "button";
  btn.dataset.page = page;
  btn.disabled = disabled;
  if (current) btn.setAttribute("aria-current", "page");
  return btn;
}

function visiblePages(page, totalPages) {
  const start = Math.max(1, Math.min(page - 2, totalPages - 4));
  const end = Math.min(totalPages, start + 4);
  return Array.from({ length: end - start + 1 }, (_, i) => start + i);
}

export function renderPager({ page, totalPages, from, to, total }) {
  $("#pager-info").textContent =
    `نمایش ${toFa(from)} تا ${toFa(to)} از ${toFa(total)}`;
  $("#pager-btns").replaceChildren(
    pageButton("قبلی", page - 1, page === 1),
    ...visiblePages(page, totalPages).map((n) =>
      pageButton(toFa(n), n, false, n === page),
    ),
    pageButton("بعدی", page + 1, page === totalPages),
  );
}

// ---------- آمار و نمودارها ----------

export function renderStats(stats) {
  $("#stat-total").textContent = toFa(stats.total);
  $("#stat-age").textContent = toFa(Number(stats.avgAge.toFixed(1)));
  $("#stat-city").textContent = stats.topCity;
  $("#stat-local").textContent = toFa(stats.localCount);
}

export function renderCityChart(items) {
  const max = Math.max(...items.map((i) => i.count), 1);
  const rows = items.map(({ city, count }) => {
    const li = el("li", "bar-row");
    li.style.setProperty("--v", toPercent(count, max));
    const label = el("span", "bar-label", city);
    label.dir = "ltr";
    const track = el("span", "bar-track");
    track.append(el("span", "bar-fill"));
    li.append(label, track, el("span", "bar-num", toFa(count)));
    return li;
  });
  $("#chart-cities").replaceChildren(...rows);
}

export function renderAgeChart(groups) {
  const max = Math.max(...groups.map((g) => g.count), 1);
  const cols = groups.map(({ label, count }) => {
    const col = el("div", "col");
    col.style.setProperty("--v", toPercent(count, max));
    col.append(
      el("span", "col-num", toFa(count)),
      el("span", "col-bar"),
      el("span", "col-label", label),
    );
    return col;
  });
  $("#chart-ages").replaceChildren(...cols);
}

export function renderGenderChart({ male, female }) {
  const maleRing = $(".seg-a");
  const femaleRing = $(".seg-b");
  maleRing.setAttribute("stroke-dasharray", `${male} ${100 - male}`);
  maleRing.setAttribute("stroke-dashoffset", 25);
  femaleRing.setAttribute("stroke-dasharray", `${female} ${100 - female}`);
  femaleRing.setAttribute("stroke-dashoffset", 25 - male);
  const [maleText, femaleText] = document.querySelectorAll(".legend strong");
  maleText.textContent = `${toFa(male)}٪`;
  femaleText.textContent = `${toFa(female)}٪`;
}

// ---------- اسلایدر مدیران ----------

function createSlide(user, index) {
  const photo = el("div", `photo p${(index % 5) + 1}`);
  photo.append(el("span", "", initials(user)));
  if (user.image) {
    const img = el("img");
    img.src = user.image;
    img.alt = fullName(user);
    img.loading = "lazy";
    img.addEventListener("error", () => img.remove()); // اگر عکس نیامد، حروف اول می‌ماند
    photo.append(img);
  }
  const name = el("h3", "", fullName(user));
  name.dir = "ltr";
  const mail = el("p", "mail", user.email);
  mail.dir = "ltr";
  const role = ROLE_LABELS[user.role] ?? ROLE_LABELS.user;
  const body = el("div", "slide-body");
  body.append(
    name,
    el("p", "role", user.jobTitle ? `${role} · ${user.jobTitle}` : role),
    mail,
  );
  const slide = el("article", "slide");
  slide.append(photo, body);
  return slide;
}

export function renderSlider(admins) {
  $("#admin-slider").replaceChildren(...admins.map(createSlide));
  const dots = admins.map((_, i) =>
    el("span", i === 0 ? "dot-i is-on" : "dot-i"),
  );
  $("#slider-dots").replaceChildren(...dots);
}

// ---------- تب‌ها، چیپ‌ها، فیلترهای فعال ----------

export function renderTabs(counts, activeTab) {
  document.querySelectorAll(".tab").forEach((tab) => {
    const name = tab.dataset.tab;
    const selected = name === activeTab;
    tab.setAttribute("aria-selected", String(selected));
    tab.tabIndex = selected ? 0 : -1;
    $(".tab-count", tab).textContent = toFa(counts[name]);
  });
  $("#users-panel").setAttribute("aria-labelledby", `tab-${activeTab}`);
}

export function renderRecent(items) {
  const box = $("#recent-searches");
  box.hidden = items.length === 0;
  const chips = items.map((text) => {
    const chip = el("button", "chip", text);
    chip.type = "button";
    return chip;
  });
  box.replaceChildren(el("span", "muted", "جستجوهای اخیر"), ...chips);
}

export function renderActiveFilters(chips) {
  const box = $("#active-filters");
  box.hidden = chips.length === 0;
  const nodes = chips.map(({ key, label }) => {
    const chip = el("button", "chip chip-x", label);
    chip.type = "button";
    chip.dataset.remove = key;
    chip.setAttribute("aria-label", `حذف فیلتر ${label}`);
    chip.append(icon("x"));
    return chip;
  });
  const clear = el("button", "chip-clear", "پاک‌کردن همه");
  clear.type = "button";
  clear.id = "clear-filters";
  box.replaceChildren(el("span", "muted", "فیلترهای فعال"), ...nodes, clear);
}

export function renderFilterCount(count) {
  const badge = $("#filter-count");
  badge.hidden = count === 0;
  badge.textContent = toFa(count);
}

// ---------- جستجو ----------

export function setSearchError(message) {
  const error = $("#search-error");
  error.textContent = message;
  error.hidden = !message;
  $("#search-input").setAttribute("aria-invalid", message ? "true" : "false");
}

export function setSearchInput(text) {
  $("#search-input").value = text;
}

// ---------- مودال‌ها ----------

export function openDialog(id) {
  const dialog = $(`#${id}`);
  if (!dialog.open) dialog.showModal();
}

export function closeDialog(id) {
  const dialog = $(`#${id}`);
  if (dialog.open) dialog.close();
}

export function setFieldError(input, message) {
  const error = input.closest(".field").querySelector(".field-error");
  error.textContent = message;
  error.hidden = !message;
  input.setAttribute("aria-invalid", message ? "true" : "false");
}

// --- فرم کاربر ---

const USER_FIELDS = ["firstName", "lastName", "email", "age", "city"];

export function resetUserForm(user) {
  const form = $("#user-form");
  form.reset();
  form.querySelectorAll(".input").forEach((input) => setFieldError(input, ""));
  setFormError("");
  if (user)
    USER_FIELDS.forEach((name) => {
      form.elements[name].value = user[name];
    });
  $("#dialog-title").textContent = user ? "ویرایش کاربر" : "افزودن کاربر";
}

export function readUserForm() {
  const values = Object.fromEntries(new FormData($("#user-form")));
  return Object.fromEntries(
    USER_FIELDS.map((name) => [name, String(values[name] ?? "").trim()]),
  );
}

export function showFormErrors(errors) {
  const inputs = [...$("#user-form").querySelectorAll(".input")];
  inputs.forEach((input) => setFieldError(input, errors[input.name] ?? ""));
  inputs.find((input) => errors[input.name])?.focus();
}

export function setFormError(message) {
  const error = $("#form-error");
  error.textContent = message;
  error.hidden = !message;
}

export function setSubmitting(isSubmitting) {
  const button = $("#user-form button[type='submit']");
  button.disabled = isSubmitting;
  button.textContent = isSubmitting ? "در حال ذخیره…" : "ذخیره";
}

// --- جزئیات کاربر ---

function createDetailRow(label, value, isLtr) {
  const dt = el("dt", "", label);
  const dd = el("dd", "", value);
  if (isLtr) dd.dir = "ltr";
  const row = el("div");
  row.append(dt, dd);
  return row;
}

export function fillDetail(user, isDeleted) {
  $(".avatar-lg").className = `avatar avatar-lg ${avatarClass(user)}`;
  $(".avatar-lg").textContent = initials(user);
  $("#detail-title").textContent = fullName(user);
  const badge = $("#detail-dialog .badge");
  badge.className =
    user.source === "local" ? "badge badge-local" : "badge badge-ok";
  badge.textContent = user.source === "local" ? "محلی" : "سرور";
  const id = typeof user.id === "number" ? toFa(user.id) : "—";
  $(".detail-list").replaceChildren(
    createDetailRow("ایمیل", user.email, true),
    createDetailRow("تلفن", user.phone || "—", true),
    createDetailRow("سن", toFa(user.age)),
    createDetailRow("جنسیت", GENDER_LABELS[user.gender] ?? "—"),
    createDetailRow("شهر", user.city || "—", true),
    createDetailRow("شناسه", id),
  );
  $("#detail-edit").hidden = isDeleted;
}

// --- تأیید حذف ---

export function setConfirmText(name) {
  $("#confirm-text").textContent =
    `«${name}» از فهرست حذف می‌شود. ادامه می‌دهید؟`;
}

export function setConfirmError(message) {
  const error = $("#confirm-error");
  error.textContent = message;
  error.hidden = !message;
}

// --- فرم فیلتر ---

export function fillFilterForm(filters, cities) {
  const form = $("#filter-form");
  form.elements.gender.value = filters.gender;
  form.elements.ageMin.value = filters.ageMin ?? "";
  form.elements.ageMax.value = filters.ageMax ?? "";
  const select = form.elements.city;
  select.replaceChildren(
    new Option("همه شهرها", ""),
    ...cities.map((c) => new Option(c, c)),
  );
  select.value = filters.city;
  form.elements.sort.value = filters.sort;
  setFilterError("");
}

export function readFilterForm() {
  const form = $("#filter-form");
  return {
    gender: form.elements.gender.value,
    ageMin: form.elements.ageMin.value.trim(),
    ageMax: form.elements.ageMax.value.trim(),
    city: form.elements.city.value,
    sort: form.elements.sort.value,
  };
}

export function setFilterError(message) {
  const error = $("#flt-age-error");
  error.textContent = message;
  error.hidden = !message;
}
