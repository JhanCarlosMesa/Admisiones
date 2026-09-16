import type { Account, RecoveryToken, Session } from "../types";
import { generateId, readList, writeList } from "../data/store";
import { STORAGE_KEYS } from "../data/keys";
import { hashPassword, randomSalt, randomToken } from "../utils/crypto";

const SESSION_DURATION_MS = 1000 * 60 * 60 * 8; // 8 horas
const RECOVERY_DURATION_MS = 1000 * 60 * 30; // 30 minutos

export function getAccounts(): Account[] {
  return readList<Account>(STORAGE_KEYS.accounts);
}

function saveAccounts(list: Account[]): void {
  writeList(STORAGE_KEYS.accounts, list);
}

export function findByEmail(email: string): Account | undefined {
  const normalized = email.trim().toLowerCase();
  return getAccounts().find((item) => item.email === normalized);
}

export async function registerApplicant(input: {
  firstName: string;
  lastName: string;
  documentType: string;
  documentNumber: string;
  email: string;
  phone: string;
  password: string;
}): Promise<{ ok: true } | { ok: false; message: string }> {
  const email = input.email.trim().toLowerCase();
  const documentNumber = input.documentNumber.trim();
  const accounts = getAccounts();
  if (accounts.some((item) => item.email === email || item.documentNumber === documentNumber)) {
    return { ok: false, message: "El correo o documento ya está registrado." };
  }
  const passwordSalt = randomSalt();
  const passwordHash = await hashPassword(input.password, passwordSalt);
  const account: Account = {
    id: generateId("acc"),
    firstName: input.firstName.trim(),
    lastName: input.lastName.trim(),
    documentType: input.documentType,
    documentNumber,
    email,
    phone: input.phone.trim(),
    passwordHash,
    passwordSalt,
    role: "Aspirante",
    createdAt: new Date().toISOString(),
  };
  saveAccounts([...accounts, account]);
  return { ok: true };
}

export async function login(
  email: string,
  password: string,
  remember: boolean,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const account = findByEmail(email);
  if (!account) return { ok: false, message: "El correo o la contraseña no son correctos." };
  const hash = await hashPassword(password, account.passwordSalt);
  if (hash !== account.passwordHash) {
    return { ok: false, message: "El correo o la contraseña no son correctos." };
  }
  const session: Session = {
    accountId: account.id,
    email: account.email,
    role: account.role,
    expiresAt: Date.now() + SESSION_DURATION_MS,
  };
  const raw = JSON.stringify(session);
  if (remember) localStorage.setItem(STORAGE_KEYS.session, raw);
  else sessionStorage.setItem(STORAGE_KEYS.session, raw);
  return { ok: true };
}

export function logout(): void {
  localStorage.removeItem(STORAGE_KEYS.session);
  sessionStorage.removeItem(STORAGE_KEYS.session);
}

export function currentSession(): Session | undefined {
  const raw = localStorage.getItem(STORAGE_KEYS.session) ?? sessionStorage.getItem(STORAGE_KEYS.session);
  if (!raw) return undefined;
  try {
    const session = JSON.parse(raw) as Session;
    if (session.expiresAt < Date.now()) {
      logout();
      return undefined;
    }
    return session;
  } catch {
    return undefined;
  }
}

export function currentAccount(): Account | undefined {
  const session = currentSession();
  if (!session) return undefined;
  return getAccounts().find((item) => item.id === session.accountId);
}

export function updateAccount(accountId: string, patch: Partial<Account>): Account | undefined {
  const accounts = getAccounts();
  const updated = accounts.map((item) => (item.id === accountId ? { ...item, ...patch } : item));
  saveAccounts(updated);
  return updated.find((item) => item.id === accountId);
}

export function promoteToStudent(accountId: string): void {
  updateAccount(accountId, { role: "Estudiante" });
}

function getTokens(): RecoveryToken[] {
  return readList<RecoveryToken>(STORAGE_KEYS.recoveryTokens);
}

function saveTokens(list: RecoveryToken[]): void {
  writeList(STORAGE_KEYS.recoveryTokens, list);
}

export function requestPasswordRecovery(
  email: string,
): { ok: true; token: string; expiresAt: number } | { ok: false; message: string } {
  const account = findByEmail(email);
  if (!account) return { ok: false, message: "No encontramos una cuenta asociada a este correo." };
  const token = randomToken();
  const expiresAt = Date.now() + RECOVERY_DURATION_MS;
  const remaining = getTokens().filter((item) => item.email !== account.email);
  saveTokens([...remaining, { token, email: account.email, expiresAt, used: false }]);
  return { ok: true, token, expiresAt };
}

export function validateRecoveryToken(token: string): RecoveryToken | undefined {
  return getTokens().find((item) => item.token === token && !item.used && item.expiresAt > Date.now());
}

export async function resetPasswordWithToken(
  token: string,
  newPassword: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const entry = validateRecoveryToken(token);
  if (!entry) return { ok: false, message: "El enlace de recuperación no es válido o ha expirado." };
  const account = findByEmail(entry.email);
  if (!account) return { ok: false, message: "No encontramos la cuenta asociada a este enlace." };
  const passwordSalt = randomSalt();
  const passwordHash = await hashPassword(newPassword, passwordSalt);
  updateAccount(account.id, { passwordHash, passwordSalt });
  saveTokens(getTokens().map((item) => (item.token === token ? { ...item, used: true } : item)));
  return { ok: true };
}
