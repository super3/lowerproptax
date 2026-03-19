import { Resend } from 'resend';

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

export async function sendReferralVisitNotification(property, visitInfo) {
  if (!resend) {
    console.log('Email service not configured (RESEND_API_KEY missing)');
    return;
  }

  const { address, referral_code, owner_name } = property;
  const { ip_address, user_agent, visited_at, visit_count } = visitInfo;

  try {
    await resend.emails.send({
      from: 'LowerPropTax <help@lowerproptax.com>',
      to: 'help@lowerproptax.com',
      subject: `Mailer Link Opened - ${address}`,
      text: `Someone visited a direct mail referral link:

Property: ${address}
Owner: ${owner_name || 'Unknown'}
Referral Code: ${referral_code}
Link: lowerproptax.com/r/${referral_code}
Visit #: ${visit_count}
Time: ${visited_at}
IP: ${ip_address || 'Unknown'}
User Agent: ${user_agent || 'Unknown'}
`
    });
    console.log(`Referral visit notification sent for ${referral_code}`);
  } catch (error) {
    console.error('Failed to send referral visit notification:', error.message);
  }
}
