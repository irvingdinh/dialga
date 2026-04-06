import { request } from "./client";

export const authApi = {
  login: (email: string, password: string) =>
    request<{ success: true }>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),
  session: () =>
    request<{ id: string; email: string; name: string }>("/api/auth"),
  logout: () =>
    request<{ success: true }>("/api/auth/logout", { method: "POST" }),
  updateProfile: (data: { name?: string }) =>
    request<{ id: string; email: string; name: string }>("/api/auth/profile", {
      method: "PATCH",
      body: JSON.stringify(data),
    }),
  changePassword: (currentPassword: string, newPassword: string) =>
    request<{ success: true }>("/api/auth/change-password", {
      method: "POST",
      body: JSON.stringify({
        current_password: currentPassword,
        new_password: newPassword,
      }),
    }),
};
