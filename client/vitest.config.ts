import { defineConfig } from 'vitest/config';

// Config de Vitest acotada a los contract tests del consumidor.
// Corren en Node (no jsdom): son llamadas fetch contra el mock server de Pact.
export default defineConfig({
  test: {
    include: ['contract/**/*.test.ts'],
    environment: 'node',
    // Pact levanta un binario nativo; dale aire al arranque y a la verificación.
    testTimeout: 30000,
    hookTimeout: 30000,
  },
});
