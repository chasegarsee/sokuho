"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";

export default function DashboardPage() {
  const router = useRouter();
  const { user, isLoading } = useAuth();

  useEffect(() => {
    if (!isLoading && !user) {
      router.replace("/");
    }
  }, [isLoading, user, router]);

  if (isLoading) return <main className="container"><p>Loading...</p></main>;
  if (!user) return null;

  return (
    <main className="container">
      <h1>Dashboard</h1>
      <p>UID: {user.uid}</p>
    </main>
  );
}


