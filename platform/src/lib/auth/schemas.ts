import {z} from 'zod';

export const localeSchema = z.enum(['ar', 'en']);
export const emailSchema = z.string().trim().toLowerCase().max(254).email();
export const passwordSchema = z.string().min(12).max(128);
export const nameSchema = z.string().trim().min(2).max(80).refine(value => !/[\u0000-\u001f\u007f]/.test(value));
export const tokenSchema = z.string().regex(/^[a-f0-9]{64}$/);
export const avatarSchema = z.enum(['/avatars/sky.svg', '/avatars/gold.svg', '/avatars/navy.svg']);

export const loginSchema = z.object({email: emailSchema, password: passwordSchema}).strict();
export const registrationSchema = z.object({name: nameSchema, email: emailSchema, password: passwordSchema, locale: localeSchema}).strict();
export const forgotPasswordSchema = z.object({email: emailSchema, locale: localeSchema}).strict();
export const resetPasswordSchema = z.object({token: tokenSchema, password: passwordSchema, locale: localeSchema}).strict();
export const verifyEmailSchema = z.object({token: tokenSchema}).strict();
export const resendVerificationSchema = z.object({locale: localeSchema}).strict();
export const profileSchema = z.object({name: nameSchema, preferredLocale: localeSchema, image: avatarSchema}).strict();
export const changePasswordSchema = z.object({currentPassword: passwordSchema, newPassword: passwordSchema}).strict().refine(value => value.currentPassword !== value.newPassword, {path:['newPassword'], message:'Choose a different password.'});
