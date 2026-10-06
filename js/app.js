import { fetchUsers } from "./api.js";

import {
  toFa,
  fullName,
  renderUsers,
  renderStats,
  renderCharts,
  renderTabCounts,
  renderCityOptions,
  renderPager,
  renderRecentSearches,
  renderFilterCount,
  renderActiveFilters,
  renderDetails,
  showLoading,
  showError,
  showEmpty,
  hideStates,
} from "./ui.js";

/* -----------------------------
   عناصر DOM
----------------------------- */

const $ = (selector) => document.querySelector(selector);

const searchForm = $("#search-form");
const searchInput = $("#search-input");
const searchError = $("#search-error");
const retryButton = $("#retry-btn");
const usersBody = $("#users-body");
const usersPanel = $("#users-panel");

const addUserButton = $("#add-user-btn");
const userDialog = $("#user-dialog");
const userForm = $("#user-form");
const dialogCancel = $("#dialog-cancel");

const filterDialog = $("#filter-dialog");
const filterForm = $("#filter-form");
const openFilter = $("#open-filter");
const filterReset = $("#filter-reset");
const filterCancel = $("#filter-cancel");
const ageError = $("#flt-age-error");

const detailDialog = $("#detail-dialog");
const detailClose = $("#detail-close");
const detailClose2 = $("#detail-close-2");
const detailEdit = $("#detail-edit");

const confirmDialog = $("#confirm-dialog");
const confirmCancel = $("#confirm-cancel");
const confirmOk = $("#confirm-ok");
const confirmText = $("#confirm-text");

const recentSearchContainer = $("#recent-searches");
const activeFilters = $("#active-filters");
const tabs = document.querySelectorAll(".tab");
const sortButton = $(".sort-btn");
const pagerButtons = $("#pager-btns");

/* -----------------------------
   LocalStorage
----------------------------- */

const SEARCH_KEY = "scene-recent-searches";
const USERS_KEY = "scene-local-users";
const DELETED_KEY = "scene-deleted-ids";
const EDITS_KEY = "scene-server-edits";

function readJSON(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key)) ?? fallback;
  } catch {
    return fallback;
  }
}

function writeJSON(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.error(error);
  }
}

const getRecentSearches = () => readJSON(SEARCH_KEY, []);
const getLocalUsers = () => readJSON(USERS_KEY, []);
const saveLocalUsers = (list) => writeJSON(USERS_KEY, list);

function saveRecentSearch(value) {
  const search = value.trim();

  if (!search) {
    return;
  }

  const searches = getRecentSearches()
    .filter((item) => item.toLowerCase() !== search.toLowerCase())
    .slice(0, 4);

  searches.unshift(search);

  writeJSON(SEARCH_KEY, searches);
  renderRecentSearches(searches);
}

/* -----------------------------
   State
----------------------------- */

const pageSize = 10;

let allUsers = []; // همه کاربران (سرور + محلی) حتی حذف‌شده‌ها
let filteredUsers = []; // نتیجه نهایی برای جدول
let currentPage = 1;
let activeTab = "all";

let selectedUser = null;
let editingUser = null;
let deletingUser = null;

let deletedIds = new Set(readJSON(DELETED_KEY, []).map(String));

const emptyFilters = () => ({
  gender: "",
  ageMin: null,
  ageMax: null,
  city: "",
  sort: "",
});

let filters = emptyFilters();

const isDeleted = (user) => deletedIds.has(String(user.id));
const visibleUsers = () => allUsers.filter((user) => !isDeleted(user));

function saveDeletedIds() {
  writeJSON(DELETED_KEY, [...deletedIds]);
}

/* -----------------------------
   شروع برنامه
----------------------------- */

async function init() {
  renderRecentSearches(getRecentSearches());
  renderActiveFilters(filters);
  renderFilterCount(0);

  await loadUsers();
}

async function loadUsers() {
  showLoading();

  try {
    const apiUsers = await fetchUsers();

    const edits = readJSON(EDITS_KEY, {});

    const serverUsers = apiUsers.map((user) =>
      edits[user.id] ? { ...user, ...edits[user.id] } : user,
    );

    const localUsers = getLocalUsers().map((user) => ({
      ...user,
      local: true,
    }));

    allUsers = [...serverUsers, ...localUsers];

    renderCityOptions(
      [
        ...new Set(allUsers.map((user) => user.address?.city).filter(Boolean)),
      ].sort(),
    );

    applyFilters();
  } catch (error) {
    console.error(error);

    showError("دریافت اطلاعات ناموفق بود. اتصال اینترنت را بررسی کنید.");
  }
}

/* -----------------------------
   فیلتر اصلی
----------------------------- */

function tabSource() {
  const visible = visibleUsers();

  switch (activeTab) {
    case "server":
      return visible.filter((user) => !user.local);
    case "local":
      return visible.filter((user) => user.local);
    case "deleted":
      return allUsers.filter(isDeleted);
    default:
      return visible;
  }
}

function applyFilters({ keepPage = false } = {}) {
  let result = [...tabSource()];

  const query = searchInput.value.trim().toLowerCase();

  if (query) {
    result = result.filter((user) => {
      const name = fullName(user).toLowerCase();
      const email = user.email?.toLowerCase() ?? "";

      return name.includes(query) || email.includes(query);
    });
  }

  if (filters.gender) {
    result = result.filter((user) => user.gender === filters.gender);
  }

  if (filters.ageMin !== null) {
    result = result.filter((user) => user.age >= filters.ageMin);
  }

  if (filters.ageMax !== null) {
    result = result.filter((user) => user.age <= filters.ageMax);
  }

  if (filters.city) {
    result = result.filter((user) => user.address?.city === filters.city);
  }

  if (filters.sort === "age-asc") {
    result.sort((a, b) => a.age - b.age);
  } else if (filters.sort === "age-desc") {
    result.sort((a, b) => b.age - a.age);
  } else if (filters.sort === "name-asc") {
    result.sort((a, b) => fullName(a).localeCompare(fullName(b)));
  }

  filteredUsers = result;

  const totalPages = Math.max(1, Math.ceil(result.length / pageSize));

  currentPage = keepPage ? Math.min(currentPage, totalPages) : 1;

  renderCurrentPage();
  updateDashboard();
  updateFilterUI();
}

/* آمار، نمودار و شمارنده تب‌ها: روی همه کاربران فعال */
function updateDashboard() {
  const visible = visibleUsers();

  renderStats(visible);
  renderCharts(visible);

  renderTabCounts({
    all: visible.length,
    server: visible.filter((user) => !user.local).length,
    local: visible.filter((user) => user.local).length,
    deleted: allUsers.filter(isDeleted).length,
  });
}

function renderCurrentPage() {
  const start = (currentPage - 1) * pageSize;
  const pageUsers = filteredUsers.slice(start, start + pageSize);

  hideStates();

  if (filteredUsers.length === 0) {
    renderUsers([], activeTab);
    showEmpty();
  } else {
    renderUsers(pageUsers, activeTab);
  }

  renderPager(filteredUsers.length, currentPage, pageSize);
  renderPaginationButtons();
}

function goToPage(page) {
  currentPage = page;
  renderCurrentPage();
}

function renderPaginationButtons() {
  const totalPages = Math.ceil(filteredUsers.length / pageSize);

  pagerButtons.innerHTML = "";

  const makeButton = (text, onClick, disabled = false) => {
    const button = document.createElement("button");

    button.className = "btn btn-sm";
    button.type = "button";
    button.textContent = text;
    button.disabled = disabled;
    button.addEventListener("click", onClick);

    return button;
  };

  pagerButtons.append(
    makeButton("قبلی", () => goToPage(currentPage - 1), currentPage <= 1),
  );

  /* پنجره ۵ صفحه‌ای دور صفحه فعلی */
  const first = Math.max(1, Math.min(currentPage - 2, totalPages - 4));
  const last = Math.min(totalPages, first + 4);

  for (let page = first; page <= last; page++) {
    const button = makeButton(toFa(page), () => goToPage(page));

    if (page === currentPage) {
      button.classList.add("is-current");
      button.setAttribute("aria-current", "page");
    }

    pagerButtons.append(button);
  }

  pagerButtons.append(
    makeButton(
      "بعدی",
      () => goToPage(currentPage + 1),
      totalPages === 0 || currentPage >= totalPages,
    ),
  );
}

/* -----------------------------
   فیلترهای UI
----------------------------- */

function updateFilterUI() {
  let count = 0;

  if (filters.gender) count++;
  if (filters.ageMin !== null || filters.ageMax !== null) count++;
  if (filters.city) count++;

  renderFilterCount(count);
  renderActiveFilters(filters);
}

/* پر کردن فرم فیلتر از روی state فعلی */
function syncFilterForm() {
  filterForm
    .querySelectorAll('input[name="gender"]')
    .forEach((radio) => (radio.checked = radio.value === filters.gender));

  $("#flt-age-min").value = filters.ageMin ?? "";
  $("#flt-age-max").value = filters.ageMax ?? "";
  $("#flt-city").value = filters.city;
  $("#flt-sort").value = filters.sort;

  ageError.hidden = true;
}

/* -----------------------------
   فرم جستجو
----------------------------- */

searchForm.addEventListener("submit", (event) => {
  event.preventDefault();

  searchInput.removeAttribute("aria-invalid");
  searchError.hidden = true;

  /* جستجوی خالی = پاک‌کردن جستجو */
  saveRecentSearch(searchInput.value);

  applyFilters();
});

recentSearchContainer.addEventListener("click", (event) => {
  const button = event.target.closest(".chip");

  if (!button) {
    return;
  }

  searchInput.value = button.dataset.search;
  searchInput.removeAttribute("aria-invalid");
  searchError.hidden = true;

  applyFilters();
});

retryButton.addEventListener("click", loadUsers);

/* -----------------------------
   Tabs (با پشتیبانی از کیبورد)
----------------------------- */

function selectTab(tab) {
  tabs.forEach((item) => {
    const selected = item === tab;

    item.setAttribute("aria-selected", String(selected));
    item.tabIndex = selected ? 0 : -1;
  });

  usersPanel.setAttribute("aria-labelledby", tab.id);

  activeTab = tab.dataset.tab;

  applyFilters();
}

tabs.forEach((tab, index) => {
  tab.addEventListener("click", () => selectTab(tab));

  tab.addEventListener("keydown", (event) => {
    const rtl = document.documentElement.dir === "rtl";
    let next = null;

    if (event.key === "ArrowLeft") {
      next = index + (rtl ? 1 : -1);
    } else if (event.key === "ArrowRight") {
      next = index + (rtl ? -1 : 1);
    } else if (event.key === "Home") {
      next = 0;
    } else if (event.key === "End") {
      next = tabs.length - 1;
    }

    if (next === null) {
      return;
    }

    event.preventDefault();

    const target = tabs[(next + tabs.length) % tabs.length];

    target.focus();
    selectTab(target);
  });
});

/* -----------------------------
   Filter Dialog
----------------------------- */

openFilter.addEventListener("click", () => {
  syncFilterForm();
  filterDialog.showModal();
});

filterCancel.addEventListener("click", () => filterDialog.close());

filterReset.addEventListener("click", () => {
  filters = emptyFilters();

  syncFilterForm();
  applyFilters();
});

filterForm.addEventListener("submit", (event) => {
  event.preventDefault();

  const formData = new FormData(filterForm);

  const ageMinValue = formData.get("ageMin");
  const ageMaxValue = formData.get("ageMax");

  const ageMin = ageMinValue === "" ? null : Number(ageMinValue);
  const ageMax = ageMaxValue === "" ? null : Number(ageMaxValue);

  if (ageMin !== null && ageMax !== null && ageMin > ageMax) {
    ageError.textContent = "حداقل سن نمی‌تواند بیشتر از حداکثر سن باشد.";
    ageError.hidden = false;

    return;
  }

  ageError.hidden = true;

  filters = {
    gender: formData.get("gender") ?? "",
    ageMin,
    ageMax,
    city: formData.get("city") ?? "",
    sort: formData.get("sort") ?? "",
  };

  filterDialog.close();

  applyFilters();
});

/* پاک کردن فیلتر از روی چیپ‌ها */
activeFilters.addEventListener("click", (event) => {
  const removeButton = event.target.closest("[data-remove]");

  if (removeButton) {
    const type = removeButton.dataset.remove;

    if (type === "gender") filters.gender = "";
    if (type === "city") filters.city = "";

    if (type === "age") {
      filters.ageMin = null;
      filters.ageMax = null;
    }

    applyFilters();

    return;
  }

  if (event.target.closest("#clear-filters")) {
    const sort = filters.sort;

    filters = { ...emptyFilters(), sort };

    applyFilters();
  }
});

/* Sort با ستون سن */
sortButton.addEventListener("click", () => {
  filters.sort = filters.sort === "age-asc" ? "age-desc" : "age-asc";

  applyFilters();
});

/* -----------------------------
   فرم کاربر (افزودن / ویرایش)
----------------------------- */

function clearFormErrors() {
  userForm.querySelectorAll(".field-error").forEach((element) => {
    element.hidden = true;
    element.textContent = "";
  });

  userForm
    .querySelectorAll("[aria-invalid]")
    .forEach((input) => input.removeAttribute("aria-invalid"));
}

function setFieldError(input, message) {
  input.setAttribute("aria-invalid", "true");

  const error = input.closest(".field").querySelector(".field-error");

  error.textContent = message;
  error.hidden = false;
}

function validateUserForm(values) {
  const errors = [];

  const check = (name, condition, message) => {
    if (!condition) {
      errors.push([userForm.elements[name], message]);
    }
  };

  check("firstName", values.firstName, "نام را وارد کنید.");
  check("lastName", values.lastName, "نام خانوادگی را وارد کنید.");
  check(
    "email",
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email),
    "ایمیل واردشده معتبر نیست.",
  );
  check(
    "age",
    Number.isInteger(values.age) && values.age >= 1 && values.age <= 120,
    "سن باید عددی بین ۱ تا ۱۲۰ باشد.",
  );
  check("city", values.city, "شهر را وارد کنید.");

  return errors;
}

addUserButton.addEventListener("click", () => {
  editingUser = null;

  $("#dialog-title").textContent = "افزودن کاربر";

  userForm.reset();
  clearFormErrors();

  userDialog.showModal();
});

dialogCancel.addEventListener("click", () => userDialog.close());

userDialog.addEventListener("close", () => {
  editingUser = null;
});

function persistUser(user) {
  if (user.local) {
    const list = getLocalUsers();
    const index = list.findIndex((item) => item.id === user.id);

    if (index !== -1) {
      list[index] = user;
      saveLocalUsers(list);
    }

    return;
  }

  /* کاربر سرور: فقط تغییرات را نگه می‌داریم */
  const edits = readJSON(EDITS_KEY, {});

  edits[user.id] = {
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email,
    age: user.age,
    gender: user.gender,
    address: user.address,
  };

  writeJSON(EDITS_KEY, edits);
}

userForm.addEventListener("submit", (event) => {
  event.preventDefault();

  const formData = new FormData(userForm);

  const values = {
    firstName: String(formData.get("firstName") ?? "").trim(),
    lastName: String(formData.get("lastName") ?? "").trim(),
    email: String(formData.get("email") ?? "").trim(),
    age: Number(formData.get("age")),
    city: String(formData.get("city") ?? "").trim(),
    gender: formData.get("gender") === "female" ? "female" : "male",
  };

  clearFormErrors();

  const errors = validateUserForm(values);

  if (errors.length) {
    errors.forEach(([input, message]) => setFieldError(input, message));
    errors[0][0].focus();

    return;
  }

  if (editingUser) {
    Object.assign(editingUser, {
      firstName: values.firstName,
      lastName: values.lastName,
      email: values.email,
      age: values.age,
      gender: values.gender,
      address: { ...(editingUser.address ?? {}), city: values.city },
    });

    persistUser(editingUser);
  } else {
    const newUser = {
      id: `local-${Date.now()}`,
      firstName: values.firstName,
      lastName: values.lastName,
      email: values.email,
      age: values.age,
      gender: values.gender,
      address: { city: values.city },
      local: true,
    };

    saveLocalUsers([...getLocalUsers(), newUser]);
    allUsers.push(newUser);
  }

  const wasEditing = Boolean(editingUser);

  userDialog.close();

  renderCityOptions(
    [
      ...new Set(allUsers.map((user) => user.address?.city).filter(Boolean)),
    ].sort(),
  );

  applyFilters({ keepPage: wasEditing });
});

/* -----------------------------
   Table Event Delegation
----------------------------- */

usersBody.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-action]");

  if (!button) {
    return;
  }

  const user = allUsers.find(
    (item) => String(item.id) === String(button.dataset.id),
  );

  if (!user) {
    return;
  }

  switch (button.dataset.action) {
    case "view":
      openDetails(user);
      break;
    case "edit":
      openEdit(user);
      break;
    case "delete":
      openDelete(user);
      break;
    case "restore":
      deletedIds.delete(String(user.id));
      saveDeletedIds();
      applyFilters({ keepPage: true });
      break;
  }
});

/* -----------------------------
   Detail Modal
----------------------------- */

function openDetails(user) {
  selectedUser = user;

  renderDetails(user);

  detailDialog.showModal();
}

detailClose.addEventListener("click", () => detailDialog.close());
detailClose2.addEventListener("click", () => detailDialog.close());

/* -----------------------------
   Edit User
----------------------------- */

function openEdit(user) {
  editingUser = user;

  if (detailDialog.open) {
    detailDialog.close();
  }

  $("#dialog-title").textContent = "ویرایش کاربر";

  clearFormErrors();

  $("#f-first").value = user.firstName ?? "";
  $("#f-last").value = user.lastName ?? "";
  $("#f-email").value = user.email ?? "";
  $("#f-age").value = user.age ?? "";
  $("#f-city").value = user.address?.city ?? "";

  const gender = $("#f-gender");

  if (gender) {
    gender.value = user.gender === "female" ? "female" : "male";
  }

  userDialog.showModal();
}

detailEdit.addEventListener("click", () => {
  if (selectedUser) {
    openEdit(selectedUser);
  }
});

/* -----------------------------
   Delete
----------------------------- */

function openDelete(user) {
  deletingUser = user;

  confirmText.textContent = `کاربر ${fullName(user)} از فهرست حذف می‌شود. ادامه می‌دهید؟`;

  confirmDialog.showModal();
}

confirmCancel.addEventListener("click", () => confirmDialog.close());

confirmOk.addEventListener("click", () => {
  if (!deletingUser) {
    return;
  }

  if (deletingUser.local) {
    /* کاربر محلی: حذف کامل */
    saveLocalUsers(
      getLocalUsers().filter(
        (user) => String(user.id) !== String(deletingUser.id),
      ),
    );

    allUsers = allUsers.filter(
      (user) => String(user.id) !== String(deletingUser.id),
    );
  } else {
    /* کاربر سرور: می‌رود به تب «حذف‌شده» و با رفرش برنمی‌گردد */
    deletedIds.add(String(deletingUser.id));
    saveDeletedIds();
  }

  deletingUser = null;

  confirmDialog.close();

  applyFilters({ keepPage: true });
});

/* -----------------------------
   اسلایدر مدیران
----------------------------- */

function initSlider() {
  const slider = $("#admin-slider");
  const prev = $("#slider-prev");
  const next = $("#slider-next");
  const dots = document.querySelectorAll("#slider-dots .dot-i");

  if (!slider) {
    return;
  }

  const step = () => {
    const slide = slider.querySelector(".slide");
    const gap = parseFloat(getComputedStyle(slider).columnGap) || 0;

    return slide.getBoundingClientRect().width + gap;
  };

  const direction = () =>
    getComputedStyle(slider).direction === "rtl" ? -1 : 1;

  next.addEventListener("click", () =>
    slider.scrollBy({ left: direction() * step() }),
  );

  prev.addEventListener("click", () =>
    slider.scrollBy({ left: -direction() * step() }),
  );

  slider.addEventListener("keydown", (event) => {
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      slider.scrollBy({ left: -step() });
    }

    if (event.key === "ArrowRight") {
      event.preventDefault();
      slider.scrollBy({ left: step() });
    }
  });

  slider.addEventListener(
    "scroll",
    () => {
      const index = Math.round(Math.abs(slider.scrollLeft) / step());

      dots.forEach((dot, i) => dot.classList.toggle("is-on", i === index));
    },
    { passive: true },
  );
}

function initViews() {
  const navLinks = document.querySelectorAll("[data-nav]");
  const sections = document.querySelectorAll("[data-view]");

  function showView(name) {
    sections.forEach((section) => {
      section.hidden = section.dataset.view !== name;
    });

    navLinks.forEach((link) => {
      const active = link.dataset.nav === name;

      link.classList.toggle("is-active", active);

      if (active) {
        link.setAttribute("aria-current", "page");
      } else {
        link.removeAttribute("aria-current");
      }
    });

    document.title =
      name === "reports"
        ? "گزارش‌ها | پنل مدیریت کاربران"
        : "پنل مدیریت کاربران";
  }

  function applyHash() {
    const hash = location.hash.replace("#", "");

    if (hash === "reports") {
      showView("reports");
      window.scrollTo({ top: 0 });
    } else if (hash === "users" || hash === "") {
      showView("users");
      window.scrollTo({ top: 0 });
    } else if (hash === "admins") {
      showView("users");
      document.getElementById("admins")?.scrollIntoView();
    }
  }

  window.addEventListener("hashchange", applyHash);

  applyHash();
}

initViews();
initSlider();
init();
