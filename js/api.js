const API_URL = "https://mcp.httpstatus.com/dummy/users?count=10";

export async function fetchUsers() {
  try {
    const response = await fetch(API_URL);

    if (!response.ok) {
      throw new Error(`خطای سرور: ${response.status}`);
    }

    const users = await response.json();

    if (!Array.isArray(users)) {
      throw new Error("ساختار اطلاعات کاربران معتبر نیست.");
    }

    return users;
  } catch (error) {
    console.error("API Error:", error);
    throw error;
  }
}
