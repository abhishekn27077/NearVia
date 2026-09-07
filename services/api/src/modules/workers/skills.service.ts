/**
 * Skills Catalog Domain Service
 * Provides queries for the normalized platform skills taxonomy.
 */

import { Skill } from "@nearvia/types";
import { query } from "../../db";

export const SEED_SKILLS: Skill[] = [
  {
    id: "b0000001-0000-0000-0000-000000000001",
    categoryId: "a0000001-0000-0000-0000-000000000001",
    name: "Kitchen Helper / Food Prep",
    description: "Vegetable chopping, ingredient prep, kitchen sanitation",
    isActive: true,
    categoryName: "Restaurant & Hospitality",
    categorySlug: "restaurant-hospitality",
    createdAt: new Date().toISOString(),
  },
  {
    id: "b0000001-0000-0000-0000-000000000002",
    categoryId: "a0000001-0000-0000-0000-000000000001",
    name: "Dishwashing & Cleaning",
    description: "Commercial utensil washing and kitchen floor cleaning",
    isActive: true,
    categoryName: "Restaurant & Hospitality",
    categorySlug: "restaurant-hospitality",
    createdAt: new Date().toISOString(),
  },
  {
    id: "b0000001-0000-0000-0000-000000000003",
    categoryId: "a0000001-0000-0000-0000-000000000001",
    name: "Table Service / Busser",
    description: "Table clearing, water serving, meal delivery",
    isActive: true,
    categoryName: "Restaurant & Hospitality",
    categorySlug: "restaurant-hospitality",
    createdAt: new Date().toISOString(),
  },
  {
    id: "b0000001-0000-0000-0000-000000000004",
    categoryId: "a0000001-0000-0000-0000-000000000002",
    name: "Shelf Stocking & Display",
    description: "Display arrangement, expiry checking, stock replenishment",
    isActive: true,
    categoryName: "Retail & Shop Assistance",
    categorySlug: "retail-shop-assistance",
    createdAt: new Date().toISOString(),
  },
  {
    id: "b0000001-0000-0000-0000-000000000005",
    categoryId: "a0000001-0000-0000-0000-000000000002",
    name: "Retail Customer Assistance",
    description: "Guiding customers to aisles, packing purchased items",
    isActive: true,
    categoryName: "Retail & Shop Assistance",
    categorySlug: "retail-shop-assistance",
    createdAt: new Date().toISOString(),
  },
  {
    id: "b0000001-0000-0000-0000-000000000006",
    categoryId: "a0000001-0000-0000-0000-000000000003",
    name: "Box Loading & Unloading",
    description: "Heavy lifting, truck loading, pallet movement",
    isActive: true,
    categoryName: "Warehouse & Logistics",
    categorySlug: "warehouse-logistics",
    createdAt: new Date().toISOString(),
  },
  {
    id: "b0000001-0000-0000-0000-000000000007",
    categoryId: "a0000001-0000-0000-0000-000000000003",
    name: "Packing & Labeling",
    description: "Barcode scanning, box taping, shipping label attachment",
    isActive: true,
    categoryName: "Warehouse & Logistics",
    categorySlug: "warehouse-logistics",
    createdAt: new Date().toISOString(),
  },
  {
    id: "b0000001-0000-0000-0000-000000000008",
    categoryId: "a0000001-0000-0000-0000-000000000004",
    name: "Tent & Stage Setup",
    description: "Stage building, canopy fixing, banner tying",
    isActive: true,
    categoryName: "Events & Setup",
    categorySlug: "events-setup",
    createdAt: new Date().toISOString(),
  },
  {
    id: "b0000001-0000-0000-0000-000000000009",
    categoryId: "a0000001-0000-0000-0000-000000000004",
    name: "Chair & Table Arrangement",
    description: "Hall seating layout, tablecloth laying, stage clearance",
    isActive: true,
    categoryName: "Events & Setup",
    categorySlug: "events-setup",
    createdAt: new Date().toISOString(),
  },
  {
    id: "b0000001-0000-0000-0000-000000000010",
    categoryId: "a0000001-0000-0000-0000-000000000007",
    name: "Basic Electrical Repair & Wiring",
    description: "Switch replacement, wiring connection, bulb fitting",
    isActive: true,
    categoryName: "Skilled Local Trades",
    categorySlug: "skilled-trades",
    createdAt: new Date().toISOString(),
  },
  {
    id: "b0000001-0000-0000-0000-000000000011",
    categoryId: "a0000001-0000-0000-0000-000000000007",
    name: "Basic Plumbing Helper",
    description: "Pipe fitting assistance, tap leak fixes, drainage clearing",
    isActive: true,
    categoryName: "Skilled Local Trades",
    categorySlug: "skilled-trades",
    createdAt: new Date().toISOString(),
  },
  {
    id: "b0000001-0000-0000-0000-000000000012",
    categoryId: "a0000001-0000-0000-0000-000000000005",
    name: "Commercial Floor Mopping",
    description: "Deep mopping, buffing, waste bin clearance",
    isActive: true,
    categoryName: "Cleaning & Housekeeping",
    categorySlug: "cleaning-housekeeping",
    createdAt: new Date().toISOString(),
  },
  {
    id: "b0000001-0000-0000-0000-000000000013",
    categoryId: "a0000001-0000-0000-0000-000000000005",
    name: "Window & Glass Cleaning",
    description: "Glass pane cleaning with squeegee and spray",
    isActive: true,
    categoryName: "Cleaning & Housekeeping",
    categorySlug: "cleaning-housekeeping",
    createdAt: new Date().toISOString(),
  },
];

export class SkillsService {
  /**
   * List active skills with category metadata, optionally filtered by category or search query.
   */
  public async getAllSkills(
    categoryId?: string,
    search?: string,
  ): Promise<Skill[]> {
    try {
      const params: unknown[] = [];
      const conditions: string[] = ["s.is_active = TRUE", "c.is_active = TRUE"];

      if (categoryId) {
        params.push(categoryId);
        conditions.push(`s.category_id = $${params.length}`);
      }

      if (search) {
        params.push(`%${search.trim().toLowerCase()}%`);
        conditions.push(
          `(LOWER(s.name) LIKE $${params.length} OR LOWER(s.description) LIKE $${params.length})`,
        );
      }

      const sql = `
        SELECT 
          s.id,
          s.category_id AS "categoryId",
          s.name,
          s.description,
          s.is_active AS "isActive",
          s.created_at AS "createdAt",
          c.name AS "categoryName",
          c.slug AS "categorySlug"
        FROM skills s
        JOIN categories c ON s.category_id = c.id
        WHERE ${conditions.join(" AND ")}
        ORDER BY c.display_order ASC, s.name ASC
      `;

      const result = await query<Skill>(sql, params);
      return result.rows;
    } catch {
      // Return reference seed data if database is offline during local preview
      let list = [...SEED_SKILLS];
      if (categoryId) {
        list = list.filter((s) => s.categoryId === categoryId);
      }
      if (search) {
        const q = search.toLowerCase();
        list = list.filter(
          (s) =>
            s.name.toLowerCase().includes(q) ||
            (s.description && s.description.toLowerCase().includes(q)),
        );
      }
      return list;
    }
  }
}

export const skillsService = new SkillsService();
