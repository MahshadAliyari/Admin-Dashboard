export function toFa(value) {
    return Number(value).toLocaleString("fa-IR");
}

export function initials(user) {
  const first = user.firstName?.[0] ?? "";
  const last = user.lastName?.[0] ?? "";
  return (first + last).toUpperCase();
}

export function fullName(user) {
  return `${user.firstName} ${user.lastName}`.trim();
}