import { describe, it, expect, beforeAll, vi } from "vitest";
import request from "supertest";
import express, { Express, Request, Response } from "express";
import { UserRole, VerificationStatus } from "@nearvia/types";
import { errorHandler } from "../src/middleware";
import { verificationRouter } from "../src/modules/verification";
import { adminRouter } from "../src/modules/admin";
import { storageService } from "../src/services/storage.service";
import { adminService } from "../src/modules/admin/service";
import { verificationService } from "../src/modules/verification/service";
import * as dbModule from "../src/db";

import { AppError } from "../src/middleware/errorHandler";
import { ErrorCode } from "@nearvia/config";
import * as supabaseService from "../src/services/supabase.service";

let currentUser: any = null;

vi.mock("../src/utils/audit", () => ({
  logAuditEvent: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../src/middleware/auth.middleware", () => ({
  authenticateUser: (req: any, _res: any, next: any) => {
    if (!req.headers.authorization) {
      return next(new AppError("Authentication required. Missing Bearer token.", 401, ErrorCode.UNAUTHORIZED));
    }
    req.user = currentUser;
    next();
  },
  requireRole: (...roles: any[]) => (req: any, _res: any, next: any) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return next(new AppError("Access denied.", 403, ErrorCode.FORBIDDEN));
    }
    next();
  },
}));

describe("NearVia KYC Verification Hardening & Safeguards", () => {
  let app: Express;

  const mockAdminUser = {
    id: "a0000000-0000-0000-0000-000000000001",
    email: "admin.kyc@nearvia.in",
    role: UserRole.ADMIN,
    full_name: "Admin Reviewer",
  };

  const mockWorkerUser = {
    id: "w0000000-0000-0000-0000-000000000001",
    email: "ramesh.worker@gmail.com",
    role: UserRole.WORKER,
    full_name: "Ramesh Kumar",
  };

  const mockTestFixtureUser = {
    id: "f0000000-0000-0000-0000-000000000001",
    email: "demo.worker@nearvia.test",
    role: UserRole.WORKER,
    full_name: "Demo Test Worker",
  };

  beforeAll(() => {
    currentUser = mockWorkerUser;
    app = express();
    app.use(express.json());

    app.use("/api/v1/verification", verificationRouter);
    app.use("/api/v1/admin", adminRouter);
    app.use(errorHandler);
  });

  describe("1. Upload Validation & Private Storage", () => {
    it("accepts valid image/jpeg, image/png and application/pdf files up to 5MB", () => {
      expect(storageService.validateKycUpload("aadhaar_front.jpg", "image/jpeg", 2 * 1024 * 1024).isValid).toBe(true);
      expect(storageService.validateKycUpload("pan_card.png", "image/png", 1024 * 1024).isValid).toBe(true);
      expect(storageService.validateKycUpload("voter_id.pdf", "application/pdf", 4.5 * 1024 * 1024).isValid).toBe(true);
    });

    it("rejects dangerous or disallowed MIME types (e.g. executables, scripts, html)", () => {
      expect(storageService.validateKycUpload("payload.exe", "application/x-msdownload", 1024).isValid).toBe(false);
      expect(storageService.validateKycUpload("script.js", "application/javascript", 1024).isValid).toBe(false);
      expect(storageService.validateKycUpload("doc.svg", "image/svg+xml", 1024).isValid).toBe(false);
      expect(storageService.validateKycUpload("page.html", "text/html", 1024).isValid).toBe(false);
    });

    it("rejects files exceeding 5MB size limit or zero-byte files", () => {
      expect(storageService.validateKycUpload("large_doc.pdf", "application/pdf", 6 * 1024 * 1024).isValid).toBe(false);
      expect(storageService.validateKycUpload("empty.jpg", "image/jpeg", 0).isValid).toBe(false);
    });

    it("generates deterministic, unguessable storage paths scoped to user ID", () => {
      const path = storageService.generateKycStoragePath(mockWorkerUser.id, "my_document.pdf");
      expect(path).toMatch(new RegExp(`^kyc/${mockWorkerUser.id}/[a-f0-9-]+\\.pdf$`));
      expect(path).not.toContain("..");
      expect(path).not.toContain("my_document");
    });

    it("rejects zero-byte files directly in createKycUploadUrl", async () => {
      await expect(
        storageService.createKycUploadUrl(mockWorkerUser.id, "image/jpeg", "empty.jpg", 0)
      ).rejects.toThrow(/File cannot be empty/);
    });

    it("rejects oversized files exceeding 5MB directly in createKycUploadUrl", async () => {
      await expect(
        storageService.createKycUploadUrl(mockWorkerUser.id, "image/jpeg", "huge.jpg", 6 * 1024 * 1024)
      ).rejects.toThrow(/File exceeds the 5MB maximum limit/);
    });

    it("accepts valid file size in createKycUploadUrl and returns upload parameters", async () => {
      const result = await storageService.createKycUploadUrl(
        mockWorkerUser.id,
        "image/jpeg",
        "valid.jpg",
        2 * 1024 * 1024
      );
      expect(result.uploadUrl).toBeDefined();
      expect(result.storagePath).toContain(`kyc/${mockWorkerUser.id}/`);
      expect(result.expiresInSeconds).toBe(300);
    });

    it("generates 60-second time-bounded signed URLs for previewing documents when Supabase succeeds", async () => {
      const mockStoragePath = `kyc/${mockWorkerUser.id}/test-doc-123.jpg`;
      const mockSignedUrl = `https://supabase.co/storage/v1/object/sign/kyc-documents/${mockStoragePath}?token=valid-jwt-token`;
      vi.spyOn(supabaseService, "getSupabaseAdminClient").mockReturnValueOnce({
        storage: {
          from: vi.fn().mockReturnValue({
            createSignedUrl: vi.fn().mockResolvedValue({
              data: { signedUrl: mockSignedUrl },
              error: null,
            }),
          }),
        },
      } as any);

      const signedResult = await storageService.createKycPreviewUrl(mockStoragePath, null, 60);
      expect(signedResult.previewUrl).toBe(mockSignedUrl);
      expect(signedResult.isMissing).toBe(false);
      expect(signedResult.expiresInSeconds).toBe(60);
    });

    it("returns isMissing: true and null previewUrl when Supabase reports object not found (no fake fallback)", async () => {
      const mockStoragePath = `kyc/${mockWorkerUser.id}/missing-doc.jpg`;
      vi.spyOn(supabaseService, "getSupabaseAdminClient").mockReturnValueOnce({
        storage: {
          from: vi.fn().mockReturnValue({
            createSignedUrl: vi.fn().mockResolvedValue({
              data: null,
              error: { message: "Object not found" },
            }),
          }),
        },
      } as any);

      const result = await storageService.createKycPreviewUrl(mockStoragePath, null, 60);
      expect(result.previewUrl).toBeNull();
      expect(result.isMissing).toBe(true);
      expect(result.error).toContain("Object not found");
    });

    it("returns isMissing: true and null previewUrl when signed-URL generation fails or throws", async () => {
      const mockStoragePath = `kyc/${mockWorkerUser.id}/error-doc.jpg`;
      vi.spyOn(supabaseService, "getSupabaseAdminClient").mockReturnValueOnce({
        storage: {
          from: vi.fn().mockReturnValue({
            createSignedUrl: vi.fn().mockRejectedValue(new Error("Supabase internal storage failure")),
          }),
        },
      } as any);

      const result = await storageService.createKycPreviewUrl(mockStoragePath, null, 60);
      expect(result.previewUrl).toBeNull();
      expect(result.isMissing).toBe(true);
      expect(result.error).toContain("Supabase internal storage failure");
    });
  });

  describe("1b. Direct Storage Object Existence Verification (storageService.verifyObjectExists)", () => {
    it("returns true when Supabase confirms the exact object exists in the kyc-documents bucket", async () => {
      const targetFileName = "valid_aadhaar.jpg";
      const validPath = `kyc/${mockWorkerUser.id}/${targetFileName}`;
      vi.spyOn(supabaseService, "getSupabaseAdminClient").mockReturnValueOnce({
        storage: {
          from: vi.fn().mockImplementation((bucket: string) => {
            expect(bucket).toBe("kyc-documents");
            return {
              list: vi.fn().mockImplementation((folder: string, opts: any) => {
                expect(folder).toBe(`kyc/${mockWorkerUser.id}`);
                expect(opts.search).toBe(targetFileName);
                return Promise.resolve({
                  data: [{ name: targetFileName, id: "obj-1" }],
                  error: null,
                });
              }),
            };
          }),
        },
      } as any);

      const exists = await storageService.verifyObjectExists(validPath);
      expect(exists).toBe(true);
    });

    it("returns false when Supabase storage listing is empty (object missing)", async () => {
      const validPath = `kyc/${mockWorkerUser.id}/missing_aadhaar.jpg`;
      vi.spyOn(supabaseService, "getSupabaseAdminClient").mockReturnValueOnce({
        storage: {
          from: vi.fn().mockReturnValue({
            list: vi.fn().mockResolvedValue({
              data: [],
              error: null,
            }),
          }),
        },
      } as any);

      const exists = await storageService.verifyObjectExists(validPath);
      expect(exists).toBe(false);
    });

    it("returns false when storage folder contains similar but non-matching filenames", async () => {
      const validPath = `kyc/${mockWorkerUser.id}/target_doc.png`;
      vi.spyOn(supabaseService, "getSupabaseAdminClient").mockReturnValueOnce({
        storage: {
          from: vi.fn().mockReturnValue({
            list: vi.fn().mockResolvedValue({
              data: [
                { name: "target_doc.png.bak" },
                { name: "other_target_doc.png" },
                { name: "target_doc" },
              ],
              error: null,
            }),
          }),
        },
      } as any);

      const exists = await storageService.verifyObjectExists(validPath);
      expect(exists).toBe(false);
    });

    it("returns false when Supabase storage returns an API error", async () => {
      const validPath = `kyc/${mockWorkerUser.id}/error_doc.jpg`;
      vi.spyOn(supabaseService, "getSupabaseAdminClient").mockReturnValueOnce({
        storage: {
          from: vi.fn().mockReturnValue({
            list: vi.fn().mockResolvedValue({
              data: null,
              error: { message: "Access denied to private bucket" },
            }),
          }),
        },
      } as any);

      const exists = await storageService.verifyObjectExists(validPath);
      expect(exists).toBe(false);
    });

    it("returns false when Supabase storage throws a network or client exception", async () => {
      const validPath = `kyc/${mockWorkerUser.id}/exception_doc.jpg`;
      vi.spyOn(supabaseService, "getSupabaseAdminClient").mockReturnValueOnce({
        storage: {
          from: vi.fn().mockReturnValue({
            list: vi.fn().mockRejectedValue(new Error("Supabase network timeout")),
          }),
        },
      } as any);

      const exists = await storageService.verifyObjectExists(validPath);
      expect(exists).toBe(false);
    });

    it("returns false when Supabase admin credentials are unavailable (getSupabaseAdminClient is null)", async () => {
      const validPath = `kyc/${mockWorkerUser.id}/no_creds_doc.jpg`;
      vi.spyOn(supabaseService, "getSupabaseAdminClient").mockReturnValueOnce(null);

      const exists = await storageService.verifyObjectExists(validPath);
      expect(exists).toBe(false);
    });

    it("returns false for invalid paths and traversal attempts without calling Supabase", async () => {
      expect(await storageService.verifyObjectExists("")).toBe(false);
      expect(await storageService.verifyObjectExists("outside_bucket/file.jpg")).toBe(false);
      expect(await storageService.verifyObjectExists(`kyc/${mockWorkerUser.id}/../escaped.jpg`)).toBe(false);
      expect(await storageService.verifyObjectExists("kyc/")).toBe(false);
    });
  });

  describe("2. API Upload URL Endpoint", () => {
    it("rejects unauthenticated requests without Bearer token", async () => {
      const res = await request(app)
        .post("/api/v1/verification/upload-url")
        .send({
          fileName: "aadhaar_front.jpg",
          fileType: "image/jpeg",
          fileSize: 1024,
        });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it("returns signed upload URL and storage path for valid upload request", async () => {
      currentUser = mockWorkerUser;
      vi.spyOn(dbModule, "query").mockResolvedValueOnce({
        rowCount: 1,
        rows: [{ id: "wp-mock-id" }],
      } as any);

      const res = await request(app)
        .post("/api/v1/verification/upload-url")
        .set("Authorization", "Bearer valid.mock.token")
        .send({
          fileName: "aadhaar_front.jpg",
          fileType: "image/jpeg",
          fileSize: 1.5 * 1024 * 1024,
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.uploadUrl).toBeDefined();
      expect(res.body.data.storagePath).toMatch(new RegExp(`^kyc/${mockWorkerUser.id}/[a-f0-9-]+_aadhaar_front\\.jpg$`));
    });

    it("rejects upload URL request with invalid mime type", async () => {
      currentUser = mockWorkerUser;
      vi.spyOn(dbModule, "query").mockResolvedValueOnce({
        rowCount: 1,
        rows: [{ id: "wp-mock-id" }],
      } as any);

      const res = await request(app)
        .post("/api/v1/verification/upload-url")
        .set("Authorization", "Bearer valid.mock.token")
        .send({
          fileName: "malware.exe",
          fileType: "application/x-dosexec",
          fileSize: 1024,
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });

  describe("2b. Document Ownership Scoping on Submission", () => {
    it("rejects submission when storage path belongs to a different user (cross-user path)", async () => {
      currentUser = mockWorkerUser;
      vi.spyOn(dbModule, "query").mockImplementation(async (sql: string) => {
        if (sql.includes("worker_profiles")) {
          return { rowCount: 1, rows: [{ id: "wp-mock" }] } as any;
        }
        return { rowCount: 0, rows: [] } as any;
      });

      const res = await request(app)
        .post("/api/v1/verification/submit")
        .set("Authorization", "Bearer valid.mock.token")
        .send({
          targetType: "WORKER",
          verificationType: "GOVERNMENT_ID",
          storagePath: "kyc/someone-else-uuid/aadhaar.jpg",
        });

      expect(res.status).toBe(400);
      expect(res.body.error.message).toContain("scoped to authenticated user");
    });

    it("rejects submission when storage path contains directory traversal", async () => {
      currentUser = mockWorkerUser;
      vi.spyOn(dbModule, "query").mockImplementation(async (sql: string) => {
        if (sql.includes("worker_profiles")) {
          return { rowCount: 1, rows: [{ id: "wp-mock" }] } as any;
        }
        return { rowCount: 0, rows: [] } as any;
      });

      const res = await request(app)
        .post("/api/v1/verification/submit")
        .set("Authorization", "Bearer valid.mock.token")
        .send({
          targetType: "WORKER",
          verificationType: "GOVERNMENT_ID",
          storagePath: `kyc/${mockWorkerUser.id}/../escape.jpg`,
        });

      expect(res.status).toBe(400);
    });

    it("accepts submission with properly scoped user storage path", async () => {
      currentUser = mockWorkerUser;
      const validStoragePath = `kyc/${mockWorkerUser.id}/genuine_aadhaar.jpg`;
      vi.spyOn(dbModule, "query").mockImplementation(async (sql: string) => {
        if (sql.includes("worker_profiles")) {
          return { rowCount: 1, rows: [{ id: "wp-mock" }] } as any;
        }
        if (sql.includes("information_schema")) {
          return { rowCount: 1, rows: [{ count: "1" }] } as any;
        }
        if (sql.includes("INSERT INTO verifications")) {
          return {
            rowCount: 1,
            rows: [
              {
                id: "new-verif-123",
                target_type: "WORKER",
                target_id: mockWorkerUser.id,
                verification_type: "GOVERNMENT_ID",
                document_ref: validStoragePath,
                storage_path: validStoragePath,
                status: "PENDING",
                submitted_at: new Date().toISOString(),
              },
            ],
          } as any;
        }
        return { rowCount: 0, rows: [] } as any;
      });

      const res = await request(app)
        .post("/api/v1/verification/submit")
        .set("Authorization", "Bearer valid.mock.token")
        .send({
          targetType: "WORKER",
          verificationType: "GOVERNMENT_ID",
          storagePath: validStoragePath,
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.storagePath).toBe(validStoragePath);
    });
  });

  describe("3. Test Fixture & Fake Document Guard", () => {
    it("blocks approval of test fixture users (@nearvia.test)", async () => {
      vi.spyOn(dbModule, "withTransaction").mockImplementation(async (callback: any) => {
        const mockClient = {
          query: vi.fn().mockImplementation(async (sql: string) => {
            if (sql.includes("FROM verifications")) {
              return {
                rows: [
                  {
                    id: "c0000000-0000-0000-0000-000000000004",
                    target_id: mockTestFixtureUser.id,
                    target_type: "WORKER",
                    verification_type: "GOVERNMENT_ID",
                    document_ref: "DOC_HASH_AADHAAR_9812",
                    status: "PENDING",
                    user_email: mockTestFixtureUser.email,
                  },
                ],
              };
            }
            return { rows: [] };
          }),
        };
        return await callback(mockClient);
      });

      await expect(
        adminService.approveVerification(mockAdminUser.id, "c0000000-0000-0000-0000-000000000004", { notes: "Trying to approve fixture" })
      ).rejects.toThrow(/Test fixtures and synthetic references/);
    });

    it("blocks approval of submissions with legacy DOC_HASH placeholders", async () => {
      vi.spyOn(dbModule, "withTransaction").mockImplementation(async (callback: any) => {
        const mockClient = {
          query: vi.fn().mockImplementation(async (sql: string) => {
            if (sql.includes("FROM verifications")) {
              return {
                rows: [
                  {
                    id: "c0000000-0000-0000-0000-000000000005",
                    target_id: mockWorkerUser.id,
                    target_type: "WORKER",
                    verification_type: "GOVERNMENT_ID",
                    document_ref: "DOC_HASH_AADHAAR_9812",
                    status: "PENDING",
                    user_email: mockWorkerUser.email,
                  },
                ],
              };
            }
            return { rows: [] };
          }),
        };
        return await callback(mockClient);
      });

      await expect(
        adminService.approveVerification(mockAdminUser.id, "c0000000-0000-0000-0000-000000000005", { notes: "Approving dummy hash" })
      ).rejects.toThrow(/Test fixtures and synthetic references/);
    });

    it("blocks approval if no genuine document has been uploaded", async () => {
      vi.spyOn(dbModule, "withTransaction").mockImplementation(async (callback: any) => {
        const mockClient = {
          query: vi.fn().mockImplementation(async (sql: string) => {
            if (sql.includes("FROM verifications")) {
              return {
                rows: [
                  {
                    id: "c0000000-0000-0000-0000-000000000006",
                    target_id: mockWorkerUser.id,
                    target_type: "WORKER",
                    verification_type: "GOVERNMENT_ID",
                    document_ref: "UNKNOWN_REF",
                    storage_path: null,
                    status: "PENDING",
                    user_email: mockWorkerUser.email,
                  },
                ],
              };
            }
            return { rows: [] };
          }),
        };
        return await callback(mockClient);
      });

      await expect(
        adminService.approveVerification(mockAdminUser.id, "c0000000-0000-0000-0000-000000000006", { notes: "Approving missing doc" })
      ).rejects.toThrow(/No genuine document has been uploaded for review/);
    });

    it("blocks approval of PROVIDER verification if no genuine document or storage path exists (no provider exemption)", async () => {
      vi.spyOn(dbModule, "withTransaction").mockImplementation(async (callback: any) => {
        const mockClient = {
          query: vi.fn().mockImplementation(async (sql: string) => {
            if (sql.includes("FROM verifications")) {
              return {
                rows: [
                  {
                    id: "c0000000-0000-0000-0000-000000000099",
                    target_id: "c0000000-0000-0000-0000-000000000010",
                    target_type: "PROVIDER",
                    verification_type: "BUSINESS_REGISTRATION",
                    document_ref: null,
                    storage_path: null,
                    status: "PENDING",
                    user_email: "genuine.provider@example.com",
                  },
                ],
              };
            }
            return { rows: [] };
          }),
        };
        return await callback(mockClient);
      });

      await expect(
        adminService.approveVerification(mockAdminUser.id, "c0000000-0000-0000-0000-000000000099", { notes: "Trying to approve doc-less provider" })
      ).rejects.toThrow(/No genuine document has been uploaded for review/);
    });

    it("blocks approval when storage path belongs to a different user (cross-user path)", async () => {
      vi.spyOn(dbModule, "withTransaction").mockImplementation(async (callback: any) => {
        const mockClient = {
          query: vi.fn().mockImplementation(async (sql: string) => {
            if (sql.includes("FROM verifications")) {
              return {
                rows: [
                  {
                    id: "c0000000-0000-0000-0000-000000000100",
                    target_id: mockWorkerUser.id,
                    target_type: "WORKER",
                    verification_type: "GOVERNMENT_ID",
                    document_ref: "kyc/victim-other-user/stolen_aadhaar.jpg",
                    storage_path: "kyc/victim-other-user/stolen_aadhaar.jpg",
                    status: "PENDING",
                    user_email: mockWorkerUser.email,
                  },
                ],
              };
            }
            return { rows: [] };
          }),
        };
        return await callback(mockClient);
      });

      await expect(
        adminService.approveVerification(mockAdminUser.id, "c0000000-0000-0000-0000-000000000100", { notes: "Trying to approve cross user doc" })
      ).rejects.toThrow(/No genuine document has been uploaded for review/);
    });

    it("blocks approval when document_ref is a fake filename with dot (weak heuristic removed)", async () => {
      vi.spyOn(dbModule, "withTransaction").mockImplementation(async (callback: any) => {
        const mockClient = {
          query: vi.fn().mockImplementation(async (sql: string) => {
            if (sql.includes("FROM verifications")) {
              return {
                rows: [
                  {
                    id: "c0000000-0000-0000-0000-000000000101",
                    target_id: mockWorkerUser.id,
                    target_type: "WORKER",
                    verification_type: "GOVERNMENT_ID",
                    document_ref: "fabricated_aadhaar_front.jpg",
                    storage_path: null,
                    status: "PENDING",
                    user_email: mockWorkerUser.email,
                  },
                ],
              };
            }
            return { rows: [] };
          }),
        };
        return await callback(mockClient);
      });

      await expect(
        adminService.approveVerification(mockAdminUser.id, "c0000000-0000-0000-0000-000000000101", { notes: "Trying to approve fake filename" })
      ).rejects.toThrow(/No genuine document has been uploaded for review/);
    });

    it("blocks approval when document object does not exist in storage", async () => {
      const validPath = `kyc/${mockWorkerUser.id}/missing_aadhaar.jpg`;
      vi.spyOn(storageService, "verifyObjectExists").mockResolvedValueOnce(false);

      vi.spyOn(dbModule, "withTransaction").mockImplementation(async (callback: any) => {
        const mockClient = {
          query: vi.fn().mockImplementation(async (sql: string) => {
            if (sql.includes("FROM verifications")) {
              return {
                rows: [
                  {
                    id: "c0000000-0000-0000-0000-000000000102",
                    target_id: mockWorkerUser.id,
                    target_type: "WORKER",
                    verification_type: "GOVERNMENT_ID",
                    document_ref: validPath,
                    storage_path: validPath,
                    status: "PENDING",
                    user_email: mockWorkerUser.email,
                  },
                ],
              };
            }
            return { rows: [] };
          }),
        };
        return await callback(mockClient);
      });

      await expect(
        adminService.approveVerification(mockAdminUser.id, "c0000000-0000-0000-0000-000000000102", { notes: "Trying to approve missing storage obj" })
      ).rejects.toThrow(/Document file could not be verified in secure storage/);
    });
  });

  describe("4. Approval Synchronization (Atomic Transaction)", () => {
    it("synchronizes users.identity_verified, worker_profiles.verified_badge and audit log atomically", async () => {
      const executedQueries: string[] = [];
      vi.spyOn(storageService, "verifyObjectExists").mockResolvedValue(true);

      vi.spyOn(dbModule, "withTransaction").mockImplementation(async (callback: any) => {
        const mockClient = {
          query: vi.fn().mockImplementation(async (sql: string, params: any[]) => {
            executedQueries.push(sql);
            if (sql.includes("FROM verifications")) {
              return {
                rows: [
                  {
                    id: "c0000000-0000-0000-0000-000000000001",
                    target_id: mockWorkerUser.id,
                    target_type: "WORKER",
                    verification_type: "GOVERNMENT_ID",
                    document_ref: `kyc/${mockWorkerUser.id}/genuine_aadhaar.jpg`,
                    storage_path: `kyc/${mockWorkerUser.id}/genuine_aadhaar.jpg`,
                    status: "PENDING",
                    user_email: mockWorkerUser.email,
                  },
                ],
              };
            }
            if (sql.includes("UPDATE verifications")) {
              return {
                rows: [
                  {
                    id: "c0000000-0000-0000-0000-000000000001",
                    status: "VERIFIED",
                    reviewed_by: mockAdminUser.id,
                  },
                ],
              };
            }
            return { rows: [] };
          }),
        };
        return await callback(mockClient);
      });

      const result = await adminService.approveVerification(
        mockAdminUser.id,
        "c0000000-0000-0000-0000-000000000001",
        { notes: "All credentials verified successfully" }
      );

      expect(result.status).toBe("VERIFIED");

      // Verify that users table is updated
      expect(executedQueries.some((q) => q.includes("UPDATE users") && q.includes("identity_verified = TRUE"))).toBe(true);

      // Verify that worker_profiles table verified_badge is updated
      expect(executedQueries.some((q) => q.includes("UPDATE worker_profiles") && q.includes("verified_badge = TRUE"))).toBe(true);

      // Verify notification is created
      expect(executedQueries.some((q) => q.includes("INSERT INTO notifications"))).toBe(true);

      // Verify audit log is created via transaction client
      expect(executedQueries.some((q) => q.includes("INSERT INTO audit_logs"))).toBe(true);
    });

    it("rolls back approval transaction if writing the audit record fails", async () => {
      vi.spyOn(storageService, "verifyObjectExists").mockResolvedValue(true);
      vi.spyOn(dbModule, "withTransaction").mockImplementation(async (callback: any) => {
        const mockClient = {
          query: vi.fn().mockImplementation(async (sql: string, params: any[]) => {
            if (sql.includes("FROM verifications")) {
              return {
                rows: [
                  {
                    id: "c0000000-0000-0000-0000-000000000001",
                    target_id: mockWorkerUser.id,
                    target_type: "WORKER",
                    verification_type: "GOVERNMENT_ID",
                    document_ref: `kyc/${mockWorkerUser.id}/genuine_aadhaar.jpg`,
                    storage_path: `kyc/${mockWorkerUser.id}/genuine_aadhaar.jpg`,
                    status: "PENDING",
                    user_email: mockWorkerUser.email,
                  },
                ],
              };
            }
            if (sql.includes("UPDATE verifications") || sql.includes("UPDATE users") || sql.includes("UPDATE worker_profiles")) {
              return { rows: [{ id: "c0000000-0000-0000-0000-000000000001", status: "VERIFIED" }] };
            }
            if (sql.includes("INSERT INTO audit_logs")) {
              throw new Error("Simulated database failure during audit log insertion");
            }
            return { rows: [] };
          }),
        };
        return await callback(mockClient);
      });

      await expect(
        adminService.approveVerification(
          mockAdminUser.id,
          "c0000000-0000-0000-0000-000000000001",
          { notes: "Testing audit rollback" }
        )
      ).rejects.toThrow("Simulated database failure during audit log insertion");
    });
  });

  describe("5. Rejection & Resubmission Flow", () => {
    it("records rejection reason and notifies user", async () => {
      const executedQueries: string[] = [];

      vi.spyOn(dbModule, "query").mockImplementation(async (sql: string, params: any[]) => {
        executedQueries.push(sql);
        if (sql.includes("FROM verifications") || sql.includes("SELECT * FROM verifications")) {
          return {
            rows: [
              {
                id: "c0000000-0000-0000-0000-000000000002",
                target_id: mockWorkerUser.id,
                target_type: "WORKER",
                status: "PENDING",
              },
            ],
          };
        }
        if (sql.includes("UPDATE verifications")) {
          return {
            rows: [
              {
                id: "c0000000-0000-0000-0000-000000000002",
                status: "REJECTED",
                rejection_reason: "Document image is expired",
              },
            ],
          };
        }
        return { rows: [] };
      });

      const result = await adminService.rejectVerification(
        mockAdminUser.id,
        "c0000000-0000-0000-0000-000000000002",
        { rejectionReason: "Document image is expired" }
      );

      expect(result.status).toBe("REJECTED");
      expect(executedQueries.some((q) => q.includes("UPDATE users SET identity_verified = FALSE"))).toBe(true);
      expect(executedQueries.some((q) => q.includes("INSERT INTO notifications") && q.includes("VERIFICATION_REJECTED"))).toBe(true);
    });

    it("handles requestResubmission setting status to RESUBMISSION_REQUIRED with feedback", async () => {
      const executedQueries: string[] = [];

      vi.spyOn(dbModule, "withTransaction").mockImplementation(async (callback: any) => {
        const mockClient = {
          query: vi.fn().mockImplementation(async (sql: string) => {
            executedQueries.push(sql);
            if (sql.includes("SELECT * FROM verifications")) {
              return {
                rows: [
                  {
                    id: "c0000000-0000-0000-0000-000000000003",
                    target_id: mockWorkerUser.id,
                    target_type: "WORKER",
                    status: "PENDING",
                  },
                ],
              };
            }
            if (sql.includes("UPDATE verifications")) {
              return {
                rows: [
                  {
                    id: "c0000000-0000-0000-0000-000000000003",
                    status: "RESUBMISSION_REQUIRED",
                    rejection_reason: "Photo was blurry, please re-upload clear front side",
                  },
                ],
              };
            }
            return { rows: [] };
          }),
        };
        return await callback(mockClient);
      });

      const result = await adminService.requestResubmission(
        mockAdminUser.id,
        "c0000000-0000-0000-0000-000000000003",
        { instructions: "Photo was blurry, please re-upload clear front side" }
      );

      expect(result.status).toBe("RESUBMISSION_REQUIRED");
      expect(executedQueries.some((q) => q.includes("status = 'RESUBMISSION_REQUIRED'"))).toBe(true);
      expect(executedQueries.some((q) => q.includes("UPDATE users SET identity_verified = FALSE"))).toBe(true);
      expect(executedQueries.some((q) => q.includes("UPDATE worker_profiles SET verified_badge = FALSE"))).toBe(true);
      expect(executedQueries.some((q) => q.includes("INSERT INTO audit_logs"))).toBe(true);
      expect(executedQueries.some((q) => q.includes("VERIFICATION_RESUBMISSION_REQUIRED"))).toBe(true);
    });

    it("revokes verified badges atomically so an already-verified user cannot remain verified while resubmission is required", async () => {
      const executedQueries: string[] = [];

      vi.spyOn(dbModule, "withTransaction").mockImplementation(async (callback: any) => {
        const mockClient = {
          query: vi.fn().mockImplementation(async (sql: string) => {
            executedQueries.push(sql);
            if (sql.includes("SELECT * FROM verifications")) {
              return {
                rows: [
                  {
                    id: "c0000000-0000-0000-0000-000000000077",
                    target_id: mockWorkerUser.id,
                    target_type: "WORKER",
                    status: "VERIFIED", // Previously verified
                  },
                ],
              };
            }
            if (sql.includes("UPDATE verifications")) {
              return {
                rows: [
                  {
                    id: "c0000000-0000-0000-0000-000000000077",
                    status: "RESUBMISSION_REQUIRED",
                  },
                ],
              };
            }
            return { rows: [] };
          }),
        };
        return await callback(mockClient);
      });

      await adminService.requestResubmission(
        mockAdminUser.id,
        "c0000000-0000-0000-0000-000000000077",
        { reason: "Updated address proof required due to policy change" }
      );

      // Verifies users table verified flag is revoked
      expect(executedQueries.some((q) => q.includes("UPDATE users SET identity_verified = FALSE"))).toBe(true);
      // Verifies worker profile badge is revoked
      expect(executedQueries.some((q) => q.includes("UPDATE worker_profiles SET verified_badge = FALSE, is_verified = FALSE"))).toBe(true);
    });
  });

  describe("6. Document Preview Security", () => {
    it("returns isFixture: true for test fixtures without generating signed URLs", async () => {
      vi.spyOn(dbModule, "query").mockImplementation(async (sql: string) => {
        if (sql.includes("SELECT v.*")) {
          return {
            rows: [
              {
                id: "c0000000-0000-0000-0000-000000000007",
                document_ref: "DOC_HASH_AADHAAR_9812",
                storage_path: null,
                user_email: "test.worker@nearvia.test",
              },
            ],
          } as any;
        }
        return { rows: [] } as any;
      });

      const preview = await adminService.getDocumentPreview(mockAdminUser.id, "c0000000-0000-0000-0000-000000000007");
      expect(preview.isFixture).toBe(true);
      expect(preview.previewUrl).toBeNull();
      expect(preview.message).toContain("test fixture");
    });

    it("generates a 60s signed preview URL for genuine document storage path when Supabase succeeds", async () => {
      const genuineDocPath = `kyc/${mockWorkerUser.id}/valid_doc.png`;
      const mockSignedUrl = `https://supabase.co/storage/v1/object/sign/kyc-documents/${genuineDocPath}?token=admin-60s-preview`;
      vi.spyOn(supabaseService, "getSupabaseAdminClient").mockReturnValueOnce({
        storage: {
          from: vi.fn().mockReturnValue({
            createSignedUrl: vi.fn().mockResolvedValue({
              data: { signedUrl: mockSignedUrl },
              error: null,
            }),
          }),
        },
      } as any);

      vi.spyOn(dbModule, "query").mockImplementation(async (sql: string) => {
        if (sql.includes("SELECT v.*")) {
          return {
            rows: [
              {
                id: "c0000000-0000-0000-0000-000000000008",
                target_id: mockWorkerUser.id,
                document_ref: genuineDocPath,
                storage_path: genuineDocPath,
                user_email: mockWorkerUser.email,
              },
            ],
          } as any;
        }
        return { rows: [] } as any;
      });

      const preview = await adminService.getDocumentPreview(mockAdminUser.id, "c0000000-0000-0000-0000-000000000008");
      expect(preview.isFixture).toBe(false);
      expect(preview.isMissing).toBe(false);
      expect(preview.previewUrl).toBe(mockSignedUrl);
      expect(preview.storagePath).toBe(genuineDocPath);
    });

    it("returns previewUrl: null and isMissing: true when document object is not found in storage", async () => {
      const genuineDocPath = `kyc/${mockWorkerUser.id}/valid_doc.png`;
      vi.spyOn(supabaseService, "getSupabaseAdminClient").mockReturnValueOnce({
        storage: {
          from: vi.fn().mockReturnValue({
            createSignedUrl: vi.fn().mockResolvedValue({
              data: null,
              error: { message: "Object not found in storage bucket" },
            }),
          }),
        },
      } as any);

      vi.spyOn(dbModule, "query").mockImplementation(async (sql: string) => {
        if (sql.includes("SELECT v.*")) {
          return {
            rows: [
              {
                id: "c0000000-0000-0000-0000-000000000009",
                target_id: mockWorkerUser.id,
                document_ref: genuineDocPath,
                storage_path: genuineDocPath,
                user_email: mockWorkerUser.email,
              },
            ],
          } as any;
        }
        return { rows: [] } as any;
      });

      const preview = await adminService.getDocumentPreview(mockAdminUser.id, "c0000000-0000-0000-0000-000000000009");
      expect(preview.previewUrl).toBeNull();
      expect(preview.isMissing).toBe(true);
      expect(preview.message).toContain("Object not found in storage bucket");
    });

    it("returns previewUrl: null and isMissing: true when document path belongs to another user (cross-user path)", async () => {
      const crossUserDocPath = "kyc/victim-other-user/secret_id.png";
      vi.spyOn(dbModule, "query").mockImplementation(async (sql: string) => {
        if (sql.includes("SELECT v.*")) {
          return {
            rows: [
              {
                id: "c0000000-0000-0000-0000-000000000010",
                target_id: mockWorkerUser.id,
                document_ref: crossUserDocPath,
                storage_path: crossUserDocPath,
                user_email: mockWorkerUser.email,
              },
            ],
          } as any;
        }
        return { rows: [] } as any;
      });

      const preview = await adminService.getDocumentPreview(mockAdminUser.id, "c0000000-0000-0000-0000-000000000010");
      expect(preview.previewUrl).toBeNull();
      expect(preview.isMissing).toBe(true);
      expect(preview.message).toContain("No genuine user-scoped document path exists");
    });
  });
});
