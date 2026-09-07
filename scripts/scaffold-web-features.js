const fs = require("fs");
const path = require("path");

const webSrc = path.join(__dirname, "..", "apps", "web", "src");

// Component directories
const componentDirs = ["ui", "layout", "forms", "feedback"];
componentDirs.forEach((dir) => {
  const fullPath = path.join(webSrc, "components", dir);
  fs.mkdirSync(fullPath, { recursive: true });
  fs.writeFileSync(
    path.join(fullPath, "index.ts"),
    `/**\n * ${dir.toUpperCase()} Components\n */\nexport {};\n`,
    "utf8",
  );
});

// Feature directories
const features = [
  {
    name: "auth",
    desc: "Authentication forms, OTP login, and user session management",
  },
  {
    name: "workers",
    desc: "Worker profile presentation, skills badge display, and ratings",
  },
  {
    name: "providers",
    desc: "Job provider business profiles and verification badges",
  },
  {
    name: "agents",
    desc: "Assisted onboarding portal for verified local agents",
  },
  { name: "jobs", desc: "Job card presentation, posting views, and details" },
  { name: "tasks", desc: "Micro-task card views and quick shift listings" },
  {
    name: "availability",
    desc: "Available-Now status toggle switch and schedule selector",
  },
  {
    name: "location",
    desc: "Hyperlocal 5 km map viewer and distance radius picker",
  },
  {
    name: "matching",
    desc: "Transparent match breakdown and recommendation rankings",
  },
  {
    name: "applications",
    desc: "Worker application status tracking and provider review list",
  },
  {
    name: "assignments",
    desc: "Active shift progress, arrival tracker, and completion confirmation",
  },
  { name: "notifications", desc: "Notification bell drawer and alert list" },
  { name: "verification", desc: "Trust badge and identity document status" },
  {
    name: "reviews",
    desc: "Two-sided review submission and star rating displays",
  },
  {
    name: "disputes",
    desc: "Issue reporting dialogue and resolution tracking",
  },
  { name: "admin", desc: "Platform oversight and moderation consoles" },
];

features.forEach(({ name, desc }) => {
  const featureDir = path.join(webSrc, "features", name);
  fs.mkdirSync(featureDir, { recursive: true });

  fs.writeFileSync(
    path.join(featureDir, "types.ts"),
    `/**\n * Web Feature Types: ${name}\n * ${desc}\n */\nexport interface I${name.charAt(0).toUpperCase() + name.slice(1)}FeatureState {\n  initialized: boolean;\n}\n`,
    "utf8",
  );

  fs.writeFileSync(
    path.join(featureDir, "index.ts"),
    `/**\n * Feature: ${name}\n * ${desc}\n */\nexport * from './types';\n`,
    "utf8",
  );
});

// Core supporting directories
const otherDirs = [
  "pages",
  "hooks",
  "services",
  "lib",
  "routes",
  "types",
  "utils",
];
otherDirs.forEach((dir) => {
  const fullPath = path.join(webSrc, dir);
  fs.mkdirSync(fullPath, { recursive: true });
  fs.writeFileSync(
    path.join(fullPath, "index.ts"),
    `/**\n * ${dir.toUpperCase()} Module Entry Point\n */\nexport {};\n`,
    "utf8",
  );
});

console.log(
  "Successfully scaffolded web features, components, and supporting directories.",
);
