// limit=0 یعنی همه کاربران (۲۰۸ نفر)، نه فقط ۳۰ نفر پیش‌فرض
const API_URL = "https://dummyjson.com/users?limit=0";

/**
 * دریافت کاربران از API
 */
export async function fetchUsers() {
  const response = await fetch(API_URL);

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  const data = await response.json();

  return data.users;
}
