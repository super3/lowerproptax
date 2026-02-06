import { Resend } from 'resend';

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

const EMAIL_FROM = process.env.EMAIL_FROM || 'LowerPropTax <help@lowerproptax.com>';
const CALENDLY_URL = process.env.CALENDLY_URL || 'https://calendly.com/shawn-lowerproptax/new-meeting';
const DASHBOARD_URL = process.env.DASHBOARD_URL || 'https://lowerproptax.com/dashboard.html';

export async function sendNewPropertyNotification(property, userEmail) {
  if (!resend) {
    console.log('Email service not configured (RESEND_API_KEY missing)');
    return;
  }

  const { id, address, city, state, zipCode } = property;
  const location = [city, state, zipCode].filter(Boolean).join(', ');
  const fullAddress = location ? `${address}, ${location}` : address;

  try {
    await resend.emails.send({
      from: EMAIL_FROM,
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
    console.error('Failed to send email notification:', error.message);
  }
}

export async function sendAssessmentReadyNotification(property, assessment, userEmail) {
  if (!resend) {
    console.log('Email service not configured (RESEND_API_KEY missing)');
    return;
  }

  const { id, address, city, state, zipCode } = property;
  const location = [city, state, zipCode].filter(Boolean).join(', ');
  const fullAddress = location ? `${address}, ${location}` : address;

  // Calculate savings
  const annualTax = parseFloat(assessment.annualTax) || 0;
  const estimatedAnnualTax = parseFloat(assessment.estimatedAnnualTax) || 0;
  const savings = annualTax - estimatedAnnualTax;
  const savingsFormatted = savings > 0
    ? `$${savings.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    : '$0.00';

  const calendlyUrl = CALENDLY_URL;
  const dashboardUrl = DASHBOARD_URL;

  // Different email content based on whether there are savings
  const emailContent = savings > 0
    ? `Great news! Your property tax assessment is ready.

Property: ${fullAddress}
Potential Annual Savings: ${savingsFormatted}

Schedule a free consultation to discuss your homestead exemption:
${calendlyUrl}

During the call, we'll confirm your details and help you apply for your exemption right then and there.

Questions? Reply to this email and we'll be happy to help.

- The LowerPropTax Team
`
    : `Your property tax assessment is complete.

Property: ${fullAddress}

Unfortunately, we didn't find any savings opportunity for this property. You can view your dashboard here:
${dashboardUrl}

Questions? Reply to this email and we'll be happy to help.

- The LowerPropTax Team
`;

  try {
    await resend.emails.send({
      from: EMAIL_FROM,
      to: userEmail,
      subject: savings > 0
        ? `Your Property Assessment is Ready - ${savingsFormatted} in Potential Savings`
        : `Your Property Assessment is Complete`,
      text: emailContent
    });
    console.log(`Assessment ready notification sent for property ${id} to ${userEmail}`);
  } catch (error) {
    console.error('Failed to send assessment ready notification:', error.message);
  }
}
