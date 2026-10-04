import { getUsers } from "./api.js";
import { renderTable } from "./ui.js";

const users = await getUsers();
renderTable(users.slice(0, 10));
