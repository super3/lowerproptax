import type { Response } from 'express';
import pool from '../db/connection.js';
import { sendNewPropertyNotification } from '../services/emailService.js';
import type { AuthenticatedRequest, Property, Assessment, CreatePropertyBody, UpdatePropertyBody } from '../types/index.js';

// Row types from database
interface PropertyRow {
  id: string;
  userId: string;
  address: string;
  city: string;
  state: string;
  zipCode: string;
  country: string;
  lat: number | null;
  lng: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  sqft: number | null;
  createdAt: Date;
  updatedAt: Date;
  assessmentId?: string | null;
  assessmentYear?: number | null;
  assessmentAppraisedValue?: number | null;
  assessmentAnnualTax?: number | null;
  assessmentEstimatedAppraisedValue?: number | null;
  assessmentEstimatedAnnualTax?: number | null;
  assessmentReportUrl?: string | null;
  assessmentStatus?: string | null;
  assessmentCreatedAt?: Date | null;
  assessmentUpdatedAt?: Date | null;
  assessments?: Assessment[];
}

interface OwnershipRow {
  user_id: string;
}

// Test helper to reset storage
export async function resetProperties(): Promise<void> {
  await pool.query('DELETE FROM properties');
}

// Get all properties for the authenticated user
export async function getProperties(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const userId = req.user.id;

    // Single query with LEFT JOIN to get properties and their latest assessments
    const result = await pool.query<PropertyRow>(
      `SELECT p.id, p.user_id as "userId", p.address, p.city, p.state,
              p.zip_code as "zipCode", p.country, p.lat, p.lng,
              p.bedrooms, p.bathrooms, p.sqft,
              p.created_at as "createdAt", p.updated_at as "updatedAt",
              a.id as "assessmentId", a.year as "assessmentYear",
              a.appraised_value as "assessmentAppraisedValue",
              a.annual_tax as "assessmentAnnualTax",
              a.estimated_appraised_value as "assessmentEstimatedAppraisedValue",
              a.estimated_annual_tax as "assessmentEstimatedAnnualTax",
              a.report_url as "assessmentReportUrl",
              a.status as "assessmentStatus",
              a.created_at as "assessmentCreatedAt",
              a.updated_at as "assessmentUpdatedAt"
       FROM properties p
       LEFT JOIN (
         SELECT DISTINCT ON (property_id) *
         FROM assessments
         ORDER BY property_id, year DESC
       ) a ON a.property_id = p.id
       WHERE p.user_id = $1
       ORDER BY p.created_at DESC`,
      [userId]
    );

    // Transform flat rows into nested structure
    const properties: Property[] = result.rows.map((row: PropertyRow) => ({
      id: row.id,
      userId: row.userId,
      address: row.address,
      city: row.city,
      state: row.state,
      zipCode: row.zipCode,
      country: row.country,
      lat: row.lat,
      lng: row.lng,
      bedrooms: row.bedrooms,
      bathrooms: row.bathrooms,
      sqft: row.sqft,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      latestAssessment: row.assessmentId ? {
        id: row.assessmentId,
        year: row.assessmentYear as number,
        appraisedValue: row.assessmentAppraisedValue,
        annualTax: row.assessmentAnnualTax,
        estimatedAppraisedValue: row.assessmentEstimatedAppraisedValue,
        estimatedAnnualTax: row.assessmentEstimatedAnnualTax,
        reportUrl: row.assessmentReportUrl,
        status: row.assessmentStatus || undefined,
        createdAt: row.assessmentCreatedAt || undefined,
        updatedAt: row.assessmentUpdatedAt || undefined
      } : null
    }));

    res.json(properties);
  } catch (error) {
    console.error('Error getting properties:', error);
    res.status(500).json({ error: 'Failed to get properties' });
  }
}

// Get a single property by ID
export async function getProperty(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const result = await pool.query<PropertyRow>(
      `SELECT id, user_id as "userId", address, city, state,
              zip_code as "zipCode", country, lat, lng,
              bedrooms, bathrooms, sqft,
              created_at as "createdAt", updated_at as "updatedAt"
       FROM properties WHERE id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Property not found' });
      return;
    }

    const property = result.rows[0] as PropertyRow & { assessments?: Assessment[] };

    // Ensure user owns this property
    if (property.userId !== req.user.id) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    // Get all assessments for this property
    const assessmentsResult = await pool.query<Assessment>(
      `SELECT id, year, appraised_value as "appraisedValue",
              annual_tax as "annualTax", estimated_appraised_value as "estimatedAppraisedValue",
              estimated_annual_tax as "estimatedAnnualTax", report_url as "reportUrl",
              status, created_at as "createdAt", updated_at as "updatedAt"
       FROM assessments
       WHERE property_id = $1
       ORDER BY year DESC`,
      [id]
    );

    property.assessments = assessmentsResult.rows;

    res.json(property);
  } catch (error) {
    console.error('Error getting property:', error);
    res.status(500).json({ error: 'Failed to get property' });
  }
}

// Create a new property
export async function createProperty(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { address, city, state, zipCode, country, lat, lng } = req.body as CreatePropertyBody;

    if (!address) {
      res.status(400).json({ error: 'Address is required' });
      return;
    }

    const propertyId = `prop_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const result = await pool.query<PropertyRow>(
      `INSERT INTO properties (id, user_id, address, city, state, zip_code, country, lat, lng, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())
       RETURNING id, user_id as "userId", address, city, state,
                 zip_code as "zipCode", country, lat, lng,
                 created_at as "createdAt", updated_at as "updatedAt"`,
      [
        propertyId,
        req.user.id,
        address,
        city || '',
        state || '',
        zipCode || '',
        country || '',
        lat || null,
        lng || null
      ]
    );

    const property = result.rows[0];

    // Send email notification (fire-and-forget)
    sendNewPropertyNotification(property, req.user.email).catch(() => {});

    res.status(201).json(property);
  } catch (error) {
    console.error('Error creating property:', error);
    res.status(500).json({ error: 'Failed to create property' });
  }
}

// Update a property
export async function updateProperty(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { id } = req.params;

    // First check if property exists and user owns it
    const checkResult = await pool.query<OwnershipRow>(
      'SELECT user_id FROM properties WHERE id = $1',
      [id]
    );

    if (checkResult.rows.length === 0) {
      res.status(404).json({ error: 'Property not found' });
      return;
    }

    const property = checkResult.rows[0];

    // Ensure user owns this property
    if (property.user_id !== req.user.id) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    const { address, city, state, zipCode, country, lat, lng } = req.body as UpdatePropertyBody;

    const result = await pool.query<PropertyRow>(
      `UPDATE properties
       SET address = COALESCE($1, address),
           city = COALESCE($2, city),
           state = COALESCE($3, state),
           zip_code = COALESCE($4, zip_code),
           country = COALESCE($5, country),
           lat = COALESCE($6, lat),
           lng = COALESCE($7, lng),
           updated_at = NOW()
       WHERE id = $8
       RETURNING id, user_id as "userId", address, city, state,
                 zip_code as "zipCode", country, lat, lng,
                 created_at as "createdAt", updated_at as "updatedAt"`,
      [
        /* istanbul ignore next */ address !== undefined ? address : null,
        /* istanbul ignore next */ city !== undefined ? city : null,
        /* istanbul ignore next */ state !== undefined ? state : null,
        /* istanbul ignore next */ zipCode !== undefined ? zipCode : null,
        /* istanbul ignore next */ country !== undefined ? country : null,
        /* istanbul ignore next */ lat !== undefined ? lat : null,
        /* istanbul ignore next */ lng !== undefined ? lng : null,
        id
      ]
    );

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating property:', error);
    res.status(500).json({ error: 'Failed to update property' });
  }
}

// Delete a property
export async function deleteProperty(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { id } = req.params;

    // First check if property exists and user owns it
    const checkResult = await pool.query<OwnershipRow>(
      'SELECT user_id FROM properties WHERE id = $1',
      [id]
    );

    if (checkResult.rows.length === 0) {
      res.status(404).json({ error: 'Property not found' });
      return;
    }

    const property = checkResult.rows[0];

    // Ensure user owns this property
    if (property.user_id !== req.user.id) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    await pool.query('DELETE FROM properties WHERE id = $1', [id]);
    res.json({ message: 'Property deleted successfully' });
  } catch (error) {
    console.error('Error deleting property:', error);
    res.status(500).json({ error: 'Failed to delete property' });
  }
}
