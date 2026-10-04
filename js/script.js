import { getUsers } from "./api.js";

const users = await getUsers();
console.log(users[0]);