import type { Response } from 'express';
import pool from '../db/connection.js';
import { sendAssessmentReadyNotification } from '../services/emailService.js';
import type { AuthenticatedRequest, Property, Assessment, UpdatePropertyDetailsBody, CurrentAssessmentPlaceholder } from '../types/index.js';

// Row types from database
interface PendingPropertyRow {
  id: string;
  address: string;
  city: string;
  state: string;
  zip_code: string;
  status: string | null;
  created_at: Date;
  user_id: string;
}

interface CompletedPropertyRow {
  id: string;
  address: string;
  city: string;
  state: string;
  zip_code: string;
  status: string;
  created_at: Date;
  updated_at: Date;
  user_id: string;
}

interface PropertyDetailsRow {
  id: string;
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
  userId: string;
  assessments?: Assessment[];
  currentAssessment?: Assessment | CurrentAssessmentPlaceholder;
  userEmail?: string | null;
}

interface AssessmentRow {
  id: string;
  year: number;
  appraisedValue: number | null;
  annualTax: number | null;
  estimatedAppraisedValue: number | null;
  estimatedAnnualTax: number | null;
  reportUrl: string | null;
  status: string;
  createdAt: Date;
  updatedAt: Date;
  annual_tax?: number | null;
  estimated_annual_tax?: number | null;
}

interface UpdatedPropertyRow {
  id: string;
  address?: string;
  city?: string;
  state?: string;
  zip_code?: string;
  user_id: string;
  bedrooms?: number;
  bathrooms?: number;
  sqft?: number;
  updated_at: Date;
}

interface ClerkUserResponse {
  email_addresses?: Array<{ email_address: string }>;
}

// Get all pending properties (status = 'preparing')
export async function getPendingProperties(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const query = `
      SELECT
        p.id,
        p.address,
        p.city,
        p.state,
        p.zip_code,
        a.status,
        p.created_at,
        p.user_id
      FROM properties p
      LEFT JOIN assessments a ON p.id = a.property_id
        AND a.year = (SELECT MAX(year) FROM assessments WHERE property_id = p.id)
      WHERE a.status = 'preparing' OR a.status IS NULL
      ORDER BY p.created_at ASC
    `;

    const result = await pool.query<PendingPropertyRow>(query);

    // Ensure status defaults to 'preparing' if null
    const properties = result.rows.map((prop: PendingPropertyRow) => ({
      ...prop,
      status: prop.status || 'preparing'
    }));

    res.json(properties);
  } catch (error) {
    console.error('Error fetching pending properties:', error);
    res.status(500).json({ error: 'Failed to fetch pending properties' });
  }
}

// Get all completed properties (status = 'ready' or 'invalid')
export async function getCompletedProperties(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const query = `
      SELECT
        p.id,
        p.address,
        p.city,
        p.state,
        p.zip_code,
        a.status,
        p.created_at,
        p.updated_at,
        p.user_id
      FROM properties p
      LEFT JOIN assessments a ON p.id = a.property_id
        AND a.year = (SELECT MAX(year) FROM assessments WHERE property_id = p.id)
      WHERE a.status IN ('ready', 'invalid')
      ORDER BY p.updated_at DESC
    `;

    const result = await pool.query<CompletedPropertyRow>(query);

    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching completed properties:', error);
    res.status(500).json({ error: 'Failed to fetch completed properties' });
  }
}

// Get a single property details for admin editing
export async function getPropertyDetails(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { id } = req.params;

    const query = `
      SELECT
        id,
        address,
        city,
        state,
        zip_code as "zipCode",
        country,
        lat,
        lng,
        bedrooms,
        bathrooms,
        sqft,
        created_at as "createdAt",
        updated_at as "updatedAt",
        user_id as "userId"
      FROM properties
      WHERE id = $1
    `;

    const result = await pool.query<PropertyDetailsRow>(query, [id]);

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Property not found' });
      return;
    }

    const property = result.rows[0];

    // Get assessments for this property
    const assessmentsResult = await pool.query<AssessmentRow>(
      `SELECT id, year, appraised_value as "appraisedValue", annual_tax as "annualTax",
              estimated_appraised_value as "estimatedAppraisedValue",
              estimated_annual_tax as "estimatedAnnualTax", report_url as "reportUrl",
              status, created_at as "createdAt", updated_at as "updatedAt"
       FROM assessments
       WHERE property_id = $1
       ORDER BY year DESC`,
      [id]
    );

    property.assessments = assessmentsResult.rows;

    // Get current year's assessment or create default
    const currentYear = new Date().getFullYear();
    const currentAssessment = assessmentsResult.rows.find((a: AssessmentRow) => a.year === currentYear);

    property.currentAssessment = currentAssessment || {
      year: currentYear,
      appraisedValue: null,
      annualTax: null,
      estimatedAppraisedValue: null,
      estimatedAnnualTax: null,
      reportUrl: null,
      status: 'preparing'
    };

    // Fetch user email from Clerk
    try {
      const clerkApiKey = process.env.CLERK_SECRET_KEY;
      if (clerkApiKey && property.userId) {
        const clerkResponse = await fetch(`https://api.clerk.com/v1/users/${property.userId}`, {
          headers: {
            'Authorization': `Bearer ${clerkApiKey}`
          }
        });

        if (clerkResponse.ok) {
          const clerkUser = await clerkResponse.json() as ClerkUserResponse;
          property.userEmail = clerkUser.email_addresses?.[0]?.email_address || null;
        } else {
          property.userEmail = null;
        }
      } else {
        property.userEmail = null;
      }
    } catch (clerkError) {
      console.error('Error fetching user from Clerk:', clerkError);
      property.userEmail = null;
    }

    res.json(property);
  } catch (error) {
    console.error('Error fetching property details:', error);
    res.status(500).json({ error: 'Failed to fetch property details' });
  }
}

// Update property details
export async function updatePropertyDetails(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const {
      bedrooms,
      bathrooms,
      sqft,
      year,
      appraisedValue,
      annualTax,
      estimatedAppraisedValue,
      estimatedAnnualTax,
      reportUrl,
      status
    } = req.body as UpdatePropertyDetailsBody;

    // Update property (bedrooms, bathrooms, sqft)
    const propertyQuery = `
      UPDATE properties
      SET
        bedrooms = COALESCE($1, bedrooms),
        bathrooms = COALESCE($2, bathrooms),
        sqft = COALESCE($3, sqft),
        updated_at = NOW()
      WHERE id = $4
      RETURNING *
    `;

    const propertyResult = await pool.query<UpdatedPropertyRow>(propertyQuery, [
      bedrooms !== undefined ? bedrooms : null,
      bathrooms !== undefined ? bathrooms : null,
      sqft !== undefined ? sqft : null,
      id
    ]);

    if (propertyResult.rows.length === 0) {
      res.status(404).json({ error: 'Property not found' });
      return;
    }

    // Update or create assessment for the specified year (or current year if not specified)
    const assessmentYear = year || new Date().getFullYear();

    const assessmentQuery = `
      INSERT INTO assessments (id, property_id, year, appraised_value, annual_tax,
                               estimated_appraised_value, estimated_annual_tax, report_url,
                               status, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())
      ON CONFLICT (property_id, year)
      DO UPDATE SET
        appraised_value = COALESCE($4, assessments.appraised_value),
        annual_tax = COALESCE($5, assessments.annual_tax),
        estimated_appraised_value = COALESCE($6, assessments.estimated_appraised_value),
        estimated_annual_tax = COALESCE($7, assessments.estimated_annual_tax),
        report_url = COALESCE($8, assessments.report_url),
        status = COALESCE($9, assessments.status),
        updated_at = NOW()
      RETURNING *
    `;

    const assessmentId = `assess_${id}_${assessmentYear}`;
    const assessmentResult = await pool.query<AssessmentRow>(assessmentQuery, [
      assessmentId,
      id,
      assessmentYear,
      appraisedValue !== undefined ? appraisedValue : null,
      annualTax !== undefined ? annualTax : null,
      estimatedAppraisedValue !== undefined ? estimatedAppraisedValue : null,
      estimatedAnnualTax !== undefined ? estimatedAnnualTax : null,
      reportUrl !== undefined ? reportUrl : null,
      status !== undefined ? status : null
    ]);

    // Return combined result
    const response = {
      ...propertyResult.rows[0],
      currentAssessment: assessmentResult.rows[0]
    };

    // Send email notification if status was set to 'ready'
    if (status === 'ready') {
      const property = propertyResult.rows[0];
      const assessment = {
        annualTax: assessmentResult.rows[0].annual_tax,
        estimatedAnnualTax: assessmentResult.rows[0].estimated_annual_tax
      };

      // Fetch user email from Clerk
      try {
        const clerkApiKey = process.env.CLERK_SECRET_KEY;
        if (clerkApiKey && property.user_id) {
          const clerkResponse = await fetch(`https://api.clerk.com/v1/users/${property.user_id}`, {
            headers: { 'Authorization': `Bearer ${clerkApiKey}` }
          });

          if (clerkResponse.ok) {
            const clerkUser = await clerkResponse.json() as ClerkUserResponse;
            const userEmail = clerkUser.email_addresses?.[0]?.email_address;
            if (userEmail) {
              sendAssessmentReadyNotification(property as unknown as Property, assessment, userEmail).catch(() => {});
            }
          }
        }
      } catch (clerkError) {
        console.error('Error fetching user for notification:', clerkError);
      }
    }

    res.json(response);
  } catch (error) {
    console.error('Error updating property details:', error);
    res.status(500).json({ error: 'Failed to update property details' });
  }
}

// Mark property as ready (legacy function, kept for backward compatibility)
export async function markPropertyAsReady(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { id } = req.params;

    const query = `
      UPDATE properties
      SET status = 'ready', updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `;

    const result = await pool.query<UpdatedPropertyRow>(query, [id]);

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Property not found' });
      return;
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error marking property as ready:', error);
    res.status(500).json({ error: 'Failed to mark property as ready' });
  }
}
