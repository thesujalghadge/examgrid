import { useState, useEffect } from "react";
import { getPlatformInstitute } from "@/lib/platform-institute-registry";

export function useInstituteName(instituteId: string | undefined): string {
  const [name, setName] = useState<string>("Institute");

  useEffect(() => {
    if (!instituteId) {
      setName("Institute");
      return;
    }
    let isMounted = true;
    getPlatformInstitute(instituteId).then(inst => {
      if (isMounted) {
        setName(inst?.name ?? instituteId);
      }
    });
    return () => {
      isMounted = false;
    };
  }, [instituteId]);

  return name;
}
