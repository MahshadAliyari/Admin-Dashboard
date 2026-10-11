/* =========================================================
   APP — state، رویدادها و اتصال ماژول‌ها
   api.js (شبکه) · storage.js (ذخیره) · logic.js (منطق خالص) · ui.js (DOM)
   ========================================================= */

import { fetchUsers } from "./api.js";
import {
  STORAGE,
  loadJSON,
  loadArray,
  saveJSON,
  clearAllData,
  createId,
} from "./storage.js";
import {
  escapeHtml,
  fullName,
  normalizeUser,
  activeUsers,
  computeStats,
  filterUsers,
  filterPosts,
  validateUser,
  validateTitle,
  validateSearch,
  usersToCsv,
  debounce,
} from "./logic.js";
import * as ui from "./ui.js";

const { $, $$ } = ui;

/* =========================================================
   CONSTANTS
   ========================================================= */

const VIEWS = [
  "dashboard",
  "users",
  "comments",
  "posts",
  "pages",
  "media",
  "reports",
  "settings",
];

const VIEW_TITLES = {
  dashboard: "پیشخوان",
  users: "کاربران",
  comments: "نظرات",
  posts: "نوشته‌ها",
  pages: "برگه‌ها",
  media: "رسانه",
  reports: "گزارش‌ها",
  settings: "تنظیمات",
};

const DEFAULT_FILTERS = {
  gender: "",
  ageMin: "",
  ageMax: "",
  city: "",
  sort: "default",
};
const DEFAULT_SETTINGS = {
  siteTitle: "پنل صحنه",
  itemsPerPage: 10,
  notifications: true,
};

const SEED_COMMENTS = [
  {
    id: "comment-1",
    name: "مریم احمدی",
    date: "2026/10/06",
    text: "این پنل مدیریت خیلی خوب طراحی شده است.",
    status: "pending",
    replies: [],
  },
  {
    id: "comment-2",
    name: "علی رضایی",
    date: "2026/10/05",
    text: "ممنون، اطلاعات کاربران خیلی مرتب نمایش داده شده.",
    status: "pending",
    replies: [],
  },
  {
    id: "comment-3",
    name: "سارا محمدی",
    date: "2026/10/04",
    text: "طراحی داشبورد بسیار زیباست.",
    status: "approved",
    replies: [],
  },
  {
    id: "comment-4",
    name: "کاربر ناشناس",
    date: "2026/10/03",
    text: "این یک نظر آزمایشی است.",
    status: "spam",
    replies: [],
  },
  {
    id: "comment-5",
    name: "رضا کریمی",
    date: "2026/10/02",
    text: "امکان مدیریت کاربران خیلی کاربردی است.",
    status: "approved",
    replies: [],
  },
];

const SEED_POSTS = [
  {
    id: "post-1",
    title: "راهنمای استفاده از پنل مدیریت",
    excerpt: "نوشته نمونه برای مدیریت محتوای سایت.",
    status: "published",
  },
  {
    id: "post-2",
    title: "آموزش مدیریت کاربران",
    excerpt: "مقاله آموزشی مربوط به کاربران سیستم.",
    status: "draft",
  },
];

const SEED_PAGES = [
  { id: "page-1", title: "صفحه اصلی", desc: "صفحه اصلی وب‌سایت" },
  { id: "page-2", title: "درباره ما", desc: "معرفی مجموعه" },
];

const SEED_MEDIA = [
  { id: "media-1", name: "banner.jpg", size: 1258291 },
  { id: "media-2", name: "profile.png", size: 870400 },
  { id: "media-3", name: "dashboard.webp", size: 430080 },
];

/* =========================================================
   STATE
   ========================================================= */

const state = {
  view: "dashboard",

  users: [],
  localUsers: loadArray(STORAGE.localUsers),
  deletedIds: new Set(loadArray(STORAGE.deletedIds).map(String)),
  serverEdits: loadJSON(STORAGE.serverEdits, {}),
  recentSearches: loadArray(STORAGE.recentSearches),

  comments: loadArray(STORAGE.comments, SEED_COMMENTS),
  posts: loadArray(STORAGE.posts, SEED_POSTS),
  pages: loadArray(STORAGE.pages, SEED_PAGES),
  media: loadArray(STORAGE.media, SEED_MEDIA),
  mediaPreviews: new Map(), // فقط در همین نشست (blob URL)

  settings: { ...DEFAULT_SETTINGS, ...loadJSON(STORAGE.settings, {}) },

  tab: "all",
  search: "",
  page: 1,
  filters: { ...DEFAULT_FILTERS },
  commentFilter: "all",
  postQuery: "",
  postStatus: "all",

  editingUserId: null,
  editingPostId: null,
  editingPageId: null,
  detailId: null,
  replyId: null,
  confirmAction: null,

  apiStatus: "loading",
  lastSync: null,
  loadError: "",
};

const pageSize = () => Number(state.settings.itemsPerPage) || 10;

/* =========================================================
   HELPERS
   ========================================================= */

function persist(key, value) {
  if (!saveJSON(key, value)) {
    ui.toast(
      "ذخیره‌سازی در مرورگر ممکن نشد؛ تغییرات پس از بستن صفحه از بین می‌رود.",
      "error",
    );
  }
}

/** پیام‌های موفقیت فقط وقتی «اعلان‌ها» روشن باشد نمایش داده می‌شوند */
function notify(message, type = "success") {
  if (type === "success" && !state.settings.notifications) return;
  ui.toast(message, type);
}

const findUser = (id) =>
  state.users.find((user) => String(user.id) === String(id));
const todayFa = () => new Date().toLocaleDateString("fa-IR");

function openDialog(dialog) {
  if (dialog && !dialog.open) dialog.showModal();
}

function closeDialogs() {
  $$("dialog[open]").forEach((dialog) => dialog.close());
}

const field = (formData, name) => String(formData.get(name) || "").trim();

/* =========================================================
   RENDER
   ========================================================= */

function renderUsersPanel() {
  const list = filterUsers(state.users, {
    tab: state.tab,
    search: state.search,
    filters: state.filters,
    deletedIds: state.deletedIds,
  });

  const size = pageSize();
  const totalPages = Math.max(1, Math.ceil(list.length / size));
  if (state.page > totalPages) state.page = totalPages;

  const start = (state.page - 1) * size;

  ui.renderActiveFilters(state.filters);
  ui.renderRecentSearches(state.recentSearches);
  ui.setSortIndicator(state.filters.sort);
  ui.renderUsers(list.slice(start, start + size), state.deletedIds);
  ui.renderPagination(list.length, state.page, size);

  if (list.length) ui.showState("table");
  else ui.showState(state.loadError && !state.users.length ? "error" : "empty");
}

function renderComments() {
  ui.renderComments(state.comments, state.commentFilter);
}

function renderPosts() {
  const filtered = filterPosts(state.posts, state.postQuery, state.postStatus);
  ui.renderPosts(
    filtered,
    Boolean(state.postQuery.trim()) || state.postStatus !== "all",
  );
}

function renderDashboard() {
  const stats = computeStats(state.users, state.deletedIds);

  ui.renderDashboard({
    stats,
    posts: state.posts,
    pages: state.pages,
    comments: state.comments,
    recentUsers: activeUsers(
      [...state.users].reverse(),
      state.deletedIds,
    ).slice(0, 5),
    apiStatus: state.apiStatus,
    lastSync: state.lastSync,
  });
}

function renderAll() {
  const stats = computeStats(state.users, state.deletedIds);

  ui.renderStats(stats);
  ui.renderCharts(state.users, state.deletedIds);
  ui.renderReports(state.users, state.deletedIds);

  renderUsersPanel();
  renderComments();
  renderPosts();
  ui.renderPages(state.pages);
  ui.renderMedia(state.media, state.mediaPreviews);
  renderDashboard();
}

/* =========================================================
   DATA LOADING (Loading / Error / Empty)
   ========================================================= */

async function loadData() {
  state.apiStatus = "loading";
  state.loadError = "";
  ui.setApiStatus("loading");
  ui.showState("loading");

  const localUsers = state.localUsers.map((user) =>
    normalizeUser({ ...user, local: true }, {}),
  );

  try {
    const serverUsers = await fetchUsers();

    state.users = [
      ...serverUsers.map((user) => normalizeUser(user, state.serverEdits)),
      ...localUsers,
    ];
    state.apiStatus = "ok";
    state.lastSync = new Date();
  } catch (error) {
    // اپ بدون API هم کار می‌کند: کاربران محلی همچنان نمایش داده می‌شوند
    state.users = localUsers;
    state.apiStatus = "error";
    state.loadError =
      error.message || "دریافت اطلاعات کاربران با خطا مواجه شد.";
    ui.setError(state.loadError);
    ui.toast(state.loadError, "error");
  } finally {
    ui.setApiStatus(state.apiStatus);
    renderAll();
  }
}

/* =========================================================
   NAVIGATION & MOBILE MENU
   ========================================================= */

function setMenu(open) {
  document.body.classList.toggle("menu-open", open);
  $("#menu-toggle")?.setAttribute("aria-expanded", String(open));
  const backdrop = $("#backdrop");
  if (backdrop) backdrop.hidden = !open;
}

function navigate(view, { updateHash = true } = {}) {
  const target = VIEWS.includes(view) ? view : "dashboard";

  state.view = target;
  ui.showView(target);
  setMenu(false);

  document.title = `${VIEW_TITLES[target]} ‹ ${state.settings.siteTitle}`;

  if (updateHash) history.replaceState(null, "", `#${target}`);

  window.scrollTo({ top: 0 });
  $("#main")?.focus({ preventScroll: true });
}

function scrollToAdmins() {
  $("#admins")?.scrollIntoView({ behavior: "smooth", block: "start" });
}

function handleAnchor(event, anchor) {
  const target = anchor.getAttribute("href").slice(1);

  if (target === "top") {
    event.preventDefault();
    window.scrollTo({ top: 0, behavior: "smooth" });
    return true;
  }

  if (VIEWS.includes(target)) {
    event.preventDefault();
    navigate(target);
    return true;
  }

  if (target === "admins") {
    event.preventDefault();
    navigate("users");
    scrollToAdmins();
    return true;
  }

  return false;
}

/* =========================================================
   USERS: ADD / EDIT / DELETE / RESTORE
   ========================================================= */

function openUserDialog(id = null) {
  const form = $("#user-form");
  const user = id ? findUser(id) : null;
  if (id && !user) return;

  state.editingUserId = id ? String(id) : null;

  form.reset();
  ui.setFormErrors(form, {});
  $("#dialog-title").textContent = user ? "ویرایش کاربر" : "افزودن کاربر";

  if (user) {
    $("#f-first").value = user.firstName;
    $("#f-last").value = user.lastName;
    $("#f-email").value = user.email;
    $("#f-age").value = user.age ?? "";
    $("#f-city").value = user.city;
    $("#f-gender").value = user.gender;
  }

  openDialog($("#user-dialog"));
}

function addUser(data) {
  const user = { id: createId("local"), ...data, phone: "", local: true };

  state.localUsers.push(user);
  persist(STORAGE.localUsers, state.localUsers);
  state.users.push(normalizeUser(user, {}));
}

function updateUser(id, data) {
  const index = state.users.findIndex((user) => String(user.id) === String(id));
  if (index === -1) return;

  const user = state.users[index];

  if (user.local) {
    const localIndex = state.localUsers.findIndex(
      (item) => String(item.id) === String(id),
    );
    if (localIndex !== -1) {
      state.localUsers[localIndex] = {
        ...state.localUsers[localIndex],
        ...data,
      };
      persist(STORAGE.localUsers, state.localUsers);
    }
  } else {
    state.serverEdits[String(id)] = {
      ...(state.serverEdits[String(id)] || {}),
      ...data,
    };
    persist(STORAGE.serverEdits, state.serverEdits);
  }

  state.users[index] = { ...user, ...data };
}

function handleUserSubmit(event) {
  event.preventDefault();

  const form = event.currentTarget;
  const formData = new FormData(form);

  const data = {
    firstName: field(formData, "firstName"),
    lastName: field(formData, "lastName"),
    email: field(formData, "email"),
    age: Number(formData.get("age")),
    city: field(formData, "city"),
    gender: field(formData, "gender"),
  };

  const errors = validateUser(data, {
    users: state.users,
    editingId: state.editingUserId,
  });
  ui.setFormErrors(form, errors);
  if (Object.keys(errors).length) return;

  if (state.editingUserId) {
    updateUser(state.editingUserId, data);
    notify("اطلاعات کاربر به‌روزرسانی شد.");
  } else {
    addUser(data);
    notify("کاربر جدید اضافه شد.");
  }

  state.editingUserId = null;
  $("#user-dialog").close();
  renderAll();
}

function requestDeleteUser(id) {
  const user = findUser(id);
  if (!user) return;

  confirmAction({
    title: "حذف کاربر",
    text: `آیا از حذف «${fullName(user)}» مطمئن هستید؟ کاربر به بخش «حذف‌شده‌ها» منتقل می‌شود و قابل بازیابی است.`,
    okLabel: "حذف کاربر",
    onConfirm: () => {
      state.deletedIds.add(String(id));
      persist(STORAGE.deletedIds, [...state.deletedIds]);
      notify("کاربر حذف شد.");
      renderAll();
    },
  });
}

function restoreUser(id) {
  state.deletedIds.delete(String(id));
  persist(STORAGE.deletedIds, [...state.deletedIds]);
  notify("کاربر بازیابی شد.");
  renderAll();
}

function openDetails(id) {
  const user = findUser(id);
  if (!user) return;

  state.detailId = String(id);
  ui.renderDetails(user, state.deletedIds.has(String(id)));
  openDialog($("#detail-dialog"));
}

/* =========================================================
   GENERIC CONFIRM DIALOG
   ========================================================= */

function confirmAction({ title, text, okLabel = "تأیید", onConfirm }) {
  $("#confirm-title").textContent = title;
  $("#confirm-text").textContent = text;
  $("#confirm-ok").textContent = okLabel;
  state.confirmAction = onConfirm;
  openDialog($("#confirm-dialog"));
}

/* =========================================================
   SEARCH (با اعتبارسنجی، debounce و جستجوهای اخیر)
   ========================================================= */

function applySearch(value) {
  state.search = value;
  state.page = 1;
  renderUsersPanel();
}

function setupSearch() {
  const form = $("#search-form");
  const input = $("#search-input");

  form.addEventListener("submit", (event) => {
    event.preventDefault();

    const value = input.value.trim();
    const error = validateSearch(value);
    ui.setSearchError(error);
    if (error) return;

    if (value) {
      state.recentSearches = [
        value,
        ...state.recentSearches.filter((item) => item !== value),
      ].slice(0, 5);
      persist(STORAGE.recentSearches, state.recentSearches);
    }

    applySearch(value);
  });

  const liveSearch = debounce(() => {
    const value = input.value.trim();
    // یک نویسه هنوز جستجوی معنادار نیست؛ خطا فقط هنگام ارسال فرم نشان داده می‌شود
    if (value.length === 1) return;
    ui.setSearchError("");
    applySearch(value);
  }, 250);

  input.addEventListener("input", liveSearch);
}

/* =========================================================
   FILTER DIALOG
   ========================================================= */

function fillCityFilter() {
  const select = $("#flt-city");
  const cities = [
    ...new Set(state.users.map((user) => user.city).filter(Boolean)),
  ].sort((a, b) => a.localeCompare(b, "fa"));

  select.innerHTML =
    `<option value="">همه شهرها</option>` +
    cities
      .map(
        (city) =>
          `<option value="${escapeHtml(city)}">${escapeHtml(city)}</option>`,
      )
      .join("");
}

function syncFilterForm() {
  const { gender, ageMin, ageMax, city, sort } = state.filters;

  const radio = $(`#filter-form input[name="gender"][value="${gender}"]`);
  if (radio) radio.checked = true;

  $("#flt-age-min").value = ageMin;
  $("#flt-age-max").value = ageMax;
  $("#flt-city").value = city;
  $("#flt-sort").value = sort;
  $("#flt-age-error").textContent = "";
}

function setupFilter() {
  const form = $("#filter-form");
  const openFilterButton = $("#open-filter");
  const resetFilterButton = $("#filter-reset");
  const filterDialog = $("#filter-dialog");

  // باز کردن پنجره فیلتر
  if (openFilterButton && filterDialog) {
    openFilterButton.addEventListener("click", () => {
      fillCityFilter();
      syncFilterForm();
      openDialog(filterDialog);
    });
  }

  // پاک کردن فیلترها
  if (resetFilterButton && filterDialog) {
    resetFilterButton.addEventListener("click", () => {
      state.filters = { ...DEFAULT_FILTERS };
      state.page = 1;
      filterDialog.close();
      renderUsersPanel();
    });
  }

  // ثبت فیلترها
  if (form && filterDialog) {
    form.addEventListener("submit", (event) => {
      event.preventDefault();

      const formData = new FormData(form);
      const ageMin = field(formData, "ageMin");
      const ageMax = field(formData, "ageMax");
      const error = $("#flt-age-error");

      if (ageMin && ageMax && Number(ageMin) > Number(ageMax)) {
        if (error) {
          error.textContent = "حداقل سن نمی‌تواند بیشتر از حداکثر سن باشد.";
        }
        return;
      }

      if (error) {
        error.textContent = "";
      }

      state.filters = {
        gender: field(formData, "gender"),
        ageMin,
        ageMax,
        city: field(formData, "city"),
        sort: field(formData, "sort") || "default",
      };

      state.page = 1;
      filterDialog.close();
      renderUsersPanel();
    });
  }
}

function removeFilter(key) {
  state.filters[key] = key === "sort" ? "default" : "";
  state.page = 1;
  renderUsersPanel();
}

function toggleAgeSort() {
  state.filters.sort =
    state.filters.sort === "age-asc" ? "age-desc" : "age-asc";
  state.page = 1;
  renderUsersPanel();
}

/* =========================================================
   COMMENTS
   ========================================================= */

function handleCommentAction(action, id) {
  const comment = state.comments.find((item) => item.id === id);
  if (!comment) return;

  if (action === "approve") {
    comment.status = "approved";
    notify("نظر تأیید شد.");
  } else if (action === "spam") {
    comment.status = "spam";
    notify("نظر به عنوان هرزنامه علامت خورد.");
  } else if (action === "reply") {
    state.replyId = id;
    const form = $("#reply-form");
    form.reset();
    ui.setFormErrors(form, {});
    $("#reply-to").textContent = `پاسخ به ${comment.name}: «${comment.text}»`;
    openDialog($("#reply-dialog"));
    return;
  } else if (action === "delete") {
    confirmAction({
      title: "حذف نظر",
      text: `نظر «${comment.name}» برای همیشه حذف می‌شود.`,
      okLabel: "حذف نظر",
      onConfirm: () => {
        state.comments = state.comments.filter((item) => item.id !== id);
        persist(STORAGE.comments, state.comments);
        notify("نظر حذف شد.");
        renderComments();
        renderDashboard();
      },
    });
    return;
  }

  persist(STORAGE.comments, state.comments);
  renderComments();
  renderDashboard();
}

function handleReplySubmit(event) {
  event.preventDefault();

  const form = event.currentTarget;
  const text = field(new FormData(form), "reply");

  if (!text) {
    ui.setFormErrors(form, { reply: "متن پاسخ را وارد کنید." });
    return;
  }

  const comment = state.comments.find((item) => item.id === state.replyId);
  if (!comment) return;

  comment.replies = [...(comment.replies || []), { text, date: todayFa() }];
  if (comment.status === "pending") comment.status = "approved";

  persist(STORAGE.comments, state.comments);
  $("#reply-dialog").close();
  notify("پاسخ ثبت شد.");
  renderComments();
  renderDashboard();
}

/* =========================================================
   POSTS
   ========================================================= */

function openPostDialog(id = null) {
  const form = $("#post-form");
  const post = id ? state.posts.find((item) => item.id === id) : null;
  if (id && !post) return;

  state.editingPostId = post ? post.id : null;

  form.reset();
  ui.setFormErrors(form, {});
  $("#post-dialog-title").textContent = post ? "ویرایش نوشته" : "افزودن نوشته";

  if (post) {
    form.elements.title.value = post.title;
    form.elements.excerpt.value = post.excerpt || "";
    form.elements.status.value = post.status;
  }

  openDialog($("#post-dialog"));
}

function savePost(data) {
  if (state.editingPostId) {
    const post = state.posts.find((item) => item.id === state.editingPostId);
    if (post) Object.assign(post, data);
  } else {
    state.posts.unshift({ id: createId("post"), ...data });
  }

  persist(STORAGE.posts, state.posts);
  renderPosts();
  renderDashboard();
}

function handlePostSubmit(event) {
  event.preventDefault();

  const form = event.currentTarget;
  const formData = new FormData(form);
  const data = {
    title: field(formData, "title"),
    excerpt: field(formData, "excerpt"),
    status: field(formData, "status") === "published" ? "published" : "draft",
  };

  const titleError = validateTitle(data.title, "عنوان نوشته");
  ui.setFormErrors(form, titleError ? { title: titleError } : {});
  if (titleError) return;

  const editing = Boolean(state.editingPostId);
  savePost(data);
  state.editingPostId = null;
  $("#post-dialog").close();
  notify(editing ? "نوشته به‌روزرسانی شد." : "نوشته ذخیره شد.");
}

function handleQuickDraft(event) {
  event.preventDefault();

  const form = event.currentTarget;
  const formData = new FormData(form);
  const title = field(formData, "title");

  const error = validateTitle(title, "عنوان پیش‌نویس");
  ui.setFormErrors(form, error ? { title: error } : {});
  if (error) return;

  state.editingPostId = null;
  savePost({ title, excerpt: field(formData, "excerpt"), status: "draft" });
  form.reset();
  notify("پیش‌نویس ذخیره شد.");
}

function handlePostAction(action, id) {
  const post = state.posts.find((item) => item.id === id);
  if (!post) return;

  if (action === "edit") {
    openPostDialog(id);
  } else if (action === "toggle") {
    post.status = post.status === "published" ? "draft" : "published";
    persist(STORAGE.posts, state.posts);
    notify(
      post.status === "published"
        ? "نوشته منتشر شد."
        : "نوشته به پیش‌نویس برگشت.",
    );
    renderPosts();
    renderDashboard();
  } else if (action === "delete") {
    confirmAction({
      title: "حذف نوشته",
      text: `نوشته «${post.title}» برای همیشه حذف می‌شود.`,
      okLabel: "حذف نوشته",
      onConfirm: () => {
        state.posts = state.posts.filter((item) => item.id !== id);
        persist(STORAGE.posts, state.posts);
        notify("نوشته حذف شد.");
        renderPosts();
        renderDashboard();
      },
    });
  }
}

/* =========================================================
   PAGES
   ========================================================= */

function openPageDialog(id = null) {
  const form = $("#page-form");
  const page = id ? state.pages.find((item) => item.id === id) : null;
  if (id && !page) return;

  state.editingPageId = page ? page.id : null;

  form.reset();
  ui.setFormErrors(form, {});
  $("#page-dialog-title").textContent = page ? "ویرایش برگه" : "افزودن برگه";

  if (page) {
    form.elements.title.value = page.title;
    form.elements.desc.value = page.desc || "";
  }

  openDialog($("#page-dialog"));
}

function handlePageSubmit(event) {
  event.preventDefault();

  const form = event.currentTarget;
  const formData = new FormData(form);
  const data = {
    title: field(formData, "title"),
    desc: field(formData, "desc"),
  };

  const titleError = validateTitle(data.title, "عنوان برگه");
  ui.setFormErrors(form, titleError ? { title: titleError } : {});
  if (titleError) return;

  const editing = Boolean(state.editingPageId);

  if (editing) {
    const page = state.pages.find((item) => item.id === state.editingPageId);
    if (page) Object.assign(page, data);
  } else {
    state.pages.push({ id: createId("page"), ...data });
  }

  persist(STORAGE.pages, state.pages);
  state.editingPageId = null;
  $("#page-dialog").close();
  notify(editing ? "برگه به‌روزرسانی شد." : "برگه اضافه شد.");
  ui.renderPages(state.pages);
  renderDashboard();
}

function handlePageAction(action, id) {
  const page = state.pages.find((item) => item.id === id);
  if (!page) return;

  if (action === "edit") {
    openPageDialog(id);
  } else if (action === "delete") {
    confirmAction({
      title: "حذف برگه",
      text: `برگه «${page.title}» برای همیشه حذف می‌شود.`,
      okLabel: "حذف برگه",
      onConfirm: () => {
        state.pages = state.pages.filter((item) => item.id !== id);
        persist(STORAGE.pages, state.pages);
        notify("برگه حذف شد.");
        ui.renderPages(state.pages);
        renderDashboard();
      },
    });
  }
}

/* =========================================================
   MEDIA
   ========================================================= */

const MAX_MEDIA_SIZE = 10 * 1024 * 1024;

function handleMediaSelected(event) {
  const files = [...event.target.files];
  let added = 0;

  files.forEach((file) => {
    if (file.size > MAX_MEDIA_SIZE) {
      ui.toast(
        `«${file.name}» بزرگ‌تر از ۱۰ مگابایت است و اضافه نشد.`,
        "error",
      );
      return;
    }

    const item = { id: createId("media"), name: file.name, size: file.size };
    if (file.type.startsWith("image/")) {
      state.mediaPreviews.set(item.id, URL.createObjectURL(file));
    }

    state.media.unshift(item);
    added++;
  });

  event.target.value = "";
  if (!added) return;

  persist(STORAGE.media, state.media);
  notify(`${added.toLocaleString("fa-IR")} پرونده اضافه شد.`);
  ui.renderMedia(state.media, state.mediaPreviews);
}

function handleMediaAction(action, id) {
  const item = state.media.find((entry) => entry.id === id);
  if (!item || action !== "delete") return;

  confirmAction({
    title: "حذف پرونده",
    text: `پرونده «${item.name}» از کتابخانه حذف می‌شود.`,
    okLabel: "حذف پرونده",
    onConfirm: () => {
      const url = state.mediaPreviews.get(id);
      if (url) URL.revokeObjectURL(url);
      state.mediaPreviews.delete(id);

      state.media = state.media.filter((entry) => entry.id !== id);
      persist(STORAGE.media, state.media);
      notify("پرونده حذف شد.");
      ui.renderMedia(state.media, state.mediaPreviews);
    },
  });
}

/* =========================================================
   SETTINGS
   ========================================================= */

function applySettings() {
  ui.setBrand(state.settings.siteTitle);
  document.title = `${VIEW_TITLES[state.view]} ‹ ${state.settings.siteTitle}`;

  $("#site-title").value = state.settings.siteTitle;
  $("#items-per-page").value = String(state.settings.itemsPerPage);
  $("#notifications").checked = Boolean(state.settings.notifications);
}

function handleSettingsSubmit(event) {
  event.preventDefault();

  const form = event.currentTarget;
  const siteTitle = $("#site-title").value.trim();

  if (!siteTitle) {
    ui.setFormErrors(form, { siteTitle: "عنوان سایت نمی‌تواند خالی باشد." });
    return;
  }

  ui.setFormErrors(form, {});

  state.settings = {
    siteTitle,
    itemsPerPage: Number($("#items-per-page").value) || 10,
    notifications: $("#notifications").checked,
  };

  persist(STORAGE.settings, state.settings);
  state.page = 1;
  applySettings();
  renderUsersPanel();
  notify("تنظیمات ذخیره شد.");
}

function resetAllData() {
  confirmAction({
    title: "بازنشانی داده‌ها",
    text: "همه‌ی کاربران محلی، ویرایش‌ها، نظرها، نوشته‌ها و تنظیمات ذخیره‌شده در این مرورگر پاک می‌شود. این کار قابل بازگشت نیست.",
    okLabel: "پاک کردن همه‌چیز",
    onConfirm: () => {
      clearAllData();
      location.reload();
    },
  });
}

/* =========================================================
   CSV EXPORT
   ========================================================= */

function exportCsv() {
  const csv = usersToCsv(activeUsers(state.users, state.deletedIds));
  const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = url;
  link.download = "users.csv";
  document.body.append(link);
  link.click();
  link.remove();

  setTimeout(() => URL.revokeObjectURL(url), 1000);
  notify("فایل CSV دانلود شد.");
}

/* =========================================================
   ADMIN SLIDER (سازگار با RTL)
   ========================================================= */

function setupAdminSlider() {
  const slider = $("#admin-slider");
  const dots = $("#slider-dots");
  const prev = $("#slider-prev");
  const next = $("#slider-next");
  const slides = $$(".admin-slide", slider);
  if (!slides.length) return;

  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
  let current = 0;

  function paint() {
    dots.innerHTML = slides
      .map(
        (_, index) =>
          `<button type="button" class="${index === current ? "active" : ""}" data-slide="${index}" aria-label="مدیر ${index + 1}"></button>`,
      )
      .join("");

    prev.disabled = current === 0;
    next.disabled = current === slides.length - 1;
  }

  function goTo(index) {
    current = Math.min(Math.max(index, 0), slides.length - 1);
    slides[current].scrollIntoView({
      behavior: reduceMotion ? "auto" : "smooth",
      inline: "start",
      block: "nearest",
    });
    paint();
  }

  // هنگام اسکرول با لمس، شاخص فعلی را همگام کن (در RTL لبه‌ی شروع = راست)
  slider.addEventListener(
    "scroll",
    debounce(() => {
      const edge = slider.getBoundingClientRect().right;
      let best = 0;
      let bestDistance = Infinity;

      slides.forEach((slide, index) => {
        const distance = Math.abs(slide.getBoundingClientRect().right - edge);
        if (distance < bestDistance) {
          best = index;
          bestDistance = distance;
        }
      });

      if (best !== current) {
        current = best;
        paint();
      }
    }, 80),
    { passive: true },
  );

  prev.addEventListener("click", () => goTo(current - 1));
  next.addEventListener("click", () => goTo(current + 1));
  dots.addEventListener("click", (event) => {
    const button = event.target.closest("[data-slide]");
    if (button) goTo(Number(button.dataset.slide));
  });

  paint();
}

/* =========================================================
   GLOBAL EVENT DELEGATION
   ========================================================= */

function handleClick(event) {
  const target = event.target;

  // بستن منوی «جدید» هنگام کلیک بیرون از آن
  const newMenu = $("#new-menu");
  if (newMenu?.open && !target.closest("#new-menu")) newMenu.open = false;

  const anchor = target.closest('a[href^="#"]');
  if (anchor && handleAnchor(event, anchor)) return;

  const close = target.closest("[data-close]");
  if (close) {
    close.closest("dialog")?.close();
    return;
  }

  const go = target.closest("[data-go]");
  if (go) {
    navigate(go.dataset.go);
    return;
  }

  const open = target.closest("[data-open]");
  if (open) {
    if (newMenu) newMenu.open = false;
    const kind = open.dataset.open;
    if (kind === "user") openUserDialog();
    if (kind === "post") openPostDialog();
    if (kind === "page") openPageDialog();
    if (kind === "media") $("#media-input").click();
    return;
  }

  const action = target.closest("[data-action]");
  if (action) {
    const { action: name, id } = action.dataset;

    if (name === "detail") openDetails(id);
    if (name === "edit") openUserDialog(id);
    if (name === "delete") requestDeleteUser(id);
    if (name === "restore") restoreUser(id);
    if (name === "refresh") loadData();
    if (name === "export-csv") exportCsv();
    if (name === "reset-data") resetAllData();
    return;
  }

  const tab = target.closest("[data-tab]");
  if (tab) {
    state.tab = tab.dataset.tab;
    state.page = 1;
    $$("[data-tab]").forEach((item) =>
      item.setAttribute("aria-selected", String(item === tab)),
    );
    renderUsersPanel();
    return;
  }

  const commentFilter = target.closest("[data-comment-filter]");
  if (commentFilter) {
    state.commentFilter = commentFilter.dataset.commentFilter;
    renderComments();
    return;
  }

  const commentAction = target.closest("[data-comment-action]");
  if (commentAction) {
    handleCommentAction(
      commentAction.dataset.commentAction,
      commentAction.dataset.id,
    );
    return;
  }

  const postAction = target.closest("[data-post-action]");
  if (postAction) {
    handlePostAction(postAction.dataset.postAction, postAction.dataset.id);
    return;
  }

  const pageAction = target.closest("[data-page-action]");
  if (pageAction) {
    handlePageAction(pageAction.dataset.pageAction, pageAction.dataset.id);
    return;
  }

  const mediaAction = target.closest("[data-media-action]");
  if (mediaAction) {
    handleMediaAction(mediaAction.dataset.mediaAction, mediaAction.dataset.id);
    return;
  }

  const pageButton = target.closest("[data-page]");
  if (pageButton && !pageButton.disabled) {
    state.page = Number(pageButton.dataset.page);
    renderUsersPanel();
    $("#users-card")?.scrollIntoView({ behavior: "smooth", block: "start" });
    return;
  }

  const recent = target.closest("[data-recent-search]");
  if (recent) {
    const value = recent.dataset.recentSearch;
    $("#search-input").value = value;
    ui.setSearchError("");
    applySearch(value);
    return;
  }

  if (target.closest("[data-clear-recent]")) {
    state.recentSearches = [];
    persist(STORAGE.recentSearches, state.recentSearches);
    renderUsersPanel();
    return;
  }

  const removeFilterButton = target.closest("[data-remove-filter]");
  if (removeFilterButton) {
    removeFilter(removeFilterButton.dataset.removeFilter);
    return;
  }

  if (target.closest("[data-sort='age']")) toggleAgeSort();
}

/* =========================================================
   SETUP
   ========================================================= */
function setupEvents() {
  document.addEventListener("click", handleClick);

  // باز کردن فیلتر کاربران
  const openFilterButton = $("#open-filter");

  if (openFilterButton) {
    openFilterButton.addEventListener("click", () => {
      fillCityFilter();
      syncFilterForm();
      openDialog($("#filter-dialog"));
    });
  }

  // بستن منو با کلیک روی پس‌زمینه
  const backdrop = $("#backdrop");

  if (backdrop) {
    backdrop.addEventListener("click", () => setMenu(false));
  }

  // بستن منو با کلید Escape
  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;

    setMenu(false);

    const newMenu = $("#new-menu");

    if (newMenu) {
      newMenu.open = false;
    }
  });
}

// کلیک روی پس‌زمینه‌ی مودال، آن را می‌بندد
$$("dialog").forEach((dialog) => {
  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) dialog.close();
  });
});

$("#user-form").addEventListener("submit", handleUserSubmit);
$("#reply-form").addEventListener("submit", handleReplySubmit);
$("#post-form").addEventListener("submit", handlePostSubmit);
$("#page-form").addEventListener("submit", handlePageSubmit);
$("#quick-draft-form").addEventListener("submit", handleQuickDraft);
$("#settings-form").addEventListener("submit", handleSettingsSubmit);
$("#media-input").addEventListener("change", handleMediaSelected);

$("#detail-edit").addEventListener("click", () => {
  const id = state.detailId;
  $("#detail-dialog").close();
  if (id) openUserDialog(id);
});

$("#confirm-ok").addEventListener("click", () => {
  const action = state.confirmAction;
  state.confirmAction = null;
  $("#confirm-dialog").close();
  action?.();
});

$("#retry-btn").addEventListener("click", loadData);

$("#post-search").addEventListener(
  "input",
  debounce((event) => {
    state.postQuery = event.target.value;
    renderPosts();
  }, 200),
);

$("#post-status").addEventListener("change", (event) => {
  state.postStatus = event.target.value;
  renderPosts();
});

window.addEventListener("hashchange", () => {
  const hash = location.hash.slice(1);

  if (VIEWS.includes(hash)) {
    navigate(hash, { updateHash: false });
  } else if (hash === "admins") {
    navigate("users", { updateHash: false });
    scrollToAdmins();
  }
});

async function init() {
  applySettings();
  setupEvents();
  setupSearch();
  setupFilter();
  setupAdminSlider();

  const hash = location.hash.slice(1);
  navigate(VIEWS.includes(hash) ? hash : "dashboard", { updateHash: false });

  await loadData();
}

init();
const adminSlider = document.getElementById("admin-slider");

if (adminSlider) {
  setInterval(() => {
    const maxScroll = adminSlider.scrollWidth - adminSlider.clientWidth;

    if (adminSlider.scrollLeft <= -maxScroll + 5) {
      adminSlider.scrollTo({
        left: 0,
        behavior: "smooth",
      });
    } else {
      adminSlider.scrollBy({
        left: -250,
        behavior: "smooth",
      });
    }
  }, 3000);
}

const darkModeBtn = document.getElementById("dark-mode-btn");
const lightModeBtn = document.getElementById("light-mode-btn");
const root = document.documentElement;

function setTheme(theme) {
  // تغییر تم سایت
  root.dataset.theme = theme;

  // ذخیره انتخاب کاربر
  localStorage.setItem("admin-theme", theme);

  // مشخص کردن دکمه فعال
  darkModeBtn.classList.toggle("active", theme === "dark");
  lightModeBtn.classList.toggle("active", theme === "light");

  darkModeBtn.setAttribute("aria-pressed", String(theme === "dark"));

  lightModeBtn.setAttribute("aria-pressed", String(theme === "light"));
}

// بارگذاری تم ذخیره‌شده؛ حالت پیش‌فرض دارک است
const savedTheme = localStorage.getItem("admin-theme");
setTheme(savedTheme === "light" ? "light" : "dark");

// کلیک روی ماه
darkModeBtn.addEventListener("click", () => {
  setTheme("dark");
});

// کلیک روی خورشید
lightModeBtn.addEventListener("click", () => {
  setTheme("light");
});
