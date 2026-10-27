// Wind: grass blades and treetops sway a little. One shared clock drives every
// swaying material; Game advances `windTime.value` each frame.
export const windTime = { value: 0 };

// Bends vertices above height `from` (model units); higher parts move more.
// Works for normal and instanced meshes (each instance sways at its own phase).
export function addWind(material, { from = 0.3, amount = 0.05 } = {}) {
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uWindTime = windTime;
    shader.vertexShader = `uniform float uWindTime;\n${shader.vertexShader}`.replace(
      '#include <begin_vertex>',
      `#include <begin_vertex>
      #ifdef USE_INSTANCING
        vec2 windAt = instanceMatrix[3].xz;
      #else
        vec2 windAt = vec2(0.0);
      #endif
      float windBend = max(0.0, position.y - ${from.toFixed(2)});
      float gust = 0.7 + 0.3 * sin(uWindTime * 0.35 + windAt.x * 0.05);
      transformed.x += sin(uWindTime * 1.7 + windAt.x * 0.35 + windAt.y * 0.2) * ${amount.toFixed(3)} * windBend * gust;
      transformed.z += cos(uWindTime * 1.3 + windAt.x * 0.25 - windAt.y * 0.3) * ${(amount * 0.6).toFixed(3)} * windBend * gust;`,
    );
  };
  material.customProgramCacheKey = () => `wind-${from}-${amount}`;
  return material;
}
