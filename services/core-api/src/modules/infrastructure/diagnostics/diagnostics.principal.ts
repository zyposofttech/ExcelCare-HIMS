export type Principal = {
  userId?: string;
  roleCode?: string | null;
  roleScope?: "GLOBAL" | "BRANCH" | null;
  branchId?: string | null;
  permissions?: string[];
};
