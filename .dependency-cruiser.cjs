/**
 * Regras de dependência entre camadas e módulos (docs/SOFTWARE_ARCHITECTURE.md §3.1).
 * @type {import('dependency-cruiser').IConfiguration}
 */
module.exports = {
  forbidden: [
    {
      name: "no-circular",
      severity: "error",
      comment: "Ciclos de dependência são proibidos.",
      from: {},
      to: { circular: true },
    },
    {
      name: "domain-is-pure",
      severity: "error",
      comment: "O domínio não depende de framework, ORM, infraestrutura ou de outras camadas.",
      from: { path: "^src/(modules/[^/]+|shared)/domain/" },
      to: {
        path: [
          "^src/(modules/[^/]+|shared)/(application|infrastructure|ui)/",
          "^src/(lib|app|generated)/",
          "node_modules/(next|react|react-dom|@prisma|better-auth|pg|resend|nodemailer)/",
        ],
      },
    },
    {
      name: "module-public-api",
      severity: "error",
      comment: "Entre módulos, importar apenas o index.ts público ou o domain/ (vocabulário compartilhado).",
      from: { path: "^src/modules/([^/]+)/" },
      to: {
        path: "^src/modules/([^/]+)/",
        pathNot: ["^src/modules/$1/", "^src/modules/[^/]+/index\\.ts$", "^src/modules/[^/]+/domain/"],
      },
    },
    {
      name: "invoices-is-core",
      severity: "error",
      comment: "O módulo invoices é o núcleo e não depende de outros módulos.",
      from: { path: "^src/modules/invoices/" },
      to: { path: "^src/modules/(?!invoices/)" },
    },
    {
      name: "application-not-ui",
      severity: "error",
      comment: "Casos de uso não dependem da camada de entrega.",
      from: { path: "^src/(modules/[^/]+|shared)/application/" },
      to: { path: ["^src/(modules/[^/]+|shared)/ui/", "^src/app/", "^src/lib/"] },
    },
  ],
  options: {
    doNotFollow: { path: "node_modules" },
    exclude: { path: ["src/generated", "\\.test\\.ts$"] },
    tsConfig: { fileName: "tsconfig.json" },
    tsPreCompilationDeps: true,
    enhancedResolveOptions: {
      exportsFields: ["exports"],
      conditionNames: ["import", "require", "node", "default"],
    },
  },
};
