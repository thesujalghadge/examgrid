"use client";
import { useEffect, useState } from "react";
import { createSupabaseClientFromEnv } from "@/lib/supabase/client";

export default function TestPage() {
  const [data, setData] = useState<any>(null);
  
  useEffect(() => {
    const client = createSupabaseClientFromEnv();
    if (!client) {
      setData("Client is null!");
      return;
    }
    client
      .from("students")
      .select("*")
      .eq("institute_id", "ac31a186-71a7-4e99-8938-f1c98ec5c972")
      .then((res) => {
        const envKeys = { url: process.env.NEXT_PUBLIC_SUPABASE_URL, anon: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.substring(0, 10) };
        if (res.error) {
           setData("Error: " + res.error.message + " env: " + JSON.stringify(envKeys));
        } else {
           setData(res.data?.length + " env: " + JSON.stringify(envKeys));
        }
      })
      .catch((err) => setData("Catch: " + err.message));
  }, []);
  
  return <div>Students: {data !== null ? data : "Loading..."}</div>;
}
