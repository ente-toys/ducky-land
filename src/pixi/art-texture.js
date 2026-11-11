// Island art is rasterized for the closest zoom on a 2x screen, so at normal
// zoom a sprite is drawn several times smaller than its texture. Without
// mipmaps, linear filtering skips texels: thin outlines alias, and every
// sub-pixel camera move picks different texels, so edges crawl back and forth.
// Mipmapped (trilinear) sampling averages them and keeps outlines steady.
// Use for static art only: not for canvases redrawn every frame, cell atlases,
// or data textures that shaders read directly.
export const ART_TEXTURE = {autoGenerateMipmaps: true};
