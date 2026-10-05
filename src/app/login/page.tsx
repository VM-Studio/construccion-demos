import type { Metadata } from "next";
import { LoginView } from "@/components/modulos/login-view";

export const metadata: Metadata = { title: "Ingresar" };

export default function LoginPage() {
  return <LoginView />;
}
