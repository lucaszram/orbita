// Wrapper de ruta. Metro resuelve la implementación por plataforma:
// nativo → src/routes/v492/perfil-ajustes.tsx (detalle con ← y el cuerpo
// administrativo); web → perfil-ajustes.web.tsx (redirect a /perfil).
export { default } from "@/routes/v492/perfil-ajustes";
