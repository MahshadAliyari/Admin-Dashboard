const BASE_URL = "https://dummyjson.com";

export async function getUsers() {
    const res = await fetch(`${BASE_URL}/users?limit=0`);

    if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
    }
    const data = await res.json();
    return data.users;
    
}