/* ---------- قالب‌بندی ---------- */

export function faNumber(value) {
  if (value === null || value === undefined || value === "") return "۰";
  const number = Number(value);
  return Number.isNaN(number) ? "۰" : number.toLocaleString("fa-IR");
}

export function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export function formatBytes(bytes) {
  const size = Number(bytes) || 0;
  if (size >= 1024 * 1024) {
    return `${(size / 1024 / 1024).toLocaleString("fa-IR", { maximumFractionDigits: 1 })} MB`;
  }
  return `${Math.max(1, Math.round(size / 1024)).toLocaleString("fa-IR")} KB`;
}

export const GENDER_LABELS = { male: "مرد", female: "زن" };

export const genderLabel = (gender) => GENDER_LABELS[gender] || "نامشخص";

export const fullName = (user) =>
  `${user.firstName || ""} ${user.lastName || ""}`.trim();

export function initials(user) {
  const first = user.firstName?.charAt(0) || "";
  const last = user.lastName?.charAt(0) || "";
  return `${first}${last}` || "؟";
}

export function debounce(fn, delay = 250) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

/* ---------- کاربران ---------- */

/** شکل یکسان برای کاربر سرور و کاربر محلی */
export function normalizeUser(user, edits = {}) {
  const id = String(user.id);
  const edit = edits[id] || {};
  const merged = { ...user, ...edit };

  return {
    id,
    firstName: merged.firstName || "",
    lastName: merged.lastName || "",
    email: merged.email || "",
    phone: merged.phone || "",
    age: merged.age,
    gender: merged.gender || "",
    city: edit.city || user.address?.city || user.city || "",
    local: Boolean(user.local),
  };
}

export const isDeleted = (user, deletedIds) => deletedIds.has(String(user.id));

export const activeUsers = (users, deletedIds) =>
  users.filter((user) => !isDeleted(user, deletedIds));

export function userStatus(user, deletedIds) {
  if (isDeleted(user, deletedIds))
    return { className: "danger", label: "حذف‌شده" };
  if (user.local) return { className: "warning", label: "محلی" };
  return { className: "success", label: "سرور" };
}

export function computeStats(users, deletedIds) {
  const active = activeUsers(users, deletedIds);

  const ages = active
    .map((user) => Number(user.age))
    .filter((age) => Number.isFinite(age) && age > 0);

  const averageAge = ages.length
    ? Math.round(ages.reduce((sum, age) => sum + age, 0) / ages.length)
    : 0;

  const cities = new Set(
    active.map((user) => user.city?.trim().toLowerCase()).filter(Boolean),
  );

  const local = active.filter((user) => user.local).length;

  return {
    total: active.length,
    averageAge,
    cities: cities.size,
    local,
    server: active.length - local,
    deleted: users.length - active.length,
  };
}

/** [[کلید، تعداد], ...] مرتب از زیاد به کم */
export function countBy(users, getKey, fallback = "نامشخص") {
  const counts = new Map();

  users.forEach((user) => {
    const key = getKey(user) || fallback;
    counts.set(key, (counts.get(key) || 0) + 1);
  });

  return [...counts.entries()].sort((a, b) => b[1] - a[1]);
}

const AGE_BUCKETS = [
  { label: "≤25", max: 25 },
  { label: "26-35", max: 35 },
  { label: "36-45", max: 45 },
  { label: "46+", max: Infinity },
];

export function ageGroups(users) {
  const groups = AGE_BUCKETS.map((bucket) => ({
    label: bucket.label,
    count: 0,
  }));

  users.forEach((user) => {
    const age = Number(user.age);
    if (!Number.isFinite(age)) return;
    groups[AGE_BUCKETS.findIndex((bucket) => age <= bucket.max)].count++;
  });

  return groups;
}

export function genderShare(users) {
  const male = users.filter((user) => user.gender === "male").length;
  const female = users.filter((user) => user.gender === "female").length;
  const total = male + female;
  const malePercent = total ? Math.round((male / total) * 100) : 0;

  return {
    male,
    female,
    malePercent,
    femalePercent: total ? 100 - malePercent : 0,
  };
}

/** جستجو + فیلتر + مرتب‌سازی؛ آرایه‌ی جدید برمی‌گرداند */
export function filterUsers(users, { tab, search, filters, deletedIds }) {
  let list;

  if (tab === "deleted") {
    list = users.filter((user) => isDeleted(user, deletedIds));
  } else {
    list = activeUsers(users, deletedIds);
    if (tab === "server") list = list.filter((user) => !user.local);
    if (tab === "local") list = list.filter((user) => user.local);
  }

  const query = search.trim().toLowerCase();

  if (query) {
    list = list.filter((user) =>
      [fullName(user), user.email, user.city]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(query),
    );
  }

  if (filters.gender)
    list = list.filter((user) => user.gender === filters.gender);
  if (filters.ageMin)
    list = list.filter((user) => Number(user.age) >= Number(filters.ageMin));
  if (filters.ageMax)
    list = list.filter((user) => Number(user.age) <= Number(filters.ageMax));
  if (filters.city) list = list.filter((user) => user.city === filters.city);

  const sorters = {
    "age-asc": (a, b) => Number(a.age) - Number(b.age),
    "age-desc": (a, b) => Number(b.age) - Number(a.age),
    "name-asc": (a, b) => fullName(a).localeCompare(fullName(b), "fa"),
  };

  if (sorters[filters.sort]) list.sort(sorters[filters.sort]);

  return list;
}

/* ---------- اعتبارسنجی ---------- */

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateUser(data, { users = [], editingId = null } = {}) {
  const errors = {};

  if (!data.firstName) errors.firstName = "نام را وارد کنید.";
  if (!data.lastName) errors.lastName = "نام خانوادگی را وارد کنید.";

  if (!data.email) {
    errors.email = "ایمیل را وارد کنید.";
  } else if (!EMAIL_PATTERN.test(data.email)) {
    errors.email = "فرمت ایمیل صحیح نیست؛ مثال: name@example.com";
  } else if (
    users.some(
      (user) =>
        String(user.id) !== String(editingId) &&
        user.email?.toLowerCase() === data.email.toLowerCase(),
    )
  ) {
    errors.email = "این ایمیل قبلاً ثبت شده است.";
  }

  if (!Number.isInteger(data.age) || data.age < 1 || data.age > 120) {
    errors.age = "سن باید عدد صحیح بین ۱ تا ۱۲۰ باشد.";
  }

  if (!data.city) errors.city = "شهر را وارد کنید.";
  if (!data.gender) errors.gender = "جنسیت را انتخاب کنید.";

  return errors;
}

export function validateTitle(value, label = "عنوان") {
  const title = value.trim();
  if (!title) return `${label} را وارد کنید.`;
  if (title.length < 3) return `${label} حداقل ۳ نویسه باشد.`;
  if (title.length > 120) return `${label} نباید بیشتر از ۱۲۰ نویسه باشد.`;
  return "";
}

/** رشته‌ی خالی = پاک‌کردن جستجو (مجاز) */
export function validateSearch(value) {
  const text = value.trim();
  if (!text) return "";
  if (text.length < 2) return "برای جستجو حداقل ۲ نویسه وارد کنید.";
  if (text.length > 50) return "عبارت جستجو نباید بیشتر از ۵۰ نویسه باشد.";
  return "";
}

/* ---------- نوشته‌ها ---------- */

export function filterPosts(posts, query = "", status = "all") {
  const q = query.trim().toLowerCase();

  return posts.filter((post) => {
    const matchesText =
      !q || `${post.title} ${post.excerpt}`.toLowerCase().includes(q);
    const matchesStatus = status === "all" || post.status === status;
    return matchesText && matchesStatus;
  });
}

/* ---------- خروجی CSV ---------- */

function csvCell(value) {
  let text = String(value ?? "");
  // جلوگیری از CSV injection در اکسل
  if (/^[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}

export function usersToCsv(users) {
  const header = [
    "شناسه",
    "نام",
    "نام خانوادگی",
    "ایمیل",
    "شهر",
    "جنسیت",
    "سن",
  ];

  const rows = users.map((user) => [
    user.id,
    user.firstName,
    user.lastName,
    user.email,
    user.city,
    genderLabel(user.gender),
    user.age,
  ]);

  return [header, ...rows]
    .map((row) => row.map(csvCell).join(","))
    .join("\r\n");
}
