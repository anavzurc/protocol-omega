import Parse from "./parse";

export interface RegisterData {
  username: string;
  email: string;
  password: string;
}

export interface LoginData {
  username: string;
  password: string;
}

export async function registerUser(data: RegisterData) {
  const user = new Parse.User();

  user.set("username", data.username);
  user.set("email", data.email);
  user.set("password", data.password);

  return await user.signUp();
}

export async function loginUser(data: LoginData) {
  return await Parse.User.logIn(
    data.username,
    data.password
  );
}

export async function logoutUser() {
  await Parse.User.logOut();
}

export function getCurrentUser() {
  return Parse.User.current();
}

export async function getCurrentUserAsync() {
  return await Parse.User.currentAsync();
}

export async function isAuthenticated() {
  const user = await Parse.User.currentAsync();
  return !!user;
}