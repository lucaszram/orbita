// Wrapper de ruta. Metro resuelve por plataforma: nativo → el hub de la carta
// (src/routes/v492/perfil-index.tsx); web → el Perfil administrativo de siempre
// (perfil-index.web.tsx). La pestaña se llama "Tu carta"; el name sigue siendo
// `perfil` para no mover la URL web ni los redirects.
export { default } from "@/routes/v492/perfil-index";
