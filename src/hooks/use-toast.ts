/**
 * use-toast — Compatibility shim que encaminha ao Sonner.
 *
 * Decisão Onda 4 / FIX 6: o projeto consolidou em UM único sistema de toast
 * (Sonner) para eliminar 3 stacks simultâneos (Radix Toaster + Sonner +
 * SaveErrorToast). Este shim preserva a API legada `useToast()` / `toast({...})`
 * usada em ~13 telas para evitar migração massiva de call sites:
 *
 *   toast({ title, description, variant: 'destructive' | 'default' })
 *
 * é traduzido para `sonner.toast.error(...)` ou `sonner.toast(...)`.
 *
 * Não há mais reducer interno, fila própria, nem `<Toaster />` Radix montado.
 * O único renderer ativo é `<Sonner />` em App.tsx.
 */
import type * as React from "react";
import { toast as sonnerToast } from "sonner";

type LegacyVariant = "default" | "destructive" | "success" | null | undefined;

interface LegacyToastInput {
  title?: React.ReactNode;
  description?: React.ReactNode;
  variant?: LegacyVariant;
  duration?: number;
  action?: any;
}

function toReactString(value: React.ReactNode): string | undefined {
  if (value == null) return undefined;
  if (typeof value === "string" || typeof value === "number") return String(value);
  // Sonner aceita ReactNode em description; coerção apenas no title fallback.
  return undefined;
}

function dispatchToast(input: LegacyToastInput | string) {
  if (typeof input === "string") {
    return { id: String(sonnerToast(input)), dismiss: () => {}, update: () => {} };
  }
  const { title, description, variant, duration } = input;
  const titleStr = toReactString(title) ?? "";
  const opts: any = {
    description: description ?? undefined,
    duration,
  };

  let id: string | number;
  if (variant === "destructive") {
    id = sonnerToast.error(titleStr || "Erro", opts);
  } else if (variant === "success") {
    id = sonnerToast.success(titleStr || "Sucesso", opts);
  } else {
    id = sonnerToast(titleStr || (toReactString(description) ?? ""), opts);
  }

  return {
    id: String(id),
    dismiss: () => sonnerToast.dismiss(id),
    update: () => {},
  };
}

export function toast(input: LegacyToastInput | string) {
  return dispatchToast(input);
}

export function useToast() {
  return {
    toast: dispatchToast,
    dismiss: (id?: string | number) => sonnerToast.dismiss(id as any),
    toasts: [] as any[],
  };
}
