"use client";

import { useState } from "react";
import { Eye, EyeOff, Trash2, Save, UserPlus } from "lucide-react";
import {
  createUser,
  updateUser,
  deleteUser,
  type AdminUserData,
} from "@/modules/users/actions";
import type { AdminRole } from "@/modules/auth/types";

interface UserFormProps {
  mode: "create" | "edit";
  user?: AdminUserData;
}

const roleLabels: Record<AdminRole, string> = {
  ADMIN: "Admin",
  WORKER: "Worker",
};

export function UserForm({ mode, user }: UserFormProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  const [email, setEmail] = useState(user?.email ?? "");
  const [password, setPassword] = useState("");
  const [name, setName] = useState(user?.name ?? "");
  const [role, setRole] = useState<AdminRole>(user?.role ?? "WORKER");

  const validatePassword = (pwd: string): boolean => {
    if (mode === "edit" && pwd.length === 0) return true; // Password optional on edit
    return pwd.length >= 8;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!email.trim()) {
      setError("El email es obligatorio");
      return;
    }

    if (!name.trim()) {
      setError("El nombre es obligatorio");
      return;
    }

    if (mode === "create" && !password) {
      setError("La contraseña es obligatoria");
      return;
    }

    if (!validatePassword(password)) {
      setError("La contraseña debe tener al menos 8 caracteres");
      return;
    }

    setIsLoading(true);

    try {
      if (mode === "create") {
        const result = await createUser({ email, password, name, role });
        if (!result.success) {
          setError(result.error ?? "Error al crear el usuario");
          setIsLoading(false);
          return;
        }
      } else if (user) {
        const result = await updateUser(user.id, {
          email,
          password: password || undefined,
          name,
          role,
        });
        if (!result.success) {
          setError(result.error ?? "Error al actualizar el usuario");
          setIsLoading(false);
          return;
        }
      }

      // Use window.location for reliable navigation
      window.location.href = "/admin/usuarios";
    } catch {
      setError("Error inesperado");
      setIsLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!user) return;

    setIsDeleting(true);
    setError(null);

    try {
      const result = await deleteUser(user.id);
      if (!result.success) {
        setError(result.error ?? "Error al eliminar el usuario");
        setIsDeleting(false);
        setShowDeleteModal(false);
        return;
      }

      window.location.href = "/admin/usuarios";
    } catch {
      setError("Error inesperado");
      setIsDeleting(false);
      setShowDeleteModal(false);
    }
  };

  return (
    <>
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="bg-red-500/10 border border-red-500/50 text-red-400 px-4 py-3 rounded-xl text-sm">
            {error}
          </div>
        )}

        {/* Email */}
        <div>
          <label htmlFor="email" className="block text-white/70 text-sm mb-2">
            Email
          </label>
          <input
            type="email"
            id="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full bg-[#1a1a1a] border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-white/30 focus:outline-none focus:border-[#D4AF37]/50"
            placeholder="usuario@ejemplo.com"
          />
        </div>

        {/* Password */}
        <div>
          <label htmlFor="password" className="block text-white/70 text-sm mb-2">
            Contraseña{" "}
            {mode === "edit" && (
              <span className="text-white/40">(dejar vacío para mantener)</span>
            )}
          </label>
          <div className="relative">
            <input
              type={showPassword ? "text" : "password"}
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-[#1a1a1a] border border-white/10 rounded-xl px-4 py-3 pr-12 text-white placeholder:text-white/30 focus:outline-none focus:border-[#D4AF37]/50"
              placeholder="Mínimo 8 caracteres"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-white/50 hover:text-white transition-colors"
            >
              {showPassword ? (
                <EyeOff className="w-5 h-5" />
              ) : (
                <Eye className="w-5 h-5" />
              )}
            </button>
          </div>
          {password.length > 0 && password.length < 8 && (
            <p className="text-red-400 text-xs mt-1">
              La contraseña debe tener al menos 8 caracteres
            </p>
          )}
        </div>

        {/* Name */}
        <div>
          <label htmlFor="name" className="block text-white/70 text-sm mb-2">
            Nombre
          </label>
          <input
            type="text"
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full bg-[#1a1a1a] border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-white/30 focus:outline-none focus:border-[#D4AF37]/50"
            placeholder="Nombre del usuario"
          />
        </div>

        {/* Role */}
        <div>
          <label htmlFor="role" className="block text-white/70 text-sm mb-2">
            Rol
          </label>
          <select
            id="role"
            value={role}
            onChange={(e) => setRole(e.target.value as AdminRole)}
            className="w-full bg-[#1a1a1a] border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-[#D4AF37]/50 appearance-none cursor-pointer"
          >
            <option value="ADMIN">Admin</option>
            <option value="WORKER">Worker</option>
          </select>
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          disabled={isLoading}
          className="w-full flex items-center justify-center gap-2 bg-[#D4AF37] hover:bg-[#b8972e] text-black font-semibold py-3 rounded-xl transition-colors disabled:opacity-50"
        >
          {mode === "create" ? (
            <UserPlus className="w-4 h-4" />
          ) : (
            <Save className="w-4 h-4" />
          )}
          {isLoading
            ? mode === "create"
              ? "Creando..."
              : "Guardando..."
            : mode === "create"
              ? "Crear usuario"
              : "Guardar cambios"}
        </button>

        {/* Delete Button - Only in edit mode */}
        {mode === "edit" && user && (
          <button
            type="button"
            onClick={() => setShowDeleteModal(true)}
            className="w-full flex items-center justify-center gap-2 bg-transparent border border-red-500/50 text-red-400 hover:bg-red-500/10 font-semibold py-3 rounded-xl transition-colors"
          >
            <Trash2 className="w-4 h-4" />
            Eliminar usuario
          </button>
        )}
      </form>

      {/* Delete Confirmation Modal */}
      {showDeleteModal && user && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/70"
            onClick={() => !isDeleting && setShowDeleteModal(false)}
          />

          {/* Modal */}
          <div className="relative bg-[#1a1a1a] border border-white/10 rounded-2xl p-6 max-w-sm w-full">
            <h3 className="text-white font-semibold text-lg mb-4">
              Confirmar eliminación
            </h3>
            <p className="text-white/70 mb-6">
              ¿Estás seguro de eliminar al usuario{" "}
              <span className="text-white font-medium">
                {roleLabels[user.role]} {user.name || user.email}
              </span>
              ?
            </p>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setShowDeleteModal(false)}
                disabled={isDeleting}
                className="flex-1 bg-white/10 hover:bg-white/20 text-white font-semibold py-3 rounded-xl transition-colors disabled:opacity-50"
              >
                No
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={isDeleting}
                className="flex-1 bg-red-500 hover:bg-red-600 text-white font-semibold py-3 rounded-xl transition-colors disabled:opacity-50"
              >
                {isDeleting ? "Eliminando..." : "Sí"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
