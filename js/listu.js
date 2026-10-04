
export const GENDER_LABELS = { male: "مرد", female: "زن" };

export function debounce(fn, delay = 300) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

// عدد انگلیسی → فارسی (۱۲۳)
export function toFa(value) {
  return Number(value).toLocaleString("fa-IR");
}

// حروف اول نام و نام خانوادگی (برای آواتار)
export function initials(user) {
  const first = user.firstName?.[0] ?? "";
  const last = user.lastName?.[0] ?? "";
  return (first + last).toUpperCase();
}

export function fullName(user) {
  return `${user.firstName} ${user.lastName}`.trim();
}

// تبدیل تعداد به درصد برای نمودارها (۰ تا ۱۰۰)
export function toPercent(count, max) {
  return max ? Math.round((count / max) * 100) : 0;
}

// رشته‌ی خالی → null ، وگرنه عدد
export function toNumberOrNull(text) {
  return text === "" ? null : Number(text);
}
