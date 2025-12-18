import { Resend } from 'resend';
import type { EmailProperty, EmailAssessment } from '../types/index.js';

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

export async function sendNewPropertyNotification(property: EmailProperty, userEmail: string | null | undefined): Promise<void> {
  if (!resend) {
    console.log('Email service not configured (RESEND_API_KEY missing)');
    return;
  }

  const { id, address, city, state, zipCode } = property;
  const location = [city, state, zipCode].filter(Boolean).join(', ');
  const fullAddress = location ? `${address}, ${location}` : address;

  try {
    await resend.emails.send({
      from: 'LowerPropTax <help@lowerproptax.com>',
      to: 'help@lowerproptax.com',
      subject: `New Property Added - ${address}`,
      text: `A new property has been added to LowerPropTax:

Property ID: ${id}
Address: ${fullAddress}
User Email: ${userEmail || 'Not available'}
Created: ${new Date().toISOString()}
`
    });
    console.log(`Email notification sent for property ${id}`);
  } catch (error) {
    console.error('Failed to send email notification:', (error as Error).message);
  }
}

export async function sendAssessmentReadyNotification(property: EmailProperty, assessment: EmailAssessment, userEmail: string): Promise<void> {
  if (!resend) {
    console.log('Email service not configured (RESEND_API_KEY missing)');
    return;
  }

  const { id, address, city, state, zipCode } = property;
  const location = [city, state, zipCode].filter(Boolean).join(', ');
  const fullAddress = location ? `${address}, ${location}` : address;

  // Calculate savings
  const annualTax = parseFloat(String(assessment.annualTax)) || 0;
  const estimatedAnnualTax = parseFloat(String(assessment.estimatedAnnualTax)) || 0;
  const savings = annualTax - estimatedAnnualTax;
  const savingsFormatted = savings > 0
    ? `$${savings.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    : '$0.00';

  const propertyUrl = `https://lowerproptax.com/property.html?id=${id}`;

  try {
    await resend.emails.send({
      from: 'LowerPropTax <help@lowerproptax.com>',
      to: userEmail,
      subject: `Your Property Assessment is Ready - ${savingsFormatted} in Potential Savings`,
      text: `Great news! Your property tax assessment is ready.

Property: ${fullAddress}
Potential Annual Savings: ${savingsFormatted}

View your full assessment report here (sign in required):
${propertyUrl}

If you're viewing this on a different device, just click the link and sign in with your account to access your report.

Questions? Reply to this email and we'll be happy to help.

- The LowerPropTax Team
`
    });
    console.log(`Assessment ready notification sent for property ${id} to ${userEmail}`);
  } catch (error) {
    console.error('Failed to send assessment ready notification:', (error as Error).message);
  }
}
