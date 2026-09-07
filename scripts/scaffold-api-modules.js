const fs = require("fs");
const path = require("path");

const modules = [
  {
    name: "auth",
    desc: "Authentication, OTP verification, session management & Supabase Auth integration",
  },
  {
    name: "users",
    desc: "User profile management, role verification, and account settings",
  },
  {
    name: "workers",
    desc: "Worker skill profiles, service radius, hourly rates, and work history",
  },
  {
    name: "providers",
    desc: "Job provider/employer profiles, verification status, and business details",
  },
  {
    name: "agents",
    desc: "Assisted onboarding, local agent management for low-digital-literacy workers",
  },
  {
    name: "jobs",
    desc: "Job postings, requirement specifications, and lifecycle management",
  },
  {
    name: "tasks",
    desc: "Micro-tasks and short-duration work assignment definitions",
  },
  {
    name: "availability",
    desc: "Available-Now status toggling, schedule windows, and active radius",
  },
  {
    name: "location",
    desc: "Hyperlocal spatial queries, PostGIS integration, and proximity calculations",
  },
  {
    name: "matching",
    desc: "Multi-factor explainable ranking engine (Skill, Distance, Availability, Rating)",
  },
  {
    name: "applications",
    desc: "Worker job applications, invitations, and status tracking",
  },
  {
    name: "assignments",
    desc: "Active job assignments, arrival confirmations, and task execution lifecycle",
  },
  {
    name: "notifications",
    desc: "Multi-channel notifications (in-app, SMS, push alerts)",
  },
  {
    name: "verification",
    desc: "Identity checks, document uploads, and trust badge verifications",
  },
  {
    name: "reviews",
    desc: "Post-assignment ratings, feedback, and two-sided reputation records",
  },
  {
    name: "payments",
    desc: "Wage records, daily payouts, transaction logs, and receipt tracking",
  },
  {
    name: "disputes",
    desc: "Issue reporting, arbitration workflows, and assignment conflict resolution",
  },
  {
    name: "admin",
    desc: "Platform oversight, user moderation, dispute resolution, and audit monitoring",
  },
];

const modulesDir = path.join(
  __dirname,
  "..",
  "services",
  "api",
  "src",
  "modules",
);

modules.forEach(({ name, desc }) => {
  const dir = path.join(modulesDir, name);
  fs.mkdirSync(dir, { recursive: true });

  const pascalName = name.charAt(0).toUpperCase() + name.slice(1);

  // types.ts
  const typesContent = `/**
 * ${pascalName} Module - Types & Contracts
 * ${desc}
 */

export interface I${pascalName}State {
  module: '${name}';
  status: 'initialized';
  description: string;
}
`;
  fs.writeFileSync(path.join(dir, "types.ts"), typesContent, "utf8");

  // service.ts
  const serviceContent = `/**
 * ${pascalName} Service
 * ${desc}
 */

import { I${pascalName}State } from './types';

export class ${pascalName}Service {
  public async getStatus(): Promise<I${pascalName}State> {
    return {
      module: '${name}',
      status: 'initialized',
      description: '${desc}'
    };
  }
}

export const ${name}Service = new ${pascalName}Service();
`;
  fs.writeFileSync(path.join(dir, "service.ts"), serviceContent, "utf8");

  // controller.ts
  const controllerContent = `/**
 * ${pascalName} Controller
 * ${desc}
 */

import { Request, Response, NextFunction } from 'express';
import { ${name}Service } from './service';
import { ApiSuccessResponse } from '@nearvia/config';

export class ${pascalName}Controller {
  public async getStatus(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const status = await ${name}Service.getStatus();
      const response: ApiSuccessResponse = {
        success: true,
        data: status
      };
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }
}

export const ${name}Controller = new ${pascalName}Controller();
`;
  fs.writeFileSync(path.join(dir, "controller.ts"), controllerContent, "utf8");

  // routes.ts
  const routesContent = `/**
 * ${pascalName} Routes
 * ${desc}
 */

import { Router } from 'express';
import { ${name}Controller } from './controller';

const router = Router();

router.get('/status', (req, res, next) => ${name}Controller.getStatus(req, res, next));

export const ${name}Router: Router = router;
`;
  fs.writeFileSync(path.join(dir, "routes.ts"), routesContent, "utf8");

  // index.ts
  const indexContent = `/**
 * ${pascalName} Module Exports
 */

export * from './types';
export * from './service';
export * from './controller';
export * from './routes';
`;
  fs.writeFileSync(path.join(dir, "index.ts"), indexContent, "utf8");
});

console.log(
  `Successfully scaffolded all ${modules.length} API domain modules.`,
);
