export type PlatformInstituteStatus = "active" | "inactive";

export interface PlatformInstitute {
  id: string;
  name: string;
  city: string;
  adminEmail: string;
  plan: string;
  status: PlatformInstituteStatus;
  createdAt: number;
  updatedAt: number;
}
