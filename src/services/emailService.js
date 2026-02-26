import { Resend } from 'resend';

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

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

  const calendlyUrl = 'https://calendly.com/shawn-lowerproptax/new-meeting';

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

Unfortunately, we didn't find any savings opportunity for this property.

Questions? Reply to this email and we'll be happy to help.

- The LowerPropTax Team
`;

  try {
    await resend.emails.send({
      from: 'LowerPropTax <help@lowerproptax.com>',
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

export async function sendReportPurchasedNotification(recipient) {
  if (!resend) {
    console.log('Email service not configured (RESEND_API_KEY missing)');
    return;
  }

  const { address, email, report_url, recipient_name } = recipient;
  const firstName = recipient_name.split(' ')[0];

  const emailContent = `Hi ${firstName},

Thank you for purchasing your Property Tax Savings Report!

Property: ${address}
${report_url ? `\nYour report is ready. You can download it here:\n${report_url}\n` : '\nYour report is being finalized and will be sent to you shortly.\n'}
The report includes:
- Which exemptions you qualify for
- How much you'll save each year
- Step-by-step filing instructions

The filing deadline is April 1st, so be sure to file soon. If you have any questions, reply to this email or call us at (470) 312-3330.

Thanks,
Shawn Wilkinson
LowerPropTax
`;

  try {
    await resend.emails.send({
      from: 'LowerPropTax <help@lowerproptax.com>',
      to: email,
      bcc: 'help@lowerproptax.com',
      subject: `Your Property Tax Savings Report - ${address}`,
      text: emailContent
    });
    console.log(`Report purchased notification sent to ${email}`);
  } catch (error) {
    console.error('Failed to send report purchased notification:', error.message);
  }
}
