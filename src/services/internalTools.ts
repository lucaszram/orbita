/**
 * Superficies internas (Studio, Lab, backoffice) fuera del sitio público.
 *
 * El backend ya falla cerrado en producción: `publicLab` rechaza aunque se
 * conozca la URL y backoffice/Studio exigen identidad Clerk allowlisteada. Este
 * flag es la otra mitad — que la web publicada ni siquiera rutee a esas
 * pantallas — para no publicar un shell interno que cualquiera pueda tantear.
 *
 * Apagado salvo que se pida explícitamente. Un deploy que se olvida de setear
 * la variable queda cerrado, no abierto.
 */
export const INTERNAL_TOOLS_ENABLED = process.env.EXPO_PUBLIC_ORBITA_INTERNAL_TOOLS === "true";
