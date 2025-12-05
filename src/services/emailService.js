import { Resend } from 'resend';

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

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
    console.error('Failed to send email notification:', error.message);
  }
}
