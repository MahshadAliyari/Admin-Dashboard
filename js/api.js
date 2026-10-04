const BASE_URL = "https://dummyjson.com";
const JSON_HEADERS = { "Content-Type": "application/json" };

async function request(path, options) {
  const res = await fetch(`${BASE_URL}${path}`, options);
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`);
  }
  return res.json();
}
function normalizeUser(u) {
  return {
    id: u.id,
    firstName: u.firstName,
     lastName: u.lastName,
    email: u.email,
    age: u.age,
    gender: u.gender,
    phone: u.phone ?? "",
    city: u.address?.city ?? "",
    image: u.image ?? "",
    role: u.role ?? "user",
    jobTitle: u.company?.title ?? "",
    source: "server",
  };
}

export async function getUsers() {
  const data = await request("/users?limit=0");
  return data.users.map(normalizeUser);
}

export function createUserRequest(values) {
  return request("/users/add", {
   method: "POST",
    headers: JSON_HEADERS,
    body: JSON.stringify(values),
  });
}

export function updateUserRequest(id, values) {
  return request(`/users/${id}`, {
    method: "PUT",
    headers: JSON_HEADERS,
    body: JSON.stringify(values),
  });
}

export function deleteUserRequest(id) {
  return request(`/users/${id}`, { method: "DELETE" });
}