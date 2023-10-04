import * as z from 'zod';

export enum UserRole {
  ADMIN = "admin",
  USER = "user"
}

export const UserSchema = z.object({
  _id: z.string().optional(),
  email: z.string(),
  name: z.string().optional(),
  role: z.nativeEnum(UserRole).optional(),
  monthlyUSDConsumptionLimit: z.number().optional()
});

export const UserSchemaArray = z.array(UserSchema);

export type User = z.infer<typeof UserSchema>;
