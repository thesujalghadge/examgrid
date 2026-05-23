import {
  DEMO_INSTITUTE_LOGIN,
  DEMO_PARENT_ACCOUNTS,
  DEMO_PLATFORM_ADMIN,
  DEMO_STUDENT_ACCOUNTS,
  getParentAccountByEmail,
  getStudentAccount,
} from "@/data/demo-data";

export function validateDemoPlatformLogin(userId: string, password: string): boolean {
  const id = userId.trim().toLowerCase();
  return (
    (id === DEMO_PLATFORM_ADMIN.email.toLowerCase() ||
      id === "admin@examgrid.ai" ||
      id === "platform-admin") &&
    password === DEMO_PLATFORM_ADMIN.password
  );
}

export function validateDemoInstituteLogin(userId: string, password: string): boolean {
  const id = userId.trim().toLowerCase();
  return (
    id === DEMO_INSTITUTE_LOGIN.email.toLowerCase() && password === DEMO_INSTITUTE_LOGIN.password
  );
}

export function validateDemoStudentPassword(
  rollOrEmail: string,
  password: string,
): boolean {
  const account = getStudentAccount(rollOrEmail);
  return Boolean(account && password === account.password);
}

export function validateDemoParentLogin(email: string, password: string) {
  const account = getParentAccountByEmail(email);
  if (!account || password !== account.password) return null;
  return account;
}

export function listDemoStudentRolls(): string[] {
  return DEMO_STUDENT_ACCOUNTS.map((s) => s.rollNumber);
}

export function listDemoParentEmails(): string[] {
  return DEMO_PARENT_ACCOUNTS.map((p) => p.email);
}
