import { z } from "zod";

export const emailSchema = z
  .string()
  .trim()
  .email({ message: "E-mail inválido" })
  .max(255);

export const senhaSchema = z
  .string()
  .min(8, { message: "Mínimo 8 caracteres" })
  .max(72, { message: "Máximo 72 caracteres" });

export const telefoneSchema = z
  .string()
  .trim()
  .regex(/^\+?[1-9]\d{9,14}$/, { message: "Use formato internacional, ex: +5511999990000" });

export const loginSchema = z.object({
  email: emailSchema,
  senha: senhaSchema,
});

export const cadastroSchema = z.object({
  nome_completo: z.string().trim().min(3, "Informe seu nome completo").max(120),
  email: emailSchema,
  telefone: telefoneSchema,
  senha: senhaSchema,
});

export const condominioSchema = z.object({
  nome: z.string().trim().min(3, "Nome do condomínio").max(120),
  cnpj: z
    .string()
    .trim()
    .max(20)
    .optional()
    .or(z.literal("")),
  endereco: z.string().trim().max(255).optional().or(z.literal("")),
  cidade: z.string().trim().max(80).optional().or(z.literal("")),
  estado: z.string().trim().max(2).optional().or(z.literal("")),
  cep: z.string().trim().max(10).optional().or(z.literal("")),
  whatsapp_numero: z.string().trim().max(20).optional().or(z.literal("")),
});
